// inputenv.js
// Detecta condiciones del entorno de ENTRADA que afectan el VS local con dos
// teclados. En concreto, hay un bug conocido de GNOME Shell + Xorg (X11) en
// Linux: cuando se usan DOS teclados fisicos a la vez, X serializa el estado
// de ambos en un solo "master keyboard" y eso introduce un lag de cientos de
// milisegundos por cada tecla del segundo teclado. Se traba TODO el sistema,
// no solo el juego (se puede reproducir incluso fuera del juego). En Wayland
// NO ocurre. La unica solucion real es a nivel de sistema (usar Wayland, o
// jugar con un control en vez del segundo teclado).
//
// Este modulo NO intenta arreglar el bug (no se puede desde la app sin romper
// el foco del teclado); solo detecta la situacion para AVISAR al usuario.

import os from "node:os";
import { execFileSync } from "node:child_process";

// Cuenta los teclados fisicos reales segun xinput (X11). Filtra los virtuales
// (master/XTEST) y los "dispositivos" que no son teclados de escritura
// (botones de encendido, hotkeys, controles de consumo de auriculares, etc.).
function countPhysicalKeyboards() {
  try {
    const out = execFileSync("xinput", ["list", "--short"], { encoding: "utf8", timeout: 1500 });
    const names = new Set();
    for (const line of out.split("\n")) {
      if (!/slave\s+keyboard/i.test(line)) continue;          // solo teclados esclavos
      // Extraer el nombre (entre el simbolo de arbol y "id=").
      const m = line.match(/↳?\s*(.+?)\s+id=\d+/);
      if (!m) continue;
      const name = m[1].trim();
      const low = name.toLowerCase();
      // Descartar dispositivos que no son teclados de escritura real.
      if (/virtual|xtest|power button|video bus|sleep button|hotkeys|wmi|consumer control|system control|headset|receiver(?!.*keyboard)/i.test(low)) {
        // 'receiver' suele ser un dongle inalambrico; si su nombre incluye
        // "keyboard" no lo descartamos (linea de arriba).
        if (!low.includes("keyboard")) continue;
      }
      // Agrupar por nombre base (un mismo teclado expone varias entradas:
      // "X Keyboard", "X Keyboard System Control", etc.). Nos quedamos con la
      // raiz para no contar el mismo teclado varias veces.
      const base = name.replace(/\s+(System Control|Consumer Control)$/i, "").trim();
      names.add(base);
    }
    return names.size;
  } catch (_) {
    return 0;   // xinput no disponible o error: no podemos contar
  }
}

// Devuelve info del entorno de entrada relevante para el VS local.
//   { os, sessionType, isXorgLinux, keyboards, twoKeyboardLagRisk }
export function inputEnvironment() {
  const platform = process.platform;          // 'linux' | 'win32' | 'darwin'
  const sessionType = (process.env.XDG_SESSION_TYPE || "").toLowerCase();  // 'x11' | 'wayland' | ''
  const onWayland = !!process.env.WAYLAND_DISPLAY || sessionType === "wayland";
  const isXorgLinux = platform === "linux" && !onWayland;   // X11 (o sin Wayland)

  let keyboards = 0;
  if (platform === "linux") keyboards = countPhysicalKeyboards();

  // Riesgo de lag: SOLO en Linux/Xorg con 2+ teclados fisicos. En Wayland,
  // Windows o macOS no aplica.
  const twoKeyboardLagRisk = isXorgLinux && keyboards >= 2;

  return {
    os: platform,
    sessionType: sessionType || (onWayland ? "wayland" : "desconocido"),
    isXorgLinux,
    keyboards,
    twoKeyboardLagRisk,
  };
}
