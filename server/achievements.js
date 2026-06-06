// achievements.js
// Sistema de logros (achievements). Carga las definiciones desde
// public/assets/achievements.json y las evalua contra el perfil del usuario
// cada vez que termina una partida.
//
// CONDICIONES SOPORTADAS (tipos):
//   plays              - total de partidas terminadas
//   failedPlays        - partidas perdidas
//   perfects_total     - suma de PERFECT historicos
//   combo_max          - mejor combo del perfil
//   accuracy           - mejor accuracy del perfil
//   grade              - mejor grade (>= uno dado)
//   songs_played_unique- numero de canciones unicas jugadas (top de songsPlayed)
//   plays_with_difficulty - partidas en una dificultad concreta
//   plays_with_mod     - partidas con un mod concreto
//   perfect_streak_max - maximo streak de PERFECT seguidos en una partida
//   all_perfect_song   - accuracy == 100 en una partida
//   no_fail_streak     - racha de partidas sin fallar (trackeada en el perfil)
//   playtime_hours     - horas totales de juego
//   level              - nivel del perfil
//   daily_streak       - dias consecutivos con daily challenge
//   campaign_chapter   - terminar un capitulo (lo marca campaign.js)
//   tutorial_complete  - terminar el tutorial (lo marca tutorial.js)
//
// Las definiciones se guardan en disco, no en codigo, para que se puedan
// anadir/editar sin redeploy. Si el archivo no existe, devolvemos un set
// minimo de fallback.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProfile } from "./user.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFS_PATH = path.resolve(__dirname, "..", "public", "assets", "achievements.json");

let defs = null;
let defsById = null;

function loadDefs() {
  if (defs) return defs;
  try {
    const raw = fs.readFileSync(DEFS_PATH, "utf8");
    defs = JSON.parse(raw);
  } catch {
    // Fallback minimo si no esta el archivo (version vieja del juego).
    defs = [
      { id: "first_play", title: "Primer paso", description: "Termina tu primera cancion", icon: "👣", rarity: "common", condition: { type: "plays", gte: 1 } },
      { id: "ten_plays", title: "Calentando", description: "Termina 10 canciones", icon: "🔥", rarity: "common", condition: { type: "plays", gte: 10 } },
      { id: "hundred_plays", title: "Veterano", description: "Termina 100 canciones", icon: "💯", rarity: "rare", condition: { type: "plays", gte: 100 } },
      { id: "first_perfect", title: "Impecable", description: "Consigue tu primer PERFECT", icon: "✨", rarity: "common", condition: { type: "perfects_total", gte: 1 } },
      { id: "combo_50", title: "En racha", description: "Llega a un combo de 50", icon: "🔥", rarity: "common", condition: { type: "combo_max", gte: 50 } },
      { id: "combo_100", title: "Invencible", description: "Llega a un combo de 100", icon: "💪", rarity: "rare", condition: { type: "combo_max", gte: 100 } },
      { id: "combo_200", title: "Maestro del combo", description: "Llega a un combo de 200", icon: "👑", rarity: "epic", condition: { type: "combo_max", gte: 200 } },
      { id: "first_s", title: "Calidad S", description: "Consigue tu primera S", icon: "⭐", rarity: "common", condition: { type: "grade", gte: "S" } },
      { id: "first_all_perfect", title: "Sin un error", description: "Termina una cancion con 100% accuracy", icon: "🏆", rarity: "epic", condition: { type: "all_perfect_song", count: 1 } },
      { id: "playtime_1h", title: "Una hora de ritmo", description: "Juega 1 hora acumulada", icon: "⏰", rarity: "common", condition: { type: "playtime_hours", gte: 1 } },
      { id: "playtime_10h", title: "Maraton", description: "Juega 10 horas acumuladas", icon: "⏰", rarity: "rare", condition: { type: "playtime_hours", gte: 10 } },
      { id: "level_5", title: "Subiendo", description: "Llega al nivel 5", icon: "📈", rarity: "common", condition: { type: "level", gte: 5 } },
      { id: "level_10", title: "Experimentado", description: "Llega al nivel 10", icon: "🌟", rarity: "rare", condition: { type: "level", gte: 10 } },
      { id: "daily_streak_3", title: "Constante", description: "3 dias seguidos con daily challenge", icon: "🎯", rarity: "common", condition: { type: "daily_streak", gte: 3 } },
      { id: "daily_streak_7", title: "Disciplina", description: "7 dias seguidos con daily challenge", icon: "🔥", rarity: "rare", condition: { type: "daily_streak", gte: 7 } },
      { id: "daily_streak_30", title: "Imparable", description: "30 dias seguidos con daily challenge", icon: "💎", rarity: "epic", condition: { type: "daily_streak", gte: 30 } },
    ];
  }
  defsById = new Map(defs.map((d) => [d.id, d]));
  return defs;
}

