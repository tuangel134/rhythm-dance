// meta.js
// Extrae metadatos NO SONOROS de una cancion con ffprobe (titulo, artista, BPM)
// para alimentar el Song_Fingerprint. NUNCA lee el contenido sonoro (PCM): solo
// tags y duracion. Si faltan tags, hace fallback al nombre de archivo (titulo)
// y deja que el llamador complete el BPM con el del beatmap generado.

import path from "node:path";
import { spawn } from "node:child_process";
import { FFPROBE } from "./tools.js";

// Lee format_tags (title, artist, BPM/TBPM) y format.duration con ffprobe.
// Devuelve { title, artist, duration, bpm }. Campos ausentes -> "" o 0.
// fallbackTitle: nombre a usar como titulo si el tag esta vacio (p.ej. song.name).
export function readSongMeta(filePath, fallbackTitle) {
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-show_entries", "format=duration:format_tags",
      "-of", "json",
      filePath,
    ];
    const fp = spawn(FFPROBE, args);
    let out = "";
    fp.stdout.on("data", (c) => (out += c.toString()));
    const done = (meta) => resolve(meta);
    const fallback = () => done({
      title: fallbackTitle || path.basename(filePath, path.extname(filePath)),
      artist: "",
      duration: 0,
      bpm: 0,
    });
    fp.on("error", fallback);
    fp.on("close", () => {
      try {
        const data = JSON.parse(out || "{}");
        const fmt = data.format || {};
        const tags = normalizeTags(fmt.tags || {});
        const duration = parseFloat(fmt.duration);
        const baseTitle = fallbackTitle || path.basename(filePath, path.extname(filePath));
        const bpmRaw = tags.bpm || tags.tbpm || tags["tbpm"] || "";
        const bpm = parseFloat(bpmRaw);
        done({
          title: tags.title && tags.title.trim() ? tags.title : baseTitle,
          artist: tags.artist || tags.album_artist || tags.performer || "",
          duration: Number.isFinite(duration) ? duration : 0,
          bpm: Number.isFinite(bpm) ? bpm : 0,
        });
      } catch {
        fallback();
      }
    });
  });
}

// Pasa todas las claves de tags a minusculas para acceso uniforme (ffprobe
// devuelve TITLE/title/Title segun el contenedor).
function normalizeTags(tags) {
  const out = {};
  for (const k of Object.keys(tags)) out[k.toLowerCase()] = tags[k];
  return out;
}
