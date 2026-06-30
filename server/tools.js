// tools.js
// Resuelve las rutas de las herramientas externas (ffmpeg, ffprobe, yt-dlp)
// de forma multiplataforma (Windows / Linux / macOS).
//
// ESTRATEGIA PARA YT-DLP:
// El juego descarga el binario standalone de yt-dlp directamente desde GitHub
// a ~/.rhythm-dance/bin/. No depende de pip, python, apt, brew ni nada del
// sistema. Funciona en Windows, cualquier Linux (Debian, Arch, Fedora...) y macOS.
// Se auto-actualiza cada 3 días o inmediatamente cuando una descarga falla.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Carpeta privada del juego para binarios descargados.
const APP_BIN_DIR = path.join(os.homedir(), ".rhythm-dance", "bin");
fs.mkdirSync(APP_BIN_DIR, { recursive: true });

// Posibles ubicaciones de la carpeta bin/ con las herramientas empaquetadas:
const BIN_CANDIDATES = [
  APP_BIN_DIR,
  path.join(ROOT, "bin"),
  process.resourcesPath ? path.join(process.resourcesPath, "bin") : null,
].filter(Boolean);
const BIN_DIR = BIN_CANDIDATES[0];
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

function exeName(name) {
  return isWin ? `${name}.exe` : name;
}

function resolveTool(name, envVar) {
  if (envVar && process.env[envVar]) return process.env[envVar];
  for (const dir of BIN_CANDIDATES) {
    const local = path.join(dir, exeName(name));
    if (fs.existsSync(local)) return local;
  }
  const abs = whichSync(name);
  if (abs) return abs;
  return exeName(name);
}

function whichSync(name) {
  try {
    const cmd = isWin ? "where" : "which";
    const r = spawnSync(cmd, [exeName(name)], { encoding: "utf8" });
    if (r.status === 0 && r.stdout) {
      const first = r.stdout.split(/\r?\n/).find((l) => l.trim());
      if (first && fs.existsSync(first.trim())) return first.trim();
    }
  } catch (_) {}
  return null;
}

export const FFMPEG = resolveTool("ffmpeg", "FFMPEG_PATH");
export const FFPROBE = resolveTool("ffprobe", "FFPROBE_PATH");
// yt-dlp se resuelve dinámicamente después de ensureYtdlp()
let _ytdlpPath = resolveTool("yt-dlp", "YTDLP_PATH");
export function getYtdlpPath() { return _ytdlpPath; }
// Compatibilidad: YTDLP como getter via proxy (los módulos ES no permiten reasignar exports)
export const YTDLP = { get path() { return _ytdlpPath; }, toString() { return _ytdlpPath; } };

export const AUTO_UPDATE_INTERVAL_DAYS = 3;

export function checkTool(cmd, args = ["-version"]) {
  try {
    const r = spawnSync(cmd, args, { timeout: 5000 });
    return r.status === 0 || r.status === null ? r.error == null : false;
  } catch { return false; }
}

export function toolStatus() {
  return {
    ffmpeg: checkTool(FFMPEG, ["-version"]),
    ffprobe: checkTool(FFPROBE, ["-version"]),
    ytdlp: checkTool(_ytdlpPath, ["--version"]),
    platform: process.platform,
  };
}

export { isWin, BIN_DIR };

// ============== DESCARGA DIRECTA DE YT-DLP (BINARIO STANDALONE) ==============
// Estrategia reforzada para durar AÑOS sin romperse:
//   - Detecta arquitectura (x86_64 / aarch64 / armv7) y elige el binario correcto.
//   - Dos vías para conseguir el binario: (A) API de GitHub para saber la version
//     y la URL exacta; (B) si la API falla (rate-limit, caida, sin token), usa la
//     URL DIRECTA releases/latest/download/<asset> que NO necesita la API.
//   - Reintentos con backoff ante fallos de red.
//   - VERIFICAR ANTES DE REEMPLAZAR: descarga a un .new, comprueba que responde a
//     --version, y SOLO entonces sustituye el binario actual. Asi una descarga
//     parcial/corrupta nunca deja el juego sin un yt-dlp que funcione.
//   - Si nada de lo anterior sirve (sin internet, arch rara), cae a pip.

