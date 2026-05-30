// Verifica que se generan notas largas (holds) en tramos sostenidos:
// kicks ritmicos + un acorde mantenido largo en medio (sin nuevos ataques).
import { generateBeatmap } from "../server/generator.js";

const sr = 44100;
const bpm = 120;
const beatSec = 60 / bpm;
const dur = 24;
const n = Math.floor(sr * dur);
const s = new Float32Array(n);

function kick(t, a) {
  const st = Math.floor(t * sr);
  for (let i = 0; i < 0.15 * sr && st + i < n; i++) s[st + i] += a * Math.sin(2 * Math.PI * 60 * (i / sr)) * Math.exp(-(i / sr) * 24);
}
// Kicks en negras toda la cancion
for (let t = 9; t < dur; t += beatSec) kick(t, 0.9);

// Acorde SOSTENIDO de 10s a 13s (nota mantenida, sin reataques) -> deberia
// producir al menos un hold. Tono continuo suave.
for (let i = Math.floor(10 * sr); i < Math.floor(13 * sr) && i < n; i++) {
  const t = i / sr;
  s[i] += 0.5 * (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 330 * t));
}

const bm = generateBeatmap(s, sr, { difficulty: "expert", laneCount: 5, genre: "auto", introFree: 8, onProgress: () => {} });
const holds = bm.notes.filter((x) => x.duration && x.duration > 0);
console.log("notas:", bm.notes.length, "| holds:", holds.length, "| introFree:", bm.introFree);
console.log("primera nota en:", Math.min(...bm.notes.map((x) => x.time)).toFixed(2), "s");
if (holds.length) console.log("ejemplo hold: time", holds[0].time.toFixed(2), "dur", holds[0].duration);

let ok = holds.length >= 1 && Math.min(...bm.notes.map((x) => x.time)) >= 8;
console.log(ok ? "\nOK: se generan holds y respeta intro de 8s." : "\nFALLO: no se generaron holds o intro mal.");
process.exit(ok ? 0 : 1);
