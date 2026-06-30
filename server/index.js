// index.js
// Servidor del motor. Corre en tu PC (Windows / Linux / macOS). Responsabilidades:
//   - Servir el frontend (build de Vite en /dist).
//   - Listar/gestionar carpetas de musica.
//   - Servir el audio (streaming) para reproducirlo en el navegador.
//   - Generar la pista (beatmap) sincronizada al ritmo y cachearla.
//   - Buscar y descargar musica con yt-dlp.
//   - Hospedar el servidor de salas (modo VS online) por WebSocket.

import express from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { listSongs, getFolders, addFolder, removeFolder, setExclusiveFolder, resolveSongPath, resolveVideoPath, deleteSong, getConfigFlag, setConfigFlag } from "./library.js";
import { decodeToPCM } from "./decode.js";
import { search, downloadAudio } from "./downloader.js";
import { toolStatus, defaultDownloadDir, FFMPEG, YTDLP, getYtdlpVersion, getYtdlpUpdateState, shouldAutoUpdateYtdlp, updateYtdlp, ensureYtdlp, AUTO_UPDATE_INTERVAL_DAYS } from "./tools.js";
import { attachRoomServer } from "./rooms.js";
import { startTunnel, getTunnelUrl, stopTunnel } from "./tunnel.js";
import { parseStepfile, findStepfileFor, parseUCS, findUcsFor } from "./smparser.js";
import { scheduleStepRetrain, getStepTrainStatus } from "./trainStep.js";
import { getSongNps, setSongNps, getSongSettings, recordScore, getScore, getAllScores, saveCustomChart, getCustomChart, deleteCustomChart, hasCustomChart, exportData, importData, purgeSongData } from "./songsettings.js";
import { getProfile, setDisplayName, setPublicAlias, recordPlay, markDailyCompleted, getPublicName } from "./user.js";
import { evaluate, getAllForUser, countUnlocked } from "./achievements.js";
import { getTodaysChallenge, getDailyLeaderboard, submitDailyScore, getMyDailyBest } from "./daily.js";
import { saveReplay, listReplays, getReplay, deleteReplay, getBestReplay } from "./replays.js";
import { getLeaderboard as getGlobalLeaderboard, submitScore as submitGlobalScore } from "./leaderboard.js";
import { inputEnvironment } from "./inputenv.js";
import { computeFingerprint, buildPackage, serializePackage, parsePackage, validatePackage, filterEntries, indexEntryFromPackage, computePackageId } from "./community.js";
import { readSongMeta } from "./meta.js";
import { fetchPackageFile, publishPackage } from "./githubClient.js";
import { syncCatalog, getCatalog, entriesForFingerprint, catalogStatus, syncCatalogOnStartup } from "./communityCatalog.js";
import { probeDuration } from "./decode.js";
import { generateBeatmap } from "./generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 5174;

const CACHE_DIR = path.join(os.homedir(), ".rhythm-dance", "charts");
fs.mkdirSync(CACHE_DIR, { recursive: true });

const COVER_DIR = path.join(os.homedir(), ".rhythm-dance", "covers");
fs.mkdirSync(COVER_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "50mb" }));   // respaldos con muchos charts pueden ser grandes

// Identidad por usuario via header X-User-Id. Si no viene, generamos uno
// nuevo (modo anonimo). Asi cada cliente tiene su perfil independiente.
app.use((req, res, next) => {
  let uid = req.headers["x-user-id"];
  if (uid) uid = String(uid).slice(0, 64);
  if (!uid) uid = "anon-" + Math.random().toString(36).slice(2, 10);
  req.userId = uid;
  next();
});

// ---------- Frontend ----------
const distDir = path.join(ROOT, "dist");
const hasBuild = fs.existsSync(path.join(distDir, "index.html"));
if (hasBuild) app.use(express.static(distDir));
else app.use(express.static(ROOT, { index: false }));

// ---------- API: estado de herramientas ----------
app.get("/api/status", (req, res) => {
  res.json({
    tools: toolStatus(),
    downloadDir: defaultDownloadDir(),
    ytdlp: getYtdlpUpdateState(),
  });
});

// Estado de yt-dlp (version + ultimo intento de actualizacion).
app.get("/api/tools/ytdlp", (req, res) => {
  res.json(getYtdlpUpdateState());
});

// Estado del reentrenamiento del modelo de step-selection (para el aviso de UI
// "aprendiendo tu estilo..."). state: idle | scheduled | training.
app.get("/api/tools/stepmodel-status", (req, res) => {
  try { res.json(getStepTrainStatus()); }
  catch (_) { res.json({ state: "idle" }); }
});

// Actualiza yt-dlp a la ultima version (`yt-dlp -U`). Pensado para ser
// llamado:
//   - manualmente desde Opciones (boton "Actualizar yt-dlp")
//   - automaticamente desde el frontend cuando una descarga falla con un
//     error que parece de extractor desactualizado.
// El primer arranque del juego dispara una version en background si pasaron
// 7+ dias desde la ultima verificacion (ver listen abajo).
app.post("/api/tools/update-ytdlp", async (req, res) => {
  const force = !!(req.body && req.body.force);
  const r = await updateYtdlp({ force });
  res.json(r);
});

// Entorno de ENTRADA: detecta el bug de Linux/Xorg con dos teclados (lag) para
// avisar al usuario antes de un VS local con dos teclados.
app.get("/api/inputenv", (req, res) => {
  try { res.json(inputEnvironment()); }
  catch (e) { res.json({ os: process.platform, twoKeyboardLagRisk: false, error: e.message }); }
});

