// Verifica la cuantizacion de acordes del editor: pulsaciones casi simultaneas
// se juntan al mismo tiempo (dobles/triples exactos) pero notas separadas no.
// (No depende del navegador: probamos quantizeChords con un editor "falso".)

// Replicamos quantizeChords aislada (misma logica que editor.js).
const CHORD_WINDOW = 0.035;
function quantizeChords(notes) {
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    const group = [sorted[i]];
    let j = i + 1;
    while (j < sorted.length && sorted[j].time - sorted[i].time <= CHORD_WINDOW) { group.push(sorted[j]); j++; }
    const t = group.reduce((s, n) => s + n.time, 0) / group.length;
    const used = new Set();
    for (const n of group) {
      if (used.has(n.lane)) continue;
      used.add(n.lane);
      const nn = { time: Math.round(t * 1000) / 1000, lane: n.lane };
      if (n.duration) nn.duration = n.duration;
      out.push(nn);
    }
    i = j;
  }
  return out;
}

// Caso: 3 teclas casi a la vez (0.000, 0.015, 0.028) -> deben quedar al mismo t.
// Luego una nota separada en 0.5 (no se junta). Y un hold en 1.0 con duracion.
const input = [
  { time: 0.000, lane: 0 },
  { time: 0.015, lane: 2 },
  { time: 0.028, lane: 4 },
  { time: 0.5, lane: 1 },
  { time: 1.0, lane: 3, duration: 0.6 },
];
const out = quantizeChords(input);
console.log(out.map((n) => `t=${n.time}${n.duration ? " hold" : ""} l=${n.lane}`).join(" | "));

const chord = out.filter((n) => n.time < 0.1);
const sameTime = chord.every((n) => n.time === chord[0].time);
const sep = out.find((n) => Math.abs(n.time - 0.5) < 0.01);
const hold = out.find((n) => n.duration);

let ok = true;
if (chord.length !== 3 || !sameTime) { console.error("FALLO: el acorde de 3 no quedo al mismo tiempo"); ok = false; }
if (!sep) { console.error("FALLO: la nota separada (0.5) desaparecio o se junto"); ok = false; }
if (!hold || Math.abs(hold.duration - 0.6) > 0.001) { console.error("FALLO: el hold no se conservo"); ok = false; }

console.log(ok ? "\nOK: acordes se juntan, notas separadas se respetan, holds se conservan."
               : "\nHUBO FALLOS.");
process.exit(ok ? 0 : 1);
