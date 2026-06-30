// downloader.js
// Busca y descarga musica usando yt-dlp. El audio se guarda como mp3 en la
// carpeta elegida por el usuario para luego jugarse.
//
// NOTA: la descarga depende de yt-dlp + ffmpeg instalados. El usuario es
// responsable de respetar los derechos de autor del contenido que descargue.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getYtdlpPath, FFMPEG, errorSuggestsYtdlpUpdate } from "./tools.js";

// Getter dinámico porque la ruta se actualiza tras ensureYtdlp()
function YTDLP() { return getYtdlpPath(); }

// Solo pasamos --ffmpeg-location si FFMPEG es una RUTA real (no solo "ffmpeg").
// Si fuese solo el nombre, dejariamos que yt-dlp lo busque en el PATH.
function ffmpegLocationArgs() {
  const isPath = FFMPEG.includes("/") || FFMPEG.includes("\\");
  if (isPath && fs.existsSync(FFMPEG)) {
    // yt-dlp acepta el directorio o el binario; pasamos el directorio.
    return ["--ffmpeg-location", path.dirname(FFMPEG)];
  }
  return [];
}

// Flags de RED robustos: reintentos con backoff, timeouts y bypass geo. Hacen
// que una descarga sobreviva a cortes de red, throttling y errores temporales
// (clave para que el descargador "aguante" a largo plazo).
const ROBUST_NET_ARGS = [
  "--no-check-certificates",
  "--retries", "10",
  "--fragment-retries", "10",
  "--extractor-retries", "5",
  "--retry-sleep", "exp=1:60",     // backoff exponencial entre reintentos
  "--socket-timeout", "30",
  "--geo-bypass",
  "--force-ipv4",                  // evita problemas de IPv6 con YouTube en muchas redes
  "--no-warnings",
];

// Conjuntos de "player clients" de YouTube a probar EN ORDEN. YouTube rompe
// unos u otros con sus cambios anti-bot; probar varios da mucha mas resiliencia.
// Cada intento usa un set distinto si el anterior fallo por extractor.
const PLAYER_CLIENT_SETS = [
  "web_safari,web,android",
  "android,ios,web",
  "ios,tv,web_embedded",
  "tv_embedded,android_vr,web",
];
function playerClientArgs(idx) {
  const set = PLAYER_CLIENT_SETS[Math.min(idx, PLAYER_CLIENT_SETS.length - 1)];
  return ["--extractor-args", `youtube:player_client=${set}`];
}

/**
 * Busca canciones. Devuelve metadatos sin descargar (flat playlist).
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{id,title,uploader,duration,url}>>}
 */
export function search(query, limit = 12) {
  return new Promise((resolve, reject) => {
    const args = [
      `ytsearch${limit}:${query}`,
      "--dump-json",
      "--flat-playlist",
      "--ignore-errors",
      ...ROBUST_NET_ARGS,
      ...playerClientArgs(0),
    ];
    const yt = spawn(YTDLP(), args);
    let out = "", err = "";
    yt.stdout.on("data", (c) => (out += c.toString()));
    yt.stderr.on("data", (c) => (err += c.toString()));
    yt.on("error", (e) => reject(new Error("yt-dlp no disponible: " + e.message)));
    yt.on("close", (code) => {
      if (code !== 0 && !out.trim()) {
        const e = new Error(err.slice(0, 300) || "Busqueda fallida");
        if (errorSuggestsYtdlpUpdate(err)) e.ytdlpUpdateRecommended = true;
        return reject(e);
      }
      const results = [];
      for (const line of out.split("\n")) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          results.push({
            id: j.id,
            title: j.title || "(sin titulo)",
            uploader: j.uploader || j.channel || "",
            duration: j.duration || 0,
            url: j.url || `https://www.youtube.com/watch?v=${j.id}`,
          });
        } catch (_) { /* ignora lineas no-JSON */ }
      }
      resolve(results);
    });
  });
}

/**
 * Descarga el audio de una URL a la carpeta destino como mp3.
 * Emite progreso por callback (porcentaje 0..100 y estado).
 * @param {string} url
 * @param {string} destFolder
 * @param {(p:{percent:number,stage:string})=>void} onProgress
 * @param {{video?:boolean}} [opts] - video:true tambien guarda un .mp4 con el
 *        mismo nombre, para usarlo como fondo en el juego.
 * @returns {Promise<{file:string, video?:string}>}
 */
