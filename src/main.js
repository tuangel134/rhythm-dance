// main.js
// Frontend visual. Habla con el motor local (servidor Node) para: listar
// canciones/carpetas, pedir la pista generada, buscar/descargar musica y
// coordinar el modo VS online. Muestra el juego en 3D.

import { InputManager, DEFAULT_KEY_MAPS, LANE_LABELS, LANE_COLORS, setKeyMap, keyLabel, setPadMap, getDefaultPadMap, padLabel, pollAnyPadButton, anyGamepadConnected } from "./input/input.js";
import { UiNav } from "./input/uinav.js";
import { arrowDataURL, gemDataURL, LANE_DIRS, GUITAR_LANE_COLORS, GUITAR_LANE_LABELS } from "./render/arrowicon.js";
import { RhythmGame } from "./game/game.js";
import { OnlineClient } from "./net/online.js";
import { AudioPlayer } from "./audio/player.js";
import { RivalBoard } from "./game/rivalboard.js";
import { Editor } from "./game/editor.js";
import { TimelineEditor } from "./game/timeline.js";
import { SharedRenderer } from "./render/stage.js";
import { loadPrefs, savePrefs, getPref } from "./prefs.js";

const $ = (id) => document.getElementById(id);
const screens = { splash: $("splash"), gameSelect: $("gameSelect"), modeSelect: $("modeSelect"), menu: $("menu"), localSetup: $("localSetup"), loading: $("loading"), game: $("game"), results: $("results"), editor: $("editor") };

const input = new InputManager();
input.start();
input.on("gamepadchange", (count, name) => {
  const el = $("gamepadStatus");
  if (count > 0) {
    el.textContent = "🎮 " + (name && name.length > 18 ? name.slice(0, 18) + "…" : name || "mando");
    el.className = "badge badge-on";
  } else {
    el.textContent = "🎮 sin mando";
    el.className = "badge badge-off";
  }
});

const online = new OnlineClient();

// Estado global
let currentGame = null;
let audioEl = null;
let allSongs = [];
let rivalBoard = null;          // tablero del rival en VS
let rivalPending = null;        // ultimo {resolved, lastHit} recibido
let vs = { active: false, role: null, song: null, peerName: "RIVAL", peerFinal: null };
let vsRematch = { me: false, peer: false };  // estado de revancha en VS
// Serie online "mejor de 3": cuenta de rondas ganadas (yo/rival) calculada en
// cada cliente a partir de los mismos puntajes. Se reinicia al entrar a la sala.
let onlineSeries = { mine: 0, peer: 0, round: 0, decided: false };
// Modificadores visuales activos (estilo Pump It Up).
const mods = { vanish: false, appear: false, hidden: false, tornado: false, twirl: false, drunk: false, mirror: false, random: false, reverse: false };
let lastPlay = null; // { id, name } de la ultima cancion (para reintentar)
let songScores = {}; // puntajes mas altos por cancion (cache local)
let gameMode = "dance"; // "dance" (Rhythm Dance) o "guitar" (Guitar Hero)

function showScreen(name) {
  for (const k in screens) screens[k].classList.toggle("active", k === name);
}
function setStatus(msg) { $("loadStatus").textContent = msg; }

// ---------- Tabs ----------
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.querySelector(`.tab-panel[data-panel="${t.dataset.tab}"]`).classList.add("active");
  });
});

// ---------- Modificadores (efectos) ----------
// Vanish y Appear son opuestos; activar uno desactiva el otro.
document.querySelectorAll(".mod-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.mod;
    mods[m] = !mods[m];
    if (mods[m]) {
      // vanish/appear/hidden son efectos de visibilidad: solo uno a la vez.
      const visGroup = ["vanish", "appear", "hidden"];
      if (visGroup.includes(m)) {
        for (const other of visGroup) if (other !== m) mods[other] = false;
      }
    }
    btn.classList.toggle("active", mods[m]);
    syncModButtons();
  });
});
function syncModButtons() {
  document.querySelectorAll(".mod-toggle").forEach((b) => {
    b.classList.toggle("active", !!mods[b.dataset.mod]);
  });
}

// ---------- Opciones ----------
$("scrollSpeed").addEventListener("input", () => {
  $("scrollSpeedVal").textContent = Number($("scrollSpeed").value).toFixed(1) + "x";
  savePrefs({ scrollSpeed: Number($("scrollSpeed").value) });
});
$("volume").addEventListener("input", () => {
  const v = Number($("volume").value);
  $("volumeVal").textContent = v + "%";
  if (audioEl) audioEl.setVolume(v / 100);
  savePrefs({ volume: v });
});
$("style").addEventListener("change", () => {
  const five = $("style").value === "5";
  $("controlsHelp").textContent = five
    ? "Z X C V B (5 paneles) · Mando/USB · Stick diagonal"
    : "Flechas ← ↓ ↑ → o A S W D · Mando/USB";
  const c2 = document.querySelector(".controls-2p");
  if (c2) c2.textContent = five
    ? "VS local (2P) → J1: Z X C V B · J2: numpad 1 7 5 9 3 · cada uno su mando"
    : "VS local (2P) → J1: A S W D · J2: flechas ← ↓ ↑ → · cada uno su mando";
  savePrefs({ style: $("style").value });
});
$("difficulty").addEventListener("change", () => savePrefs({ difficulty: $("difficulty").value }));
$("genre").addEventListener("change", () => savePrefs({ genre: $("genre").value }));
$("quality").addEventListener("change", () => savePrefs({ quality: $("quality").value }));
$("playerName").addEventListener("input", () => savePrefs({ playerName: $("playerName").value }));
$("calOffset").addEventListener("input", () => {
  const v = Number($("calOffset").value);
  $("calOffsetVal").textContent = v + " ms";
  savePrefs({ audioOffset: v });
  // Si hay una partida en curso, aplicar el cambio en vivo.
  if (currentGame) currentGame.audioOffset = v / 1000;
});
$("videoBg").addEventListener("change", () => savePrefs({ videoBg: $("videoBg").checked }));

// ---------- Estado de herramientas ----------
async function loadStatus() {
  try {
    const r = await fetch("/api/status");
    const { tools, downloadDir } = await r.json();
    const el = $("toolStatus");
    // ffmpeg es OBLIGATORIO (sin el no se puede generar ninguna pista).
    if (!tools.ffmpeg) {
      el.textContent = "⚠ ffmpeg NO instalado (obligatorio)";
      el.className = "badge badge-warn";
      el.title = "Sin ffmpeg no se pueden generar pistas. Instalalo (ver COMO-USAR.md).";
      setStatus("Falta ffmpeg: instalalo para poder jugar (mira COMO-USAR.md).");
    } else if (tools.ytdlp) {
      el.textContent = "✓ ffmpeg · ⬇ descargas ok";
      el.className = "badge badge-on";
    } else {
      el.textContent = "✓ ffmpeg · ⬇ yt-dlp falta (sin descargas)";
      el.className = "badge badge-warn";
      el.title = "yt-dlp no instalado: el descargador no funcionara, pero si puedes jugar tus archivos.";
    }
    if (downloadDir && !$("dlFolder").value) $("dlFolder").placeholder = downloadDir;
  } catch (_) {}
}

// ---------- Carpetas ----------
async function loadFolders() {
  const r = await fetch("/api/folders");
  const { folders } = await r.json();
  const list = $("folderList");
  list.innerHTML = folders.length
    ? folders.map((f) => `<div class="folder-item"><span title="${f}">${f}</span>
        <button class="mini-btn" data-folder="${encodeURIComponent(f)}">✕</button></div>`).join("")
    : '<p class="empty">Sin carpetas. Agrega una abajo.</p>';
  list.querySelectorAll("button[data-folder]").forEach((b) => {
    b.addEventListener("click", async () => {
      await fetch("/api/folders", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: decodeURIComponent(b.dataset.folder) }) });
      await loadFolders(); await loadSongs();
    });
  });
}

$("addFolderBtn").addEventListener("click", async () => {
  const p = $("folderInput").value.trim();
  if (!p) return;
  const r = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: p }) });
  const j = await r.json();
  if (!j.ok) { setStatus("Error: " + j.error); return; }
  $("folderInput").value = "";
  setStatus("Carpeta agregada: " + j.folder);
  await loadFolders(); await loadSongs();
});

// ---------- Respaldo de pistas y puntajes ----------
// Exportar: descarga el JSON con todas las pistas grabadas, puntajes y ajustes.
$("backupExportBtn").addEventListener("click", async () => {
  const st = $("backupStatus");
  try {
    const r = await fetch("/api/backup");
    if (!r.ok) throw new Error("no se pudo generar el respaldo");
    const blob = await r.blob();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rhythm-dance-backup-${stamp}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    st.textContent = "✓ Respaldo descargado. Guardalo en un lugar seguro.";
  } catch (e) {
    st.textContent = "Error al respaldar: " + e.message;
  }
});
// Restaurar: abre el selector de archivo y sube el JSON al motor.
$("backupImportBtn").addEventListener("click", () => $("backupFile").click());
$("backupFile").addEventListener("change", async (e) => {
  const st = $("backupStatus");
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const r = await fetch("/api/backup/restore", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, mode: "merge" }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "respaldo invalido");
    st.textContent = `✓ Restaurado: ${j.summary.charts} canciones con pistas, ${j.summary.scores} puntajes.`;
    await loadSongs();   // refrescar puntajes mostrados
  } catch (err) {
    st.textContent = "Error al restaurar: " + err.message;
  } finally {
    e.target.value = "";   // permite re-seleccionar el mismo archivo
  }
});

// ---------- Lista de canciones ----------
async function loadSongs() {
  $("songList").innerHTML = '<p class="empty">Buscando canciones...</p>';
  const r = await fetch("/api/songs");
  const { songs } = await r.json();
  allSongs = songs;
  // Cargar puntajes mas altos (para mostrarlos junto a cada cancion) del juego actual.
  try { const sr = await fetch(`/api/scores?game=${gameMode}`); songScores = (await sr.json()).scores || {}; } catch (_) { songScores = {}; }
  renderSongs();
}

function renderSongs() {
  const filter = $("songFilter").value.toLowerCase();
  const list = $("songList");
  const songs = allSongs.filter((s) => s.name.toLowerCase().includes(filter));
  if (!songs.length) {
    list.innerHTML = '<p class="empty">No hay canciones. Descarga musica o agrega una carpeta.</p>';
    return;
  }
  list.innerHTML = songs.map((s) => {
    const sc = songScores[s.id];
    const best = sc && sc.best
      ? `<span class="song-best" title="Mejor: ${sc.best.score.toLocaleString()} (${sc.best.grade}, ${sc.best.difficulty})">★ ${sc.best.score.toLocaleString()}</span>`
      : "";
    return `
    <div class="song-item" data-id="${s.id}" data-name="${escapeHtml(s.name)}">
      <span class="song-cover" data-cover="${s.id}"><span class="cover-fallback">♪</span></span>
      <span class="play-ico">▶</span>
      <span class="song-title">${escapeHtml(s.name)}</span>
      ${best}
      ${s.hasChart ? '<span class="song-chart" title="Tiene stepchart real (mapeo hecho a mano)">CHART</span>' : ''}
      <span class="song-cfg" data-cfg="${s.id}" data-name="${escapeHtml(s.name)}" title="Ajustar densidad por dificultad">⚙</span>
      <span class="song-2p" data-2p="${s.id}" data-name="${escapeHtml(s.name)}" title="2 jugadores en esta PC">2P</span>
      <span class="song-vs" data-vs="${s.id}" data-name="${escapeHtml(s.name)}">VS</span>
    </div>`;
  }).join("");

  // Cargar caratulas de forma perezosa: pedir la imagen; si el servidor la
  // tiene (204 = sin arte), dejamos el icono procedural.
  list.querySelectorAll(".song-cover").forEach((el) => {
    const id = el.dataset.cover;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url(/api/cover/${id})`;
      el.classList.add("has-cover");
    };
    img.src = `/api/cover/${id}`;
  });

  list.querySelectorAll(".song-item").forEach((b) => {
    b.addEventListener("click", (e) => {
      if (e.target.dataset.vs || e.target.dataset.cfg || e.target.dataset["2p"]) return; // botones propios
      playSong(b.dataset.id, b.dataset.name);
    });
  });
  list.querySelectorAll(".song-vs").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); proposeSongToVs(b.dataset.vs, b.dataset.name); });
  });
  list.querySelectorAll(".song-2p").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); playLocalVs(b.dataset["2p"], b.dataset.name); });
  });
  list.querySelectorAll(".song-cfg").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); openSongConfig(b.dataset.cfg, b.dataset.name); });
  });
}

$("songFilter").addEventListener("input", renderSongs);

// ---------- Ajustes por cancion (densidad NPS) ----------
const DIFFS = [["easy","Facil"],["normal","Normal"],["ritmo","Ritmo"],["hard","Dificil"],["expert","Experto"],["locura","Locura"]];
let cfgSongId = null;
async function openSongConfig(id, name) {
  cfgSongId = id;
  $("cfgTitle").textContent = "Densidad: " + name;
  let saved = {};
  try { const r = await fetch(`/api/songsettings/${id}?game=${gameMode}`); const j = await r.json(); saved = (j.settings && j.settings.nps) || {}; } catch (_) {}
  $("cfgRows").innerHTML = DIFFS.map(([k, label]) =>
    `<div class="cfg-row"><label>${label}</label><input type="number" step="0.1" min="0" max="15" data-d="${k}" value="${saved[k] != null ? saved[k] : ""}" placeholder="auto" /></div>`
  ).join("");
  $("cfgModal").classList.remove("hidden");
}
$("cfgClose").addEventListener("click", () => $("cfgModal").classList.add("hidden"));
$("cfgSave").addEventListener("click", async () => {
  const inputs = $("cfgRows").querySelectorAll("input[data-d]");
  for (const inp of inputs) {
    const v = inp.value.trim();
    await fetch(`/api/songsettings/${cfgSongId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: inp.dataset.d, nps: v === "" ? null : Number(v), game: gameMode }),
    }).catch(() => {});
  }
  $("cfgModal").classList.add("hidden");
  setStatus("Ajustes guardados. Se aplicaran al jugar.");
});
$("refreshBtn").addEventListener("click", loadSongs);

