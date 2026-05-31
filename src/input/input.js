// input.js
// Entrada de teclado y mandos/USB (Gamepad API).
// Soporta dos estilos:
//   - 5 paneles (Pump It Up): lanes 0=dl,1=ul,2=c,3=ur,4=dr
//   - 4 flechas (DDR):        lanes 0=left,1=down,2=up,3=right
// Emite "press" (flanco) y "release" por lane logico.

// Mapeos de teclado por estilo y por PERFIL de jugador.
//  - "all": un solo jugador puede usar cualquier set (comportamiento normal).
//  - "p1" / "p2": para VS local en el mismo teclado (controles separados).
// El usuario puede sobreescribir estos mapas desde Opciones (ver prefs/main).
export const DEFAULT_KEY_MAPS = {
  all: {
    5: {
      KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3, KeyB: 4,                // fila ZXCVB (dl, ul, c, ur, dr)
      Numpad7: 1, Numpad9: 3, Numpad5: 2, Numpad1: 0, Numpad3: 4, // numpad: posiciones fisicas = paneles PIU
    },
    4: {
      ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
      KeyA: 0, KeyS: 1, KeyW: 2, KeyD: 3,
    },
  },
  // Jugador 1 (VS local): mano izquierda del teclado.
  p1: {
    5: { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3, KeyB: 4 },
    4: { KeyA: 0, KeyS: 1, KeyW: 2, KeyD: 3 },
  },
  // Jugador 2 (VS local): numpad (5 paneles) o flechas (4).
  p2: {
    5: { Numpad1: 0, Numpad7: 1, Numpad5: 2, Numpad9: 3, Numpad3: 4 },
    4: { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 },
  },
};

// Etiquetas legibles de cada carril por estilo (para la UI de configuracion).
export const LANE_LABELS = {
  5: ["Abajo-Izq", "Arriba-Izq", "Centro", "Arriba-Der", "Abajo-Der"],
  4: ["Izquierda", "Abajo", "Arriba", "Derecha"],
};

// Iconos (flechas) de cada carril, para mostrar en la UI sin texto confuso.
// 5 paneles (Pump It Up): diagonales + centro. 4 flechas (DDR): direcciones.
export const LANE_ICONS = {
  5: ["◣", "◤", "◆", "◥", "◢"],   // dl, ul, c, ur, dr
  4: ["◄", "▼", "▲", "►"],          // left, down, up, right
};

// Colores de cada carril (mismos que el tablero 3D) para colorear los iconos.
export const LANE_COLORS = {
  5: ["#ff2e6e", "#2ee6ff", "#ffe14d", "#2ee6ff", "#ff2e6e"],
  4: ["#ff2e88", "#2ee6ff", "#5dff8f", "#ffd23e"],
};

// Copia mutable que el usuario puede sobreescribir en runtime.
const KEY_MAPS = JSON.parse(JSON.stringify(DEFAULT_KEY_MAPS));

// Reemplaza el mapa de un perfil+estilo con uno personalizado { code: lane }.
// Si customMap es null/undefined, restaura el de fabrica.
export function setKeyMap(profile, laneCount, customMap) {
  if (!KEY_MAPS[profile]) return;
  KEY_MAPS[profile][laneCount] = customMap
    ? { ...customMap }
    : { ...DEFAULT_KEY_MAPS[profile][laneCount] };
}

// Texto amigable para mostrar una tecla (KeyboardEvent.code) en la UI.
export function keyLabel(code) {
  if (!code) return "—";
  return code
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace(/^Numpad/, "Num ")
    .replace(/^Arrow/, "")
    .replace("Left", "←").replace("Right", "→").replace("Up", "↑").replace("Down", "↓")
    .replace("Space", "Espacio").replace("Semicolon", ";").replace("Quote", "'")
    .replace("Comma", ",").replace("Period", ".").replace("Slash", "/")
    .replace("BracketLeft", "[").replace("BracketRight", "]")
    .replace("Backslash", "\\").replace("Minus", "-").replace("Equal", "=");
}