// Evalua TODAS las definiciones contra el perfil + el evento de partida.
// Devuelve la lista de logros NUEVOS desbloqueados en esta evaluacion.
// Tambien actualiza el "progreso" de los que no estan desbloqueados aun
// (para mostrar "7/10 PERFECT" en la UI).
export function evaluate(userId, event) {
  loadDefs();
  const profile = getProfile(userId);
  const stats = profile.stats;
  const ctx = buildContext(profile, event);

  // Para "count" conditions (cuantas veces ha pasado algo en el historial
  // del perfil), llevamos contadores.
  const counters = { ...(profile.achievementProgress || {}) };

  const newlyUnlocked = [];
  for (const def of defs) {
    if (profile.achievements.includes(def.id)) continue;
    const c = def.condition || {};
    const result = checkCondition(c, ctx, counters);
    if (result.unlocked) {
      profile.achievements.push(def.id);
      newlyUnlocked.push({ id: def.id, title: def.title, description: def.description, icon: def.icon, rarity: def.rarity });
    } else if (result.progress != null) {
      counters[def.id] = result.progress;
    }
  }
  profile.achievementProgress = counters;
  return { newlyUnlocked, profile, context: ctx };
}

// Construye el "contexto" que las condiciones leen: todo lo que necesitan
// para evaluarse, calculado una sola vez.
function buildContext(profile, event) {
  const s = profile.stats;
  const ctx = {
    plays: s.plays,
    failedPlays: s.failedPlays,
    perfects_total: s.totalPerfect,
    combo_max: Math.max(s.bestCombo, event ? (event.maxCombo || 0) : 0),
    accuracy: Math.max(s.bestAccuracy, event ? (event.accuracy || 0) : 0),
    grade: bestGradeRank(s.bestGrade, event ? event.grade : null),
    songs_played_unique: s.songsPlayed.length,
    playtime_hours: (s.totalPlaytime || 0) / 3600,
    level: profile.level,
    daily_streak: s.dailyStreak || 0,
    // Para checks que necesitan el evento actual.
    eventAllPerfect: false,
    eventPerfectStreak: 0,
    // Por dificultad.
    playsEasy: (s.byDifficulty.easy || {}).plays || 0,
    playsNormal: (s.byDifficulty.normal || {}).plays || 0,
    playsHard: (s.byDifficulty.hard || {}).plays || 0,
    playsExpert: (s.byDifficulty.expert || {}).plays || 0,
    // Mods usados (de la partida actual).
    eventMods: event && event.mods ? Object.keys(event.mods).filter((k) => event.mods[k]) : [],
    eventDifficulty: event ? event.difficulty : null,
  };
  if (event) {
    ctx.eventAllPerfect = event.accuracy === 100 && !event.failed && event.total > 0;
    // Streak de PERFECT: maxima secuencia de PERFECT seguidos en la partida.
    // event.perfectStreak se calcula en el cliente y se envia opcionalmente.
    if (typeof event.perfectStreak === "number") {
      ctx.eventPerfectStreak = event.perfectStreak;
    }
  }
  return ctx;
}

function bestGradeRank(a, b) {
  const r = (g) => ({ S: 6, A: 5, B: 4, C: 3, D: 2, F: 1 }[g] || 0);
  return r(a) >= r(b) ? a : b;
}

