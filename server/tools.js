// tools.js
// Resuelve las rutas de las herramientas externas (ffmpeg, ffprobe, yt-dlp)
// de forma multiplataforma (Windows / Linux / macOS).
//
// Orden de busqueda:
//   1. Variable de entorno (FFMPEG_PATH, etc.)
//   2. Binario junto al proyecto en ./bin (para distribuir en Windows).
//   3. El nombre a secas (asume que esta en el PATH).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
// Posibles ubicaciones de la carpeta bin/ con las herramientas:
//   - desarrollo / app empaquetada (asar:false): <root>/bin
//   - empaquetado via extraResources: process.resourcesPath/bin
const BIN_CANDIDATES = [
  path.join(ROOT, "bin"),
  process.resourcesPath ? path.join(process.resourcesPath, "bin") : null,
].filter(Boolean);
const BIN_DIR = BIN_CANDIDATES[0];
const isWin = process.platform === "win32";

function exeName(name) {
  return isWin ? `${name}.exe` : name;
}

function resolveTool(name, envVar) {
  // 1. Variable de entorno
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }
  // 2. Binario local en alguna carpeta bin/ conocida
  for (const dir of BIN_CANDIDATES) {
    const local = path.join(dir, exeName(name));
    if (fs.existsSync(local)) return local;
  }
  // 3. Ruta absoluta desde el PATH (which / where)
  const abs = whichSync(name);
  if (abs) return abs;
  // 4. Nombre a secas (ultimo recurso; asume PATH)
  return exeName(name);
}

// Localiza la ruta absoluta de un ejecutable en el PATH (multiplataforma).
function whichSync(name) {
  try {
    const cmd = isWin ? "where" : "which";
    const r = spawnSync(cmd, [exeName(name)], { encoding: "utf8" });
    if (r.status === 0 && r.stdout) {
      const first = r.stdout.split(/\r?\n/).find((l) => l.trim());
      if (first && fs.existsSync(first.trim())) return first.trim();
    }
  } catch (_) { /* ignora */ }
  return null;
}

export const FFMPEG = resolveTool("ffmpeg", "FFMPEG_PATH");
export const FFPROBE = resolveTool("ffprobe", "FFPROBE_PATH");
export const YTDLP = resolveTool("yt-dlp", "YTDLP_PATH");
export const AUTO_UPDATE_INTERVAL_DAYS = 3;

// Comprueba si una herramienta responde (para avisar al usuario si falta).
export function checkTool(cmd, args = ["-version"]) {
  try {
    const r = spawnSync(cmd, args, { timeout: 5000 });
    return r.status === 0 || r.status === null ? r.error == null : false;
  } catch {
    return false;
  }
}

export function toolStatus() {
  return {
    ffmpeg: checkTool(FFMPEG, ["-version"]),
    ffprobe: checkTool(FFPROBE, ["-version"]),
    ytdlp: checkTool(YTDLP, ["--version"]),
    platform: process.platform,
  };
}

export { isWin, BIN_DIR };

// ============== Auto-actualización de yt-dlp (SUPER ROBUSTA) ==============
// YouTube cambia su player cada 1-2 semanas y los extractors de yt-dlp se
// quedan obsoletos: la mayoria de descargas fallan con errores tipo
// "Sign in to confirm", "nsig extraction failed", "HTTP Error 403", etc.
// Mantener yt-dlp al dia es la unica forma de evitar esto.
//
// Estrategias de actualización (en orden):
//   1. `yt-dlp -U`  → binario standalone (método original)
//   2. `pip3 install -U yt-dlp`  → instalado via pip (el más común)
//   3. `python3 -m pip install -U yt-dlp`  → fallback pip
//   4. `pip install -U yt-dlp`  → fallback pip legacy
//   5. `pipx upgrade yt-dlp`  → instalado via pipx
//   6. `conda update -y yt-dlp`  → instalado via conda
//   7. `pip install --user -U yt-dlp`  → si los anteriores fallan por permisos
//
// El estado se guarda en ~/.rhythm-dance/ytdlp-update.json.
// updateYtdlp() prueba automaticamente todas las estrategias.

