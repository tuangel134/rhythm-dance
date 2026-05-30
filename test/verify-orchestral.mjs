// Simula musica ORQUESTAL intensa SIN bateria (como Csikos Post): notas
// melodicas rapidas con ataques suaves, sin kick grave. Antes el generador
// producia muy pocas notas (se sentia facilisimo). Ahora la densidad objetivo
// por dificultad debe garantizar una cantidad acorde.
import { generateBeatmap } from "../server/generator.js";

const sr = 44100, dur = 30;
const n = Math.floor(sr * dur);
const s = new Float32Array(n);

// "Galop" rapido: notas de cuerda a ~8 por segundo, frecuencias medias-altas,
// con envolvente suave (ataque no percusivo) y SIN graves.
const noteRate = 8; // notas por segundo
const freqs = [330, 392, 440, 494, 523, 587, 659];
let fi = 0;
for (let k = 0; k * (1 / noteRate) < dur; k++) {
  const t0 = k / noteRate;
  const f = freqs[fi % freqs.length]; fi++;
  const start = Math.floor(t0 * sr);
  const len = Math.floor(0.12 * sr);
  for (let i = 0; i < len && start + i < n; i++) {
    const tt = i / sr;
    // ataque suave (no percusivo) + decaimiento
    const env = Math.min(1, tt / 0.02) * Math.exp(-tt * 6);
    s[start + i] += 0.4 * env * (Math.sin(2 * Math.PI * f * tt) + 0.4 * Math.sin(2 * Math.PI * 2 * f * tt));
  }
}

function nps(bm) {
  const playable = bm.duration - (bm.introFree || 0);
  return bm.notes.length / playable;
}

for (const d of ["easy", "normal", "hard", "expert"]) {
  const bm = generateBeatmap(s, sr, { difficulty: d, laneCount: 5, genre: "auto", introFree: 8, onProgress: () => {} });
  console.log(`[${d}] notas=${bm.notes.length} (${nps(bm).toFixed(2)} notas/s) bpm=${bm.bpm} genero=${bm.genre}`);
}

const easy = generateBeatmap(s, sr, { difficulty: "easy", laneCount: 5, introFree: 8, onProgress: () => {} });
const hard = generateBeatmap(s, sr, { difficulty: "hard", laneCount: 5, introFree: 8, onProgress: () => {} });
// La orquestal intensa NO debe quedar vacia: al menos ~1.3 notas/s en facil,
// y dificil claramente mas densa.
const okEasy = nps(easy) >= 1.3;
const okHard = nps(hard) >= 2.5 && hard.notes.length > easy.notes.length;
console.log(okEasy && okHard ? "\nOK: la orquestal intensa ahora genera densidad acorde."
                             : "\nFALLO: sigue quedando muy vacia.");
process.exit(okEasy && okHard ? 0 : 1);
