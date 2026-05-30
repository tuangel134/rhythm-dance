// smparser.js
// Lee stepcharts reales en formato StepMania (.sm / .ssc). Permite usar mapeos
// hechos a mano (de la comunidad) en vez de la autogeneracion, para canciones
// donde quieres el chart "de verdad" (p.ej. Csikos Post de Pump It Up).
//
// Soporta: BPMS (cambios de tempo), OFFSET, STOPS, y la rejilla de NOTES.
// Columnas: 4 (dance-single / DDR) o 5 (pump-single / PIU).
// Simbolos por celda: 0=vacio, 1=tap, 2=inicio hold, 3=fin hold/roll,
//                     4=inicio roll, M=mina (se ignora).

import fs from "node:fs";
import path from "node:path";

// Extrae los valores de una etiqueta #TAG:....; (puede ser multilinea).
function readTags(text) {
  const tags = {};
  // Quitar comentarios //...
  const clean = text.replace(/\/\/.*$/gm, "");
  const re = /#([A-Z0-9_]+):([\s\S]*?);/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const key = m[1].toUpperCase();
    const val = m[2].trim();
    // NOTES puede repetirse (varias dificultades): guardamos lista.
    if (key === "NOTES" || key === "NOTEDATA") {
      (tags._NOTES = tags._NOTES || []).push(val);
    } else {
      tags[key] = val;
    }
  }
  return tags;
}

// Parsea "beat=valor,beat=valor" -> [{beat, value}]
function parsePairs(str) {
  if (!str) return [];
  return str.split(",").map((p) => {
    const [b, v] = p.split("=");
    return { beat: parseFloat(b), value: parseFloat(v) };
  }).filter((x) => Number.isFinite(x.beat) && Number.isFinite(x.value))
    .sort((a, b) => a.beat - b.beat);
}

// Construye un conversor beat -> segundos respetando BPMS, OFFSET y STOPS.
function makeBeatToSec(bpms, offset, stops) {
  // offset (#OFFSET) en StepMania: segundos que el audio va ADELANTADO; el
  // tiempo de un beat = -offset + integral(60/bpm) + stops acumulados.
  return function beatToSec(beat) {
    let sec = -offset;
    let prevBeat = 0;
    let curBpm = bpms.length ? bpms[0].value : 120;
    for (let i = 0; i < bpms.length; i++) {
      const seg = bpms[i];
      if (seg.beat >= beat) break;
      const nextBpm = bpms[i + 1];
      const segEnd = nextBpm ? Math.min(nextBpm.beat, beat) : beat;
      sec += ((segEnd - Math.max(prevBeat, seg.beat)) * 60) / seg.value;
      curBpm = seg.value;
      prevBeat = segEnd;
      if (segEnd >= beat) break;
    }
    if (prevBeat < beat) sec += ((beat - prevBeat) * 60) / curBpm;
    // Sumar stops anteriores a este beat
    for (const s of stops) {
      if (s.beat < beat) sec += s.value;
      else break;
    }
    return sec;
  };
}

// Convierte el bloque de notas (texto) a medidas -> filas.
function parseNotesBlock(noteText) {
  // Un bloque NOTES tiene: type:desc:difficulty:meter:radar: <datos>
  // separados por ':'. Los datos son las medidas separadas por ','.
  const parts = noteText.split(":");
  let dataStr, meta = {};
  if (parts.length >= 6) {
    meta = {
      type: (parts[0] || "").trim(),
      desc: (parts[1] || "").trim(),
      difficulty: (parts[2] || "").trim(),
      meter: parseInt(parts[3], 10) || 0,
    };
    dataStr = parts.slice(5).join(":");
  } else {
    dataStr = noteText;
  }
  const measures = dataStr.split(",").map((measure) =>
    measure.trim().split(/\s+/).filter((row) => /^[0-9MmLlFf]+$/.test(row))
  ).filter((m) => m.length > 0);
  return { meta, measures };
}

/**
 * Parsea un archivo .sm/.ssc y devuelve un beatmap compatible con el juego.
 * @param {string} filePath
 * @param {Object} opts { laneCount: 5|4, preferDifficulty: 'Hard'|... }
 * @returns {{ bpm, offset, duration, laneCount, notes, fromStepfile:true, meta } | null}
 */
