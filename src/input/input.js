// input.js
// Entrada de teclado y mandos/USB (Gamepad API).
// Soporta dos estilos:
//   - 5 paneles (Pump It Up): lanes 0=dl,1=ul,2=c,3=ur,4=dr
//   - 4 flechas (DDR):        lanes 0=left,1=down,2=up,3=right
// Emite "press" (flanco) y "release" por lane logico.

// Mapeos de teclado por estilo.
const KEY_MAPS = {
  5: {
    KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3, KeyB: 4,                // fila ZXCVB (dl, ul, c, ur, dr)
    Numpad7: 1, Numpad9: 3, Numpad5: 2, Numpad1: 0, Numpad3: 4, // numpad: posiciones fisicas = paneles PIU
  },
  4: {
    ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
    KeyA: 0, KeyS: 1, KeyW: 2, KeyD: 3,
  },
};

// Botones de gamepad -> indice de panel, por estilo.
const GAMEPAD_MAPS = {
  5: {
    // dpad: 14=izq,15=der,12=arriba,13=abajo ; caras: 2=X,0=A,3=Y,1=B
    2: 0,  // dl
    3: 1,  // ul
    0: 2,  // c (boton inferior)
    1: 3,  // ur
    5: 4,  // dr (bumper der) — aproximacion
    14: 0, 12: 1, 13: 2, 15: 4, // dpad como respaldo
  },
  4: {
    14: 0, 13: 1, 12: 2, 15: 3, // dpad
    2: 0, 0: 1, 3: 2, 1: 3,     // caras X/A/Y/B
  },
};

const AXIS_THRESHOLD = 0.5;

export class InputManager {
  constructor() {
    this.listeners = { press: [], release: [], gamepadchange: [] };
    this.laneCount = 5;
    this.keyMap = KEY_MAPS[5];
    this.padMap = GAMEPAD_MAPS[5];
    this.laneHeld = [];
    this._prevButtons = {};
    // Estado de ejes reutilizable (sin asignar por frame): bitmask por lane.
    this._axisMask = 0;
    this._prevAxisMask = 0;
    this._hasGamepad = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPadConn = this._refreshPadCount.bind(this);
  }

  setStyle(laneCount) {
    this.laneCount = laneCount;
    this.keyMap = KEY_MAPS[laneCount];
    this.padMap = GAMEPAD_MAPS[laneCount];
    this.laneHeld = new Array(laneCount).fill(false);
  }

  start() {
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("gamepadconnected", this._onPadConn);
    window.addEventListener("gamepaddisconnected", this._onPadConn);
    this._refreshPadCount();
  }

  stop() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("gamepadconnected", this._onPadConn);
    window.removeEventListener("gamepaddisconnected", this._onPadConn);
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

  _onKeyDown(e) {
    if (e.repeat) return;
    const lane = this.keyMap[e.code];
    if (lane != null) { e.preventDefault(); this._press(lane, "keyboard"); }
  }
  _onKeyUp(e) {
    const lane = this.keyMap[e.code];
    if (lane != null) { e.preventDefault(); this._release(lane); }
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
    if (!this._hasGamepad) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let live = 0;
    let axisMask = 0;

    for (let pi = 0; pi < pads.length; pi++) {
      const pad = pads[pi];
      if (!pad) continue;
      live++;
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