const UPDATE_STATE_FILE = path.join(os.homedir(), ".rhythm-dance", "ytdlp-update.json");

export function getYtdlpVersion() {
  try {
    const r = spawnSync(YTDLP, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (r.status === 0 && r.stdout) return r.stdout.trim().split("\n")[0].trim();
  } catch (_) {}
  return null;
}

function readUpdateState() {
  try {
    const j = JSON.parse(fs.readFileSync(UPDATE_STATE_FILE, "utf8"));
    if (typeof j !== "object" || j == null) return defaultState();
    return { ...defaultState(), ...j };
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return { lastAttempt: 0, lastSuccess: 0, lastVersion: null, lastError: null, attempts: 0, successes: 0, installMethod: null };
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
  // Si la última vez FALLÓ, reintentar tras 1 hora (no esperar días enteros).
  // Así las descargas no quedan rotas por una semana si falla por un error
  // transitorio (sin internet, timeout, etc.).
  if (st.lastError && st.lastAttempt) {
    const retryAfterFailMs = 60 * 60 * 1000; // 1 hora
    return (now - st.lastAttempt) > retryAfterFailMs;
  }
  // Si la última vez tuvo éxito, respetar el intervalo normal.
  return (now - (st.lastAttempt || 0)) > intervalMs;
}

export function getYtdlpUpdateState() {
  const st = readUpdateState();
  st.currentVersion = getYtdlpVersion();
  st.nextEligibleAt = (st.lastAttempt || 0) + AUTO_UPDATE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  st.daysUntilNext = Math.max(0, Math.ceil((st.nextEligibleAt - Date.now()) / (24 * 60 * 60 * 1000)));
  st.autoUpdateIntervalDays = AUTO_UPDATE_INTERVAL_DAYS;
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

// ---------- DETECCIÓN DEL MÉTODO DE INSTALACIÓN ----------

const PIP_INSTALL_MARKERS = [
  /installed.*(?:with|by)\s+pip/i,
  /you (?:installed|can).*pip/i,
  /use pip to update/i,
  /use.*pip.*install/i,
  /wheel.*from.*pypi/i,
  /from pypi/i,
];

function isPipInstallError(stderr) {
  if (!stderr) return false;
  return PIP_INSTALL_MARKERS.some((re) => re.test(stderr));
}

// Detecta el método de instalación de yt-dlp probando varios indicios.
// NO ejecuta `yt-dlp -U` (eso lo hace updateYtdlp como primera estrategia).
// Devuelve: { method: 'binary'|'pip'|'pipx'|'conda'|'brew'|'apt'|'unknown', pipCmd: string|null, detail: string|null }
export function detectYtdlpInstallMethod() {
  // Orden de prioridad:
  //   1. brew (macOS/Linux) — si está en Homebrew, actualizar con brew
  //   2. dpkg/apt (Debian/Ubuntu) — si es un paquete del sistema
  //   3. pipx — instalado via pipx
  //   4. conda — instalado via conda
  //   5. pip (pip show) — instalado via pip
  //   6. file command — detectar script Python
  //   7. yt-dlp -U fallback — probar el flag -U

  // 1. Buscar via brew (macOS/Linux)
  try {
    const r = spawnSync("brew", ["list", "yt-dlp"], { encoding: "utf8", timeout: 8000 });
    if (r.status === 0 && r.stdout && r.stdout.includes("yt-dlp")) {
      return { method: "brew", pipCmd: "brew", detail: r.stdout };
    }
  } catch (_) {}

  // 2. Buscar via dpkg (Debian/Ubuntu)
  if (process.platform === "linux") {
    try {
      const r = spawnSync("dpkg", ["-l", "yt-dlp"], { encoding: "utf8", timeout: 5000 });
      if (r.status === 0 && r.stdout && /^ii\s+yt-dlp/im.test(r.stdout)) {
        return { method: "apt", pipCmd: "apt", detail: r.stdout };
      }
    } catch (_) {}
  }

  // 3. Buscar via pipx
  try {
    const r = spawnSync("pipx", ["list", "--short"], { encoding: "utf8", timeout: 5000 });
    if (r.status === 0 && r.stdout && r.stdout.includes("yt-dlp")) {
      return { method: "pipx", pipCmd: "pipx", detail: r.stdout };
    }
  } catch (_) {}

  // 4. Buscar via conda
  try {
    const r = spawnSync("conda", ["list", "yt-dlp", "--json"], { encoding: "utf8", timeout: 5000 });
    if (r.status === 0 && r.stdout) {
      try {
        const pkgs = JSON.parse(r.stdout);
        if (Array.isArray(pkgs) && pkgs.some((p) => p.name === "yt-dlp")) {
          return { method: "conda", pipCmd: "conda", detail: r.stdout };
        }
      } catch (_) {}
    }
  } catch (_) {}

  // 5. Buscar en pip común: `pip3 show yt-dlp`
  for (const pipCmd of ["pip3", "pip", "pip3.12", "pip3.11", "pip3.10"]) {
    try {
      const r = spawnSync(pipCmd, ["show", "yt-dlp"], { encoding: "utf8", timeout: 5000 });
      if (r.status === 0 && r.stdout && /^Name:\s*yt-dlp/im.test(r.stdout)) {
        return { method: "pip", pipCmd, detail: r.stdout };
      }
    } catch (_) {}
  }

  // 6. Buscar con python3 -m pip (entornos virtuales, pyenv)
  for (const py of ["python3", "python"]) {
    try {
      const r = spawnSync(py, ["-m", "pip", "show", "yt-dlp"], { encoding: "utf8", timeout: 5000 });
      if (r.status === 0 && r.stdout && /^Name:\s*yt-dlp/im.test(r.stdout)) {
        return { method: "pip", pipCmd: `${py} -m pip`, detail: r.stdout };
      }
    } catch (_) {}
  }

  // 7. Examinar el binario con `file` para ver si es un script Python
  try {
    const f = spawnSync("file", [YTDLP], { encoding: "utf8", timeout: 3000 });
    if (f.status === 0 && f.stdout && /python|script|text/i.test(f.stdout)) {
      return { method: "pip", pipCmd: "pip3", detail: `El binario es un script: ${f.stdout.trim()}` };
    }
  } catch (_) {}

  // 8. No se pudo determinar con los métodos anteriores.
  //    Como fallback, probamos `yt-dlp -U` con stderr capturado (rápido si es pip-install,
  //    porque rechaza -U inmediatamente). Si el stderr contiene el mensaje pip, es pip.
  try {
    const test = spawnSync(YTDLP, ["-U"], { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "pipe"] });
    if (test.status === 0 && !isPipInstallError(test.stderr)) {
      return { method: "binary", pipCmd: null, detail: "yt-dlp -U aceptado (binario standalone)" };
    }
    if (isPipInstallError(test.stderr)) {
      return { method: "pip", pipCmd: "pip3", detail: test.stderr };
    }
  } catch (_) {}

  // 9. No se pudo determinar; asumimos binary como fallback
  return { method: "unknown", pipCmd: null, detail: null };
}

// ---------- EJECUTOR DE ACTUALIZACIÓN ----------

// Ejecuta un comando y captura stdout/stderr. Resuelve con {code, out, err, killed}.
function runCommand(cmd, args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    let out = "", err = "";
    let killed = false;
    try {
      const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      const t = setTimeout(() => {
        killed = true;
        try { child.kill("SIGKILL"); } catch (_) {}
      }, timeoutMs);
      child.stdout.on("data", (c) => (out += c.toString()));
      child.stderr.on("data", (c) => (err += c.toString()));
      child.on("error", (e) => {
        clearTimeout(t);
        resolve({ code: -1, out, err: err || e.message, killed: true });
      });
      child.on("close", (code) => {
        clearTimeout(t);
        resolve({ code, out, err, killed });
      });
    } catch (e) {
      resolve({ code: -1, out, err: e.message, killed: false });
    }
  });
}

