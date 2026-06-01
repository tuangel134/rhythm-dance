// community.js
// Nucleo de logica PURA del subsistema de charts de la comunidad
// (Community_Charts_System). Sin I/O de red ni disco: solo calculo de
// fingerprint, construccion/serializacion/parseo/validacion de Chart_Package y
// filtrado de busqueda. La parte de red vive en githubClient.js y el catalogo
// local en communityCatalog.js.
//
// Principio rector: un Chart_Package NUNCA contiene audio; solo notas y
// metadatos. La vinculacion con la cancion correcta se hace con un
// Song_Fingerprint reproducible derivado de metadatos no sonoros.

import crypto from "node:crypto";

export const PACKAGE_VERSION = 1;

// Campos de audio PROHIBIDOS en cualquier parte de un Chart_Package. Si
// aparece alguno (en la raiz o anidado), validatePackage rechaza el paquete.
const AUDIO_KEYS = ["audio", "samples", "pcm", "dataurl", "datauri", "wav", "mp3", "ogg", "waveform", "audiodata", "audiobuffer", "soundfile", "buffer"];

// ---------------- Song_Fingerprint ----------------

// Normaliza un texto para el fingerprint: minusculas, sin acentos (NFD +
// quitar marcas diacriticas), recortado y con espacios internos colapsados.
// null/undefined -> "".
export function normalizeText(s) {
  if (s == null) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // quitar marcas diacriticas (acentos)
    .trim()
    .replace(/\s+/g, " ");
}

// Tupla canonica (titulo norm, artista norm, duracion entera, bpm entero).
// Dos canciones con la misma tupla canonica comparten fingerprint.
export function canonicalTuple(meta) {
  const m = meta || {};
  const dur = Number(m.duration);
  const bpm = Number(m.bpm);
  return [
    normalizeText(m.title),
    normalizeText(m.artist),
    Number.isFinite(dur) ? Math.round(dur) : 0,
    Number.isFinite(bpm) ? Math.round(bpm) : 0,
  ];
}

// Calcula el Song_Fingerprint (sha1 hex de 40 chars) desde metadatos. Usa SOLO
// metadatos, nunca audio (Req 1.1). Reproducible (Req 1.2) e inyectivo sobre la
// tupla canonica (Req 1.5).
export function computeFingerprint(meta) {
  const [title, artist, dur, bpm] = canonicalTuple(meta);
  const s = `${title}|${artist}|${dur}|${bpm}`;
  return crypto.createHash("sha1").update(s).digest("hex");
}

// ---------------- Chart_Package ----------------

// packageId determinista (16 hex) por cancion+juego+dificultad+carriles+autor.
// Permite varias entradas por cancion sin pisarse y es estable por autor/estilo.
export function computePackageId(fingerprint, metadata, attribution) {
  const m = metadata || {};
  const a = attribution || {};
  const s = `${fingerprint}|${m.game}|${m.difficulty}|${m.laneCount}|${normalizeText(a.name)}`;
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
}

// Construye un Chart_Package a partir de sus piezas. NO hace I/O. El objeto
// resultante nunca contiene campos de audio (Req 1.4, 3.4).
export function buildPackage({ chart, metadata, attribution, fingerprint }) {
  const fp = fingerprint || computeFingerprint(metadata || {});
  return {
    version: PACKAGE_VERSION,
    fingerprint: fp,
    metadata: {
      game: metadata.game,
      difficulty: metadata.difficulty,
      laneCount: metadata.laneCount,
      title: metadata.title,
      artist: metadata.artist != null ? metadata.artist : "",
      bpm: metadata.bpm,
      duration: metadata.duration,
    },
    attribution: {
      name: attribution.name,
      ...(attribution.contact ? { contact: attribution.contact } : {}),
      ...(attribution.note ? { note: attribution.note } : {}),
    },
    chart: {
      laneCount: chart.laneCount,
      duration: chart.duration,
      bpm: chart.bpm,
      notes: chart.notes.map((n) => {
        const note = { time: n.time, lane: n.lane };
        if (n.duration != null && n.duration > 0) note.duration = n.duration;
        return note;
      }),
    },
    createdAt: new Date().toISOString(),
  };
}

