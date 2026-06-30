// train-stepmodel.mjs
// Entrena el mini-MLP de STEP-SELECTION (server/stepmodel.js) con un corpus de
// PATRONES REALES de juegos de ritmo, generados por una gramatica que codifica
// el conocimiento de charting humano: escaleras, zigzags, boxes, crossovers,
// drills (jacks alternados), gallops, anchors, alternancia de pies, acentos por
// instrumento y contorno de tono. El modelo aprende a CONTINUAR formas de patron
// coherentes a partir de la historia reciente (3 carriles) + el contexto musical.
//
// Salida: server/model/step-model-5.json y step-model-4.json (pesos pequenos,
// se empaquetan con el juego; el usuario no descarga nada).
//
// Uso:  node tools/train-stepmodel.mjs   (o  npm run train:model)
//
// 100% JS puro, sin dependencias. Determinista (semilla fija). Optimizador Adam.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { buildFeatures } from "../server/stepmodel.js";
import { parseStepfile } from "../server/smparser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "server", "model");
// Carpeta opcional con charts .sm/.ssc humanos para entrenar con datos REALES.
// Por defecto ~/.rhythm-dance/training-charts (o pasa la ruta como argumento).
const CHARTS_DIR = process.argv[2] || path.join(os.homedir(), ".rhythm-dance", "training-charts");

let _s = 1234567;
function rnd() { _s = (Math.imul(_s, 1664525) + 1013904223) >>> 0; return _s / 4294967296; }
function ri(n) { return Math.floor(rnd() * n); }
function pick(a) { return a[ri(a.length)]; }
function clampL(x, L) { return Math.max(0, Math.min(L - 1, x)); }
function sideOf(lane, center) { return lane < center ? -1 : (lane > center ? 1 : 0); }

