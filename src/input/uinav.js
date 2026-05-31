// uinav.js
// Navegacion de TODA la interfaz con control (gamepad). Permite usar el juego
// completo sin teclado ni raton: el dpad/stick mueve un "foco" entre los
// elementos interactivos de la pantalla activa, A (boton 0) activa/click, y
// B (boton 1) hace "atras" (Escape o boton de volver).
//
// No interfiere con el juego: se desactiva cuando la pantalla #game esta
// activa o cuando el modal de configurar teclas esta capturando un boton
// (ahi el control se usa para mapear, no para navegar).

const FOCUSABLE = [
  "button:not([disabled])",
  ".mode-card", ".game-card-dance", ".game-card-guitar",
  ".song-item", ".setup-songitem",
  ".tab", ".mod-toggle",
  "select", "input[type=range]", "input[type=text]", "input[type=number]", "input[type=checkbox]",
  "[data-gp]",
].join(",");

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.05) return false;
  // Debe estar (al menos parcialmente) dentro de la ventana.
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
  return true;
}

export class UiNav {
  constructor() {
    this.enabled = true;
    this.focusEl = null;
    this._raf = null;
    this._prev = {};        // estado previo de botones por pad
    this._repeatAt = 0;     // antirrepeticion para movimiento
    this._loop = this._loop.bind(this);
    // Pausa externa (p.ej. durante el juego o captura de teclas).
    this._pausedFn = () => false;
  }

  start(pausedFn) {
    if (pausedFn) this._pausedFn = pausedFn;
    if (!this._raf) this._raf = requestAnimationFrame(this._loop);
  }

  // Pantalla actualmente activa (.screen.active).
  _activeScreen() { return document.querySelector(".screen.active"); }

  _candidates() {
    const screen = this._activeScreen();
    if (!screen) return [];
    // Incluir tambien modales abiertos (no estan dentro de .screen).
    const roots = [screen];
    document.querySelectorAll(".modal:not(.hidden)").forEach((m) => roots.push(m));
    const out = [];
    for (const root of roots) {
      root.querySelectorAll(FOCUSABLE).forEach((el) => { if (isVisible(el)) out.push(el); });
    }
    // Si hay un modal abierto, SOLO navegar dentro de el (foco atrapado).
    const modal = roots.find((r) => r.classList && r.classList.contains("modal"));
    if (modal) return out.filter((el) => modal.contains(el));
    return out;
  }

  _setFocus(el) {
    if (this.focusEl === el) return;
    if (this.focusEl) this.focusEl.classList.remove("gp-focus");
    this.focusEl = el;
    if (el) {
      el.classList.add("gp-focus");
      try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (_) {}
    }
  }

