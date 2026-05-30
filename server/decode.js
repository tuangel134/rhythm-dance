// decode.js
// Decodifica cualquier archivo de audio a PCM mono Float32 usando ffmpeg.
// El motor corre en la PC, asi que aprovechamos ffmpeg del sistema para
// soportar mp3, ogg, wav, m4a, flac, etc.

import { spawn } from "node:child_process";
import { FFMPEG, FFPROBE } from "./tools.js";

/**
 * Decodifica un archivo de audio a muestras mono Float32 a la frecuencia dada.
 * @param {string} filePath
 * @param {number} sampleRate
 * @returns {Promise<{samples: Float32Array, sampleRate: number, duration: number}>}
 */
export function decodeToPCM(filePath, sampleRate = 44100) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v", "error",
      "-i", filePath,
      "-ac", "1",            // mono
      "-ar", String(sampleRate),
      "-f", "f32le",         // float32 little-endian crudo
      "pipe:1",
    ];
    const ff = spawn(FFMPEG, args);

    const chunks = [];
    let errOut = "";

    ff.stdout.on("data", (c) => chunks.push(c));
    ff.stderr.on("data", (c) => (errOut += c.toString()));

    ff.on("error", (e) => {
      reject(new Error(`No se pudo ejecutar ffmpeg: ${e.message}. ¿Esta instalado?`));
    });

    ff.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg fallo (codigo ${code}): ${errOut.slice(0, 500)}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      // Float32Array sobre el buffer (alineado: ffmpeg emite multiplos de 4 bytes)
      const samples = new Float32Array(
        buf.buffer,
        buf.byteOffset,
        Math.floor(buf.byteLength / 4)
      );
      const duration = samples.length / sampleRate;
      resolve({ samples, sampleRate, duration });
    });
  });
}

/**
 * Obtiene la duracion (segundos) rapida de un archivo con ffprobe.
 * @param {string} filePath
 * @returns {Promise<number>}
 */
export function probeDuration(filePath) {
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ];
    const fp = spawn(FFPROBE, args);
    let out = "";
    fp.stdout.on("data", (c) => (out += c.toString()));
    fp.on("error", () => resolve(0));
    fp.on("close", () => {
      const d = parseFloat(out.trim());
      resolve(Number.isFinite(d) ? d : 0);
    });
  });
}
