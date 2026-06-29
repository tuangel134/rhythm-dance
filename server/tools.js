// tools.js
// Resuelve las rutas de las herramientas externas (ffmpeg, ffprobe, yt-dlp)
// de forma multiplataforma (Windows / Linux / macOS).
//
// ESTRATEGIA PARA YT-DLP:
// El juego descarga el binario standalone de yt-dlp directamente desde GitHub
// a ~/.rhythm-dance/bin/. No depende de pip, python, apt, brew ni nada del
// sistema. Funciona en Windows, cualquier Linux (Debian, Arch, Fedora...) y macOS.
// Se auto-actualiza cada 3 días o inmediatamente cuando una descarga falla.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Carpeta privada del juego para binarios descargados.
const APP_BIN_DIR = path.join(os.homedir(), ".rhythm-dance", "bin");
fs.mkdirSync(APP_BIN_DIR, { recursive: true });

// Posibles ubicaciones de la carpeta bin/ con las herramientas empaquetadas:
const BIN_CANDIDATES = [
  APP_BIN_DIR,
  path.join(ROOT, "bin"),
  process.resourcesPath ? path.join(process.resourcesPath, "bin") : null,
].filter(Boolean);
const BIN_DIR = BIN_CANDIDATES[0];
const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";

function exeName(name) {
  return isWin ? `${name}.exe` : name;
}

function resolveTool(name, envVar) {
  if (envVar && process.env[envVar]) return process.env[envVar];
  for (const dir of BIN_CANDIDATES) {
    const local = path.join(dir, exeName(name));
    if (fs.existsSync(local)) return local;
  }
  const abs = whichSync(name);
  if (abs) return abs;
  return exeName(name);
}

function whichSync(name) {
  try {
    const cmd = isWin ? "where" : "which";
    const r = spawnSync(cmd, [exeName(name)], { encoding: "utf8" });
    if (r.status === 0 && r.stdout) {
      const first = r.stdout.split(/\r?\n/).find((l) => l.trim());
      if (first && fs.existsSync(first.trim())) return first.trim();
    }
  } catch (_) {}
  return null;
}

export const FFMPEG = resolveTool("ffmpeg", "FFMPEG_PATH");
export const FFPROBE = resolveTool("ffprobe", "FFPROBE_PATH");
// yt-dlp se resuelve dinámicamente después de ensureYtdlp()
let _ytdlpPath = resolveTool("yt-dlp", "YTDLP_PATH");
export function getYtdlpPath() { return _ytdlpPath; }
// Compatibilidad: YTDLP como getter via proxy (los módulos ES no permiten reasignar exports)
export const YTDLP = { get path() { return _ytdlpPath; }, toString() { return _ytdlpPath; } };

export const AUTO_UPDATE_INTERVAL_DAYS = 3;

export function checkTool(cmd, args = ["-version"]) {
  try {
    const r = spawnSync(cmd, args, { timeout: 5000 });
    return r.status === 0 || r.status === null ? r.error == null : false;
  } catch { return false; }
}

export function toolStatus() {
  return {
    ffmpeg: checkTool(FFMPEG, ["-version"]),
    ffprobe: checkTool(FFPROBE, ["-version"]),
    ytdlp: checkTool(_ytdlpPath, ["--version"]),
    platform: process.platform,
  };
}

export { isWin, BIN_DIR };

// ============== DESCARGA DIRECTA DE YT-DLP (BINARIO STANDALONE) ==============
// Esta es la estrategia INFALIBLE:
// 1. Descarga el binario desde https://github.com/yt-dlp/yt-dlp/releases/latest
// 2. Lo guarda en ~/.rhythm-dance/bin/yt-dlp (o yt-dlp.exe en Windows)
// 3. No necesita pip, python, apt, brew, pacman, ni NADA
// 4. Funciona en CUALQUIER distro de Linux, Windows y macOS

const YTDLP_GITHUB_API = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";

// Determina qué asset descargar según la plataforma
function getYtdlpAssetName() {
  if (isWin) return "yt-dlp.exe";
  if (isMac) return "yt-dlp_macos";
  // Linux: el binario universal (compilado con PyInstaller, no necesita Python)
  return "yt-dlp_linux";
}

function getYtdlpLocalPath() {
  return path.join(APP_BIN_DIR, exeName("yt-dlp"));
}

