// Verifica el generador sincronizado: pista de clicks a 128 BPM con offset conocido.
// Debe detectar el BPM y colocar las notas ALINEADAS a los beats.
import { generateBeatmap } from "../server/generator.js";

const sampleRate = 44100;
const bpm = 128;
const beatSec = 60 / bpm;
const offset = 0.31; // fase conocida
const duration = 12;
const n = Math.floor(sampleRate * duration);
const samples = new Float32Array(n);

// Click (kick) en cada beat con armonicos para tener contenido espectral
for (let t = offset; t < duration; t += beatSec) {
  const start = Math.floor(t * sampleRate);
  for (let i = 0; i < 1200 && start + i < n; i++) {
    const env = Math.exp(-i / 200);
    const ph = (i / sampleRate);
    samples[start + i] += env * (Math.sin(2 * Math.PI * 80 * ph) + 0.5 * (Math.random() * 2 - 1));
  }
}

const bm = generateBeatmap(samples, sampleRate, { difficulty: "normal", laneCount: 5, introFree: 0, onProgress: () => {} });

console.log("BPM detectado:", bm.bpm, "(esperado 128 o multiplo/divisor)");
console.log("Offset detectado:", bm.offset, "(esperado ~0.31 mod beat)");
console.log("Notas:", bm.notes.length);

// Medir alineacion: cada nota deberia caer cerca de un beat (k*beat + offset)
let maxErr = 0, sumErr = 0;
for (const note of bm.notes) {
  const k = Math.round((note.time - bm.offset) / (beatSec / 2)); // subdiv corchea
  const ideal = bm.offset + k * (beatSec / 2);
  const err = Math.abs(note.time - ideal);
  maxErr = Math.max(maxErr, err);
  sumErr += err;
}
const avgErr = sumErr / bm.notes.length;
console.log("Error medio de alineacion:", (avgErr * 1000).toFixed(1), "ms");
console.log("Error maximo de alineacion:", (maxErr * 1000).toFixed(1), "ms");

// lanes presentes
const lanes = new Set(bm.notes.map((x) => x.lane));
console.log("Lanes usados:", [...lanes].sort());

let ok = true;
const bpmOk = [64, 128, 256].some((b) => Math.abs(bm.bpm - b) < 6);
if (!bpmOk) { console.error("FALLO: BPM inesperado"); ok = false; }
if (bm.notes.length < 10) { console.error("FALLO: pocas notas"); ok = false; }
// Como las notas se ajustan a la rejilla, el error de alineacion debe ser ~0
if (avgErr > 0.02) { console.error("FALLO: notas mal alineadas al beat"); ok = false; }

console.log(ok ? "\nOK: generador sincronizado funciona." : "\nHUBO FALLOS.");
process.exit(ok ? 0 : 1);
