// electron/main.cjs
// Envuelve el juego como app de escritorio (Linux / Windows / macOS).
//
// Como funciona: arranca el MISMO servidor Node local (server/index.js) como
// proceso hijo y abre una ventana de navegador apuntando a el. Asi reusamos
// toda la arquitectura existente (motor que decodifica audio, genera pistas,
// sirve el frontend y hospeda el modo VS) sin reescribir nada.

const { app, BrowserWindow, shell, dialog, Menu } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 5174;
const URL = `http://localhost:${PORT}`;

// ---------- FPS desbloqueados (OPT-IN, leido de config al arrancar) ----------
// Por defecto el vsync queda ACTIVADO (render a la frecuencia del monitor: 60Hz
// estable, o 120/144Hz en pantallas de alta tasa). Desactivar el vsync solo
// ayuda en GPUs potentes con monitores de alta frecuencia; en GPUs modestas
// EMPEORA (la GPU se satura y el compositor cae a ~15fps). Por eso solo
// desactivamos vsync si el usuario lo pidio explicitamente (config.json).
// Los switches deben aplicarse ANTES de app.ready, asi que leemos el archivo
// de configuracion de forma sincrona aqui.
function readUnlockFpsPref() {
  try {
    const cfgFile = path.join(require("node:os").homedir(), ".rhythm-dance", "config.json");
    const raw = require("node:fs").readFileSync(cfgFile, "utf8");
    return JSON.parse(raw).unlockFps === true;   // solo true explicito
  } catch (_) { return false; }
}
if (readUnlockFpsPref()) {
  app.commandLine.appendSwitch("disable-frame-rate-limit");
  app.commandLine.appendSwitch("disable-gpu-vsync");
}

// ---------- Teclado en Linux/Wayland ----------
// En sesiones Wayland (KDE/GNOME), Electron por defecto corre bajo XWayland.
// En KDE Plasma 6 + XWayland hay un bug conocido por el que la ventana no
// recibe bien el foco de teclado y NO se puede escribir en los campos de texto
// (buscador, nombres, IPs...). Usar Wayland NATIVO (con su protocolo
// text-input) lo soluciona. 'auto' usa Wayland si la sesion lo es, y cae a X11
// en sesiones X11, asi que es seguro. Se puede desactivar con
// RHYTHM_NO_WAYLAND=1 por si algun entorno concreto diera problemas.
if (process.platform === "linux" && process.env.WAYLAND_DISPLAY && !process.env.RHYTHM_NO_WAYLAND) {
  // Forzar el backend Wayland NATIVO (con protocolo text-input) en sesiones
  // Wayland. 'auto' a veces se queda en X11/XWayland (donde KDE Plasma 6 tiene
  // el bug de foco de teclado), asi que lo forzamos explicitamente.
  app.commandLine.appendSwitch("enable-features", "UseOzonePlatform,WaylandWindowDecorations");
  app.commandLine.appendSwitch("ozone-platform", "wayland");
  app.commandLine.appendSwitch("enable-wayland-ime");
  // IMPORTANTE: bajo Wayland nativo, el backend GL por defecto puede fallar
  // (proceso GPU se cae -> sin WebGL -> el juego 3D no renderiza), sobre todo
  // en NVIDIA / GPUs hibridas. Forzar EGL hace que WebGL funcione de nuevo.
  app.commandLine.appendSwitch("use-gl", "egl");
}

let serverProc = null;
let win = null;

// Lanza el servidor del motor como proceso hijo.
function startServer() {
  serverProc = spawn(process.execPath, [path.join(ROOT, "server", "index.js")], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProc.stdout.on("data", (d) => process.stdout.write("[motor] " + d));
  serverProc.stderr.on("data", (d) => process.stderr.write("[motor] " + d));
  serverProc.on("exit", (code) => { if (code && code !== 0) console.error("El motor termino con codigo", code); });
}

// Espera a que el servidor responda antes de cargar la ventana.
function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get(URL + "/api/status", (res) => { res.resume(); resolve(); });
      req.on("error", () => {
        if (left <= 0) return reject(new Error("El motor no arranco a tiempo"));
        setTimeout(() => tryOnce(left - 1), 250);
      });
    };
    tryOnce(retries);
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: "#060713",
    title: "Rhythm Dance",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  // Abrir enlaces externos (p.ej. el enlace del tunel) en el navegador del SO.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
  win.loadURL(URL);
  win.on("closed", () => { win = null; });
}

app.whenReady().then(async () => {
  // Quitar el menu de la aplicacion: sus aceleradores (atajos de teclado) se
  // disparan con ciertas teclas y pueden retrasar el frame. No lo necesitamos.
  Menu.setApplicationMenu(null);
  startServer();
  try {
    await waitForServer();
  } catch (e) {
    dialog.showErrorBox("Rhythm Dance", "No se pudo iniciar el motor del juego.\n\n" + e.message);
    app.quit();
    return;
  }
  createWindow();

  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Cerrar el motor al salir.
app.on("quit", () => { if (serverProc) { try { serverProc.kill(); } catch (_) {} } });
process.on("exit", () => { if (serverProc) { try { serverProc.kill(); } catch (_) {} } });