// Descarga un archivo desde una URL con soporte de redirects
function downloadFile(url, destPath, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout descargando yt-dlp")), timeoutMs);
    const doRequest = (reqUrl, redirects = 0) => {
      if (redirects > 5) { clearTimeout(timeout); return reject(new Error("too many redirects")); }
      const parsedUrl = new URL(reqUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { "User-Agent": "RhythmDance/1.0" },
      };
      https.get(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return doRequest(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          clearTimeout(timeout);
          return reject(new Error(`HTTP ${res.statusCode} descargando yt-dlp`));
        }
        const tmp = destPath + ".tmp";
        const file = fs.createWriteStream(tmp);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          clearTimeout(timeout);
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            fs.renameSync(tmp, destPath);
            if (!isWin) fs.chmodSync(destPath, 0o755);
          } catch (e) { return reject(e); }
          resolve(destPath);
        });
        file.on("error", (e) => { clearTimeout(timeout); reject(e); });
      }).on("error", (e) => { clearTimeout(timeout); reject(e); });
    };
    doRequest(url);
  });
}

// Obtiene la URL de descarga del último release de yt-dlp
function getLatestYtdlpUrl() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: "/repos/yt-dlp/yt-dlp/releases/latest",
      headers: { "User-Agent": "RhythmDance/1.0", "Accept": "application/vnd.github.v3+json" },
    };
    https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        // Redirect — fetch new location
        const url2 = new URL(res.headers.location);
        https.get({ hostname: url2.hostname, path: url2.pathname + url2.search, headers: options.headers }, (res2) => {
          let data = "";
          res2.on("data", (c) => (data += c));
          res2.on("end", () => parseRelease(data, resolve, reject));
        }).on("error", reject);
        return;
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => parseRelease(data, resolve, reject));
    }).on("error", reject);
  });
}

function parseRelease(data, resolve, reject) {
  try {
    const rel = JSON.parse(data);
    const assetName = getYtdlpAssetName();
    const asset = (rel.assets || []).find((a) => a.name === assetName);
    if (!asset) return reject(new Error(`Asset ${assetName} no encontrado en el release ${rel.tag_name || "?"}`));
    resolve({ url: asset.browser_download_url, version: rel.tag_name, name: asset.name });
  } catch (e) { reject(new Error("No se pudo parsear la respuesta de GitHub: " + e.message)); }
}

// ============== ESTADO DE ACTUALIZACIÓN ==============
const UPDATE_STATE_FILE = path.join(os.homedir(), ".rhythm-dance", "ytdlp-update.json");

