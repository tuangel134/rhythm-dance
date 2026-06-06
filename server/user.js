// user.js
// Perfil persistente del jugador (UUID + XP + estadisticas + logros).
// Se guarda en ~/.rhythm-dance/profile.json. Es la base de:
//   - leaderboards globales (identidad unica)
//   - logros (evaluacion al final de cada partida)
//   - daily challenge (streak por usuario)
//   - replays (atribuidos al usuario)
//   - ghosts (identidad del jugador que se va a comparar)
//
// SEPARACION: el perfil es POR USUARIO (identificado por un UUID random
// generado en el cliente y enviado en X-User-Id). Asi si dos personas usan
// la misma PC, cada una tiene su perfil. Los datos locales del juego
// (scores, charts, settings) son por cancion y se mantienen; el perfil
// solo AGREGA estadisticas agregadas.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const DIR = path.join(os.homedir(), ".rhythm-dance");
const FILE = path.join(DIR, "profile.json");

let cache = null;

// Perfil por defecto (campos minimos). Se hace MERGE shallow con lo que
// ya exista en disco para que anadir campos nuevos no rompa perfiles viejos.
const DEFAULT_PROFILE = {
  userId: null,            // UUID generado por el cliente
  displayName: "Jugador",  // nombre que se muestra en leaderboards
  publicAlias: null,       // alias para leaderboards publicos (si != userId)
  createdAt: null,
  level: 1,
  xp: 0,
  // Estadisticas agregadas de TODAS las partidas (cualquier modo).
  stats: {
    plays: 0,              // total de partidas terminadas
    failedPlays: 0,        // partidas perdidas (vida=0)
    songsPlayed: [],       // lista de songIds unicos (top 20 mas recientes)
    bestScore: 0,          // mejor puntaje de cualquier partida
    bestCombo: 0,          // mejor combo de cualquier partida
    bestAccuracy: 0,       // mejor accuracy de cualquier partida
    bestGrade: null,       // "S" | "A" | "B" | "C" | "D" | "F"
    totalNotes: 0,         // suma de todas las notas juzgadas
    totalPerfect: 0,
    totalGreat: 0,
    totalGood: 0,
    totalOk: 0,
    totalMiss: 0,
    totalPlaytime: 0,      // segundos
    totalXp: 0,            // XP ganado historico
    dailyStreak: 0,        // dias consecutivos con daily challenge completado
    lastDailyDate: null,   // YYYY-MM-DD del ultimo daily
    // Por dificultad (facil/normal/...): plays, bestScore
    byDifficulty: {},
    // Por cancion: { songId: { plays, bestScore, bestCombo, bestAccuracy, bestGrade } }
    bySong: {},
  },
  // IDs de logros desbloqueados (referencias a public/assets/achievements.json).
  achievements: [],
  // Progreso de logros NO desbloqueados (para mostrar "7/10 PERFECT seguidos").
  achievementProgress: {},
};

function ensureDir() {
  try { fs.mkdirSync(DIR, { recursive: true }); } catch (_) {}
}

function load() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const obj = JSON.parse(raw);
    cache = mergeWithDefaults(obj);
  } catch {
    cache = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  }
  return cache;
}

// Merge recursivo superficial: DEFAULT_PROFILE + datos en disco. Asi si
// actualizo el DEFAULT con un campo nuevo, los perfiles viejos lo adoptan.
function mergeWithDefaults(stored) {
  const out = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
  for (const k in stored) {
    if (stored[k] && typeof stored[k] === "object" && !Array.isArray(stored[k])
        && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      Object.assign(out[k], stored[k]);
    } else {
      out[k] = stored[k];
    }
  }
  // Garantizar sub-objetos que pueden faltar en perfiles viejos.
  if (!out.stats) out.stats = JSON.parse(JSON.stringify(DEFAULT_PROFILE.stats));
  if (!out.stats.byDifficulty) out.stats.byDifficulty = {};
  if (!out.stats.bySong) out.stats.bySong = {};
  if (!Array.isArray(out.achievements)) out.achievements = [];
  if (!out.achievementProgress) out.achievementProgress = {};
  return out;
}