function checkCondition(c, ctx, counters) {
  const t = c.type;
  const gte = c.gte;
  const eq = c.eq;
  const count = c.count || 1;   // para "cuantas veces se ha cumplido"

  if (t === "plays") return cmp(ctx.plays, gte, eq, count, counters, "plays");
  if (t === "failedPlays") return cmp(ctx.failedPlays, gte, eq, count, counters, "failedPlays");
  if (t === "perfects_total") return cmp(ctx.perfects_total, gte, eq, count, counters, "perfects_total");
  if (t === "combo_max") return cmp(ctx.combo_max, gte, eq, count, counters, "combo_max");
  if (t === "accuracy") return cmp(ctx.accuracy, gte, eq, count, counters, "accuracy");
  if (t === "grade") return gradeCmp(ctx.grade, gte, counters);
  if (t === "songs_played_unique") return cmp(ctx.songs_played_unique, gte, eq, count, counters, "songs_played_unique");
  if (t === "playtime_hours") return cmp(ctx.playtime_hours, gte, eq, count, counters, "playtime_hours");
  if (t === "level") return cmp(ctx.level, gte, eq, count, counters, "level");
  if (t === "daily_streak") return cmp(ctx.daily_streak, gte, eq, count, counters, "daily_streak");
  if (t === "all_perfect_song") {
    // Se desbloquea la primera vez que se cumple. "count" lleva el conteo
    // historico en counters (lo actualiza ctx.eventAllPerfect al evaluar).
    const counter = counters["all_perfect_song"] || 0;
    if (ctx.eventAllPerfect) counters["all_perfect_song"] = counter + 1;
    return { unlocked: counters["all_perfect_song"] >= count, progress: counters["all_perfect_song"] };
  }
  if (t === "perfect_streak_max") {
    return cmp(ctx.eventPerfectStreak, gte, eq, count, counters, "perfect_streak_max");
  }
  if (t === "plays_with_difficulty") {
    const diff = c.difficulty;
    const key = `plays_with_difficulty:${diff}`;
    if (ctx.eventDifficulty === diff) counters[key] = (counters[key] || 0) + 1;
    return { unlocked: (counters[key] || 0) >= gte, progress: counters[key] || 0 };
  }
  if (t === "plays_with_mod") {
    const mod = c.mod;
    const key = `plays_with_mod:${mod}`;
    if (ctx.eventMods.includes(mod)) counters[key] = (counters[key] || 0) + 1;
    return { unlocked: (counters[key] || 0) >= gte, progress: counters[key] || 0 };
  }
  if (t === "campaign_chapter") {
    const ch = c.chapter;
    const key = `campaign_chapter:${ch}`;
    if (eventChapterDone(ctx, ch)) counters[key] = (counters[key] || 0) + 1;
    return { unlocked: (counters[key] || 0) >= 1, progress: counters[key] || 0 };
  }
  if (t === "tutorial_complete") {
    const counter = counters["tutorial_complete"] || 0;
    if (ctx.tutorialDone) counters["tutorial_complete"] = 1;
    return { unlocked: counter >= 1, progress: counter };
  }
  return { unlocked: false };
}

function eventChapterDone(ctx, chapterId) {
  // ctx no lleva el chapter directamente; el cliente lo manda en el event.
  return ctx._lastChapterDone === chapterId;
}

function cmp(value, gte, eq, count, counters, counterKey) {
  if (eq != null) return { unlocked: value === eq };
  if (gte == null) return { unlocked: false };
  if (count > 1) {
    // Necesita cumplirse 'count' veces. El counter se incrementa en otra
    // seccion (e.g. all_perfect_song); aqui solo leemos.
    const c = counters[counterKey] || 0;
    return { unlocked: c >= count, progress: c };
  }
  return { unlocked: value >= gte, progress: value };
}

function gradeCmp(current, required, counters) {
  const r = (g) => ({ S: 6, A: 5, B: 4, C: 3, D: 2, F: 1 }[g] || 0);
  return { unlocked: r(current) >= r(required), progress: r(current) };
}

// Devuelve todas las definiciones con marca de desbloqueadas para el user.
export function getAllForUser(userId) {
  loadDefs();
  const profile = getProfile(userId);
  return defs.map((d) => ({
    ...d,
    unlocked: profile.achievements.includes(d.id),
    progress: profile.achievementProgress ? profile.achievementProgress[d.id] : null,
  }));
}

// Cuenta cuantos logros estan desbloqueados (para badges de UI).
export function countUnlocked(userId) {
  const p = getProfile(userId);
  return p.achievements.length;
}