export function getYtdlpVersion() {
  try {
    const r = spawnSync(_ytdlpPath, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (r.status === 0 && r.stdout) return r.stdout.trim().split("\n")[0].trim();
  } catch (_) {}
  return null;
}

function readUpdateState() {
  try {
    const j = JSON.parse(fs.readFileSync(UPDATE_STATE_FILE, "utf8"));
    if (typeof j !== "object" || j == null) return defaultState();
    return { ...defaultState(), ...j };
  } catch { return defaultState(); }
}

function defaultState() {
  return { lastAttempt: 0, lastSuccess: 0, lastVersion: null, lastError: null, attempts: 0, successes: 0, installMethod: "binary-standalone" };
}

function writeUpdateState(state) {
  try {
    fs.mkdirSync(path.dirname(UPDATE_STATE_FILE), { recursive: true });
    fs.writeFileSync(UPDATE_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (_) {}
}

export function shouldAutoUpdateYtdlp(intervalDays = AUTO_UPDATE_INTERVAL_DAYS) {
  const st = readUpdateState();
  const now = Date.now();
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  // Si falló antes, reintentar tras 30 min (no esperar días).
  if (st.lastError && st.lastAttempt) {
    return (now - st.lastAttempt) > 30 * 60 * 1000;
  }
  return (now - (st.lastAttempt || 0)) > intervalMs;
}

export function getYtdlpUpdateState() {
  const st = readUpdateState();
  st.currentVersion = getYtdlpVersion();
  st.installed = checkTool(YTDLP, ["--version"]);
  st.nextEligibleAt = (st.lastAttempt || 0) + AUTO_UPDATE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  st.daysUntilNext = Math.max(0, Math.ceil((st.nextEligibleAt - Date.now()) / (24 * 60 * 60 * 1000)));
  st.autoUpdateIntervalDays = AUTO_UPDATE_INTERVAL_DAYS;
  st.installMethod = "binary-standalone";
  return st;
}

export const YTDLP_UPDATE_ERROR_PATTERNS = [
  /Sign in to confirm/i,
  /not a bot/i,
  /nsig extraction failed/i,
  /n challenge/i,
  /unable to extract.*player/i,
  /Could not extract.*player/i,
  /initial player response/i,
  /ExtractorError/i,
  /HTTP Error 403/i,
  /HTTP Error 429/i,
  /This video is (no longer|private|unavailable)/i,
  /members.?only/i,
  /Join this channel/i,
  /PoToken/i,
];

export function errorSuggestsYtdlpUpdate(stderr) {
  if (!stderr) return false;
  return YTDLP_UPDATE_ERROR_PATTERNS.some((re) => re.test(stderr));
}

// ============== INSTALAR / ACTUALIZAR YT-DLP ==============
// Estrategia SIMPLE e INFALIBLE:
// 1. Descargar el binario standalone desde GitHub Releases
// 2. Guardarlo en ~/.rhythm-dance/bin/yt-dlp
// 3. Listo. Funciona en Windows, Arch, Debian, Fedora, macOS, etc.

/**
 * Asegura que yt-dlp esté instalado. Si no existe, lo descarga.
 * Si existe pero toca actualizar, lo actualiza.
 * Devuelve { ok, version, installed, updated, error }
 */
export async function ensureYtdlp() {
  const localBin = getYtdlpLocalPath();
  const exists = fs.existsSync(localBin) && checkTool(localBin, ["--version"]);

  if (exists) {
    // Ya existe y funciona — actualizar la referencia
    _ytdlpPath = localBin;
    return { ok: true, version: getYtdlpVersion(), installed: false, updated: false };
  }

  // No existe o no funciona — descargarlo
  console.log("[yt-dlp] no encontrado, descargando binario standalone...");
  const result = await updateYtdlp({ force: true });
  return result;
}

/**
 * Actualiza yt-dlp descargando la última versión desde GitHub.
 * force=true ignora el intervalo.
 */
export async function updateYtdlp({ force = false, timeoutMs = 120000 } = {}) {
  if (!force && !shouldAutoUpdateYtdlp()) {
    const st = readUpdateState();
    return { ok: true, skipped: true, reason: "interval", version: getYtdlpVersion(), ...st };
  }

  const st = readUpdateState();
  st.lastAttempt = Date.now();
  st.attempts = (st.attempts || 0) + 1;
  writeUpdateState(st);

  const localBin = getYtdlpLocalPath();
  const strategiesTried = [];

  // === ESTRATEGIA 1: Descargar binario standalone desde GitHub (PRINCIPAL) ===
  try {
    console.log("[yt-dlp] obteniendo última versión de GitHub...");
    const release = await getLatestYtdlpUrl();
    console.log(`[yt-dlp] descargando ${release.name} (${release.version})...`);
    strategiesTried.push({ name: "github-binary-download", version: release.version });

    await downloadFile(release.url, localBin, timeoutMs);

    // Verificar que funciona
    const ver = (() => {
      try {
        const r = spawnSync(localBin, ["--version"], { encoding: "utf8", timeout: 5000 });
        return r.status === 0 ? r.stdout.trim() : null;
      } catch (_) { return null; }
    })();

    if (ver) {
      _ytdlpPath = localBin;
      st.lastSuccess = Date.now();
      st.successes = (st.successes || 0) + 1;
      st.lastError = null;
      st.lastVersion = ver;
      st.installMethod = "binary-standalone";
      writeUpdateState(st);
      console.log(`[yt-dlp] OK — versión ${ver} instalada en ${localBin}`);
      return {
        ok: true, updated: true, upToDate: false, skipped: false,
        method: "github-binary-download", code: 0, error: null,
        version: ver, message: `Descargado ${release.version}`,
        permissionDenied: false, strategiesTried, installMethod: "binary-standalone",
      };
    }
    strategiesTried[0].error = "binario descargado pero no responde a --version";
  } catch (e) {
    strategiesTried.push({ name: "github-binary-download", error: e.message });
    console.log(`[yt-dlp] descarga desde GitHub falló: ${e.message}`);
  }

  // === ESTRATEGIA 2: yt-dlp -U (si ya existe un binario standalone) ===
  if (checkTool(YTDLP, ["--version"])) {
    try {
      const r = await runCommand(YTDLP, ["-U"], 60000);
      const all = (r.out + r.err).trim();
      strategiesTried.push({ name: "yt-dlp -U", code: r.code, out: all.slice(0, 200) });
      if (r.code === 0 && (/updated to/i.test(all) || /up.to.date/i.test(all))) {
        const ver = getYtdlpVersion();
        st.lastSuccess = Date.now();
        st.successes = (st.successes || 0) + 1;
        st.lastError = null;
        st.lastVersion = ver;
        writeUpdateState(st);
        return {
          ok: true, updated: /updated to/i.test(all), upToDate: /up.to.date/i.test(all),
          skipped: false, method: "yt-dlp -U", code: 0, error: null,
          version: ver, message: all.slice(0, 300),
          permissionDenied: false, strategiesTried, installMethod: "binary-standalone",
        };
      }
    } catch (_) {}
  }

  // === ESTRATEGIA 3: pip install (fallback si no hay internet a GitHub) ===
  for (const pipCmd of ["pip3", "pip", "python3 -m pip"]) {
    try {
      const parts = pipCmd.split(" ");
      const cmd = parts[0];
      const args = [...parts.slice(1), "install", "-U", "--user", "yt-dlp"];
      const r = await runCommand(cmd, args, 120000);
      const all = (r.out + r.err).trim();
      strategiesTried.push({ name: `${pipCmd} install`, code: r.code, out: all.slice(0, 200) });
      if (r.code === 0 && (/successfully installed/i.test(all) || /requirement already satisfied/i.test(all))) {
        // Refrescar la ruta
        const newPath = whichSync("yt-dlp");
        if (newPath) { _ytdlpPath = newPath; }
        const ver = getYtdlpVersion();
        st.lastSuccess = Date.now();
        st.successes = (st.successes || 0) + 1;
        st.lastError = null;
        st.lastVersion = ver;
        writeUpdateState(st);
        return {
          ok: true, updated: true, upToDate: false, skipped: false,
          method: pipCmd, code: 0, error: null, version: ver,
          message: all.slice(0, 300), permissionDenied: false,
          strategiesTried, installMethod: "pip",
        };
      }
    } catch (_) {}
  }

  // Todo falló
  const errMsg = "No se pudo instalar/actualizar yt-dlp (sin internet o GitHub no disponible)";
  st.lastError = errMsg;
  writeUpdateState(st);
  return {
    ok: false, updated: false, upToDate: false, skipped: false,
    method: "all-failed", code: -1, error: errMsg,
    version: getYtdlpVersion(), permissionDenied: false,
    strategiesTried, installMethod: "none",
  };
}

// Ejecuta un comando y captura stdout/stderr.
function runCommand(cmd, args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    let out = "", err = "";
    let killed = false;
    try {
      const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      const t = setTimeout(() => { killed = true; try { child.kill("SIGKILL"); } catch (_) {} }, timeoutMs);
      child.stdout.on("data", (c) => (out += c.toString()));
      child.stderr.on("data", (c) => (err += c.toString()));
      child.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out, err: err || e.message, killed: true }); });
      child.on("close", (code) => { clearTimeout(t); resolve({ code, out, err, killed }); });
    } catch (e) { resolve({ code: -1, out, err: e.message, killed: false }); }
  });
}

