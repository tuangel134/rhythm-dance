// daily.js
// Desafio diario: una cancion aleatoria al dia con mods fijos + leaderboard
// local. La eleccion es DETERMINISTA por fecha (mismo dia -> misma cancion
// para todos en la misma PC).
//
// Almacenamiento:
//   ~/.rhythm-dance/daily/<YYYY-MM-DD>.json con los mejores scores del dia.
//   ~/.rhythm-dance/daily/index.json (opcional, para listado rapido).
//
// Rotacion: a medianoche local el "today" cambia y aparece un nuevo desafio.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { listSongs } from "./library.js";
import { getConfigFlag } from "./library.js";

const DIR = path.join(os.homedir(), ".rhythm-dance", "daily");
fs.mkdirSync(DIR, { recursive: true });

// Mods que aplican al desafio diario. Se eligen 1-2 al azar (determinista).
const DAILY_MODS = [
  "vanish", "hidden", "drunk", "tornado", "mirror", "reverse", "mini", "mega", "rebote", "gravedad"
];

// Variantes especiales: aplican modificadores a las reglas de juego.
const DAILY_VARIANTS = [
  null,                // normal
  null,                // normal (mas probabilidad)
  null,
  "bomb-storm",        // 25% bombas
  "speed-ramp",        // velocidad sube 0.5x cada 15s
  "tornado",           // tornado permanente
  "one-life",          // vida 1, no se recupera
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Hash determinista de un string -> entero 32-bit.
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick(arr, h) {
  return arr[h % arr.length];
}

// Devuelve {date, songId, songName, difficulty, mods, variant, songHash}.
// Si no hay canciones en la biblioteca, devuelve null.
export function getTodaysChallenge() {
  const date = todayStr();
  const songs = listSongs();
  if (!songs || !songs.length) return { date, error: "sin_canciones" };

  const h = hash("daily-" + date);
  const song = songs[h % songs.length];
  const diffs = ["normal", "hard", "expert", "ritmo", "locura"];
  const difficulty = diffs[hash(date + "diff") % diffs.length];
  const numMods = (h % 3) === 0 ? 2 : 1;   // 1 o 2 mods
  const mods = [];
  for (let i = 0; i < numMods; i++) {
    const m = DAILY_MODS[hash(date + "mod" + i) % DAILY_MODS.length];
    if (!mods.includes(m)) mods.push(m);
  }
  const variant = DAILY_VARIANTS[hash(date + "var") % DAILY_VARIANTS.length];

  return {
    date,
    songId: song.id,
    songName: song.name,
    difficulty,
    mods,
    variant,
  };
}

function dailyFile(date) {
  return path.join(DIR, date + ".json");
}

// Devuelve los mejores scores de un dia, ordenados descendente por score.
export function getDailyLeaderboard(date, limit = 20) {
  const f = dailyFile(date || todayStr());
  if (!fs.existsSync(f)) return [];
  try {
    const obj = JSON.parse(fs.readFileSync(f, "utf8"));
    return (obj.scores || []).slice(0, limit);
  } catch {
    return [];
  }
}

// Registra un score del daily. Devuelve {rank, top}.
export function submitDailyScore(userId, name, score, accuracy, maxCombo, grade) {
  const date = todayStr();
  const f = dailyFile(date);
  let obj = { date, scores: [] };
  try { if (fs.existsSync(f)) obj = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
  if (!obj.scores) obj.scores = [];

  // Anti-duplicado: si el userId ya tiene un score HOY, lo reemplazamos si
  // es mejor. Asi un jugador no puede hacer 20 intentos para colarse arriba.
  const existing = obj.scores.find((s) => s.userId === userId);
  if (existing) {
    if (score > existing.score) {
      existing.score = score;
      existing.accuracy = accuracy;
      existing.maxCombo = maxCombo;
      existing.grade = grade;
      existing.name = name;
      existing.date = new Date().toISOString();
    }
  } else {
    obj.scores.push({
      userId, name, score, accuracy, maxCombo, grade,
      date: new Date().toISOString(),
    });
  }
  obj.scores.sort((a, b) => b.score - a.score);
  obj.scores = obj.scores.slice(0, 100);   // mantener top 100 en disco
  fs.writeFileSync(f, JSON.stringify(obj, null, 2));

  const rank = obj.scores.findIndex((s) => s.userId === userId) + 1;
  return { rank, total: obj.scores.length, top: obj.scores.slice(0, 20) };
}

// Devuelve el mejor score del user en el daily de HOY (o null).
export function getMyDailyBest(userId) {
  const today = getDailyLeaderboard(todayStr(), 100);
  return today.find((s) => s.userId === userId) || null;
}

// Lista los dias con datos (para "daily anterior" / estadisticas).
export function listDailyDates() {
  return fs.readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort().reverse();
}
