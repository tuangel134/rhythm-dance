// library.js
// Gestiona las carpetas de musica del usuario: escanea archivos de audio,
// recuerda las carpetas elegidas y resuelve rutas de forma segura.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const AUDIO_EXT = new Set([".mp3", ".ogg", ".wav", ".m4a", ".flac", ".aac", ".opus", ".webm"]);

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

export const AUDIO_EXTENSIONS = AUDIO_EXT;