// Obtiene el beatmap del motor (con cache en servidor).
async function fetchChart(id, difficulty, lanes, genre) {
  const g = genre || $("genre").value || "auto";
  const r = await fetch(`/api/chart/${id}?difficulty=${difficulty}&lanes=${lanes}&genre=${g}&game=${gameMode}`);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "No se pudo generar la pista");
  }
  return r.json();
}

// Igual que fetchChart pero con PROGRESO real (SSE). Llama onProgress(pct,label)
// conforme el motor decodifica el audio y coloca las notas. Se usa para la
// pantalla de carga al jugar en solo.
function fetchChartProgress(id, difficulty, lanes, genre, onProgress) {
  const g = genre || $("genre").value || "auto";
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/chart-progress/${id}?difficulty=${difficulty}&lanes=${lanes}&genre=${g}&game=${gameMode}`);
    es.onmessage = (e) => {
      let d; try { d = JSON.parse(e.data); } catch { return; }
      if (d.type === "progress") onProgress && onProgress(d.percent, d.label);
      else if (d.type === "done") { es.close(); resolve(d.beatmap); }
      else if (d.type === "error") { es.close(); reject(new Error(d.message || "Error generando pista")); }
    };
    es.onerror = () => { es.close(); reject(new Error("Se perdio la conexion al generar la pista")); };
  });
}

// Actualiza la pantalla de carga.
function setLoading(pct, label) {
  $("loadingFill").style.width = Math.max(0, Math.min(100, pct)) + "%";
  $("loadingPct").textContent = Math.round(pct) + "%";
  if (label) $("loadingLabel").textContent = label;
}

// Carga el audio con Web Audio (decodifica una vez; reloj preciso, sin
// sobrecarga de streaming que degradaba el rendimiento con el tiempo).
function loadAudio(id) {
  const player = new AudioPlayer();
  player.setVolume(Number($("volume").value) / 100);
  return player.resume()
    .then(() => player.load(`/api/audio/${id}`))
    .then(() => player);
}

// ---------- Video de fondo ----------
// Estado del video de fondo de la partida actual.
let videoActive = false;

// Devuelve true si la cancion tiene video y el usuario quiere mostrarlo.
function wantsVideo(id) {
  if (!$("videoBg").checked) return false;
  const s = allSongs.find((x) => x.id === id);
  return !!(s && s.hasVideo);
}

// Prepara el <video> de fondo: carga la fuente y lo deja listo (pausado en 0).
// Devuelve una promesa que resuelve cuando el video puede reproducirse.
function prepareVideo(id) {
  const v = $("bgVideo");
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    v.src = `/api/video/${id}`;
    v.load();
    v.oncanplay = finish;
    v.onerror = () => { done = true; resolve(); };
    // No bloquear para siempre si el navegador tarda.
    setTimeout(finish, 4000);
  });
}

// Muestra el video y lo deja listo para sincronizar con el reloj del juego.
function showVideo() {
  $("bgVideo").classList.remove("hidden");
  $("bgVideoDim").classList.remove("hidden");
  videoActive = true;
}

// Sincroniza el tiempo del video con el reloj de la cancion (now en segundos).
// Solo corrige si la deriva supera un umbral (evita tirones por re-seek).
function syncVideo(now) {
  if (!videoActive) return;
  const v = $("bgVideo");
  if (now < 0) {
    // Cuenta atras: mantener el video en el primer frame, pausado.
    if (!v.paused) v.pause();
    if (v.currentTime > 0.05) v.currentTime = 0;
    return;
  }
  if (now > v.duration) return; // el video es mas corto que la cancion
  if (v.paused) { v.play().catch(() => {}); }
  const drift = Math.abs(v.currentTime - now);
  if (drift > 0.25) v.currentTime = now;   // re-anclar si se desfasa
}

// Oculta y libera el video de fondo.
function teardownVideo() {
  const v = $("bgVideo");
  try { v.pause(); } catch (_) {}
  v.removeAttribute("src");
  try { v.load(); } catch (_) {}
  v.classList.add("hidden");
  $("bgVideoDim").classList.add("hidden");
  videoActive = false;
}

// ---------- VS local (2 jugadores en la misma PC) ----------
// Un solo audio/reloj compartido; dos tableros, dos InputManager con teclas
// separadas (J1: ZXCVB/ASWD + mando 1 · J2: numpad/flechas + mando 2). Ambos
// juegan la cancion completa y al final se comparan los puntajes.
let localVs = null; // { games:[g1,g2], inputs:[i1,i2], raf, lastT, done }

// Serie "mejor de 3" del VS local: canciones elegidas, ajustes por jugador,
// victorias y ronda actual. active=false cuando no hay serie (modo 2P rapido).
let series = { active: false, songs: [], difficulty: "normal", lanes: "5", players: null, wins: [0, 0], round: 0 };

// ---------- Setup VS local: elegir 3 canciones, dificultad comun y ajustes por jugador ----------
let lsPicked = [];               // [{id, name}] hasta 3
const VS_MOD_LIST = [
  ["vanish","🌫","Vanish"],["appear","✨","Appear"],["hidden","👻","Hidden"],
  ["tornado","🌀","Tornado"],["twirl","💫","Twirl"],["drunk","🌊","Drunk"],
  ["mirror","🪞","Mirror"],["random","🎲","Random"],["reverse","🔃","Reverse"],
];
const lsMods = { p1: {}, p2: {} };   // efectos elegidos por jugador

function openLocalSetup() {
  lsPicked = [];
  series = { active: false, songs: [], difficulty: "normal", lanes: "5", players: null, wins: [0, 0], round: 0 };
  for (const k of ["p1", "p2"]) lsMods[k] = {};
  // Heredar valores actuales del menu como punto de partida.
  $("lsDifficulty").value = $("difficulty").value;
  $("lsStyle").value = $("style").value;
  $("lsP1Speed").value = $("scrollSpeed").value; $("lsP1SpeedVal").textContent = Number($("scrollSpeed").value).toFixed(1) + "x";
  $("lsP2Speed").value = $("scrollSpeed").value; $("lsP2SpeedVal").textContent = Number($("scrollSpeed").value).toFixed(1) + "x";
  renderLsMods("p1"); renderLsMods("p2");
  renderLsPicked();
  renderLsSongList();
  showScreen("localSetup");
}

$("localSetupBack") && $("localSetupBack").addEventListener("click", () => showScreen("modeSelect"));
$("lsP1Speed") && $("lsP1Speed").addEventListener("input", () => { $("lsP1SpeedVal").textContent = Number($("lsP1Speed").value).toFixed(1) + "x"; });
$("lsP2Speed") && $("lsP2Speed").addEventListener("input", () => { $("lsP2SpeedVal").textContent = Number($("lsP2Speed").value).toFixed(1) + "x"; });
$("lsStyle") && $("lsStyle").addEventListener("change", renderLsSongList);
$("lsFilter") && $("lsFilter").addEventListener("input", renderLsSongList);

function renderLsMods(who) {
  const cont = $(who === "p1" ? "lsP1Mods" : "lsP2Mods");
  cont.innerHTML = VS_MOD_LIST.map(([m, ico, nm]) =>
    `<button class="mod-toggle ${lsMods[who][m] ? "active" : ""}" data-who="${who}" data-mod="${m}">
      <span class="mod-ico">${ico}</span><span class="mod-name">${nm}</span></button>`
  ).join("");
  cont.querySelectorAll(".mod-toggle").forEach((b) => b.addEventListener("click", () => {
    const m = b.dataset.mod;
    lsMods[who][m] = !lsMods[who][m];
    // vanish/appear/hidden mutuamente excluyentes.
    if (lsMods[who][m] && ["vanish","appear","hidden"].includes(m)) {
      for (const o of ["vanish","appear","hidden"]) if (o !== m) lsMods[who][o] = false;
    }
    renderLsMods(who);
  }));
}

function renderLsPicked() {
  const cont = $("lsPicked");
  const chips = [];
  for (let i = 0; i < 3; i++) {
    if (lsPicked[i]) {
      chips.push(`<span class="setup-chip">${i + 1}. ${escapeHtml(lsPicked[i].name.length > 22 ? lsPicked[i].name.slice(0, 22) + "…" : lsPicked[i].name)}
        <button data-rm="${i}">✕</button></span>`);
    } else {
      chips.push(`<span class="setup-slot">${i + 1}</span>`);
    }
  }
  cont.innerHTML = chips.join("");
  cont.querySelectorAll("button[data-rm]").forEach((b) => b.addEventListener("click", () => {
    lsPicked.splice(Number(b.dataset.rm), 1); renderLsPicked(); renderLsSongList(); updateLsStart();
  }));
  updateLsStart();
}

function renderLsSongList() {
  const filter = ($("lsFilter").value || "").toLowerCase();
  const list = $("lsSongList");
  const songs = allSongs.filter((s) => s.name.toLowerCase().includes(filter));
  if (!songs.length) { list.innerHTML = '<p class="empty">No hay canciones.</p>'; return; }
  list.innerHTML = songs.map((s) => {
    const idx = lsPicked.findIndex((p) => p.id === s.id);
    const picked = idx >= 0;
    return `<div class="setup-songitem ${picked ? "picked" : ""}" data-id="${s.id}" data-name="${escapeHtml(s.name)}">
      <span class="si-num">${picked ? (idx + 1) : "+"}</span>
      <span class="si-title">${escapeHtml(s.name)}</span>
      ${s.hasVideo ? '<span class="song-chart">VIDEO</span>' : ""}
    </div>`;
  }).join("");
  list.querySelectorAll(".setup-songitem").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.id, name = b.dataset.name;
    const at = lsPicked.findIndex((p) => p.id === id);
    if (at >= 0) lsPicked.splice(at, 1);                 // quitar si ya estaba
    else if (lsPicked.length < 3) lsPicked.push({ id, name });
    renderLsPicked(); renderLsSongList();
  }));
}

function updateLsStart() {
  const ready = lsPicked.length === 3;
  $("lsStartBtn").disabled = !ready;
  $("lsHint").textContent = ready ? "¡Listo! Pulsa empezar." : `Elige ${3 - lsPicked.length} cancion(es) mas.`;
}

$("lsStartBtn") && $("lsStartBtn").addEventListener("click", () => {
  if (lsPicked.length !== 3) return;
  series = {
    active: true,
    songs: lsPicked.slice(),
    difficulty: $("lsDifficulty").value,
    lanes: $("lsStyle").value,
    players: [
      { speed: Number($("lsP1Speed").value), mods: { ...lsMods.p1 } },
      { speed: Number($("lsP2Speed").value), mods: { ...lsMods.p2 } },
    ],
    wins: [0, 0],
    round: 0,
  };
  playSeriesRound();
});

// Carga y lanza la cancion de la ronda actual de la serie.
async function playSeriesRound() {
  const song = series.songs[series.round];
  try {
    $("loadingSong").textContent = `Ronda ${series.round + 1}/3 — ${song.name}`;
    setLoading(0, "Preparando...");
    showScreen("loading");
    const beatmap = await fetchChartProgress(song.id, series.difficulty, series.lanes, null, (pct, label) => setLoading(pct * 0.85, label));
    if (!beatmap || !beatmap.notes || !beatmap.notes.length) throw new Error("La pista salio vacia");
    setLoading(88, "Cargando audio...");
    audioEl = await loadAudio(song.id);
    const useVideo = wantsVideo(song.id);
    if (useVideo) { setLoading(94, "Cargando video..."); await prepareVideo(song.id); }
    setLoading(100, "¡Listo!");
    startLocalVs(song.name, beatmap, { videoBg: useVideo, players: series.players });
  } catch (err) {
    console.error(err);
    cleanupLocalVs();
    if (audioEl) { try { audioEl.dispose(); } catch (_) {} audioEl = null; }
    showScreen("localSetup");
    alert("No se pudo iniciar la ronda:\n\n" + err.message);
  }
}

async function playLocalVs(id, name) {
  try {
    const difficulty = $("difficulty").value;
    const lanes = $("style").value;
    $("loadingSong").textContent = name + " — 2 jugadores";
    setLoading(0, "Preparando...");
    showScreen("loading");
    const beatmap = await fetchChartProgress(id, difficulty, lanes, null, (pct, label) => setLoading(pct * 0.85, label));
    if (!beatmap || !beatmap.notes || beatmap.notes.length === 0) {
      throw new Error("La pista salio vacia (¿ffmpeg instalado? ¿audio valido?)");
    }
    setLoading(88, "Cargando audio...");
    audioEl = await loadAudio(id);
    const useVideo = wantsVideo(id);
    if (useVideo) { setLoading(94, "Cargando video..."); await prepareVideo(id); }
    setLoading(100, "¡Listo!");
    lastPlay = { id, name, local2p: true };
    startLocalVs(name, beatmap, { videoBg: useVideo });
  } catch (err) {
    console.error(err);
    showScreen("menu");
    cleanupLocalVs();
    if (audioEl) { try { audioEl.dispose(); } catch (_) {} audioEl = null; }
    setStatus("Error: " + err.message);
    alert("No se pudo iniciar el VS local:\n\n" + err.message);
  }
}

function startLocalVs(name, beatmap, extra) {
  // Asegurar pantalla limpia.
  vs = { active: false, role: null, song: null, peerName: "RIVAL", peerFinal: null };
  $("vsHud").classList.add("hidden");
  $("hud").classList.add("hidden");          // ocultamos el HUD de 1 jugador
  $("lifebar-wrap").classList.add("hidden"); // cada jugador tiene su barra en el HUD local
  $("localVsHud").classList.remove("hidden");
  $("songName").textContent = name;
  $("three-container").innerHTML = "";
  $("rival-container").innerHTML = "";
  $("rival-container").classList.remove("hidden");
  $("boards").classList.add("vs");
  showScreen("game");
  setStatus("");

  if (extra && extra.videoBg) showVideo(); else teardownVideo();

  // Ajustes por jugador (velocidad + efectos propios); dificultad ya es comun
  // (esta en el beatmap). Si no se pasan (modo rapido 2P), usar los del menu.
  const cfg = (extra && extra.players) || null;
  const p1cfg = cfg ? cfg[0] : { speed: Number($("scrollSpeed").value), mods: { ...mods } };
  const p2cfg = cfg ? cfg[1] : { speed: Number($("scrollSpeed").value), mods: { ...mods } };
  // VS local pinta DOS escenas 3D a la vez (el doble de carga de GPU). En
  // calidad "auto" arrancamos mas bajo y dejamos que el bucle maestro ajuste.
  const userQuality = $("quality").value;
  const vsAdaptive = userQuality === "auto";
  const common = {
    quality: userQuality,
    audioOffset: Number(getPref("audioOffset")) || 0,
    videoBg: !!(extra && extra.videoBg),
    external: true,        // el orquestador controla audio y reloj
    allowFail: false,      // el orquestador gestiona el fallo (independiente)
    gameMode,
  };
  const s1 = Object.assign({}, common, { scrollSpeed: p1cfg.speed, mods: { ...p1cfg.mods } });
  const s2 = Object.assign({}, common, { scrollSpeed: p2cfg.speed, mods: { ...p2cfg.mods } });

  // Renderer WebGL UNICO para los dos tableros (pantalla partida con
  // viewports). Antes se creaban DOS contextos WebGL, lo que dejaba cada frame
  // al limite y hacia que el teclado (que mete trabajo en el hilo principal
  // entre frames) provocara tirones. Con un solo contexto hay margen de sobra.
  const sharedRenderer = new SharedRenderer($("boards"));
  s1.sharedRenderer = sharedRenderer;
  s2.sharedRenderer = sharedRenderer;

  // Dos InputManager con perfiles de teclas distintos.
  const i1 = new InputManager("p1"); i1.start();
  const i2 = new InputManager("p2"); i2.start();
  // Teclado sincronizado por frame: los eventos se procesan 1 vez por frame
  // (en pollGamepads), igual que el mando, para no interrumpir el render.
  i1.setFrameSync(true);
  i2.setFrameSync(true);
  // El input global ("all") es redundante aqui y procesaria las teclas de
  // ambos jugadores en cada pulsacion. Lo pausamos durante el VS local.
  try { input.stop(); } catch (_) {}

  // Marca a un jugador como derrotado: congela su tablero (deja de procesar su
  // input) y muestra FAILED, pero el otro jugador SIGUE jugando.
  const killPlayer = (idx) => {
    if (!localVs || localVs.dead[idx]) return;
    localVs.dead[idx] = true;
    const g = localVs.games[idx];
    const i = localVs.inputs[idx];
    try { i.stop(); } catch (_) {}        // ya no registra teclas
    g.running = false;                     // deja de actualizar/puntuar
    $("lvsP" + (idx + 1) + "Dead").classList.remove("hidden");
    const f = $("lvsP" + (idx + 1) + "Life");
    f.style.width = "0%"; f.classList.add("danger");
  };

  // HUD por jugador con BATCHING: en vez de escribir al DOM en cada acierto
  // (toLocaleString es lento en V8, y un acorde dispara varios aciertos en un
  // frame -> varias escrituras -> tiron), guardamos el ultimo valor y el master
  // loop lo vuelca UNA vez por frame. 'dirty' marca que hay cambios pendientes.
  const hud = {
    p1: { score: 0, combo: 0, life: 50, dScore: true, dCombo: true, dLife: true },
    p2: { score: 0, combo: 0, life: 50, dScore: true, dCombo: true, dLife: true },
  };
  const mkHooks = (key, idx) => ({
    onScore: (s) => { const h = hud[key]; h.score = s; h.dScore = true; },
    onCombo: (c) => { const h = hud[key]; h.combo = c; h.dCombo = true; },
    onLife: (life) => {
      const h = hud[key]; h.life = life; h.dLife = true;
      if (life <= 0) killPlayer(idx);     // fallo INDEPENDIENTE por jugador
    },
    // El juicio y countdown solo los maneja el master para no duplicar.
  });
  // Vuelca el HUD pendiente al DOM (1 vez por frame, desde el master loop).
  const flushHud = () => {
    for (const key of ["p1", "p2"]) {
      const h = hud[key];
      const pfx = key === "p1" ? "lvsP1" : "lvsP2";
      if (h.dScore) { $(pfx + "Score").textContent = h.score.toLocaleString(); h.dScore = false; }
      if (h.dCombo) { const el = $(pfx + "Combo"); el.textContent = "combo " + h.combo; el.classList.toggle("combo-hot", h.combo >= 5); h.dCombo = false; }
      if (h.dLife) { const f = $(pfx + "Life"); f.style.width = h.life + "%"; f.classList.toggle("danger", h.life <= 25); h.dLife = false; }
    }
  };

  const g1 = new RhythmGame($("three-container"), audioEl, beatmap, i1, Object.assign(mkHooks("p1", 0), {
    onCountdown: showCountdown,                      // el master pinta la cuenta atras
    onJudge: flashJudge,
  }), s1);
  const g2 = new RhythmGame($("rival-container"), audioEl, beatmap, i2, mkHooks("p2", 1), s2);

  // Reset visual de marcadores.
  for (const p of ["lvsP1", "lvsP2"]) {
    $(p + "Score").textContent = "0";
    $(p + "Combo").textContent = "combo 0";
    $(p + "Life").style.width = "50%";
    $(p + "Life").classList.remove("danger");
  }
  $("lvsP1Dead").classList.add("hidden");
  $("lvsP2Dead").classList.add("hidden");
  updateSeriesTag();

  localVs = { games: [g1, g2], inputs: [i1, i2], renderer: sharedRenderer, flushHud, raf: null, lastT: null, done: false, dead: [false, false], name,
    // Estado de calidad adaptativa del bucle maestro (solo si quality=="auto").
    adaptive: vsAdaptive, autoLevel: vsAdaptive ? 1 : 0, lowFpsStreak: 0, fpsAccum: 0, fpsFrames: 0 };

  // Arranque comun: ambos comparten el mismo instante de pared.
  const startWall = performance.now() / 1000;
  g1.settings.startAtSec = startWall;
  g2.settings.startAtSec = startWall;
  g1.start();
  g2.start();

  // Ya existen ambos stages: repartir viewports (mitad y mitad).
  sharedRenderer.layout();

  // Calidad adaptativa para VS local: como se pintan dos tableros, si el
  // usuario dejo "auto" arrancamos en "medium" y el bucle maestro baja a
  // "low" si hace falta. Si fijo una calidad concreta, se respeta.
  if (vsAdaptive) {
    try { g1.stage.setQuality("medium"); } catch (_) {}
    try { g2.stage.setQuality("medium"); } catch (_) {}
  }
  const loop = () => {
    if (!localVs) return;
    const t = performance.now();
    if (localVs.lastT == null) localVs.lastT = t;
    const dt = Math.min(0.05, (t - localVs.lastT) / 1000);
    localVs.lastT = t;

    // Calidad adaptativa: medimos FPS cada ~0.5s y, si cae sostenidamente y el
    // usuario dejo "auto", bajamos la calidad de AMBOS tableros (medium->low).
    // Tambien mostramos FPS + el peor frame (hitch) para diagnosticar tirones.
    localVs.fpsAccum += dt;
    localVs.fpsFrames++;
    if (dt > (localVs.worstDt || 0)) localVs.worstDt = dt;
    if (localVs.fpsAccum >= 0.5) {
      const fps = Math.round(localVs.fpsFrames / localVs.fpsAccum);
      const worstMs = Math.round((localVs.worstDt || 0) * 1000);
      $("fps").textContent = `${fps} fps · peor ${worstMs}ms`;
      localVs.fpsAccum = 0;
      localVs.fpsFrames = 0;
      localVs.worstDt = 0;
      if (localVs.adaptive) {
        if (fps < 50) localVs.lowFpsStreak++;
        else localVs.lowFpsStreak = Math.max(0, localVs.lowFpsStreak - 1);
        if (localVs.lowFpsStreak >= 3 && localVs.autoLevel < 2) {
          localVs.autoLevel++;
          const lvl = "low";   // de medium ya solo queda bajar a low
          try { g1.stage.setQuality(lvl); } catch (_) {}
          try { g2.stage.setQuality(lvl); } catch (_) {}
          localVs.lowFpsStreak = 0;
        }
      }
    }
    let now;
    if (!localVs.audioPlaying) {
      now = t / 1000 - startWall - g1.leadIn;
      if (now >= 0) { localVs.audioPlaying = true; audioEl.play(now); }
    } else {
      now = audioEl.currentTime() - common.audioOffset / 1000;
    }

    if (videoActive) syncVideo(now);
    showCountdown(now < 0 ? Math.ceil(-now) : 0);

    g1.tick(now, dt);
    g2.tick(now, dt);
    // Volcar el HUD (score/combo/vida) UNA vez por frame, no por acierto.
    localVs.flushHud();
    // Un solo render para ambos tableros (dos viewports del mismo lienzo).
    localVs.renderer.render();

    // Fin: cuando ambos terminaron (cancion completa o ambos derrotados), o el
    // audio paso del final. Si uno fallo, el otro sigue hasta el final.
    const bothDone = (!g1.running && !g2.running);
    if (bothDone || now > beatmap.duration + 2) {
      finishLocalVs();
      return;
    }
    localVs.raf = requestAnimationFrame(loop);
  };
  localVs.raf = requestAnimationFrame(loop);
}

// Refresca la etiqueta de serie (ronda X/3 y marcador de victorias).
function updateSeriesTag() {
  const tag = $("seriesTag");
  if (!series.active) { tag.classList.add("hidden"); return; }
  tag.classList.remove("hidden");
  tag.innerHTML = `<div class="series-round">RONDA ${series.round + 1} / ${series.songs.length}</div>
    <div class="series-wins"><span class="sw-p1">${series.wins[0]}</span> — <span class="sw-p2">${series.wins[1]}</span></div>`;
}

function finishLocalVs() {
  if (!localVs || localVs.done) return;
  localVs.done = true;
  if (localVs.raf) cancelAnimationFrame(localVs.raf);
  const [g1, g2] = localVs.games;
  const dead = localVs.dead.slice();
  const sharedRenderer = localVs.renderer;
  // Asegurar que ambos esten detenidos.
  try { g1.stop(); } catch (_) {}
  try { g2.stop(); } catch (_) {}
  const r1 = resultOf(g1, dead[0]), r2 = resultOf(g2, dead[1]);
  for (const i of localVs.inputs) { try { i.stop(); } catch (_) {} }
  if (sharedRenderer) { try { sharedRenderer.dispose(); } catch (_) {} }  // destruir el contexto GL compartido
  try { input.start(); } catch (_) {}   // reactivar el input global del menu
  if (audioEl) { try { audioEl.stopSource(); } catch (_) {} }
  teardownVideo();
  localVs = null;

  // Ganador de la ronda: sobreviviente si uno fallo; si no, mayor puntaje.
  let roundWinner; // 0 empate, 1 = J1, 2 = J2
  if (r1.failed && !r2.failed) roundWinner = 2;
  else if (r2.failed && !r1.failed) roundWinner = 1;
  else roundWinner = r1.score === r2.score ? 0 : (r1.score > r2.score ? 1 : 2);

  if (series.active) {
    if (roundWinner === 1) series.wins[0]++;
    else if (roundWinner === 2) series.wins[1]++;
    showSeriesRoundResults(r1, r2, roundWinner);
  } else {
    showLocalVsResults(r1, r2, roundWinner);
  }
}

// Construye un resumen de resultados a partir de un RhythmGame terminado.
function resultOf(g, failed) {
  const total = g.notes.length || 1;
  const hits = g.counts.PERFECT + g.counts.GREAT + g.counts.GOOD + g.counts.OK;
  const accuracy = Math.round((hits / total) * 1000) / 10;
  return { score: g.score, maxCombo: g.maxCombo, counts: g.counts, accuracy, life: Math.round(g.life), failed: !!failed };
}

function cleanupLocalVs() {
  if (!localVs) return;
  if (localVs.raf) cancelAnimationFrame(localVs.raf);
  for (const g of localVs.games) { try { g.stop(); } catch (_) {} }
  for (const i of localVs.inputs) { try { i.stop(); } catch (_) {} }
  if (localVs.renderer) { try { localVs.renderer.dispose(); } catch (_) {} }
  try { input.start(); } catch (_) {}   // reactivar el input global del menu
  localVs = null;
}

// Muestra los resultados de UNA partida 2P rapida (sin serie).
function showLocalVsResults(r1, r2, winner) {
  if (audioEl) { try { audioEl.dispose(); } catch (_) {} audioEl = null; }
  restoreSoloHud();

  const title = $("resultsTitle");
  if (title) title.textContent = "VS Local — 2 jugadores";
  $("grade").textContent = winner === 0 ? "EMPATE" : "GANA J" + winner;
  $("grade").className = "grade " + (winner === 0 ? "grade-B" : "grade-S");
  $("vsResult").classList.add("hidden");
  fillLocalResultsBody(r1, r2);

  const right = document.querySelector(".results-right");
  if (right) { right.classList.remove("hidden"); right.classList.remove("vs-mode"); }
  $("rDifficulty").value = $("difficulty").value;
  $("rSpeed").value = $("scrollSpeed").value;
  $("rSpeedVal").textContent = Number($("scrollSpeed").value).toFixed(1) + "x";
  $("rVolume").value = $("volume").value;
  $("rVolumeVal").textContent = $("volume").value + "%";
  syncModButtons();
  $("retryBtn").classList.remove("hidden");
  $("rematchBtn").classList.add("hidden");
  showScreen("results");
}

// Restaura el HUD del modo solo (tras VS local).
function restoreSoloHud() {
  $("hud").classList.remove("hidden");
  $("lifebar-wrap").classList.remove("hidden");
  $("localVsHud").classList.add("hidden");
  $("seriesTag").classList.add("hidden");
  $("boards").classList.remove("vs");
  $("rival-container").classList.add("hidden");
  const sb = $("seriesBtns"); if (sb) sb.remove();
}

// Tabla comparativa J1 vs J2.
function fillLocalResultsBody(r1, r2) {
  const fmt = (n) => n.toLocaleString();
  $("resultsBody").innerHTML = `
    <div class="rk"></div><div class="rv lvs-head"><strong>J1</strong> · <strong>J2</strong></div>
    <div class="rk">Estado</div><div class="rv">${r1.failed ? "FAILED" : "OK"} · ${r2.failed ? "FAILED" : "OK"}</div>
    <div class="rk">Puntos</div><div class="rv">${fmt(r1.score)} · ${fmt(r2.score)}</div>
    <div class="rk">Precision</div><div class="rv">${r1.accuracy}% · ${r2.accuracy}%</div>
    <div class="rk">Combo max</div><div class="rv">${r1.maxCombo} · ${r2.maxCombo}</div>
    <div class="rk">Vida final</div><div class="rv">${r1.life}% · ${r2.life}%</div>
    <div class="rk">Perfect</div><div class="rv">${r1.counts.PERFECT} · ${r2.counts.PERFECT}</div>
    <div class="rk">Miss</div><div class="rv">${r1.counts.MISS} · ${r2.counts.MISS}</div>`;
}

// Resultados de una RONDA de la serie (mejor de 3): muestra marcador y avanza.
function showSeriesRoundResults(r1, r2, roundWinner) {
  if (audioEl) { try { audioEl.dispose(); } catch (_) {} audioEl = null; }
  restoreSoloHud();

  // ¿Ya hay un campeon? (alguien llego a 2 victorias, o se jugaron las 3).
  const needed = 2; // mejor de 3
  const champ = series.wins[0] >= needed ? 1 : (series.wins[1] >= needed ? 2 : 0);
  const lastRound = series.round >= series.songs.length - 1;
  const seriesOver = champ !== 0 || lastRound;

  const title = $("resultsTitle");
  if (seriesOver) {
    // Campeon final: el de mas victorias (o empate si quedaron iguales).
    const finalChamp = series.wins[0] === series.wins[1] ? 0 : (series.wins[0] > series.wins[1] ? 1 : 2);
    if (title) title.textContent = `Serie terminada · ${series.wins[0]} — ${series.wins[1]}`;
    $("grade").textContent = finalChamp === 0 ? "EMPATE" : "CAMPEON J" + finalChamp;
    $("grade").className = "grade " + (finalChamp === 0 ? "grade-B" : "grade-S");
  } else {
    if (title) title.textContent = `Ronda ${series.round + 1} · ${roundWinner === 0 ? "Empate" : "Gana J" + roundWinner} · Serie ${series.wins[0]}—${series.wins[1]}`;
    $("grade").textContent = roundWinner === 0 ? "EMPATE" : "RONDA J" + roundWinner;
    $("grade").className = "grade " + (roundWinner === 0 ? "grade-B" : "grade-S");
  }
  $("vsResult").classList.add("hidden");
  fillLocalResultsBody(r1, r2);

  // Botones: en medio de la serie -> "Siguiente ronda". Al final -> "Menu".
  const right = document.querySelector(".results-right");
  if (right) { right.classList.add("hidden"); }   // sin panel de ajustes en serie
  $("retryBtn").classList.add("hidden");
  $("rematchBtn").classList.add("hidden");
  showSeriesButtons(seriesOver);
  showScreen("results");
}

// Coloca botones de navegacion de la serie en la zona de resultados.
function showSeriesButtons(seriesOver) {
  let bar = $("seriesBtns");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "seriesBtns";
    bar.className = "results-buttons";
    document.querySelector(".results-left").appendChild(bar);
  }
  if (seriesOver) {
    bar.innerHTML = `<button id="seriesMenuBtn" class="btn btn-accent">Menu</button>
      <button id="seriesAgainBtn" class="btn">Otra serie</button>`;
    $("seriesMenuBtn").addEventListener("click", () => { series.active = false; showScreen("menu"); document.querySelector('.tab[data-tab="play"]').click(); });
    $("seriesAgainBtn").addEventListener("click", () => { openLocalSetup(); });
  } else {
    bar.innerHTML = `<button id="seriesNextBtn" class="btn btn-accent">Siguiente ronda →</button>`;
    $("seriesNextBtn").addEventListener("click", () => { series.round++; playSeriesRound(); });
  }
}

// ---------- Controles tactiles (moviles) ----------
// Detecta si el dispositivo es tactil para mostrar los botones por carril.
const IS_TOUCH = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

function setupTouchControls(inp, laneCount) {
  const cont = $("touchControls");
  if (!cont) return;
  if (!IS_TOUCH) { cont.classList.add("hidden"); return; }
  // Colores e iconos segun el juego (gemas en guitar, flechas en dance).
  const colors = gameMode === "guitar"
    ? (GUITAR_LANE_COLORS[laneCount] || GUITAR_LANE_COLORS[5])
    : LANE_COLORS[laneCount];
  const labels = gameMode === "guitar" ? null : null;
  inp.bindTouch(cont, colors, labels);
  cont.classList.remove("hidden");
}
function teardownTouchControls(inp) {
  const cont = $("touchControls");
  if (cont) cont.classList.add("hidden");
  if (inp && inp.unbindTouch) inp.unbindTouch();
}

// ---------- Jugar (solo) ----------
async function playSong(id, name) {
  try {
    const difficulty = $("difficulty").value;
    const lanes = $("style").value;
    // Pantalla de carga con progreso real.
    $("loadingSong").textContent = name;
    setLoading(0, "Preparando...");
    showScreen("loading");
    const beatmap = await fetchChartProgress(id, difficulty, lanes, null, (pct, label) => setLoading(pct * 0.85, label));
    if (!beatmap || !beatmap.notes || beatmap.notes.length === 0) {
      throw new Error("La pista salio vacia (¿ffmpeg instalado? ¿audio valido?)");
    }
    setLoading(88, "Cargando audio...");
    audioEl = await loadAudio(id);
    // Preparar el video de fondo si la cancion lo tiene y esta activado.
    const useVideo = wantsVideo(id);
    if (useVideo) { setLoading(94, "Cargando video..."); await prepareVideo(id); }
    setLoading(100, "¡Listo!");
    vs = { active: false, role: null, song: null, peerName: "RIVAL", peerFinal: null };
    lastPlay = { id, name };   // recordar para "Reintentar"
    const genreLabel = $("genre").value === "auto" ? ` · genero: ${beatmap.genre}` : "";
    setStatus(`BPM ~${beatmap.bpm} · ${beatmap.notes.length} notas${genreLabel}.`);
    startGame(name, beatmap, { videoBg: useVideo });
  } catch (err) {
    console.error(err);
    // Asegurar que el usuario VEA el error (no quedarse en pantalla negra).
    showScreen("menu");
    if (currentGame) { try { currentGame.stop(); } catch (_) {} currentGame = null; }
    if (audioEl) { try { audioEl.dispose(); } catch (_) {} audioEl = null; }
    setStatus("Error: " + err.message);
    alert("No se pudo iniciar la cancion:\n\n" + err.message);
  }
}

function startGame(name, beatmap, extra) {
  $("songName").textContent = name;
  $("score").textContent = "0";
  $("combo").textContent = "0";
  $("lifebar-fill").style.width = "50%";
  $("lifebar-fill").classList.remove("danger");
  $("three-container").innerHTML = "";
  $("vsHud").classList.toggle("hidden", !vs.active);
  if (vs.active) {
    $("vsMyScore").textContent = "0";
    $("vsPeerScore").textContent = "0";
    $("vsPeerName").textContent = vs.peerName;
    const pf = $("vsPeerLifeFill");
    if (pf) { pf.style.width = "50%"; pf.classList.remove("danger"); }
  }
  showScreen("game");
  setStatus("");

  const settings = Object.assign({ scrollSpeed: Number($("scrollSpeed").value), quality: $("quality").value, mods: { ...mods }, audioOffset: Number(getPref("audioOffset")) || 0, videoBg: !!(extra && extra.videoBg), gameMode }, extra);
  if (vs.active) settings.online = online;

  // Activar el video de fondo de esta partida (si se preparo).
  if (settings.videoBg) showVideo(); else teardownVideo();

  let gpuShort = "";
  currentGame = new RhythmGame($("three-container"), audioEl, beatmap, input, {
    onScore: (s) => {
      $("score").textContent = s.toLocaleString();
      if (vs.active) $("vsMyScore").textContent = s.toLocaleString();
    },
    onCombo: (c) => {
      const el = $("combo");
      el.textContent = c;
      // Resaltar el combo cuando esta "activo" (>=5).
      el.classList.toggle("combo-hot", c >= 5);
    },
    onJudge: flashJudge,
    onLife: (life) => {
      const fill = $("lifebar-fill");
      fill.style.width = life + "%";
      fill.classList.toggle("danger", life <= 25);
    },
    onEnd: showResults,
    onCountdown: showCountdown,
    onAutoFx: (m) => {
      // En modos auto, reflejar los efectos activos en los botones del menu.
      Object.assign(mods, m);
      syncModButtons();
    },
    onTick: (now, dt) => {
      // Sincronizar el video de fondo con el reloj de la cancion.
      if (videoActive) syncVideo(now);
      // Conduce el tablero del rival en sincronia con el reloj de la cancion.
      if (rivalBoard) {
        if (rivalPending) { rivalBoard.applyResolved(rivalPending.resolved, rivalPending.lastHit); rivalPending = null; }
        rivalBoard.update(dt, now);
        rivalBoard.render();
      }
    },
    onFps: (f, st) => {
      $("fps").textContent = st ? `${f} fps · ${st.cpuMs}ms · ${st.draws} draws` : `${f} fps`;
    },
    onQuality: (q) => { $("fps").title = "Calidad ajustada a: " + q; },
  }, settings);

  // Tablero del rival (solo en VS): muestra sus flechas en tiempo real.
  if (rivalBoard) { try { rivalBoard.dispose(); } catch (_) {} rivalBoard = null; }
  if (vs.active) {
    $("rival-container").classList.remove("hidden");
    $("boards").classList.add("vs");
    rivalBoard = new RivalBoard($("rival-container"), beatmap, { scrollSpeed: Number($("scrollSpeed").value), gameMode });
  } else {
    $("rival-container").classList.add("hidden");
    $("boards").classList.remove("vs");
  }

  currentGame.start();

  // Controles tactiles (moviles): botones por carril conectados al input solo.
  setupTouchControls(input, beatmap.laneCount);

  // Diagnostico: si el navegador renderiza por software (sin GPU), avisar.
  // Es la causa tipica de fps bajos con poquisimos draws en una PC potente.
  const glName = currentGame.stage.glRenderer();
  const soft = currentGame.stage.isSoftwareRender();
  gpuShort = soft ? "SOFTWARE!" : (glName.length > 24 ? glName.slice(0, 24) : glName);
  console.log("GPU / renderer GL:", glName, soft ? "(SOFTWARE!)" : "(hardware)");
  setStatus((soft ? "⚠ Render por SOFTWARE: " : "GPU: ") + glName);
  $("fps").title = (soft ? "ATENCION render por software: " : "GPU: ") + glName;
}

// ---------- Indicadores de juego ----------
// Indicador de juicio. Animacion CSS reiniciada por clase; el reflow puntual
// aqui es barato comparado con crear objetos de animacion por acierto.
// Indicador de juicio. Para evitar "layout thrashing" cuando se pisan varias
// notas a la vez (un acorde dispara varios juicios en el mismo frame), NO
// forzamos un reflow por cada llamada. Coalescemos: guardamos el ultimo juicio
// y hacemos UN solo reinicio de animacion por frame (en un requestAnimationFrame).
let _pendingJudge = null;
let _judgeRaf = 0;
function flashJudge(name, color) {
  _pendingJudge = { name, color };
  if (_judgeRaf) return;                 // ya hay un flush programado para este frame
  _judgeRaf = requestAnimationFrame(() => {
    _judgeRaf = 0;
    const jd = _pendingJudge; _pendingJudge = null;
    if (!jd) return;
    const j = $("judgement");
    j.textContent = jd.name;
    j.style.color = jd.color;
    // Reiniciar la animacion CSS. El reflow forzado (offsetWidth) ahora ocurre
    // como MUCHO una vez por frame, no una vez por nota.
    j.classList.remove("show");
    void j.offsetWidth;
    j.classList.add("show");
  });
}
function showCountdown(n) {
  const c = $("countdown");
  const txt = n > 0 ? String(n) : "";
  // Evitar escrituras al DOM cada frame (el master loop llama esto siempre):
  // solo tocar el DOM cuando el valor cambia.
  if (c._lastTxt === txt) return;
  c._lastTxt = txt;
  c.textContent = txt;
  c.style.opacity = n > 0 ? "1" : "0";
}

$("quitBtn").addEventListener("click", quitToMenu);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && screens.game.classList.contains("active")) quitToMenu();
});
function quitToMenu() {
  if (localVs) { cleanupLocalVs(); }
  series.active = false;                         // abandonar serie si la habia
  const sb = $("seriesBtns"); if (sb) sb.remove();
  if (currentGame) { currentGame.stop(); currentGame = null; }
  if (rivalBoard) { try { rivalBoard.dispose(); } catch (_) {} rivalBoard = null; }
  if (audioEl) { audioEl.dispose(); audioEl = null; }
  teardownVideo();
  teardownTouchControls(input);
  // Restaurar HUD normal por si veniamos de VS local.
  $("hud").classList.remove("hidden");
  $("lifebar-wrap").classList.remove("hidden");
  $("localVsHud").classList.add("hidden");
  $("seriesTag").classList.add("hidden");
  if (vs.active) { online.leave(); vs.active = false; }
  $("boards").classList.remove("vs");
  $("rival-container").classList.add("hidden");
  setStatus(""); showScreen("menu");
}

// ---------- Resultados ----------
function showResults(res) {
  currentGame = null;
  if (rivalBoard) { try { rivalBoard.dispose(); } catch (_) {} rivalBoard = null; }
  $("boards").classList.remove("vs");
  $("rival-container").classList.add("hidden");
  const sb = $("seriesBtns"); if (sb) sb.remove();  // limpiar botones de serie si los hubo
  teardownVideo();
  teardownTouchControls(input);
  if (audioEl) { audioEl.dispose(); audioEl = null; }

  const title = $("resultsTitle");
  if (res.failed) {
    $("grade").textContent = "FAILED";
    $("grade").className = "grade grade-F";
    if (title) title.textContent = "Te quedaste sin vida";
  } else {
    $("grade").textContent = res.grade;
    $("grade").className = "grade grade-" + res.grade;
    if (title) title.textContent = "Resultados";
  }

  const vsEl = $("vsResult");
  if (vs.active) {
    vsEl.classList.remove("hidden");
    decideVsOutcome(res);
  } else {
    vsEl.classList.add("hidden");
  }

  const rows = [
    ["Precision", res.accuracy + "%"], ["Puntos", res.score.toLocaleString()],
    ["Vida final", (res.life != null ? res.life : "-") + "%"],
    ["Combo max", res.maxCombo], ["Perfect", res.counts.PERFECT],
    ["Great", res.counts.GREAT], ["Good", res.counts.GOOD],
    ["Ok", res.counts.OK], ["Miss", res.counts.MISS],
    ["Teclas erradas", res.wrongPresses != null ? res.wrongPresses : 0],
  ];
  $("resultsBody").innerHTML = rows.map(([k, v]) => `<div class="rk">${k}</div><div class="rv">${v}</div>`).join("");

  // Guardar puntaje (solo modo solo, no VS). Se guarda SIEMPRE que termines la
  // cancion (antes solo si NO fallabas, asi se perdian buenos puntajes al morir
  // al final). El motor solo actualiza el "mejor" si supera el anterior.
  if (!vs.active && lastPlay) {
    const prevBest = (songScores[lastPlay.id] && songScores[lastPlay.id].best && songScores[lastPlay.id].best.score) || 0;
    fetch(`/api/score/${lastPlay.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: lastPlay.name, score: res.score, accuracy: res.accuracy, grade: res.grade, difficulty: $("difficulty").value, maxCombo: res.maxCombo, game: gameMode }),
    }).then((r) => r.json()).then((j) => {
      if (j.entry && lastPlay) {
        songScores[lastPlay.id] = j.entry;
        // Indicar al usuario si batio su record (feedback claro de que SI se guarda).
        if (!res.failed && res.score > prevBest && res.score === j.entry.best.score) {
          const t = $("resultsTitle");
          if (t) t.innerHTML = 'Resultados <span class="record-badge">★ ¡NUEVO RÉCORD!</span>';
        }
      }
    }).catch(() => {});
  }

  // Sincronizar el panel de ajustes de reintento con las opciones actuales.
  $("rDifficulty").value = $("difficulty").value;
  $("rSpeed").value = $("scrollSpeed").value;
  $("rSpeedVal").textContent = Number($("scrollSpeed").value).toFixed(1) + "x";
  $("rVolume").value = $("volume").value;
  $("rVolumeVal").textContent = $("volume").value + "%";
  syncModButtons();
  // En VS: ocultar ajustes de reintento solo, pero mostrar el panel con el
  // boton de Revancha (jugar de nuevo sin salir de la sala).
  const right = document.querySelector(".results-right");
  if (right) {
    right.classList.remove("hidden");
    right.classList.toggle("vs-mode", vs.active);
  }
  $("retryBtn").classList.toggle("hidden", vs.active);
  $("rematchBtn").classList.toggle("hidden", !vs.active);
  $("rematchBtn").disabled = false;
  $("rematchBtn").textContent = "⚔ Revancha";
  vsRematch = { me: false, peer: false };

  showScreen("results");
}

