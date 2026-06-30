// main.js
// Frontend visual. Habla con el motor local (servidor Node) para: listar
// canciones/carpetas, pedir la pista generada, buscar/descargar musica y
// coordinar el modo VS online. Muestra el juego en 3D.

import { InputManager, DEFAULT_KEY_MAPS, LANE_LABELS, LANE_COLORS, LANE_ICONS, setKeyMap, keyLabel, setPadMap, getDefaultPadMap, padLabel, pollAnyPadButton, anyGamepadConnected } from "./input/input.js";
import { UiNav } from "./input/uinav.js";
import { arrowDataURL, gemDataURL, LANE_DIRS, GUITAR_LANE_COLORS, GUITAR_LANE_LABELS } from "./render/arrowicon.js";
import { RhythmGame } from "./game/game.js";
import { OnlineClient } from "./net/online.js";
import { getUserId, fetchProfile, getCachedProfile, updateProfile, authedFetch } from "./profile.js";
import { AudioPlayer } from "./audio/player.js";
import { RivalBoard } from "./game/rivalboard.js";
import { Editor } from "./game/editor.js";
import { TimelineEditor } from "./game/timeline.js";
import { SharedRenderer } from "./render/stage.js";
import { preloadNoteskin, SKIN_CATALOG } from "./render/skinloader.js";
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
const mods = { vanish: false, appear: false, hidden: false, tornado: false, twirl: false, drunk: false, mirror: false, random: false, reverse: false, mini: false, mega: false, niebla: false, gravedad: false, neon: false, rebote: false, bomba: false };
let lastPlay = null; // { id, name } de la ultima cancion (para reintentar)
let songScores = {}; // puntajes mas altos por cancion (cache local)
let gameMode = "dance"; // "dance" (Rhythm Dance) o "guitar" (Guitar Hero)
let inputEnv = null;  // entorno de entrada (detecta bug de 2 teclados en Linux/Xorg)

// Modo VERTICAL (Piano Tiles): dock de flechas ABAJO y notas que CAEN, campo
// plano sin perspectiva. En MÓVIL (táctil) es SIEMPRE vertical (forzado, no se
// puede desactivar). En escritorio se activa desde Opciones.
function isVerticalMode() {
  if (("ontouchstart" in window) || (navigator.maxTouchPoints > 0)) return true;
  return getPref("verticalTiles") === true;
}

// Consultar el entorno de entrada al arrancar (Linux/Xorg + n teclados). Sirve
// para avisar del bug de sistema que traba el VS local con dos teclados.
fetch("/api/inputenv").then((r) => r.json()).then((e) => { inputEnv = e; }).catch(() => {});

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
$("verticalTiles") && $("verticalTiles").addEventListener("change", () => savePrefs({ verticalTiles: $("verticalTiles").checked }));

// Modo Desarrollador: contraseña 113209. Activa inmortalidad para probar
// efectos sin morir. Se almacena solo en memoria (no en localStorage).
let devMode = false;
function toggleDevMode() {
  devMode = !devMode;
  const on = devMode;
  // Actualizar boton del menu principal
  const btn = $("devModeBtn");
  if (btn) {
    btn.textContent = on ? "🔧 Modo Desarrollador: ON" : "🔧 Modo Desarrollador";
    btn.style.borderColor = on ? "var(--clr-green)" : "var(--border-subtle)";
    btn.style.color = on ? "var(--clr-green)" : "var(--text-muted)";
  }
  // Actualizar badge del VS local
  const lsBtn = $("lsDevBtn");
  if (lsBtn) {
    lsBtn.style.borderColor = on ? "var(--clr-green)" : "var(--border-subtle)";
    lsBtn.style.color = on ? "var(--clr-green)" : "var(--text-muted)";
    lsBtn.textContent = on ? "🔧 Dev: ON" : "🔧 Dev";
  }
  const st = $("devModeStatus"); if (st) st.classList.toggle("hidden", !on);
  const lst = $("lsDevStatus"); if (lst) lst.classList.toggle("hidden", !on);
  setStatus(on ? "👑 Modo Desarrollador activado — eres inmortal" : "Modo Desarrollador desactivado");
}
$("devModeBtn") && $("devModeBtn").addEventListener("click", () => {
  $("devModal").classList.remove("hidden");
  $("devPassInput").value = "";
  $("devPassInput").focus();
});
$("devPassCancel") && $("devPassCancel").addEventListener("click", () => {
  $("devModal").classList.add("hidden");
});
$("devPassOk") && $("devPassOk").addEventListener("click", () => {
  const pass = $("devPassInput").value;
  $("devModal").classList.add("hidden");
  if (pass === "113209") {
    toggleDevMode();
  } else if (pass) {
    alert("Contraseña incorrecta.");
  }
});
// Enter en el input tambien confirma.
$("devPassInput") && $("devPassInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("devPassOk").click();
});
// Boton Dev en VS local: reusa el mismo modal que el menu principal.
$("lsDevBtn") && $("lsDevBtn").addEventListener("click", () => {
  $("devModal").classList.remove("hidden");
  $("devPassInput").value = "";
  $("devPassInput").focus();
});

// Selector de skin visual de las notas. La precarga se hace lazy en playSong()
// para no pagar el coste de imagenes si el usuario juega siempre en Clasico.
$("noteskin") && $("noteskin").addEventListener("change", () => {
  savePrefs({ noteskin: $("noteskin").value });
});
$("unlockFps") && $("unlockFps").addEventListener("change", async () => {
  const on = $("unlockFps").checked;
  savePrefs({ unlockFps: on });
  // Persistir en el servidor (config.json) para que Electron aplique/quite el
  // switch de vsync AL ARRANCAR. Requiere reiniciar la app para tomar efecto.
  try {
    await fetch("/api/unlockfps", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlockFps: on }),
    });
  } catch (_) {}
  applyFpsCap();
  setStatus(on
    ? "FPS desbloqueados activados. Reinicia la app para aplicarlo. (Solo recomendado en GPUs potentes.)"
    : "FPS limitados a la pantalla (vsync). Reinicia la app para aplicarlo.");
});

// Tope de FPS en runtime. Solo relevante cuando el vsync esta DESACTIVADO
// (unlockFps): si el usuario lo activo, dejamos correr libre (cap 0). Cuando el
// vsync esta activo (por defecto) el propio compositor limita, asi que no
// imponemos cap extra.
function applyFpsCap() {
  const unlocked = getPref("unlockFps") === true;
  window.__fpsCap = unlocked ? 0 : 0;   // el vsync (o su ausencia) ya gobierna
  if (currentGame) currentGame.fpsCap = window.__fpsCap;
  if (localVs) localVs.fpsCap = window.__fpsCap;
}

// ---------- Estado de herramientas ----------
async function loadStatus() {
  try {
    const r = await fetch("/api/status");
    const { tools, downloadDir, ytdlp } = await r.json();
    const el = $("toolStatus");
    // ffmpeg es OBLIGATORIO (sin el no se puede generar ninguna pista).
    if (!tools.ffmpeg) {
      el.textContent = "⚠ ffmpeg NO instalado (obligatorio)";
      el.className = "badge badge-warn";
      el.title = "Sin ffmpeg no se pueden generar pistas. Instalalo (ver COMO-USAR.md).";
      setStatus("Falta ffmpeg: instalalo para poder jugar (mira COMO-USAR.md).");
    } else if (tools.ytdlp) {
      el.textContent = ytdlp && ytdlp.currentVersion
        ? `✓ ffmpeg · ⬇ yt-dlp ${ytdlp.currentVersion}`
        : "✓ ffmpeg · ⬇ descargas ok";
      el.className = "badge badge-on";
    } else {
      el.textContent = "✓ ffmpeg · ⬇ yt-dlp falta (sin descargas)";
      el.className = "badge badge-warn";
      el.title = "yt-dlp no instalado: el descargador no funcionara, pero si puedes jugar tus archivos.";
    }
    if (downloadDir && !$("dlFolder").value) $("dlFolder").placeholder = downloadDir;
    // Estado de yt-dlp en el panel de Carpetas.
    const ybtn = $("ytdlpUpdateBtn");
    const ystatus = $("ytdlpStatus");
    if (ybtn) {
      if (!tools.ytdlp) {
        ybtn.disabled = true;
        ybtn.textContent = "yt-dlp no instalado";
        ybtn.title = "Instala yt-dlp (ver COMO-USAR.md)";
        if (ystatus) ystatus.textContent = "No instalado";
      } else {
        const v = ytdlp && ytdlp.currentVersion;
        const days = ytdlp && ytdlp.daysUntilNext;
        const method = ytdlp && ytdlp.installMethod;
        ybtn.disabled = false;
        const methodLabel = method ? ` [${method}]` : "";
        ybtn.textContent = v ? `yt-dlp ${v}${methodLabel}` : "Comprobar yt-dlp";
        if (days != null && days > 0) ybtn.title = `Próxima revisión automática en ${days} día(s)`;
        else ybtn.title = "Actualiza yt-dlp a la última versión";
        if (ystatus) {
          ystatus.textContent = method === "pip"
            ? "instalado con pip"
            : method === "pipx"
            ? "instalado con pipx"
            : method === "conda"
            ? "instalado con conda"
            : method === "brew"
            ? "instalado con Homebrew"
            : method === "apt"
            ? "instalado con apt"
            : method === "binary"
            ? "binario standalone"
            : "";
        }
      }
    }
  } catch (_) {}
}

// Vinculamos el botón de actualización (puede que el HTML se monte despues
// de definir loadStatus, asi que lo enganchamos aqui).
document.addEventListener("DOMContentLoaded", () => {
  const ybtn = $("ytdlpUpdateBtn");
  if (ybtn) ybtn.addEventListener("click", () => offerYtdlpUpdate({ silent: false, onDone: () => loadStatus() }));
});

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

// ---------- Navegador de carpetas (selector portable, PC + Android) ----------
const _fbState = { path: null, parent: null, home: null, onPick: null };
async function fbLoad(p) {
  try {
    const url = "/api/browse" + (p ? "?path=" + encodeURIComponent(p) : "");
    const d = await (await fetch(url)).json();
    if (d.error) { setStatus("Error: " + d.error); return; }
    _fbState.path = d.path; _fbState.parent = d.parent; _fbState.home = d.home;
    $("fbPath").textContent = d.path;
    const list = $("fbList");
    list.innerHTML = d.dirs.length
      ? d.dirs.map((e) => `<div class="folder-item" data-path="${encodeURIComponent(e.path)}" style="cursor:pointer;padding:8px;border-radius:6px;">📁 ${e.name}</div>`).join("")
      : '<p class="empty" style="padding:10px;">(sin subcarpetas)</p>';
    list.querySelectorAll("[data-path]").forEach((el) =>
      el.addEventListener("click", () => fbLoad(decodeURIComponent(el.dataset.path))));
  } catch (e) { setStatus("Error al listar carpeta: " + e.message); }
}
function openFolderBrowser(startPath, onPick) {
  _fbState.onPick = onPick;
  $("folderBrowser").classList.remove("hidden");
  fbLoad(startPath || null);
}
function closeFolderBrowser() { $("folderBrowser").classList.add("hidden"); _fbState.onPick = null; }
$("fbUpBtn") && $("fbUpBtn").addEventListener("click", () => { if (_fbState.parent) fbLoad(_fbState.parent); });
$("fbHomeBtn") && $("fbHomeBtn").addEventListener("click", () => fbLoad(_fbState.home || null));
$("fbCancelBtn") && $("fbCancelBtn").addEventListener("click", closeFolderBrowser);
$("fbPickBtn") && $("fbPickBtn").addEventListener("click", () => {
  const chosen = _fbState.path; const cb = _fbState.onPick;
  closeFolderBrowser();
  if (cb && chosen) cb(chosen);
});
$("dlBrowseBtn") && $("dlBrowseBtn").addEventListener("click", () => {
  openFolderBrowser($("dlFolder").value.trim() || null, async (dir) => {
    $("dlFolder").value = dir;
    try {
      await fetch("/api/download-dir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: dir }) });
      setStatus("Carpeta de descargas: " + dir);
      await loadFolders(); await loadSongs();
    } catch (_) {}
  });
});
// Mostrar la carpeta de descargas actual al iniciar.
fetch("/api/download-dir").then((r) => r.json()).then((d) => {
  if (d.dir && !$("dlFolder").value) $("dlFolder").value = d.dir;
}).catch(() => {});

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
      <span class="song-ghost" data-ghost="${s.id}" data-name="${escapeHtml(s.name)}" title="Jugar contra tu fantasma (mejor replay)">👻</span>
      <span class="song-lb" data-lb="${s.id}" data-name="${escapeHtml(s.name)}" title="Ranking mundial">🌍</span>
      <span class="song-del" data-del="${s.id}" data-name="${escapeHtml(s.name)}" data-hasvideo="${s.hasVideo ? '1' : '0'}" data-haschart="${s.hasChart ? '1' : '0'}" title="Eliminar cancion (archivo + datos)">🗑</span>
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
      if (e.target.dataset.vs || e.target.dataset.cfg || e.target.dataset["2p"] || e.target.dataset.del || e.target.dataset.ghost || e.target.dataset.lb) return; // botones propios
      if (IS_TOUCH) openSongSetup(b.dataset.id, b.dataset.name);
      else onSongClicked(b.dataset.id, b.dataset.name);
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
  list.querySelectorAll(".song-ghost").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); playAgainstGhost(b.dataset.ghost, b.dataset.name); });
  });
  list.querySelectorAll(".song-lb").forEach((b) => {
    b.addEventListener("click", (e) => { e.stopPropagation(); openLeaderboard(b.dataset.lb, b.dataset.name); });
  });
  list.querySelectorAll(".song-del").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmAndDeleteSong({
        id: b.dataset.del,
        name: b.dataset.name,
        hasVideo: b.dataset.hasvideo === "1",
        hasChart: b.dataset.haschart === "1",
      });
    });
  });
}