  // Mueve el foco al elemento mas cercano en la direccion (dx,dy).
  _move(dx, dy) {
    const list = this._candidates();
    if (!list.length) return;
    if (!this.focusEl || !list.includes(this.focusEl) || !isVisible(this.focusEl)) {
      this._setFocus(list[0]);
      return;
    }
    const cur = this.focusEl.getBoundingClientRect();
    const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === this.focusEl) continue;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      const ddx = ex - cx, ddy = ey - cy;
      // Solo candidatos en la direccion pedida.
      const along = ddx * dx + ddy * dy;       // proyeccion en la direccion
      if (along <= 2) continue;
      const perp = Math.abs(ddx * dy - ddy * dx); // desviacion lateral
      const score = along + perp * 2;          // preferir alineados y cercanos
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) this._setFocus(best);
  }

  // Activa el elemento enfocado (equivalente a click / Enter).
  _activate() {
    const el = this.focusEl;
    if (!el || !isVisible(el)) return;
    const tag = el.tagName;
    if (tag === "SELECT") { this._cycleSelect(el, 1); return; }
    if (tag === "INPUT") {
      const t = el.type;
      if (t === "checkbox") { el.checked = !el.checked; el.dispatchEvent(new Event("change", { bubbles: true })); return; }
      if (t === "text" || t === "number") { el.focus(); return; }
      if (t === "range") return; // se ajusta con izq/der
    }
    el.click();
  }

  _cycleSelect(sel, dir) {
    const n = sel.options.length;
    if (!n) return;
    sel.selectedIndex = (sel.selectedIndex + dir + n) % n;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }

  _adjust(dir) {
    const el = this.focusEl;
    if (!el) return false;
    if (el.tagName === "SELECT") { this._cycleSelect(el, dir); return true; }
    if (el.tagName === "INPUT" && el.type === "range") {
      const step = Number(el.step) || 1;
      const v = Number(el.value) + dir * step;
      el.value = Math.max(Number(el.min), Math.min(Number(el.max), v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    return false;
  }

  _back() {
    // Preferir un boton de "volver/salir" visible; si no, simular Escape.
    const screen = this._activeScreen();
    const modal = document.querySelector(".modal:not(.hidden)");
    const scope = modal || screen;
    if (scope) {
      const backBtn = scope.querySelector(
        "#modeBack, #localSetupBack, #quitBtn, #cfgClose, #keysClose, #againBtn, #leaveRoomBtn, #edExitBtn, #changeGameBtn"
      );
      if (backBtn && isVisible(backBtn)) { backBtn.click(); return; }
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }

  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    if (!this.enabled || this._pausedFn()) {
      if (this.focusEl) { this.focusEl.classList.remove("gp-focus"); this.focusEl = null; }
      return;
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return;
    let pad = null;
    for (const p of pads) { if (p) { pad = p; break; } }
    if (!pad) return;

    const now = performance.now();
    const b = pad.buttons;
    const pressed = (i) => b[i] && (b[i].pressed || b[i].value > 0.5);
    const ax = pad.axes || [];

    // Direcciones por dpad o stick izquierdo.
    let dx = 0, dy = 0;
    if (pressed(14) || (ax[0] || 0) < -0.5) dx = -1;
    else if (pressed(15) || (ax[0] || 0) > 0.5) dx = 1;
    if (pressed(12) || (ax[1] || 0) < -0.5) dy = -1;
    else if (pressed(13) || (ax[1] || 0) > 0.5) dy = 1;

    // Movimiento con repeticion controlada (no volar por la lista).
    if (dx || dy) {
      if (now >= this._repeatAt) {
        // Si el foco esta en un slider/select, izquierda/derecha lo AJUSTA.
        if (dx && this._adjust(dx)) { /* ajustado */ }
        else this._move(dx, dy);
        this._repeatAt = now + (this._prev._moving ? 140 : 320);
        this._prev._moving = true;
      }
    } else {
      this._prev._moving = false;
      this._repeatAt = 0;
    }

    // A = activar (boton 0). B = atras (boton 1).
    const aNow = pressed(0), bNow = pressed(1);
    if (aNow && !this._prev[0]) this._activate();
    if (bNow && !this._prev[1]) this._back();
    // Hombros LB/RB (4/5) cambian de pestana si hay tabs.
    if (pressed(4) && !this._prev[4]) this._cycleTabs(-1);
    if (pressed(5) && !this._prev[5]) this._cycleTabs(1);

    this._prev[0] = aNow; this._prev[1] = bNow;
    this._prev[4] = pressed(4); this._prev[5] = pressed(5);
  }

  _cycleTabs(dir) {
    const screen = this._activeScreen();
    if (!screen) return;
    const tabs = [...screen.querySelectorAll(".tab")].filter(isVisible);
    if (tabs.length < 2) return;
    let idx = tabs.findIndex((t) => t.classList.contains("active"));
    if (idx < 0) idx = 0;
    idx = (idx + dir + tabs.length) % tabs.length;
    tabs[idx].click();
    this._setFocus(tabs[idx]);
  }
}
