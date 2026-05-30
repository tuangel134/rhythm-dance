// timeline.js
// Editor fino de notas en un timeline 2D (canvas). Permite, sobre las notas ya
// grabadas en el editor: seleccionarlas, MOVERLAS (en tiempo y de carril),
// BORRARLAS y AGREGAR nuevas. Es una vista de edicion pausada, complementaria
// a la grabacion en vivo. No depende de three.js (es 2D, ligero).
//
// Disposicion: tiempo en el eje horizontal, un carril por fila. Una linea
// vertical marca el instante actual (playhead). Se puede hacer scroll y zoom.

import { LAYOUTS } from "../render/stage.js";

function colHex(c) { return "#" + c.toString(16).padStart(6, "0"); }

export class TimelineEditor {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.laneCount = opts.laneCount;
    this.duration = Math.max(1, opts.duration || 1);
    this.colors = LAYOUTS[this.laneCount].map((d) => colHex(d.color));
    this.onChange = opts.onChange || (() => {});
    this.onSeek = opts.onSeek || (() => {});

    // notas: [{time, lane, duration?}]
    this.notes = (opts.notes || []).map((n) => ({ ...n }));

    this.pxPerSec = 120;       // zoom horizontal
    this.scrollT = 0;          // tiempo (s) en el borde izquierdo
    this.playhead = 0;         // tiempo actual marcado
    this.selected = null;      // nota seleccionada
    this.snap = 0.05;          // rejilla de ajuste al mover (s); 0 = libre
    this._dragging = null;     // { note, grabDx } durante el arrastre
    this._padLeft = 8;
    this._laneLabels = this._makeLaneLabels();

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onDbl = this._onDblClick.bind(this);
    this._onWheel = this._onWheel.bind(this);
    canvas.addEventListener("mousedown", this._onDown);
    window.addEventListener("mousemove", this._onMove);
    window.addEventListener("mouseup", this._onUp);
    canvas.addEventListener("dblclick", this._onDbl);
    canvas.addEventListener("wheel", this._onWheel, { passive: false });
  }

  _makeLaneLabels() {
    if (this.laneCount === 5) return ["◣ DL", "◤ UL", "◆ C", "◥ UR", "◢ DR"];
    return ["← L", "↓ D", "↑ U", "→ R"];
  }

  setNotes(notes) { this.notes = (notes || []).map((n) => ({ ...n })); this.selected = null; this.render(); }
  getNotes() { return this.notes.map((n) => ({ ...n })); }

  setPlayhead(t) {
    this.playhead = t;
    // Auto-scroll para mantener el playhead visible.
    const view = this._viewSeconds();
    if (t < this.scrollT + view * 0.1 || t > this.scrollT + view * 0.9) {
      this.scrollT = Math.max(0, t - view * 0.3);
    }
    this.render();
  }

  setZoom(px) { this.pxPerSec = Math.max(30, Math.min(400, px)); this.render(); }
  setScroll(t) { this.scrollT = Math.max(0, Math.min(this.duration, t)); this.render(); }

  _viewSeconds() { return (this.canvas.width - this._padLeft) / this.pxPerSec; }
  _laneH() { return this.canvas.height / this.laneCount; }
  _timeToX(t) { return this._padLeft + (t - this.scrollT) * this.pxPerSec; }
  _xToTime(x) { return this.scrollT + (x - this._padLeft) / this.pxPerSec; }
  _yToLane(y) { return Math.max(0, Math.min(this.laneCount - 1, Math.floor(y / this._laneH()))); }
  _laneToY(lane) { return lane * this._laneH() + this._laneH() / 2; }

  _snap(t) {
    if (!this.snap) return Math.round(t * 1000) / 1000;
    return Math.round(t / this.snap) * this.snap;
  }

  // Devuelve la nota bajo el punto (x,y) del canvas, o null.
  _noteAt(x, y) {
    const lane = this._yToLane(y);
    const t = this._xToTime(x);
    let best = null, bestDt = Infinity;
    for (const n of this.notes) {
      if (n.lane !== lane) continue;
      // Una nota larga se puede tomar en cualquier punto de su cuerpo.
      const start = n.time;
      const end = n.time + (n.duration || 0);
      let dt;
      if (t >= start - 0.06 && t <= end + 0.06) dt = 0;
      else dt = Math.min(Math.abs(t - start), Math.abs(t - end));
      if (dt < bestDt && dt < 0.08) { bestDt = dt; best = n; }
    }
    return best;
  }

  _onDown(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (this.canvas.width / r.width);
    const y = (e.clientY - r.top) * (this.canvas.height / r.height);
    const n = this._noteAt(x, y);
    if (n) {
      this.selected = n;
      this._dragging = { note: n, grabT: this._xToTime(x) - n.time };
      this.render();
    } else {
      // Click en vacio: mover el playhead a ese instante (scrub).
      this.selected = null;
      const t = Math.max(0, this._xToTime(x));
      this.playhead = t;
      this.onSeek(t);
      this.render();
    }
  }

  _onMove(e) {
    if (!this._dragging) return;
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (this.canvas.width / r.width);
    const y = (e.clientY - r.top) * (this.canvas.height / r.height);
    const n = this._dragging.note;
    n.time = Math.max(0, this._snap(this._xToTime(x) - this._dragging.grabT));
    n.lane = this._yToLane(y);
    this.render();
  }

  _onUp() {
    if (this._dragging) {
      this._dragging = null;
      this.notes.sort((a, b) => a.time - b.time);
      this.onChange(this.getNotes());
    }
  }

  _onDblClick(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (this.canvas.width / r.width);
    const y = (e.clientY - r.top) * (this.canvas.height / r.height);
    const existing = this._noteAt(x, y);
    if (existing) {
      // Doble click sobre una nota = borrarla.
      this.deleteNote(existing);
      return;
    }
    // Doble click en vacio = agregar nota (tap) ahi.
    const note = { time: Math.max(0, this._snap(this._xToTime(x))), lane: this._yToLane(y) };
    this.notes.push(note);
    this.notes.sort((a, b) => a.time - b.time);
    this.selected = note;
    this.onChange(this.getNotes());
    this.render();
  }

  _onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey) {
      // Ctrl + rueda = zoom.
      this.setZoom(this.pxPerSec * (e.deltaY < 0 ? 1.15 : 0.87));
    } else {
      // Rueda = scroll en el tiempo.
      this.setScroll(this.scrollT + (e.deltaY > 0 ? 1 : -1) * 0.4);
    }
  }

  deleteSelected() { if (this.selected) this.deleteNote(this.selected); }
  deleteNote(n) {
    const i = this.notes.indexOf(n);
    if (i >= 0) {
      this.notes.splice(i, 1);
      if (this.selected === n) this.selected = null;
      this.onChange(this.getNotes());
      this.render();
    }
  }

  // Alarga/acorta la duracion (hold) de la nota seleccionada en delta segundos.
  nudgeHold(delta) {
    if (!this.selected) return;
    const d = Math.max(0, (this.selected.duration || 0) + delta);
    if (d < 0.05) delete this.selected.duration;
    else this.selected.duration = Math.round(d * 1000) / 1000;
    this.onChange(this.getNotes());
    this.render();
  }

  render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const laneH = this._laneH();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#070a18";
    ctx.fillRect(0, 0, W, H);

    // Filas de carril alternas + etiquetas.
    for (let i = 0; i < this.laneCount; i++) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(0, i * laneH, W, laneH);
      ctx.fillStyle = this.colors[i];
      ctx.globalAlpha = 0.55;
      ctx.font = "11px Inter, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(this._laneLabels[i], 4, i * laneH + 3);
      ctx.globalAlpha = 1;
    }

    // Rejilla de tiempo cada 0.5s, con marca de segundos.
    const view = this._viewSeconds();
    const t0 = Math.floor(this.scrollT * 2) / 2;
    for (let t = t0; t <= this.scrollT + view; t += 0.5) {
      const x = this._timeToX(t);
      const whole = Math.abs(t - Math.round(t)) < 0.001;
      ctx.strokeStyle = whole ? "rgba(120,140,220,0.35)" : "rgba(120,140,220,0.13)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      if (whole) {
        ctx.fillStyle = "rgba(160,175,230,0.6)";
        ctx.font = "10px Inter, sans-serif";
        ctx.fillText(t.toFixed(0) + "s", x + 2, H - 13);
      }
    }

    // Notas.
    for (const n of this.notes) {
      const x = this._timeToX(n.time);
      const y = n.lane * laneH;
      if (x < this._padLeft - 20 || x > W + 20) continue;
      const isSel = n === this.selected;
      // Cuerpo de hold.
      if (n.duration) {
        const x2 = this._timeToX(n.time + n.duration);
        ctx.fillStyle = this.colors[n.lane];
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x, y + laneH * 0.32, Math.max(2, x2 - x), laneH * 0.36);
        ctx.globalAlpha = 1;
      }
      // Cabeza de la nota.
      ctx.fillStyle = this.colors[n.lane];
      const w = 11, h = Math.min(20, laneH * 0.62);
      ctx.fillRect(x - w / 2, y + laneH / 2 - h / 2, w, h);
      if (isSel) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - w / 2 - 2, y + laneH / 2 - h / 2 - 2, w + 4, h + 4);
      }
    }

    // Playhead.
    const px = this._timeToX(this.playhead);
    ctx.strokeStyle = "#ff2d7e";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(300, Math.floor(r.width));
    this.canvas.height = Math.max(120, Math.floor(r.height));
    this.render();
  }

  dispose() {
    this.canvas.removeEventListener("mousedown", this._onDown);
    window.removeEventListener("mousemove", this._onMove);
    window.removeEventListener("mouseup", this._onUp);
    this.canvas.removeEventListener("dblclick", this._onDbl);
    this.canvas.removeEventListener("wheel", this._onWheel);
  }
}