// Pide confirmacion al usuario y luego elimina la cancion via API.
// Le muestra exactamente que se va a borrar para que no haya sorpresas:
//   - audio (siempre)
//   - video de fondo (si existe)
//   - stepchart real junto al audio (si existe)
//   - puntaje maximo guardado
//   - mapeos del editor de pistas (si los hay)
//   - ajustes de densidad por dificultad
async function confirmAndDeleteSong({ id, name, hasVideo, hasChart }) {
  // ¿Hay datos persistidos que se perderan? Lo pedimos al backend para
  // mostrarlo en el dialogo (asi el usuario sabe que pierde su record).
  let persisted = null;
  try {
    const r = await (await fetch(`/api/songs/${id}/datasummary?game=${encodeURIComponent(gameMode)}`)).json();
    persisted = r;
  } catch (_) {}

  const lines = [
    `Audio: ${name}`,
  ];
  if (hasVideo) lines.push("Video de fondo (mismo nombre)");
  if (hasChart) lines.push("Stepchart real (.sm/.ssc/.ucs) si existe");
  if (persisted && (persisted.hasScores || persisted.hasCustomCharts || persisted.hasSettings)) {
    lines.push("");
    lines.push("Tambien se borraran tus datos:");
    if (persisted.hasScores) lines.push("  - Mejor puntaje guardado");
    if (persisted.hasCustomCharts) lines.push(`  - ${persisted.customChartCount} chart(s) del editor`);
    if (persisted.hasSettings) lines.push("  - Ajustes de densidad por dificultad");
  }
  lines.push("");
  lines.push("Esta accion NO se puede deshacer.");

  if (!confirm(`Eliminar cancion?\n\n${lines.join("\n")}`)) return;

  try {
    const r = await (await fetch(`/api/songs/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: gameMode }),
    })).json();
    if (!r.ok) {
      alert("No se pudo eliminar:\n\n" + (r.error || "desconocido"));
      return;
    }
    // Quitar de la cache local de scores y refrescar la lista.
    if (songScores[id]) delete songScores[id];
    // Si era la ultima cancion jugada, olvidar la "ultima" para no intentar
    // recargarla y mostrar un error fantasma.
    if (lastPlay && lastPlay.id === id) lastPlay = null;
    await loadSongs();
    setStatus(`Eliminado: ${name}`);
  } catch (e) {
    alert("Error al eliminar: " + e.message);
  }
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
async function fetchChart(id, difficulty, lanes, genre, forceGenerate) {
  const g = genre || $("genre").value || "auto";
  const fg = forceGenerate ? "&forceGenerate=1" : "";
  const r = await fetch(`/api/chart/${id}?difficulty=${difficulty}&lanes=${lanes}&genre=${g}&game=${gameMode}${fg}`);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || "No se pudo generar la pista");
  }
  return r.json();
}

// Igual que fetchChart pero con PROGRESO real (SSE). Llama onProgress(pct,label)
// conforme el motor decodifica el audio y coloca las notas. Se usa para la
// pantalla de carga al jugar en solo.
function fetchChartProgress(id, difficulty, lanes, genre, onProgress, forceGenerate) {
  const g = genre || $("genre").value || "auto";
  const fg = forceGenerate ? "&forceGenerate=1" : "";
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/chart-progress/${id}?difficulty=${difficulty}&lanes=${lanes}&genre=${g}&game=${gameMode}${fg}`);
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
let series = { active: false, songs: [], difficulty: "normal", lanes: "5", players: null, wins: [0, 0], results: [], round: 0 };

// ---------- Setup VS local: elegir 3 canciones, dificultad comun y ajustes por jugador ----------
let lsPicked = [];               // [{id, name}] hasta 3
const VS_MOD_LIST = [
  ["vanish","🌫","Vanish"],["appear","✨","Appear"],["hidden","👻","Hidden"],
  ["tornado","🌀","Tornado"],["twirl","💫","Twirl"],["drunk","🌊","Drunk"],
  ["mirror","🪞","Mirror"],["random","🎲","Random"],["reverse","🔃","Reverse"],
  ["mini","🐜","Mini"],["mega","🐘","Mega"],["niebla","🌁","Niebla"],
  ["gravedad","⬇️","Gravedad"],["neon","💡","Neón"],["rebote","🏓","Rebote"],
  ["bomba","💣","Bombas"],
];
const lsMods = { p1: {}, p2: {} };   // efectos elegidos por jugador

function openLocalSetup() {
  lsPicked = [];
  series = { active: false, songs: [], difficulty: "normal", lanes: "5", players: null, wins: [0, 0], results: [], round: 0 };
  for (const k of ["p1", "p2"]) lsMods[k] = {};
  // Heredar valores actuales del menu como punto de partida.
  $("lsDifficulty").value = $("difficulty").value;
  $("lsStyle").value = $("style").value;
  $("lsP1Speed").value = $("scrollSpeed").value; $("lsP1SpeedVal").textContent = Number($("scrollSpeed").value).toFixed(1) + "x";
  $("lsP2Speed").value = $("scrollSpeed").value; $("lsP2SpeedVal").textContent = Number($("scrollSpeed").value).toFixed(1) + "x";
  renderLsMods("p1"); renderLsMods("p2");
  renderLsPicked();
  renderLsSongList();
  if ($("lsPadAssign")) $("lsPadAssign").value = getPref("vsPadAssign") || "p2";
  showScreen("localSetup");
  maybeShowTwoKbWarning();
}

// Muestra el aviso del bug de Linux/Xorg con dos teclados si aplica. Re-consulta
// el entorno (por si se conecto/desconecto un teclado) y respeta si el usuario
// ya lo cerro en esta sesion.
function maybeShowTwoKbWarning() {
  const banner = $("twoKbWarning");
  if (!banner) return;
  const show = (e) => {
    if (e && e.twoKeyboardLagRisk && !sessionStorage.getItem("twoKbWarnDismissed")) {
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  };
  // Re-consultar en vivo (rapido); si falla, usar lo que ya teniamos.
  fetch("/api/inputenv").then((r) => r.json()).then((e) => { inputEnv = e; show(e); }).catch(() => show(inputEnv));
}

$("twoKbWarningClose") && $("twoKbWarningClose").addEventListener("click", () => {
  $("twoKbWarning").classList.add("hidden");
  sessionStorage.setItem("twoKbWarnDismissed", "1");   // no repetir en esta sesion
});

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
  const padAssign = $("lsPadAssign") ? $("lsPadAssign").value : "p2";
  savePrefs({ vsPadAssign: padAssign });
  series = {
    active: true,
    songs: lsPicked.slice(),
    difficulty: $("lsDifficulty").value,
    lanes: $("lsStyle").value,
    padAssign,
    players: [
      { speed: Number($("lsP1Speed").value), mods: { ...lsMods.p1 } },
      { speed: Number($("lsP2Speed").value), mods: { ...lsMods.p2 } },
    ],
    wins: [0, 0],
    results: [],      // resultado {r1,r2,roundWinner,song} de cada ronda jugada
    round: 0,
  };
  playSeriesRound();
});

// Carga y lanza la cancion de la ronda actual de la serie.
async function playSeriesRound() {
  const song = series.songs[series.round];
  try {
    $("loadingSong").textContent = `Ronda ${series.round + 1}/${series.songs.length} — ${song.name}`;
    setLoading(0, "Preparando...");
    showScreen("loading");
    const beatmap = await fetchChartProgress(song.id, series.difficulty, series.lanes, null, (pct, label) => setLoading(pct * 0.85, label));
    if (!beatmap || !beatmap.notes || !beatmap.notes.length) throw new Error("La pista salio vacia");
    setLoading(88, "Cargando audio...");
    audioEl = await loadAudio(song.id);
    const useVideo = wantsVideo(song.id);
    if (useVideo) { setLoading(94, "Cargando video..."); await prepareVideo(song.id); }
    setLoading(100, "¡Listo!");
    await startLocalVs(song.name, beatmap, { videoBg: useVideo, players: series.players, padAssign: series.padAssign });
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
    await startLocalVs(name, beatmap, { videoBg: useVideo });
  } catch (err) {
    console.error(err);
    showScreen("menu");
    cleanupLocalVs();
    if (audioEl) { try { audioEl.dispose(); } catch (_) {} audioEl = null; }
    setStatus("Error: " + err.message);
    alert("No se pudo iniciar el VS local:\n\n" + err.message);
  }
}

// Espejo del beatmap para el jugador 2 del VS local: invierte los carriles
// izquierda<->derecha (carril i -> laneCount-1-i) conservando tiempos y holds.
// Devuelve un beatmap NUEVO (no muta el original que usa el jugador 1). Asi J2
// ve la pista espejada pero su tablero y sus teclas quedan en su sitio.
function mirrorBeatmap(bm) {
  const lc = bm.laneCount;
  return { ...bm, notes: bm.notes.map((n) => ({ ...n, lane: lc - 1 - n.lane })) };
}

// Agrega notas Item (?) a intervalos regulares para el modo VS con items.
// Se insertan en lane 0 (se puede agarrar desde cualquier carril) cada
// ~15s de cancion, empezando a los 8s para dar tiempo a ambientarse.
function addItemNotes(bm) {
  if (!bm || !bm.notes || bm.notes.length < 5) return;
  const interval = 15;            // segundos entre items
  const startOffset = 8;          // primer item a los 8s
  const endOffset = 5;            // no poner items en los ultimos 5s
  const items = [];
  for (let t = startOffset; t < bm.duration - endOffset; t += interval) {
    // Elegir un lane al azar (fuera de los existentes para no solaparse).
    // Ponemos en lane 0 (el beatmap checker lo valida).
    items.push({ time: t, lane: 0, item: true, duration: 0 });
  }
  bm.notes.push(...items);
  bm.notes.sort((a, b) => a.time - b.time);
}

async function startLocalVs(name, beatmap, extra) {
  // Asegurar pantalla limpia.
  vs = { active: false, role: null, song: null, peerName: "RIVAL", peerFinal: null };
  $("vsHud").classList.add("hidden");
  $("hud").classList.add("hidden");          // ocultamos el HUD de 1 jugador
  $("lifebar-wrap").classList.add("hidden"); // cada jugador tiene su barra en el HUD local
  $("localVsHud").classList.remove("hidden");
  // Precargar la skin visual (mismo path que playSong).
  let piuSkin = null;
  const wantedSkin = getPref("noteskin") || "classic";
  if (wantedSkin !== "classic") {
    try { piuSkin = await preloadNoteskin(wantedSkin); } catch (_) {}
  }
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
  // Calidad: la que elija el usuario (auto se ajusta sola por FPS). El trabe
  // del VS local NO era rendimiento (era el bug de Xorg con 2 teclados), asi
  // que NO forzamos calidad baja: se respeta lo que el usuario configuro.
  const userQuality = $("quality").value;
  const vsAdaptive = userQuality === "auto";
  const useVideoBg = !!(extra && extra.videoBg);
  const common = {
    quality: userQuality,
    audioOffset: Number(getPref("audioOffset")) || 0,
    videoBg: useVideoBg,
    external: true,
    allowFail: false,
    gameMode,
    piuSkin,
    devMode,
    difficulty: $("lsDifficulty").value,
  };
  const s1 = Object.assign({}, common, { scrollSpeed: p1cfg.speed, mods: { ...p1cfg.mods } });
  const s2 = Object.assign({}, common, { scrollSpeed: p2cfg.speed, mods: { ...p2cfg.mods } });
  // ESPEJO del jugador 2: la pista es la MISMA (mismo ritmo) pero con los
  // carriles invertidos izquierda<->derecha. Lo hacemos volteando las NOTAS del
  // beatmap (carril i -> laneCount-1-i), NO con mods.mirror: ese mod voltea
  // tambien receptores y dejaba las teclas sin invertir -> los controles se
  // sentian al reves. Volteando solo las notas, J2 ve la pista espejada pero su
  // tablero y sus teclas quedan en su sitio (juega natural).
  const beatmapP2 = mirrorBeatmap(beatmap);

  // VS con Items (Mario Kart style): notas ? cada ~10s si el check esta activo.
  if ($("lsItems") && $("lsItems").checked) {
    addItemNotes(beatmap);
    addItemNotes(beatmapP2);
  }

  // Renderer WebGL UNICO para los dos tableros (pantalla partida con
  // viewports). Un solo contexto GL en vez de dos. Si hay video de fondo, el
  // lienzo es transparente para que el video se vea detras de ambos tableros.
  const sharedRenderer = new SharedRenderer($("boards"), { transparentBg: useVideoBg });
  s1.sharedRenderer = sharedRenderer;
  s2.sharedRenderer = sharedRenderer;

  // Dos InputManager con perfiles de teclas distintos.
  const i1 = new InputManager("p1"); i1.start();
  const i2 = new InputManager("p2"); i2.start();
  // Asignacion de mando(s) a jugador. El usuario elige en el setup quien usa
  // mando (porque un caso muy comun es 1 teclado + 1 mando). Valores:
  //   "auto"  -> J1 = 1er mando, J2 = 2o mando (dos mandos).
  //   "p1"    -> el (unico) mando es del J1; J2 solo teclado.
  //   "p2"    -> el (unico) mando es del J2; J1 solo teclado.
  //   "both"  -> cada uno su mando (igual que auto).
  const padAssign = (extra && extra.padAssign) || getPref("vsPadAssign") || "p2";
  if (padAssign === "p1") { i1.setPadSlot(0); i2.setPadSlot(-1); }
  else if (padAssign === "p2") { i1.setPadSlot(-1); i2.setPadSlot(0); }
  else { i1.setPadSlot(0); i2.setPadSlot(1); }   // auto/both: un mando por jugador
  // Teclado sincronizado por frame: los eventos se procesan 1 vez por frame
  // (en pollGamepads), igual que el mando, para no interrumpir el render.
  i1.setFrameSync(true);
  i2.setFrameSync(true);
  // Captura TOTAL: bloquea el comportamiento por defecto del navegador para
  // CUALQUIER tecla (incluidas las NO mapeadas del 2do teclado/numpad). Ese
  // comportamiento por defecto (scroll, navegacion de foco, aceleradores) era
  // lo que retrasaba el frame ~50ms al tocar cualquier tecla -> el trabe.
  i1.setCaptureAll(true);
  i2.setCaptureAll(true);
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
  // Estado de combo por jugador (para detectar rupturas y mostrar el destello).
  const comboState = { p1: 0, p2: 0 };
  const mkHooks = (key, idx) => ({
    onScore: (s) => { const h = hud[key]; h.score = s; h.dScore = true; },
    onCombo: (c) => {
      const h = hud[key]; h.combo = c; h.dCombo = true;
      const boardEl = key === "p1" ? $("three-container") : $("rival-container");
      // El MARCO de combo por niveles va en los receptores (lo pinta el Stage).
      // Aqui solo el destello rojo breve al ROMPER un combo alto.
      comboBreakFlash(boardEl, c, comboState[key]);
      comboState[key] = c;
    },
    onLife: (life) => {
      const h = hud[key]; h.life = life; h.dLife = true;
      if (life <= 0) killPlayer(idx);     // fallo INDEPENDIENTE por jugador
    },
    // Juicio INDIVIDUAL: cada jugador ve el suyo sobre su mitad del tablero.
    onJudge: (label, color) => flashLocalJudge(key, label, color),
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
    onCountdown: showCountdown,
    onItem: (type) => applyItemEffect(g2, type, "p2"),
  }), s1);
  const g2 = new RhythmGame($("rival-container"), audioEl, beatmapP2, i2, Object.assign(mkHooks("p2", 1), {
    onItem: (type) => applyItemEffect(g1, type, "p1"),
  }), s2);

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
    fpsCap: (typeof window !== "undefined" && window.__fpsCap != null) ? window.__fpsCap : 0,
    // Estado de calidad adaptativa del bucle maestro (solo si quality=="auto").
    // Arranca en nivel 0 (calidad "auto" completa); si el FPS cae sostenido,
    // baja sola a medium y luego low. No forzamos calidad baja de entrada.
    adaptive: vsAdaptive, autoLevel: 0, lowFpsStreak: 0, fpsAccum: 0, fpsFrames: 0,
    // v0.9+ pausa (menu a mitad de cancion).
    paused: false, _pauseAt: 0 };

  // Arranque comun: ambos comparten el mismo instante de pared.
  const startWall = performance.now() / 1000;
  g1.settings.startAtSec = startWall;
  g2.settings.startAtSec = startWall;
  g1.start();
  g2.start();

  // Ya existen ambos stages: repartir viewports (mitad y mitad).
  sharedRenderer.layout();

  // Render de calentamiento: pintar UN frame completo ahora (durante la
  // transicion, no en cuenta atras) para que el driver suba texturas y prepare
  // todo. Evita el tiron de ~250ms que ocurria en el primer frame jugable.
  try { sharedRenderer.render(); } catch (_) {}

  const loop = () => {
    if (!localVs) return;
    // v0.9+ Pausa: si esta pausado, no avanzamos reloj ni ticks. El audio
    // context queda suspended, asi que currentTime() no avanza. Seguimos
    // pidiendo frames para mantener la UI responsiva (animaciones CSS).
    if (localVs.paused) {
      localVs.lastT = null;   // al reanudar, el primer dt sera 0
      localVs.raf = requestAnimationFrame(loop);
      return;
    }
    const t = performance.now();
    if (localVs.lastT == null) localVs.lastT = t;
    // Tope de FPS opcional (igual que en solo).
    if (localVs.fpsCap && localVs.fpsCap > 0) {
      const minMs = 1000 / localVs.fpsCap - 0.5;
      if (t - localVs.lastT < minMs) { localVs.raf = requestAnimationFrame(loop); return; }
    }
    const dt = Math.min(0.05, (t - localVs.lastT) / 1000);
    localVs.lastT = t;

    // Calidad adaptativa: medimos FPS cada ~0.5s y, si cae sostenidamente y el
    // usuario dejo "auto", bajamos la calidad de AMBOS tableros (medium->low).
    if (localVs.adaptive) {
      localVs.fpsAccum += dt;
      localVs.fpsFrames++;
      if (localVs.fpsAccum >= 0.5) {
        const fps = Math.round(localVs.fpsFrames / localVs.fpsAccum);
        localVs.fpsAccum = 0;
        localVs.fpsFrames = 0;
        if (fps < 50) localVs.lowFpsStreak++;
        else localVs.lowFpsStreak = Math.max(0, localVs.lowFpsStreak - 1);
        if (localVs.lowFpsStreak >= 3 && localVs.autoLevel < 2) {
          localVs.autoLevel++;
          const lvl = localVs.autoLevel === 1 ? "medium" : "low";
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
  // Limpiar FX de combo y juicios individuales de ambos tableros.
  for (const id of ["three-container", "rival-container"]) {
    const el = $(id);
    if (el) el.classList.remove("combo-break");
  }
  for (const id of ["lvsP1Judge", "lvsP2Judge"]) {
    const el = $(id); if (el) el.classList.add("hidden");
  }
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

  // Ganador de la ronda: sobreviviente si uno fallo; si no, por desempeno.
  // El desempeno es el puntaje, PERO si ambos quedan muy cerca (<3% de
  // diferencia), desempata la PRECISION, para que "mejores estadisticas"
  // (mas aciertos limpios) se reflejen en el resultado.
  let roundWinner; // 0 empate, 1 = J1, 2 = J2
  if (r1.failed && !r2.failed) roundWinner = 2;
  else if (r2.failed && !r1.failed) roundWinner = 1;
  else {
    const hi = Math.max(r1.score, r2.score, 1);
    const close = Math.abs(r1.score - r2.score) / hi < 0.03;
    if (close && r1.accuracy !== r2.accuracy) {
      roundWinner = r1.accuracy > r2.accuracy ? 1 : 2;
    } else {
      roundWinner = r1.score === r2.score ? 0 : (r1.score > r2.score ? 1 : 2);
    }
  }

  if (series.active) {
    if (roundWinner === 1) series.wins[0]++;
    else if (roundWinner === 2) series.wins[1]++;
    // Guardar el resultado de esta ronda para la tabla final (las 3 canciones).
    const song = series.songs[series.round];
    series.results.push({ r1, r2, roundWinner, song: song ? song.name : ("Ronda " + (series.round + 1)) });
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

// Aplica un efecto de Item al oponente durante ITEM_DURATION segundos.
// Se elige aleatoriamente entre 5 efectos.
const ITEM_DURATION = 10;
const ITEM_POOL = ["slow", "fast", "blind", "mirror", "bounce"];

function applyItemEffect(opponentGame, type, who) {
  if (!opponentGame) return;
  const stage = opponentGame.stage;
  const effect = type || ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
  let revert = null;
  const label = { slow: "🐌 Lentitud", fast: "⚡ Rapidez", blind: "👁️ Cegar", mirror: "🪞 Espejo", bounce: "🏓 Rebote" }[effect] || effect;

  switch (effect) {
    case "slow":
      stage.scrollSpeed = Math.max(0.5, stage.scrollSpeed * 0.5);
      revert = () => { stage.scrollSpeed = Math.min(10, stage.scrollSpeed * 2); };
      break;
    case "fast":
      stage.scrollSpeed = Math.min(10, stage.scrollSpeed * 2);
      revert = () => { stage.scrollSpeed = Math.max(0.5, stage.scrollSpeed * 0.5); };
      break;
    case "blind":
      stage.mods.hidden = true;
      revert = () => { stage.mods.hidden = false; };
      break;
    case "mirror":
      stage.mods.mirror = true;
      revert = () => { stage.mods.mirror = false; };
      break;
    case "bounce":
      stage.mods.rebote = true;
      revert = () => { stage.mods.rebote = false; };
      break;
  }

  if (revert) setTimeout(revert, ITEM_DURATION * 1000);
  setStatus(`🎮 ${who === "p1" ? "J1" : "J2"} lanzo: ${label} (${ITEM_DURATION}s)`);
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

// Resultados de una RONDA de la serie: muestra marcador y avanza. La serie
// SIEMPRE juega las 3 canciones (no termina al ganar 2). Al final, una tabla
// con las 3 canciones por jugador decide al campeon.
function showSeriesRoundResults(r1, r2, roundWinner) {
  if (audioEl) { try { audioEl.dispose(); } catch (_) {} audioEl = null; }
  restoreSoloHud();

  // La serie solo termina cuando se jugaron TODAS las canciones.
  const lastRound = series.round >= series.songs.length - 1;
  const seriesOver = lastRound;

  const title = $("resultsTitle");
  if (seriesOver) {
    const champ = decideSeriesChampion();
    if (title) title.textContent = "Serie terminada";
    $("grade").textContent = champ === 0 ? "EMPATE" : "CAMPEON J" + champ;
    $("grade").className = "grade " + (champ === 0 ? "grade-B" : "grade-S");
  } else {
    if (title) title.textContent = `Ronda ${series.round + 1} · ${roundWinner === 0 ? "Empate" : "Gana J" + roundWinner} · Serie ${series.wins[0]}—${series.wins[1]}`;
    $("grade").textContent = roundWinner === 0 ? "EMPATE" : "RONDA J" + roundWinner;
    $("grade").className = "grade " + (roundWinner === 0 ? "grade-B" : "grade-S");
  }
  $("vsResult").classList.add("hidden");

  // En la ronda final mostramos la TABLA de las 3 canciones; en rondas
  // intermedias, la tabla de la ronda recien jugada.
  if (seriesOver) fillSeriesFinalTable();
  else fillLocalResultsBody(r1, r2);

  const right = document.querySelector(".results-right");
  if (right) { right.classList.add("hidden"); }   // sin panel de ajustes en serie
  $("retryBtn").classList.add("hidden");
  $("rematchBtn").classList.add("hidden");
  showSeriesButtons(seriesOver);
  showScreen("results");
}

// Decide al campeon de la serie con las 3 canciones: primero por rondas
// ganadas; si hay empate de rondas, por PRECISION total acumulada; y si aun
// empatan, por puntaje total. Devuelve 0 (empate), 1 (J1) o 2 (J2).
function decideSeriesChampion() {
  if (series.wins[0] !== series.wins[1]) return series.wins[0] > series.wins[1] ? 1 : 2;
  let acc1 = 0, acc2 = 0, sc1 = 0, sc2 = 0;
  for (const res of series.results) {
    acc1 += res.r1.accuracy; acc2 += res.r2.accuracy;
    sc1 += res.r1.score; sc2 += res.r2.score;
  }
  if (Math.abs(acc1 - acc2) > 0.05) return acc1 > acc2 ? 1 : 2;
  if (sc1 !== sc2) return sc1 > sc2 ? 1 : 2;
  return 0;
}

// Tabla final de la serie: una fila por cancion (puntos/precision de cada
// jugador y quien gano esa cancion) + totales y campeon.
function fillSeriesFinalTable() {
  const fmt = (n) => Math.round(n).toLocaleString();
  let totS1 = 0, totS2 = 0, totA1 = 0, totA2 = 0, won1 = 0, won2 = 0;
  let rows = "";
  series.results.forEach((res, idx) => {
    const { r1, r2, roundWinner, song } = res;
    totS1 += r1.score; totS2 += r2.score;
    totA1 += r1.accuracy; totA2 += r2.accuracy;
    if (roundWinner === 1) won1++; else if (roundWinner === 2) won2++;
    const w = roundWinner === 0 ? "Empate" : "J" + roundWinner;
    const songName = song.length > 18 ? song.slice(0, 17) + "…" : song;
    rows += `<div class="rk" title="${song}">${idx + 1}. ${songName}</div>` +
      `<div class="rv">${fmt(r1.score)} · ${fmt(r2.score)} &nbsp;|&nbsp; ${r1.accuracy}% · ${r2.accuracy}% &nbsp;→ <strong>${w}</strong></div>`;
  });
  const champ = decideSeriesChampion();
  const champTxt = champ === 0 ? "EMPATE" : "Campeon: J" + champ;
  $("resultsBody").innerHTML = `
    <div class="rk"></div><div class="rv lvs-head"><strong>J1</strong> · <strong>J2</strong> (puntos | precision → ganador)</div>
    ${rows}
    <div class="rk">Rondas</div><div class="rv">${won1} · ${won2}</div>
    <div class="rk">Puntos total</div><div class="rv">${fmt(totS1)} · ${fmt(totS2)}</div>
    <div class="rk">Precision media</div><div class="rv">${(totA1 / (series.results.length || 1)).toFixed(1)}% · ${(totA2 / (series.results.length || 1)).toFixed(1)}%</div>
    <div class="rk">Resultado</div><div class="rv"><strong>${champTxt}</strong></div>`;
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
  // Colores e iconos segun el juego (gemas en guitar, FLECHAS en dance).
  const colors = gameMode === "guitar"
    ? (GUITAR_LANE_COLORS[laneCount] || GUITAR_LANE_COLORS[5])
    : LANE_COLORS[laneCount];
  // Sin glyphs: las zonas de toque van INVISIBLES encima de los receptores 3D
  // (las flechas bonitas). El usuario pica directamente sobre esas flechas.
  const labels = null;
  inp.bindTouch(cont, colors, labels);
  cont.classList.remove("hidden");
}
function teardownTouchControls(inp) {
  const cont = $("touchControls");
  if (cont) cont.classList.add("hidden");
  if (inp && inp.unbindTouch) inp.unbindTouch();
}

// ---------- Jugar (solo) ----------
// ---------- Jugar (solo) ----------
// Al pulsar una cancion: si ya tiene un CHART GRABADO (editor/comunidad) para la
// dificultad/estilo actuales, preguntamos si jugar ese chart o la pista de IA,
// y ofrecemos borrar el chart. Si no hay chart, juega directo (IA).
async function onSongClicked(id, name) {
  const difficulty = $("difficulty").value;
  const lanes = $("style").value === "4" ? 4 : 5;
  let chart = null;
  try {
    const r = await fetch(`/api/customchart/${id}?difficulty=${difficulty}&game=${gameMode}&lanes=${lanes}`);
    if (r.ok) chart = (await r.json()).chart;
  } catch (_) { /* sin red: juega IA */ }
  if (chart && chart.notes && chart.notes.length) {
    openChartChoice(id, name, difficulty, lanes, chart);
  } else {
    playSong(id, name);
  }
}

// Dialogo: elegir entre el chart grabado (editor/comunidad) o la pista de IA,
// con opcion de borrar el chart grabado.
function openChartChoice(id, name, difficulty, lanes, chart) {
  let m = $("chartChoiceModal");
  if (!m) {
    m = document.createElement("div");
    m.id = "chartChoiceModal";
    m.className = "modal hidden";
    m.innerHTML = `<div class="modal-box chart-choice-box">
      <h2>¿Qué pista jugar?</h2>
      <p class="hint" id="ccInfo"></p>
      <div class="chart-choice-btns">
        <button id="ccCustom" class="btn btn-accent">🎵 Chart grabado</button>
        <button id="ccAI" class="btn">🤖 Pista generada por IA</button>
      </div>
      <div class="chart-choice-foot">
        <button id="ccDelete" class="btn btn-danger">🗑 Borrar chart grabado</button>
        <button id="ccCancel" class="btn">Cancelar</button>
      </div>
    </div>`;
    document.body.appendChild(m);
  }
  const src = chart.source === "community"
    ? `chart de la comunidad${chart.attribution && chart.attribution.name ? " por " + escapeHtml(chart.attribution.name) : ""}`
    : "chart grabado en el editor";
  $("ccInfo").innerHTML = `"${escapeHtml(name)}" tiene un ${src} para <strong>${difficulty} · ${lanes}p</strong> (${chart.notes.length} notas).`;
  m.classList.remove("hidden");
  const close = () => m.classList.add("hidden");
  $("ccCustom").onclick = () => { close(); playSong(id, name, false); };
  $("ccAI").onclick = () => { close(); playSong(id, name, true); };
  $("ccCancel").onclick = close;
  $("ccDelete").onclick = async () => {
    if (!confirm(`¿Borrar el chart grabado de "${name}" (${difficulty} · ${lanes}p)? Esto no se puede deshacer.`)) return;
    try {
      await fetch(`/api/customchart/${id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, game: gameMode, lanes }),
      });
      close();
      setStatus(`Chart grabado de "${name}" borrado. Ahora se jugará la pista de IA.`);
      loadSongs();
    } catch (e) { alert("No se pudo borrar el chart:\n\n" + e.message); }
  };
}

async function playSong(id, name, forceGenerate = false) {
  try {
    const difficulty = $("difficulty").value;
    const lanes = $("style").value;
    // Pantalla de carga con progreso real.
    $("loadingSong").textContent = name;
    setLoading(0, "Preparando...");
    showScreen("loading");
    const beatmap = await fetchChartProgress(id, difficulty, lanes, null, (pct, label) => setLoading(pct * 0.85, label), forceGenerate);
    if (!beatmap || !beatmap.notes || beatmap.notes.length === 0) {
      throw new Error("La pista salio vacia (¿ffmpeg instalado? ¿audio valido?)");
    }
    setLoading(88, "Cargando audio...");
    audioEl = await loadAudio(id);
    // Preparar el video de fondo si la cancion lo tiene y esta activado.
    const useVideo = wantsVideo(id);
    if (useVideo) { setLoading(94, "Cargando video..."); await prepareVideo(id); }
    // Precargar la skin visual (lazy: solo si no es la classic procedural).
    // Lo hacemos ANTES de startGame para que el primer frame ya tenga texturas.
    let piuSkin = null;
    const wantedSkin = getPref("noteskin") || "classic";
    if (wantedSkin !== "classic") {
      setLoading(96, "Cargando skin...");
      try {
        piuSkin = await preloadNoteskin(wantedSkin);
      } catch (e) {
        console.warn("Skin no disponible, fallback a Clasico:", e);
        setStatus("Skin PIU no cargo (assets faltantes); usando Clasico.");
      }
    }
    setLoading(100, "¡Listo!");
    vs = { active: false, role: null, song: null, peerName: "RIVAL", peerFinal: null };
    lastPlay = { id, name, forceGenerate };   // recordar para "Reintentar"
    const srcLabel = beatmap.fromEditor ? " · chart del editor" : (beatmap.meta ? " · chart real" : "");
    const genreLabel = $("genre").value === "auto" && !beatmap.fromEditor ? ` · genero: ${beatmap.genre}` : "";
    setStatus(`BPM ~${beatmap.bpm} · ${beatmap.notes.length} notas${genreLabel}${srcLabel}.`);
    startGame(name, beatmap, { videoBg: useVideo, piuSkin });
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

  const settings = Object.assign({ scrollSpeed: Number($("scrollSpeed").value), quality: $("quality").value, mods: { ...mods }, audioOffset: Number(getPref("audioOffset")) || 0, videoBg: !!(extra && extra.videoBg), difficulty: $("difficulty").value, piuSkin: null, gameMode, vertical: isVerticalMode(), devMode }, extra);
  if (vs.active) settings.online = online;

  // v0.9+ modos: score, combo (carrera de combos), practice, replay, daily.
  const gameModeType = $("gameModeType") ? $("gameModeType").value : "score";
  // Carrera de combos: ajustamos dificultad a "normal" si no está, y forzamos
  // que el objetivo sea mantener el combo mas largo posible. La pantalla de
  // resultados ya prioriza maxCombo como criterio.
  if (gameModeType === "combo" && !extra?.difficulty) {
    settings.difficulty = settings.difficulty || "normal";
  }
  settings.gameModeType = gameModeType;
  if (gameModeType === "combo") {
    settings.allowFail = false;     // la vida no mata en carrera de combos
    settings.comboRace = true;      // game.js escala el multiplicador
    // Cambiamos la label del HUD para que se vea el objetivo del modo.
    $("scoreLabel").textContent = "MAX COMBO";
    setStatus("🎯 Carrera de combos — objetivo: maxCombo. La vida no mata, pero cada error rompe el combo.");
  } else {
    $("scoreLabel").textContent = "PUNTOS";
    setStatus("");
  }

  // Activar el video de fondo de esta partida (si se preparo).
  if (settings.videoBg) showVideo(); else teardownVideo();

  let gpuShort = "";
  currentGame = new RhythmGame($("three-container"), audioEl, beatmap, input, {
    onScore: (s) => {
      // En Carrera de Combos, el "#score" del HUD muestra el maxCombo, no los puntos.
      const showVal = settings.comboRace ? (currentGame ? currentGame.maxCombo : 0) : s;
      $("score").textContent = showVal.toLocaleString();
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
    onStatus: (msg) => { setStatus(msg); },
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

// Juicio INDIVIDUAL por jugador (VS local): cada uno sobre su mitad. Coalescado
// por frame para no forzar reflows al pisar acordes.
const _lvsJudgePending = { p1: null, p2: null };
let _lvsJudgeRaf = 0;
function flashLocalJudge(key, label, color) {
  _lvsJudgePending[key] = { label, color };
  if (_lvsJudgeRaf) return;
  _lvsJudgeRaf = requestAnimationFrame(() => {
    _lvsJudgeRaf = 0;
    for (const k of ["p1", "p2"]) {
      const jd = _lvsJudgePending[k]; _lvsJudgePending[k] = null;
      if (!jd) continue;
      const el = $(k === "p1" ? "lvsP1Judge" : "lvsP2Judge");
      if (!el) continue;
      el.textContent = jd.label;
      el.style.color = jd.color;
      el.classList.remove("hidden", "show");
      void el.offsetWidth;
      el.classList.add("show");
    }
  });
}

// Destello rojo breve al ROMPER un combo alto (no es un marco persistente).
// El marco de combo por niveles (verde/morado/dorado/rojo) lo pintan los
// receptores del tablero 3D (Stage.setComboTier), no la pagina.
function comboBreakFlash(boardEl, combo, prevCombo) {
  if (!boardEl) return;
  if (combo === 0 && prevCombo >= 10) {
    const cl = boardEl.classList;
    cl.remove("combo-break");
    void boardEl.offsetWidth;
    cl.add("combo-break");
    setTimeout(() => cl.remove("combo-break"), 600);
  }
}

$("quitBtn").addEventListener("click", quitToMenu);
// v0.9+ Menu de pausa: Esc abre/cierra el menu, Espacio reanuda.
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && screens.game.classList.contains("active")) {
    e.preventDefault();
    if (canPause()) {
      if (isPaused()) resumeGame();
      else openPauseMenu();
    }
  } else if (e.key === " " && isPaused()) {
    // Espacio = reanuda (no prevenir default aqui para no romper scrolls fuera del juego).
    e.preventDefault();
    resumeGame();
  }
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
  // Resetear el foco del teclado: tras una partida el foco puede quedar en el
  // canvas/boton del juego. Lo soltamos para que el siguiente click en un
  // campo de texto (buscador, etc.) lo capture limpio. (mitiga "no deja escribir").
  try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (_) {}
  try { window.focus(); document.body && document.body.focus && document.body.focus(); } catch (_) {}
}

// ---------- Resultados ----------
function showResults(res) {
  // Capturar contexto del fantasma (F18) ANTES de nulificar currentGame.
  const ghostCmp = currentGame && currentGame._ghostComparison ? currentGame._ghostComparison : null;
  currentGame = null;
  if (rivalBoard) { try { rivalBoard.dispose(); } catch (_) {} rivalBoard = null; }
  $("boards").classList.remove("vs");
  $("rival-container").classList.add("hidden");
  $("ghostHud").classList.add("hidden");
  const sb = $("seriesBtns"); if (sb) sb.remove();  // limpiar botones de serie si los hubo
  teardownVideo();
  teardownTouchControls(input);
  if (audioEl) { audioEl.dispose(); audioEl = null; }

  const title = $("resultsTitle");
  // Carrera de Combos: el titulo y la "calificacion" se centran en el combo.
  // El grade se mantiene (refleja accuracy) pero el badge muestra maxCombo
  // como resultado principal del modo.
  if (res.comboRace) {
    $("grade").textContent = res.grade || "F";
    $("grade").className = "grade grade-" + (res.grade || "F");
    if (title) {
      const combo = res.maxCombo || 0;
      // Categorias didacticas segun combo maximo.
      const tier =
        combo >= 200 ? "leyenda" :
        combo >= 100 ? "experto" :
        combo >= 50  ? "avanzado" :
        combo >= 20  ? "competente" : "principiante";
      const color = combo >= 200 ? "#ffd23e" : combo >= 100 ? "#ff2d7e" : combo >= 50 ? "#a855ff" : combo >= 20 ? "#29e7ff" : "#7c3aed";
      title.innerHTML = `🎯 Carrera de combos <span class="record-badge" style="background:${color};color:#000;">${combo.toLocaleString()} combo · ${tier}</span>`;
    }
  } else if (ghostCmp) {
    // F18: si jugamos contra fantasma, el titulo muestra el veredicto.
    const { diff, ghostFinalScore } = ghostCmp;
    $("grade").textContent = res.grade || "F";
    $("grade").className = "grade grade-" + (res.grade || "F");
    if (diff > 0) {
      if (title) title.innerHTML = `Resultados <span class="record-badge">🏆 +${diff.toLocaleString()} vs fantasma</span>`;
    } else if (diff === 0) {
      if (title) title.innerHTML = `Resultados <span class="record-badge" style="background:#a855ff;">🤝 Empate con tu récord</span>`;
    } else {
      if (title) title.innerHTML = `Resultados <span class="record-badge" style="background:#7c3aed;">👻 ${ghostFinalScore.toLocaleString()} sigue siendo tu récord</span>`;
    }
  } else if (res.failed) {
    $("grade").textContent = "FAILED";
    $("grade").className = "grade grade-F grade-failed";
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
    const beatmap = currentGame ? currentGame.beatmap : null;
    const duration = beatmap ? beatmap.duration : 0;
    const gm = currentGame ? currentGame.gameMode : "score";
    const isDaily = currentGame ? currentGame.isDaily : false;
    const events = currentGame ? currentGame.replayEvents : [];
    const perfectStreak = currentGame ? currentGame.maxPerfectStreak : 0;
    const failed = !!res.failed;
    authedFetch(`/api/score/${lastPlay.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: lastPlay.name, score: res.score, accuracy: res.accuracy, grade: res.grade,
        difficulty: $("difficulty").value, maxCombo: res.maxCombo, game: gameMode,
        duration, failed,
        counts: res.counts, total: res.total, songName: res.songName || lastPlay.name,
        mods: currentGame ? currentGame.stage.mods : {},
        gameMode: gm,
        perfectStreak,
        songHash: beatmap ? beatmap.songHash : null,
        isDaily,
      }),
    }).then((r) => r.json()).then((j) => {
      if (j.entry && lastPlay) {
        songScores[lastPlay.id] = j.entry;
        // Indicar al usuario si batio su record (feedback claro de que SI se guarda).
        if (!res.failed && res.score > prevBest && res.score === j.entry.best.score) {
          const t = $("resultsTitle");
          if (t) t.innerHTML = 'Resultados <span class="record-badge">★ ¡NUEVO RÉCORD!</span>';
        }
      }
      // Notificaciones: logros nuevos + resultado del daily.
      if (j.newlyUnlocked && j.newlyUnlocked.length) {
        for (const a of j.newlyUnlocked) {
          showAchievementToast(a);
        }
        refreshProfile();
      }
      if (j.dailyResult) {
        if (j.dailyResult.newRecord) {
          showToast({ icon: "🎯", title: "Daily challenge", body: "Streak: " + j.dailyResult.streak + " 🔥" });
        }
        if (j.dailyResult.rank) {
          showToast({ icon: "🏆", title: "Daily rank", body: "Puesto #" + j.dailyResult.rank + " de " + j.dailyResult.total });
        }
      }
      if (j.leaderboardResult && j.leaderboardResult.committed) {
        showToast({ icon: "🌍", title: "Ranking mundial", body: "Puesto #" + j.leaderboardResult.rank + " global" });
      } else if (j.leaderboardResult && j.leaderboardResult.queued) {
        // Silencioso: queued por rate limit o no_token. Solo mostrar si fue committed.
      }
      // F16: si el score entra al top 20 o es record personal, guardar replay.
      try {
        const inTop20 = j.leaderboardResult && j.leaderboardResult.committed && j.leaderboardResult.rank <= 20;
        if (!failed && (res.score > prevBest || inTop20)) {
          saveReplayIfInteresting(lastPlay.id, lastPlay.name, res, beatmap, events, gm, isDaily);
        }
      } catch (_) {}
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
  vs.myFinal = { score: res.score, accuracy: res.accuracy };
  if (vs.peerFinal != null) {
    const win = myScore >= vs.peerFinal.score;
    tallyOnlineRound(res, vs.peerFinal);
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

// Suma la ronda al marcador de la serie (una sola vez por ronda) y guarda los
// puntajes/precision de ambos para la tabla/desempate final.
function tallyOnlineRound(mine, peer) {
  if (onlineSeries._roundCounted === onlineSeries.round) return;
  onlineSeries._roundCounted = onlineSeries.round;
  const myScore = mine.score, peerScore = peer.score;
  if (myScore > peerScore) onlineSeries.mine++;
  else if (peerScore > myScore) onlineSeries.peer++;
  // empate: no suma a nadie
  onlineSeries.results = onlineSeries.results || [];
  onlineSeries.results.push({
    mineScore: myScore, peerScore,
    mineAcc: mine.accuracy != null ? mine.accuracy : 0,
    peerAcc: peer.accuracy != null ? peer.accuracy : 0,
  });
}

// La serie online tambien juega SIEMPRE 3 canciones. Al jugar la 3a ronda
// (round>=2), anuncia campeon decidido por rondas; si empatan en rondas,
// desempata la PRECISION total y luego el puntaje total.
function maybeAnnounceOnlineChamp(vsEl) {
  if (onlineSeries.round >= 2) {
    onlineSeries.decided = true;
    let champ;
    if (onlineSeries.mine !== onlineSeries.peer) {
      champ = onlineSeries.mine > onlineSeries.peer ? 1 : 2;
    } else {
      const res = onlineSeries.results || [];
      let accM = 0, accP = 0, scM = 0, scP = 0;
      for (const r of res) { accM += r.mineAcc; accP += r.peerAcc; scM += r.mineScore; scP += r.peerScore; }
      if (Math.abs(accM - accP) > 0.05) champ = accM > accP ? 1 : 2;
      else if (scM !== scP) champ = scM > scP ? 1 : 2;
      else champ = 0;
    }
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
  // las reales; los mods comparten estado). Solo relanzamos, conservando si se
  // habia elegido jugar la pista de IA (forceGenerate) en vez del chart grabado.
  playSong(lastPlay.id, lastPlay.name, !!lastPlay.forceGenerate);
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

// Estado de yt-dlp en la pestaña de descargas
async function updateDlYtdlpStatus() {
  try {
    const r = await fetch("/api/status");
    const { tools, ytdlp } = await r.json();
    const wrap = $("dlYtdlpStatus");
    const ver = $("dlYtdlpVer");
    if (!tools.ytdlp) {
      wrap.className = "dl-ytdlp-status warn";
      ver.textContent = "NO instalado";
    } else if (ytdlp && ytdlp.currentVersion) {
      wrap.className = "dl-ytdlp-status ok";
      ver.textContent = ytdlp.currentVersion;
    } else {
      wrap.className = "dl-ytdlp-status ok";
      ver.textContent = "disponible";
    }
  } catch (_) {}
}
updateDlYtdlpStatus();
$("dlYtdlpUpdateBtn").addEventListener("click", async () => {
  $("dlYtdlpUpdateBtn").disabled = true;
  $("dlYtdlpUpdateBtn").textContent = "Actualizando…";
  await offerYtdlpUpdate({ silent: false, onDone: () => { updateDlYtdlpStatus(); loadStatus(); } });
  $("dlYtdlpUpdateBtn").disabled = false;
  $("dlYtdlpUpdateBtn").textContent = "↻ Actualizar";
});

async function doSearch() {
  const q = $("dlQuery").value.trim();
  if (!q) return;
  const box = $("dlResults");
  box.innerHTML = '<p class="empty" style="animation:pulse 1s ease-in-out infinite">🔍 Buscando...</p>';
  try {
    const r = await fetch("/api/search?q=" + encodeURIComponent(q));
    const j = await r.json();
    if (j.error) {
      const e = new Error(j.error);
      if (j.ytdlpUpdateRecommended) e.ytdlpUpdateRecommended = true;
      throw e;
    }
    if (!j.results.length) { box.innerHTML = '<p class="empty">Sin resultados.</p>'; return; }
    box.innerHTML = j.results.map((x, i) => `
      <div class="dl-item" data-url="${escapeHtml(x.url)}" data-idx="${i}">
        <div class="dl-thumb">♫</div>
        <div class="dl-info">
          <span class="dl-title">${escapeHtml(x.title)}</span>
          <span class="dl-meta">${escapeHtml(x.uploader || "")} · ${fmtDuration(x.duration)}</span>
        </div>
        <div class="dl-actions">
          <button class="btn btn-accent dl-go" style="padding:6px 14px;font-size:12px;">⬇ Descargar</button>
        </div>
        <span class="dl-prog"></span>
        <div class="dl-prog-wrap"><div class="dl-prog-bar"></div></div>
      </div>`).join("");
    box.querySelectorAll(".dl-item").forEach((item) => {
      item.querySelector(".dl-go").addEventListener("click", () => downloadItem(item));
    });
  } catch (e) {
    const msg = (e.message || "").toLowerCase();
    if (msg.includes("yt-dlp") || msg.includes("enoent") || msg.includes("no disponible")) {
      box.innerHTML = '<p class="empty">El buscador necesita <strong>yt-dlp</strong> instalado en esta PC.<br>Mira COMO-USAR.md para instalarlo.</p>';
    } else if (e.ytdlpUpdateRecommended) {
      box.innerHTML = `<div class="dl-ytdlp-status warn" style="margin:12px 0;flex-direction:column;gap:8px;align-items:flex-start;">
        <p style="margin:0;color:var(--clr-warn);font-weight:600;">⚠ YouTube cambió su reproductor y yt-dlp está desactualizado</p>
        <p style="margin:0;font-size:12px;color:var(--text-secondary);">La búsqueda falló. Actualiza yt-dlp para arreglarlo.</p>
        <button class="btn btn-accent" style="padding:8px 16px;font-size:12px;" onclick="document.getElementById('dlYtdlpUpdateBtn').click()">↻ Actualizar yt-dlp ahora</button>
      </div>`;
    } else {
      box.innerHTML = `<p class="empty" style="color:#ff4d4d;">Error: ${escapeHtml(e.message)}</p>`;
    }
  }
}

function downloadItem(item) {
  const url = item.dataset.url;
  const folder = $("dlFolder").value.trim();
  const prog = item.querySelector(".dl-prog");
  const bar = item.querySelector(".dl-prog-bar");
  const btn = item.querySelector(".dl-go");
  btn.disabled = true;
  btn.textContent = "⏳";
  item.classList.add("downloading");
  item.classList.remove("download-error", "downloaded");
  prog.textContent = "0%";
  prog.className = "dl-prog";
  bar.style.width = "0%";
  bar.className = "dl-prog-bar";

  const qs = new URLSearchParams({ url });
  if (folder) qs.set("folder", folder);
  if ($("dlVideo").checked) qs.set("video", "1");
  if ($("dlFormat") && $("dlFormat").value) qs.set("format", $("dlFormat").value);
  const es = new EventSource("/api/download?" + qs.toString());
  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === "progress") {
      const pct = Math.round(d.percent);
      prog.textContent = `${pct}% ${d.stage}`;
      bar.style.width = `${pct}%`;
    }
    else if (d.type === "done") {
      prog.textContent = "✓ Descargado";
      prog.classList.add("dl-done");
      bar.style.width = "100%";
      bar.classList.add("done");
      btn.textContent = "✓";
      btn.style.background = "rgba(59,255,138,0.2)";
      btn.style.borderColor = "var(--clr-green)";
      btn.style.color = "var(--clr-green)";
      item.classList.remove("downloading");
      item.classList.add("downloaded");
      es.close();
      loadSongs();
      showToast({ icon: "✓", title: "Descarga completa", body: item.querySelector(".dl-title").textContent });
      if (d.communityCharts && d.communityCharts.length) {
        notifyCommunityChartsForDownload(d.file, d.communityCharts);
      }
    }
    else if (d.type === "error") {
      prog.textContent = "✕ Error";
      prog.classList.add("dl-error");
      bar.style.width = "100%";
      bar.classList.add("error");
      item.classList.remove("downloading");
      item.classList.add("download-error");
      btn.disabled = false;
      btn.textContent = "⬇ Reintentar";
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.color = "";
      es.close();
      const msg = (d.message || "").toLowerCase();
      if (msg.includes("yt-dlp") || msg.includes("no disponible") || msg.includes("enoent")) {
        showToast({ icon: "⚠", title: "yt-dlp no disponible", body: "Instalalo para descargar (ver COMO-USAR.md)" });
      } else if (d.ytdlpUpdateRecommended) {
        offerYtdlpUpdateAndRetry({ url, folder, withVideo: $("dlVideo").checked, item });
      } else if (d.videoFailed === "extractor") {
        showToast({ icon: "⚠", title: "Audio OK, video falló", body: "yt-dlp desactualizado para el video" });
        offerYtdlpUpdate({ onDone: () => { loadStatus(); updateDlYtdlpStatus(); } });
      } else {
        showToast({ icon: "✕", title: "Error de descarga", body: d.message || "desconocido" });
      }
    }
  };
  es.onerror = () => {
    es.close();
    btn.disabled = false;
    btn.textContent = "⬇ Reintentar";
    item.classList.remove("downloading");
  };
}

// Ofrece actualizar yt-dlp desde un dialogo, y si el usuario acepta,
// reintenta la descarga que acababa de fallar.
async function offerYtdlpUpdateAndRetry(opts) {
  const ok = confirm(
    "La descarga falló porque YouTube cambió su reproductor y yt-dlp está desactualizado.\n\n" +
    "¿Actualizar yt-dlp y reintentar automáticamente?"
  );
  if (!ok) return;
  const updated = await offerYtdlpUpdate({ silent: false });
  if (updated) {
    updateDlYtdlpStatus();
    setTimeout(() => downloadItemByData(opts), 300);
  }
}

// Helper: re-dispara downloadItem leyendo los argumentos de un boton
// (usado para reintentar despues de actualizar yt-dlp).
function downloadItemByData({ url, folder, withVideo, item }) {
  const prog = item.querySelector(".dl-prog");
  const bar = item.querySelector(".dl-prog-bar");
  const btn = item.querySelector(".dl-go");
  btn.disabled = true;
  btn.textContent = "⏳";
  item.classList.add("downloading");
  item.classList.remove("download-error");
  prog.textContent = "0%";
  prog.className = "dl-prog";
  if (bar) { bar.style.width = "0%"; bar.className = "dl-prog-bar"; }
  const qs = new URLSearchParams({ url });
  if (folder) qs.set("folder", folder);
  if (withVideo) qs.set("video", "1");
  const es = new EventSource("/api/download?" + qs.toString());
  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === "progress") {
      const pct = Math.round(d.percent);
      prog.textContent = `${pct}% ${d.stage}`;
      if (bar) bar.style.width = `${pct}%`;
    }
    else if (d.type === "done") {
      prog.textContent = "✓ Descargado";
      prog.classList.add("dl-done");
      if (bar) { bar.style.width = "100%"; bar.classList.add("done"); }
      btn.textContent = "✓";
      btn.style.background = "rgba(59,255,138,0.2)";
      btn.style.borderColor = "var(--clr-green)";
      btn.style.color = "var(--clr-green)";
      item.classList.remove("downloading");
      item.classList.add("downloaded");
      es.close();
      loadSongs();
      showToast({ icon: "✓", title: "Descarga completa", body: item.querySelector(".dl-title").textContent });
      if (d.communityCharts && d.communityCharts.length) notifyCommunityChartsForDownload(d.file, d.communityCharts);
    }
    else if (d.type === "error") {
      prog.textContent = "✕ Error";
      prog.classList.add("dl-error");
      if (bar) { bar.style.width = "100%"; bar.classList.add("error"); }
      item.classList.remove("downloading");
      item.classList.add("download-error");
      btn.disabled = false;
      btn.textContent = "⬇ Reintentar";
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.color = "";
      es.close();
      if (d.ytdlpUpdateRecommended) {
        showToast({ icon: "⚠", title: "Sigue fallando", body: "Video borrado, privado o restringido por región" });
      } else {
        showToast({ icon: "✕", title: "Error al reintentar", body: d.message || "desconocido" });
      }
    }
  };
  es.onerror = () => { es.close(); btn.disabled = false; btn.textContent = "⬇ Reintentar"; item.classList.remove("downloading"); };
}

// Muestra un mini-modal para actualizar yt-dlp manualmente. Devuelve true si
// la actualizacion fue exitosa (o ya estaba al dia), false si fallo.
// Si {silent:true} y ya hay datos cacheados, no vuelve a preguntar.
async function offerYtdlpUpdate({ silent = false, onDone } = {}) {
  const btn = $("ytdlpUpdateBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Actualizando..."; }
  try {
    const r = await (await fetch("/api/tools/update-ytdlp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    })).json();
    if (r.ok) {
      if (r.updated) {
        if (!silent) alert(`yt-dlp actualizado a ${r.version || "version nueva"} (${r.method || "?"}).`);
      } else if (r.upToDate) {
        if (!silent) alert("yt-dlp ya esta actualizado.");
      } else if (r.skipped) {
        if (!silent) alert(`yt-dlp se revisa cada ${r.autoUpdateIntervalDays || 7} dias. La ultima vez fue hace poco.`);
      }
      if (onDone) onDone(r);
      return true;
    }
    // Mensajes especificos segun metodo de instalacion detectado
    const method = r.installMethod || "unknown";
    const triedStr = r.strategiesTried
      ? r.strategiesTried.filter((s) => !s.skipped).map((s) => `  • ${s.name}`).join("\n")
      : "";
    const isExternallyManaged = r.error && /externally.managed|PEP.?668/i.test(r.error);
    if (method === "brew") {
      alert(
        "No se pudo actualizar yt-dlp (instalado con Homebrew).\n\n" +
        "Recomendacion manual:\n" +
        "  brew upgrade yt-dlp"
      );
    } else if (method === "apt") {
      alert(
        "No se pudo actualizar yt-dlp (instalado con apt).\n\n" +
        "Recomendacion manual:\n" +
        "  sudo apt install --only-upgrade yt-dlp"
      );
    } else if (method === "pip" && r.permissionDenied) {
      alert(
        "yt-dlp instalado con pip, pero sin permisos para actualizar globalmente.\n\n" +
        "Recomendacion:\n" +
        "  pip3 install --user -U yt-dlp\n\n" +
        "O con permisos de administrador:\n" +
        "  sudo pip3 install -U yt-dlp"
      );
    } else if (method === "pip" && isExternallyManaged) {
      alert(
        "yt-dlp instalado con pip, pero tu sistema tiene proteccion PEP 668\n" +
        "(externally-managed-environment) que bloquea pip install.\n\n" +
        "Opciones:\n" +
        "  • Usa pipx:  pipx upgrade yt-dlp\n" +
        "  • Usa Homebrew:  brew upgrade yt-dlp\n" +
        "  • Usa apt (Debian/Ubuntu):  sudo apt install --only-upgrade yt-dlp\n" +
        "  • Crea un venv:  python3 -m venv ~/.yt-dlp-venv && ~/.yt-dlp-venv/bin/pip install -U yt-dlp"
      );
    } else if (method === "pip") {
      alert(
        "No se pudo actualizar yt-dlp (instalado con pip).\n\n" +
        "Estrategias probadas:\n" + (triedStr || "  (ninguna)") + "\n\n" +
        "Recomendacion manual:\n" +
        "  pip3 install -U yt-dlp\n\n" +
        "Si falla por permisos, anade --user:\n" +
        "  pip3 install --user -U yt-dlp"
      );
    } else if (method === "pipx") {
      alert(
        "No se pudo actualizar yt-dlp (instalado con pipx).\n\n" +
        "Recomendacion manual:\n" +
        "  pipx upgrade yt-dlp"
      );
    } else if (method === "conda") {
      alert(
        "No se pudo actualizar yt-dlp (instalado con conda).\n\n" +
        "Recomendacion manual:\n" +
        "  conda update -y yt-dlp"
      );
    } else if (r.permissionDenied) {
      alert(
        "yt-dlp no se puede auto-actualizar (falta de permisos en la instalacion).\n\n" +
        "Si lo instalaste con apt/brew/pacman, reinstalalo con:\n" +
        "  pip install -U yt-dlp\n" +
        "o usa el script install.sh / install.ps1 del juego."
      );
    } else {
      let msg = "No se pudo actualizar yt-dlp:\n\n" + (r.error || r.message || "desconocido");
      if (triedStr) msg += "\n\nEstrategias probadas:\n" + triedStr;
      alert(msg);
    }
    if (onDone) onDone(r);
    return false;
  } catch (e) {
    if (!silent) alert("Error al actualizar yt-dlp: " + e.message);
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      try {
        const s = await (await fetch("/api/tools/ytdlp")).json();
        const methodLabel = s.installMethod ? ` (${s.installMethod})` : "";
        btn.textContent = s.currentVersion
          ? `yt-dlp ${s.currentVersion}${methodLabel}${s.daysUntilNext > 0 ? ` · revisado hace ${(s.autoUpdateIntervalDays || 7) - s.daysUntilNext}d` : ""}`
          : "yt-dlp (no instalado)";
      } catch (_) { btn.textContent = "yt-dlp"; }
    }
  }
}

// Req 10: tras descargar una cancion, si la comunidad tiene charts para ella,
// avisa y ofrece aplicarlos. 'file' es la ruta del archivo recien descargado;
// la emparejamos con la cancion ya recargada en allSongs (por nombre de archivo).
async function notifyCommunityChartsForDownload(file, charts) {
  // Buscar la cancion en la biblioteca recargada cuyo nombre coincida.
  const base = (file || "").split(/[\\/]/).pop().replace(/\.[^.]+$/, "").toLowerCase();
  // loadSongs() es async; reintentar brevemente hasta que aparezca.
  let song = null;
  for (let i = 0; i < 6 && !song; i++) {
    song = allSongs.find((s) => s.name.toLowerCase() === base) || allSongs.find((s) => base.includes(s.name.toLowerCase()));
    if (!song) await new Promise((r) => setTimeout(r, 400));
  }
  if (!song) return;
  const groups = {};
  for (const e of charts) { const k = `${e.game === "guitar" ? "Guitarra" : "Baile"} · ${e.difficulty} · ${e.laneCount}p`; (groups[k] = groups[k] || []).push(e); }
  const lines = Object.keys(groups).map((k) => `• ${k} (${groups[k].length})`).join("\n");
  const ok = confirm(`La comunidad ya tiene ${charts.length} chart(s) para "${song.name}":\n\n${lines}\n\n¿Quieres descargarlos y aplicarlos ahora? (en vez de generarlos automáticamente)`);
  if (!ok) return;
  let applied = 0;
  for (const e of charts) {
    try {
      const r = await fetch("/api/community/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id, fp: e.fingerprint, id: e.packageId, overwrite: true }),
      });
      const j = await r.json();
      if (j.ok) applied++;
    } catch (_) { /* sigue con los demas */ }
  }
  setStatus(`Se aplicaron ${applied} chart(s) de la comunidad a "${song.name}".`);
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
  onlineSeries = { mine: 0, peer: 0, round: 0, decided: false, _roundCounted: -1, results: [] };
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
  // Precargar skin visual para online VS.
  let piuSkin = null;
  const wantedSkin = getPref("noteskin") || "classic";
  if (wantedSkin !== "classic") { try { piuSkin = await preloadNoteskin(wantedSkin); } catch (_) {} }
  startGame(roomState.song.name, roomState.song.beatmap, { startAtSec, piuSkin });
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
  const mine = vs.myFinal || { score: myScore, accuracy: 0 };
  tallyOnlineRound(mine, vs.peerFinal);
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

// ---------- Comunidad (community-charts) ----------
// Llena los selectores de cancion (buscar + publicar) y el estado del catalogo.
function fillCommunitySongs() {
  const opts = allSongs.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  const a = $("commSong"); if (a) a.innerHTML = opts;
  const b = $("commPubSong"); if (b) b.innerHTML = opts;
}
async function refreshCommunityTab() {
  fillCommunitySongs();
  // Estado del catalogo local.
  try {
    const r = await fetch("/api/community/catalog"); const j = await r.json();
    const when = j.syncedAt ? new Date(j.syncedAt).toLocaleString() : "nunca";
    $("commCatalog").textContent = `Catálogo: ${j.count} charts · sincronizado: ${when}`;
  } catch (_) { $("commCatalog").textContent = "Catálogo: no disponible"; }
  // Estado de config (¿hay token?).
  try {
    const r = await fetch("/api/community/config"); const j = await r.json();
    if ($("commRepo") && !$("commRepo").value) $("commRepo").value = j.repo || "";
    $("commCfgStatus").textContent = j.hasToken ? "✓ Token guardado (listo para publicar)." : "Sin token: puedes buscar y descargar, pero no publicar.";
  } catch (_) {}
}
const commTabBtn = document.querySelector('.tab[data-tab="community"]');
if (commTabBtn) commTabBtn.addEventListener("click", refreshCommunityTab);

// Guardar configuracion (token/repo).
$("commSaveCfgBtn") && $("commSaveCfgBtn").addEventListener("click", async () => {
  const token = $("commToken").value.trim();
  const repo = $("commRepo").value.trim();
  const body = {};
  if (token) body.token = token;
  if (repo) body.repo = repo;
  try {
    const r = await fetch("/api/community/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    $("commToken").value = "";   // no dejar el token a la vista
    $("commCfgStatus").textContent = j.hasToken ? "✓ Token guardado (listo para publicar)." : "Repo guardado. Aún sin token.";
  } catch (e) { $("commCfgStatus").textContent = "Error: " + e.message; }
});

// Re-sincronizar catalogo.
$("commSyncBtn") && $("commSyncBtn").addEventListener("click", async () => {
  $("commCatalog").textContent = "Catálogo: sincronizando…";
  try { await fetch("/api/community/sync", { method: "POST" }); } catch (_) {}
  refreshCommunityTab();
});

// Buscar charts para la cancion seleccionada (por fingerprint + filtros).
$("commSearchBtn") && $("commSearchBtn").addEventListener("click", async () => {
  const songId = $("commSong").value;
  const box = $("commResults");
  if (!songId) { box.innerHTML = '<p class="empty">Elige una canción.</p>'; return; }
  box.innerHTML = '<p class="empty">Buscando…</p>';
  try {
    // Fingerprint de la cancion local.
    const fr = await fetch(`/api/community/fingerprint/${songId}`);
    if (!fr.ok) throw new Error("no se pudo calcular la huella de la canción");
    const { fingerprint } = await fr.json();
    const qs = new URLSearchParams({ fingerprint });
    if ($("commFilterGame").value) qs.set("game", $("commFilterGame").value);
    if ($("commFilterDiff").value) qs.set("difficulty", $("commFilterDiff").value);
    if ($("commFilterLanes").value) qs.set("lanes", $("commFilterLanes").value);
    const r = await fetch("/api/community/search?" + qs.toString());
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "el repositorio no respondió"); }
    const { results } = await r.json();
    renderCommunityResults(results, songId);
  } catch (e) {
    box.innerHTML = `<p class="empty">Error: ${escapeHtml(e.message)} (puedes seguir con tus charts locales)</p>`;
  }
});

// Pinta los resultados de busqueda con metadata + atribucion (Req 7.1, 7.4).
function renderCommunityResults(results, songId) {
  const box = $("commResults");
  if (!results || !results.length) { box.innerHTML = '<p class="empty">No hay charts de la comunidad para esta canción (con esos filtros).</p>'; return; }
  box.innerHTML = results.map((e) => {
    const game = e.game === "guitar" ? "Guitarra" : "Baile";
    return `<div class="comm-result">
      <div class="comm-result-info">
        <strong>${escapeHtml(e.title)}</strong> ${e.artist ? "· " + escapeHtml(e.artist) : ""}
        <span class="comm-tags">${game} · ${escapeHtml(e.difficulty)} · ${e.laneCount}p · ${e.noteCount} notas · ${Math.round(e.bpm)} BPM</span>
        <span class="comm-author">por ${escapeHtml(e.author || "anónimo")}</span>
      </div>
      <div class="comm-result-actions">
        <button class="btn btn-accent comm-apply" data-fp="${e.fingerprint}" data-id="${e.packageId}">Descargar y aplicar</button>
        <button class="mini-btn comm-report" data-id="${e.packageId}" title="Reportar">⚠</button>
      </div>
    </div>`;
  }).join("");
  box.querySelectorAll(".comm-apply").forEach((btn) => {
    btn.addEventListener("click", () => applyCommunityChart(songId, btn.dataset.fp, btn.dataset.id, btn));
  });
  box.querySelectorAll(".comm-report").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try { const r = await fetch(`/api/community/report?id=${encodeURIComponent(btn.dataset.id)}`); const j = await r.json(); if (j.url) window.open(j.url, "_blank"); } catch (_) {}
    });
  });
}

// Descarga y aplica un chart a la cancion local (con confirmacion de sobrescritura).
async function applyCommunityChart(songId, fp, id, btn, overwrite = false) {
  if (btn) { btn.disabled = true; btn.textContent = "Aplicando…"; }
  try {
    const r = await fetch("/api/community/apply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId, fp, id, overwrite }),
    });
    const j = await r.json();
    if (j.needsConfirm) {
      if (confirm("Ya tienes un chart local para esa dificultad/carriles. ¿Sobrescribirlo con el de la comunidad?")) {
        return applyCommunityChart(songId, fp, id, btn, true);
      }
      if (btn) { btn.disabled = false; btn.textContent = "Descargar y aplicar"; }
      return;
    }
    if (j.needAudio) { alert(j.message || "Se requiere el archivo de audio correcto para este chart."); if (btn) { btn.disabled = false; btn.textContent = "Descargar y aplicar"; } return; }
    if (!j.ok) throw new Error(j.error || "no se pudo aplicar");
    if (btn) { btn.textContent = "✓ Aplicado"; }
    setStatus("Chart de la comunidad aplicado. Ya puedes jugarlo desde la pestaña Jugar.");
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "Descargar y aplicar"; }
    alert("Error al aplicar el chart:\n\n" + e.message);
  }
}

// Publicar un chart del editor.
$("commPublishBtn") && $("commPublishBtn").addEventListener("click", async () => {
  const songId = $("commPubSong").value;
  const author = { name: $("commPubAuthor").value.trim(), contact: $("commPubContact").value.trim() || undefined };
  const st = $("commPubStatus");
  if (!songId) { st.textContent = "Elige una canción."; return; }
  if (!author.name) { st.textContent = "Pon tu nombre de autoría (obligatorio)."; return; }
  st.textContent = "Publicando…";
  try {
    const r = await fetch("/api/community/publish", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        songId, game: $("commPubGame").value, difficulty: $("commPubDiff").value,
        lanes: Number($("commPubLanes").value), author,
      }),
    });
    const j = await r.json();
    if (j.needAuth) { st.innerHTML = 'Necesitas configurar tu <strong>token de GitHub</strong> abajo para publicar.'; return; }
    if (!j.ok) throw new Error(j.error || "no se pudo publicar");
    st.innerHTML = `✓ Publicado. ${j.url ? `<a href="${j.url}" target="_blank">ver en GitHub</a>` : ""}`;
    refreshCommunityTab();
  } catch (e) {
    st.textContent = "Error: " + e.message;
  }
});

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
    onBombMode: (on) => {
      $("edBombLabel").style.display = on ? "inline" : "none";
      $("edBombToggle").style.borderColor = on ? "#ff4d4d" : "";
      $("edBombToggle").style.background = on ? "rgba(255,77,77,0.15)" : "";
    },
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
$("edBombToggle").addEventListener("click", () => {
  if (editor) editor.toggleBomb();
});
$("edAutoBomb").addEventListener("click", () => {
  if (!editor || editor.notes.length === 0) { alert("Graba algunas notas primero."); return; }
  const n = editor.assignBombsAutomatically(0.12);
  setStatus(`🎲 ${n} bombas asignadas automaticamente a la pista.`);
  if (editor.hooks.onCount) editor.hooks.onCount(editor.notes.length);
});