function decideVsOutcome(res) {
  const vsEl = $("vsResult");
  const myScore = res.score;
  if (vs.peerFinal != null) {
    const win = myScore >= vs.peerFinal.score;
    tallyOnlineRound(myScore, vs.peerFinal.score);
    const serie = ` · Serie ${onlineSeries.mine}—${onlineSeries.peer}`;
    vsEl.textContent = (win ? `GANASTE  (${myScore.toLocaleString()} vs ${vs.peerFinal.score.toLocaleString()})`
                            : `Perdiste  (${myScore.toLocaleString()} vs ${vs.peerFinal.score.toLocaleString()})`) + serie;
    vsEl.className = "vs-result " + (win ? "win" : "lose");
    maybeAnnounceOnlineChamp(vsEl);
  } else {
    vsEl.textContent = `Tu puntaje: ${myScore.toLocaleString()} — esperando al rival...`;
    vsEl.className = "vs-result";
  }
}

// Suma la ronda al marcador de la serie (una sola vez por ronda).
function tallyOnlineRound(myScore, peerScore) {
  if (onlineSeries._roundCounted === onlineSeries.round) return;
  onlineSeries._roundCounted = onlineSeries.round;
  if (myScore > peerScore) onlineSeries.mine++;
  else if (peerScore > myScore) onlineSeries.peer++;
  // empate: no suma a nadie
}

