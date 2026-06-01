// Verifica que la deteccion de VOZ mete mas notas en partes de canto/rap rapido.
// Construimos dos tramos con el MISMO kick (mismo pulso instrumental) pero:
//   - tramo A (0-15s): solo kick (instrumental, sin voz).
//   - tramo B (15-30s): mismo kick + "silabas" rapidas en la banda vocal
//     (rafagas de ruido con formante ~1kHz, ~8 por segundo, como un rap veloz).
// Esperado: el tramo con voz rapida recibe MAS notas que el instrumental.
import { generateBeatmap } from "../server/generator.js";

const sr = 44100;
const bpm = 120;
const beatSec = 60 / bpm;
const dur = 30;
const n = Math.floor(sr * dur);
const s = new Float32Array(n);

function kick(t, amp) {
  const st = Math.floor(t * sr);
  for (let i = 0; i < 0.15 * sr && st + i < n; i++) {
    s[st + i] += amp * Math.sin(2 * Math.PI * 55 * (i / sr)) * Math.exp(-(i / sr) * 22);
  }
}

// "Silaba" cantada: rafaga corta con energia en la banda vocal (~300-3000 Hz).
// Modulamos una portadora de ~1 kHz con una envolvente rapida (ataque de silaba).
function syllable(t, amp) {
  const st = Math.floor(t * sr);
  const len = Math.floor(0.06 * sr);
  for (let i = 0; i < len && st + i < n; i++) {
    const env = Math.exp(-(i / sr) * 40);
    const carrier = Math.sin(2 * Math.PI * 1000 * (i / sr)) * 0.6
                  + Math.sin(2 * Math.PI * 1800 * (i / sr)) * 0.4;  // 2 formantes
    s[st + i] += amp * carrier * env;
  }
}

// Kick constante en negras toda la cancion (mismo pulso en ambos tramos).
for (let t = 1; t < dur; t += beatSec) kick(t, 0.9);

// Tramo B (15-30s): voz rapida ~8 silabas/seg.
for (let t = 15; t < 29; t += 1 / 8) syllable(t, 0.7);

function countIn(notes, a, b) { return notes.filter((x) => x.time >= a && x.time < b).length; }

for (const diff of ["normal", "hard"]) {
  const bm = generateBeatmap(s, sr, { difficulty: diff, laneCount: 5, genre: "pop", introFree: 1, onProgress: () => {} });
  const instr = countIn(bm.notes, 2, 14);   // tramo instrumental
  const vocal = countIn(bm.notes, 16, 28);   // tramo con voz rapida
  console.log(`[${diff}] instrumental(12s)=${instr}  voz-rapida(12s)=${vocal}  ratio=${(vocal / Math.max(1, instr)).toFixed(2)}x`);
}

// Validacion en "hard": el tramo de voz rapida debe tener notablemente mas notas.
const bm = generateBeatmap(s, sr, { difficulty: "hard", laneCount: 5, genre: "pop", introFree: 1, onProgress: () => {} });
const instr = countIn(bm.notes, 2, 14);
const vocal = countIn(bm.notes, 16, 28);
const ok = vocal > instr * 1.4;
console.log(ok
  ? "\nOK: la voz rapida genera mas notas al ritmo de las silabas."
  : "\nFALLO: la voz rapida no aumento la densidad de notas.");
process.exit(ok ? 0 : 1);
