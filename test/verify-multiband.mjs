// Verifica el analisis multibanda: kick grave en negras + hihat agudo en
// corcheas. El BPM debe ser el de las negras (no el doble por los hats).
import { generateBeatmap } from "../server/generator.js";

const sampleRate = 44100;
const bpm = 140;
const beatSec = 60 / bpm;
const offset = 0.2;
const duration = 14;
const n = Math.floor(sampleRate * duration);
const s = new Float32Array(n);

function addTone(start, freq, dur, amp, decay) {
  for (let i = 0; i < dur * sampleRate && start + i < n; i++) {
    const t = i / sampleRate;
    s[start + i] += amp * Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * decay);
  }
}

// Kick (60 Hz) en cada negra
for (let t = offset; t < duration; t += beatSec) {
  addTone(Math.floor(t * sampleRate), 60, 0.18, 0.9, 22);
}
// Hihat (ruido agudo ~ 9 kHz) en cada corchea intermedia (offbeat)
for (let t = offset + beatSec / 2; t < duration; t += beatSec) {
  const start = Math.floor(t * sampleRate);
  for (let i = 0; i < 0.04 * sampleRate && start + i < n; i++) {
    const env = Math.exp(-(i / sampleRate) * 120);
    s[start + i] += 0.35 * (Math.random() * 2 - 1) * env;
  }
}

const bm = generateBeatmap(s, sampleRate, { difficulty: "hard", laneCount: 5, onProgress: () => {} });
console.log("BPM detectado:", bm.bpm, "(esperado ~140)");
console.log("Offset:", bm.offset, "(esperado ~0.2 mod beat)");
console.log("Notas:", bm.notes.length);

// Alineacion contra rejilla de corcheas
let sumErr = 0, maxErr = 0;
for (const note of bm.notes) {
  const k = Math.round((note.time - bm.offset) / (beatSec / 2));
  const ideal = bm.offset + k * (beatSec / 2);
  const err = Math.abs(note.time - ideal);
  sumErr += err; maxErr = Math.max(maxErr, err);
}
const avg = sumErr / bm.notes.length;
console.log("Error medio:", (avg * 1000).toFixed(1), "ms / max:", (maxErr * 1000).toFixed(1), "ms");

let ok = true;
const bpmOk = Math.abs(bm.bpm - 140) < 6 || Math.abs(bm.bpm - 70) < 4;
if (!bpmOk) { console.error("FALLO: BPM inesperado (posible confusion con hats)"); ok = false; }
if (avg > 0.02) { console.error("FALLO: mala alineacion"); ok = false; }
console.log(ok ? "\nOK: multibanda detecta el pulso correcto." : "\nHUBO FALLOS.");
process.exit(ok ? 0 : 1);
