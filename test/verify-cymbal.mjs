// Verifica que los golpes de PLATILLO (crash/ride, muy agudos) aumentan la
// probabilidad de notas dobles. Comparamos una pista con kicks (sin platillos)
// vs la misma con platillos brillantes en ciertos beats.
import { generateBeatmap } from "../server/generator.js";

const sr = 44100, bpm = 120, beatSec = 60 / bpm, dur = 40;
const n = Math.floor(sr * dur);

function build(withCymbals) {
  const s = new Float32Array(n);
  function kick(t) { const st = Math.floor(t * sr); for (let i = 0; i < 0.15 * sr && st + i < n; i++) s[st + i] += 0.9 * Math.sin(2 * Math.PI * 60 * (i / sr)) * Math.exp(-(i / sr) * 22); }
  function crash(t) { // ruido muy agudo y sostenido (platillo)
    const st = Math.floor(t * sr);
    for (let i = 0; i < 0.4 * sr && st + i < n; i++) {
      const env = Math.exp(-(i / sr) * 5);
      // ruido filtrado a agudos: alternar signo rapido = alta frecuencia
      s[st + i] += 0.5 * env * (Math.random() * 2 - 1) * (i % 2 ? 1 : -1);
    }
  }
  for (let t = 9; t < dur; t += beatSec) kick(t);
  if (withCymbals) for (let t = 9; t < dur; t += beatSec * 2) crash(t); // crash cada 2 beats
  return s;
}

function jumpPct(notes) {
  const m = new Map();
  for (const x of notes) { const k = Math.round(x.time * 1000); m.set(k, (m.get(k) || 0) + 1); }
  let j = 0; for (const v of m.values()) if (v >= 2) j++;
  return Math.round((j / m.size) * 100);
}

const noCym = generateBeatmap(build(false), sr, { difficulty: "hard", laneCount: 5, genre: "pop", introFree: 8, onProgress: () => {} });
const withCym = generateBeatmap(build(true), sr, { difficulty: "hard", laneCount: 5, genre: "pop", introFree: 8, onProgress: () => {} });

const a = jumpPct(noCym.notes), b = jumpPct(withCym.notes);
console.log("sin platillos: dobles =", a + "%");
console.log("con platillos: dobles =", b + "%");

const ok = b > a;
console.log(ok ? "\nOK: los platillos aumentan las notas dobles." : "\nFALLO: no aumentaron los dobles.");
process.exit(ok ? 0 : 1);