export function parseStepfile(filePath, opts = {}) {
  const text = fs.readFileSync(filePath, "utf8");
  const tags = readTags(text);
  if (!tags._NOTES || tags._NOTES.length === 0) return null;

  const bpms = parsePairs(tags.BPMS);
  const stops = parsePairs(tags.STOPS);
  const offset = parseFloat(tags.OFFSET || "0") || 0;
  const beatToSec = makeBeatToSec(bpms, offset, stops);
  const baseBpm = bpms.length ? bpms[0].value : 120;

  // Elegir el bloque de notas: preferimos el numero de columnas pedido y la
  // dificultad mas cercana a la solicitada.
  const wantCols = opts.laneCount === 4 ? 4 : 5;
  const blocks = tags._NOTES.map(parseNotesBlock).filter((b) => b.measures.length);

  // Detectar columnas de cada bloque por el ancho de su primera fila.
  const withCols = blocks.map((b) => {
    const cols = b.measures[0][0] ? b.measures[0][0].length : 0;
    return { ...b, cols };
  });

  let candidates = withCols.filter((b) => b.cols === wantCols);
  // Si no hay del estilo pedido, aceptamos el otro (4 o 5) y adaptamos.
  if (candidates.length === 0) candidates = withCols.filter((b) => b.cols === 4 || b.cols === 5);
  if (candidates.length === 0) return null;

  // Ordenar por dificultad (meter) y elegir segun preferencia.
  const order = ["Beginner", "Easy", "Basic", "Medium", "Normal", "Hard", "Difficult", "Expert", "Challenge", "Edit"];
  const pref = (opts.preferDifficulty || "Hard").toLowerCase();
  candidates.sort((a, b) => (a.meter || 0) - (b.meter || 0));
  let chosen = candidates.find((b) => (b.difficulty || "").toLowerCase().includes(pref));
  if (!chosen) {
    // por meter: medio-alto
    chosen = candidates[Math.min(candidates.length - 1, Math.floor(candidates.length * 0.6))];
  }

  const cols = chosen.cols;
  const notes = [];
  const holdOpen = {}; // col -> startBeat (para holds 2..3)

  chosen.measures.forEach((rows, measureIdx) => {
    const rowsN = rows.length;
    rows.forEach((row, rowIdx) => {
      const beat = (measureIdx + rowIdx / rowsN) * 4; // 4 beats por medida
      for (let c = 0; c < cols && c < row.length; c++) {
        const ch = row[c];
        if (ch === "1") {
          notes.push({ time: beatToSec(beat), lane: mapLane(c, cols, wantCols) });
        } else if (ch === "2" || ch === "4") {
          holdOpen[c] = beat;
        } else if (ch === "3") {
          if (holdOpen[c] != null) {
            const startSec = beatToSec(holdOpen[c]);
            const endSec = beatToSec(beat);
            notes.push({ time: startSec, lane: mapLane(c, cols, wantCols), duration: Math.max(0.1, endSec - startSec) });
            delete holdOpen[c];
          }
        }
        // 'M' (mina) y otros se ignoran.
      }
    });
  });

  notes.sort((a, b) => a.time - b.time);
  if (notes.length === 0) return null;

  const duration = notes[notes.length - 1].time + 2;
  return {
    bpm: Math.round(baseBpm * 100) / 100,
    offset: 0,
    duration,
    laneCount: wantCols,
    notes,
    fromStepfile: true,
    meta: { title: tags.TITLE || "", difficulty: chosen.difficulty || "", meter: chosen.meter || 0, cols },
  };
}

// Mapea la columna del archivo al carril del juego. Si el archivo y el juego
// tienen el mismo numero de columnas, es directo. Si difiere (p.ej. archivo de
// 5 y juego de 4, o viceversa), hacemos una correspondencia razonable.
function mapLane(col, fileCols, gameCols) {
  if (fileCols === gameCols) return col;
  if (fileCols === 5 && gameCols === 4) {
    // PIU(dl,ul,c,ur,dr) -> DDR(left,down,up,right): centro va a abajo.
    return [0, 2, 1, 3, 3][col];
  }
  if (fileCols === 4 && gameCols === 5) {
    // DDR(left,down,up,right) -> PIU: mapeo a 4 de los 5 paneles.
    return [0, 1, 3, 4][col];
  }
  return Math.min(col, gameCols - 1);
}