// Si alguien llego a 2 victorias (mejor de 3), anunciar campeon de la serie.
function maybeAnnounceOnlineChamp(vsEl) {
  if (onlineSeries.mine >= 2 || onlineSeries.peer >= 2 || onlineSeries.round >= 2) {
    onlineSeries.decided = true;
    const champ = onlineSeries.mine === onlineSeries.peer ? 0 : (onlineSeries.mine > onlineSeries.peer ? 1 : 2);
    vsEl.textContent += champ === 0 ? " · SERIE EMPATADA" : (champ === 1 ? " · ¡GANASTE LA SERIE!" : " · perdiste la serie");
  }
}

$("againBtn").addEventListener("click", () => {
  if (vs.active) { online.leave(); vs.active = false; $("onlineRoom").classList.add("hidden"); $("onlineLobby").classList.remove("hidden"); }
  setStatus(""); showScreen("menu");
});

// Sliders del panel de resultados (reflejan y aplican a las opciones reales).
$("rSpeed").addEventListener("input", () => {
  $("rSpeedVal").textContent = Number($("rSpeed").value).toFixed(1) + "x";
  $("scrollSpeed").value = $("rSpeed").value;
  $("scrollSpeedVal").textContent = Number($("rSpeed").value).toFixed(1) + "x";
});
$("rVolume").addEventListener("input", () => {
  $("rVolumeVal").textContent = $("rVolume").value + "%";
  $("volume").value = $("rVolume").value;
  $("volumeVal").textContent = $("rVolume").value + "%";
  if (audioEl) audioEl.setVolume(Number($("rVolume").value) / 100);
});
$("rDifficulty").addEventListener("change", () => { $("difficulty").value = $("rDifficulty").value; });

