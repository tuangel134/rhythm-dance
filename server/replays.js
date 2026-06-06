// replays.js
// Sistema de replays. Cada replay es un JSON con los eventos de una partida
// que se puede reproducir o compartir. Se guarda en disco (no en GitHub) por
// ahora, y opcionalmente se puede exportar/compartir.
//
// Formato del replay:
//   {
//     version, songId, songName, difficulty, lanes, bpm, duration,
//     notes: [...],         // subset del beatmap (lo minimo para reproducir)
//     events: [...],        // { t, type, lane?, judgment?, combo?, score? }
//     mods: {},
//     score, maxCombo, accuracy, grade,
//     userId, userName,
//     gameMode,             // "score" | "combo-race" | "practice" ...
//     date
//   }
//
// Almacenamiento:
//   ~/.rhythm-dance/replays/<userId>/<YYYYMMDD-HHMMSS>-<songHash>.json
//
// Listado: por usuario, opcionalmente filtrado por songId o gameMode.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const ROOT = path.join(os.homedir(), ".rhythm-dance", "replays");
fs.mkdirSync(ROOT, { recursive: true });

// Sanitiza un userId para que sea seguro como nombre de carpeta.
// (En realidad los UUIDs ya son seguros, pero por si acaso.)
function safeId(id) {
  if (!id) return "anon";
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function userDir(userId) {
  const d = path.join(ROOT, safeId(userId));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Genera un id unico para el replay: timestamp + hash del primer byte.
function makeId(songHash) {
  const d = new Date();
  const stamp = d.getFullYear().toString()
    + String(d.getMonth() + 1).padStart(2, "0")
    + String(d.getDate()).padStart(2, "0")
    + "-"
    + String(d.getHours()).padStart(2, "0")
    + String(d.getMinutes()).padStart(2, "0")
    + String(d.getSeconds()).padStart(2, "0");
  return stamp + "-" + (songHash || crypto.randomBytes(2).toString("hex"));
}

// Sanitiza el beatmap: solo guardamos lo necesario para reproducir (no
// guardamos intensityTimeline ni cosas internas). Esto reduce el tamano.
function sanitizeNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map((n) => {
    const o = { t: n.time, l: n.lane };
    if (n.duration) o.d = n.duration;
    return o;
  });
}

function sanitizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.map((e) => {
    const o = { t: Math.round(e.t * 1000) / 1000, type: e.type };
    if (e.lane != null) o.l = e.lane;
    if (e.judgment) o.j = e.judgment;
    return o;
  });
}

// Guarda un replay. Devuelve { id, path }.
export function saveReplay(userId, replay) {
  if (!userId) return { error: "no_userId" };
  if (!replay || !replay.songId) return { error: "datos_invalidos" };

  const clean = {
    version: 1,
    songId: replay.songId,
    songName: replay.songName || "",
    difficulty: replay.difficulty || "normal",
    lanes: replay.lanes || 5,
    bpm: replay.bpm || 120,
    duration: replay.duration || 0,
    notes: sanitizeNotes(replay.notes),
    events: sanitizeEvents(replay.events),
    mods: replay.mods || {},
    score: replay.score || 0,
    maxCombo: replay.maxCombo || 0,
    accuracy: replay.accuracy || 0,
    grade: replay.grade || "F",
    perfectStreak: replay.perfectStreak || 0,
    failed: !!replay.failed,
    userId,
    userName: replay.userName || "anon",
    gameMode: replay.gameMode || "score",
    date: new Date().toISOString(),
  };

  const id = makeId(replay.songHash);
  const f = path.join(userDir(userId), id + ".json");
  try {
    fs.writeFileSync(f, JSON.stringify(clean));
    return { id, path: f, size: fs.statSync(f).size };
  } catch (e) {
    return { error: e.message };
  }
}

// Lista los replays de un usuario, opcionalmente filtrados.
export function listReplays(userId, opts = {}) {
  const d = userDir(userId);
  const files = fs.readdirSync(d).filter((f) => f.endsWith(".json"));
  const out = [];
  for (const f of files) {
    try {
      const full = path.join(d, f);
      const obj = JSON.parse(fs.readFileSync(full, "utf8"));
      if (opts.songId && obj.songId !== opts.songId) continue;
      if (opts.gameMode && obj.gameMode !== opts.gameMode) continue;
      if (opts.maxGrade && gradeRank(obj.grade) < gradeRank(opts.maxGrade)) continue;
      const stat = fs.statSync(full);
      out.push({
        id: f.replace(/\.json$/, ""),
        songId: obj.songId,
        songName: obj.songName,
        difficulty: obj.difficulty,
        score: obj.score,
        maxCombo: obj.maxCombo,
        accuracy: obj.accuracy,
        grade: obj.grade,
        gameMode: obj.gameMode,
        date: obj.date,
        duration: obj.duration,
        size: stat.size,
        path: full,
      });
    } catch { /* archivo corrupto, ignorar */ }
  }
  out.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (opts.limit) return out.slice(0, opts.limit);
  return out;
}

// Devuelve el replay entero (para reproducirlo).
export function getReplay(userId, replayId) {
  const safe = safeId(replayId);
  const d = userDir(userId);
  const f = path.join(d, safe + ".json");
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
}

export function deleteReplay(userId, replayId) {
  const safe = safeId(replayId);
  const d = userDir(userId);
  const f = path.join(d, safe + ".json");
  try { fs.unlinkSync(f); return true; } catch { return false; }
}

// Devuelve el mejor replay del usuario para una cancion+dificultad concreta.
// Usado por F18 (jugar contra tu fantasma) y por F16 (visor de "mejor replay").
export function getBestReplay(userId, songId, difficulty) {
  const list = listReplays(userId, { songId });
  const filtered = difficulty ? list.filter((r) => r.difficulty === difficulty) : list;
  if (!filtered.length) return null;
  // El "mejor" = mayor score; desempate por accuracy.
  filtered.sort((a, b) => (b.score - a.score) || (b.accuracy - a.accuracy));
  const top = filtered[0];
  return getReplay(userId, top.id);
}

function gradeRank(g) {
  return { S: 6, A: 5, B: 4, C: 3, D: 2, F: 1 }[g] || 0;
}