// Editar notas: detiene la reproduccion y abre el timeline 2D para mover,
// borrar o agregar flechas con el raton.
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
      // El servidor reentrena el modelo de IA con tu nuevo chart (en segundo
      // plano). Mostramos un aviso sutil del progreso.
      watchStepRetrain();
    } else alert("Error: " + (j.error || "no se pudo guardar"));
  } catch (e) { alert("Error: " + e.message); }
});

// Vigila el reentrenamiento del modelo de step-selection y muestra toasts:
// "aprendiendo tu estilo..." mientras entrena, y "estilo actualizado" al
// terminar. Hace polling cada 2s empezando INMEDIATAMENTE (el debounce del
// servidor es 8s pero queremos captar "scheduled" tambien).
let _stepWatchTimer = null;
function watchStepRetrain() {
  if (_stepWatchTimer) return;          // ya hay un watcher activo
  let announced = false, deadline = Date.now() + 90000;
  showToast({ icon: "🧠", title: "Aprendiendo tu estilo", body: "Reentrenando el mapeo con tu chart en segundo plano..." });
  announced = true;
  const poll = async () => {
    let st = { state: "idle" };
    try { st = await (await fetch("/api/tools/stepmodel-status")).json(); } catch (_) {}
    if (st.state === "idle" && announced) {
      showToast({ icon: "✨", title: "Estilo actualizado", body: "El mapeo automatico ahora se parece mas a como mapeas tu." });
      clearTimeout(_stepWatchTimer); _stepWatchTimer = null; return;
    }
    if (Date.now() > deadline) { clearTimeout(_stepWatchTimer); _stepWatchTimer = null; return; }
    _stepWatchTimer = setTimeout(poll, 2000);
  };
  _stepWatchTimer = setTimeout(poll, 10000);  // primera poll a los 10s (tras debounce de 8s)
}
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
    updatePadDiag();
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

