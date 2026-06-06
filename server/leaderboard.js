// leaderboard.js
// Leaderboard GLOBAL por cancion. La estrategia es usar el repo de GitHub
// de la comunidad como "host" de un archivo JSON por cancion, igual que
// communityCatalog.js / githubClient.js (que ya usan este patron).
//
// Estructura en el repo:
//   community-leaderboards/
//     <songHash>.json
//     {
//       songHash, songName, songId,
//       entries: [{ userId, name, score, accuracy, grade, maxCombo, date }, ...]
//     }
//
// El servidor tiene una cache local en ~/.rhythm-dance/leaderboards/<songHash>.json.
// Al pedir un leaderboard:
//   1. Si esta en cache y tiene menos de 1 hora, devolver cache.
//   2. Si no, intentar traerlo del repo (1 request GET sin auth).
//   3. Si falla, devolver cache aunque este viejo (o vacio).
//
// Al subir un score:
//   1. Cliente pide subir al servidor (POST /api/leaderboard/submit).
//   2. Servidor anade al cache local.
//   3. Si entra al top 20 Y hay token configurado Y no se ha enviado en los
//      ultimos 30s (rate-limit por usuario), intentar commit al repo.
//   4. Si no hay token, devolver {ok: true, rank, queued: true} y el cliente
//      sabe que es solo local.
//
// Rate limits: ~1 commit por usuario por cancion cada 30s. Si hay muchos
// usuarios en una cancion popular, los commits se espacian. Si el repo
// devuelve 403 (rate limit), el score queda en cache y se reintenta despues.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fetchPackageFile, publishPackage } from "./githubClient.js";
import { getConfigFlag } from "./library.js";
import { getPublicName } from "./user.js";

const CACHE_DIR = path.join(os.homedir(), ".rhythm-dance", "leaderboards");
const DIR_REPO = "community-leaderboards";
fs.mkdirSync(CACHE_DIR, { recursive: true });

// Rate-limit memory: ultima subida por (userId, songHash).
const lastSubmit = new Map();
const RATE_MS = 30 * 1000;   // 30s entre submits del mismo user a la misma cancion

// Cache freshness.
const lastFetch = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;   // 1 hora

