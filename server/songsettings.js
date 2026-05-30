// songsettings.js
// Guarda ajustes por cancion (p.ej. densidad de notas/segundo por dificultad)
// y los puntajes mas altos. Persistido en ~/.rhythm-dance/songdata.json.

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

// ----- Ajustes por cancion -----
// settings[songId] = { nps: { easy: 4.3, normal: 4.9, ... } }
export function getSongSettings(songId) {
  return data.settings[songId] || null;
}
export function setSongNps(songId, difficulty, nps) {
  if (!data.settings[songId]) data.settings[songId] = { nps: {} };
  if (!data.settings[songId].nps) data.settings[songId].nps = {};
  if (nps == null) delete data.settings[songId].nps[difficulty];
  else data.settings[songId].nps[difficulty] = nps;
  save();
  return data.settings[songId];
}
export function getSongNps(songId, difficulty) {
  const s = data.settings[songId];
  return s && s.nps && s.nps[difficulty] != null ? s.nps[difficulty] : null;
}

// ----- Puntajes mas altos -----
// scores[songId] = { plays, best: { score, accuracy, grade, difficulty, date } }
export function recordScore(songId, name, result) {
  if (!data.scores[songId]) data.scores[songId] = { name, plays: 0, best: null };
  const entry = data.scores[songId];
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
export function getScore(songId) {
  return data.scores[songId] || null;
}
export function getAllScores() {
  return data.scores;
}


// ----- Charts personalizados (editor) -----
// customCharts[songId][difficulty] = { laneCount, notes:[{time,lane,duration?}] }
if (!data.customCharts) data.customCharts = {};

export function saveCustomChart(songId, difficulty, chart) {
  if (!data.customCharts[songId]) data.customCharts[songId] = {};
  data.customCharts[songId][difficulty] = chart;
  save();
}
export function getCustomChart(songId, difficulty) {
  const c = data.customCharts[songId];
  return c && c[difficulty] ? c[difficulty] : null;
}
export function deleteCustomChart(songId, difficulty) {
  if (data.customCharts[songId]) { delete data.customCharts[songId][difficulty]; save(); }
}
export function hasCustomChart(songId) {
  const c = data.customCharts[songId];
  return !!(c && Object.keys(c).length);
}