// Estrategias de actualización en orden de preferencia.
// Cada estrategia devuelve { method, cmd, args } o null si no aplica.
function getUpdateStrategies(installMethod) {
  const strategies = [];

  // Estrategia A: `pip3 install -U yt-dlp` con el pip que detectamos
  if (installMethod.method === "pip" && installMethod.pipCmd) {
    strategies.push({
      name: `pip (${installMethod.pipCmd})`,
      cmd: installMethod.pipCmd.split(" ")[0],
      args: [...installMethod.pipCmd.split(" ").slice(1), "install", "-U", "yt-dlp"],
      timeoutMs: 120000,
    });
    // Fallback con --user si el pipCmd tiene permiso
    strategies.push({
      name: `pip --user (${installMethod.pipCmd})`,
      cmd: installMethod.pipCmd.split(" ")[0],
      args: [...installMethod.pipCmd.split(" ").slice(1), "install", "-U", "--user", "yt-dlp"],
      timeoutMs: 120000,
    });
  }

  // Estrategia B: `yt-dlp -U` (binario standalone)
  strategies.push({
    name: "yt-dlp -U",
    cmd: YTDLP,
    args: ["-U"],
    timeoutMs: 60000,
  });

  // Estrategia C: pip3 directo
  if (installMethod.method !== "pip" || !installMethod.pipCmd || installMethod.pipCmd !== "pip3") {
    strategies.push({
      name: "pip3 install -U yt-dlp",
      cmd: "pip3",
      args: ["install", "-U", "yt-dlp"],
      timeoutMs: 120000,
    });
    strategies.push({
      name: "pip3 install --user -U yt-dlp",
      cmd: "pip3",
      args: ["install", "-U", "--user", "yt-dlp"],
      timeoutMs: 120000,
    });
  }

  // Estrategia D: python3 -m pip
  if (installMethod.method !== "pip" || !installMethod.pipCmd || !installMethod.pipCmd.includes("python")) {
    strategies.push({
      name: "python3 -m pip install -U yt-dlp",
      cmd: "python3",
      args: ["-m", "pip", "install", "-U", "yt-dlp"],
      timeoutMs: 120000,
    });
  }

  // Estrategia E: pip directo
  if (installMethod.method !== "pip" || !installMethod.pipCmd || installMethod.pipCmd === "pip3") {
    strategies.push({
      name: "pip install -U yt-dlp",
      cmd: "pip",
      args: ["install", "-U", "yt-dlp"],
      timeoutMs: 120000,
    });
  }

  // Estrategia F: pipx upgrade (también como fallback para pip/unknown)
  if (installMethod.method === "pipx" || installMethod.method === "pip" || installMethod.method === "unknown") {
    strategies.push({
      name: "pipx upgrade yt-dlp",
      cmd: "pipx",
      args: ["upgrade", "yt-dlp"],
      timeoutMs: 60000,
    });
  }

  // Estrategia G: brew upgrade (macOS/Linux)
  if (installMethod.method === "brew" || installMethod.method === "unknown") {
    strategies.push({
      name: "brew upgrade yt-dlp",
      cmd: "brew",
      args: ["upgrade", "yt-dlp"],
      timeoutMs: 120000,
    });
  }

  // Estrategia H: apt install (Debian/Ubuntu)
  if (installMethod.method === "apt" || installMethod.method === "unknown") {
    if (process.platform === "linux") {
      strategies.push({
        name: "apt install --only-upgrade yt-dlp",
        cmd: "apt",
        args: ["install", "--only-upgrade", "-y", "yt-dlp"],
        timeoutMs: 120000,
      });
    }
  }

  // Estrategia I: conda
  if (installMethod.method === "conda" || installMethod.method === "unknown") {
    strategies.push({
      name: "conda update yt-dlp",
      cmd: "conda",
      args: ["update", "-y", "yt-dlp"],
      timeoutMs: 120000,
    });
  }

  // Estrategia J: pip --break-system-packages (Python 3.11+ pip 23.1+, para PEP 668)
  strategies.push({
    name: "pip install --break-system-packages -U yt-dlp",
    cmd: "pip",
    args: ["install", "--break-system-packages", "-U", "yt-dlp"],
    timeoutMs: 120000,
  });

  // Estrategia K: pip --user universal (ultimo recurso)
  strategies.push({
    name: "pip install --user -U yt-dlp (fallback)",
    cmd: "pip",
    args: ["install", "-U", "--user", "yt-dlp"],
    timeoutMs: 120000,
  });

  return strategies;
}

