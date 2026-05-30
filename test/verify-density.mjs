// Verifica que la densidad de notas SIGUE la intensidad de la musica:
// seccion suave (pocas notas) vs "drop" intenso (muchas notas), como en
// electronica (Skrillex). Mismo BPM en ambas; solo cambia la intensidad.
import { generateBeatmap } from "../server/generator.js";

const sampleRate = 44100;
const bpm = 140;
const beatSec = 60 / bpm;
const duration = 32; // 0-16s suave, 16-32s drop
const n = Math.floor(sampleRate * duration);
const s = new Float32Array(n);

function kick(t, amp) {
  const start = Math.floor(t * sampleRate);
  for (let i = 0; i < 0.16 * sampleRate && start + i < n; i++) {
    const env = Math.exp(-(i / sampleRate) * 24);
    s[start + i] += amp * Math.sin(2 * Math.PI * 60 * (i / sampleRate)) * env;
  }
}
function hat(t, amp) {
  const start = Math.floor(t * sampleRate);
  for (let i = 0; i < 0.03 * sampleRate && start + i < n; i++) {
    const env = Math.exp(-(i / sampleRate) * 150);
    s[start + i] += amp * (Math.random() * 2 - 1) * env;
  }
}

// Seccion suave (0-16s): solo kick en negras, amplitud baja.
for (let t = 0; t < 16; t += beatSec) kick(t, 0.25);

// Drop (16-32s): kick fuerte en negras + hats en semicorcheas (ritmo denso).
for (let t = 16; t < 32; t += beatSec) kick(t, 1.0);
for (let t = 16; t < 32; t += beatSec / 4) hat(t, 0.5);

function countIn(notes, a, b) { return notes.filter((x) => x.time >= a && x.time < b).length; }

for (const genre of ["auto", "electronic"]) {
  const bm = generateBeatmap(s, sampleRate, { difficulty: "hard", laneCount: 5, genre, onProgress: () => {} });
  const soft = countIn(bm.notes, 1, 15);
  const drop = countIn(bm.notes, 17, 31);
  const ratio = drop / Math.max(1, soft);
  console.log(`[${genre}] bpm=${bm.bpm} suave(14s)=${soft} drop(14s)=${drop} ratio=${ratio.toFixed(1)}x`);
}

// Con electronic, el drop debe tener bastantes mas notas que la parte suave.
const bm = generateBeatmap(s, sampleRate, { difficulty: "hard", laneCount: 5, genre: "electronic", onProgress: () => {} });
const soft = countIn(bm.notes, 1, 15);
const drop = countIn(bm.notes, 17, 31);
const ok = drop > soft * 2.0;
console.log(ok ? "\nOK: la densidad sigue la intensidad (drop mucho mas denso)."
               : "\nFALLO: el drop no es suficientemente mas denso que la parte suave.");
process.exit(ok ? 0 : 1);
