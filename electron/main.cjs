// electron/main.cjs
// Envuelve el juego como app de escritorio (Linux / Windows / macOS).
//
// Como funciona: arranca el MISMO servidor Node local (server/index.js) como
// proceso hijo y abre una ventana de navegador apuntando a el. Asi reusamos
// toda la arquitectura existente (motor que decodifica audio, genera pistas,
// sirve el frontend y hospeda el modo VS) sin reescribir nada.

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 5174;
const URL = `http://localhost:${PORT}`;

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