// Diagnostico en vivo: muestra que botones y ejes esta reportando el mando AHORA
// mismo. Sirve para depurar mandos cuya cruceta llega como eje (hat) en vez de
// botones. Solo informativo (no asigna nada).
function updatePadDiag() {
  const el = $("keysPadDiag");
  if (!el) return;
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  if (!pads) { el.textContent = ""; return; }
  let pad = null;
  for (const p of pads) { if (p) { pad = p; break; } }
  if (!pad) { el.textContent = ""; return; }
  const btns = [];
  for (let b = 0; b < pad.buttons.length; b++) {
    const bt = pad.buttons[b];
    if (bt && (bt.pressed || bt.value > 0.5)) btns.push("B" + b);
  }
  const axes = [];
  for (let a = 0; a < pad.axes.length; a++) {
    const v = pad.axes[a];
    if (Math.abs(v) > 0.15) axes.push(`eje${a}=${v.toFixed(2)}`);
  }
  if (!btns.length && !axes.length) { el.textContent = `(mando: ${pad.mapping || "no-standard"}) pulsa un boton/cruceta…`; return; }
  el.textContent = `[${pad.mapping || "no-standard"}] detecto → ` + [...btns, ...axes].join("  ");
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
  // Trabajamos DIRECTO sobre el mapa boton->carril (no via laneToCode, que
  // colapsaba a un boton por carril y DESCARTABA la cruceta). Ademas 'btn' es
  // numero y las claves de objeto son strings: hay que coercionar a numero o la
  // comparacion falla y el boton no se mueve de su carril anterior (era el bug
  // que intercambiaba arriba/abajo, izq/der al mapear el control).
  btn = Number(btn);
  const prev = effectivePadMap(prof, lanes);   // { code: lane }
  const padMap = {};
  for (const code in prev) {
    const c = Number(code);
    const l = prev[code];
    if (c === btn) continue;     // quita el boton de su carril anterior
    if (l === lane) continue;    // libera el carril destino (deja solo el nuevo)
    padMap[c] = l;
  }
  padMap[btn] = lane;
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
  if ($("unlockFps")) $("unlockFps").checked = p.unlockFps === true;
  // Modo vertical: refleja la pref; si no hay pref guardada, ON en tactil.
  if ($("verticalTiles")) $("verticalTiles").checked = isVerticalMode();
  // Llenar el selector de skin con el catalogo y restaurar la seleccion.
  if ($("noteskin")) {
    // Poblar opciones solo una vez (la primera vez que se llama).
    if ($("noteskin").options.length <= 1) {
      for (const [id, meta] of Object.entries(SKIN_CATALOG)) {
        const opt = document.createElement("option");
        opt.value = id; opt.textContent = meta.label;
        $("noteskin").appendChild(opt);
      }
    }
    set("noteskin", p.noteskin);
  }
  // Aplicar las teclas personalizadas guardadas (si las hay).
  applySavedKeymaps();
  applyFpsCap();
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

// ============================================================================
// FEATURES v0.9+ — Perfil, logros, daily, replays, leaderboards, práctica
// ============================================================================

// ---- Toasts ----
function showToast(opts) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span class="toast-ico">${opts.icon || "ℹ️"}</span>
    <div class="toast-body"><div class="toast-title">${opts.title || ""}</div>
    <div class="toast-msg">${opts.body || ""}</div></div>`;
  $("toastContainer").appendChild(t);
  setTimeout(() => t.classList.add("toast-out"), 3500);
  setTimeout(() => t.remove(), 4000);
}
function showAchievementToast(a) {
  showToast({ icon: a.icon || "🏆", title: "Logro desbloqueado", body: `${a.title} — ${a.description}` });
}

// ---- F11: Perfil ----
let _profileCache = null;
async function refreshProfile() {
  try {
    const p = await fetchProfile();
    _profileCache = p;
    if (p) renderProfile(p);
    return p;
  } catch (e) { return null; }
}
function renderProfile(p) {
  if (!p) return;
  const s = p.stats || {};
  // Cabecera
  const name = p.displayName || "Jugador";
  $("profileName").textContent = name;
  $("profileLevel").textContent = p.level || 1;
  const xpInLevel = (p.xp || 0) % 100;
  $("profileXpFill").style.width = xpInLevel + "%";
  $("profileXpText").textContent = xpInLevel + " / 100 XP · total: " + (p.xp || 0);
  $("profileId").textContent = "ID: " + (p.userId || "").slice(0, 12) + "…";
  // Avatar: iniciales sobre un gradiente del hash del userId.
  const colors = ["#ff2d7e", "#29e7ff", "#a855ff", "#5dff8f", "#ffd23e"];
  let h = 0;
  for (const c of (p.userId || "")) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  const c1 = colors[Math.abs(h) % colors.length];
  const c2 = colors[Math.abs(h >> 3) % colors.length];
  const av = $("profileAvatar");
  av.textContent = name.slice(0, 2).toUpperCase();
  av.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
  // Stats
  $("psPlays").textContent = s.plays || 0;
  $("psBestScore").textContent = (s.bestScore || 0).toLocaleString();
  $("psBestCombo").textContent = s.bestCombo || 0;
  $("psBestAcc").textContent = (s.bestAccuracy || 0) + "%";
  $("psPerfects").textContent = s.totalPerfect || 0;
  $("psSongs").textContent = (s.songsPlayed || []).length;
  const playtimeH = Math.floor((s.totalPlaytime || 0) / 3600);
  const playtimeM = Math.floor(((s.totalPlaytime || 0) % 3600) / 60);
  $("psPlaytime").textContent = playtimeH + "h " + playtimeM + "m";
  $("psStreak").textContent = s.dailyStreak || 0;
  // Inputs (solo si no han sido tocados).
  if ($("profileNameInput") && !$("profileNameInput").dataset.touched) $("profileNameInput").value = name;
  if ($("profileAliasInput") && !$("profileAliasInput").dataset.touched) $("profileAliasInput").value = p.publicAlias || "";
  // Top canciones.
  const top = Object.entries(s.bySong || {})
    .map(([id, v]) => ({ id, name: v.name || id, ...v }))
    .sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0))
    .slice(0, 10);
  if (top.length) {
    $("profileTopSongs").innerHTML = top.map((s) =>
      `<div class="profile-song-row"><span>${escapeHtml(s.name.slice(0, 40))}</span>
        <span>★ ${(s.bestScore || 0).toLocaleString()} · ${(s.bestAccuracy || 0)}%</span></div>`
    ).join("");
  }
  // Por dificultad.
  const byD = s.byDifficulty || {};
  const diffNames = { easy: "Facil", normal: "Normal", ritmo: "Ritmo", hard: "Dificil", expert: "Experto", locura: "Locura", precision: "Precision", caos: "Caos", supervivencia: "Supervivencia", ciego: "Ciego", ruleta: "Ruleta" };
  const rows = Object.entries(byD).map(([k, v]) =>
    `<div class="profile-song-row"><span>${diffNames[k] || k}</span><span>★ ${(v.bestScore || 0).toLocaleString()} (${v.plays} jugadas)</span></div>`
  ).join("");
  $("profileByDiff").innerHTML = rows || '<p class="empty">Sin datos aún.</p>';
}

// Tab Perfil
document.querySelector('.tab[data-tab="profile"]').addEventListener("click", refreshProfile);

// Guardar cambios del perfil.
$("profileNameInput") && $("profileNameInput").addEventListener("input", (e) => { e.target.dataset.touched = "1"; });
$("profileAliasInput") && $("profileAliasInput").addEventListener("input", (e) => { e.target.dataset.touched = "1"; });
$("profileSaveBtn") && $("profileSaveBtn").addEventListener("click", async () => {
  const dn = $("profileNameInput").value.trim();
  const pa = $("profileAliasInput").value.trim();
  const j = await updateProfile({ displayName: dn, publicAlias: pa });
  if (j && j.ok) {
    showToast({ icon: "👤", title: "Perfil guardado", body: dn });
    refreshProfile();
  } else {
    showToast({ icon: "⚠", title: "Error", body: (j && j.error) || "no se pudo guardar" });
  }
});

// Cargar perfil al arrancar (en background, no bloquea).
refreshProfile();

// ---- F12: Logros ----
async function refreshAchievements() {
  try {
    const r = await authedFetch("/api/achievements");
    const j = await r.json();
    if (!j || !j.achievements) return;
    $("achCount").textContent = `(${j.unlocked}/${j.achievements.length})`;
    const byRarity = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (const a of j.achievements) if (a.unlocked) byRarity[a.rarity || "common"]++;
    $("achGrid").innerHTML = j.achievements.map((a) => {
      const locked = !a.unlocked;
      const progress = (a.progress != null && locked)
        ? `<div class="ach-progress">${a.progress}${a.condition && a.condition.gte ? " / " + a.condition.gte : ""}</div>`
        : "";
      return `<div class="ach-card ${locked ? "ach-locked" : "ach-unlocked"} ach-${a.rarity || "common"}">
        <div class="ach-ico">${a.icon || "🏆"}</div>
        <div class="ach-title">${escapeHtml(a.title)}</div>
        <div class="ach-desc">${escapeHtml(a.description)}</div>
        <div class="ach-rarity">${a.rarity || "common"}</div>
        ${progress}
      </div>`;
    }).join("");
  } catch (_) {}
}
document.querySelector('.tab[data-tab="achievements"]').addEventListener("click", refreshAchievements);

// ---- F13: Daily challenge ----
let _dailyData = null;
async function refreshDaily() {
  try {
    const r = await authedFetch("/api/daily");
    const j = await r.json();
    if (!j || !j.ok) {
      $("dailyMain").innerHTML = `<p class="empty">${j && j.error === "sin_canciones" ? "Agrega canciones a tu biblioteca para activar el daily." : "Error cargando el daily."}</p>`;
      $("dailyLb").innerHTML = "";
      $("dailyBanner").classList.add("hidden");
      return;
    }
    _dailyData = j;
    const c = j.challenge;
    $("dailyMain").innerHTML = `
      <h3>${escapeHtml(c.songName)}</h3>
      <div class="daily-meta">Dificultad: <strong>${c.difficulty}</strong></div>
      <div class="daily-mods">${(c.mods || []).map((m) => `<span class="daily-mod">${m}</span>`).join(" ")}</div>
      ${c.variant ? `<div class="daily-variant">⚠ Variante: <strong>${c.variant}</strong></div>` : ""}
      <button id="dailyPlayBtn" class="btn btn-accent">▶ Jugar desafío</button>
    `;
    $("dailyPlayBtn").addEventListener("click", () => playDailyChallenge(c));
    // Leaderboard
    const lb = j.leaderboard || [];
    const myBest = j.myBest;
    if (lb.length) {
      $("dailyLb").innerHTML = lb.map((s, i) => {
        const isMe = myBest && s.userId === myBest.userId;
        return `<div class="daily-lb-row ${isMe ? "daily-lb-me" : ""}">
          <span class="daily-lb-rank">#${i + 1}</span>
          <span class="daily-lb-name">${escapeHtml(s.name || "anon")}</span>
          <span class="daily-lb-score">${(s.score || 0).toLocaleString()}</span>
          <span class="daily-lb-acc">${s.accuracy || 0}%</span>
        </div>`;
      }).join("");
    } else {
      $("dailyLb").innerHTML = '<p class="empty">Nadie ha jugado hoy. ¡Sé el primero!</p>';
    }
    // Banner.
    const banner = $("dailyBanner");
    const modsTxt = (c.mods || []).length ? " · mods: " + c.mods.join(", ") : "";
    $("dailyBannerText").textContent = `🎯 Hoy: ${c.songName} (${c.difficulty})${modsTxt}`;
    banner.classList.remove("hidden");
  } catch (e) {
    $("dailyMain").innerHTML = `<p class="empty">Error: ${e.message}</p>`;
  }
}
document.querySelector('.tab[data-tab="daily"]').addEventListener("click", refreshDaily);
$("dailyBannerBtn") && $("dailyBannerBtn").addEventListener("click", () => {
  document.querySelector('.tab[data-tab="daily"]').click();
});
async function playDailyChallenge(c) {
  if (!c || !c.songId) return;
  // Construir mods activos a partir del daily.
  const dailyMods = {};
  for (const m of (c.mods || [])) dailyMods[m] = true;
  // Marcar para que el resultado avise al daily.
  try {
    setStatus(`Preparando daily challenge: ${c.songName}...`);
    showScreen("loading");
    $("loadingSong").textContent = "Daily: " + c.songName;
    const beatmap = await fetchChartProgress(c.songId, c.difficulty, "5", c.difficulty, (p, l) => setLoading(p * 0.85, l), false);
    if (!beatmap || !beatmap.notes || !beatmap.notes.length) throw new Error("Pista vacia");
    setLoading(88, "Cargando audio...");
    audioEl = await loadAudio(c.songId);
    setLoading(100, "¡Listo!");
    lastPlay = { id: c.songId, name: c.songName };
    // Ajustar mods del menu.
    for (const k of Object.keys(mods)) mods[k] = !!dailyMods[k];
    syncModButtons();
    // Arrancar con isDaily=true (lo recogemos en el game start).
    await startGameDaily(c.songName, beatmap, c);
  } catch (e) {
    console.error(e);
    setStatus("Error: " + e.message);
    showScreen("menu");
    alert("No se pudo iniciar el daily:\n\n" + e.message);
  }
}

async function startGameDaily(name, beatmap, dailyChallenge) {
  // Equivalente a startGame pero con isDaily + mods del daily.
  $("songName").textContent = name;
  $("score").textContent = "0";
  $("combo").textContent = "0";
  $("lifebar-fill").style.width = "50%";
  $("lifebar-fill").classList.remove("danger");
  $("three-container").innerHTML = "";
  $("vsHud").classList.add("hidden");
  $("rival-container").classList.add("hidden");
  $("boards").classList.remove("vs");
  showScreen("game");
  setStatus("");

  const settings = Object.assign({
    scrollSpeed: Number($("scrollSpeed").value),
    quality: $("quality").value,
    mods: { ...mods },
    audioOffset: Number(getPref("audioOffset")) || 0,
    videoBg: false,
    difficulty: dailyChallenge.difficulty,
    piuSkin: null,
    gameMode: "score",
    devMode: !!devMode,
    gameMode: "score",
    isDaily: true,
    dailyChallenge,
  });
  settings.gameMode = "score";
  settings.isDaily = true;
  settings.dailyChallenge = dailyChallenge;
  currentGame = new RhythmGame($("three-container"), audioEl, beatmap, input, {
    onScore: (s) => { $("score").textContent = s.toLocaleString(); },
    onCombo: (c) => { const el = $("combo"); el.textContent = c; el.classList.toggle("combo-hot", c >= 5); },
    onJudge: flashJudge,
    onLife: (life) => { const f = $("lifebar-fill"); f.style.width = life + "%"; f.classList.toggle("danger", life <= 25); },
    onCountdown: showCountdown,
    onEnd: showResults,
    onFps: (f) => { $("fps").textContent = f + " fps"; },
  }, settings);
  currentGame.start();
  setStatus("Daily challenge activo");
}

// ---- F16: Replays ----
async function refreshReplays() {
  try {
    const r = await authedFetch("/api/replays");
    const j = await r.json();
    const list = j.replays || [];
    if (!list.length) {
      $("replayList").innerHTML = '<p class="empty">Aún no tienes replays. Juega una canción para empezar.</p>';
      return;
    }
    $("replayList").innerHTML = list.map((r) => {
      const sizeKb = Math.round((r.size || 0) / 1024);
      return `<div class="replay-card">
        <div class="replay-info">
          <strong>${escapeHtml(r.songName || r.songId)}</strong>
          <span>${r.difficulty} · ${r.gameMode} · ${(r.score || 0).toLocaleString()} pts · ${r.grade}</span>
          <span class="replay-date">${new Date(r.date).toLocaleString()} · ${sizeKb} KB</span>
        </div>
        <div class="replay-actions">
          <button class="mini-btn replay-view" data-id="${r.id}">▶ Ver</button>
          <button class="mini-btn replay-export" data-id="${r.id}">⬇</button>
          <button class="mini-btn replay-del" data-id="${r.id}">🗑</button>
        </div>
      </div>`;
    }).join("");
    // Handlers
    $("replayList").querySelectorAll(".replay-view").forEach((b) =>
      b.addEventListener("click", () => viewReplay(b.dataset.id)));
    $("replayList").querySelectorAll(".replay-export").forEach((b) =>
      b.addEventListener("click", () => exportReplay(b.dataset.id)));
    $("replayList").querySelectorAll(".replay-del").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("¿Borrar este replay?")) return;
        await authedFetch("/api/replay/" + b.dataset.id, { method: "DELETE" });
        refreshReplays();
      }));
  } catch (e) {
    $("replayList").innerHTML = `<p class="empty">Error: ${e.message}</p>`;
  }
}
document.querySelector('.tab[data-tab="replays"]').addEventListener("click", refreshReplays);

function exportReplay(id) {
  authedFetch("/api/replay/" + id).then((r) => r.json()).then((j) => {
    if (!j || !j.replay) return;
    const blob = new Blob([JSON.stringify(j.replay, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `replay-${id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

// Visor simple de replay: reproduce el audio del usuario (NO el del replay) y
// muestra los juicios del replay sobre el tablero. Es una vista de la partida.
let _replayViewer = null;
async function viewReplay(id) {
  const j = await (await authedFetch("/api/replay/" + id)).json();
  if (!j || !j.replay) return alert("Replay no encontrado");
  const r = j.replay;
  // Cargar audio del usuario y mapa de notas.
  try {
    setStatus("Cargando replay...");
    showScreen("loading");
    const beatmap = { notes: r.notes.map((n) => ({ time: n.t, lane: n.l, duration: n.d || 0 })), bpm: r.bpm || 120, duration: r.duration || 0, laneCount: r.lanes || 5 };
    if (audioEl) { audioEl.dispose(); audioEl = null; }
    audioEl = await loadAudio(r.songId);
    setLoading(100, "Listo");
    // Iniciar juego "fantasma": deshabilita input (no se puede jugar).
    $("songName").textContent = r.songName + " (replay)";
    $("score").textContent = "0";
    $("combo").textContent = "0";
    $("lifebar-fill").style.width = "50%";
    $("three-container").innerHTML = "";
    $("vsHud").classList.add("hidden");
    $("rival-container").classList.add("hidden");
    $("boards").classList.remove("vs");
    showScreen("game");
    setStatus("🎬 Reproduciendo replay — input desactivado");
    currentGame = new RhythmGame($("three-container"), audioEl, beatmap, input, {
      onScore: (s) => { $("score").textContent = s.toLocaleString(); },
      onCombo: (c) => { const el = $("combo"); el.textContent = c; el.classList.toggle("combo-hot", c >= 5); },
      onJudge: flashJudge,
      onLife: () => {},
      onCountdown: showCountdown,
      onEnd: () => { showToast({ icon: "🎬", title: "Replay terminado", body: `Score: ${r.score.toLocaleString()}` }); },
      onFps: (f) => { $("fps").textContent = f + " fps"; },
    }, { scrollSpeed: Number($("scrollSpeed").value), gameMode: "replay", difficulty: r.difficulty, piuSkin: null, videoBg: false, external: false, allowFail: false, gameMode: "replay", mods: r.mods || {}, audioOffset: 0 });
    currentGame.start();
    // Reproducir los eventos del replay en el momento adecuado.
    const events = r.events || [];
    setTimeout(() => {
      for (const e of events) {
        setTimeout(() => {
          if (!currentGame || !currentGame.stage) return;
          if (e.type === "press") {
            currentGame.stage.flashReceptor(e.l);
            if (e.j) flashJudge(e.j, { PERFECT: "#5dff8f", GREAT: "#2ee6ff", GOOD: "#ffd23e", OK: "#ff9f1c", MISS: "#ff4d4d" }[e.j] || "#fff");
          }
        }, Math.max(0, e.t * 1000));
      }
    }, 50);
  } catch (e) {
    setStatus("Error: " + e.message);
    showScreen("menu");
    alert("No se pudo reproducir: " + e.message);
  }
}

// ---- F16 helper: guardar replay solo si es "interesante" ----
async function saveReplayIfInteresting(songId, songName, res, beatmap, events, gameMode, isDaily) {
  try {
    // Limitar a 1 replay por cancion (reemplaza al anterior).
    // Esto evita acumular 1000 replays; el servidor mantiene el ultimo.
    const trimmedNotes = beatmap && beatmap.notes ? beatmap.notes.map((n) => ({ t: n.time, l: n.lane, d: n.duration })) : [];
    const trimmedEvents = (events || []).slice(-2000);   // max 2000 eventos
    const payload = {
      songId, songName,
      difficulty: $("difficulty").value,
      lanes: beatmap ? beatmap.laneCount : 5,
      bpm: beatmap ? beatmap.bpm : 120,
      duration: beatmap ? beatmap.duration : 0,
      notes: trimmedNotes,
      events: trimmedEvents,
      mods: currentGame ? currentGame.stage.mods : {},
      score: res.score, maxCombo: res.maxCombo, accuracy: res.accuracy, grade: res.grade,
      perfectStreak: currentGame ? currentGame.maxPerfectStreak : 0,
      failed: !!res.failed,
      gameMode: gameMode || "score",
    };
    await authedFetch("/api/replays", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (_) {}
}

// ---- F17: Leaderboard global ----
async function openLeaderboard(songId, songName) {
  // Necesitamos el songHash. Si no lo tenemos (pista no cargada), lo pedimos
  // al servidor: el chart ya tiene songHash, pero aqui no lo tenemos a mano.
  // Truco: pedimos el chart, extraemos songHash, y pedimos el leaderboard.
  // Para no descargar el chart entero, lo hacemos lazy: si no hay cache del
  // songHash, mostramos "cargando" y luego actualizamos.
  $("lbSongName").textContent = songName;
  $("lbBody").innerHTML = '<p class="empty">Cargando...</p>';
  $("lbModal").classList.remove("hidden");
  try {
    // Intentar primero con el cache local (replays): si tenemos un replay de
    // esta cancion, sacamos el songHash de ahi. Si no, pedimos al server.
    let songHash = _songHashCache[songId];
    if (!songHash) {
      // Pedir un chart "vacío" (con forceGenerate) solo para sacar el hash.
      // PERO eso gastaría tiempo. Mejor: usar el path del audio como seed
      // determinista (lo que ya hace el server para songHash). Lo pedimos al
      // server via un endpoint ligero.
      const meta = await (await fetch("/api/community/fingerprint/" + encodeURIComponent(songId))).json();
      // El server expone /api/community/fingerprint que devuelve { fingerprint, meta }.
      // El songHash se calcula en base a duracion/bpm/notas, que requiere decodificar.
      // No tenemos un endpoint "solo songHash". Solución: usar un hash del path
      // estable por cancion. Por ahora, usamos el fingerprint que sí expone.
      if (meta && meta.fingerprint) songHash = meta.fingerprint.slice(0, 16);
    }
    if (!songHash) {
      $("lbBody").innerHTML = '<p class="empty">No se pudo obtener el identificador de la canción.</p>';
      return;
    }
    _songHashCache[songId] = songHash;
    const r = await authedFetch("/api/leaderboard/" + songHash);
    const j = await r.json();
    if (!j || !j.ok || !j.leaderboard || !j.leaderboard.entries.length) {
      $("lbBody").innerHTML = '<p class="empty">Nadie ha enviado un score a esta canción todavía. Sé el primero (necesitas token de GitHub en la pestaña Comunidad).</p>';
      return;
    }
    const me = getUserId();
    $("lbBody").innerHTML = `
      <div class="lb-head"><span>#</span><span>Jugador</span><span>Score</span><span>Acc</span><span>Grade</span></div>
      ${j.leaderboard.entries.map((e, i) => {
        const isMe = e.userId === me;
        return `<div class="lb-row ${isMe ? "lb-me" : ""}">
          <span>${i + 1}</span>
          <span>${escapeHtml(e.name || "anon")}${isMe ? " (tú)" : ""}</span>
          <span>${(e.score || 0).toLocaleString()}</span>
          <span>${e.accuracy || 0}%</span>
          <span class="lb-grade grade-${e.grade || "F"}">${e.grade || "F"}</span>
        </div>`;
      }).join("")}
    `;
  } catch (e) {
    $("lbBody").innerHTML = `<p class="empty">Error: ${e.message}</p>`;
  }
}
const _songHashCache = {};
$("lbClose") && $("lbClose").addEventListener("click", () => $("lbModal").classList.add("hidden"));

// ---- F22: Modo práctica ----
$("practiceStart") && $("practiceStart").addEventListener("input", updatePracticeRate);
$("practiceEnd") && $("practiceEnd").addEventListener("input", updatePracticeRate);
$("practiceRate") && $("practiceRate").addEventListener("input", updatePracticeRate);
function updatePracticeRate() {
  $("practiceRateVal").textContent = Number($("practiceRate").value).toFixed(2) + "x";
}
$("practiceCancelBtn") && $("practiceCancelBtn").addEventListener("click", () => $("practiceModal").classList.add("hidden"));
$("practiceStartBtn") && $("practiceStartBtn").addEventListener("click", () => {
  const start = Number($("practiceStart").value) || 0;
  const end = Number($("practiceEnd").value) || 60;
  const rate = Number($("practiceRate").value);
  const loop = $("practiceLoop").checked;
  $("practiceModal").classList.add("hidden");
  startPracticeSession({ start, end, rate, loop });
});

async function startPracticeSession({ start, end, rate, loop }) {
  // Buscar la cancion lastPlay (la que el usuario acaba de tocar) o pedir una.
  // Para simplificar: el botón de práctica se muestra DESPUÉS de jugar una
  // cancion (en la pantalla de resultados). Aquí lastPlay está definido.
  if (!lastPlay) {
    alert("Primero juega una canción para entrar al modo práctica.");
    return;
  }
  try {
    setStatus("Cargando práctica...");
    showScreen("loading");
    $("loadingSong").textContent = "Práctica: " + lastPlay.name;
    const diff = $("difficulty").value;
    const beatmap = await fetchChartProgress(lastPlay.id, diff, $("style").value, $("genre").value, (p, l) => setLoading(p * 0.85, l), false);
    if (!beatmap || !beatmap.notes) throw new Error("Pista vacía");
    // Filtrar notas al rango.
    const filtered = beatmap.notes.filter((n) => n.time >= start && n.time <= end);
    if (!filtered.length) throw new Error("No hay notas en el rango seleccionado");
    const newBeatmap = { ...beatmap, notes: filtered.map((n) => ({ ...n, time: n.time - start })), duration: end - start };
    setLoading(88, "Cargando audio...");
    audioEl = await loadAudio(lastPlay.id);
    setLoading(100, "Listo");
    // Arrancar juego con allowFail=false y isPractice=true.
    $("songName").textContent = lastPlay.name + " (práctica)";
    $("score").textContent = "0";
    $("combo").textContent = "0";
    $("lifebar-fill").style.width = "100%";
    $("lifebar-fill").classList.remove("danger");
    $("three-container").innerHTML = "";
    $("vsHud").classList.add("hidden");
    $("rival-container").classList.add("hidden");
    $("boards").classList.remove("vs");
    showScreen("game");
    setStatus("🎯 Práctica · " + rate + "x · loop: " + (loop ? "on" : "off"));
    currentGame = new RhythmGame($("three-container"), audioEl, newBeatmap, input, {
      onScore: (s) => { $("score").textContent = s.toLocaleString(); },
      onCombo: (c) => { const el = $("combo"); el.textContent = c; el.classList.toggle("combo-hot", c >= 5); },
      onJudge: flashJudge,
      onLife: (life) => { const f = $("lifebar-fill"); f.style.width = life + "%"; f.classList.toggle("danger", life <= 25); },
      onCountdown: showCountdown,
      onEnd: showResults,
      onFps: (f) => { $("fps").textContent = f + " fps"; },
    }, {
      scrollSpeed: Number($("scrollSpeed").value),
      quality: $("quality").value,
      mods: { ...mods },
      audioOffset: Number(getPref("audioOffset")) || 0,
      videoBg: false,
      difficulty: diff,
      piuSkin: null,
      gameMode: "practice",
      isPractice: true,
      practiceStart: start,
      practiceEnd: end,
      practiceRate: rate,
      practiceLoop: loop,
      allowFail: false,
      devMode: !!devMode,
    });
    currentGame.start();
  } catch (e) {
    setStatus("Error: " + e.message);
    showScreen("menu");
    alert("No se pudo iniciar la práctica:\n\n" + e.message);
  }
}

// ---- F6: Carrera de combos (selector de modo) ----
$("gameModeType") && $("gameModeType").addEventListener("change", () => {
  savePrefs({ gameModeType: $("gameModeType").value });
});
// Cargar valor guardado.
{
  const v = getPref("gameModeType") || "score";
  if ($("gameModeType")) $("gameModeType").value = v;
}

// ---- F18: Ghosts (cargar mi mejor replay como fantasma al jugar) ----
// Se activa con un toggle en opciones (no UI nueva por ahora; placeholder).
// Lo implemento como un botón "vs fantasma" en cada cancion (se añade abajo).

// ---- F1+F3: Mejoras de salas online y lobby (placeholder) ----
// (Se implementan via extension de server/rooms.js en este turno? Ver más abajo.)

// ---- Al cargar la página, refrescar daily + banner ----
refreshDaily();

// ---- F18: Jugar contra tu fantasma (mejor replay) ----
async function playAgainstGhost(songId, songName) {
  const difficulty = $("difficulty").value;
  setStatus("Buscando tu mejor replay...");
  let best;
  try {
    const r = await authedFetch("/api/replay/best?songId=" + encodeURIComponent(songId) + "&difficulty=" + encodeURIComponent(difficulty));
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      if (r.status === 404 || j.error === "sin_fantasma") {
        alert("Aún no tienes un replay guardado de esta canción en la dificultad " + difficulty + ".\n\nJuega una vez normal y vuelve a intentarlo.");
      } else {
        alert("Error: " + (j.error || r.statusText));
      }
      setStatus("");
      return;
    }
    best = (await r.json()).replay;
  } catch (e) {
    alert("Error: " + e.message);
    setStatus("");
    return;
  }
  if (!best || !best.notes || !best.notes.length) {
    alert("El replay no contiene notas reproducibles.");
    return;
  }
  const beatmap = {
    songId: best.songId,
    songHash: best.songId,
    name: best.songName,
    bpm: best.bpm || 120,
    duration: best.duration || 0,
    laneCount: best.lanes || 5,
    notes: best.notes.map((n) => ({ time: n.t, lane: n.l, duration: n.d || 0 })),
  };

  // ---- Calcular el score del fantasma a partir de los eventos del replay ----
  // Cada "press" lleva 'j' = juicio. Reproducimos la misma formula que usa el
  // motor (JUDGE base + bonus de combo creciente) para que la proyeccion sea
  // fiel. Asi sabemos cuanto llevaba acumulado el fantasma en cada t.
  const JUDGE_BASE = { PERFECT: 1000, GREAT: 600, GOOD: 300, OK: 100 };
  const ghostEvents = (best.events || []).filter((e) => e.type === "press" && e.j).sort((a, b) => a.t - b.t);
  const ghostTimeline = [];   // [{ t, cumulative }]
  let gCombo = 0, gScore = 0;
  for (const e of ghostEvents) {
    gCombo++;
    let pts = (JUDGE_BASE[e.j] || 0) + Math.min(gCombo, 100);
    if (gCombo >= 5 && e.j !== "OK") {
      const tier = gCombo - 5 + 1;
      const mult = 1 + Math.min(tier * 0.05, 0.8);
      pts = Math.round(pts * mult);
    }
    gScore += pts;
    ghostTimeline.push({ t: e.t, cumulative: gScore });
  }
  const ghostFinalScore = best.score || gScore;   // el score oficial (con desempates) manda
  // Funcion para saber cuanto llevaba el fantasma en el tiempo 'now'.
  const ghostScoreAt = (now) => {
    if (!ghostTimeline.length) return 0;
    // Busqueda binaria simple: ultima entrada con t <= now.
    let lo = 0, hi = ghostTimeline.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ghostTimeline[mid].t <= now) { ans = ghostTimeline[mid].cumulative; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  };

  try {
    setStatus("Cargando audio...");
    showScreen("loading");
    $("loadingSong").textContent = "👻 Fantasma: " + best.songName;
    if (audioEl) { audioEl.dispose(); audioEl = null; }
    audioEl = await loadAudio(songId);
    setLoading(100, "Listo");
    $("songName").textContent = best.songName + " (vs fantasma)";
    $("score").textContent = "0";
    $("combo").textContent = "0";
    $("lifebar-fill").style.width = "50%";
    $("three-container").innerHTML = "";
    $("vsHud").classList.add("hidden");
    $("rival-container").classList.add("hidden");
    $("boards").classList.remove("vs");
    // Mostrar HUD de fantasma.
    $("ghostHud").classList.remove("hidden");
    $("ghMyScore").textContent = "0";
    $("ghPeerScore").textContent = "0";
    $("ghBarFill").style.width = "50%";
    $("ghLead").textContent = "👻 " + (best.userName || "Fantasma") + " · récord " + ghostFinalScore.toLocaleString() + " pts";
    $("ghLead").className = "gh-lead";
    showScreen("game");
    setStatus("👻 Compite contra tu récord: " + (best.userName || "anon") + " · " + ghostFinalScore.toLocaleString() + " pts");
    currentGame = new RhythmGame($("three-container"), audioEl, beatmap, input, {
      onScore: (s) => {
        $("score").textContent = s.toLocaleString();
        if (currentGame) updateGhostHud(s, ghostScoreAt(currentGame._clock), ghostFinalScore);
      },
      onCombo: (c) => { const el = $("combo"); el.textContent = c; el.classList.toggle("combo-hot", c >= 5); },
      onJudge: flashJudge,
      onLife: (life) => { const f = $("lifebar-fill"); f.style.width = life + "%"; f.classList.toggle("danger", life <= 25); },
      onCountdown: showCountdown,
      onEnd: (res) => {
        // Comparacion final.
        $("ghostHud").classList.add("hidden");
        const diff = res.score - ghostFinalScore;
        const tag = diff > 0 ? "🏆 ¡Le ganaste a tu récord!" : (diff === 0 ? "🤝 Empate con tu fantasma" : "👻 Tu récord sigue mandando");
        showToast({ icon: diff > 0 ? "🏆" : "👻", title: tag, body: (diff > 0 ? "+" : "") + diff.toLocaleString() + " pts vs fantasma" });
        // Guardar contexto para que showResults lo muestre en pantalla.
        currentGame._ghostComparison = { diff, ghostFinalScore };
        showResults(res);
      },
      onFps: (f) => { $("fps").textContent = f + " fps"; },
    }, {
      scrollSpeed: Number($("scrollSpeed").value),
      quality: $("quality").value,
      mods: { ...mods },
      audioOffset: Number(getPref("audioOffset")) || 0,
      videoBg: false,
      difficulty: best.difficulty || difficulty,
      piuSkin: null,
      gameMode: "ghost",
      devMode: !!devMode,
    });
    currentGame.start();
    // Reproducir las teclas del fantasma y, a la vez, ir actualizando el HUD
    // del fantasma con la proyeccion de score en tiempo real.
    setTimeout(() => {
      for (const e of ghostEvents) {
        setTimeout(() => {
          if (!currentGame || !currentGame.stage) return;
          currentGame.stage.flashReceptor(e.l);
          try { currentGame.stage.hitEffect(e.l); } catch (_) {}
          // Actualizar el score del fantasma en el HUD.
          const idx = ghostTimeline.findIndex((g) => g.t === e.t);
          if (idx >= 0) {
            const g = ghostTimeline[idx].cumulative;
            $("ghPeerScore").textContent = g.toLocaleString();
            if (currentGame) updateGhostHud(currentGame.score || 0, g, ghostFinalScore);
          }
        }, Math.max(0, e.t * 1000));
      }
    }, 50);
  } catch (e) {
    $("ghostHud").classList.add("hidden");
    setStatus("Error: " + e.message);
    showScreen("menu");
    alert("No se pudo iniciar el fantasma: " + e.message);
  }
}

// Actualiza la barra de ventaja del HUD del fantasma: 50% = empate, >50% = yo
// gano, <50% = el fantasma va ganando.
function updateGhostHud(myScore, ghostScore, ghostFinal) {
  const total = Math.max(myScore, ghostScore, 1);
  const myPct = (myScore / (myScore + ghostScore)) * 100;
  $("ghBarFill").style.width = myPct.toFixed(1) + "%";
  const lead = $("ghLead");
  if (myScore > ghostScore) {
    lead.textContent = "▲ +" + (myScore - ghostScore).toLocaleString() + " vas ganando";
    lead.className = "gh-lead win";
  } else if (ghostScore > myScore) {
    lead.textContent = "▼ -" + (ghostScore - myScore).toLocaleString() + " el fantasma va ganando";
    lead.className = "gh-lead lose";
  } else {
    lead.textContent = "= empate";
    lead.className = "gh-lead";
  }
}

// ---- F8: Tutorial ----
// Beatmap tutorial MUY simple: 1 cancion ficticia con 16 notas espaciadas
// para que el jugador aprenda los juicios (PERFECT/GOOD/MISS) y el combo.
function startTutorial() {
  const lanes = 5;
  const notes = [];
  // Patron basico: alternamos 4 carriles distintos cada 1.0s durante 16 beats.
  // El usuario tiene que seguir el ritmo con las flechas.
  const pattern = [
    [0], [2], [1], [3], [0, 1], [2, 3], [4], [2], [1, 3], [0, 4], [1], [3], [0, 2], [1, 3], [4], [2]
  ];
  let t = 2.0;       // lead-in
  const step = 0.9;  // segundos entre notas
  for (const chord of pattern) {
    for (const l of chord) notes.push({ time: t, lane: l, duration: 0 });
    t += step;
  }
  const beatmap = {
    songId: "__tutorial__",
    songHash: "tutorial-v1",
    name: "Tutorial",
    bpm: 120,
    duration: t + 2,
    laneCount: lanes,
    notes,
  };
  $("songName").textContent = "Tutorial";
  $("score").textContent = "0";
  $("combo").textContent = "0";
  $("lifebar-fill").style.width = "100%";
  $("lifebar-fill").classList.remove("danger");
  $("three-container").innerHTML = "";
  $("vsHud").classList.add("hidden");
  $("rival-container").classList.add("hidden");
  $("ghostHud").classList.add("hidden");
  $("boards").classList.remove("vs");
  showScreen("game");
  setStatus("📘 Tutorial — sigue el ritmo con las flechas (4 carriles)");
  // El tutorial necesita audio valido para que el motor avance el reloj;
  // generamos un metronomo sintetico (clicks en cada nota) en el AudioContext
  // existente (no creamos uno nuevo ni descargamos audio de la red).
  try {
    if (!audioEl) audioEl = new AudioPlayer();
    audioEl.generateMetronome(notes.map((n) => n.time), { duration: beatmap.duration });
  } catch (e) {
    console.warn("No se pudo generar el audio del tutorial:", e);
  }
  currentGame = new RhythmGame($("three-container"), audioEl, beatmap, input, {
    onScore: (s) => { $("score").textContent = s.toLocaleString(); },
    onCombo: (c) => { const el = $("combo"); el.textContent = c; el.classList.toggle("combo-hot", c >= 5); },
    onJudge: flashJudge,
    onLife: (life) => { const f = $("lifebar-fill"); f.style.width = life + "%"; f.classList.toggle("danger", life <= 25); },
    onCountdown: showCountdown,
    onEnd: (res) => {
      showResults(res);
      setTimeout(() => {
        showToast({ icon: "📘", title: "Tutorial completado", body: "Acc: " + res.accuracy + "% · " + res.grade + " · " + res.maxCombo + " combo" });
      }, 1500);
    },
    onFps: (f) => { $("fps").textContent = f + " fps"; },
  }, {
    scrollSpeed: Number($("scrollSpeed").value),
    quality: $("quality").value,
    mods: { ...mods },
    audioOffset: 0,
    videoBg: false,
    difficulty: "normal",
    piuSkin: null,
    gameMode: "tutorial",
    allowFail: false,
    devMode: !!devMode,
  });
  currentGame.start();
}
// Botón de tutorial: lo añadimos al menu principal.
document.addEventListener("DOMContentLoaded", () => {
  const btn = $("tutorialBtn");
  if (btn) btn.addEventListener("click", () => {
    // El tutorial usa un audio sintetico (no descargamos nada de la red).
    startTutorial();
  });
  // Botón "Practicar" desde la pantalla de resultados.
  const pb = $("practiceFromResultsBtn");
  if (pb) pb.addEventListener("click", () => {
    if (!lastPlay) return alert("No hay canción para practicar.");
    $("practiceModal").classList.remove("hidden");
    // Inicializar el rango con la duración de la cancion (si la tenemos).
    const dur = (currentGame && currentGame.beatmap && currentGame.beatmap.duration) || 60;
    $("practiceEnd").max = Math.max(60, Math.ceil(dur));
    $("practiceEnd").value = Math.min(60, Math.ceil(dur));
    $("practiceStart").max = Math.max(60, Math.ceil(dur) - 1);
    updatePracticeRate();
  });
});

// ============================================================================
// v0.9+ Menu de pausa (solo para solitario y VS local)
// ============================================================================
//
// El menu se abre con Esc y permite: reanudar, reiniciar, practicar desde
// donde estas, ajustar opciones, o salir. Solo se permite pausar en modos
// donde el reloj es local (no online: ahi pausar = romper la sincronia con
// el rival; no daily/tutorial/ghost/practice: ya tienen su propio flujo).
//
// Implementacion:
//   - Solo: game.pause() en game.js suspende el _loop y el audio source.
//   - VS local: localVs.paused = true; el master loop de localVs salta los
//     ticks y el audio source compartido se suspende.
//   - El audio context se mantiene vivo (suspend, no close), asi al reanudar
//     el reloj del audio continua sin saltos.

let _pauseOrigin = null;   // "solo" | "localVs" - de donde se pauso (para resume).

// Devuelve true si el modo actual permite pausa a mitad de cancion.
function canPause() {
  // Solo si estamos en pantalla de juego con un juego activo y SIN estar en
  // modos donde pausar romperia la experiencia.
  if (!screens.game.classList.contains("active")) return false;
  if (currentGame && currentGame.gameMode === "replay") return false;   // visor
  if (currentGame && currentGame.isPractice) return false;              // ya en practica
  if (currentGame && currentGame.gameMode === "tutorial") return false; // ya es un mini-juego
  if (vs.active) return false;       // online: nunca (romperia sync con rival)
  // daily: permitimos pausa (es modo local, no afecta a nadie).
  if (currentGame && currentGame.isDaily) return true;
  if (localVs) return true;          // VS local
  if (currentGame && currentGame.gameMode === "ghost") return true;     // vs tu fantasma
  if (currentGame) return true;      // solo normal
  return false;
}
function isPaused() {
  if (localVs) return !!localVs.paused;
  if (currentGame) return !!currentGame.paused;
  return false;
}

function openPauseMenu() {
  if (!canPause() || isPaused()) return;
  if (localVs) {
    localVs.paused = true;
    localVs._pauseAt = audioEl ? audioEl.currentTime() : 0;
    if (audioEl) { try { audioEl.suspend(); } catch (_) {} }
    _pauseOrigin = "localVs";
  } else if (currentGame) {
    currentGame.pause();
    _pauseOrigin = "solo";
  } else return;
  // Pausar el video de fondo (si esta activo). syncVideo re-encargara al reanudar.
  if (videoActive) {
    const v = $("bgVideo");
    try { v.pause(); } catch (_) {}
  }
  // Mostrar info actual.
  $("pauseInfo").textContent = describePauseState();
  $("pauseModal").classList.remove("hidden");
  // Enfocar el botón de continuar para que Enter/Espacio lo activen.
  setTimeout(() => { try { $("pauseResumeBtn").focus(); } catch (_) {} }, 50);
}

function describePauseState() {
  if (localVs) {
    const g1 = localVs.games[0], g2 = localVs.games[1];
    const t = (audioEl && audioEl.currentTime) ? audioEl.currentTime() : 0;
    const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    return `Tiempo: ${fmt(t)} · J1: ${g1.combo} combo · J2: ${g2.combo} combo`;
  }
  if (currentGame) {
    const t = currentGame._clock || 0;
    const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    return `Tiempo: ${fmt(t)} · Combo: ${currentGame.combo} · Vida: ${Math.round(currentGame.life)}%`;
  }
  return "Pausa";
}

function resumeGame() {
  if (!isPaused()) { $("pauseModal").classList.add("hidden"); return; }
  if (localVs) {
    localVs.paused = false;
    localVs._pauseAt = 0;
    if (audioEl) {
      try {
        const r = audioEl.resume();
        if (r && r.then) r.catch(() => {});
      } catch (_) {}
    }
  } else if (currentGame) {
    currentGame.resume();
  }
  // Reanudar el video de fondo: syncVideo() lo re-anchara al reloj de la
  // cancion en el siguiente frame (vuelve a llamar v.play()).
  $("pauseModal").classList.add("hidden");
  _pauseOrigin = null;
}

// Reiniciar la cancion desde el principio (mismo modo, mismos ajustes).
function pauseRestart() {
  if (!lastPlay) return;
  const id = lastPlay.id, name = lastPlay.name;
  resumeGame();   // quita el modal antes de lanzar el nuevo juego
  // Reusar el camino normal: si estamos en VS local, abrir setup; si no, playSong.
  if (localVs) {
    setTimeout(() => playLocalVs(id, name), 50);
  } else {
    setTimeout(() => playSong(id, name, !!lastPlay.forceGenerate), 50);
  }
}

// Salir al menu (con confirmacion para no perder el progreso por accidente).
function pauseQuit() {
  if (!confirm("¿Salir al menú? Perderás el progreso de esta partida.")) return;
  resumeGame();
  $("pauseModal").classList.add("hidden");
  quitToMenu();
}

// Ajustes: mostramos el menu normal (con un boton "Volver al juego" no es
// trivial sin pantalla de settings propia; lo mas simple: minimizamos la
// pausa a un toast, abrimos settings, y al cerrar el menu de settings se
// puede reabrir la pausa). Para v1 basico abrimos settings como sub-menu.
function pauseSettings() {
  // Truco: ocultar pausa momentaneamente, abrir el menu de opciones via
  // tab, y dejar que el usuario vuelva con click en "Jugar". No es ideal,
  // pero es lo unico viable sin re-arquitectura de pantallas.
  resumeGame();
  // Cambiar a la tab de opciones/carpetas. Si el usuario quiere seguir
  // jugando, tiene que volver a Jugar (la pausa solo se reabre con Esc).
  const tab = document.querySelector('.tab[data-tab="settings"]');
  if (tab) tab.click();
  showToast({ icon: "⚙", title: "Ajustes", body: "Pulsa Esc al volver a la partida para reabrir la pausa." });
}

// Practicar desde el punto actual: convertir el reloj pausado en rango de
// práctica. Cierra la partida actual (la cancelamos) y lanza el modo práctica
// con el rango = [tiempo_actual, fin].
function pausePractice() {
  if (!lastPlay || !currentGame) return;
  const t = Math.max(0, Math.floor(currentGame._clock || 0));
  const dur = (currentGame.beatmap && currentGame.beatmap.duration) || 60;
  resumeGame();
  $("pauseModal").classList.add("hidden");
  // Arrancamos práctica DESDE 't'. Si la cancion no estaba en modo práctica,
  // forzamos el flag al iniciar.
  setTimeout(() => startPracticeSession({ start: t, end: Math.max(t + 15, Math.ceil(dur)), rate: 1.0, loop: true }), 50);
}

// Wire de los botones del modal de pausa.
$("pauseResumeBtn") && $("pauseResumeBtn").addEventListener("click", resumeGame);
$("pauseRestartBtn") && $("pauseRestartBtn").addEventListener("click", pauseRestart);
$("pausePracticeBtn") && $("pausePracticeBtn").addEventListener("click", pausePractice);
$("pauseSettingsBtn") && $("pauseSettingsBtn").addEventListener("click", pauseSettings);
$("pauseQuitBtn") && $("pauseQuitBtn").addEventListener("click", pauseQuit);
// Click fuera de la caja tambien reanuda (comportamiento estandar).
$("pauseModal") && $("pauseModal").addEventListener("click", (e) => {
  if (e.target.id === "pauseModal") resumeGame();
});

// Indicador sutil en pantalla: una pill pequeña arriba a la izquierda que
// dice "PAUSA · pulsa Esc" durante unos frames. Opcional y sutil.
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && screens.game.classList.contains("active") && !isPaused() && canPause()) {
    // El modal se abrio: pintamos un toast rapido para que el usuario vea
    // el atajo. No bloquea nada.
    // (No se muestra cada vez: solo si es la primera vez por sesion).
    if (!sessionStorage.getItem("pauseTipShown")) {
      sessionStorage.setItem("pauseTipShown", "1");
      setTimeout(() => showToast({ icon: "⏸", title: "Pausa", body: "Esc = continuar · Espacio = continuar" }), 200);
    }
  }
});