export function downloadAudio(url, destFolder, onProgress = () => {}, opts = {}) {
  return new Promise(async (resolve, reject) => {
    fs.mkdirSync(destFolder, { recursive: true });
    const outTmpl = path.join(destFolder, "%(title)s.%(ext)s");

    // Un intento de descarga de audio con un set de player-clients concreto.
    const attempt = (clientIdx) => new Promise((res, rej) => {
      const args = [
        url,
        "-x", "--audio-format", "mp3", "--audio-quality", "0",
        "--no-playlist",
        ...ROBUST_NET_ARGS,
        ...playerClientArgs(clientIdx),
        ...ffmpegLocationArgs(),
        "-o", outTmpl,
        "--newline",
        "--print", "after_move:filepath",
      ];
      const yt = spawn(YTDLP(), args);
      let finalFile = "";
      let err = "";
      yt.stdout.on("data", (c) => {
        const text = c.toString();
        for (const line of text.split("\n")) {
          const m = /\[download\]\s+([\d.]+)%/.exec(line);
          if (m) onProgress({ percent: parseFloat(m[1]), stage: opts.video ? "descargando audio" : "descargando" });
          else if (line.includes("[ExtractAudio]")) onProgress({ percent: 100, stage: "convirtiendo a mp3" });
          const trimmed = line.trim();
          if (trimmed && (trimmed.endsWith(".mp3") || trimmed.endsWith(".m4a")) && fs.existsSync(trimmed)) finalFile = trimmed;
        }
      });
      yt.stderr.on("data", (c) => (err += c.toString()));
      yt.on("error", (e) => rej(Object.assign(new Error("yt-dlp no disponible: " + e.message), { spawnFail: true })));
      yt.on("close", (code) => {
        if (code === 0) return res(finalFile);
        const e = new Error(err.slice(0, 400) || "Descarga fallida");
        e.extractor = errorSuggestsYtdlpUpdate(err);
        rej(e);
      });
    });

    // Probar varios sets de clientes: si falla por extractor (YouTube cambio el
    // player para ese cliente), reintenta con el siguiente. Asi una descarga no
    // muere por un solo cliente bloqueado.
    let finalFile = "", lastErr = null;
    for (let i = 0; i < PLAYER_CLIENT_SETS.length; i++) {
      try { finalFile = await attempt(i); lastErr = null; break; }
      catch (e) {
        lastErr = e;
        if (e.spawnFail) break;                 // yt-dlp no esta: no tiene sentido reintentar
        if (!e.extractor && i > 0) break;        // error no-extractor tras reintento: parar
        if (i < PLAYER_CLIENT_SETS.length - 1) onProgress({ percent: 0, stage: "reintentando (otro cliente)" });
      }
    }
    if (lastErr) {
      if (errorSuggestsYtdlpUpdate(lastErr.message)) lastErr.ytdlpUpdateRecommended = true;
      return reject(lastErr);
    }
    {
      // Si se pidio video, descargarlo con el MISMO nombre base que el mp3.
      if (opts.video && finalFile) {
        try {
          onProgress({ percent: 0, stage: "descargando video" });
          const videoFile = await downloadVideo(url, finalFile, onProgress);
          onProgress({ percent: 100, stage: "listo" });
          return resolve({ file: finalFile, video: videoFile });
        } catch (e) {
          // Si el video falla, no rompemos: el audio ya quedo listo.
          // Pero si fue por extractor desactualizado, lo propagamos para que
          // el frontend pueda ofrecer actualizar yt-dlp (con el audio ya
          // descargado, el reintento sera mucho mas rapido).
          onProgress({ percent: 100, stage: "listo (sin video)" });
          return resolve({ file: finalFile, videoFailed: e && e.ytdlpUpdateRecommended ? "extractor" : "other" });
        }
      }
      onProgress({ percent: 100, stage: "listo" });
      resolve({ file: finalFile });
    }
  });
}