// ---------- Gramatica de patrones ----------
// Simula "frases" de chart con formas reales y registra (features, laneObjetivo).
function genPhrase(L, examples) {
  const center = (L - 1) / 2;
  const type = pick(["stream", "zigzag", "box", "melody", "beat", "mixed", "crossover", "drill", "gallop", "anchor"]);
  const len = 8 + ri(28);
  const looseness = rnd();
  let lastLane = ri(L), last2 = -1, last3 = -1, foot = 0, prevJump = 0;
  let dir = rnd() < 0.5 ? 1 : -1;
  const zzPair = [ri(L), clampL(ri(L), L)];
  const boxCorners = [0, L - 1, 0, L - 1].map((b, k) => (k % 2 ? L - 1 : 0));
  const boxSeq = L >= 5 ? [0, 1, L - 1, L - 2] : [0, 1, L - 1, L - 2].map((x) => clampL(x, L));
  let boxI = 0;
  const anchorLane = rnd() < 0.5 ? 0 : L - 1;     // pie fijo en un extremo
  let pitch = rnd();
  let beatPos = ri(4);                              // posicion en compas (beats)
  const subdiv = type === "stream" || type === "drill" || type === "gallop" ? pick([2, 4]) : pick([1, 2]);

  for (let n = 0; n < len; n++) {
    const onDownbeat = (n % subdiv) === 0 && ((Math.floor(n / subdiv)) % 4 === 0);
    const beatInBar = ((beatPos % 4) + (n % subdiv) / subdiv) / 4;
    const fast = (type === "stream" || type === "drill" || type === "gallop") ? 1 : (type === "crossover" ? 0.7 : (rnd() < 0.4 ? 0.7 : 0.1));
    let voice, strong;
    if (type === "beat") { voice = onDownbeat ? "kick" : "hat"; strong = onDownbeat ? 0.9 : 0.3; }
    else if (type === "melody") { voice = "melody"; strong = onDownbeat ? 0.7 : 0.4; }
    else if (type === "anchor") { voice = pick(["kick", "melody"]); strong = 0.5; }
    else { voice = pick(["melody", "hat", "melody", "kick", "cymbal"]); strong = onDownbeat ? 0.8 : 0.4; }
    if (type === "melody" || voice === "melody") pitch = Math.max(0, Math.min(1, pitch + (rnd() - 0.5) * 0.5));
    else pitch = rnd();

    let lane;
    switch (type) {
      case "stream": {            // escalera con rebote (alterna pies)
        if (rnd() < 0.18) dir = -dir;
        lane = lastLane + dir;
        if (lane < 0 || lane >= L) { dir = -dir; lane = lastLane + dir; }
        if (lane < 0 || lane >= L) lane = lastLane;
        break;
      }
      case "zigzag": {            // vaiven entre dos carriles vecinos
        lane = (lastLane === zzPair[0]) ? zzPair[1] : zzPair[0];
        break;
      }
      case "box": {               // recorrido en caja por las esquinas
        lane = boxSeq[boxI % boxSeq.length]; boxI++;
        break;
      }
      case "drill": {             // drill: alterna rapido dos carriles (jacks suaves)
        lane = (lastLane === zzPair[0]) ? zzPair[1] : zzPair[0];
        break;
      }
      case "gallop": {            // gallop: par cerca + salto (corchea con puntillo)
        lane = (n % 2 === 0) ? clampL(Math.round(center), L) : clampL(lastLane + (rnd() < 0.5 ? -1 : 1), L);
        break;
      }
      case "anchor": {            // un pie fijo en un extremo, el otro se mueve
        lane = (n % 2 === 0) ? anchorLane : clampL(Math.round(pitch * (L - 1)), L);
        break;
      }
      case "crossover": {         // cruce al lado opuesto (mas en loose)
        const want = foot <= 0 ? 1 : -1;
        const crossed = (looseness > 0.5 && rnd() < 0.55);
        const tgtSide = crossed ? -want : want;
        lane = tgtSide < 0 ? ri(Math.ceil(center)) : (Math.floor(center + 1) + ri(Math.max(1, L - Math.floor(center + 1))));
        lane = clampL(lane, L);
        break;
      }
      case "beat": {
        if (voice === "kick") { lane = clampL(Math.round(center) + (rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0), L); }
        else { lane = foot <= 0 ? clampL(L - 1 - ri(2), L) : ri(2); }
        break;
      }
      case "melody": {
        let t = pitch * (L - 1) + (foot <= 0 ? 0.5 : -0.5);
        lane = clampL(Math.round(t), L);
        if (lane === lastLane && rnd() < 0.7) lane = clampL(lane + (rnd() < 0.5 ? -1 : 1), L);
        break;
      }
      default: {                  // mixed
        if (voice === "kick") lane = clampL(Math.round(center), L);
        else if (voice === "hat" || voice === "cymbal") lane = foot <= 0 ? L - 1 : 0;
        else { let t = pitch * (L - 1) + (foot <= 0 ? 0.5 : -0.5); lane = clampL(Math.round(t), L); }
        if (lane === lastLane && rnd() < 0.5) lane = clampL(lane + (rnd() < 0.5 ? -1 : 1), L);
      }
    }

    const ctx = { pitch, voice, onDownbeat, beatInBar, strong, reach: fast, looseness, prevJump, foot, lastLane, last2Lane: last2, last3Lane: last3 };
    examples.push({ x: buildFeatures(ctx, L), y: lane });

    last3 = last2; last2 = lastLane; lastLane = lane;
    const sd = sideOf(lane, center); if (sd !== 0) foot = sd;
    // jump ocasional en acentos (marca prevJump para la siguiente nota)
    prevJump = (onDownbeat && rnd() < 0.15) ? 1 : 0;
    if ((n % subdiv) === subdiv - 1) beatPos++;
  }
}

function genDataset(L, nPhrases) {
  const ex = [];
  for (let p = 0; p < nPhrases; p++) genPhrase(L, ex);
  return ex;
}

// ---------- Datos REALES desde charts .sm/.ssc (opcional) ----------
function listCharts(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listCharts(p));
    else if (/\.(sm|ssc)$/i.test(e.name)) out.push(p);
  }
  return out;
}

// Convierte un chart humano parseado en ejemplos (contexto -> carril). Sin audio
// no hay tono/instrumento: esas features quedan neutras y el modelo aprende la
// FORMA del patron (transiciones reales). En runtime el heuristico aporta el
// tono/instrumento; el modelo aporta la forma humana. Mezcla ideal.
function examplesFromChart(chart, L, out) {
  const center = (L - 1) / 2;
  const notes = chart.notes;
  // agrupar notas simultaneas en "frames" (jumps)
  const frames = []; let i = 0;
  while (i < notes.length) {
    const t = notes[i].time; const lanes = [];
    while (i < notes.length && Math.abs(notes[i].time - t) < 0.012) { lanes.push(notes[i].lane); i++; }
    frames.push({ time: t, lanes });
  }
  const beatSec = 60 / (chart.bpm || 120);
  const meter = (chart.meta && chart.meta.meter) || 5;
  const looseness = Math.max(0, Math.min(1, (meter - 3) / 9));   // meter ~3..12 -> 0..1
  let lastLane = -1, last2 = -1, last3 = -1, foot = 0, prevJump = 0, prevT = -Infinity, added = 0;
  for (const fr of frames) {
    const gap = fr.time - prevT;
    const reach = gap <= 0.10 ? 1 : gap >= 0.30 ? 0 : (0.30 - gap) / 0.20;
    const beat = fr.time / beatSec;
    const frac = beat - Math.floor(beat);
    const onDownbeat = frac < 0.06 || frac > 0.94;
    const beatInBar = ((Math.floor(beat) % 4) + frac) / 4;
    if (fr.lanes.length === 1) {
      const lane = fr.lanes[0];
      if (lane >= 0 && lane < L) {
        const ctx = { pitch: 0.5, voice: "melody", onDownbeat, beatInBar, strong: onDownbeat ? 0.7 : 0.4, reach, looseness, prevJump, foot, lastLane, last2Lane: last2, last3Lane: last3 };
        out.push({ x: buildFeatures(ctx, L), y: lane });
        added++;
        last3 = last2; last2 = lastLane; lastLane = lane;
        const sd = sideOf(lane, center); if (sd !== 0) foot = sd;
        prevJump = 0;
      }
    } else {
      last3 = last2; last2 = lastLane; lastLane = -1; foot = 0; prevJump = 1;
    }
    prevT = fr.time;
  }
  return added;
}