// Botones de gamepad -> indice de panel, por estilo. Es el mapa POR DEFECTO;
// el usuario puede sobreescribirlo desde el configurador (setPadMap).
const DEFAULT_PAD_MAPS = {
  all: {
    5: { 2: 0, 3: 1, 0: 2, 1: 3, 5: 4, 14: 0, 12: 1, 13: 2, 15: 4 },
    4: { 14: 0, 13: 1, 12: 2, 15: 3, 2: 0, 0: 1, 3: 2, 1: 3 },
  },
  p1: {
    5: { 2: 0, 3: 1, 0: 2, 1: 3, 5: 4, 14: 0, 12: 1, 13: 2, 15: 4 },
    4: { 14: 0, 13: 1, 12: 2, 15: 3, 2: 0, 0: 1, 3: 2, 1: 3 },
  },
  p2: {
    5: { 2: 0, 3: 1, 0: 2, 1: 3, 5: 4, 14: 0, 12: 1, 13: 2, 15: 4 },
    4: { 14: 0, 13: 1, 12: 2, 15: 3, 2: 0, 0: 1, 3: 2, 1: 3 },
  },
};
const PAD_MAPS = JSON.parse(JSON.stringify(DEFAULT_PAD_MAPS));

// Reemplaza el mapa de BOTONES del gamepad de un perfil+estilo. null = fabrica.
export function setPadMap(profile, laneCount, customMap) {
  if (!PAD_MAPS[profile]) return;
  PAD_MAPS[profile][laneCount] = customMap
    ? { ...customMap }
    : { ...DEFAULT_PAD_MAPS[profile][laneCount] };
}
export function getDefaultPadMap(profile, laneCount) {
  return { ...((DEFAULT_PAD_MAPS[profile] || {})[laneCount] || {}) };
}

// Nombres de botones estandar de un control (layout "standard", como Xbox).
const PAD_BUTTON_NAMES = {
  0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT",
  8: "Back", 9: "Start", 10: "L3", 11: "R3",
  12: "↑", 13: "↓", 14: "←", 15: "→", 16: "Guide",
};
// Etiqueta legible de un boton de gamepad (para la UI).
export function padLabel(buttonIndex) {
  if (buttonIndex == null || buttonIndex === "") return "—";
  const n = Number(buttonIndex);
  return "🎮 " + (PAD_BUTTON_NAMES[n] != null ? PAD_BUTTON_NAMES[n] : ("B" + n));
}

const AXIS_THRESHOLD = 0.5;

// Sondea los gamepads conectados y devuelve el indice del PRIMER boton
// presionado ahora mismo (o null). Lo usa el configurador para "capturar" un
// boton del control. Tambien detecta el dpad como botones (12-15) y, si el
// control reporta el dpad como ejes, devuelve un indice virtual del dpad.
export function pollAnyPadButton() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  if (!pads) return null;
  for (const pad of pads) {
    if (!pad) continue;
    for (let b = 0; b < pad.buttons.length; b++) {
      const btn = pad.buttons[b];
      if (btn && (btn.pressed || btn.value > 0.6)) return b;
    }
  }
  return null;
}

// ¿Hay al menos un gamepad conectado?
export function anyGamepadConnected() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  if (!pads) return false;
  for (const p of pads) if (p) return true;
  return false;
}

export class InputManager {
  constructor(profile = "all") {
    this.listeners = { press: [], release: [], gamepadchange: [] };
    this.profile = profile;          // "all" | "p1" | "p2"
    this.laneCount = 5;
    // En VS local, J1 usa el mando index 0 y J2 el index 1 (si hay dos).
    this.padIndex = profile === "p2" ? 1 : 0;
    this.lockPadIndex = profile !== "all";
    this.laneHeld = [];
    this._prevButtons = {};
    // Estado de ejes reutilizable (sin asignar por frame): bitmask por lane.
    this._axisMask = 0;
    this._prevAxisMask = 0;
    this._hasGamepad = false;
    this._attached = false;          // start()/stop() idempotentes

    // Sincronizacion por frame del TECLADO. Por defecto el teclado se procesa
    // de inmediato (menor latencia, ideal para solitario). Si frameSync=true,
    // los eventos se encolan y se procesan una sola vez por frame (en
    // pollGamepads), igual que el mando. Esto evita que la logica de juego
    // (matching + mutaciones de la escena 3D + escrituras al DOM) corra en
    // momentos arbitrarios e interrumpa el render. Clave en VS local, donde
    // hay DOS renderers y el teclado asincrono provocaba tirones.
    this.frameSync = false;
    this._evQueue = [];
    // Captura TOTAL de teclado: durante el juego llamamos preventDefault en
    // TODAS las teclas (no solo las mapeadas) para que el navegador NO ejecute
    // su comportamiento por defecto (scroll con flechas/espacio/numpad, etc.).
    this.captureAll = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPadConn = this._refreshPadCount.bind(this);
  }

