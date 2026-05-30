// Verifica el parser UCS (Pump It Up) con un chart pequeno CON pasos.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseUCS } from "../server/smparser.js";

// BPM 120, Split 2 => cada fila = (60/120)/2 = 0.25s. Delay 0.
// Filas: tap col0, vacio, tap col4, luego hold col2 (M..H..W).
const ucs = [
  ":Format=1",
  ":Mode=Single",
  ":BPM=120",
  ":Delay=0",
  ":Beat=4",
  ":Split=2",
  "X....",   // t=0.00 tap lane0
  ".....",   // t=0.25
  "....X",   // t=0.50 tap lane4
  "..M..",   // t=0.75 inicio hold lane2
  "..H..",   // t=1.00 cuerpo
  "..W..",   // t=1.25 fin hold lane2 (dur 0.5)
].join("\r\n");

const tmp = path.join(os.tmpdir(), "test.ucs");
fs.writeFileSync(tmp, ucs);
const bm = parseUCS(tmp, { laneCount: 5 });
fs.unlinkSync(tmp);

if (!bm) { console.log("FALLO: no parseo"); process.exit(1); }
console.log("bpm:", bm.bpm, "notas:", bm.notes.length);
bm.notes.forEach((n) => console.log(`  t=${n.time.toFixed(2)}s lane=${n.lane}${n.duration ? " hold=" + n.duration.toFixed(2) : ""}`));

let ok = bm.notes.length === 3;
const t0 = bm.notes.find((n) => n.lane === 0);
const t4 = bm.notes.find((n) => n.lane === 4);
const h2 = bm.notes.find((n) => n.lane === 2 && n.duration);
if (!t0 || Math.abs(t0.time - 0) > 0.01) ok = false;
if (!t4 || Math.abs(t4.time - 0.5) > 0.01) ok = false;
if (!h2 || Math.abs(h2.time - 0.75) > 0.01 || Math.abs(h2.duration - 0.5) > 0.01) ok = false;

console.log(ok ? "\nOK: el parser UCS lee taps y holds con tiempos correctos."
               : "\nFALLO: tiempos o estructura UCS incorrectos.");
process.exit(ok ? 0 : 1);
