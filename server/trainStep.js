// trainStep.js
// Reentrenamiento AUTOMATICO del mini-modelo de step-selection en segundo plano.
// Cuando el usuario guarda un chart nuevo en el editor, el modelo aprende su
// estilo sin que tenga que correr nada a mano. Cierra el ciclo "made to measure".
//
// - Debounce: si guarda varios charts seguidos, espera a que pare y entrena una
//   sola vez (evita lanzar N entrenamientos).
// - Corre el entrenador (tools/train-stepmodel.mjs) como proceso HIJO, asi NO
//   bloquea el servidor del juego ni roba CPU del render (prioridad normal del SO).
// - Solo UN entrenamiento a la vez; si llega otra peticion mientras entrena, se
//   re-encola para correr al terminar.
// - Al terminar, invalida la cache de pesos para que el modelo nuevo entre en uso.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reloadStepModel } from "./stepmodel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TRAINER = path.join(ROOT, "tools", "train-stepmodel.mjs");

let _timer = null;
let _running = false;
let _pending = false;
let _lastDoneAt = 0;
let _lastOk = true;
const DEBOUNCE_MS = 8000;   // espera 8s tras el ultimo guardado antes de entrenar

// Estado para que la UI muestre un aviso ("aprendiendo tu estilo...").
//   state: 'idle' | 'scheduled' | 'training'
export function getStepTrainStatus() {
  return {
    state: _running ? "training" : (_timer ? "scheduled" : "idle"),
    lastDoneAt: _lastDoneAt,
    lastOk: _lastOk,
  };
}

// Llamar cada vez que se guarda/borra un chart del editor.
export function scheduleStepRetrain() {
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(runRetrain, DEBOUNCE_MS);
}

function runRetrain() {
  _timer = null;
  if (_running) { _pending = true; return; }   // ya hay uno; reencolar
  _running = true;
  console.log("[step-model] reentrenando con tus charts del editor (en segundo plano)...");
  const t0 = Date.now();
  let child;
  try {
    child = spawn(process.execPath, [TRAINER], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },   // por si corre bajo Electron
    });
  } catch (e) {
    console.log("[step-model] no se pudo lanzar el entrenador:", e.message);
    _running = false; return;
  }
  let lastLine = "";
  child.stdout.on("data", (c) => { const s = c.toString().trim(); if (s) lastLine = s.split("\n").pop(); });
  child.stderr.on("data", () => {});
  child.on("error", (e) => { console.log("[step-model] error de entrenamiento:", e.message); finish(false); });
  child.on("close", (code) => finish(code === 0));

  function finish(ok) {
    _running = false;
    _lastDoneAt = Date.now();
    _lastOk = ok;
    if (ok) {
      try { reloadStepModel(); } catch (_) {}
      console.log(`[step-model] reentrenado en ${((Date.now() - t0) / 1000).toFixed(1)}s. Nuevo modelo en uso.`);
    } else {
      console.log("[step-model] el reentrenamiento no termino bien (se mantiene el modelo anterior).");
    }
    if (_pending) { _pending = false; scheduleStepRetrain(); }  // habia mas guardados
  }
}