function safeHash(h) {
  return String(h || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function cachePath(songHash) {
  return path.join(CACHE_DIR, safeHash(songHash) + ".json");
}

function readCache(songHash) {
  const p = cachePath(songHash);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function writeCache(songHash, obj) {
  try { fs.writeFileSync(cachePath(songHash), JSON.stringify(obj, null, 2)); } catch (_) {}
}

function trimTop20(obj) {
  if (!obj.entries) obj.entries = [];
  obj.entries.sort((a, b) => b.score - a.score);
  obj.entries = obj.entries.slice(0, 20);
  return obj;
}

// Lee via RAW (sin auth) para minimizar rate limits. Devuelve null si 404.
async function fetchRemote(songHash, repo, branch) {
  try {
    const text = await fetchPackageFile.call(null, repo, branch, "leaderboard-" + safeHash(songHash), "lb");
    return JSON.parse(text);
  } catch (e) {
    if (e.message && e.message.includes("404")) return null;
    // fallback: usar raw directo
    return null;
  }
}

// Devuelve el leaderboard de una cancion. Primero mira cache fresco; si no,
// intenta bajar del repo. Si falla todo, devuelve cache viejo (o vacio).
export async function getLeaderboard(songHash) {
  if (!songHash) return { songHash, entries: [] };

  // Cache fresco?
  const cached = readCache(songHash);
  const now = Date.now();
  if (cached && lastFetch.get(songHash) && now - lastFetch.get(songHash) < CACHE_TTL_MS) {
    return cached;
  }

  // Intentar bajar del repo via Contents API (mismo patron que community.js).
  const repo = getConfigFlag("communityRepo") || "tuangel134/rhythm-dance";
  const branch = getConfigFlag("communityBranch") || "main";
  const owner = repo.split("/")[0];
  const repoName = repo.split("/")[1];
  const filePath = `${DIR_REPO}/${safeHash(songHash)}.json`;
  try {
    const token = getConfigFlag("githubToken");
    const headers = { "Accept": "application/vnd.github+json", "User-Agent": "rhythm-dance" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data && data.content) {
        const text = Buffer.from(data.content, "base64").toString("utf8");
        const obj = JSON.parse(text);
        lastFetch.set(songHash, now);
        writeCache(songHash, obj);
        return obj;
      }
    }
  } catch (e) {
    // Silencioso: seguimos con cache o vacio.
  }

  // Fallback: cache viejo o vacio.
  if (cached) {
    lastFetch.set(songHash, now);
    return cached;
  }
  const empty = { songHash, entries: [], songName: "", songId: null, lastUpdated: null };
  writeCache(songHash, empty);
  lastFetch.set(songHash, now);
  return empty;
}

// Envia un score al leaderboard. Devuelve {ok, rank, total, queued, reason}.
export async function submitScore({ userId, userName, songId, songName, songHash, score, accuracy, grade, maxCombo }) {
  if (!userId || !songHash) return { ok: false, reason: "datos_invalidos" };

  // Rate-limit por usuario-cancion.
  const key = userId + ":" + songHash;
  const last = lastSubmit.get(key) || 0;
  const now = Date.now();
  if (now - last < RATE_MS) {
    // Guardar en cache local igual; no intentar subir al repo.
    const obj = readCache(songHash) || { songHash, entries: [] };
    upsertLocal(obj, { userId, name: getPublicName({ userId, displayName: userName }), score, accuracy, grade, maxCombo, date: new Date().toISOString() });
    writeCache(songHash, obj);
    return { ok: true, rank: getRank(obj, userId), total: obj.entries.length, queued: true, reason: "rate_limit" };
  }
  lastSubmit.set(key, now);

  // Update cache local primero.
  const obj = readCache(songHash) || { songHash, entries: [], songName, songId };
  if (songName && !obj.songName) obj.songName = songName;
  if (songId && !obj.songId) obj.songId = songId;
  upsertLocal(obj, { userId, name: getPublicName({ userId, displayName: userName }), score, accuracy, grade, maxCombo, date: new Date().toISOString() });
  trimTop20(obj);
  obj.lastUpdated = new Date().toISOString();
  writeCache(songHash, obj);

  // Check si entra al top 20 (para commit al repo).
  const inTop = obj.entries.find((e) => e.userId === userId);
  if (!inTop) {
    return { ok: true, rank: null, total: obj.entries.length, queued: false, reason: "fuera_de_top" };
  }

  // Intentar commit al repo.
  const token = getConfigFlag("githubToken");
  if (!token) {
    return { ok: true, rank: getRank(obj, userId), total: obj.entries.length, queued: true, reason: "no_token" };
  }
  const repo = getConfigFlag("communityRepo") || "tuangel134/rhythm-dance";
  const branch = getConfigFlag("communityBranch") || "main";
  const filePath = `${DIR_REPO}/${safeHash(songHash)}.json`;
  try {
    // 1) obtener sha actual (si existe)
    const owner = repo.split("/")[0];
    const repoName = repo.split("/")[1];
    const headers = { "Accept": "application/vnd.github+json", "User-Agent": "rhythm-dance", "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
    let sha = null;
    try {
      const ex = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${branch}`, { headers });
      if (ex.ok) { const d = await ex.json(); sha = d.sha; }
    } catch (_) {}
    // 2) commit
    const body = {
      message: `leaderboard: ${userName} ${score}pts on ${songName || songHash}`,
      content: Buffer.from(JSON.stringify(obj, null, 2)).toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    };
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`, { method: "PUT", headers, body: JSON.stringify(body) });
    if (res.status === 403) return { ok: true, rank: getRank(obj, userId), total: obj.entries.length, queued: true, reason: "github_rate_limit" };
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: true, rank: getRank(obj, userId), total: obj.entries.length, queued: true, reason: "github_error: " + (j.message || res.status) };
    }
    return { ok: true, rank: getRank(obj, userId), total: obj.entries.length, queued: false, committed: true };
  } catch (e) {
    return { ok: true, rank: getRank(obj, userId), total: obj.entries.length, queued: true, reason: "github_error: " + e.message };
  }
}

function upsertLocal(obj, entry) {
  if (!obj.entries) obj.entries = [];
  const i = obj.entries.findIndex((e) => e.userId === entry.userId);
  if (i >= 0) {
    if (entry.score > obj.entries[i].score) obj.entries[i] = entry;
  } else {
    obj.entries.push(entry);
  }
  obj.entries.sort((a, b) => b.score - a.score);
  obj.entries = obj.entries.slice(0, 20);
}

function getRank(obj, userId) {
  const i = obj.entries.findIndex((e) => e.userId === userId);
  return i >= 0 ? i + 1 : null;
}
