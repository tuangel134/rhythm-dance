// tools.js
// Resuelve las rutas de las herramientas externas (ffmpeg, ffprobe, yt-dlp)
// de forma multiplataforma (Windows / Linux / macOS).
//
// Orden de busqueda:
//   1. Variable de entorno (FFMPEG_PATH, etc.)
//   2. Binario junto al proyecto en ./bin (para distribuir en Windows).
//   3. El nombre a secas (asume que esta en el PATH).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
// Posibles ubicaciones de la carpeta bin/ con las herramientas:
//   - desarrollo / app empaquetada (asar:false): <root>/bin
//   - empaquetado via extraResources: process.resourcesPath/bin
const BIN_CANDIDATES = [
  path.join(ROOT, "bin"),
  process.resourcesPath ? path.join(process.resourcesPath, "bin") : null,
].filter(Boolean);
const BIN_DIR = BIN_CANDIDATES[0];
const isWin = process.platform === "win32";

function exeName(name) {
  return isWin ? `${name}.exe` : name;
}

function resolveTool(name, envVar) {
  // 1. Variable de entorno
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }
  // 2. Binario local en alguna carpeta bin/ conocida
  for (const dir of BIN_CANDIDATES) {
    const local = path.join(dir, exeName(name));
    if (fs.existsSync(local)) return local;
  }
  // 3. Ruta absoluta desde el PATH (which / where)
  const abs = whichSync(name);
  if (abs) return abs;
  // 4. Nombre a secas (ultimo recurso; asume PATH)
  return exeName(name);
}

// Localiza la ruta absoluta de un ejecutable en el PATH (multiplataforma).
function whichSync(name) {
  try {
    const cmd = isWin ? "where" : "which";
    const r = spawnSync(cmd, [exeName(name)], { encoding: "utf8" });
    if (r.status === 0 && r.stdout) {
      const first = r.stdout.split(/\r?\n/).find((l) => l.trim());
      if (first && fs.existsSync(first.trim())) return first.trim();
    }
  } catch (_) { /* ignora */ }
  return null;
}

export const FFMPEG = resolveTool("ffmpeg", "FFMPEG_PATH");
export const FFPROBE = resolveTool("ffprobe", "FFPROBE_PATH");
export const YTDLP = resolveTool("yt-dlp", "YTDLP_PATH");
export const AUTO_UPDATE_INTERVAL_DAYS = 7;

// Comprueba si una herramienta responde (para avisar al usuario si falta).
export function checkTool(cmd, args = ["-version"]) {
  try {
    const r = spawnSync(cmd, args, { timeout: 5000 });
    return r.status === 0 || r.status === null ? r.error == null : false;
  } catch {
    return false;
  }
}

export function toolStatus() {
  return {
    ffmpeg: checkTool(FFMPEG, ["-version"]),
    ffprobe: checkTool(FFPROBE, ["-version"]),
    ytdlp: checkTool(YTDLP, ["--version"]),
    platform: process.platform,
  };
}

export { isWin, BIN_DIR };

// ============== Auto-actualización de yt-dlp ==============
// YouTube cambia su player cada 1-2 semanas y los extractors de yt-dlp se
// quedan obsoletos: la mayoria de descargas fallan con errores tipo
// "Sign in to confirm", "nsig extraction failed", "HTTP Error 403", etc.
// Mantener yt-dlp al dia es la unica forma de evitar esto. Pero NO lo
// hacemos en cada arranque (suma latencia y falla en instalaciones de
// sistema tipo apt/brew donde el usuario no es dueno del binario). En su
// lugar:
//   - getYtdlpVersion(): lee la version actual (null si no esta).
//   - shouldAutoUpdateYtdlp(): true si pasaron N dias desde el ultimo intento.
//   - updateYtdlp({force}): corre `yt-dlp -U` y devuelve el resultado.
//   - getYtdlpUpdateState(): estado persistido (version, ultimo intento, etc.).
//
// El estado se guarda en ~/.rhythm-dance/ytdlp-update.json para que el
// check semanal no se ejecute en cada reinicio.

const UPDATE_STATE_FILE = path.join(os.homedir(), ".rhythm-dance", "ytdlp-update.json");

