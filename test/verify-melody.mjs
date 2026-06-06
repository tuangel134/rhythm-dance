// verify-melody.mjs
// Verifica el CONTORNO MELODICO del generador: una seccion de audio que se
// REPITE identica produce (mayormente) el MISMO patron de carriles, porque la
// eleccion de carril sigue la altura tonal (centroide) que es determinista
// respecto al audio. Tambien comprueba que los tonos graves caen mas a la
// izquierda y los agudos mas a la derecha (correlacion pitch->carril).

import { generateBeatmap } from "../server/generator.js";

const SR = 44100;

// Construye una nota con ARMONICOS (mas realista que una sinusoide pura: genera
// mejores onsets y un centroide espectral mas claro). Tono fundamental 'freq'.
function note(freq, dur, amp = 0.5) {
  const n = Math.round(dur * SR);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-i / SR * 5) * 0.7 + 0.3;  // ataque percusivo + sostenido
    const t = i / SR;
    // Fundamental + armonicos (timbre tipo cuerda/voz): el centroide sube con freq.
    let s = Math.sin(2 * Math.PI * freq * t)
          + 0.5 * Math.sin(2 * Math.PI * freq * 2 * t)
          + 0.33 * Math.sin(2 * Math.PI * freq * 3 * t)
          + 0.25 * Math.sin(2 * Math.PI * freq * 4 * t);
    buf[i] = (s / 2.08) * amp * env;
  }
  return buf;
}

// Concatena una secuencia de tonos (un "riff").
function riff(freqs, noteDur) {
  const parts = freqs.map((f) => note(f, noteDur));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Riff melodico claro (sube de tono y baja), repetido para tener suficientes
// notas. Frecuencias bien separadas para un contorno marcado.
const melody = [165, 220, 294, 392, 523, 392, 294, 220];  // grave -> agudo -> baja
const noteDur = 0.25;  // corcheas a 120 BPM
const oneRiff = riff(melody, noteDur);
const reps = 12;
const total = oneRiff.length * reps;
const samples = new Float32Array(total);
for (let r = 0; r < reps; r++) samples.set(oneRiff, r * oneRiff.length);

const bm = generateBeatmap(samples, SR, { difficulty: "normal", laneCount: 5, genre: "pop", introFree: 0 });
console.log(`notas: ${bm.notes.length}, bpm: ${bm.bpm}, dur: ${bm.duration.toFixed(1)}s`);

// 1) Correlacion pitch->carril: las notas en momentos "agudos" del riff deben
//    tender a carriles mas altos que las de momentos "graves". Comparamos la
//    primera nota del riff (grave, 220Hz) con la del pico (660Hz, la 8a).
const riffSec = melody.length * noteDur;   // duracion de un riff
// Agrupar carriles por POSICION dentro del riff (fase).
const byPhase = {};
for (const nt of bm.notes) {
  const phase = Math.round(((nt.time % riffSec) / noteDur));  // indice de nota dentro del riff
  (byPhase[phase] = byPhase[phase] || []).push(nt.lane);
}
function avg(a) { return a.reduce((s, x) => s + x, 0) / a.length; }

// fase 0 = 220Hz (grave), fase 7 = 660Hz (agudo). El promedio de carril del
// agudo debe ser MAYOR (mas a la derecha) que el del grave.
const lowPhase = byPhase[0] ? avg(byPhase[0]) : null;
const highPhase = byPhase[7] ? avg(byPhase[7]) : null;
console.log("carril medio fase grave (220Hz):", lowPhase != null ? lowPhase.toFixed(2) : "—");
console.log("carril medio fase aguda (660Hz):", highPhase != null ? highPhase.toFixed(2) : "—");

// 2) Correlacion global pitch->carril: por cada par de fases con frecuencia
//    distinta, ¿la de mayor frecuencia tiene carril promedio >= la de menor?
//    Es la medida robusta de que el contorno melodico guia los carriles.
const phaseAvg = [];
for (let ph = 0; ph < melody.length; ph++) {
  if (byPhase[ph] && byPhase[ph].length) phaseAvg.push({ freq: melody[ph], lane: avg(byPhase[ph]) });
}
let conc = 0, disc = 0;
for (let i = 0; i < phaseAvg.length; i++) {
  for (let j = i + 1; j < phaseAvg.length; j++) {
    if (phaseAvg[i].freq === phaseAvg[j].freq) continue;
    const hi = phaseAvg[i].freq > phaseAvg[j].freq ? phaseAvg[i] : phaseAvg[j];
    const lo = phaseAvg[i].freq > phaseAvg[j].freq ? phaseAvg[j] : phaseAvg[i];
    if (hi.lane >= lo.lane) conc++; else disc++;
  }
}
const corr = conc + disc ? conc / (conc + disc) : 0;
console.log("correlacion pitch->carril (concordancia):", (corr * 100).toFixed(0) + "%");

let ok = true;
if (lowPhase != null && highPhase != null && !(highPhase > lowPhase)) {
  console.log("FALLO: el tono agudo deberia caer en carriles mas a la derecha que el grave");
  ok = false;
}
if (corr < 0.7) {
  console.log("FALLO: el carril deberia subir con la frecuencia (correlacion >=70%)");
  ok = false;
}
console.log(ok ? "OK: el contorno melodico guia los carriles (grave->izq, agudo->der)." : "REVISAR.");
process.exit(ok ? 0 : 1);
