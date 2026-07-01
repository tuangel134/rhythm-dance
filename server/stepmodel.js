// stepmodel.js
// Mini-red neuronal (MLP) para STEP-SELECTION: dado el contexto musical de una
// nota (instrumento, tono, posicion en el beat, rapidez) MAS la historia
// reciente de carriles y el estado del pie, predice una distribucion sobre los
// carriles. Aprende FORMAS DE PATRON (escaleras, crossovers, candles, boxes,
// alternancia) que un scorer nota-a-nota no produce solo.
//
// - Inferencia en JS PURO (sin dependencias, corre en el motor Node del juego).
// - Los pesos se empaquetan con el juego (server/model/step-model-*.json), asi
//   el usuario NO descarga nada.
// - El modelo se MEZCLA con el mapeo musical heuristico (no lo reemplaza): el
//   heuristico mantiene tono/instrumento/jugabilidad; el modelo aporta la forma
//   del patron de varios pasos. Si no hay pesos, todo sigue funcionando igual.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = path.join(__dirname, "model");

// ---------- Features (debe coincidir con el entrenador y con StepModel.kt) ----------
// Vector de entrada para predecir el carril de UNA nota:
//   pitch (1)
//   voz one-hot: kick, hat, cymbal, melody (4)
//   onDownbeat (1), beatInBar (1), strong (1), reach (1), looseness (1), prevJump (1)
//   foot: isLeft, isRight (2)
//   historia de carriles one-hot: last1..last5  (5*L)
// Total = 13 + 5*L.  (L=5 -> 38 ; L=4 -> 33)
export function buildFeatures(ctx, laneCount) {
  const L = laneCount;
  const f = new Float32Array(13 + 5 * L);
  let i = 0;
  f[i++] = clamp01(ctx.pitch);
  const v = ctx.voice;
  f[i++] = v === "kick" ? 1 : 0;
  f[i++] = v === "hat" ? 1 : 0;
  f[i++] = v === "cymbal" ? 1 : 0;
  f[i++] = (v === "melody" || !v) ? 1 : 0;
  f[i++] = ctx.onDownbeat ? 1 : 0;
  f[i++] = clamp01(ctx.beatInBar);      // posicion dentro del compas (0..1)
  f[i++] = clamp01(ctx.strong);
  f[i++] = clamp01(ctx.reach);          // 1 = nota muy rapida, 0 = lenta
  f[i++] = clamp01(ctx.looseness);
  f[i++] = ctx.prevJump ? 1 : 0;        // la nota previa fue un jump/acorde
  f[i++] = ctx.foot < 0 ? 1 : 0;        // ultimo pie izquierdo
  f[i++] = ctx.foot > 0 ? 1 : 0;        // ultimo pie derecho
  // Historia de los ultimos 5 carriles (trigrama ampliado a 5 para capturar
  // formas largas: escaleras de 5, boxes, crossovers extendidos).
  const hist = [ctx.lastLane, ctx.last2Lane, ctx.last3Lane, ctx.last4Lane, ctx.last5Lane];
  for (let hpos = 0; hpos < 5; hpos++) {
    const lane = hist[hpos];
    for (let k = 0; k < L; k++) f[i++] = lane === k ? 1 : 0;
  }
  return f;
}

function clamp01(x) { x = +x; return x < 0 ? 0 : x > 1 ? 1 : (isNaN(x) ? 0 : x); }

// ---------- MLP: forward pass (2 capas ocultas ReLU, salida softmax) ----------
// weights = { inDim, hidden, hidden2, out, W1,b1, W2,b2, W3,b3 }.
// Compatible hacia atras: si no hay hidden2/W3, usa 1 sola capa (W2 -> salida).
function forward(weights, x) {
  const { inDim, hidden, hidden2, out, W1, b1, W2, b2, W3, b3 } = weights;
  const h1 = new Float32Array(hidden);
  for (let j = 0; j < hidden; j++) {
    let s = b1[j]; const base = j * inDim;
    for (let k = 0; k < inDim; k++) s += W1[base + k] * x[k];
    h1[j] = s > 0 ? s : 0;               // ReLU
  }
  const logits = new Float32Array(out);
  if (hidden2 && W3) {
    const h2 = new Float32Array(hidden2);
    for (let o2 = 0; o2 < hidden2; o2++) {
      let s = b2[o2]; const base = o2 * hidden;
      for (let j = 0; j < hidden; j++) s += W2[base + j] * h1[j];
      h2[o2] = s > 0 ? s : 0;            // ReLU
    }
    for (let o = 0; o < out; o++) { let s = b3[o]; const base = o * hidden2; for (let o2 = 0; o2 < hidden2; o2++) s += W3[base + o2] * h2[o2]; logits[o] = s; }
  } else {
    for (let o = 0; o < out; o++) { let s = b2[o]; const base = o * hidden; for (let j = 0; j < hidden; j++) s += W2[base + j] * h1[j]; logits[o] = s; }
  }
  // softmax (devolvemos log-probabilidades para mezclar como prior aditivo)
  let mx = -Infinity; for (let o = 0; o < out; o++) if (logits[o] > mx) mx = logits[o];
  let sum = 0;
  for (let o = 0; o < out; o++) { logits[o] = Math.exp(logits[o] - mx); sum += logits[o]; }
  const logp = new Float32Array(out);
  for (let o = 0; o < out; o++) logp[o] = Math.log((logits[o] / sum) + 1e-9);
  return logp;
}

// ---------- Carga perezosa de pesos por laneCount ----------
const _cache = new Map();
function loadWeights(laneCount) {
  if (_cache.has(laneCount)) return _cache.get(laneCount);
  let w = null;
  try {
    const file = path.join(MODEL_DIR, `step-model-${laneCount}.json`);
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      w = {
        inDim: raw.inDim, hidden: raw.hidden, hidden2: raw.hidden2 || 0, out: raw.out,
        W1: Float32Array.from(raw.W1), b1: Float32Array.from(raw.b1),
        W2: Float32Array.from(raw.W2), b2: Float32Array.from(raw.b2),
        W3: raw.W3 ? Float32Array.from(raw.W3) : null, b3: raw.b3 ? Float32Array.from(raw.b3) : null,
      };
    }
  } catch (_) { w = null; }
  _cache.set(laneCount, w);
  return w;
}

export function hasStepModel(laneCount) { return !!loadWeights(laneCount); }

// Invalida la cache de pesos: tras reentrenar, la proxima prediccion releera
// los pesos nuevos del disco. Asi el modelo recien entrenado entra en uso sin
// reiniciar el motor.
export function reloadStepModel() { _cache.clear(); }

// Devuelve un array de log-probabilidades por carril (length=laneCount) o null
// si no hay modelo disponible para ese laneCount.
export function predictLaneLogits(ctx, laneCount) {
  const w = loadWeights(laneCount);
  if (!w) return null;
  const x = buildFeatures(ctx, laneCount);
  if (x.length !== w.inDim) return null;     // incompatibilidad de features
  return forward(w, x);
}
