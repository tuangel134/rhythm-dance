// downloader.js
// Busca y descarga musica usando yt-dlp. El audio se guarda como mp3 en la
// carpeta elegida por el usuario para luego jugarse.
//
// NOTA: la descarga depende de yt-dlp + ffmpeg instalados. El usuario es
// responsable de respetar los derechos de autor del contenido que descargue.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { YTDLP, FFMPEG } from "./tools.js";

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
      "--no-warnings",
      "--ignore-errors",
    ];
    const yt = spawn(YTDLP, args);
    let out = "", err = "";
    yt.stdout.on("data", (c) => (out += c.toString()));
    yt.stderr.on("data", (c) => (err += c.toString()));
    yt.on("error", (e) => reject(new Error("yt-dlp no disponible: " + e.message)));
    yt.on("close", (code) => {
      if (code !== 0 && !out.trim()) {
        return reject(new Error(err.slice(0, 300) || "Busqueda fallida"));
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

    const args = [
      url,
      "-x", "--audio-format", "mp3", "--audio-quality", "0",
      "--no-playlist",
      ...ffmpegLocationArgs(),
      "-o", outTmpl,
      "--newline",
      "--no-warnings",
      "--print", "after_move:filepath",
    ];
    const yt = spawn(YTDLP, args);
    let finalFile = "";
    let err = "";

    yt.stdout.on("data", (c) => {
      const text = c.toString();
      for (const line of text.split("\n")) {
        // Progreso: "[download]  42.3% of ..."
        const m = /\[download\]\s+([\d.]+)%/.exec(line);
        if (m) onProgress({ percent: parseFloat(m[1]), stage: opts.video ? "descargando audio" : "descargando" });
        else if (line.includes("[ExtractAudio]")) onProgress({ percent: 100, stage: "convirtiendo a mp3" });
        // Ruta final (del --print after_move:filepath)
        const trimmed = line.trim();
        if (trimmed && (trimmed.endsWith(".mp3") || trimmed.endsWith(".m4a")) && fs.existsSync(trimmed)) {
          finalFile = trimmed;
        }
      }
    });
    yt.stderr.on("data", (c) => (err += c.toString()));
    yt.on("error", (e) => reject(new Error("yt-dlp no disponible: " + e.message)));
    yt.on("close", async (code) => {
      if (code !== 0) return reject(new Error(err.slice(0, 300) || "Descarga fallida"));
      // Si se pidio video, descargarlo con el MISMO nombre base que el mp3.
      if (opts.video && finalFile) {
        try {
          onProgress({ percent: 0, stage: "descargando video" });
          const videoFile = await downloadVideo(url, finalFile, onProgress);
          onProgress({ percent: 100, stage: "listo" });
          return resolve({ file: finalFile, video: videoFile });
        } catch (e) {
          // Si el video falla, no rompemos: el audio ya quedo listo.
          onProgress({ percent: 100, stage: "listo (sin video)" });
          return resolve({ file: finalFile });
        }
      }
      onProgress({ percent: 100, stage: "listo" });
      resolve({ file: finalFile });
    });
  });
}

// Descarga el video (mp4) de una URL y lo guarda con el MISMO nombre base que
// el audio ya descargado (para que el juego lo detecte como fondo).
function downloadVideo(url, audioFile, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const base = audioFile.replace(/\.(mp3|m4a)$/i, "");
    const outTmpl = base + ".%(ext)s";
    const args = [
      url,
      // Preferimos mp4 (h264/aac) por compatibilidad con <video> en navegador.
      "-f", "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*+ba/b",
      "--merge-output-format", "mp4",
      "--no-playlist",
      ...ffmpegLocationArgs(),
      "-o", outTmpl,
      "--newline",
      "--no-warnings",
      "--print", "after_move:filepath",
    ];
    const yt = spawn(YTDLP, args);
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
      if (code !== 0) return reject(new Error(err.slice(0, 300) || "Descarga de video fallida"));
      resolve(videoFile);
    });
  });
}
