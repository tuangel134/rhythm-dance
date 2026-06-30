// train-stepmodel.mjs
// Entrena el mini-MLP de STEP-SELECTION (server/stepmodel.js) con un corpus de
// PATRONES REALES de juegos de ritmo, generados por una gramatica que codifica
// el conocimiento de charting humano: escaleras, zigzags, boxes, crossovers,
// candles, jacks, alternancia de pies, acentos por instrumento y contorno de
// tono. El modelo aprende a CONTINUAR formas de patron coherentes a partir de
// la historia reciente de carriles + el contexto musical.
//
// Salida: server/model/step-model-5.json y step-model-4.json (pesos pequenos,
// se empaquetan con el juego; el usuario no descarga nada).
//
// Uso:  node tools/train-stepmodel.mjs
//
// 100% JS puro, sin dependencias (ni TensorFlow). Determinista (semilla fija).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFeatures } from "../server/stepmodel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "server", "model");

// ---------- RNG determinista ----------
let _s = 1234567;
function rnd() { _s = (Math.imul(_s, 1664525) + 1013904223) >>> 0; return _s / 4294967296; }
function ri(n) { return Math.floor(rnd() * n); }
function pick(a) { return a[ri(a.length)]; }

// ---------- Gramatica de patrones: genera (features, laneObjetivo) ----------
// Simula "frases" de chart con formas reales. Mantiene foot/lastLane/last2 y
// elige cada carril segun el TIPO de frase, produciendo patrones coherentes de
// varios pasos (no nota-a-nota al azar).
function sideOf(lane, center) { return lane < center ? -1 : (lane > center ? 1 : 0); }

