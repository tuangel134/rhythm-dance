// verify-determinism.mjs
// Verifica que el generador es DETERMINISTA: la misma cancion produce SIEMPRE
// el mismo chart (mismas notas y carriles). Esto sustenta la repeticion de
// patrones (frases repetidas -> mismas flechas) y hace los charts reproducibles.
import { generateBeatmap } from "../server/generator.js";

const sr = 44100, bpm = 128, beatSec = 60 / bpm, dur = 20;
const n = Math.floor(sr * dur);

// Ruido determinista para un audio reproducible con contenido melodico.
let seed = 999;
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

function buildAudio() {
  seed = 999;
  const s = new Float32Array(n);
  // kicks + una melodia simple que sube y baja (para usar el contorno).
  const melody = [220, 277, 330, 440, 330, 277];
  function kick(t) { const st = Math.floor(t * sr); for (let i = 0; i < 0.15 * sr && st + i < n; i++) s[st + i] += 0.8 * Math.sin(2 * Math.PI * 60 * (i / sr)) * Math.exp(-(i / sr) * 22); }
  function tone(t, f) { const st = Math.floor(t * sr); for (let i = 0; i < 0.22 * sr && st + i < n; i++) { const e = Math.exp(-(i / sr) * 4); s[st + i] += 0.4 * e * (Math.sin(2 * Math.PI * f * (i / sr)) + 0.4 * Math.sin(2 * Math.PI * f * 2 * (i / sr))); } }
  let k = 0;
  for (let t = 1; t < dur; t += beatSec) { kick(t); tone(t, melody[k % melody.length]); k++; }
  // un poco de ruido suave
  for (let i = 0; i < n; i++) s[i] += (rnd() * 2 - 1) * 0.01;
  return s;
}

function sig(bm) {
  return bm.notes.map((x) => `${x.time.toFixed(3)}:${x.lane}${x.duration ? ":" + x.duration : ""}`).join("|");
}

const a = generateBeatmap(buildAudio(), sr, { difficulty: "hard", laneCount: 5, genre: "pop", introFree: 0, onProgress: () => {} });
const b = generateBeatmap(buildAudio(), sr, { difficulty: "hard", laneCount: 5, genre: "pop", introFree: 0, onProgress: () => {} });

const sa = sig(a), sb = sig(b);
console.log(`run A: ${a.notes.length} notas | run B: ${b.notes.length} notas`);
console.log(`bpm A=${a.bpm} bpm B=${b.bpm}`);

const ok = sa === sb && a.notes.length > 10;
if (!ok && sa !== sb) {
  // Mostrar la primera diferencia para depurar.
  const A = sa.split("|"), B = sb.split("|");
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] !== B[i]) { console.log(`primera diferencia en nota ${i}: A=${A[i]} B=${B[i]}`); break; }
  }
}
console.log(ok ? "\nOK: el generador es determinista (charts reproducibles)." : "\nFALLO: el chart no es reproducible.");
process.exit(ok ? 0 : 1);
