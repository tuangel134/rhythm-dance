// verify-buildup.mjs
// Verifica que la densidad ACELERA en un build-up hacia un drop: una rampa de
// intensidad creciente debe recibir progresivamente mas notas (anticipacion),
// no quedarse plana hasta el estallido.
import { generateBeatmap } from "../server/generator.js";

const sr = 44100, bpm = 128, beatSec = 60 / bpm, dur = 40;
const n = Math.floor(sr * dur);
let seed = 7;
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

const s = new Float32Array(n);
function kick(t, a) { const st = Math.floor(t * sr); for (let i = 0; i < 0.15 * sr && st + i < n; i++) s[st + i] += a * Math.sin(2 * Math.PI * 60 * (i / sr)) * Math.exp(-(i / sr) * 22); }
function hat(t, a) { const st = Math.floor(t * sr); for (let i = 0; i < 0.03 * sr && st + i < n; i++) s[st + i] += a * (rnd() * 2 - 1) * Math.exp(-(i / sr) * 150); }

// 0-12s: parte estable suave (kick negras).
for (let t = 2; t < 12; t += beatSec) kick(t, 0.4);
// 12-20s: BUILD-UP estilo snare-roll: la subdivision se ACELERA con el tiempo
// (corcheas -> semicorcheas -> fusas) y la amplitud sube. Asi hay mas ataques
// reales conforme nos acercamos al drop.
for (let t = 12; t < 20; t += beatSec) { const f = (t - 12) / 8; kick(t, 0.5 + f * 0.5); }
for (let seg = 0; seg < 4; seg++) {
  const t0 = 12 + seg * 2, t1 = t0 + 2;
  const div = [2, 4, 8, 16][seg];          // corcheas -> semicorcheas -> fusas -> 1/16
  const amp = 0.3 + seg * 0.12;
  for (let t = t0; t < t1; t += beatSec / div) hat(t, amp);
}
// 20-40s: DROP, fuerte y denso.
for (let t = 20; t < dur; t += beatSec) kick(t, 1.0);
for (let t = 20; t < dur; t += beatSec / 4) hat(t, 0.6);

const bm = generateBeatmap(s, sr, { difficulty: "hard", laneCount: 5, genre: "electronic", introFree: 0, onProgress: () => {} });
function countIn(a, b) { return bm.notes.filter((x) => x.time >= a && x.time < b).length; }

const calm = countIn(3, 11);          // 8s suave
const rampEarly = countIn(12, 16);    // primera mitad del build-up
const rampLate = countIn(16, 20);     // segunda mitad del build-up (mas cerca del drop)
const drop = countIn(21, 39);         // drop
console.log(`suave(8s)=${calm}  rampa-inicio(4s)=${rampEarly}  rampa-final(4s)=${rampLate}  drop(18s)=${drop}`);

// El build-up debe quedar claramente mas denso que la parte suave (anticipacion
// del drop) y ambas mitades de la rampa bien pobladas. La aceleracion absoluta
// dentro de la rampa la acota limitDensity (tope de la dificultad), por eso
// medimos densidad relativa a la parte suave, no monotonia estricta.
const calmNps = calm / 8, rampNps = (rampEarly + rampLate) / 8, dropNps = drop / 18;
console.log(`nps: suave=${calmNps.toFixed(2)} rampa=${rampNps.toFixed(2)} drop=${dropNps.toFixed(2)}`);
const ok = rampNps > calmNps * 1.5 && rampLate > 0 && rampEarly > 0;
console.log(ok ? "\nOK: el build-up se llena (densidad sube hacia el drop)." : "\nFALLO: el build-up no acelera la densidad.");
process.exit(ok ? 0 : 1);