  setStyle(laneCount) {
    this.laneCount = laneCount;
    // Guardamos solo el perfil/estilo; los mapas se leen en vivo (getters).
    this.laneHeld = new Array(laneCount).fill(false);
  }

  // Mapa de teclas actual (lee KEY_MAPS en vivo: refleja la config del usuario).
  get keyMap() { return KEY_MAPS[this.profile][this.laneCount]; }
  // Mapa de botones de gamepad actual (lee PAD_MAPS en vivo).
  get padMap() { return PAD_MAPS[this.profile][this.laneCount]; }

  // Activa/desactiva la sincronizacion del teclado por frame (ver constructor).
  setFrameSync(on) {
    this.frameSync = !!on;
    if (!on) this._drainKeyQueue();   // si se apaga, vaciar lo pendiente
  }

  // Activa la captura TOTAL de teclado (preventDefault en todas las teclas).
  setCaptureAll(on) { this.captureAll = !!on; }

  start() {
    if (this._attached) return;       // idempotente
    this._attached = true;
    this._evQueue.length = 0;
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("gamepadconnected", this._onPadConn);
    window.addEventListener("gamepaddisconnected", this._onPadConn);
    this._refreshPadCount();
  }

  stop() {
    this._attached = false;
    this._evQueue.length = 0;
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("gamepadconnected", this._onPadConn);
    window.removeEventListener("gamepaddisconnected", this._onPadConn);
    this.unbindTouch();
  }

