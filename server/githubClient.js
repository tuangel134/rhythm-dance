// githubClient.js
// I/O de red con GitHub para el subsistema de charts de la comunidad.
//   - LECTURA (sin auth) via raw.githubusercontent.com.
//   - PUBLICACION (con token) via la Contents API.
// Todo lo descargado se trata como DATOS NO CONFIABLES: solo JSON.parse +
// validacion en community.js; jamas se ejecuta ni interpreta como codigo. El
// token nunca se incluye en logs ni en errores.

const RAW_BASE = "https://raw.githubusercontent.com";
const API_BASE = "https://api.github.com";
const CHARTS_DIR = "community-charts";
const TIMEOUT_MS = 12000;

// fetch con timeout (Node 18+ trae fetch y AbortSignal.timeout global).
async function fetchWithTimeout(url, opts = {}) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  return fetch(url, { ...opts, signal });
}

// Lee community-charts/index.json del repo (rama dada) sin autenticacion.
// Devuelve el objeto RepoIndex. Lanza Error descriptivo si falla.
export async function fetchIndex(repo, branch = "main") {
  const url = `${RAW_BASE}/${repo}/${branch}/${CHARTS_DIR}/index.json`;
  let res;
  try { res = await fetchWithTimeout(url); }
  catch (e) { throw new Error("no se pudo contactar el repositorio de charts: " + e.message); }
  if (res.status === 404) {
    // Aun no existe el indice: catalogo vacio (no es un error fatal).
    return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  }
  if (!res.ok) throw new Error(`el repositorio respondio ${res.status} al leer el indice`);
  const text = await res.text();
  let idx;
  try { idx = JSON.parse(text); }
  catch (e) { throw new Error("el indice del repositorio no es JSON valido: " + e.message); }
  if (!idx || !Array.isArray(idx.entries)) return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  return idx;
}

// Descarga el JSON (texto) de un Chart_Package concreto. Devuelve el string sin
// parsear (el llamador valida con parsePackage/validatePackage).
export async function fetchPackageFile(repo, branch, fingerprint, packageId) {
  const url = `${RAW_BASE}/${repo}/${branch}/${CHARTS_DIR}/charts/${fingerprint}/${packageId}.json`;
  let res;
  try { res = await fetchWithTimeout(url); }
  catch (e) { throw new Error("no se pudo descargar el chart: " + e.message); }
  if (res.status === 404) throw new Error("el chart solicitado no existe en el repositorio");
  if (!res.ok) throw new Error(`el repositorio respondio ${res.status} al descargar el chart`);
  return await res.text();
}

// Lee un archivo via Contents API (para obtener el 'sha' al actualizar). null si
// no existe (404). Usa token para mayor cuota.
async function getContentSha(repo, branch, filePath, token) {
  const url = `${API_BASE}/repos/${repo}/contents/${encodeURIComponentPath(filePath)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetchWithTimeout(url, { headers: ghHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`no se pudo leer el archivo remoto (${res.status})`);
  const data = await res.json();
  return data.sha || null;
}

// Sube/actualiza un archivo via Contents API (PUT). Devuelve la URL del archivo.
async function putFile(repo, branch, filePath, contentStr, message, token) {
  const url = `${API_BASE}/repos/${repo}/contents/${encodeURIComponentPath(filePath)}`;
  const sha = await getContentSha(repo, branch, filePath, token);
  const body = {
    message,
    content: Buffer.from(contentStr, "utf8").toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  };
  const res = await fetchWithTimeout(url, {
    method: "PUT",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (_) {}
    throw new Error("GitHub rechazo la publicacion: " + msg);
  }
  const data = await res.json();
  return (data.content && data.content.html_url) || null;
}

// Publica un Chart_Package: sube el archivo del package y actualiza index.json.
// mode "commit" escribe directo en la rama; "pr" no esta implementado todavia y
// se trata como commit (se documenta como modo futuro).
//   args: { fingerprint, packageId, packageJson, indexEntry, mode, branch }
// Devuelve { ok:true, url }. Lanza Error descriptivo si falla (sin exponer token).
export async function publishPackage(repo, token, args) {
  if (!token) throw new Error("falta el token de GitHub para publicar");
  const branch = args.branch || "main";
  const { fingerprint, packageId, packageJson, indexEntry } = args;
  const pkgPath = `${CHARTS_DIR}/charts/${fingerprint}/${packageId}.json`;

  // 1) Subir el package.
  const url = await putFile(repo, branch, pkgPath, packageJson, `chart: ${indexEntry.title} (${indexEntry.game}/${indexEntry.difficulty}/${indexEntry.laneCount}p) por ${indexEntry.author}`, token);

  // 2) Actualizar el indice (leer actual, fusionar la entrada, reescribir).
  let index;
  try { index = await fetchIndex(repo, branch); }
  catch { index = { version: 1, updatedAt: new Date().toISOString(), entries: [] }; }
  const entries = (index.entries || []).filter((e) => e.packageId !== packageId);
  entries.push(indexEntry);
  const newIndex = { version: index.version || 1, updatedAt: new Date().toISOString(), entries };
  await putFile(repo, branch, `${CHARTS_DIR}/index.json`, JSON.stringify(newIndex, null, 2), `index: + ${indexEntry.title}`, token);

  return { ok: true, url };
}

function ghHeaders(token) {
  const h = { "Accept": "application/vnd.github+json", "User-Agent": "rhythm-dance" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// Codifica cada segmento de la ruta pero conserva las barras.
function encodeURIComponentPath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

export const COMMUNITY_DIR = CHARTS_DIR;
