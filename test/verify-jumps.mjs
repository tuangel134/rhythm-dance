// Verifica notas simultaneas (jumps): varias flechas en el mismo tiempo.
// Easy debe tener pocos/ningun jump grande; Expert debe tener mas.
import { generateBeatmap } from "../server/generator.js";

const sr = 44100, bpm = 130, beatSec = 60 / bpm, dur = 30;
const n = Math.floor(sr * dur);
const s = new Float32Array(n);
function kick(t, a) { const st = Math.floor(t * sr); for (let i = 0; i < 0.15 * sr && st + i < n; i++) s[st + i] += a * Math.sin(2 * Math.PI * 60 * (i / sr)) * Math.exp(-(i / sr) * 22); }
// Beat fuerte + seccion intensa (12-26s) para provocar jumps.
for (let t = 9; t < dur; t += beatSec) kick(t, t > 12 && t < 26 ? 1.0 : 0.5);
for (let t = 12; t < 26; t += beatSec / 2) for (let i = Math.floor(t * sr); i < Math.floor((t + 0.05) * sr) && i < n; i++) s[i] += 0.5 * (Math.random() * 2 - 1);

function jumpStats(notes) {
  const byTime = new Map();
  for (const x of notes) {
    const k = Math.round(x.time * 1000);
    byTime.set(k, (byTime.get(k) || 0) + 1);
  }
  let max = 0, jumps = 0, total = byTime.size;
  for (const c of byTime.values()) { max = Math.max(max, c); if (c >= 2) jumps++; }
  return { max, jumps, total, jumpPct: Math.round((jumps / total) * 100) };
}

for (const diff of ["easy", "normal", "hard", "expert"]) {
  const bm = generateBeatmap(s, sr, { difficulty: diff, laneCount: 5, genre: "auto", introFree: 8, onProgress: () => {} });
  const st = jumpStats(bm.notes);
  console.log(`[${diff}] notas=${bm.notes.length} maxSimult=${st.max} jumps=${st.jumps} (${st.jumpPct}% de tiempos)`);
}

// Validaciones: easy max <=2 ; expert debe permitir >=3.
const easy = jumpStats(generateBeatmap(s, sr, { difficulty: "easy", laneCount: 5, introFree: 8, onProgress: () => {} }).notes);
const expert = jumpStats(generateBeatmap(s, sr, { difficulty: "expert", laneCount: 5, introFree: 8, onProgress: () => {} }).notes);
const ok = easy.max <= 2 && expert.max >= 3 && expert.jumps > easy.jumps;
console.log(ok ? "\nOK: jumps escalan con la dificultad." : "\nFALLO: jumps no escalan bien.");
process.exit(ok ? 0 : 1);