  // ----- Entrada tactil (moviles) -----
  // Crea botones tactiles por carril dentro de 'container' y los conecta a
  // press/release. Cada boton ocupa una franja vertical (estilo PIU/GH).
  bindTouch(container, colors, labels) {
    this.unbindTouch();
    if (!container) return;
    this._touchContainer = container;
    container.innerHTML = "";
    this._touchBtns = [];
    for (let i = 0; i < this.laneCount; i++) {
      const btn = document.createElement("button");
      btn.className = "touch-pad";
      btn.dataset.lane = String(i);
      const col = (colors && colors[i]) || "#2ee6ff";
      btn.style.setProperty("--tc", col);
      btn.textContent = (labels && labels[i]) || "";
      // pointerdown/up cubre touch + mouse. Capturamos el puntero para no perder
      // el release si el dedo se desliza fuera del boton.
      const down = (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) {} btn.classList.add("active"); this._press(i, "touch"); };
      const up = (e) => { e.preventDefault(); btn.classList.remove("active"); this._release(i); };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("pointerleave", (e) => { if (e.pressure === 0) { /* ignore hover */ } });
      this._touchBtns.push({ btn, down, up });
      container.appendChild(btn);
    }
  }
  unbindTouch() {
    if (this._touchContainer) this._touchContainer.innerHTML = "";
    this._touchBtns = null;
    this._touchContainer = null;
  }

  on(ev, cb) { if (this.listeners[ev]) this.listeners[ev].push(cb); }
  off(ev, cb) { if (this.listeners[ev]) this.listeners[ev] = this.listeners[ev].filter((x) => x !== cb); }
  _emit(ev, ...a) { (this.listeners[ev] || []).forEach((cb) => cb(...a)); }

  _press(lane, src) {
    if (lane == null) return;
    if (!this.laneHeld[lane]) {
      this.laneHeld[lane] = true;
      this._emit("press", lane, src);
    }
  }
  _release(lane) {
    if (lane == null) return;
    if (this.laneHeld[lane]) {
      this.laneHeld[lane] = false;
      this._emit("release", lane);
    }
  }

  // True si el foco esta en un campo de texto (input/textarea/editable): en ese
  // caso NO interceptamos teclas (si no, no se podria escribir en buscadores,
  // nombres, IPs, etc.).
  _typingInField() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  _onKeyDown(e) {
    if (e.repeat) {
      // Bloquear igualmente el auto-repeat para que el navegador no haga scroll.
      if (this.captureAll && !this._typingInField()) e.preventDefault();
      return;
    }
    const typing = this._typingInField();
    // Captura total: si NO estamos escribiendo en un campo, bloqueamos el
    // comportamiento por defecto de CUALQUIER tecla (scroll, navegacion, etc.).
    if (this.captureAll && !typing) e.preventDefault();
    if (typing) return;                    // dejar escribir en campos de texto
    const lane = this.keyMap[e.code];
    if (lane == null) return;
    if (!this.captureAll) e.preventDefault();
    // En modo frame-sync encolamos: se procesa en pollGamepads (1 vez/frame).
    if (this.frameSync) { this._evQueue.push(lane | 0); return; }
    this._press(lane, "keyboard");
  }
  _onKeyUp(e) {
    const typing = this._typingInField();
    if (this.captureAll && !typing) e.preventDefault();
    if (typing) return;                    // no interferir al escribir
    const lane = this.keyMap[e.code];
    if (lane == null) return;
    if (!this.captureAll) e.preventDefault();
    if (this.frameSync) { this._evQueue.push(-(lane + 1)); return; } // release codificado
    this._release(lane);
  }

  // Procesa los eventos de teclado encolados (modo frame-sync). Codificacion:
  // valor >=0 => press de ese carril; valor <0 => release de carril (-v - 1).
  _drainKeyQueue() {
    const q = this._evQueue;
    if (q.length === 0) return;
    for (let i = 0; i < q.length; i++) {
      const v = q[i];
      if (v >= 0) this._press(v, "keyboard");
      else this._release(-v - 1);
    }
    q.length = 0;
  }

  _refreshPadCount() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let count = 0, name = "";
    for (const p of pads) if (p) { count++; if (!name) name = p.id; }
    this._hasGamepad = count > 0;
    this._emit("gamepadchange", count, name);
  }

  // Polling por frame (la Gamepad API no emite eventos de botones).
  // Sin asignaciones por frame: si no hay mando conectado, sale de inmediato
  // (asi el juego con teclado no genera basura para el GC = sin tirones).
  pollGamepads() {
    // Primero vaciamos la cola de teclado (modo frame-sync): asi el teclado se
    // procesa en el MISMO punto del frame que el mando, justo antes de
    // actualizar/render. Evita que la logica corra entre frames.
    if (this.frameSync) this._drainKeyQueue();
    if (!this._hasGamepad) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let live = 0;
    let axisMask = 0;

    for (let pi = 0; pi < pads.length; pi++) {
      const pad = pads[pi];
      if (!pad) continue;
      live++;
      // En VS local, cada InputManager solo atiende su mando asignado.
      if (this.lockPadIndex && pad.index !== this.padIndex) continue;
      let prev = this._prevButtons[pad.index];
      if (!prev) { prev = this._prevButtons[pad.index] = []; }
      const btns = pad.buttons;
      for (let b = 0; b < btns.length; b++) {
        const pressed = btns[b].pressed || btns[b].value > 0.5;
        const lane = this.padMap[b];
        if (lane != null) {
          if (pressed && !prev[b]) this._press(lane, "gamepad");
          else if (!pressed && prev[b]) this._release(lane);
        }
        prev[b] = pressed;
      }

      const ax = pad.axes;
      if (ax.length >= 2) {
        if (this.laneCount === 4) {
          if (ax[0] < -AXIS_THRESHOLD) axisMask |= 1 << 0;
          if (ax[0] > AXIS_THRESHOLD) axisMask |= 1 << 3;
          if (ax[1] > AXIS_THRESHOLD) axisMask |= 1 << 1;
          if (ax[1] < -AXIS_THRESHOLD) axisMask |= 1 << 2;
        } else {
          if (ax[0] < -AXIS_THRESHOLD && ax[1] > AXIS_THRESHOLD) axisMask |= 1 << 0;  // dl
          if (ax[0] < -AXIS_THRESHOLD && ax[1] < -AXIS_THRESHOLD) axisMask |= 1 << 1; // ul
          if (ax[0] > AXIS_THRESHOLD && ax[1] < -AXIS_THRESHOLD) axisMask |= 1 << 3;  // ur
          if (ax[0] > AXIS_THRESHOLD && ax[1] > AXIS_THRESHOLD) axisMask |= 1 << 4;   // dr
        }
      }
    }

    // Flancos de eje usando bitmask (sin Set, sin asignaciones).
    if (axisMask !== this._prevAxisMask) {
      for (let lane = 0; lane < this.laneCount; lane++) {
        const bit = 1 << lane;
        const now = (axisMask & bit) !== 0;
        const was = (this._prevAxisMask & bit) !== 0;
        if (now && !was) this._press(lane, "gamepad");
        else if (!now && was) this._release(lane);
      }
      this._prevAxisMask = axisMask;
    }

    if (live === 0) this._refreshPadCount();
  }
}