// ============================================================================
// FLUJO TÁCTIL (móvil): elegir canción → opciones → efectos → jugar.
// En vez de las 3 columnas de PC, en táctil la lista de canciones va a pantalla
// completa y, al tocar una, sube una hoja con las opciones (dificultad, estilo,
// velocidad, calidad, etc.) y luego los efectos. Reutiliza los MISMOS controles
// del DOM (se reubican dentro de la hoja), así toda la lógica existente sigue
// funcionando sin duplicar nada.
// ============================================================================
let _msBuilt = false;
let _msSong = null;

function buildMobileSetup() {
  if (_msBuilt) return;
  _msBuilt = true;
  const ov = document.createElement("div");
  ov.id = "mobileSetup";
  ov.innerHTML = `
    <div class="ms-backdrop"></div>
    <div class="ms-sheet">
      <div class="ms-head">
        <div class="ms-cover" id="msCover">♪</div>
        <div class="ms-head-txt">
          <div class="ms-title" id="msTitle"></div>
          <div class="ms-sub" id="msSub"></div>
        </div>
        <button class="ms-close" id="msClose" aria-label="Cerrar">✕</button>
      </div>
      <div class="ms-steps">
        <button class="ms-tab active" data-step="opts">1 · Opciones</button>
        <button class="ms-tab" data-step="fx">2 · Efectos</button>
      </div>
      <div class="ms-body">
        <div class="ms-step active" id="msOpts"></div>
        <div class="ms-step" id="msMods"></div>
      </div>
      <div class="ms-actions">
        <button class="btn ms-map" id="msMap">✎ Mapear esta canción</button>
        <button class="btn btn-accent ms-play" id="msPlay">▶ Jugar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  // Reubicar los controles REALES dentro de la hoja (una sola vez). Así sus
  // handlers (savePrefs, etc.) siguen vivos y no duplicamos estado.
  const opts = document.querySelector(".opts-panel .options");
  if (opts) $("msOpts").appendChild(opts);
  const mods = document.querySelector(".mods-panel .mods-grid");
  if (mods) $("msMods").appendChild(mods);

  ov.querySelectorAll(".ms-tab").forEach((t) =>
    t.addEventListener("click", () => msShowStep(t.dataset.step)));
  $("msClose").addEventListener("click", closeSongSetup);
  ov.querySelector(".ms-backdrop").addEventListener("click", closeSongSetup);
  $("msPlay").addEventListener("click", () => {
    const s = _msSong; closeSongSetup(); if (s) onSongClicked(s.id, s.name);
  });
  $("msMap").addEventListener("click", () => {
    const s = _msSong; closeSongSetup(); if (s) openEditorForSong(s.id, s.name);
  });
}

function msShowStep(step) {
  document.querySelectorAll("#mobileSetup .ms-tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.step === step));
  const o = $("msOpts"), m = $("msMods");
  if (o) o.classList.toggle("active", step === "opts");
  if (m) m.classList.toggle("active", step === "fx");
}

function openSongSetup(id, name) {
  buildMobileSetup();
  _msSong = { id, name };
  $("msTitle").textContent = name;
  $("msSub").textContent = ($("style").value === "4") ? "DDR · 4 flechas" : "Pump It Up · 5 paneles";
  const cov = $("msCover");
  cov.style.backgroundImage = ""; cov.textContent = "♪";
  const img = new Image();
  img.onload = () => { cov.style.backgroundImage = `url(/api/cover/${id})`; cov.textContent = ""; cov.classList.add("has-cover"); };
  img.src = `/api/cover/${id}`;
  msShowStep("opts");
  $("mobileSetup").classList.add("open");
}

function closeSongSetup() {
  const o = $("mobileSetup");
  if (o) o.classList.remove("open");
}

// Abre el Editor con la canción ya seleccionada (mapear esta canción).
function openEditorForSong(id, name) {
  const tab = document.querySelector('.tab[data-tab="editor"]');
  if (tab) tab.click();
  const sel = $("edSong");
  if (sel) {
    // El selector del editor puede tardar en poblarse; reintentar un par de veces.
    let tries = 0;
    const set = () => { sel.value = id; if (sel.value !== id && tries++ < 10) setTimeout(set, 150); };
    set();
  }
}

// Activar la UI móvil (táctil): lista de canciones a pantalla completa y el
// resto vía la hoja + pestañas con scroll horizontal.
if (typeof IS_TOUCH !== "undefined" && IS_TOUCH) {
  document.body.classList.add("mobile-ui");
}
