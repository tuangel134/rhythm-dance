// library.js
// Gestiona las carpetas de musica del usuario: escanea archivos de audio,
// recuerda las carpetas elegidas y resuelve rutas de forma segura.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const AUDIO_EXT = new Set([".mp3", ".ogg", ".wav", ".m4a", ".flac", ".aac", ".opus", ".webm"]);
// Formatos de video que pueden usarse como fondo (HTML5 <video>).
const VIDEO_EXT = [".mp4", ".webm", ".mkv", ".mov", ".m4v"];

const CONFIG_DIR = path.join(os.homedir(), ".rhythm-dance");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const cfg = JSON.parse(raw);
    if (!Array.isArray(cfg.folders)) cfg.folders = [];
    return cfg;
  } catch {
    return { folders: [] };
  }
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.warn("No se pudo guardar config:", e.message);
  }
}

let config = loadConfig();

// Carpeta de musica por defecto: ~/Music o ~/Musica si existen.
function defaultFolders() {
  const home = os.homedir();
  const candidates = [
    path.join(home, "Music"),
    path.join(home, "Musica"),
    path.join(home, "Música"),
    path.join(home, "Desktop", "songs"),
    path.join(home, "Escritorio", "songs"),
  ];
  return candidates.filter((p) => {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
  });
}

export function getFolders() {
  // Combina carpetas guardadas + por defecto (sin duplicar)
  const set = new Set([...config.folders, ...defaultFolders()]);
  return [...set];
}

export function addFolder(folderPath) {
  const abs = path.resolve(folderPath);
  let stat;
  try { stat = fs.statSync(abs); } catch { throw new Error("La carpeta no existe: " + abs); }
  if (!stat.isDirectory()) throw new Error("No es una carpeta: " + abs);
  if (!config.folders.includes(abs)) {
    config.folders.push(abs);
    saveConfig(config);
  }
  return abs;
}

export function removeFolder(folderPath) {
  const abs = path.resolve(folderPath);
  config.folders = config.folders.filter((f) => f !== abs);
  saveConfig(config);
}

// Lee/escribe un flag de configuracion (p.ej. unlockFps). Persistido en
// config.json para que el proceso principal de Electron lo lea AL ARRANCAR
// (los switches de FPS/vsync deben aplicarse antes de crear la ventana).
export function getConfigFlag(key) {
  return config[key];
}
export function setConfigFlag(key, value) {
  config[key] = value;
  saveConfig(config);
  return config[key];
}

// Escanea recursivamente (1 nivel de subcarpetas) buscando audio.
function scanFolder(folder, depth = 2) {
  const results = [];
  let entries;
  try { entries = fs.readdirSync(folder, { withFileTypes: true }); }
  catch { return results; }

  for (const ent of entries) {
    const full = path.join(folder, ent.name);
    if (ent.isDirectory() && depth > 0) {
      results.push(...scanFolder(full, depth - 1));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (AUDIO_EXT.has(ext)) {
        results.push({
          name: path.basename(ent.name, ext),
          file: ent.name,
          path: full,
          folder,
        });
      }
    }
  }
  return results;
}

import { findStepfileFor, findUcsFor } from "./smparser.js";
import { hasVideoStream } from "./tools.js";

export function listSongs() {
  const folders = getFolders();
  const songs = [];
  const seen = new Set();
  for (const folder of folders) {
    for (const s of scanFolder(folder)) {
      if (seen.has(s.path)) continue;
      seen.add(s.path);
      // id seguro = ruta codificada en base64url
      s.id = Buffer.from(s.path).toString("base64url");
      // ¿hay un stepchart real (.sm/.ssc/.ucs) junto al audio?
      s.hasChart = !!(findStepfileFor(s.path) || findUcsFor(s.path));
      // ¿hay un video con el mismo nombre para usarlo de fondo?
      s.hasVideo = !!findVideoFor(s.path);
      songs.push(s);
    }
  }
  songs.sort((a, b) => a.name.localeCompare(b.name));
  return songs;
}

// Resuelve un id de cancion a una ruta valida (solo dentro de carpetas permitidas).
export function resolveSongPath(id) {
  let p;
  try { p = Buffer.from(id, "base64url").toString("utf8"); }
  catch { return null; }
  const abs = path.resolve(p);
  const folders = getFolders().map((f) => path.resolve(f));
  const allowed = folders.some((f) => abs === f || abs.startsWith(f + path.sep));
  if (!allowed) return null;
  try { if (!fs.statSync(abs).isFile()) return null; } catch { return null; }
  return abs;
}

// Busca un archivo de video para usar como fondo de la cancion.
// Casos:
//   1) Un archivo aparte con el mismo nombre base (Cancion.mp3 -> Cancion.mp4).
//   2) El propio archivo de audio, si es un contenedor (.webm/.mp4/.mkv/.mov)
//      que contiene una pista de VIDEO real (no solo audio ni una caratula).
// Devuelve la ruta del video o null.
export function findVideoFor(audioPath) {
  const dir = path.dirname(audioPath);
  const ext = path.extname(audioPath).toLowerCase();
  const base = path.basename(audioPath, path.extname(audioPath));
  const self = path.resolve(audioPath);

  // 1) Video aparte con el mismo nombre.
  for (const vext of VIDEO_EXT) {
    const cand = path.join(dir, base + vext);
    if (path.resolve(cand) === self) continue;   // no usar el propio audio aqui
    try { if (fs.statSync(cand).isFile()) return cand; } catch { /* sigue */ }
  }

  // 2) El propio archivo si es un contenedor de video con imagen en movimiento.
  if (VIDEO_EXT.includes(ext) || ext === ".webm" || ext === ".mp4" || ext === ".mkv" || ext === ".mov") {
    try { if (hasVideoStream(audioPath)) return audioPath; } catch { /* no */ }
  }
  return null;
}

// Igual que resolveSongPath pero ademas localiza el video asociado (si existe).
export function resolveVideoPath(id) {
  const audio = resolveSongPath(id);
  if (!audio) return null;
  return findVideoFor(audio);
}

export const AUDIO_EXTENSIONS = AUDIO_EXT;
export const VIDEO_EXTENSIONS = VIDEO_EXT;
