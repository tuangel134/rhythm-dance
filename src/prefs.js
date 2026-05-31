// prefs.js
// Guarda y restaura las preferencias del jugador en localStorage:
// estilo, dificultad, genero, velocidad, volumen, calidad, offset de
// calibracion y la ultima cancion jugada.

const KEY = "rhythmdance.prefs.v1";

const DEFAULTS = {
  style: "5",
  difficulty: "normal",
  genre: "auto",
  scrollSpeed: 3,
  volume: 80,
  quality: "auto",
  audioOffset: 0,   // ms de calibracion (+ retrasa las notas, - las adelanta)
  videoBg: true,    // mostrar video de fondo si la cancion lo tiene
  unlockFps: false, // FPS desbloqueados (sin vsync). OFF por defecto: en GPUs
                    // modestas desactivar vsync EMPEORA (cae a ~15fps). Solo
                    // activar en GPUs potentes con monitor de alta frecuencia.
  playerName: "",
  // Teclas personalizadas. keymaps[game][profile][laneCount] = { code: lane }.
  // Si falta una entrada, se usa el mapa de fabrica.
  keymaps: {},
  // Botones de control personalizados. padmaps[game][profile][laneCount] = { buttonIndex: lane }.
  padmaps: {},
};

let cache = null;

export function loadPrefs() {
  if (cache) return cache;
  try {
    cache = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function savePrefs(patch) {
  cache = Object.assign(loadPrefs(), patch || {});
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) {}
  return cache;
}

export function getPref(k) { return loadPrefs()[k]; }