function genPhrase(L, examples) {
  const center = (L - 1) / 2;
  const type = pick(["stream", "melody", "beat", "mixed", "crossover"]);
  const len = 8 + ri(24);
  const looseness = rnd();                 // dificultad simulada
  let lastLane = ri(L), last2 = -1, foot = 0;
  // estado de forma para streams
  let dir = rnd() < 0.5 ? 1 : -1;
  let zzPair = [ri(L), ri(L)];
  let boxSeq = shuffle([0, 1, L - 2, L - 1].filter((x) => x >= 0 && x < L));
  let boxI = 0;
  let pitch = rnd();
  for (let n = 0; n < len; n++) {
    const onDownbeat = (n % 4) === 0;
    const fast = type === "stream" ? 1 : (type === "crossover" ? 0.7 : (rnd() < 0.4 ? 0.7 : 0.1));
    let voice, strong;
    if (type === "beat") { voice = onDownbeat ? "kick" : "hat"; strong = onDownbeat ? 0.9 : 0.3; }
    else if (type === "melody") { voice = "melody"; strong = onDownbeat ? 0.7 : 0.4; }
    else if (type === "stream") { voice = pick(["melody", "hat", "melody"]); strong = 0.4; }
    else { voice = pick(["kick", "hat", "melody", "cymbal", "melody"]); strong = onDownbeat ? 0.8 : 0.4; }

    // contorno de tono: random walk suave para frases melodicas
    if (type === "melody" || voice === "melody") {
      pitch = Math.max(0, Math.min(1, pitch + (rnd() - 0.5) * 0.5));
    } else pitch = rnd();

    // ---- elegir el carril objetivo segun la forma ----
    let lane;
    if (type === "stream") {
      // escalera con rebote (alterna pies de forma natural) + zigzag ocasional
      if (rnd() < 0.2) dir = -dir;
      lane = lastLane + dir;
      if (lane < 0 || lane >= L) { dir = -dir; lane = lastLane + dir; }
      if (lane < 0 || lane >= L) lane = lastLane;
    } else if (type === "crossover") {
      // crossover: pisar al lado OPUESTO al pie esperado (cruce), mas en loose
      const want = foot <= 0 ? 1 : -1;     // lado al que tocaria ir
      const crossed = (looseness > 0.5 && rnd() < 0.5);
      const target = crossed ? -want : want;
      lane = target < 0 ? ri(Math.ceil(center)) : (Math.floor(center + 1) + ri(L - Math.floor(center + 1)));
      lane = Math.max(0, Math.min(L - 1, lane));
    } else if (type === "beat") {
      if (voice === "kick") {
        // bombo al centro, alternando ligeramente alrededor del centro
        lane = Math.round(center) + (foot <= 0 ? 0 : 0);
        if (rnd() < 0.3) lane = Math.max(0, Math.min(L - 1, Math.round(center) + (rnd() < 0.5 ? -1 : 1)));
      } else {
        // hat a los extremos, alternando lados
        lane = foot <= 0 ? (L - 1 - ri(2)) : ri(2);
      }
      lane = Math.max(0, Math.min(L - 1, lane));
    } else if (type === "melody") {
      // sigue el tono + alternancia de pie (empuja al lado opuesto)
      let target = pitch * (L - 1);
      const want = foot <= 0 ? 0.5 : -0.5;       // sesgo de alternancia
      target += want;
      lane = Math.max(0, Math.min(L - 1, Math.round(target)));
      if (lane === lastLane && rnd() < 0.7) lane = Math.max(0, Math.min(L - 1, lane + (rnd() < 0.5 ? -1 : 1)));
    } else { // mixed
      if (voice === "kick") lane = Math.round(center);
      else if (voice === "hat" || voice === "cymbal") lane = foot <= 0 ? L - 1 : 0;
      else { let t = pitch * (L - 1) + (foot <= 0 ? 0.5 : -0.5); lane = Math.max(0, Math.min(L - 1, Math.round(t))); }
      if (lane === lastLane && rnd() < 0.5) lane = Math.max(0, Math.min(L - 1, lane + (rnd() < 0.5 ? -1 : 1)));
    }

    // registrar ejemplo
    const ctx = { pitch, voice, onDownbeat, strong, reach: fast, looseness, foot, lastLane, last2Lane: last2 };
    examples.push({ x: buildFeatures(ctx, L), y: lane });

    // actualizar estado
    last2 = lastLane; lastLane = lane;
    const s = sideOf(lane, center);
    if (s !== 0) foot = s;
  }
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function genDataset(L, nPhrases) {
  const examples = [];
  for (let p = 0; p < nPhrases; p++) genPhrase(L, examples);
  return examples;
}

// ---------- MLP: init + forward + backward (SGD) ----------
function initModel(inDim, hidden, out) {
  const he = (fan) => (rnd() * 2 - 1) * Math.sqrt(2 / fan);
  const W1 = new Float32Array(hidden * inDim).map(() => he(inDim));
  const b1 = new Float32Array(hidden);
  const W2 = new Float32Array(out * hidden).map(() => he(hidden));
  const b2 = new Float32Array(out);
  return { inDim, hidden, out, W1, b1, W2, b2 };
}

function trainStep(m, x, y, lr) {
  const { inDim, hidden, out, W1, b1, W2, b2 } = m;
  // forward
  const h = new Float32Array(hidden), hpre = new Float32Array(hidden);
  for (let j = 0; j < hidden; j++) {
    let s = b1[j]; const base = j * inDim;
    for (let k = 0; k < inDim; k++) s += W1[base + k] * x[k];
    hpre[j] = s; h[j] = s > 0 ? s : 0;
  }
  const logits = new Float32Array(out); let mx = -Infinity;
  for (let o = 0; o < out; o++) {
    let s = b2[o]; const base = o * hidden;
    for (let j = 0; j < hidden; j++) s += W2[base + j] * h[j];
    logits[o] = s; if (s > mx) mx = s;
  }
  let sum = 0; for (let o = 0; o < out; o++) { logits[o] = Math.exp(logits[o] - mx); sum += logits[o]; }
  for (let o = 0; o < out; o++) logits[o] /= sum;     // prob
  const loss = -Math.log(logits[y] + 1e-9);
  // backward
  const dlog = logits;                                 // dL/dlogit = p - onehot
  dlog[y] -= 1;
  const dh = new Float32Array(hidden);
  for (let o = 0; o < out; o++) {
    const g = dlog[o]; const base = o * hidden;
    for (let j = 0; j < hidden; j++) { dh[j] += g * W2[base + j]; W2[base + j] -= lr * g * h[j]; }
    b2[o] -= lr * g;
  }
  for (let j = 0; j < hidden; j++) {
    if (hpre[j] <= 0) continue;                        // ReLU grad
    const g = dh[j]; const base = j * inDim;
    for (let k = 0; k < inDim; k++) W1[base + k] -= lr * g * x[k];
    b1[j] -= lr * g;
  }
  return loss;
}

function trainModel(L) {
  const data = genDataset(L, 4000);
  const inDim = 11 + 2 * L, hidden = 28, out = L;
  const m = initModel(inDim, hidden, out);
  const epochs = 14;
  let lr = 0.05;
  const idx = data.map((_, i) => i);
  for (let e = 0; e < epochs; e++) {
    // shuffle indices
    for (let i = idx.length - 1; i > 0; i--) { const j = ri(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let loss = 0;
    for (const i of idx) loss += trainStep(m, data[i].x, data[i].y, lr);
    lr *= 0.9;
    if (e % 3 === 0 || e === epochs - 1) console.log(`  [L=${L}] epoch ${e + 1}/${epochs}  loss=${(loss / data.length).toFixed(3)}`);
  }
  // precision en una muestra
  let correct = 0, total = Math.min(2000, data.length);
  for (let i = 0; i < total; i++) {
    const x = data[i].x, w = m;
    // forward argmax
    const hh = new Float32Array(w.hidden);
    for (let j = 0; j < w.hidden; j++) { let s = w.b1[j]; const b = j * w.inDim; for (let k = 0; k < w.inDim; k++) s += w.W1[b + k] * x[k]; hh[j] = s > 0 ? s : 0; }
    let bo = 0, bs = -Infinity;
    for (let o = 0; o < w.out; o++) { let s = w.b2[o]; const b = o * w.hidden; for (let j = 0; j < w.hidden; j++) s += w.W2[b + j] * hh[j]; if (s > bs) { bs = s; bo = o; } }
    if (bo === data[i].y) correct++;
  }
  console.log(`  [L=${L}] precision top-1 ~ ${(correct / total * 100).toFixed(1)}%  (${data.length} ejemplos)`);
  return m;
}

function saveModel(L, m) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const obj = {
    inDim: m.inDim, hidden: m.hidden, out: m.out,
    W1: Array.from(m.W1, (v) => +v.toFixed(5)),
    b1: Array.from(m.b1, (v) => +v.toFixed(5)),
    W2: Array.from(m.W2, (v) => +v.toFixed(5)),
    b2: Array.from(m.b2, (v) => +v.toFixed(5)),
    trainedAt: new Date().toISOString(),
    note: "step-selection MLP entrenado con gramatica de patrones (JS puro)",
  };
  const file = path.join(OUT_DIR, `step-model-${L}.json`);
  fs.writeFileSync(file, JSON.stringify(obj));
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`  [L=${L}] guardado ${file} (${kb} KB)`);
}

console.log("Entrenando step-selection model (JS puro, sin dependencias)...");
for (const L of [5, 4]) {
  _s = 1234567 + L;            // semilla por laneCount (reproducible)
  console.log(`\n== laneCount ${L} ==`);
  const m = trainModel(L);
  saveModel(L, m);
}
console.log("\nListo.");