// Busca un stepfile (.sm/.ssc) junto a un archivo de audio.
export function findStepfileFor(audioPath) {
  const dir = path.dirname(audioPath);
  const base = path.basename(audioPath).replace(/\.[^.]+$/, "");
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return null; }
  // 1) Mismo nombre que el audio.
  for (const ext of [".ssc", ".sm"]) {
    const exact = entries.find((f) => f.toLowerCase() === (base + ext).toLowerCase());
    if (exact) return path.join(dir, exact);
  }
  // 2) Cualquier .ssc/.sm en la misma carpeta (carpeta-por-cancion estilo SM).
  const any = entries.find((f) => /\.(ssc|sm)$/i.test(f));
  return any ? path.join(dir, any) : null;
}


// ---------------- Parser UCS (Pump It Up) ----------------
// UCS = Universal Chart System, el formato oficial de stepcharts de Pump It Up.
// Estructura: bloques que empiezan con cabeceras ":Clave=Valor" y luego filas
// de notas (una por linea). Cada fila tiene un caracter por panel:
//   .  vacio
//   X  tap (pisar)
//   M  inicio de hold (mantener)
//   H  cuerpo del hold (continua)
//   W  fin del hold (soltar)
// Cabeceras por bloque: Mode (Single=5, Double=10), BPM, Delay (ms antes de
// empezar), Beat (beats por compas), Split (subdivisiones por beat).
//
// El tiempo de cada fila se acumula: cada fila dura (60/BPM)/Split segundos,
// y los cambios de bloque (nuevo :BPM=) reinician esos parametros.

export function parseUCS(filePath, opts = {}) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/\r/g, "");
  const lines = raw.split("\n");
  const wantCols = opts.laneCount === 4 ? 4 : 5;

  let bpm = 120, delayMs = 0, beat = 4, split = 2, mode = "Single";
  let t = 0;               // tiempo actual en segundos
  let started = false;     // ya aplicamos el delay inicial
  let firstBpm = null;
  const cols = 5;          // UCS Single = 5 paneles
  const notes = [];
  const holdOpen = {};     // col -> startTime

  let rowSec = (60 / bpm) / split;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line[0] === ":") {
      const [k, v] = line.slice(1).split("=");
      const key = (k || "").trim().toLowerCase();
      const val = (v || "").trim();
      if (key === "mode") mode = val;
      else if (key === "bpm") { bpm = parseFloat(val) || bpm; if (firstBpm == null) firstBpm = bpm; rowSec = (60 / bpm) / split; }
      else if (key === "delay") { delayMs = parseFloat(val) || 0; }
      else if (key === "beat") { beat = parseInt(val, 10) || 4; }
      else if (key === "split") { split = parseInt(val, 10) || 2; rowSec = (60 / bpm) / split; }
      // Al iniciar un bloque de notas nuevo, aplicar su Delay como tiempo inicial.
      // (Delay es el tiempo del audio antes de la primera fila de este bloque.)
      if (key === "delay") { t = delayMs / 1000; started = true; }
      continue;
    }

    // Fila de notas: un caracter por panel.
    const row = line;
    if (!/^[.XMHWxmhw]+$/.test(row)) continue;
    for (let c = 0; c < cols && c < row.length; c++) {
      const ch = row[c].toUpperCase();
      const lane = mapLane(c, cols, wantCols);
      if (ch === "X") {
        notes.push({ time: t, lane });
      } else if (ch === "M") {
        holdOpen[c] = t;            // inicio de hold
      } else if (ch === "W") {
        if (holdOpen[c] != null) {
          notes.push({ time: holdOpen[c], lane, duration: Math.max(0.1, t - holdOpen[c]) });
          delete holdOpen[c];
        } else {
          notes.push({ time: t, lane }); // fin suelto -> tap
        }
      }
      // 'H' (cuerpo) y '.' no generan nota nueva.
    }
    t += rowSec;
  }

  notes.sort((a, b) => a.time - b.time);
  if (notes.length === 0) return null;

  return {
    bpm: Math.round((firstBpm || bpm) * 100) / 100,
    offset: 0,
    duration: notes[notes.length - 1].time + 2,
    laneCount: wantCols,
    notes,
    fromStepfile: true,
    meta: { title: "", difficulty: "UCS", meter: 0, cols, format: "ucs", mode },
  };
}

// Busca un .ucs junto al audio (igual que findStepfileFor pero para UCS).
export function findUcsFor(audioPath) {
  const dir = path.dirname(audioPath);
  const base = path.basename(audioPath).replace(/\.[^.]+$/, "");
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return null; }
  const exact = entries.find((f) => f.toLowerCase() === (base + ".ucs").toLowerCase());
  if (exact) return path.join(dir, exact);
  const any = entries.find((f) => /\.ucs$/i.test(f));
  return any ? path.join(dir, any) : null;
}
