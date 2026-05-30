// Verifica el parser de stepcharts .sm: lee BPM, offset y la rejilla de notas
// (incluyendo holds 2..3) y los convierte a tiempos en segundos correctos.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStepfile } from "../server/smparser.js";

// Mini .sm de prueba: 120 BPM, sin offset. 1 medida de pump-single (5 cols),
// 4 filas (negras): nota en col0, col2, hold en col4 (inicia fila0, fin fila3).
const sm = `
#TITLE:Test Song;
#OFFSET:0.000;
#BPMS:0.000=120.000;
#NOTES:
     pump-single:
     :
     Hard:
     10:
     :
10004
00100
00000
00003
;`;

const tmp = path.join(os.tmpdir(), "test-chart.sm");
fs.writeFileSync(tmp, sm);

const bm = parseStepfile(tmp, { laneCount: 5, preferDifficulty: "Hard" });
fs.unlinkSync(tmp);

if (!bm) { console.log("FALLO: no parseo"); process.exit(1); }
console.log("bpm:", bm.bpm, "laneCount:", bm.laneCount, "notas:", bm.notes.length);
bm.notes.forEach((n) => console.log(`  t=${n.time.toFixed(3)}s lane=${n.lane}${n.duration ? " hold=" + n.duration.toFixed(3) : ""}`));

// A 120 BPM: 1 beat = 0.5s. Medida = 4 beats = 2s. 4 filas => cada fila 0.5s.
// col0 en fila0 => t=0 ; col2 en fila1 => t=0.5 ; hold col4 fila0->fila3 => dur 1.5s
let ok = bm.bpm === 120 && bm.laneCount === 5 && bm.notes.length === 3;
const tap0 = bm.notes.find((n) => n.lane === 0);
const tap2 = bm.notes.find((n) => n.lane === 2);
const hold4 = bm.notes.find((n) => n.lane === 4 && n.duration);
if (!tap0 || Math.abs(tap0.time - 0) > 0.01) ok = false;
if (!tap2 || Math.abs(tap2.time - 0.5) > 0.01) ok = false;
if (!hold4 || Math.abs(hold4.duration - 1.5) > 0.05) ok = false;

console.log(ok ? "\nOK: el parser .sm lee notas y holds con tiempos correctos."
               : "\nFALLO: tiempos o estructura incorrectos.");
process.exit(ok ? 0 : 1);