// Lee la version actual de yt-dlp (`yt-dlp --version` devuelve solo la version).
export function getYtdlpVersion() {
  try {
    const r = spawnSync(YTDLP, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (r.status === 0 && r.stdout) return r.stdout.trim().split("\n")[0].trim();
  } catch (_) {}
  return null;
}

function readUpdateState() {
  try {
    const j = JSON.parse(fs.readFileSync(UPDATE_STATE_FILE, "utf8"));
    if (typeof j !== "object" || j == null) return defaultState();
    return { ...defaultState(), ...j };
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return { lastAttempt: 0, lastSuccess: 0, lastVersion: null, lastError: null, attempts: 0, successes: 0 };
}

function writeUpdateState(state) {
  try {
    fs.mkdirSync(path.dirname(UPDATE_STATE_FILE), { recursive: true });
    fs.writeFileSync(UPDATE_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (_) {}
}

// Devuelve true si la ultima verificacion fue hace mas de N dias. La
// verificacion SOLO se cuenta como intento (exito o fallo) para no martillar
// el endpoint de actualizacion si falla repetidamente.
export function shouldAutoUpdateYtdlp(intervalDays = AUTO_UPDATE_INTERVAL_DAYS) {
  const st = readUpdateState();
  const now = Date.now();
  return (now - (st.lastAttempt || 0)) > intervalDays * 24 * 60 * 60 * 1000;
}

export function getYtdlpUpdateState() {
  const st = readUpdateState();
  st.currentVersion = getYtdlpVersion();
  st.nextEligibleAt = (st.lastAttempt || 0) + AUTO_UPDATE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  st.daysUntilNext = Math.max(0, Math.ceil((st.nextEligibleAt - Date.now()) / (24 * 60 * 60 * 1000)));
  st.autoUpdateIntervalDays = AUTO_UPDATE_INTERVAL_DAYS;
  return st;
}

// Patrones de error de yt-dlp que indican "esto se arregla actualizando".
// No es perfecto (algunos videos estan simplemente borrados), pero son los
// sintomas clasicos de un yt-dlp desactualizado contra YouTube.
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

// Corre `yt-dlp -U` y resuelve con un resumen. Si force=false, respeta el
// intervalo semanal. La operacion es asincrona (no bloquea el arranque).
//   Devuelve: { ok, updated, skipped, code, error, version, message, permissionDenied }
export function updateYtdlp({ force = false, timeoutMs = 60000 } = {}) {
  return new Promise((resolve) => {
    if (!force && !shouldAutoUpdateYtdlp()) {
      const st = readUpdateState();
      return resolve({ ok: true, skipped: true, reason: "interval", version: getYtdlpVersion(), ...st });
    }
    const st = readUpdateState();
    st.lastAttempt = Date.now();
    st.attempts = (st.attempts || 0) + 1;

    const child = spawn(YTDLP, ["-U"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const t = setTimeout(() => { try { child.kill("SIGKILL"); } catch (_) {} }, timeoutMs);
    child.stdout.on("data", (c) => (out += c.toString()));
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("error", (e) => {
      clearTimeout(t);
      st.lastError = e.message;
      writeUpdateState(st);
      resolve({ ok: false, code: -1, error: e.message, version: getYtdlpVersion() });
    });
    child.on("close", (code) => {
      clearTimeout(t);
      const all = (out + err).trim();
      const updated = /updated to/i.test(all);
      const upToDate = /up.to.date|already up to date/i.test(all);
      // Mensajes tipicos cuando el binario no es escribible (instalacion de
      // sistema tipo apt/brew). El usuario debe reinstalar con pip u otro metodo.
      const permissionDenied = /cannot update|permission denied|EACCES|EPERM|read.?only|not writable|administrator/i.test(all);

      if (code === 0) {
        st.lastSuccess = Date.now();
        st.successes = (st.successes || 0) + 1;
        st.lastError = null;
        st.lastVersion = getYtdlpVersion();
        writeUpdateState(st);
        resolve({
          ok: true, updated, upToDate, code, version: st.lastVersion,
          message: all.slice(0, 500), permissionDenied: false,
        });
      } else {
        st.lastError = (all || "actualizacion fallida").slice(0, 500);
        writeUpdateState(st);
        resolve({
          ok: false, updated: false, code, error: st.lastError, version: getYtdlpVersion(),
          permissionDenied, message: all.slice(0, 500),
        });
      }
    });
  });
}

// ¿El archivo tiene una pista de VIDEO real (no solo audio ni una caratula)?
// Usa ffprobe. Distingue un .webm/.mp4 con imagen en movimiento de uno que solo
// trae una caratula embebida (esos aparecen como video con 1 frame / "attached_pic").
// Cacheado en memoria por ruta+mtime para no relanzar ffprobe en cada listado.
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
      "-v", "error",
      "-select_streams", "v",
      "-show_entries", "stream=codec_type,disposition=attached_pic,avg_frame_rate",
      "-of", "json", filePath,
    ], { encoding: "utf8", timeout: 8000 });
    if (r.status === 0 && r.stdout) {
      const data = JSON.parse(r.stdout);
      for (const s of data.streams || []) {
        if (s.codec_type !== "video") continue;
        // Ignorar caratulas (attached_pic) y streams sin frame rate (imagen fija).
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

// Carpeta de descargas por defecto.
export function defaultDownloadDir() {
  const home = os.homedir();
  // Reutilizamos la carpeta de musica habitual del SO.
  const candidates = isWin
    ? [path.join(home, "Music", "RhythmDance")]
    : [path.join(home, "Music", "RhythmDance"), path.join(home, "Música", "RhythmDance")];
  return candidates[0];
}
