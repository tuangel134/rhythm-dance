// verify-instruments.mjs
// Verifica el mapeo por INSTRUMENTO: el bombo (graves, en los beats) tiende a
// carriles centrales y los hats (agudos, en contratiempos) tienden a carriles
// externos. Asi el chart "toca los instrumentos" (idea de GenerationMania).
import { generateBeatmap } from "../server/generator.js";

const sr = 44100, bpm = 120, beatSec = 60 / bpm, dur = 30;
const n = Math.floor(sr * dur);
let seed = 4242; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const s = new Float32Array(n);
function kick(t) { const st = Math.floor(t * sr); for (let i = 0; i < 0.15 * sr && st + i < n; i++) s[st + i] += 0.9 * Math.sin(2 * Math.PI * 55 * (i / sr)) * Math.exp(-(i / sr) * 22); }
function hat(t) { const st = Math.floor(t * sr); for (let i = 0; i < 0.04 * sr && st + i < n; i++) s[st + i] += 0.4 * (rnd() * 2 - 1) * (i % 2 ? 1 : -1) * Math.exp(-(i / sr) * 120); }
// Bombo en cada beat; hats en los contratiempos (mitad de beat).
for (let t = 1; t < dur; t += beatSec) kick(t);
for (let t = 1 + beatSec / 2; t < dur; t += beatSec) hat(t);

const bm = generateBeatmap(s, sr, { difficulty: "hard", laneCount: 5, genre: "electronic", introFree: 1, onProgress: () => {} });
const center = 2; // 5 paneles
const tol = beatSec * 0.18;
function near(t, base) { const m = ((t - 1) % beatSec + beatSec) % beatSec; return Math.abs(m - base) < tol || Math.abs(m - base - beatSec) < tol; }

let kickDist = [], hatDist = [];
for (const nt of bm.notes) {
  const d = Math.abs(nt.lane - center);
  if (near(nt.time, 0)) kickDist.push(d);            // en el beat -> bombo
  else if (near(nt.time, beatSec / 2)) hatDist.push(d); // contratiempo -> hat
}
const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const kAvg = avg(kickDist), hAvg = avg(hatDist);
console.log(`bombo (n=${kickDist.length}) dist-centro=${kAvg.toFixed(2)}  |  hat (n=${hatDist.length}) dist-centro=${hAvg.toFixed(2)}`);

const ok = kickDist.length > 5 && hatDist.length > 5 && hAvg > kAvg;
console.log(ok ? "\nOK: el bombo cae mas al centro y los hats mas afuera." : "\nFALLO: el mapeo por instrumento no separa bombo/hat.");
process.exit(ok ? 0 : 1);