function loadRealExamples(L) {
  const files = listCharts(CHARTS_DIR);
  if (!files.length) return { ex: [], files: 0 };
  const ex = []; let used = 0;
  for (const f of files) {
    try {
      const chart = parseStepfile(f, { laneCount: L, preferDifficulty: "Hard" });
      if (chart && chart.notes && chart.notes.length > 8) { examplesFromChart(chart, L, ex); used++; }
    } catch (_) { /* ignora charts mal formados */ }
  }
  return { ex, files: used };
}

// ---------- MLP + Adam ----------
function initModel(inDim, hidden, out) {
  const he = (fan) => (rnd() * 2 - 1) * Math.sqrt(2 / fan);
  const mk = (n, fan) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = he(fan); return a; };
  return {
    inDim, hidden, out,
    W1: mk(hidden * inDim, inDim), b1: new Float32Array(hidden),
    W2: mk(out * hidden, hidden), b2: new Float32Array(out),
  };
}
function adamState(m) {
  const z = (n) => ({ m: new Float32Array(n), v: new Float32Array(n) });
  return { W1: z(m.W1.length), b1: z(m.b1.length), W2: z(m.W2.length), b2: z(m.b2.length), t: 0 };
}
function adamUpdate(arr, grad, st, lr, t) {
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  const c1 = 1 - Math.pow(b1, t), c2 = 1 - Math.pow(b2, t);
  for (let i = 0; i < arr.length; i++) {
    const g = grad[i];
    st.m[i] = b1 * st.m[i] + (1 - b1) * g;
    st.v[i] = b2 * st.v[i] + (1 - b2) * g * g;
    const mh = st.m[i] / c1;
    const vh = st.v[i] / c2;
    arr[i] -= lr * mh / (Math.sqrt(vh) + eps);
  }
}

function forwardBackward(m, x, y, grads) {
  const { inDim, hidden, out, W1, b1, W2, b2 } = m;
  const h = new Float32Array(hidden), hpre = new Float32Array(hidden);
  for (let j = 0; j < hidden; j++) { let s = b1[j]; const b = j * inDim; for (let k = 0; k < inDim; k++) s += W1[b + k] * x[k]; hpre[j] = s; h[j] = s > 0 ? s : 0; }
  const p = new Float32Array(out); let mx = -Infinity;
  for (let o = 0; o < out; o++) { let s = b2[o]; const b = o * hidden; for (let j = 0; j < hidden; j++) s += W2[b + j] * h[j]; p[o] = s; if (s > mx) mx = s; }
  let sum = 0; for (let o = 0; o < out; o++) { p[o] = Math.exp(p[o] - mx); sum += p[o]; }
  for (let o = 0; o < out; o++) p[o] /= sum;
  const loss = -Math.log(p[y] + 1e-9);
  const dlog = p; dlog[y] -= 1;
  const dh = new Float32Array(hidden);
  for (let o = 0; o < out; o++) { const g = dlog[o]; const b = o * hidden; for (let j = 0; j < hidden; j++) { dh[j] += g * W2[b + j]; grads.W2[b + j] += g * h[j]; } grads.b2[o] += g; }
  for (let j = 0; j < hidden; j++) { if (hpre[j] <= 0) continue; const g = dh[j]; const b = j * inDim; for (let k = 0; k < inDim; k++) grads.W1[b + k] += g * x[k]; grads.b1[j] += g; }
  return loss;
}

function zeroGrads(m) { return { W1: new Float32Array(m.W1.length), b1: new Float32Array(m.b1.length), W2: new Float32Array(m.W2.length), b2: new Float32Array(m.b2.length) }; }