// ---------- UPDATE PRINCIPAL ----------

// Actualiza yt-dlp probando automaticamente todas las estrategias disponibles.
//   force=true: ignora el intervalo semanal.
//   Devuelve: { ok, updated, upToDate, skipped, method, code, error, version, message, permissionDenied, strategiesTried, installMethod }
export function updateYtdlp({ force = false, timeoutMs = 180000 } = {}) {
  return new Promise(async (resolve) => {
    if (!force && !shouldAutoUpdateYtdlp()) {
      const st = readUpdateState();
      return resolve({ ok: true, skipped: true, reason: "interval", version: getYtdlpVersion(), ...st });
    }

    const st = readUpdateState();
    st.lastAttempt = Date.now();
    st.attempts = (st.attempts || 0) + 1;

    // Detectar método de instalación
    const installMethod = detectYtdlpInstallMethod();
    st.installMethod = installMethod.method;
    writeUpdateState(st);

    const strategies = getUpdateStrategies(installMethod);
    const tried = [];

    for (const s of strategies) {
      if (Date.now() - st.lastAttempt > timeoutMs) {
        tried.push({ name: s.name, skipped: true, reason: "global timeout" });
        break;
      }
      const r = await runCommand(s.cmd, s.args, s.timeoutMs);
      const all = (r.out + r.err).trim();
      tried.push({ name: s.name, code: r.code, out: all.slice(0, 200), killed: r.killed });

      const updated = /updated to/i.test(all);
      const upToDate = /up.to.date|already up to date/i.test(all);
      const installed = /successfully installed/i.test(all);
      const requirementSat = /requirement already satisfied/i.test(all);
      const permissionDenied = /permission denied|EACCES|EPERM|not writable|read.?only|administrator|externally.managed/i.test(all) && !/--user/i.test(s.name) && !/--break-system-packages/i.test(s.name);
      const isYtdlpU = s.name === "yt-dlp -U";
      const pipWarningInstalled = /installed.*(?:with|by)\s+pip|use.*pip|from pypi/i.test(all);

      // Éxito real: code 0 Y una señal clara de actualización/instalación.
      if (r.code === 0 && (updated || upToDate || installed || requirementSat)) {
        st.lastSuccess = Date.now();
        st.successes = (st.successes || 0) + 1;
        st.lastError = null;
        st.lastVersion = getYtdlpVersion();
        st.installMethod = installMethod.method;
        writeUpdateState(st);
        return resolve({
          ok: true,
          updated: updated || installed,
          upToDate: upToDate || requirementSat,
          skipped: false,
          method: s.name,
          code: r.code,
          error: null,
          version: st.lastVersion,
          message: (r.out || r.err || "").slice(0, 500),
          permissionDenied: false,
          strategiesTried: tried,
          installMethod: installMethod.method,
        });
      }

      // Code 0 pero sin señal clara:
      //   - `yt-dlp -U` con pip-install da code 0 pero NO actualiza (solo avisa).
      //     En ese caso NO es éxito: continuamos probando estrategias pip.
      //   - Otros comandos con code 0 y sin señal: lo tratamos como éxito
      //     (puede ser un mensaje de pip no reconocido pero la instalación funcionó).
      if (r.code === 0) {
        if (isYtdlpU && pipWarningInstalled) {
          // Falso positivo: yt-dlp -U solo advirtió "usá pip para actualizar".
          // No actualizó nada → probamos la siguiente estrategia.
          continue;
        }
        st.lastSuccess = Date.now();
        st.successes = (st.successes || 0) + 1;
        st.lastError = null;
        st.lastVersion = getYtdlpVersion();
        writeUpdateState(st);
        return resolve({
          ok: true,
          updated: true,
          upToDate: false,
          skipped: false,
          method: s.name,
          code: r.code,
          error: null,
          version: st.lastVersion,
          message: (r.out || r.err || "").slice(0, 500),
          permissionDenied: false,
          strategiesTried: tried,
          installMethod: installMethod.method,
        });
      }

      // Si falló por permisos (sin --user), continuamos con la siguiente estrategia
      if (permissionDenied) {
        continue;
      }

      // La estrategia falló por otra razón. Si no es la última, probamos la
      // siguiente (antes este código solo reportaba si era la última y dejaba
      // caer al fallback de "ninguna estrategia").
      if (s !== strategies[strategies.length - 1]) {
        continue;
      }

      // Es la última estrategia y también falló: reportamos error.
      const msg = all || "todas las estrategias de actualización fallaron";
      st.lastError = msg.slice(0, 500);
      writeUpdateState(st);
      return resolve({
        ok: false,
        updated: false,
        upToDate: false,
        skipped: false,
        method: s.name,
        code: r.code,
        error: msg,
        version: getYtdlpVersion(),
        permissionDenied: false,
        strategiesTried: tried,
        installMethod: installMethod.method,
      });
    }

    // No debería llegar aquí (el loop siempre resuelve), pero por si acaso:
    const msg = "no se pudo actualizar yt-dlp con ninguna estrategia";
    st.lastError = msg;
    writeUpdateState(st);
    resolve({
      ok: false,
      updated: false,
      code: -1,
      error: msg,
      version: getYtdlpVersion(),
      permissionDenied: false,
      strategiesTried: tried,
      installMethod: installMethod.method,
    });
  });
}

// ¿El archivo tiene una pista de VIDEO real (no solo audio ni una caratula)?
// Usa ffprobe. Distingue un .webm/.mp4 con imagen en movimiento de uno que solo
// trae una caratula embebida (esos aparecen como video con 1 frame / "attached_pic").
// Cacheado en memoria por ruta+mtime para no relanzar ffprobe en cada listado.
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
      "-v", "error",
      "-select_streams", "v",
      "-show_entries", "stream=codec_type,disposition=attached_pic,avg_frame_rate",
      "-of", "json", filePath,
    ], { encoding: "utf8", timeout: 8000 });
    if (r.status === 0 && r.stdout) {
      const data = JSON.parse(r.stdout);
      for (const s of data.streams || []) {
        if (s.codec_type !== "video") continue;
        // Ignorar caratulas (attached_pic) y streams sin frame rate (imagen fija).
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

// Carpeta de descargas por defecto.
export function defaultDownloadDir() {
  const home = os.homedir();
  // Reutilizamos la carpeta de musica habitual del SO.
  const candidates = isWin
    ? [path.join(home, "Music", "RhythmDance")]
    : [path.join(home, "Music", "RhythmDance"), path.join(home, "Música", "RhythmDance")];
  return candidates[0];
}