// Candidatos de asset por plataforma+arquitectura, en orden de preferencia.
// El ultimo ("yt-dlp", zipapp de Python) es un comodin que requiere python3;
// si no hay python, la verificacion lo descarta y se pasa a pip.
function ytdlpAssetCandidates() {
  if (isWin) {
    return process.arch === "ia32" ? ["yt-dlp_x86.exe", "yt-dlp.exe"] : ["yt-dlp.exe", "yt-dlp_x86.exe"];
  }
  if (isMac) return ["yt-dlp_macos", "yt-dlp"];
  // Linux por arquitectura
  if (process.arch === "arm64") return ["yt-dlp_linux_aarch64", "yt-dlp_linux", "yt-dlp"];
  if (process.arch === "arm") return ["yt-dlp_linux_armv7l", "yt-dlp_linux", "yt-dlp"];
  return ["yt-dlp_linux", "yt-dlp"];   // x86_64 y otros
}

function getYtdlpLocalPath() {
  return path.join(APP_BIN_DIR, exeName("yt-dlp"));
}

// GET generico con redirects + timeout. cb recibe (err, { statusCode, body:Buffer }).
function httpGet(url, timeoutMs, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error("demasiados redirects"));
    let done = false;
    const parsed = new URL(url);
    const req = https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { "User-Agent": "RhythmDance/1.0 (+https://github.com/tuangel134/rhythm-dance)", "Accept": "*/*" },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return httpGet(next, timeoutMs, redirects + 1).then(resolve, reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { if (!done) { done = true; resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }); } });
    });
    req.on("error", (e) => { if (!done) { done = true; reject(e); } });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error("timeout de red")); });
  });
}

// Descarga 'url' a 'destPath' (streaming, redirects, timeout). No es atomico:
// el llamador verifica y reemplaza. Lanza si el status no es 200.
function httpDownloadTo(url, destPath, timeoutMs, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error("demasiados redirects"));
    const parsed = new URL(url);
    const req = https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { "User-Agent": "RhythmDance/1.0", "Accept": "application/octet-stream" },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return httpDownloadTo(next, destPath, timeoutMs, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on("finish", () => { file.close(() => resolve(destPath)); });
      file.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error("timeout descargando")); });
  });
}

// Reintenta una promesa con backoff exponencial (para fallos de red transitorios).
async function withRetries(fn, tries = 3, baseDelay = 800) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; if (i < tries - 1) await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i))); }
  }
  throw lastErr;
}

// ¿Un binario en 'p' responde a --version? Devuelve la version o null.
function probeYtdlpVersion(p) {
  try {
    const r = spawnSync(p, ["--version"], { encoding: "utf8", timeout: 8000 });
    if (r.status === 0 && r.stdout && r.stdout.trim()) return r.stdout.trim().split("\n")[0].trim();
  } catch (_) {}
  return null;
}

// Reemplaza el binario actual por el recien descargado, SOLO si el nuevo
// funciona. Atomico via rename. Devuelve true si se instalo.
function installVerifiedBinary(tmpPath, destPath) {
  if (!isWin) { try { fs.chmodSync(tmpPath, 0o755); } catch (_) {} }
  const ver = probeYtdlpVersion(tmpPath);
  if (!ver) { try { fs.unlinkSync(tmpPath); } catch (_) {} return null; }
  try {
    if (isWin && fs.existsSync(destPath)) { try { fs.unlinkSync(destPath); } catch (_) {} }
    fs.renameSync(tmpPath, destPath);
    if (!isWin) fs.chmodSync(destPath, 0o755);
    return ver;
  } catch (e) {
    // rename entre dispositivos: copia + borra
    try { fs.copyFileSync(tmpPath, destPath); if (!isWin) fs.chmodSync(destPath, 0o755); fs.unlinkSync(tmpPath); return ver; }
    catch (_) { try { fs.unlinkSync(tmpPath); } catch (_) {} return null; }
  }
}

// Obtiene {version, assets:{name:url}} del ultimo release via API de GitHub.
// Puede fallar (rate-limit/caida): el llamador tiene un plan B (URL directa).
async function fetchLatestRelease(timeoutMs = 15000) {
  const res = await httpGet("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest", timeoutMs);
  if (res.statusCode !== 200) throw new Error(`API GitHub HTTP ${res.statusCode}`);
  const rel = JSON.parse(res.body.toString("utf8"));
  const assets = {};
  for (const a of rel.assets || []) assets[a.name] = a.browser_download_url;
  return { version: rel.tag_name || null, assets };
}