function accuracy(m, data, from, to) {
  let ok = 0, tot = 0;
  for (let i = from; i < to; i++) {
    const x = data[i].x; const h = new Float32Array(m.hidden);
    for (let j = 0; j < m.hidden; j++) { let s = m.b1[j]; const b = j * m.inDim; for (let k = 0; k < m.inDim; k++) s += m.W1[b + k] * x[k]; h[j] = s > 0 ? s : 0; }
    let bo = 0, bs = -Infinity; for (let o = 0; o < m.out; o++) { let s = m.b2[o]; const b = o * m.hidden; for (let j = 0; j < m.hidden; j++) s += m.W2[b + j] * h[j]; if (s > bs) { bs = s; bo = o; } }
    if (bo === data[i].y) ok++; tot++;
  }
  return ok / tot;
}

function trainModel(L) {
  const data = genDataset(L, 9000);
  // Mezclar datos REALES de charts humanos (.sm/.ssc) si existen: aportan la
  // forma de patron humana. Si hay muchos, los duplicamos un poco para que
  // pesen frente a los sinteticos (que cubren tono/instrumento).
  const real = loadRealExamples(L);
  if (real.ex.length) {
    const reps = real.ex.length < data.length ? 2 : 1;   // dar peso si son pocos
    for (let r = 0; r < reps; r++) for (const e of real.ex) data.push(e);
    console.log(`  [L=${L}] datos REALES: ${real.files} charts -> ${real.ex.length} ejemplos (x${reps})`);
  } else {
    console.log(`  [L=${L}] sin charts reales en ${CHARTS_DIR} (solo sinteticos). Pon .sm/.ssc ahi para subir calidad.`);
  }
  // shuffle + split 85/15
  for (let i = data.length - 1; i > 0; i--) { const j = ri(i + 1); [data[i], data[j]] = [data[j], data[i]]; }
  const split = Math.floor(data.length * 0.85);
  const inDim = 13 + 3 * L, hidden = 40, out = L;
  const m = initModel(inDim, hidden, out);
  const st = adamState(m);
  const epochs = 24, batch = 64, lr = 0.01;
  const idx = []; for (let i = 0; i < split; i++) idx.push(i);
  for (let e = 0; e < epochs; e++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = ri(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let loss = 0, cnt = 0;
    for (let b = 0; b < idx.length; b += batch) {
      const g = zeroGrads(m); let nb = 0;
      for (let i = b; i < Math.min(b + batch, idx.length); i++) { loss += forwardBackward(m, data[idx[i]].x, data[idx[i]].y, g); nb++; cnt++; }
      const inv = 1 / nb; for (const k of ["W1", "b1", "W2", "b2"]) for (let i = 0; i < g[k].length; i++) g[k][i] *= inv;
      st.t++;
      adamUpdate(m.W1, g.W1, st.W1, lr, st.t); adamUpdate(m.b1, g.b1, st.b1, lr, st.t);
      adamUpdate(m.W2, g.W2, st.W2, lr, st.t); adamUpdate(m.b2, g.b2, st.b2, lr, st.t);
    }
    if (e % 4 === 0 || e === epochs - 1) {
      const va = accuracy(m, data, split, data.length);
      console.log(`  [L=${L}] epoch ${e + 1}/${epochs}  loss=${(loss / cnt).toFixed(3)}  val-acc=${(va * 100).toFixed(1)}%`);
    }
  }
  const trAcc = accuracy(m, data, 0, Math.min(2000, split));
  const vaAcc = accuracy(m, data, split, data.length);
  console.log(`  [L=${L}] FINAL  train-acc~${(trAcc * 100).toFixed(1)}%  val-acc~${(vaAcc * 100).toFixed(1)}%  (${data.length} ejemplos, ${inDim}->${hidden}->${out})`);
  return m;
}

function saveModel(L, m) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const r5 = (a) => Array.from(a, (v) => +v.toFixed(5));
  const obj = { inDim: m.inDim, hidden: m.hidden, out: m.out, W1: r5(m.W1), b1: r5(m.b1), W2: r5(m.W2), b2: r5(m.b2), trainedAt: new Date().toISOString(), note: "step-selection MLP (Adam, gramatica de patrones, JS puro)" };
  const file = path.join(OUT_DIR, `step-model-${L}.json`);
  fs.writeFileSync(file, JSON.stringify(obj));
  console.log(`  [L=${L}] guardado ${file} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
}

console.log("Entrenando step-selection model (JS puro, Adam, sin dependencias)...");
for (const L of [5, 4]) {
  _s = 987654 + L * 7;
  console.log(`\n== laneCount ${L} ==`);
  saveModel(L, trainModel(L));
}
console.log("\nListo.");
