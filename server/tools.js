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
import { spawnSync } from "node:child_process";

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