// Reintentar: reaplica los ajustes elegidos y vuelve a jugar la misma cancion.
$("retryBtn").addEventListener("click", () => {
  if (!lastPlay) { showScreen("menu"); return; }
  // Si la ultima partida fue VS local, relanzar en 2 jugadores.
  if (lastPlay.local2p) { playLocalVs(lastPlay.id, lastPlay.name); return; }
  // Las opciones ya estan sincronizadas (rSpeed/rVolume/rDifficulty escriben en
  // las reales; los mods comparten estado). Solo relanzamos.
  playSong(lastPlay.id, lastPlay.name);
});

// Revancha (VS): ambos jugadores deben pedirla. Cuando los dos aceptan, el
// host vuelve a arrancar la MISMA cancion sin salir de la sala.
$("rematchBtn").addEventListener("click", () => {
  if (!vs.active) return;
  vsRematch.me = true;
  $("rematchBtn").disabled = true;
  $("rematchBtn").textContent = vsRematch.peer ? "Reiniciando..." : "Esperando al rival...";
  online.rematch();
  maybeStartRematch();
});

online.on("peerRematch", () => {
  vsRematch.peer = true;
  if (!vsRematch.me) $("rematchBtn").textContent = "⚔ El rival quiere revancha";
  maybeStartRematch();
});
online.on("rematchReady", async (m) => {
  // Ambos aceptaron: reseteamos estado y recargamos audio para volver a jugar.
  if (!roomState.song) return;
  roomState.meReady = false; roomState.peerReady = false;
  try {
    if (audioEl) { audioEl.dispose(); audioEl = null; }
    audioEl = await loadAudio(roomState.song.id);
  } catch (e) { setStatus("Error recargando audio: " + e.message); showScreen("menu"); return; }
  vs.peerFinal = null;
  roomState.meReady = true;
  online.ready();   // marcar listo; el host arranca cuando ambos esten listos
});