// Cadena de selección de formato para el video de fondo. Se prueban
// combinaciones de MAYOR a MENOR compatibilidad con el elemento <video>
// del navegador. YouTube no siempre ofrece todas las variantes, asi que
// la cadena cae a formatos menos comunes pero que un navegador moderno
// puede reproducir:
//   1) H.264 + AAC, mp4, ≤720p   (Safari, Edge, Chrome, Firefox)
//   2) mp4 ya muxado, ≤720p      (un solo archivo, sin merge)
//   3) H.264 + AAC, mp4, ≤1080p  (si no hay 720p, subimos resolución)
//   4) mp4 ≤720p, audio cualquiera
//   5) mp4 muxado, ≤1080p
//   6) webm ≤720p                (VP9/Opus, Chrome y Firefox)
//   7) webm muxado, ≤1080p
//   8) cualquier cosa ≤1080p     (cota de tamaño razonable)
//   9) lo que sea, sin limite    (ultimo recurso, puede ser 4K)
//  10) mejor archivo único
// Si yt-dlp tiene que MERGEAR streams separados, --merge-output-format le
// dice que intente mp4 primero y mkv como ultimo recurso (webm no se puede
// reempaquetar a mp4 cuando los codecs no son H.264/AAC).
const VIDEO_FORMAT_SELECTOR = [
  "bv*[height<=720][ext=mp4][vcodec^=avc]+ba[ext=m4a]",   // H.264 + AAC, ≤720p (max compatibilidad)
  "b[height<=720][ext=mp4]",                                // mp4 ya muxado, ≤720p (un solo archivo)
  "bv*[height<=1080][ext=mp4][vcodec^=avc]+ba[ext=m4a]",   // H.264 + AAC, ≤1080p (subimos resolución)
  "bv*[height<=720][ext=mp4]+ba",                           // mp4 ≤720p, audio cualquiera
  "b[height<=1080][ext=mp4]",                               // mp4 muxado, ≤1080p
  "bv*[height<=720][ext=webm]+ba[ext=webm]",                // webm ≤720p (Chrome/Firefox)
  "b[height<=1080][ext=webm]",                              // webm muxado, ≤1080p
  "bv*[height<=1080]+ba",                                   // lo que sea ≤1080p (cota de tamaño)
  "bv*+ba",                                                 // sin limite (ultimo recurso)
  "b",                                                      // mejor archivo unico
].join("/");

// Descarga el video (mp4) de una URL y lo guarda con el MISMO nombre base que
// el audio ya descargado (para que el juego lo detecte como fondo).
function downloadVideo(url, audioFile, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const base = audioFile.replace(/\.(mp3|m4a)$/i, "");
    const outTmpl = base + ".%(ext)s";
    const args = [
      url,
      "-f", VIDEO_FORMAT_SELECTOR,
      // Intentar muxear a mp4 (mas compatible); si los codecs no encajan
      // (p.ej. webm/Opus), caer a mkv. yt-dlp prueba en orden.
      "--merge-output-format", "mp4,mkv",
      "--no-playlist",
      ...ROBUST_NET_ARGS,
      ...playerClientArgs(0),
      ...ffmpegLocationArgs(),
      "-o", outTmpl,
      "--newline",
      "--print", "after_move:filepath",
    ];
    const yt = spawn(YTDLP(), args);
    let videoFile = "";
    let err = "";
    yt.stdout.on("data", (c) => {
      const text = c.toString();
      for (const line of text.split("\n")) {
        const m = /\[download\]\s+([\d.]+)%/.exec(line);
        if (m) onProgress({ percent: parseFloat(m[1]), stage: "descargando video" });
        const trimmed = line.trim();
        if (trimmed && /\.(mp4|mkv|webm)$/i.test(trimmed) && fs.existsSync(trimmed)) videoFile = trimmed;
      }
    });
    yt.stderr.on("data", (c) => (err += c.toString()));
    yt.on("error", (e) => reject(new Error("yt-dlp no disponible: " + e.message)));
    yt.on("close", (code) => {
      if (code !== 0) {
        const e = new Error(err.slice(0, 300) || "Descarga de video fallida");
        if (errorSuggestsYtdlpUpdate(err)) e.ytdlpUpdateRecommended = true;
        return reject(e);
      }
      resolve(videoFile);
    });
  });
}