// ============== UTILIDADES ==============

// ¿El archivo tiene una pista de VIDEO real?
const _videoProbeCache = new Map();
export function hasVideoStream(filePath) {
  let key;
  try {
    const st = fs.statSync(filePath);
    key = `${filePath}:${st.size}:${st.mtimeMs}`;
  } catch { return false; }
  if (_videoProbeCache.has(key)) return _videoProbeCache.get(key);
  let result = false;
  try {
    const r = spawnSync(FFPROBE, [
      "-v", "error", "-select_streams", "v",
      "-show_entries", "stream=codec_type,disposition=attached_pic,avg_frame_rate",
      "-of", "json", filePath,
    ], { encoding: "utf8", timeout: 8000 });
    if (r.status === 0 && r.stdout) {
      const data = JSON.parse(r.stdout);
      for (const s of data.streams || []) {
        if (s.codec_type !== "video") continue;
        const isCover = s.disposition && s.disposition.attached_pic === 1;
        const fr = s.avg_frame_rate || "0/0";
        const [n, d] = fr.split("/").map(Number);
        const fps = d ? n / d : 0;
        if (!isCover && fps >= 1) { result = true; break; }
      }
    }
  } catch { result = false; }
  _videoProbeCache.set(key, result);
  return result;
}

export function defaultDownloadDir() {
  const home = os.homedir();
  const candidates = isWin
    ? [path.join(home, "Music", "RhythmDance")]
    : [path.join(home, "Music", "RhythmDance"), path.join(home, "Música", "RhythmDance")];
  return candidates[0];
}