// Preferencia de FPS desbloqueados (sin vsync). Se persiste en config.json
// porque el proceso de Electron la lee AL ARRANCAR (los switches de vsync no
// se pueden cambiar en caliente). Cambiarla requiere reiniciar la app.
app.get("/api/unlockfps", (req, res) => res.json({ unlockFps: getConfigFlag("unlockFps") === true }));
app.post("/api/unlockfps", (req, res) => {
  const val = !!(req.body && req.body.unlockFps);
  setConfigFlag("unlockFps", val);
  res.json({ ok: true, unlockFps: val, restartRequired: true });
});

// ---------- API: tunel publico (modo online facil) ----------
// Inicia un enlace publico que el host comparte con su amigo. El amigo lo abre
// en su navegador y entra directo a la partida (usa las canciones del host).
app.post("/api/tunnel", async (req, res) => {
  try {
    const { url } = await startTunnel(PORT);
    // La "contrasena" del aviso de localtunnel es la IP publica del host.
    let publicIp = "";
    try {
      const r = await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(4000) });
      publicIp = (await r.text()).trim();
    } catch (_) {}
    res.json({ ok: true, url, publicIp });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/tunnel", (req, res) => res.json({ url: getTunnelUrl() }));
app.delete("/api/tunnel", (req, res) => { stopTunnel(); res.json({ ok: true }); });

// ---------- API: carpetas ----------
app.get("/api/folders", (req, res) => res.json({ folders: getFolders() }));
app.post("/api/folders", (req, res) => {
  try {
    if (req.body.exclusive) {
      // Usar SOLO esta carpeta.
      const f = setExclusiveFolder(req.body.path || "");
      return res.json({ ok: true, folder: f, exclusive: true });
    }
    // Agregar (y salir del modo exclusivo si estaba activo).
    setExclusiveFolder(null);
    res.json({ ok: true, folder: addFolder(req.body.path || "") });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});
app.delete("/api/folders", (req, res) => {
  removeFolder(req.body.path || "");
  res.json({ ok: true });
});

// ---- Selección de carpeta de descargas ----
// Carpeta donde se guardan las canciones descargadas. Persistida en config.
// Si no se ha elegido, usa defaultDownloadDir() (~/Music/RhythmDance).
function currentDownloadDir() {
  const saved = getConfigFlag("downloadDir");
  return (saved && String(saved)) || defaultDownloadDir();
}
app.get("/api/download-dir", (req, res) => res.json({ dir: currentDownloadDir() }));
app.post("/api/download-dir", (req, res) => {
  try {
    const p = String(req.body.path || "").trim();
    if (!p) throw new Error("Falta la ruta");
    fs.mkdirSync(p, { recursive: true });
    setConfigFlag("downloadDir", p);
    try { addFolder(p); } catch (_) {}   // que aparezca en la biblioteca
    res.json({ ok: true, dir: p });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

// Navegador de carpetas portable (funciona en PC y, vía el backend nativo,
// tambien en Android). Lista subcarpetas de 'path' para elegir destino sin
// depender del diálogo nativo de Electron.
app.get("/api/browse", (req, res) => {
  try {
    let p = String(req.query.path || "").trim();
    if (!p) p = os.homedir();
    p = path.resolve(p);
    const st = fs.statSync(p);
    if (!st.isDirectory()) p = path.dirname(p);
    let entries = [];
    try {
      entries = fs.readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, path: path.join(p, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (_) { entries = []; }
    const parent = path.dirname(p);
    res.json({ path: p, parent: parent === p ? null : parent, home: os.homedir(), dirs: entries });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- API: canciones ----------
app.get("/api/songs", (req, res) => res.json({ songs: listSongs() }));

// Elimina una cancion de la biblioteca: archivo de audio + (opcionalmente)
// video de fondo y stepchart que vivan junto a el. Tambien limpia los
// datos persistidos (puntaje maximo, chart del editor, ajustes NPS) y
// los beatmaps cacheados en disco para que la cancion no vuelva a
// aparecer como "fantasma" tras el borrado.
app.delete("/api/songs/:id", (req, res) => {
  const withVideo = req.body && req.body.withVideo !== false;   // default true
  const withChart = req.body && req.body.withChart !== false;   // default true
  const game = String((req.body && req.body.game) || "dance");

  const del = deleteSong(req.params.id, { withVideo, withChart });
  if (!del) return res.status(404).json({ ok: false, error: "Cancion no encontrada o ruta no permitida" });

  const purged = purgeSongData(req.params.id, game);
  const clearedCharts = clearCachedChartsForSong(req.params.id);

  res.json({ ok: true, deleted: del, purged, clearedCharts });
});

// Recorre el cache de beatmaps y borra los que correspondan a esta cancion.
// La clave del cache incluye el path + size + mtime, asi que la unica forma
// fiable de saber si un .json cacheado es de esta cancion es parsearlo y
// ver su campo "id" (que es el songId = base64url del path).
function clearCachedChartsForSong(songId) {
  if (!fs.existsSync(CACHE_DIR)) return 0;
  let count = 0;
  for (const f of fs.readdirSync(CACHE_DIR)) {
    if (!f.endsWith(".json")) continue;
    const full = path.join(CACHE_DIR, f);
    try {
      const j = JSON.parse(fs.readFileSync(full, "utf8"));
      if (j && j.id === songId) {
        fs.unlinkSync(full);
        count++;
      }
    } catch (_) { /* archivo corrupto, lo dejamos */ }
  }
  return count;
}

// Devuelve que datos persistidos hay para una cancion (sin revelar contenido).
// Usado por el dialogo de confirmacion de borrado para que el usuario sepa
// que perdera su record o sus charts del editor.
app.get("/api/songs/:id/datasummary", (req, res) => {
  const songId = req.params.id;
  if (!resolveSongPath(songId)) return res.status(404).json({ error: "no encontrada" });
  const game = String(req.query.game || "dance");
  const score = getScore(songId, game);
  const settings = getSongSettings(songId, game);
  // Custom charts: songsettings expone hasCustomChart + getCustomChart por
  // (dificultad, lanes); aqui queremos el conteo total de claves.
  const data = requireSongDataRaw();
  const ck = (game === "dance") ? songId : `${game}::${songId}`;
  const customMap = (data && data.customCharts && data.customCharts[ck]) || null;
  const customChartCount = customMap ? Object.keys(customMap).length : 0;
  res.json({
    hasScores: !!score,
    hasSettings: !!settings,
    hasCustomCharts: customChartCount > 0,
    customChartCount,
  });
});

// Acceso de SOLO LECTURA al songdata.json crudo. Lo necesita datasummary para
// contar charts del editor (songsettings no expone ese conteo).
function requireSongDataRaw() {
  try {
    const raw = fs.readFileSync(path.join(os.homedir(), ".rhythm-dance", "songdata.json"), "utf8");
    return JSON.parse(raw);
  } catch { return null; }
}

// Streaming de audio con soporte Range.
app.get("/api/audio/:id", (req, res) => {
  const filePath = resolveSongPath(req.params.id);
  if (!filePath) return res.status(404).end("No encontrado");
  streamFile(filePath, req, res);
});

// Streaming del VIDEO de fondo (si la cancion tiene uno con el mismo nombre).
// 404 si no hay video; el frontend simplemente no lo muestra en ese caso.
app.get("/api/video/:id", (req, res) => {
  const filePath = resolveVideoPath(req.params.id);
  if (!filePath) return res.status(404).end("Sin video");
  // Forzar un MIME de video (algunos contenedores .webm/.mkv se detectarian
  // como audio; el elemento <video> necesita un tipo video/*).
  streamFile(filePath, req, res, videoMime(filePath));
});

// MIME de video por extension (para el elemento <video> del navegador).
function videoMime(file) {
  const ext = path.extname(file).toLowerCase();
  return { ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm",
    ".mkv": "video/webm", ".mov": "video/quicktime" }[ext] || "video/mp4";
}

// Streaming de un archivo con soporte de Range (para audio y video).
// mimeOverride permite forzar el Content-Type (p.ej. video/* para fondos).
function streamFile(filePath, req, res, mimeOverride) {
  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  const type = mimeOverride || guessMime(filePath);
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Content-Type": type,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Length": stat.size, "Content-Type": type, "Accept-Ranges": "bytes" });
    fs.createReadStream(filePath).pipe(res);
  }
}

// Caratula de la cancion (arte embebido en el archivo, si lo tiene).
// Se extrae con ffmpeg una sola vez y se cachea. Si no hay arte embebido,
// responde 204 (el frontend muestra un arte procedural en su lugar).
app.get("/api/cover/:id", (req, res) => {
  const filePath = resolveSongPath(req.params.id);
  if (!filePath) return res.status(404).end();
  const stat = fs.statSync(filePath);
  const key = crypto.createHash("sha1").update(`${filePath}:${stat.size}:${stat.mtimeMs}`).digest("hex");
  const out = path.join(COVER_DIR, key + ".jpg");
  const miss = path.join(COVER_DIR, key + ".none");

  // Ya extraida antes.
  if (fs.existsSync(out)) return res.sendFile(out);
  // Ya sabemos que NO tiene arte embebido (evita reintentar con ffmpeg).
  if (fs.existsSync(miss)) return res.status(204).end();

  // Extraer el stream de imagen embebido (si existe) y reescalar a 256px.
  const args = ["-y", "-i", filePath, "-an", "-vframes", "1",
    "-vf", "scale=256:256:force_original_aspect_ratio=increase,crop=256:256", out];
  const ff = spawn(FFMPEG, args, { stdio: "ignore" });
  ff.on("error", () => { try { fs.writeFileSync(miss, ""); } catch (_) {} res.status(204).end(); });
  ff.on("close", (code) => {
    if (code === 0 && fs.existsSync(out) && fs.statSync(out).size > 0) {
      res.sendFile(out);
    } else {
      try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (_) {}
      try { fs.writeFileSync(miss, ""); } catch (_) {}
      res.status(204).end();
    }
  });
});

// Construye (o recupera de cache) el beatmap de una cancion. Reporta etapas de
// progreso por onProgress(p, label). Compartido por el endpoint JSON normal y
// por el endpoint con progreso SSE.
async function buildChart(id, { difficulty, laneCount, genre, game = "dance", forceGenerate = false, onProgress = () => {} }) {
  const filePath = resolveSongPath(id);
  if (!filePath) { const e = new Error("Cancion no encontrada"); e.code = 404; throw e; }
  const npsOverride = getSongNps(id, difficulty, game);
  const stat = fs.statSync(filePath);
  const key = crypto.createHash("sha1")
    .update(`${filePath}:${stat.size}:${stat.mtimeMs}:${game}:${difficulty}:${laneCount}:${genre}:nps${npsOverride || 0}`)
    .digest("hex");
  const cacheFile = path.join(CACHE_DIR, key + ".json");

  // Chart del EDITOR (por juego Y por numero de carriles). Un mapeo de 4 flechas
  // y uno de 5 paneles de la misma cancion son independientes.
  // forceGenerate=true: el usuario pidio EXPRESAMENTE la pista generada por IA,
  // asi que ignoramos el chart del editor y los stepcharts reales.
  const custom = forceGenerate ? null : getCustomChart(id, difficulty, game, laneCount);
  const customMatches = !!(custom && custom.notes && custom.notes.length &&
    (custom.laneCount || laneCount) === laneCount);

  // Cache: si NO hay chart del editor aplicable, podemos servir/guardar cache.
  if (!customMatches && fs.existsSync(cacheFile)) {
    onProgress(1.0, "Pista en cache");
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }

  // 0) CHART PERSONALIZADO del editor (maxima prioridad si coincide el estilo).
  let beatmap = null;
  if (customMatches) {
    beatmap = {
      bpm: custom.bpm || 120, offset: 0, duration: custom.duration || 0,
      laneCount: custom.laneCount || laneCount, notes: custom.notes, fromEditor: true,
    };
    console.log(`Usando chart del EDITOR: ${path.basename(filePath)} [${difficulty}] (${custom.notes.length} notas)`);
  }

  // 1) Stepchart real junto al audio (.sm/.ssc StepMania o .ucs Pump It Up).
  // Con forceGenerate, tambien se ignoran (el usuario quiere la pista de IA).
  const stepPath = (beatmap || forceGenerate) ? null : findStepfileFor(filePath);
  const ucsPath = (beatmap || forceGenerate || stepPath) ? null : findUcsFor(filePath);
  if (stepPath) {
    try {
      const prefMap = { easy: "Easy", normal: "Normal", ritmo: "Hard", hard: "Hard", expert: "Expert", locura: "Challenge" };
      beatmap = parseStepfile(stepPath, { laneCount, preferDifficulty: prefMap[difficulty] || "Hard" });
      if (beatmap) console.log(`Usando stepchart real: ${path.basename(stepPath)} (${beatmap.notes.length} notas, ${beatmap.meta.difficulty})`);
    } catch (e) { console.warn("No se pudo leer el stepfile, autogenerando:", e.message); beatmap = null; }
  } else if (ucsPath) {
    try {
      beatmap = parseUCS(ucsPath, { laneCount });
      if (beatmap) console.log(`Usando chart UCS (Pump It Up): ${path.basename(ucsPath)} (${beatmap.notes.length} notas)`);
    } catch (e) { console.warn("No se pudo leer el UCS, autogenerando:", e.message); beatmap = null; }
  }

  // 2) Autogenerar a partir del audio.
  if (!beatmap) {
    console.log(`Generando pista: ${path.basename(filePath)} [${difficulty}, ${laneCount}p, ${genre}]`);
    onProgress(0.05, "Decodificando audio");
    const { samples, sampleRate } = await decodeToPCM(filePath, 44100);
    beatmap = generateBeatmap(samples, sampleRate, {
      difficulty, laneCount, genre, npsOverride,
      onProgress: (p, label) => { process.stdout.write(`\r  ${label} ${Math.round(p * 100)}%   `); onProgress(0.1 + p * 0.88, label); },
    });
    process.stdout.write("\n");
  } else {
    onProgress(0.9, "Cargando mapeo");
  }

  beatmap.id = id;
  beatmap.difficulty = difficulty;
  beatmap.songHash = crypto.createHash("sha1")
    .update(`${Math.round((beatmap.duration || 0) * 10)}:${beatmap.bpm}:${beatmap.notes.length}:${laneCount}`)
    .digest("hex").slice(0, 16);

  if (!customMatches) fs.writeFileSync(cacheFile, JSON.stringify(beatmap));
  onProgress(1.0, "Pista lista");
  return beatmap;
}

// Genera (o recupera de cache) la pista sincronizada al ritmo.
app.get("/api/chart/:id", async (req, res) => {
  try {
    const beatmap = await buildChart(req.params.id, {
      difficulty: String(req.query.difficulty || "normal"),
      laneCount: req.query.lanes === "4" ? 4 : 5,
      genre: String(req.query.genre || "auto"),
      game: String(req.query.game || "dance"),
      forceGenerate: req.query.forceGenerate === "1" || req.query.forceGenerate === "true",
    });
    res.json(beatmap);
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: e.message });
    console.error("Error generando pista:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// Igual que /api/chart pero con PROGRESO en vivo via Server-Sent Events.
// Eventos: {type:"progress", percent, label} y al final {type:"done", beatmap}
// o {type:"error", message}. El frontend lo usa para la pantalla de carga.
app.get("/api/chart-progress/:id", async (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  let lastSent = 0;
  try {
    const beatmap = await buildChart(req.params.id, {
      difficulty: String(req.query.difficulty || "normal"),
      laneCount: req.query.lanes === "4" ? 4 : 5,
      genre: String(req.query.genre || "auto"),
      game: String(req.query.game || "dance"),
      forceGenerate: req.query.forceGenerate === "1" || req.query.forceGenerate === "true",
      onProgress: (p, label) => {
        // Limitar la frecuencia de envio (evita saturar con muchos eventos).
        const now = Date.now();
        if (p >= 1 || now - lastSent > 80) { lastSent = now; sse({ type: "progress", percent: Math.round(p * 100), label }); }
      },
    });
    sse({ type: "done", beatmap });
  } catch (e) {
    sse({ type: "error", message: e.message });
  } finally {
    res.end();
  }
});

// ---------- API: ajustes por cancion (densidad) ----------
app.get("/api/songsettings/:id", (req, res) => {
  const game = String(req.query.game || "dance");
  res.json({ settings: getSongSettings(req.params.id, game), score: getScore(req.params.id, game) });
});
app.post("/api/songsettings/:id", (req, res) => {
  const { difficulty, nps, game } = req.body || {};
  if (!difficulty) return res.status(400).json({ error: "falta difficulty" });
  const s = setSongNps(req.params.id, difficulty, nps == null ? null : Number(nps), game || "dance");
  res.json({ ok: true, settings: s });
});

// ---------- API: puntajes ----------
app.get("/api/scores", (req, res) => res.json({ scores: getAllScores(String(req.query.game || "dance")) }));
app.post("/api/score/:id", async (req, res) => {
  const { name, score, accuracy, grade, difficulty, maxCombo, game, duration, failed, counts, total, songName, mods, gameMode, songHash, perfectStreak, isDaily } = req.body || {};
  const gm = game || "dance";
  const entry = recordScore(req.params.id, name, { score, accuracy, grade, difficulty, maxCombo }, gm);

  // F11/F12/F13/F17: registrar partida en perfil, evaluar logros, daily, leaderboard global.
  // Esto se hace en background (no bloquea la respuesta) para que el cliente reciba
  // el score al instante. Si algo falla (logros, leaderboard), el score se guarda igual.
  const event = {
    songId: req.params.id,
    songName: songName || name || "",
    score, accuracy, grade, maxCombo,
    counts: counts || { PERFECT: 0, GREAT: 0, GOOD: 0, OK: 0, MISS: 0 },
    total: total || 0,
    duration: duration || 0,
    difficulty: difficulty || "normal",
    game: gm,
    failed: !!failed,
    mods: mods || {},
    gameMode: gameMode || "score",
    perfectStreak: perfectStreak || 0,
  };
  let newlyUnlocked = [];
  let dailyResult = null;
  let leaderboardResult = null;
  try {
    recordPlay(req.userId, event);
    const evalResult = evaluate(req.userId, event);
    newlyUnlocked = evalResult.newlyUnlocked;
  } catch (e) { console.warn("recordPlay/evaluate error:", e.message); }
  try {
    if (isDaily && !failed) {
      const dr = markDailyCompleted(req.userId);
      const ds = submitDailyScore(req.userId, name || "anon", score, accuracy, maxCombo, grade);
      dailyResult = { ...dr, rank: ds.rank, total: ds.total };
    }
  } catch (e) { console.warn("daily error:", e.message); }
  try {
    if (songHash && !failed) {
      const profile = getProfile(req.userId);
      leaderboardResult = await submitGlobalScore({
        userId: req.userId,
        userName: profile.displayName,
        songId: req.params.id,
        songName: songName || "",
        songHash,
        score, accuracy, grade, maxCombo,
      });
    }
  } catch (e) { console.warn("leaderboard error:", e.message); }

  res.json({ ok: true, entry, newlyUnlocked, dailyResult, leaderboardResult });
});

// ---------- API: charts del editor ----------
// Obtener un chart del editor existente (para EDITARLO). Devuelve {chart} o null.
app.get("/api/customchart/:id", (req, res) => {
  const difficulty = String(req.query.difficulty || "normal");
  const game = String(req.query.game || "dance");
  const lanes = req.query.lanes === "4" ? 4 : 5;
  const chart = getCustomChart(req.params.id, difficulty, game, lanes);
  res.json({ chart: chart || null });
});
app.post("/api/customchart/:id", (req, res) => {
  const { difficulty, chart, game } = req.body || {};
  if (!difficulty || !chart || !Array.isArray(chart.notes)) return res.status(400).json({ error: "datos invalidos" });
  saveCustomChart(req.params.id, difficulty, chart, game || "dance");
  // Reentrenar el modelo de step-selection con tu nuevo chart (segundo plano,
  // con debounce). Asi el mapeo automatico aprende tu estilo solo.
  try { scheduleStepRetrain(); } catch (_) {}
  res.json({ ok: true, notes: chart.notes.length });
});
app.delete("/api/customchart/:id", (req, res) => {
  const b = req.body || {};
  deleteCustomChart(req.params.id, b.difficulty || "normal", b.game || "dance", b.lanes);
  res.json({ ok: true });
});

// ---------- API: perfil del usuario (F11) ----------
app.get("/api/profile", (req, res) => {
  const p = getProfile(req.userId);
  res.json({ profile: p, publicName: getPublicName(p), userId: req.userId });
});
app.post("/api/profile", (req, res) => {
  const { displayName, publicAlias } = req.body || {};
  let p = getProfile(req.userId);
  if (displayName != null) p = setDisplayName(req.userId, displayName);
  if (publicAlias !== undefined) p = setPublicAlias(req.userId, publicAlias);
  res.json({ ok: true, profile: p, publicName: getPublicName(p) });
});

// ---------- API: logros (F12) ----------
app.get("/api/achievements", (req, res) => {
  res.json({ achievements: getAllForUser(req.userId), unlocked: countUnlocked(req.userId) });
});

// ---------- API: desafio diario (F13) ----------
app.get("/api/daily", (req, res) => {
  const challenge = getTodaysChallenge();
  if (!challenge || challenge.error) return res.json({ ok: false, error: challenge ? challenge.error : "sin_canciones" });
  const leaderboard = getDailyLeaderboard(challenge.date, 20);
  const myBest = getMyDailyBest(req.userId);
  res.json({ ok: true, challenge, leaderboard, myBest, date: challenge.date });
});

// ---------- API: leaderboard global (F17) ----------
app.get("/api/leaderboard/:songHash", async (req, res) => {
  try {
    const lb = await getGlobalLeaderboard(req.params.songHash);
    res.json({ ok: true, leaderboard: lb });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.post("/api/leaderboard/submit", async (req, res) => {
  const { songHash, songId, songName, score, accuracy, grade, maxCombo } = req.body || {};
  if (!songHash) return res.status(400).json({ ok: false, error: "falta songHash" });
  const profile = getProfile(req.userId);
  try {
    const r = await submitGlobalScore({
      userId: req.userId,
      userName: profile.displayName,
      songId, songName, songHash, score, accuracy, grade, maxCombo,
    });
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------- API: replays (F16) ----------
app.post("/api/replays", (req, res) => {
  const profile = getProfile(req.userId);
  if (req.body && req.body.userName == null) req.body.userName = profile.displayName;
  if (req.body && !req.body.userId) req.body.userId = req.userId;
  const r = saveReplay(req.userId, req.body || {});
  if (r.error) return res.status(400).json({ ok: false, error: r.error });
  res.json({ ok: true, id: r.id, size: r.size });
});
app.get("/api/replays", (req, res) => {
  const opts = {};
  if (req.query.songId) opts.songId = String(req.query.songId);
  if (req.query.gameMode) opts.gameMode = String(req.query.gameMode);
  if (req.query.limit) opts.limit = Number(req.query.limit);
  res.json({ replays: listReplays(req.userId, opts) });
});
app.get("/api/replay/:id", (req, res) => {
  const r = getReplay(req.userId, req.params.id);
  if (!r) return res.status(404).json({ ok: false, error: "no encontrado" });
  res.json({ ok: true, replay: r });
});
app.delete("/api/replay/:id", (req, res) => {
  const ok = deleteReplay(req.userId, req.params.id);
  res.json({ ok });
});
// F18: mejor replay (fantasma) del usuario para una cancion+dificultad.
app.get("/api/replay/best", (req, res) => {
  const songId = String(req.query.songId || "");
  const difficulty = req.query.difficulty ? String(req.query.difficulty) : null;
  if (!songId) return res.status(400).json({ ok: false, error: "Falta songId" });
  const r = getBestReplay(req.userId, songId, difficulty);
  if (!r) return res.status(404).json({ ok: false, error: "sin_fantasma" });
  res.json({ ok: true, replay: r });
});

// ---------- API: respaldo (asegurar pistas grabadas + puntajes) ----------
// Exporta TODO (charts del editor, puntajes y ajustes NPS) como descarga JSON.
// Asi el usuario guarda una copia de seguridad y no pierde sus pistas grabadas.
app.get("/api/backup", (req, res) => {
  const data = exportData();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="rhythm-dance-backup-${stamp}.json"`);
  res.send(JSON.stringify(data, null, 2));
});
// Restaura un respaldo. Body: el JSON exportado + opcional { mode: "merge"|"replace" }.
app.post("/api/backup/restore", (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.mode === "replace" ? "replace" : "merge";
    const payload = body.payload || body;   // acepta el JSON directo o envuelto
    const summary = importData(payload, mode);
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- API: descargador ----------
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results: [] });
  try { res.json({ results: await search(q, 12) }); }
  catch (e) {
    const payload = { error: e.message };
    if (e.ytdlpUpdateRecommended) payload.ytdlpUpdateRecommended = true;
    res.status(500).json(payload);
  }
});

// Descarga con progreso via Server-Sent Events.
app.get("/api/download", async (req, res) => {
  const url = String(req.query.url || "");
  const folder = String(req.query.folder || currentDownloadDir());
  const withVideo = req.query.video === "1" || req.query.video === "true";
  const format = String(req.query.format || "mp3");
  if (!url) return res.status(400).end("Falta url");

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    // Asegurar que la carpeta de descargas este en la biblioteca
    try { addFolder(folder); } catch (_) {}
    const { file, video } = await downloadAudio(url, folder, (p) => sse({ type: "progress", ...p }), { video: withVideo, format });
    // Req 10: ¿la comunidad ya tiene charts para esta cancion recien descargada?
    let communityCharts = [];
    try {
      const meta = await readSongMeta(file, path.basename(file, path.extname(file)));
      if (!meta.duration) { try { meta.duration = await probeDuration(file); } catch (_) {} }
      const fp = computeFingerprint(meta);
      communityCharts = entriesForFingerprint(fp);
    } catch (_) { communityCharts = []; }
    sse({ type: "done", file, video, communityCharts });
  } catch (e) {
    const payload = { type: "error", message: e.message };
    if (e.ytdlpUpdateRecommended) payload.ytdlpUpdateRecommended = true;
    if (e.videoFailed) payload.videoFailed = e.videoFailed;   // "extractor" si solo fallo el video
    sse(payload);
  } finally {
    res.end();
  }
});

function guessMime(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/ogg",
    ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac",
    ".flac": "audio/flac", ".webm": "audio/webm",
    ".mp4": "video/mp4", ".m4v": "video/mp4", ".mkv": "video/x-matroska", ".mov": "video/quicktime",
  }[ext] || "application/octet-stream";
}

// ---------- API: charts de la comunidad ----------
// Calcula metadatos + fingerprint de una cancion local. Para el BPM usa el tag
// si existe; si no, recurre al BPM del beatmap (lo genera/recupera de cache en
// dificultad normal). La duracion viene de ffprobe (probeDuration).
async function songMetaWithFingerprint(songId, song) {
  const filePath = resolveSongPath(songId);
  if (!filePath) { const e = new Error("Cancion no encontrada"); e.code = 404; throw e; }
  const fallbackTitle = song ? song.name : null;
  const meta = await readSongMeta(filePath, fallbackTitle);
  if (!meta.duration) { try { meta.duration = await probeDuration(filePath); } catch (_) {} }
  // BPM: si el tag no lo trae, usar el del beatmap (normal, 5p) ya cacheado o recien generado.
  if (!meta.bpm) {
    try {
      const bm = await buildChart(songId, { difficulty: "normal", laneCount: 5, genre: "auto" });
      if (bm && bm.bpm) meta.bpm = bm.bpm;
      if (!meta.duration && bm && bm.duration) meta.duration = bm.duration;
    } catch (_) { /* sin bpm: el fingerprint usara 0 */ }
  }
  const fingerprint = computeFingerprint(meta);
  return { meta, fingerprint };
}

function findSongById(songId) {
  return listSongs().find((s) => s.id === songId) || null;
}

// Estado de configuracion: ¿hay token guardado? repo configurado. NUNCA el token.
app.get("/api/community/config", (req, res) => {
  res.json({
    hasToken: !!getConfigFlag("githubToken"),
    repo: getConfigFlag("communityRepo") || "tuangel134/rhythm-dance",
    branch: getConfigFlag("communityBranch") || "main",
  });
});
// Guarda token y/o repo/branch. El token se persiste en config.json y nunca se devuelve.
app.post("/api/community/config", (req, res) => {
  const { token, repo, branch } = req.body || {};
  if (token != null) setConfigFlag("githubToken", String(token).trim());
  if (repo != null) setConfigFlag("communityRepo", String(repo).trim());
  if (branch != null) setConfigFlag("communityBranch", String(branch).trim());
  res.json({ ok: true, hasToken: !!getConfigFlag("githubToken"), repo: getConfigFlag("communityRepo") || "tuangel134/rhythm-dance" });
});

// Fingerprint + metadatos de una cancion local.
app.get("/api/community/fingerprint/:id", async (req, res) => {
  try {
    const { meta, fingerprint } = await songMetaWithFingerprint(req.params.id, findSongById(req.params.id));
    res.json({ fingerprint, meta });
  } catch (e) {
    res.status(e.code === 404 ? 404 : 500).json({ error: e.message });
  }
});

// Re-sincroniza el catalogo local desde el repo (Req 9.6).
app.post("/api/community/sync", async (req, res) => {
  const r = await syncCatalog();
  res.json(r);
});
// Estado del catalogo local.
app.get("/api/community/catalog", (req, res) => res.json(catalogStatus()));

// Busqueda sobre el CATALOGO LOCAL (Req 9.5). Si esta vacio, intenta sincronizar.
app.get("/api/community/search", async (req, res) => {
  try {
    let cat = getCatalog();
    if (!cat.entries.length) { await syncCatalog(); cat = getCatalog(); }
    const filter = {
      fingerprint: req.query.fingerprint || undefined,
      game: req.query.game || undefined,
      difficulty: req.query.difficulty || undefined,
      laneCount: req.query.lanes ? Number(req.query.lanes) : undefined,
    };
    const results = filterEntries(cat.entries, filter);
    res.json({ results, syncedAt: cat.syncedAt || null });
  } catch (e) {
    res.status(503).json({ ok: false, error: "no se pudo buscar: " + e.message });
  }
});

// Charts del catalogo que coinciden con una cancion local (Req 10.1-10.3).
app.get("/api/community/available/:id", async (req, res) => {
  try {
    const { fingerprint, meta } = await songMetaWithFingerprint(req.params.id, findSongById(req.params.id));
    const entries = entriesForFingerprint(fingerprint);
    res.json({ fingerprint, meta, entries, charts: groupEntries(entries) });
  } catch (e) {
    res.status(e.code === 404 ? 404 : 500).json({ error: e.message });
  }
});

// Agrupa entradas por juego/dificultad/carriles (para mostrarlas ordenadas).
function groupEntries(entries) {
  const out = {};
  for (const e of entries) {
    const k = `${e.game}/${e.difficulty}/${e.laneCount}`;
    (out[k] = out[k] || []).push(e);
  }
  return out;
}

// Descarga + valida un package concreto (Req 5.1-5.4).
app.get("/api/community/package", async (req, res) => {
  const fingerprint = String(req.query.fp || "");
  const packageId = String(req.query.id || "");
  if (!fingerprint || !packageId) return res.status(400).json({ ok: false, error: "faltan fp/id" });
  const repo = getConfigFlag("communityRepo") || "tuangel134/rhythm-dance";
  const branch = getConfigFlag("communityBranch") || "main";
  try {
    const text = await fetchPackageFile(repo, branch, fingerprint, packageId);
    const val = validatePackage(text);
    if (!val.ok) return res.status(400).json({ ok: false, error: val.error, rule: val.rule });
    res.json({ ok: true, package: parsePackage(text) });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Construye, valida y publica un package (Req 3.1-3.6, 7.3, 8.*).
app.post("/api/community/publish", async (req, res) => {
  const { songId, difficulty, lanes, game, author, mode } = req.body || {};
  if (!songId || !difficulty) return res.status(400).json({ ok: false, error: "faltan songId/difficulty" });
  if (!author || !String(author.name || "").trim()) {
    return res.status(400).json({ ok: false, error: "la atribucion no puede estar vacia" });
  }
  const token = getConfigFlag("githubToken");
  if (!token) return res.json({ ok: false, needAuth: true, error: "configura tu token de GitHub para publicar" });

  const laneCount = lanes === 4 || lanes === "4" ? 4 : 5;
  const gm = game === "guitar" ? "guitar" : "dance";
  try {
    const chart = getCustomChart(songId, difficulty, gm, laneCount);
    if (!chart || !Array.isArray(chart.notes) || !chart.notes.length) {
      return res.status(400).json({ ok: false, error: "no hay un chart del editor para esa cancion/dificultad/carriles" });
    }
    const { meta, fingerprint } = await songMetaWithFingerprint(songId, findSongById(songId));
    const metadata = {
      game: gm, difficulty, laneCount,
      title: meta.title, artist: meta.artist,
      bpm: Math.round(chart.bpm || meta.bpm || 0),
      duration: Math.round(chart.duration || meta.duration || 0),
    };
    const pkg = buildPackage({ chart: { laneCount, duration: metadata.duration, bpm: metadata.bpm, notes: chart.notes }, metadata, attribution: author, fingerprint });
    const val = validatePackage(pkg);
    if (!val.ok) return res.status(400).json({ ok: false, error: val.error, rule: val.rule });

    const packageId = computePackageId(fingerprint, metadata, author);
    const entry = indexEntryFromPackage(pkg, packageId);
    const repo = getConfigFlag("communityRepo") || "tuangel134/rhythm-dance";
    const branch = getConfigFlag("communityBranch") || "main";
    const result = await publishPackage(repo, token, {
      fingerprint, packageId, packageJson: serializePackage(pkg), indexEntry: entry, mode: mode || "commit", branch,
    });
    // Refrescar el catalogo local para que aparezca de inmediato.
    syncCatalog().catch(() => {});
    res.json({ ok: true, url: result.url, packageId });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Aplica un package a una cancion local (Req 6.1-6.5, 7.2, 10.4). El package
// puede venir en el body (ya descargado) o se baja por fp+id.
app.post("/api/community/apply", async (req, res) => {
  const { songId, overwrite } = req.body || {};
  let pkg = req.body && req.body.package;
  if (!songId) return res.status(400).json({ ok: false, error: "falta songId" });
  const repo = getConfigFlag("communityRepo") || "tuangel134/rhythm-dance";
  const branch = getConfigFlag("communityBranch") || "main";
  try {
    if (!pkg && req.body && req.body.fp && req.body.id) {
      const text = await fetchPackageFile(repo, branch, req.body.fp, req.body.id);
      pkg = parsePackage(text);
    }
    if (!pkg) return res.status(400).json({ ok: false, error: "falta el package (o fp/id)" });
    const val = validatePackage(pkg);
    if (!val.ok) return res.status(400).json({ ok: false, error: val.error, rule: val.rule });

    // Emparejar por fingerprint con la cancion local (Req 6.1, 6.4).
    const filePath = resolveSongPath(songId);
    if (!filePath) return res.json({ ok: false, needAudio: true, message: "se requiere el archivo de audio para jugar este chart" });
    const { fingerprint } = await songMetaWithFingerprint(songId, findSongById(songId));
    if (fingerprint !== pkg.fingerprint) {
      return res.json({ ok: false, needAudio: true, message: "el chart no coincide con esta cancion (huella distinta)" });
    }

    const gm = pkg.metadata.game === "guitar" ? "guitar" : "dance";
    const laneCount = pkg.chart.laneCount;
    // ¿Sobrescribiria un chart existente? (Req 6.5)
    const existing = getCustomChart(songId, pkg.metadata.difficulty, gm, laneCount);
    if (existing && overwrite !== true) {
      return res.json({ ok: false, needsConfirm: true, message: "ya existe un chart local para esa dificultad/carriles" });
    }
    const stored = {
      laneCount, duration: pkg.chart.duration, bpm: pkg.chart.bpm,
      notes: pkg.chart.notes, attribution: pkg.attribution, source: "community", fingerprint: pkg.fingerprint,
    };
    saveCustomChart(songId, pkg.metadata.difficulty, stored, gm);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// Datos para reportar un chart como inapropiado: URL de issue de GitHub prellenada (Req 8.4).
app.get("/api/community/report", (req, res) => {
  const repo = getConfigFlag("communityRepo") || "tuangel134/rhythm-dance";
  const pkgId = String(req.query.id || "");
  const title = encodeURIComponent(`[reporte] chart ${pkgId}`);
  const body = encodeURIComponent(`Reporto el chart ${pkgId} por contenido inapropiado o infractor.\n\nMotivo:\n`);
  res.json({ url: `https://github.com/${repo}/issues/new?title=${title}&body=${body}` });
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(hasBuild ? path.join(distDir, "index.html") : path.join(ROOT, "index.html"));
});

// ---------- Arranque ----------
const server = http.createServer(app);
attachRoomServer(server); // WebSocket en /ws para modo VS

function lanIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family === "IPv4" && !ni.internal) ips.push(ni.address);
    }
  }
  return ips;
}

server.listen(PORT, () => {
  const st = toolStatus();
  console.log("\n  RHYTHM DANCE — motor local");
  console.log(`  Servidor:  http://localhost:${PORT}`);
  const ips = lanIPs();
  if (ips.length) {
    console.log("  Para VS en red local, tu amigo usa una de estas como 'Servidor del amigo':");
    ips.forEach((ip) => console.log(`    ${ip}:${PORT}`));
  }
  console.log(`  Plataforma: ${st.platform}`);
  console.log(`  Herramientas: ffmpeg=${st.ffmpeg ? "ok" : "FALTA"} · ffprobe=${st.ffprobe ? "ok" : "FALTA"} · yt-dlp=${st.ytdlp ? "ok" : "FALTA (sin descargas)"}`);
  const folders = getFolders();
  console.log("  Carpetas de musica:");
  if (!folders.length) console.log("    (ninguna) — agrega una desde la app");
  else folders.forEach((f) => console.log("    - " + f));
  console.log("");
  // Sincronizar el catalogo de charts de la comunidad al arrancar (no bloqueante).
  try { syncCatalogOnStartup(); } catch (_) {}
  // Auto-actualizar yt-dlp si pasaron 7+ dias desde la ultima verificacion.
  // No bloquea el arranque: corre en background y registra el resultado en
  // ~/.rhythm-dance/ytdlp-update.json. Solo es ruidoso si falla por permisos
  // (instalacion de sistema tipo apt/brew) o sin internet.
  try { maybeAutoUpdateYtdlp(); } catch (_) {}
});

// Comprueba si yt-dlp está disponible y actualizado. Si no existe, lo
// descarga automáticamente (binario standalone desde GitHub). Si existe
// pero pasaron 3+ días, lo actualiza. No bloquea el arranque.
async function maybeAutoUpdateYtdlp() {
  try {
    // Primero asegurar que existe (lo descarga si no)
    const ensure = await ensureYtdlp();
    if (ensure.updated) {
      console.log(`[yt-dlp] instalado automáticamente: ${ensure.version}`);
      return;
    }
    // Ya existía, revisar si toca actualizar
    if (!shouldAutoUpdateYtdlp()) return;
    console.log(`[yt-dlp] comprobando actualizaciones (intervalo: ${AUTO_UPDATE_INTERVAL_DAYS} días)...`);
    const r = await updateYtdlp({ force: true });
    if (r.skipped) return;
    if (r.ok) {
      console.log(`[yt-dlp] OK (${r.version || "?"})${r.updated ? " — actualizado" : " — ya al día"} [${r.method || "?"}]`);
    } else {
      console.log(`[yt-dlp] actualización falló: ${(r.error || "").slice(0, 200)}`);
      if (r.strategiesTried && r.strategiesTried.length) {
        console.log(`[yt-dlp] estrategias: ${r.strategiesTried.map(s => s.name).join(", ")}`);
      }
    }
  } catch (e) {
    console.log(`[yt-dlp] error en auto-update: ${e.message}`);
  }
}

// Cierre limpio: cerrar el tunel publico si estaba abierto.
function shutdown() {
  try { stopTunnel(); } catch (_) {}
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