function maybeStartRematch() {
  // El host coordina: cuando ambos pidieron revancha, el servidor envia
  // "rematchReady" (gestionado arriba). Esta funcion solo refresca el texto.
  if (vsRematch.me && vsRematch.peer) {
    $("rematchBtn").textContent = "Reiniciando...";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ---------- Descargador ----------
$("dlSearchBtn").addEventListener("click", doSearch);
$("dlQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

async function doSearch() {
  const q = $("dlQuery").value.trim();
  if (!q) return;
  const box = $("dlResults");
  box.innerHTML = '<p class="empty">Buscando...</p>';
  try {
    const r = await fetch("/api/search?q=" + encodeURIComponent(q));
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    if (!j.results.length) { box.innerHTML = '<p class="empty">Sin resultados.</p>'; return; }
    box.innerHTML = j.results.map((x, i) => `
      <div class="dl-item" data-url="${escapeHtml(x.url)}" data-idx="${i}">
        <span class="dl-title">${escapeHtml(x.title)}</span>
        <span class="dl-meta">${fmtDuration(x.duration)}</span>
        <button class="mini-btn dl-go">Descargar</button>
        <span class="dl-prog"></span>
      </div>`).join("");
    box.querySelectorAll(".dl-item").forEach((item) => {
      item.querySelector(".dl-go").addEventListener("click", () => downloadItem(item));
    });
  } catch (e) {
    const msg = (e.message || "").toLowerCase();
    if (msg.includes("yt-dlp") || msg.includes("enoent") || msg.includes("no disponible")) {
      box.innerHTML = '<p class="empty">El buscador necesita <strong>yt-dlp</strong> instalado en esta PC.<br>Mira COMO-USAR.md para instalarlo.</p>';
    } else {
      box.innerHTML = `<p class="empty">Error: ${escapeHtml(e.message)}</p>`;
    }
  }
}

function downloadItem(item) {
  const url = item.dataset.url;
  const folder = $("dlFolder").value.trim();
  const prog = item.querySelector(".dl-prog");
  const btn = item.querySelector(".dl-go");
  btn.disabled = true;
  prog.textContent = "0%";

  const qs = new URLSearchParams({ url });
  if (folder) qs.set("folder", folder);
  if ($("dlVideo").checked) qs.set("video", "1");
  const es = new EventSource("/api/download?" + qs.toString());
  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === "progress") prog.textContent = `${Math.round(d.percent)}% ${d.stage}`;
    else if (d.type === "done") { prog.textContent = "✓ listo"; btn.textContent = "Descargado"; es.close(); loadSongs(); }
    else if (d.type === "error") {
      prog.textContent = "error";
      btn.disabled = false;
      es.close();
      const msg = (d.message || "").toLowerCase();
      if (msg.includes("yt-dlp") || msg.includes("no disponible") || msg.includes("enoent")) {
        alert("El descargador necesita yt-dlp instalado en esta PC.\nMira COMO-USAR.md para instalarlo.");
      } else {
        alert("Error al descargar:\n\n" + (d.message || "desconocido"));
      }
    }
  };
  es.onerror = () => { es.close(); btn.disabled = false; };
}

function fmtDuration(s) {
  if (!s) return "";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ---------- Online VS ----------
let roomState = { inRoom: false, peers: [], peerReady: false, meReady: false, song: null };

$("createRoomBtn").addEventListener("click", async () => {
  const name = $("playerName").value.trim() || "Jugador";
  try { await online.create(name); } catch (e) { setRoomStatus("Error: " + e.message); }
});

// Crear sala + enlace publico para compartir (modo facil).
$("createLinkBtn").addEventListener("click", async () => {
  const name = $("playerName").value.trim() || "Jugador";
  const btn = $("createLinkBtn");
  btn.disabled = true; btn.textContent = "Creando enlace...";
  try {
    // 1. crear sala en nuestro propio servidor
    online.setRelayHost("");
    await online.create(name);
    // 2. abrir tunel publico
    const r = await fetch("/api/tunnel", { method: "POST" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "No se pudo crear el enlace");
    // 3. construir URL con el codigo embebido para auto-union
    const shareUrl = `${j.url}/#join=${online.code}`;
    $("shareUrl").value = shareUrl;
    $("shareBox").classList.remove("hidden");
    if (j.publicIp) {
      $("sharePass").innerHTML = `Si a tu amigo le sale una pagina azul de aviso ("loca.lt"), `
        + `que escriba esta clave y pulse continuar: <strong>${j.publicIp}</strong><br>`
        + `Despues entrara directo a tu sala. No necesita tener la cancion: se reproduce desde tu PC.`;
    } else {
      $("sharePass").innerHTML = `Tu amigo solo abre el enlace y entra. No necesita tener la cancion: se reproduce desde tu PC.`;
    }
    setRoomStatus("Enlace listo. Compartelo con tu amigo.");
  } catch (e) {
    setRoomStatus("Error: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "Crear sala + enlace para compartir";
  }
});

$("copyUrlBtn").addEventListener("click", async () => {
  const url = $("shareUrl").value;
  try { await navigator.clipboard.writeText(url); $("copyUrlBtn").textContent = "Copiado!"; setTimeout(() => ($("copyUrlBtn").textContent = "Copiar"), 1500); }
  catch (_) { $("shareUrl").select(); document.execCommand("copy"); }
});
$("joinRoomBtn").addEventListener("click", async () => {
  const name = $("playerName").value.trim() || "Jugador";
  const code = $("roomCode").value.trim().toUpperCase();
  if (code.length !== 4) return setRoomStatus("Escribe el codigo de 4 letras");
  online.setRelayHost($("relayHost").value);
  try { await online.join(code, name); } catch (e) { setRoomStatus("Error: " + e.message); }
});
$("leaveRoomBtn").addEventListener("click", () => {
  online.leave();
  roomState = { inRoom: false, peers: [], peerReady: false, meReady: false, song: null };
  $("onlineRoom").classList.add("hidden");
  $("onlineLobby").classList.remove("hidden");
});
$("readyBtn").addEventListener("click", async () => {
  if (!roomState.song) { setRoomStatus("Aun no hay cancion lista."); return; }
  $("readyBtn").disabled = true;
  $("readyBtn").textContent = "Cargando audio...";
  // Precargar el audio AHORA (decodificar puede tardar 1-3s); asi al recibir
  // "go" arrancamos al instante y ambos quedan sincronizados.
  try {
    if (audioEl) { audioEl.dispose(); audioEl = null; }
    audioEl = await loadAudio(roomState.song.id);
  } catch (e) {
    setRoomStatus("Error cargando audio: " + e.message);
    $("readyBtn").disabled = false; $("readyBtn").textContent = "Listo";
    return;
  }
  roomState.meReady = true;
  $("readyBtn").textContent = "Esperando al rival...";
  online.ready();
  renderRoomPlayers();
});

function setRoomStatus(msg) { $("roomStatus").textContent = msg; }

function enterRoomView() {
  $("onlineLobby").classList.add("hidden");
  $("onlineRoom").classList.remove("hidden");
  $("roomCodeDisplay").textContent = online.code;
  roomState.inRoom = true;
  // Nueva serie "mejor de 3" al entrar a la sala.
  onlineSeries = { mine: 0, peer: 0, round: 0, decided: false, _roundCounted: -1 };
  renderRoomPlayers();
}

function renderRoomPlayers() {
  const me = ($("playerName").value.trim() || "Jugador") + (online.role === "host" ? " (host)" : "");
  const cells = [`<div class="room-player ${roomState.meReady ? "ready" : ""}">${escapeHtml(me)} ${roomState.meReady ? "✓" : ""}</div>`];
  for (const p of roomState.peers) {
    cells.push(`<div class="room-player ${roomState.peerReady ? "ready" : ""}">${escapeHtml(p)} ${roomState.peerReady ? "✓" : ""}</div>`);
  }
  if (roomState.peers.length === 0) cells.push('<div class="room-player" style="opacity:.5">esperando rival...</div>');
  $("roomPlayers").innerHTML = cells.join("");
}

online.on("created", () => { enterRoomView(); setRoomStatus("Sala creada. Comparte el codigo con tu amigo."); });
online.on("joined", (m) => { roomState.peers = m.peers || []; enterRoomView(); setRoomStatus("Te uniste. El host elige la cancion."); });
online.on("peerJoined", (m) => { roomState.peers = [m.name]; renderRoomPlayers(); setRoomStatus(m.name + " se unio."); });
online.on("peerLeft", () => { roomState.peers = []; roomState.peerReady = false; renderRoomPlayers(); setRoomStatus("El rival salio de la sala."); });
online.on("error", (m) => setRoomStatus("Error: " + m.message));
online.on("disconnected", () => { if (roomState.inRoom) setRoomStatus("Conexion perdida."); });

online.on("peerReady", () => { roomState.peerReady = true; renderRoomPlayers(); setRoomStatus("El rival esta listo."); });
online.on("bothReady", () => {
  setRoomStatus("Ambos listos. Arrancando...");
  if (online.role === "host") online.start();
});

// El host propone una cancion (desde la pestana Jugar, boton VS).
async function proposeSongToVs(id, name) {
  if (!roomState.inRoom) {
    setStatus("Primero crea o unete a una sala en la pestana VS Online.");
    document.querySelector('.tab[data-tab="online"]').click();
    return;
  }
  if (online.role !== "host") { setStatus("Solo el host elige la cancion."); return; }
  const difficulty = $("difficulty").value;
  const lanes = $("style").value;
  const genre = $("genre").value;
  setStatus(`Preparando "${name}" para el VS...`);
  try {
    const beatmap = await fetchChart(id, difficulty, lanes, genre);
    // Usamos el genero EFECTIVO (ya resuelto si era auto) para que el rival
    // genere exactamente la misma pista.
    const effGenre = beatmap.genre || genre;
    roomState.song = { id, name, beatmap, difficulty, lanes, genre: effGenre };
    online.chooseSong(beatmap.songHash, name, difficulty, lanes, id, effGenre);
    showRoomSong(name, difficulty, lanes, true);
    $("readyBtn").disabled = false;
    document.querySelector('.tab[data-tab="online"]').click();
    setStatus("");
  } catch (e) { setStatus("Error: " + e.message); }
}

function showRoomSong(name, difficulty, lanes, isHost) {
  const el = $("roomSong");
  el.classList.add("has-song");
  el.innerHTML = `Cancion: <strong>${escapeHtml(name)}</strong> · ${difficulty} · ${lanes} paneles`
    + (isHost ? "" : `<br><span class="hint">Asegurate de tener esta cancion. Pulsa "Listo" cuando la tengas.</span>`);
}

// El invitado recibe la cancion elegida.
// - Modo facil (via tunel): el invitado esta en el servidor del host, asi que
//   puede cargar la MISMA cancion por su id directamente (no necesita tenerla).
// - Modo LAN (bibliotecas separadas): busca por nombre y verifica el hash.
online.on("song", async (m) => {
  vs.peerName = roomState.peers[0] || "RIVAL";
  showRoomSong(m.songName, m.difficulty, m.lanes, false);

  // 1) Intento directo por id del host (funciona via tunel).
  if (m.songId) {
    try {
      const beatmap = await fetchChart(m.songId, m.difficulty, m.lanes, m.genre);
      if (beatmap.songHash === m.songHash) {
        roomState.song = { id: m.songId, name: m.songName, beatmap, difficulty: m.difficulty, lanes: m.lanes, genre: m.genre };
        $("readyBtn").disabled = false;
        setRoomStatus(`Cancion lista: "${m.songName}". Pulsa "Listo".`);
        return;
      }
    } catch (_) { /* el id del host no existe aqui (modo LAN): seguimos al plan B */ }
  }

  // 2) Modo LAN: buscar en la biblioteca propia por nombre.
  setRoomStatus(`El host eligio "${m.songName}". Buscando en tu biblioteca...`);
  const match = allSongs.find((s) => s.name.toLowerCase() === m.songName.toLowerCase())
             || allSongs.find((s) => s.name.toLowerCase().includes(m.songName.toLowerCase().slice(0, 12)));
  if (!match) {
    setRoomStatus(`No encontre "${m.songName}" en tus carpetas. Descargala o agregala y vuelve a entrar.`);
    $("readyBtn").disabled = true;
    return;
  }
  try {
    const beatmap = await fetchChart(match.id, m.difficulty, m.lanes, m.genre);
    if (beatmap.songHash !== m.songHash) {
      setRoomStatus(`Encontre "${match.name}" pero es otra version; igual puedes intentar.`);
    } else {
      setRoomStatus(`Cancion lista y verificada. Pulsa "Listo".`);
    }
    roomState.song = { id: match.id, name: match.name, beatmap, difficulty: m.difficulty, lanes: m.lanes, genre: m.genre };
    $("readyBtn").disabled = false;
  } catch (e) {
    setRoomStatus("Error preparando la cancion: " + e.message);
  }
});

// Arranque sincronizado del VS. El audio ya se precargo al pulsar "Listo".
online.on("go", async (m) => {
  if (!roomState.song) { setRoomStatus("No tengo la cancion lista."); return; }
  if (!audioEl) {
    // Respaldo por si no se precargo (no deberia pasar).
    try { audioEl = await loadAudio(roomState.song.id); }
    catch (e) { setRoomStatus("Error cargando audio: " + e.message); return; }
  }
  vs = { active: true, role: online.role, song: roomState.song, peerName: roomState.peers[0] || "RIVAL", peerFinal: null };
  // Nueva ronda de la serie (mejor de 3): contador monotono por partida jugada.
  onlineSeries.round = (onlineSeries._lastPlayed != null ? onlineSeries._lastPlayed + 1 : 0);
  onlineSeries._lastPlayed = onlineSeries.round;
  // Arrancar delayMs despues de recibir "go" (sincronia sin relojes comunes).
  const delayMs = m.delayMs != null ? m.delayMs : 3000;
  const startAtSec = performance.now() / 1000 + delayMs / 1000;
  startGame(roomState.song.name, roomState.song.beatmap, { startAtSec });
});

online.on("peerProgress", (m) => {
  if (!vs.active) return;
  $("vsPeerScore").textContent = Number(m.score).toLocaleString();
  // Reflejar la vida del rival en su barra (si la envia).
  if (m.life != null) {
    const fill = $("vsPeerLifeFill");
    if (fill) {
      fill.style.width = Math.max(0, Math.min(100, m.life)) + "%";
      fill.classList.toggle("danger", m.life <= 25);
    }
  }
  // Guardar el ultimo estado de notas resueltas para reflejarlo en su tablero.
  if (m.resolved != null) rivalPending = { resolved: m.resolved, lastHit: m.lastHit };
});
online.on("peerFinish", (m) => {
  vs.peerFinal = { score: m.score, accuracy: m.accuracy, grade: m.grade };
  if (vs.active) $("vsPeerScore").textContent = Number(m.score).toLocaleString();
  if (screens.results.classList.contains("active") && currentGame === null) {
    // ya terminamos: actualizar resultado
    const myScore = Number($("vsMyScore").textContent.replace(/[^\d]/g, "")) || 0;
    decideVsOutcomeFromValues(myScore);
  }
});
function decideVsOutcomeFromValues(myScore) {
  const vsEl = $("vsResult");
  if (vs.peerFinal == null) return;
  const win = myScore >= vs.peerFinal.score;
  tallyOnlineRound(myScore, vs.peerFinal.score);
  const serie = ` · Serie ${onlineSeries.mine}—${onlineSeries.peer}`;
  vsEl.textContent = (win ? `GANASTE  (${myScore.toLocaleString()} vs ${vs.peerFinal.score.toLocaleString()})`
                          : `Perdiste  (${myScore.toLocaleString()} vs ${vs.peerFinal.score.toLocaleString()})`) + serie;
  vsEl.className = "vs-result " + (win ? "win" : "lose");
  maybeAnnounceOnlineChamp(vsEl);
}

// ---------- Editor ----------
let editor = null;
let edAudio = null;
let edCtx = { songId: null, name: null, lanes: 5, difficulty: "normal" };

// Llenar el selector de canciones del editor cuando se abre su pestana.
function fillEditorSongs() {
  const sel = $("edSong");
  sel.innerHTML = allSongs.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
}
document.querySelector('.tab[data-tab="editor"]').addEventListener("click", fillEditorSongs);

$("edRate").addEventListener("input", () => { $("edRateVal").textContent = Number($("edRate").value).toFixed(1) + "x"; });

$("edStartBtn").addEventListener("click", async () => {
  const sel = $("edSong");
  if (!sel.value) { setStatus("No hay canciones para editar."); return; }
  edCtx = {
    songId: sel.value,
    name: sel.options[sel.selectedIndex].text,
    lanes: Number($("edStyle").value),
    difficulty: $("edDifficulty").value,
    rate: Number($("edRate").value),
  };
  setStatus("Cargando audio para el editor...");
  try {
    edAudio = await loadAudio(edCtx.songId);
  } catch (e) { setStatus("Error: " + e.message); return; }

  // ¿Ya existe un mapeo para esta cancion/dificultad/estilo en este juego?
  // Si lo hay, ofrecer EDITARLO en vez de empezar de cero.
  let existing = null;
  try {
    const r = await fetch(`/api/customchart/${edCtx.songId}?difficulty=${edCtx.difficulty}&lanes=${edCtx.lanes}&game=${gameMode}`);
    existing = (await r.json()).chart;
  } catch (_) {}

  setStatus("");
  $("editor-container").innerHTML = "";
  showScreen("editor");

  if (existing && existing.notes && existing.notes.length) {
    const edit = confirm(`Esta cancion ya tiene un mapeo en "${edCtx.difficulty}" (${edCtx.lanes} ${edCtx.lanes === 5 ? "paneles" : "flechas"}) con ${existing.notes.length} notas.\n\nAceptar = EDITARLO (mover/borrar/agregar notas).\nCancelar = empezar de cero (grabar).`);
    if (edit) {
      const loaded = existing.notes.map((n) => ({ ...n }));
      startEditor("record");          // crea el Editor
      editor.stop();                  // detener la grabacion recien iniciada
      editor.setNotes(loaded);        // cargar las notas existentes
      editor.mode = "edit";
      openTimelineWith(editor.notes); // abrir el editor fino con esas notas
      return;
    }
  }
  startEditor("record");
});

function startEditor(mode) {
  if (editor) { try { editor.dispose(); } catch (_) {} editor = null; }
  $("editor-container").innerHTML = "";
  const prevNotes = mode === "preview" && editorNotes ? editorNotes : null;

  editor = new Editor($("editor-container"), edAudio, input, edCtx.lanes, {
    onTime: (now, dur) => {
      $("edTime").textContent = fmtTime(Math.max(0, now)) + " / " + fmtTime(dur);
    },
    onCount: (n) => { $("edNotes").textContent = n + " notas"; },
    onState: (st) => {},
  }, { gameMode });

  if (mode === "preview" && prevNotes) {
    editor.notes = prevNotes.map((n) => ({ ...n }));
    $("edModeLabel").textContent = "PREVIEW";
    $("edModeLabel").className = "ed-mode preview";
    editor.startPreview();
  } else {
    $("edModeLabel").textContent = "GRABANDO";
    $("edModeLabel").className = "ed-mode";
    editor.startRecord(edCtx.rate);
  }
}

let editorNotes = null; // respaldo de notas grabadas (para preview/guardar)
let timeline = null;    // editor fino 2D (TimelineEditor)

// Cierra el editor fino 2D si esta abierto.
function closeTimeline() {
  if (timeline) { try { timeline.dispose(); } catch (_) {} timeline = null; }
  $("edTimelineWrap").classList.add("hidden");
}

$("edRecordBtn").addEventListener("click", () => {
  closeTimeline();
  startEditor("record");
});
$("edPreviewBtn").addEventListener("click", () => {
  closeTimeline();
  if (editor) editorNotes = editor.quantizeChords(editor.notes);
  if (!editorNotes || editorNotes.length === 0) { setStatus(""); alert("Graba algunas notas primero."); return; }
  startEditor("preview");
});

// Editar notas: detiene la reproduccion y abre el timeline 2D para mover,
// borrar o agregar flechas con el raton.
$("edEditBtn").addEventListener("click", () => {
  if (!editor) { alert("Primero graba algunas notas."); return; }
  const notes = editor.enterEditMode();
  if (!notes.length) { alert("No hay notas para editar. Graba algunas primero."); return; }
  openTimelineWith(notes);
});

// Abre el editor fino 2D (timeline) con un conjunto de notas. Se usa tanto al
// pulsar "Editar notas" como al abrir una cancion YA mapeada para modificarla.
function openTimelineWith(notes) {
  if (editor && editor.mode !== "edit") { try { editor.enterEditMode(); } catch (_) {} }
  editorNotes = notes;
  if (editor) editor.setNotes(notes);
  $("edModeLabel").textContent = "EDITANDO";
  $("edModeLabel").className = "ed-mode edit";
  $("edNotes").textContent = notes.length + " notas";
  $("edTimelineWrap").classList.remove("hidden");
  const canvas = $("edTimeline");
  if (timeline) { try { timeline.dispose(); } catch (_) {} timeline = null; }
  timeline = new TimelineEditor(canvas, {
    laneCount: edCtx.lanes,
    duration: edAudio ? edAudio.duration : (notes.length ? notes[notes.length - 1].time + 2 : 60),
    notes,
    onChange: (ns) => { editor.setNotes(ns); editorNotes = ns; $("edNotes").textContent = ns.length + " notas"; },
    onSeek: (t) => { $("edTime").textContent = fmtTime(t) + " / " + fmtTime(edAudio ? edAudio.duration : 0); },
  });
  timeline.resize();
}
$("edSaveBtn").addEventListener("click", async () => {
  // Capturar y CUANTIZAR (juntar acordes casi simultaneos, conservar holds).
  if (editor) editorNotes = editor.quantizeChords(editor.notes);
  if (!editorNotes || editorNotes.length === 0) { alert("No hay notas para guardar."); return; }
  const chart = {
    laneCount: edCtx.lanes,
    duration: edAudio ? edAudio.duration : 0,
    bpm: 120,
    notes: editorNotes
      .map((n) => { const o = { time: n.time, lane: n.lane }; if (n.duration) o.duration = n.duration; return o; })
      .sort((a, b) => a.time - b.time),
  };
  try {
    const r = await fetch(`/api/customchart/${edCtx.songId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: edCtx.difficulty, chart, game: gameMode }),
    });
    const j = await r.json();
    if (j.ok) {
      const holds = chart.notes.filter((n) => n.duration).length;
      alert(`Guardado: ${j.notes} notas${holds ? " (" + holds + " largas)" : ""} en dificultad "${edCtx.difficulty}". Al jugar esta cancion en esa dificultad se usara tu pista.`);
    } else alert("Error: " + (j.error || "no se pudo guardar"));
  } catch (e) { alert("Error: " + e.message); }
});
$("edExitBtn").addEventListener("click", exitEditor);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && screens.editor.classList.contains("active")) exitEditor();
  // Atajos del timeline 2D (solo cuando esta abierto).
  if (timeline && screens.editor.classList.contains("active")) {
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); timeline.deleteSelected(); }
    else if (e.key === "]") { e.preventDefault(); timeline.nudgeHold(+0.05); }
    else if (e.key === "[") { e.preventDefault(); timeline.nudgeHold(-0.05); }
  }
});

function exitEditor() {
  closeTimeline();
  if (editor) { try { editor.dispose(); } catch (_) {} editor = null; }
  if (edAudio) { try { edAudio.dispose(); } catch (_) {} edAudio = null; }
  editorNotes = null;
  showScreen("menu");
}

function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

// ---------- Configurar teclas (modal) ----------
// Estado del editor de teclas: estilo (5/4), perfil (all/p1/p2) y la captura.
let keysUi = { style: 5, prof: "all", capturing: null, capTarget: "key" };

$("openKeysBtn") && $("openKeysBtn").addEventListener("click", openKeysModal);
$("keysClose") && $("keysClose").addEventListener("click", () => {
  $("keysModal").classList.add("hidden");
  keysTest.active = false;
});

function openKeysModal() {
  // Empezar con el estilo actualmente elegido en Opciones.
  keysUi.style = $("style").value === "4" ? 4 : 5;
  keysUi.prof = "all";
  keysUi.capturing = null;
  keysUi.capTarget = "key";
  const gl = $("keysGameLabel");
  if (gl) gl.textContent = gameMode === "guitar" ? "· Guitar Hero" : "· Rhythm Dance";
  syncKeysTabs();
  renderKeysRows();
  $("keysHint").textContent = "";
  $("keysModal").classList.remove("hidden");
  updatePadStatus();
  startPadCaptureLoop();   // sondear botones del control mientras esta abierto
}

// Devuelve el mapa efectivo { code: lane } de un perfil+estilo PARA EL JUEGO
// ACTUAL (guardado o de fabrica). Las teclas se guardan por juego.
function effectiveMap(prof, lanes) {
  const km = (getPref("keymaps") || {})[gameMode] || {};
  if (km[prof] && km[prof][lanes] && Object.keys(km[prof][lanes]).length) return { ...km[prof][lanes] };
  return { ...DEFAULT_KEY_MAPS[prof][lanes] };
}

// Igual para los BOTONES del control: { buttonIndex: lane }.
function effectivePadMap(prof, lanes) {
  const pm = (getPref("padmaps") || {})[gameMode] || {};
  if (pm[prof] && pm[prof][lanes] && Object.keys(pm[prof][lanes]).length) return { ...pm[prof][lanes] };
  return getDefaultPadMap(prof, lanes);
}

// Invierte el mapa: lane -> code (un code por lane para mostrar/editar).
function laneToCode(map) {
  const out = {};
  for (const code in map) { const lane = map[code]; if (out[lane] == null) out[lane] = code; }
  return out;
}

function syncKeysTabs() {
  document.querySelectorAll(".keys-tab").forEach((b) => b.classList.toggle("active", Number(b.dataset.style) === keysUi.style));
  document.querySelectorAll(".keys-prof").forEach((b) => b.classList.toggle("active", b.dataset.prof === keysUi.prof));
}

document.querySelectorAll(".keys-tab").forEach((b) => b.addEventListener("click", () => {
  keysUi.style = Number(b.dataset.style); keysUi.capturing = null; syncKeysTabs(); renderKeysRows();
}));
document.querySelectorAll(".keys-prof").forEach((b) => b.addEventListener("click", () => {
  keysUi.prof = b.dataset.prof; keysUi.capturing = null; syncKeysTabs(); renderKeysRows();
}));

// Icono (dataURL) de un carril segun el juego actual: flecha (dance) o gema (guitar).
function laneIcon(lanes, i) {
  if (gameMode === "guitar") return gemDataURL((GUITAR_LANE_COLORS[lanes] || GUITAR_LANE_COLORS[5])[i], 64);
  return arrowDataURL(LANE_COLORS[lanes][i], LANE_DIRS[lanes][i], 64);
}
function laneLabelFor(lanes, i) {
  if (gameMode === "guitar") return (GUITAR_LANE_LABELS[lanes] || GUITAR_LANE_LABELS[5])[i];
  return LANE_LABELS[lanes][i];
}

function renderKeysRows() {
  const lanes = keysUi.style;
  const map = laneToCode(effectiveMap(keysUi.prof, lanes));
  const padByLane = laneToCode(effectivePadMap(keysUi.prof, lanes));
  const rows = [];
  for (let i = 0; i < lanes; i++) {
    const capKey = keysUi.capturing === i && keysUi.capTarget === "key";
    const capPad = keysUi.capturing === i && keysUi.capTarget === "pad";
    const img = laneIcon(lanes, i);
    rows.push(`<div class="keys-row">
      <span class="keys-lane">
        <img class="keys-ico" src="${img}" alt="${laneLabelFor(lanes, i)}" />
        <span class="keys-lane-txt">${laneLabelFor(lanes, i)}</span>
      </span>
      <button class="keys-bind ${capKey ? "capturing" : ""}" data-lane="${i}" data-target="key">${capKey ? "Pulsa tecla…" : keyLabel(map[i])}</button>
      <button class="keys-bind keys-bind-pad ${capPad ? "capturing" : ""}" data-lane="${i}" data-target="pad">${capPad ? "Pulsa boton…" : padLabel(padByLane[i])}</button>
    </div>`);
  }
  $("keysRows").innerHTML = rows.join("");
  $("keysRows").querySelectorAll(".keys-bind").forEach((b) => {
    b.addEventListener("click", () => {
      keysUi.capturing = Number(b.dataset.lane);
      keysUi.capTarget = b.dataset.target;
      renderKeysRows();
      $("keysHint").textContent = b.dataset.target === "pad"
        ? "Pulsa un boton del control… (Esc para cancelar)"
        : "Esperando tecla… (Esc para cancelar)";
    });
  });
  renderKeysBoard();
}

// Mini tablero de referencia: muestra las flechas/gemas en su posicion real
// con la tecla asignada debajo de cada una. Ayuda a no confundirse.
function renderKeysBoard() {
  const lanes = keysUi.style;
  const map = laneToCode(effectiveMap(keysUi.prof, lanes));
  // Guitar: todas las gemas en linea (mastil). Dance: 5 paneles en X.
  const yClass = (gameMode === "guitar")
    ? new Array(lanes).fill("mid")
    : (lanes === 5 ? ["low", "high", "mid", "high", "low"] : ["mid", "mid", "mid", "mid"]);
  const cells = [];
  for (let i = 0; i < lanes; i++) {
    const img = laneIcon(lanes, i);
    cells.push(`<div class="keys-board-cell ${yClass[i]}">
      <img src="${img}" alt="" />
      <span class="keys-board-key">${keyLabel(map[i])}</span>
    </div>`);
  }
  $("keysBoard").innerHTML = `<div class="keys-board-row">${cells.join("")}</div>`;
}

// Captura de tecla cuando el modal esta abierto y hay un carril en espera.
window.addEventListener("keydown", (e) => {
  if ($("keysModal").classList.contains("hidden")) return;
  if (keysUi.capturing == null) return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === "Escape") { keysUi.capturing = null; $("keysHint").textContent = ""; renderKeysRows(); return; }
  // Solo capturamos teclado cuando el objetivo es "key".
  if (keysUi.capTarget !== "key") return;
  assignKey(keysUi.prof, keysUi.style, keysUi.capturing, e.code);
  keysUi.capturing = null;
  renderKeysRows();
}, true);

// Bucle que sondea botones del control mientras el modal esta capturando un
// boton de gamepad. La Gamepad API no emite eventos: hay que hacer polling.
let _padCaptureRaf = null;
let _padCapturePrev = false;
function startPadCaptureLoop() {
  if (_padCaptureRaf) return;
  const tick = () => {
    if ($("keysModal").classList.contains("hidden")) { _padCaptureRaf = null; return; }
    // Actualizar el aviso de "control conectado".
    updatePadStatus();
    if (keysUi.capturing != null && keysUi.capTarget === "pad") {
      const b = pollAnyPadButton();
      if (b != null && !_padCapturePrev) {
        assignPad(keysUi.prof, keysUi.style, keysUi.capturing, b);
        keysUi.capturing = null;
        renderKeysRows();
      }
      _padCapturePrev = b != null;
    } else {
      _padCapturePrev = false;
    }
    _padCaptureRaf = requestAnimationFrame(tick);
  };
  _padCaptureRaf = requestAnimationFrame(tick);
}

function updatePadStatus() {
  const el = $("keysPadStatus");
  if (!el) return;
  el.textContent = anyGamepadConnected() ? "🎮 control conectado" : "🎮 sin control (conecta uno y pulsa un boton)";
  el.className = "keys-pad-status " + (anyGamepadConnected() ? "on" : "off");
}

// Asigna 'code' al carril 'lane' del perfil/estilo (para el juego actual).
function assignKey(prof, lanes, lane, code) {
  const cur = laneToCode(effectiveMap(prof, lanes));
  // Si la tecla ya estaba en otro carril, la quitamos de alli (swap simple).
  for (const l in cur) { if (cur[l] === code && Number(l) !== lane) delete cur[l]; }
  cur[lane] = code;
  // Reconstruir el mapa code->lane.
  const codeMap = {};
  for (const l in cur) { if (cur[l]) codeMap[cur[l]] = Number(l); }
  // Guardar en prefs (bajo el juego actual) y aplicar al motor en vivo.
  const km = getPref("keymaps") || {};
  if (!km[gameMode]) km[gameMode] = {};
  if (!km[gameMode][prof]) km[gameMode][prof] = {};
  km[gameMode][prof][lanes] = codeMap;
  savePrefs({ keymaps: km });
  setKeyMap(prof, lanes, codeMap);
  $("keysHint").textContent = `Asignada: ${keyLabel(code)}`;
}

// Asigna el boton de control 'btn' al carril 'lane' (para el juego actual).
function assignPad(prof, lanes, lane, btn) {
  const cur = laneToCode(effectivePadMap(prof, lanes));   // lane -> buttonIndex
  for (const l in cur) { if (cur[l] === btn && Number(l) !== lane) delete cur[l]; }
  cur[lane] = btn;
  const padMap = {};
  for (const l in cur) { if (cur[l] != null) padMap[cur[l]] = Number(l); }
  const pm = getPref("padmaps") || {};
  if (!pm[gameMode]) pm[gameMode] = {};
  if (!pm[gameMode][prof]) pm[gameMode][prof] = {};
  pm[gameMode][prof][lanes] = padMap;
  savePrefs({ padmaps: pm });
  setPadMap(prof, lanes, padMap);
  $("keysHint").textContent = `Boton asignado: ${padLabel(btn)}`;
}

$("keysReset") && $("keysReset").addEventListener("click", () => {
  const lanes = keysUi.style, prof = keysUi.prof;
  // Restaurar TANTO teclas como botones de control de este perfil/estilo.
  const km = getPref("keymaps") || {};
  if (km[gameMode] && km[gameMode][prof]) delete km[gameMode][prof][lanes];
  const pm = getPref("padmaps") || {};
  if (pm[gameMode] && pm[gameMode][prof]) delete pm[gameMode][prof][lanes];
  savePrefs({ keymaps: km, padmaps: pm });
  setKeyMap(prof, lanes, null);   // restaura de fabrica en el motor
  setPadMap(prof, lanes, null);
  keysUi.capturing = null;
  renderKeysRows();
  $("keysHint").textContent = "Restaurado a teclas y botones por defecto.";
});

// ----- Test de teclas (detector de ghosting) -----
// Cuenta cuantas teclas distintas puede reportar tu teclado a la vez. Si al
// pulsar muchas algunas no aparecen, ese teclado tiene ghosting/limite de
// rollover y conviene elegir teclas separadas para J1 y J2.
let keysTest = { active: false, held: new Set(), max: 0 };

$("keysTestToggle") && $("keysTestToggle").addEventListener("click", () => {
  const area = $("keysTestArea");
  const show = area.classList.contains("hidden");
  area.classList.toggle("hidden", !show);
  keysTest.active = show;
  keysTest.held.clear();
  keysTest.max = 0;
  if (show) {
    $("keysTestCount").textContent = "0";
    $("keysTestMax").textContent = "0";
    $("keysTestNow").textContent = "Pulsa teclas…";
    $("keysTestVerdict").textContent = "";
    $("keysTestToggle").textContent = "✖ Cerrar prueba";
  } else {
    $("keysTestToggle").textContent = "🧪 Probar teclas (detectar ghosting)";
  }
});

function keysTestRender() {
  const arr = [...keysTest.held];
  $("keysTestNow").innerHTML = arr.length
    ? arr.map((c) => `<span class="ktk">${keyLabel(c)}</span>`).join("")
    : "Pulsa teclas…";
  $("keysTestCount").textContent = String(keysTest.held.size);
  if (keysTest.held.size > keysTest.max) { keysTest.max = keysTest.held.size; $("keysTestMax").textContent = String(keysTest.max); }
  const v = $("keysTestVerdict");
  if (keysTest.max >= 6) { v.textContent = "✓ Tu teclado aguanta 6+ teclas a la vez: ideal para VS local."; v.className = "keys-test-verdict ok"; }
  else if (keysTest.max >= 4) { v.textContent = "~ Aguanta " + keysTest.max + " teclas. Quizas suficiente; prueba las combos de ambos jugadores."; v.className = "keys-test-verdict warn"; }
  else if (keysTest.max > 0) { v.textContent = "⚠ Solo " + keysTest.max + " a la vez: ghosting probable. Usa teclas separadas o un mando por jugador."; v.className = "keys-test-verdict bad"; }
}

// Capturamos en fase de captura para el test (sin afectar el juego/menus).
window.addEventListener("keydown", (e) => {
  if (!keysTest.active || $("keysModal").classList.contains("hidden")) return;
  if (keysUi.capturing != null) return; // si estamos reasignando, no contar
  keysTest.held.add(e.code);
  keysTestRender();
}, true);
window.addEventListener("keyup", (e) => {
  if (!keysTest.active) return;
  keysTest.held.delete(e.code);
  keysTestRender();
}, true);

// ---------- Init ----------
restorePrefs();

// Navegacion de toda la interfaz con control (gamepad). Se pausa durante el
// juego (ahi el control se usa para jugar) y al capturar teclas/botones.
const uinav = new UiNav();
uinav.start(() => screens.game.classList.contains("active")
  || (!$("keysModal").classList.contains("hidden") && keysUi.capturing != null));
$("style").dispatchEvent(new Event("change"));
// Arranca en el splash; "ENTRAR" pasa a la seleccion de JUEGO.
showScreen("splash");
$("splashStart").addEventListener("click", () => showScreen("gameSelect"));
loadStatus();
loadFolders();
loadSongs();
maybeAutoJoin();

// ---------- Seleccion de juego (Rhythm Dance / Guitar Hero) ----------
document.querySelectorAll(".game-card-dance, .game-card-guitar, [data-game]").forEach((c) => {
  if (!c.dataset.game) return;
  c.addEventListener("click", () => chooseGame(c.dataset.game));
  c.addEventListener("mousemove", (e) => {
    const r = c.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `translateY(-10px) scale(1.025) rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
  });
  c.addEventListener("mouseleave", () => { c.style.transform = ""; });
});

function chooseGame(g) {
  gameMode = g === "guitar" ? "guitar" : "dance";
  // Reflejar el juego elegido en el encabezado de modo y el badge del menu.
  $("modeKicker").textContent = gameMode === "guitar" ? "GUITAR HERO" : "RHYTHM DANCE";
  const gb = $("gameBadge");
  if (gb) gb.textContent = gameMode === "guitar" ? "🎸 Guitar Hero" : "🎮 Rhythm Dance";
  // Aplicar las teclas y recargar los datos (scores) propios del juego elegido.
  applySavedKeymaps();
  loadSongs();
  showScreen("modeSelect");
}
$("modeBack") && $("modeBack").addEventListener("click", () => showScreen("gameSelect"));
// Desde el menu, volver a elegir juego.
$("changeGameBtn") && $("changeGameBtn").addEventListener("click", () => showScreen("gameSelect"));

// ---------- Seleccion de modo ----------
document.querySelectorAll(".mode-card[data-mode]").forEach((c) => {
  c.addEventListener("click", () => chooseMode(c.dataset.mode));
  // Inclinacion 3D sutil que sigue al raton (efecto premium).
  c.addEventListener("mousemove", (e) => {
    const r = c.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;   // -0.5..0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `translateY(-10px) scale(1.025) rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
  });
  c.addEventListener("mouseleave", () => { c.style.transform = ""; });
});

function chooseMode(mode) {
  if (mode === "solo") {
    // Menu normal en la pestana Jugar.
    document.querySelector('.tab[data-tab="play"]').click();
    showScreen("menu");
  } else if (mode === "local") {
    openLocalSetup();
  } else if (mode === "online") {
    // Menu en la pestana VS Online (la serie de 3 se coordina alli).
    document.querySelector('.tab[data-tab="online"]').click();
    showScreen("menu");
  }
}

// Restaura en los controles los valores guardados la ultima vez (localStorage).
function restorePrefs() {
  const p = loadPrefs();
  const set = (id, val) => { const el = $(id); if (el != null && val != null) el.value = val; };
  set("style", p.style);
  set("difficulty", p.difficulty);
  set("genre", p.genre);
  set("scrollSpeed", p.scrollSpeed);
  set("volume", p.volume);
  set("quality", p.quality);
  set("playerName", p.playerName);
  $("scrollSpeedVal").textContent = Number($("scrollSpeed").value).toFixed(1) + "x";
  $("volumeVal").textContent = Number($("volume").value) + "%";
  // Reflejar el offset de calibracion guardado.
  const off = Number(p.audioOffset) || 0;
  if ($("calOffset")) { $("calOffset").value = off; $("calOffsetVal").textContent = off + " ms"; }
  if ($("videoBg")) $("videoBg").checked = p.videoBg !== false;
  // Aplicar las teclas personalizadas guardadas (si las hay).
  applySavedKeymaps();
}

// Carga en el motor de entrada los mapas de teclas Y de botones de control
// guardados PARA EL JUEGO ACTUAL. Para los perfiles/estilos sin personalizar,
// restaura los de fabrica (asi al cambiar de juego no se filtran los del otro).
function applySavedKeymaps() {
  const km = (getPref("keymaps") || {})[gameMode] || {};
  const pm = (getPref("padmaps") || {})[gameMode] || {};
  for (const prof of ["all", "p1", "p2"]) {
    for (const lanes of [5, 4]) {
      const m = km[prof] && km[prof][lanes];
      setKeyMap(prof, lanes, (m && Object.keys(m).length) ? m : null);
      const p = pm[prof] && pm[prof][lanes];
      setPadMap(prof, lanes, (p && Object.keys(p).length) ? p : null);
    }
  }
}

// Si la URL trae #join=CODE (enlace compartido por un amigo), entramos directo
// a su sala. Como la pagina se sirve desde el host (via tunel), el WebSocket se
// conecta de vuelta al mismo origen automaticamente.
function maybeAutoJoin() {
  const m = /[#&?]join=([A-Z0-9]{4})/i.exec(location.hash + location.search);
  if (!m) return;
  const code = m[1].toUpperCase();
  showScreen("menu"); // saltar splash si vienen por enlace
  // Ir a la pestana online y unirse
  document.querySelector('.tab[data-tab="online"]').click();
  const name = $("playerName").value.trim() || ("Invitado-" + Math.floor(Math.random() * 100));
  $("playerName").value = name;
  online.setRelayHost(""); // mismo origen (el tunel del host)
  setRoomStatus("Conectando a la sala del host...");
  online.join(code, name).catch((e) => setRoomStatus("Error: " + e.message));
}
