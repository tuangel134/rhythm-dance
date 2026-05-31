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

import { listSongs, getFolders, addFolder, removeFolder, resolveSongPath, resolveVideoPath } from "./library.js";
import { decodeToPCM } from "./decode.js";
import { generateBeatmap } from "./generator.js";
import { search, downloadAudio } from "./downloader.js";
import { toolStatus, defaultDownloadDir, FFMPEG } from "./tools.js";
import { attachRoomServer } from "./rooms.js";
import { startTunnel, getTunnelUrl, stopTunnel } from "./tunnel.js";
import { parseStepfile, findStepfileFor, parseUCS, findUcsFor } from "./smparser.js";
import { getSongNps, setSongNps, getSongSettings, recordScore, getScore, getAllScores, saveCustomChart, getCustomChart, deleteCustomChart, hasCustomChart, exportData, importData } from "./songsettings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 5174;

const CACHE_DIR = path.join(os.homedir(), ".rhythm-dance", "charts");
fs.mkdirSync(CACHE_DIR, { recursive: true });

const COVER_DIR = path.join(os.homedir(), ".rhythm-dance", "covers");
fs.mkdirSync(COVER_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "50mb" }));   // respaldos con muchos charts pueden ser grandes

// ---------- Frontend ----------
const distDir = path.join(ROOT, "dist");
const hasBuild = fs.existsSync(path.join(distDir, "index.html"));
if (hasBuild) app.use(express.static(distDir));
else app.use(express.static(ROOT, { index: false }));

// ---------- API: estado de herramientas ----------
app.get("/api/status", (req, res) => {
  res.json({ tools: toolStatus(), downloadDir: defaultDownloadDir() });
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
  try { res.json({ ok: true, folder: addFolder(req.body.path || "") }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});
app.delete("/api/folders", (req, res) => {
  removeFolder(req.body.path || "");
  res.json({ ok: true });
});

// ---------- API: canciones ----------
app.get("/api/songs", (req, res) => res.json({ songs: listSongs() }));

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
async function buildChart(id, { difficulty, laneCount, genre, game = "dance", onProgress = () => {} }) {
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
  const custom = getCustomChart(id, difficulty, game, laneCount);
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
  const stepPath = beatmap ? null : findStepfileFor(filePath);
  const ucsPath = (beatmap || stepPath) ? null : findUcsFor(filePath);
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
app.post("/api/score/:id", (req, res) => {
  const { name, score, accuracy, grade, difficulty, maxCombo, game } = req.body || {};
  const entry = recordScore(req.params.id, name, { score, accuracy, grade, difficulty, maxCombo }, game || "dance");
  res.json({ ok: true, entry });
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
  res.json({ ok: true, notes: chart.notes.length });
});
app.delete("/api/customchart/:id", (req, res) => {
  const b = req.body || {};
  deleteCustomChart(req.params.id, b.difficulty || "normal", b.game || "dance", b.lanes);
  res.json({ ok: true });
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
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Descarga con progreso via Server-Sent Events.
app.get("/api/download", async (req, res) => {
  const url = String(req.query.url || "");
  const folder = String(req.query.folder || defaultDownloadDir());
  const withVideo = req.query.video === "1" || req.query.video === "true";
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
    const { file, video } = await downloadAudio(url, folder, (p) => sse({ type: "progress", ...p }), { video: withVideo });
    sse({ type: "done", file, video });
  } catch (e) {
    sse({ type: "error", message: e.message });
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
});

// Cierre limpio: cerrar el tunel publico si estaba abierto.
function shutdown() {
  try { stopTunnel(); } catch (_) {}
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
