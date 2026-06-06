// Verifica que el selector de formato de video de downloader.js este bien
// formado: contiene todas las variantes esperadas y es una cadena no vacia
// que yt-dlp pueda parsear. No hace red (no descarga nada).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "server", "downloader.js");
const text = readFileSync(SRC, "utf8");

let ok = true;
function check(cond, label) {
  if (cond) console.log("  ok  ", label);
  else { console.log("  FAIL", label); ok = false; }
}

// 1) La constante existe.
check(/const VIDEO_FORMAT_SELECTOR\s*=\s*\[/.test(text), "constante VIDEO_FORMAT_SELECTOR definida");

// 2) La cadena final no esta vacia y tiene los fallbacks criticos.
const match = text.match(/const VIDEO_FORMAT_SELECTOR\s*=\s*\[([\s\S]*?)\]\.join\("\/"\)/);
check(!!match, "selector extraido del fuente");
if (match) {
  // Quitar comentarios // ... \n y comillas de string antes de partir, sino
  // los items quedan con " alrededor.
  const cleaned = match[1].replace(/\/\/[^\n]*/g, "").replace(/"/g, "");
  const items = cleaned.split(/,\s*\n?\s*/).map((s) => s.trim()).filter(Boolean);
  check(items.length >= 6, `cadena con al menos 6 fallbacks (encontrados: ${items.length})`);
  for (const must of [
    "bv*[height<=720][ext=mp4][vcodec^=avc]+ba[ext=m4a]",
    "b[height<=720][ext=mp4]",
    "bv*[height<=1080][ext=mp4][vcodec^=avc]+ba[ext=m4a]",
    "bv*[height<=720][ext=mp4]+ba",
    "b[height<=1080][ext=mp4]",
    "bv*[height<=720][ext=webm]+ba[ext=webm]",
    "b[height<=1080][ext=webm]",
    "bv*[height<=1080]+ba",
    "bv*+ba",
    "b",
  ]) {
    check(items.includes(must), `incluye "${must}"`);
  }
}

// 3) El merge-output-format usa mp4 con fallback a mkv (clave para webm/Opus).
check(/--merge-output-format[^\n]*"mp4,mkv"/.test(text), '--merge-output-format "mp4,mkv"');

// 4) Sigue habiendo un limite de altura razonable (1080p) en las primeras
//    opciones de la cadena para no acabar descargando 4K como fondo.
const heightCapped = (match && match[1].match(/height<=\d+/g)) || [];
const capValues = heightCapped.map((s) => parseInt(s.match(/\d+/)[0], 10));
check(Math.max(...capValues) <= 1080, `altura maxima en cadena <= 1080p (caps: ${capValues.join(", ")})`);

// 5) El camino de audio sigue intacto (no se rompio -x --audio-format mp3).
check(/"-x"[^\n]*"--audio-format"[^\n]*"mp3"/.test(text), "extraccion de audio a mp3 intacta");

// 6) La deteccion de error de extractor sigue presente (de la pasada anterior).
check(/ytdlpUpdateRecommended/.test(text), "flag ytdlpUpdateRecommended en errores");

console.log(ok ? "\nOK: selector de formato de video es robusto y completo." : "\nHUBO FALLOS.");
process.exit(ok ? 0 : 1);
