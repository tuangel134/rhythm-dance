// songsettings.js
// Guarda ajustes por cancion (densidad NPS por dificultad), puntajes mas altos
// y charts del editor. Persistido en ~/.rhythm-dance/songdata.json.
//
// SEPARACION POR JUEGO: cada modo de juego ("dance" = Rhythm Dance, "guitar" =
// Guitar Hero) tiene sus propios datos para que NO se mezclen ediciones,
// puntajes ni ajustes. Internamente la clave de "dance" es el songId tal cual
// (compatibilidad con datos previos) y la de los demas juegos es
// `${game}::${songId}`.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DIR = path.join(os.homedir(), ".rhythm-dance");
const FILE = path.join(DIR, "songdata.json");

let data = { settings: {}, scores: {} };
try {
  data = JSON.parse(fs.readFileSync(FILE, "utf8"));
  if (!data.settings) data.settings = {};
  if (!data.scores) data.scores = {};
} catch { /* primera vez */ }

function save() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.warn("No se pudo guardar songdata:", e.message); }
}

// Clave de almacenamiento por juego. "dance" mantiene el songId puro (no rompe
// datos existentes); los demas juegos llevan prefijo.
function gkey(game, songId) {
  return (!game || game === "dance") ? songId : `${game}::${songId}`;
}

// ----- Ajustes por cancion -----
// settings[key] = { nps: { easy: 4.3, normal: 4.9, ... } }
export function getSongSettings(songId, game) {
  return data.settings[gkey(game, songId)] || null;
}
export function setSongNps(songId, difficulty, nps, game) {
  const k = gkey(game, songId);
  if (!data.settings[k]) data.settings[k] = { nps: {} };
  if (!data.settings[k].nps) data.settings[k].nps = {};
  if (nps == null) delete data.settings[k].nps[difficulty];
  else data.settings[k].nps[difficulty] = nps;
  save();
  return data.settings[k];
}
export function getSongNps(songId, difficulty, game) {
  const s = data.settings[gkey(game, songId)];
  return s && s.nps && s.nps[difficulty] != null ? s.nps[difficulty] : null;
}

// ----- Puntajes mas altos -----
// scores[key] = { plays, best: { score, accuracy, grade, difficulty, date } }
export function recordScore(songId, name, result, game) {
  const k = gkey(game, songId);
  if (!data.scores[k]) data.scores[k] = { name, plays: 0, best: null };
  const entry = data.scores[k];
  entry.name = name || entry.name;
  entry.plays = (entry.plays || 0) + 1;
  if (!entry.best || result.score > entry.best.score) {
    entry.best = {
      score: result.score, accuracy: result.accuracy, grade: result.grade,
      difficulty: result.difficulty, maxCombo: result.maxCombo,
      date: new Date().toISOString(),
    };
  }
  save();
  return entry;
}
export function getScore(songId, game) {
  return data.scores[gkey(game, songId)] || null;
}
// Devuelve los puntajes del juego indicado, con claves de songId "limpias"
// (sin prefijo) para que el frontend las empareje con su lista de canciones.
export function getAllScores(game) {
  const out = {};
  const prefix = (!game || game === "dance") ? null : `${game}::`;
  for (const k in data.scores) {
    if (prefix) {
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = data.scores[k];
    } else {
      // dance: las claves sin "::" (las que llevan "::" son de otros juegos).
      if (!k.includes("::")) out[k] = data.scores[k];
    }
  }
  return out;
}


// ----- Charts personalizados (editor) -----
// customCharts[key][`${difficulty}@${lanes}`] = { laneCount, notes:[...] }
// IMPORTANTE: la clave incluye el numero de carriles para que un mapeo de 4
// flechas y uno de 5 paneles de la MISMA cancion/dificultad NO se pisen.
if (!data.customCharts) data.customCharts = {};

// Migracion: entradas viejas guardadas solo por dificultad (sin "@lanes") se
// reubican usando el laneCount que traen dentro del chart.
(function migrateCustomCharts() {
  let changed = false;
  for (const k in data.customCharts) {
    const songMap = data.customCharts[k];
    for (const sub in songMap) {
      if (sub.includes("@")) continue;          // ya migrada
      const chart = songMap[sub];
      if (chart && Array.isArray(chart.notes)) {
        const lanes = chart.laneCount || 5;
        songMap[`${sub}@${lanes}`] = chart;
        delete songMap[sub];
        changed = true;
      }
    }
  }
  if (changed) save();
})();

function ckey(difficulty, lanes) { return `${difficulty}@${lanes || 5}`; }

export function saveCustomChart(songId, difficulty, chart, game) {
  const k = gkey(game, songId);
  if (!data.customCharts[k]) data.customCharts[k] = {};
  data.customCharts[k][ckey(difficulty, chart && chart.laneCount)] = chart;
  save();
}
export function getCustomChart(songId, difficulty, game, lanes) {
  const c = data.customCharts[gkey(game, songId)];
  return c && c[ckey(difficulty, lanes)] ? c[ckey(difficulty, lanes)] : null;
}
export function deleteCustomChart(songId, difficulty, game, lanes) {
  const k = gkey(game, songId);
  if (data.customCharts[k]) { delete data.customCharts[k][ckey(difficulty, lanes)]; save(); }
}
export function hasCustomChart(songId, game) {
  const c = data.customCharts[gkey(game, songId)];
  return !!(c && Object.keys(c).length);
}

// ----- Respaldo (export/import) -----
// Exporta TODO el songdata (ajustes NPS, puntajes y charts del editor) como un
// objeto serializable. Sirve para que el usuario guarde una copia de seguridad
// de sus pistas grabadas y puntajes, y pueda restaurarla luego o en otra PC.
export function exportData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: data.settings || {},
    scores: data.scores || {},
    customCharts: data.customCharts || {},
  };
}

// Importa un respaldo. modo "merge" (por defecto) combina con lo existente sin
// borrar nada (los charts/puntajes del respaldo ganan si coinciden); modo
// "replace" sustituye por completo. Devuelve un resumen de lo importado.
export function importData(payload, mode = "merge") {
  if (!payload || typeof payload !== "object") throw new Error("respaldo invalido");
  const inc = {
    settings: payload.settings || {},
    scores: payload.scores || {},
    customCharts: payload.customCharts || {},
  };
  if (mode === "replace") {
    data.settings = inc.settings;
    data.scores = inc.scores;
    data.customCharts = inc.customCharts;
  } else {
    // merge superficial por seccion (las claves del respaldo pisan a las locales).
    data.settings = { ...data.settings, ...inc.settings };
    data.scores = { ...data.scores, ...inc.scores };
    if (!data.customCharts) data.customCharts = {};
    for (const songKey in inc.customCharts) {
      data.customCharts[songKey] = { ...(data.customCharts[songKey] || {}), ...inc.customCharts[songKey] };
    }
  }
  save();
  return {
    settings: Object.keys(data.settings).length,
    scores: Object.keys(data.scores).length,
    charts: Object.keys(data.customCharts || {}).length,
  };
}
