// profile.js
// Identidad del jugador + cache del perfil. Genera un UUID la primera vez
// y lo guarda en localStorage. Lo envia en TODAS las requests como
// header X-User-Id. Asi el servidor puede llevar estadisticas separadas
// por jugador aunque compartan PC.

const KEY = "rhythmdance.userId.v1";
const PROFILE_KEY = "rhythmdance.profile.cache.v1";

let userId = null;
let profile = null;

// Genera un UUID v4 usando crypto (disponible en navegador).
function newUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback para navegadores viejos.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Devuelve (y crea si hace falta) el UUID del jugador local.
export function getUserId() {
  if (userId) return userId;
  try {
    userId = localStorage.getItem(KEY);
    if (!userId) {
      userId = newUuid();
      localStorage.setItem(KEY, userId);
    }
  } catch {
    userId = newUuid();
  }
  return userId;
}

// Refresca la cache del perfil desde el servidor.
export async function fetchProfile() {
  const uid = getUserId();
  try {
    const r = await fetch("/api/profile", { headers: { "X-User-Id": uid } });
    const j = await r.json();
    if (j && j.profile) {
      profile = j.profile;
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
      return profile;
    }
  } catch (_) {}
  // Fallback a cache local si el servidor no responde.
  if (!profile) {
    try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { profile = null; }
  }
  return profile;
}

export function getCachedProfile() {
  if (profile) return profile;
  try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch { profile = null; }
  return profile;
}

export async function updateProfile(patch) {
  const uid = getUserId();
  try {
    const r = await fetch("/api/profile", {
      method: "POST",
      headers: { "X-User-Id": uid, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json();
    if (j && j.profile) {
      profile = j.profile;
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (_) {}
    }
    return j;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Helper para hacer fetch con el X-User-Id ya puesto.
export async function authedFetch(url, opts = {}) {
  const uid = getUserId();
  const headers = Object.assign({ "X-User-Id": uid }, opts.headers || {});
  return fetch(url, { ...opts, headers });
}