// Serializa un Chart_Package a JSON (string).
export function serializePackage(pkg) {
  return JSON.stringify(pkg);
}

// Parsea un JSON (string u objeto) a Chart_Package. Lanza Error descriptivo si
// esta malformado o le faltan las secciones requeridas (Req 2.2, 2.4).
export function parsePackage(input) {
  let obj = input;
  if (typeof input === "string") {
    try { obj = JSON.parse(input); }
    catch (e) { throw new Error("el paquete no es JSON valido: " + e.message); }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("el paquete debe ser un objeto");
  }
  if (obj.version == null) throw new Error("falta el campo 'version'");
  if (!obj.metadata || typeof obj.metadata !== "object") throw new Error("falta la seccion 'metadata'");
  if (!obj.attribution || typeof obj.attribution !== "object") throw new Error("falta la seccion 'attribution'");
  if (!obj.chart || typeof obj.chart !== "object") throw new Error("falta la seccion 'chart'");
  if (!Array.isArray(obj.chart.notes)) throw new Error("'chart.notes' debe ser una lista");
  if (typeof obj.fingerprint !== "string" || !obj.fingerprint) throw new Error("falta el campo 'fingerprint'");
  return obj;
}

// Busca (recursivo) cualquier clave de audio prohibida. Devuelve la clave
// encontrada o null. Limita la profundidad para no recorrer estructuras enormes.
function findAudioKey(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return null;
  for (const key of Object.keys(obj)) {
    if (AUDIO_KEYS.includes(key.toLowerCase())) return key;
    const v = obj[key];
    if (v && typeof v === "object") {
      const found = findAudioKey(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// Valida las NOTAS de un chart. Devuelve { ok:true } o { ok:false, rule, error }
// identificando la primera regla violada (Req 8.1, 8.2).
//   rule: "no-notes" | "time-out-of-range" | "lane-out-of-range"
export function validateNotes(chart) {
  if (!chart || !Array.isArray(chart.notes) || chart.notes.length === 0) {
    return { ok: false, rule: "no-notes", error: "el chart no tiene notas" };
  }
  const laneCount = chart.laneCount;
  const duration = chart.duration;
  for (const n of chart.notes) {
    if (!Number.isFinite(n.time) || n.time < 0 || n.time > duration) {
      return { ok: false, rule: "time-out-of-range", error: `nota con tiempo fuera de rango: ${n.time}` };
    }
    if (!Number.isInteger(n.lane) || n.lane < 0 || n.lane >= laneCount) {
      return { ok: false, rule: "lane-out-of-range", error: `nota con carril fuera de rango: ${n.lane}` };
    }
  }
  return { ok: true };
}

// Valida un Chart_Package COMPLETO. Devuelve { ok:true } o
// { ok:false, error, rule } describiendo la primera regla que fallo.
// Comprueba (en orden): parseo, version, metadata completa, atribucion no
// vacia, sin audio, notas validas, tamano <= maxBytes.
export function validatePackage(pkg, { maxBytes = 5 * 1024 * 1024 } = {}) {
  let obj;
  try { obj = parsePackage(pkg); }
  catch (e) { return { ok: false, rule: "malformed", error: e.message }; }

  if (obj.version == null) return { ok: false, rule: "version", error: "falta el identificador de version" };

  // Metadata completa (Req 8.3). 'artist' es opcional.
  const m = obj.metadata;
  for (const field of ["game", "difficulty", "laneCount", "title", "bpm", "duration"]) {
    if (m[field] == null || m[field] === "") {
      return { ok: false, rule: "metadata", error: `metadata incompleta: falta '${field}'` };
    }
  }
  if (m.game !== "dance" && m.game !== "guitar") {
    return { ok: false, rule: "metadata", error: `juego invalido: '${m.game}'` };
  }

  // Atribucion no vacia (Req 7.3).
  if (!obj.attribution || typeof obj.attribution.name !== "string" || obj.attribution.name.trim() === "") {
    return { ok: false, rule: "attribution", error: "la atribucion no puede estar vacia" };
  }

  // Sin audio (Req 1.4, 5.4).
  const audioKey = findAudioKey(obj);
  if (audioKey) return { ok: false, rule: "audio", error: `el paquete no debe contener audio (campo '${audioKey}')` };

  // Notas validas (Req 8.1, 8.2).
  const notesRes = validateNotes(obj.chart);
  if (!notesRes.ok) return { ok: false, rule: notesRes.rule, error: notesRes.error };

  // Tamano (Req 8.5).
  const bytes = Buffer.byteLength(typeof pkg === "string" ? pkg : serializePackage(obj), "utf8");
  if (bytes > maxBytes) {
    return { ok: false, rule: "size", error: `el paquete supera el maximo de ${Math.round(maxBytes / (1024 * 1024))} MB` };
  }

  return { ok: true };
}

// ---------------- Filtro de busqueda ----------------

// Filtra una lista de entradas de indice por un subconjunto de campos. Solo se
// aplican los campos PRESENTES en 'filter' (los ausentes/null/undefined no
// restringen). Solido y completo (Req 4.2, 4.3, 6.1).
export function filterEntries(entries, filter = {}) {
  const keys = ["fingerprint", "game", "difficulty", "laneCount"];
  const active = keys.filter((k) => filter[k] != null && filter[k] !== "");
  return (entries || []).filter((e) =>
    active.every((k) => {
      if (k === "laneCount") return Number(e.laneCount) === Number(filter.laneCount);
      return e[k] === filter[k];
    })
  );
}

// Construye una entrada de indice (IndexEntry) a partir de un package.
export function indexEntryFromPackage(pkg, packageId) {
  const id = packageId || computePackageId(pkg.fingerprint, pkg.metadata, pkg.attribution);
  return {
    packageId: id,
    fingerprint: pkg.fingerprint,
    path: `community-charts/charts/${pkg.fingerprint}/${id}.json`,
    game: pkg.metadata.game,
    difficulty: pkg.metadata.difficulty,
    laneCount: pkg.metadata.laneCount,
    title: pkg.metadata.title,
    artist: pkg.metadata.artist || "",
    bpm: pkg.metadata.bpm,
    duration: pkg.metadata.duration,
    author: pkg.attribution.name,
    noteCount: pkg.chart.notes.length,
    createdAt: pkg.createdAt || new Date().toISOString(),
  };
}

// ---------------- Aplicar a un store (semantica gkey/ckey) ----------------
// Aplica un Chart_Package a un STORE inyectable con la misma semantica de claves
// que songsettings.js: gkey(game,songId) y ckey(difficulty,lanes). Esto permite
// probar la separacion por juego/carriles (Req 6.2, 6.3, 7.2) sin tocar disco.
// El store es un objeto plano { [gkey]: { [ckey]: chart } }.

export function gkeyOf(game, songId) {
  return (!game || game === "dance") ? songId : `${game}::${songId}`;
}
export function ckeyOf(difficulty, lanes) {
  return `${difficulty}@${lanes || 5}`;
}

// Guarda el chart del package en el store bajo las claves derivadas de su
// game/difficulty/laneCount, conservando la atribucion junto al chart (Req 7.2).
// Devuelve el chart guardado.
export function applyToStore(store, songId, pkg) {
  const g = gkeyOf(pkg.metadata.game, songId);
  const c = ckeyOf(pkg.metadata.difficulty, pkg.chart.laneCount);
  if (!store[g]) store[g] = {};
  const stored = {
    laneCount: pkg.chart.laneCount,
    duration: pkg.chart.duration,
    bpm: pkg.chart.bpm,
    notes: pkg.chart.notes.map((n) => ({ ...n })),
    attribution: { ...pkg.attribution },
    source: "community",
    fingerprint: pkg.fingerprint,
  };
  store[g][c] = stored;
  return stored;
}

// Lee un chart del store (para verificar round-trip de almacenamiento).
export function readFromStore(store, songId, game, difficulty, lanes) {
  const g = store[gkeyOf(game, songId)];
  if (!g) return null;
  return g[ckeyOf(difficulty, lanes)] || null;
}