// URL DIRECTA (sin API) al ultimo release: sobrevive a rate-limits y caidas de
// la API. GitHub redirige siempre al asset del ultimo release publicado.
function directLatestUrl(asset) {
  return `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
}

// Consigue (descarga + verifica + instala) el binario de yt-dlp. Prueba la API
// y, si falla, la URL directa; para cada candidato de asset; con reintentos.
// Devuelve { version } si lo instalo, o lanza con el detalle de lo intentado.
async function acquireYtdlpBinary(timeoutMs = 120000) {
  const dest = getYtdlpLocalPath();
  const tmp = dest + ".new";
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const candidates = ytdlpAssetCandidates();
  const tried = [];

  // Plan A: API para version + URL exacta del asset.
  let apiAssets = null, apiVersion = null;
  try { const rel = await withRetries(() => fetchLatestRelease(timeoutMs), 2, 1000); apiAssets = rel.assets; apiVersion = rel.version; }
  catch (e) { tried.push(`api:${e.message}`); }

  for (const asset of candidates) {
    // URL: preferimos la de la API; si no, la directa.
    const url = (apiAssets && apiAssets[asset]) ? apiAssets[asset] : directLatestUrl(asset);
    try {
      await withRetries(() => httpDownloadTo(url, tmp, timeoutMs), 3, 1000);
      const ver = installVerifiedBinary(tmp, dest);
      if (ver) return { version: ver, asset, via: (apiAssets && apiAssets[asset]) ? "api" : "direct" };
      tried.push(`${asset}:descargado-pero-no-ejecuta`);
    } catch (e) {
      tried.push(`${asset}:${e.message}`);
      try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (_) {}
    }
  }
  const err = new Error("no se pudo conseguir el binario de yt-dlp");
  err.tried = tried; err.apiVersion = apiVersion;
  throw err;
}

// ============== ESTADO DE ACTUALIZACIÓN ==============
const UPDATE_STATE_FILE = path.join(os.homedir(), ".rhythm-dance", "ytdlp-update.json");

export function getYtdlpVersion() {
  try {
    const r = spawnSync(_ytdlpPath, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (r.status === 0 && r.stdout) return r.stdout.trim().split("\n")[0].trim();
  } catch (_) {}
  return null;
}

function readUpdateState() {
  try {
    const j = JSON.parse(fs.readFileSync(UPDATE_STATE_FILE, "utf8"));
    if (typeof j !== "object" || j == null) return defaultState();
    return { ...defaultState(), ...j };
  } catch { return defaultState(); }
}

function defaultState() {
  return { lastAttempt: 0, lastSuccess: 0, lastVersion: null, lastError: null, attempts: 0, successes: 0, installMethod: "binary-standalone" };
}

function writeUpdateState(state) {
  try {
    fs.mkdirSync(path.dirname(UPDATE_STATE_FILE), { recursive: true });
    fs.writeFileSync(UPDATE_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (_) {}
}

export function shouldAutoUpdateYtdlp(intervalDays = AUTO_UPDATE_INTERVAL_DAYS) {
  const st = readUpdateState();
  const now = Date.now();
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  // Si falló antes, reintentar tras 30 min (no esperar días).
  if (st.lastError && st.lastAttempt) {
    return (now - st.lastAttempt) > 30 * 60 * 1000;
  }
  return (now - (st.lastAttempt || 0)) > intervalMs;
}

export function getYtdlpUpdateState() {
  const st = readUpdateState();
  st.currentVersion = getYtdlpVersion();
  st.installed = checkTool(YTDLP, ["--version"]);
  st.nextEligibleAt = (st.lastAttempt || 0) + AUTO_UPDATE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  st.daysUntilNext = Math.max(0, Math.ceil((st.nextEligibleAt - Date.now()) / (24 * 60 * 60 * 1000)));
  st.autoUpdateIntervalDays = AUTO_UPDATE_INTERVAL_DAYS;
  st.installMethod = "binary-standalone";
  return st;
}

export const YTDLP_UPDATE_ERROR_PATTERNS = [
  /Sign in to confirm/i,
  /not a bot/i,
  /nsig extraction failed/i,
  /n challenge/i,
  /unable to extract.*player/i,
  /Could not extract.*player/i,
  /initial player response/i,
  /ExtractorError/i,
  /HTTP Error 403/i,
  /HTTP Error 429/i,
  /This video is (no longer|private|unavailable)/i,
  /members.?only/i,
  /Join this channel/i,
  /PoToken/i,
];

export function errorSuggestsYtdlpUpdate(stderr) {
  if (!stderr) return false;
  return YTDLP_UPDATE_ERROR_PATTERNS.some((re) => re.test(stderr));
}

// ============== INSTALAR / ACTUALIZAR YT-DLP ==============
// Estrategia SIMPLE e INFALIBLE:
// 1. Descargar el binario standalone desde GitHub Releases
// 2. Guardarlo en ~/.rhythm-dance/bin/yt-dlp
// 3. Listo. Funciona en Windows, Arch, Debian, Fedora, macOS, etc.

/**
 * Asegura que yt-dlp esté instalado. Si no existe, lo descarga.
 * Si existe pero toca actualizar, lo actualiza.
 * Devuelve { ok, version, installed, updated, error }
 */
export async function ensureYtdlp() {
  const localBin = getYtdlpLocalPath();
  const exists = fs.existsSync(localBin) && checkTool(localBin, ["--version"]);

  if (exists) {
    // Ya existe y funciona — actualizar la referencia
    _ytdlpPath = localBin;
    return { ok: true, version: getYtdlpVersion(), installed: false, updated: false };
  }

  // No existe o no funciona — descargarlo
  console.log("[yt-dlp] no encontrado, descargando binario standalone...");
  const result = await updateYtdlp({ force: true });
  return result;
}

/**
 * Actualiza yt-dlp descargando la última versión desde GitHub.
 * force=true ignora el intervalo.
 */
export async function updateYtdlp({ force = false, timeoutMs = 120000 } = {}) {
  if (!force && !shouldAutoUpdateYtdlp()) {
    const st = readUpdateState();
    return { ok: true, skipped: true, reason: "interval", version: getYtdlpVersion(), ...st };
  }

  const st = readUpdateState();
  st.lastAttempt = Date.now();
  st.attempts = (st.attempts || 0) + 1;
  writeUpdateState(st);

  const localBin = getYtdlpLocalPath();
  const strategiesTried = [];

  // === ESTRATEGIA 1: Descargar binario standalone desde GitHub (PRINCIPAL) ===
  // Reforzada: API + URL directa de respaldo, multi-arquitectura, reintentos y
  // verificar-antes-de-reemplazar (nunca pisa un binario que funciona).
  try {
    console.log("[yt-dlp] consiguiendo binario standalone (API/directo, multi-arch)...");
    const got = await acquireYtdlpBinary(timeoutMs);
    _ytdlpPath = localBin;
    st.lastSuccess = Date.now();
    st.successes = (st.successes || 0) + 1;
    st.lastError = null;
    st.lastVersion = got.version;
    st.installMethod = "binary-standalone";
    writeUpdateState(st);
    console.log(`[yt-dlp] OK — versión ${got.version} (${got.asset} via ${got.via}) en ${localBin}`);
    return {
      ok: true, updated: true, upToDate: false, skipped: false,
      method: `github-binary (${got.via})`, code: 0, error: null,
      version: got.version, message: `Descargado ${got.version} [${got.asset}]`,
      permissionDenied: false, strategiesTried, installMethod: "binary-standalone",
    };
  } catch (e) {
    strategiesTried.push({ name: "github-binary", error: e.message, tried: e.tried });
    console.log(`[yt-dlp] descarga directa falló: ${e.message}`);
  }

  // === ESTRATEGIA 2: yt-dlp -U (si ya existe un binario standalone) ===
  if (checkTool(YTDLP, ["--version"])) {
    try {
      const r = await runCommand(YTDLP, ["-U"], 60000);
      const all = (r.out + r.err).trim();
      strategiesTried.push({ name: "yt-dlp -U", code: r.code, out: all.slice(0, 200) });
      if (r.code === 0 && (/updated to/i.test(all) || /up.to.date/i.test(all))) {
        const ver = getYtdlpVersion();
        st.lastSuccess = Date.now();
        st.successes = (st.successes || 0) + 1;
        st.lastError = null;
        st.lastVersion = ver;
        writeUpdateState(st);
        return {
          ok: true, updated: /updated to/i.test(all), upToDate: /up.to.date/i.test(all),
          skipped: false, method: "yt-dlp -U", code: 0, error: null,
          version: ver, message: all.slice(0, 300),
          permissionDenied: false, strategiesTried, installMethod: "binary-standalone",
        };
      }
    } catch (_) {}
  }

  // === ESTRATEGIA 3: pip install (fallback si no hay internet a GitHub) ===
  for (const pipCmd of ["pip3", "pip", "python3 -m pip"]) {
    try {
      const parts = pipCmd.split(" ");
      const cmd = parts[0];
      const args = [...parts.slice(1), "install", "-U", "--user", "yt-dlp"];
      const r = await runCommand(cmd, args, 120000);
      const all = (r.out + r.err).trim();
      strategiesTried.push({ name: `${pipCmd} install`, code: r.code, out: all.slice(0, 200) });
      if (r.code === 0 && (/successfully installed/i.test(all) || /requirement already satisfied/i.test(all))) {
        // Refrescar la ruta
        const newPath = whichSync("yt-dlp");
        if (newPath) { _ytdlpPath = newPath; }
        const ver = getYtdlpVersion();
        st.lastSuccess = Date.now();
        st.successes = (st.successes || 0) + 1;
        st.lastError = null;
        st.lastVersion = ver;
        writeUpdateState(st);
        return {
          ok: true, updated: true, upToDate: false, skipped: false,
          method: pipCmd, code: 0, error: null, version: ver,
          message: all.slice(0, 300), permissionDenied: false,
          strategiesTried, installMethod: "pip",
        };
      }
    } catch (_) {}
  }

  // Todo falló
  const errMsg = "No se pudo instalar/actualizar yt-dlp (sin internet o GitHub no disponible)";
  st.lastError = errMsg;
  writeUpdateState(st);
  return {
    ok: false, updated: false, upToDate: false, skipped: false,
    method: "all-failed", code: -1, error: errMsg,
    version: getYtdlpVersion(), permissionDenied: false,
    strategiesTried, installMethod: "none",
  };
}

// Ejecuta un comando y captura stdout/stderr.
function runCommand(cmd, args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    let out = "", err = "";
    let killed = false;
    try {
      const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      const t = setTimeout(() => { killed = true; try { child.kill("SIGKILL"); } catch (_) {} }, timeoutMs);
      child.stdout.on("data", (c) => (out += c.toString()));
      child.stderr.on("data", (c) => (err += c.toString()));
      child.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out, err: err || e.message, killed: true }); });
      child.on("close", (code) => { clearTimeout(t); resolve({ code, out, err, killed }); });
    } catch (e) { resolve({ code: -1, out, err: e.message, killed: false }); }
  });
}

// ============== UTILIDADES ==============

// ¿El archivo tiene una pista de VIDEO real?
const _videoProbeCache = new Map();
export function hasVideoStream(filePath) {
  let key;
  try {
    const st = fs.statSync(filePath);
    key = `${filePath}:${st.size}:${st.mtimeMs}`;
  } catch { return false; }
  if (_videoProbeCache.has(key)) return _videoProbeCache.get(key);
  let result = false;
  try {
    const r = spawnSync(FFPROBE, [
      "-v", "error", "-select_streams", "v",
      "-show_entries", "stream=codec_type,disposition=attached_pic,avg_frame_rate",
      "-of", "json", filePath,
    ], { encoding: "utf8", timeout: 8000 });
    if (r.status === 0 && r.stdout) {
      const data = JSON.parse(r.stdout);
      for (const s of data.streams || []) {
        if (s.codec_type !== "video") continue;
        const isCover = s.disposition && s.disposition.attached_pic === 1;
        const fr = s.avg_frame_rate || "0/0";
        const [n, d] = fr.split("/").map(Number);
        const fps = d ? n / d : 0;
        if (!isCover && fps >= 1) { result = true; break; }
      }
    }
  } catch { result = false; }
  _videoProbeCache.set(key, result);
  return result;
}

export function defaultDownloadDir() {
  const home = os.homedir();
  const candidates = isWin
    ? [path.join(home, "Music", "RhythmDance")]
    : [path.join(home, "Music", "RhythmDance"), path.join(home, "Música", "RhythmDance")];
  return candidates[0];
}
