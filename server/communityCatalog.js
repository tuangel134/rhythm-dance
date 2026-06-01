// communityCatalog.js
// Catalogo LOCAL del indice de charts de la comunidad (Req 9). Mantiene en disco
// una copia del index.json del repo para resolver busquedas y avisos de
// disponibilidad sin pegarle a la red en cada uso. SOLO metadatos + notas
// (rutas), NUNCA audio: los Chart_Package completos se bajan bajo demanda.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fetchIndex } from "./githubClient.js";
import { getConfigFlag } from "./library.js";

const DIR = path.join(os.homedir(), ".rhythm-dance");
const FILE = path.join(DIR, "community-index.json");

const DEFAULT_REPO = "tuangel134/rhythm-dance";
const DEFAULT_BRANCH = "main";

function repoConfig() {
  return {
    repo: getConfigFlag("communityRepo") || DEFAULT_REPO,
    branch: getConfigFlag("communityBranch") || DEFAULT_BRANCH,
  };
}

function loadLocal() {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const cat = JSON.parse(raw);
    if (!Array.isArray(cat.entries)) cat.entries = [];
    return cat;
  } catch {
    return { version: 1, entries: [], syncedAt: null, source: null };
  }
}

function saveLocal(cat) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cat, null, 2));
  } catch (e) {
    console.warn("No se pudo guardar el catalogo de la comunidad:", e.message);
  }
}

// Sincroniza el catalogo local desde el repo. Si el repo no responde, CONSERVA
// el catalogo previo (Req 9.4). Devuelve { ok, count, fromCache, error? }.
export async function syncCatalog() {
  const { repo, branch } = repoConfig();
  try {
    const index = await fetchIndex(repo, branch);
    const cat = {
      version: index.version || 1,
      updatedAt: index.updatedAt || new Date().toISOString(),
      entries: index.entries || [],
      syncedAt: new Date().toISOString(),
      source: `${repo}@${branch}`,
    };
    saveLocal(cat);
    return { ok: true, count: cat.entries.length, fromCache: false };
  } catch (e) {
    const prev = loadLocal();
    return { ok: false, count: prev.entries.length, fromCache: true, error: e.message };
  }
}

// Lee el catalogo local completo (sin tocar la red).
export function getCatalog() {
  return loadLocal();
}

// Entradas del catalogo cuyo fingerprint coincide con el dado (Req 10.1, 6.1).
export function entriesForFingerprint(fingerprint) {
  if (!fingerprint) return [];
  return loadLocal().entries.filter((e) => e.fingerprint === fingerprint);
}

// Estado resumido para la UI (conteo + cuando se sincronizo).
export function catalogStatus() {
  const cat = loadLocal();
  return {
    count: cat.entries.length,
    syncedAt: cat.syncedAt || null,
    source: cat.source || null,
  };
}

// Arranque no bloqueante: intenta sincronizar al iniciar el servidor si hay red
// (Req 9.1). No lanza; los errores quedan en el log y se conserva lo previo.
export function syncCatalogOnStartup() {
  syncCatalog().then((r) => {
    if (r.ok) console.log(`  Comunidad: catalogo sincronizado (${r.count} charts)`);
    else console.log("  Comunidad: sin conexion al repo, se usa el catalogo local previo");
  }).catch(() => {});
}