function save() {
  if (!cache) return;
  ensureDir();
  try {
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch (e) { console.warn("No se pudo guardar perfil:", e.message); }
}

// ============================================================================
// API PUBLICA
// ============================================================================

// Devuelve el perfil entero (lectura). Si el userId no coincide con el del
// perfil guardado, actualiza el userId (caso: PC nueva o instalacion limpia).
export function getProfile(userId) {
  const p = load();
  if (userId && p.userId !== userId) {
    p.userId = userId;
    if (!p.createdAt) p.createdAt = new Date().toISOString();
    save();
  } else if (!p.userId && userId) {
    p.userId = userId;
    if (!p.createdAt) p.createdAt = new Date().toISOString();
    save();
  }
  return p;
}

// Actualiza el nombre que se muestra al usuario.
export function setDisplayName(userId, name) {
  const p = getProfile(userId);
  p.displayName = String(name || "Jugador").slice(0, 20);
  save();
  return p;
}

// Alias publico (lo que aparece en leaderboards globales). Si es null,
// se usa el userId truncado. Esto es para no exponer el UUID completo.
export function setPublicAlias(userId, alias) {
  const p = getProfile(userId);
  p.publicAlias = alias ? String(alias).slice(0, 20) : null;
  save();
  return p;
}

// Devuelve el nombre que debe mostrarse en leaderboards: alias > nombre > uuid.
export function getPublicName(p) {
  return p.publicAlias || p.displayName || (p.userId ? p.userId.slice(0, 6) : "anon");
}

// Registra una partida terminada. Actualiza TODAS las estadisticas agregadas.
// Devuelve el perfil actualizado + una lista de eventos (para que achievements.js
// sepa que tiene que re-evaluar).
//
// Argumentos:
//   userId   - UUID
//   event    - { songId, songName, score, accuracy, grade, maxCombo, counts,
//                total, duration, difficulty, game, failed, mods, gameMode }
export function recordPlay(userId, event) {
  const p = getProfile(userId);
  const s = p.stats;

  // Plays.
  s.plays++;
  if (event.failed) s.failedPlays++;

  // Mejores globales.
  if (!event.failed) {
    if (event.score > s.bestScore) s.bestScore = event.score;
    if (event.maxCombo > s.bestCombo) s.bestCombo = event.maxCombo;
    if (event.accuracy > s.bestAccuracy) s.bestAccuracy = event.accuracy;
    if (!s.bestGrade || gradeRank(event.grade) > gradeRank(s.bestGrade)) {
      s.bestGrade = event.grade;
    }
  }

  // Totales.
  s.totalPlaytime += event.duration || 0;
  if (event.counts) {
    s.totalNotes += event.total || 0;
    s.totalPerfect += event.counts.PERFECT || 0;
    s.totalGreat += event.counts.GREAT || 0;
    s.totalGood += event.counts.GOOD || 0;
    s.totalOk += event.counts.OK || 0;
    s.totalMiss += event.counts.MISS || 0;
  }

  // Canciones unicas (ultimas 20).
  if (event.songId) {
    s.songsPlayed = [event.songId, ...s.songsPlayed.filter((id) => id !== event.songId)].slice(0, 20);
  }

  // Por dificultad.
  const diff = event.difficulty || "normal";
  if (!s.byDifficulty[diff]) s.byDifficulty[diff] = { plays: 0, bestScore: 0 };
  s.byDifficulty[diff].plays++;
  if (!event.failed && event.score > s.byDifficulty[diff].bestScore) {
    s.byDifficulty[diff].bestScore = event.score;
  }

  // Por cancion.
  if (event.songId) {
    if (!s.bySong[event.songId]) {
      s.bySong[event.songId] = { name: event.songName || "", plays: 0, bestScore: 0, bestCombo: 0, bestAccuracy: 0, bestGrade: null };
    }
    const bs = s.bySong[event.songId];
    bs.plays++;
    if (!event.failed) {
      if (event.score > bs.bestScore) bs.bestScore = event.score;
      if (event.maxCombo > bs.bestCombo) bs.bestCombo = event.maxCombo;
      if (event.accuracy > bs.bestAccuracy) bs.bestAccuracy = event.accuracy;
      if (!bs.bestGrade || gradeRank(event.grade) > gradeRank(bs.bestGrade)) {
        bs.bestGrade = event.grade;
      }
    }
  }

  // XP. Base por completar + bonus por precision + bonus por combo + bonus por
  // dificultad. Nivel = floor(xp / 100). Asi nivel 10 = 1000 XP = ~20 partidas.
  let xpGain = 0;
  if (!event.failed) {
    xpGain += 10;                                          // completar
    xpGain += Math.round((event.accuracy || 0) / 5);       // hasta +20 por accuracy 100%
    xpGain += Math.min(Math.floor((event.maxCombo || 0) / 10), 10); // hasta +10 por combo
    const diffBonus = { easy: 0, normal: 0, ritmo: 5, hard: 5, expert: 10, locura: 15,
                        precision: 10, caos: 15, supervivencia: 15, ciego: 20, ruleta: 15 };
    xpGain += diffBonus[diff] != null ? diffBonus[diff] : 0;
    if (event.grade === "S") xpGain += 15;
  } else {
    xpGain += 1;   // al menos 1 XP por intentarlo
  }
  p.xp += xpGain;
  p.level = Math.floor(p.xp / 100) + 1;
  s.totalXp += xpGain;

  save();
  return { profile: p, xpGain, event };
}

// Ranking numerico de un grade (para comparar "S" > "A" > ...).
function gradeRank(g) {
  return { S: 6, A: 5, B: 4, C: 3, D: 2, F: 1 }[g] || 0;
}

// Marca el daily challenge como completado HOY. Si era ayer, streak++; si no,
// streak=1. Devuelve {streak, newRecord}.
export function markDailyCompleted(userId, dateStr) {
  const p = getProfile(userId);
  const s = p.stats;
  const today = dateStr || new Date().toISOString().slice(0, 10);
  const last = s.lastDailyDate;
  if (last === today) {
    // Ya marcado hoy, no se duplica.
    return { streak: s.dailyStreak, newRecord: false };
  }
  // Calcular diferencia de dias.
  if (last) {
    const lastDate = new Date(last + "T00:00:00Z");
    const todayDate = new Date(today + "T00:00:00Z");
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) s.dailyStreak++;
    else s.dailyStreak = 1;
  } else {
    s.dailyStreak = 1;
  }
  s.lastDailyDate = today;
  save();
  return { streak: s.dailyStreak, newRecord: true };
}

// Desbloquea un logro (anade el id a achievements si no estaba). Devuelve
// {newlyUnlocked: boolean, achievementId}.
export function unlockAchievement(userId, achievementId) {
  const p = getProfile(userId);
  if (p.achievements.includes(achievementId)) return { newlyUnlocked: false, achievementId };
  p.achievements.push(achievementId);
  save();
  return { newlyUnlocked: true, achievementId };
}

// Actualiza el progreso de un logro (para mostrar "7/10").
export function setAchievementProgress(userId, achievementId, value) {
  const p = getProfile(userId);
  p.achievementProgress[achievementId] = value;
  save();
}

// Devuelve TODOS los perfiles locales (para leaderboards locales). CUIDADO:
// esto se carga solo en lecturas pequenas (no usar en hot paths).
export function listProfiles() {
  return [load()];
}

// Para tests / reset completo.
export function _resetForTests() {
  cache = null;
  try { if (fs.existsSync(FILE)) fs.unlinkSync(FILE); } catch (_) {}
}
