// editor.js
// Editor de pistas personalizadas. Reproduce la cancion (opcionalmente en
// camara lenta) y registra tus pulsaciones como notas. Soporta:
//   - Notas largas (holds): si MANTIENES una tecla, se graba con duracion.
//   - Cuantizacion de acordes: pulsaciones casi simultaneas (dentro de una
//     tolerancia chica) se "pegan" al mismo instante para formar dobles/triples
//     exactos, sin impedir poner notas separadas seguidas.
// Luego puedes previsualizar, reiniciar o guardar (por dificultad).

import { Stage } from "../render/stage.js";

// Tolerancia para juntar pulsaciones en un acorde (en segundos de cancion).
// 35ms: suficiente para "a la vez" pero deja poner notas separadas (>35ms).
const CHORD_WINDOW = 0.035;
// Tiempo minimo manteniendo la tecla para que cuente como HOLD (nota larga).
const HOLD_MIN = 0.22;

export class Editor {
  constructor(container, audio, input, laneCount, hooks) {
    this.audio = audio;
    this.input = input;
    this.laneCount = laneCount;
    this.hooks = hooks || {};
    this.stage = new Stage(container, laneCount, 3, {});
    this.notes = [];          // {time, lane, duration?}
    this.mode = "idle";       // idle | record | preview
    this.rate = 0.6;
    this.running = false;
    this.leadIn = 2.0;
    this._raf = null;
    this._held = {};          // lane -> tiempo de cancion al presionar (holds)
    this._loop = this._loop.bind(this);
    this._onPress = this._onPress.bind(this);
    this._onRelease = this._onRelease.bind(this);
  }

  startRecord(rate) {
    this.rate = rate || this.rate;
    this.notes = [];
    this._held = {};
    this.mode = "record";
    this._begin();
  }

  startPreview() {
    if (this.notes.length === 0) return false;
    this.mode = "preview";
    this.rate = 1;
    this._sortNotes();
    this._previewState = this.notes.map((n) => ({ ...n, entry: null }));
    this._spawnCursor = 0;
    this._begin();
    return true;
  }

  _begin() {
    this.input.setStyle(this.laneCount);
    this.input.on("press", this._onPress);
    this.input.on("release", this._onRelease);
    this.running = true;
    this._startWall = performance.now() / 1000;
    this._audioStarted = false;
    this._lastT = null;
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.input.off("press", this._onPress);
    this.input.off("release", this._onRelease);
    try { this.audio.stopSource(); } catch (_) {}
    // Cerrar holds que quedaron abiertos al parar.
    this._closeAllHolds();
    this.mode = "idle";
    if (this.hooks.onState) this.hooks.onState("idle");
  }

  reset() {
    this.stop();
    this.notes = [];
    if (this.hooks.onCount) this.hooks.onCount(0);
  }

  // ----- Modo edicion fina -----
  // Detiene la reproduccion y deja el editor listo para editar notas en el
  // timeline 2D. Devuelve las notas (cuantizadas) para poblar el timeline.
  enterEditMode() {
    this.stop();
    this.notes = this.quantizeChords(this.notes);
    this.mode = "edit";
    return this.notes;
  }

  // Reemplaza las notas (tras editarlas en el timeline).
  setNotes(notes) {
    this.notes = (notes || []).map((n) => ({ ...n })).sort((a, b) => a.time - b.time);
    if (this.hooks.onCount) this.hooks.onCount(this.notes.length);
  }

  dispose() {
    this.stop();
    this.stage.dispose();
  }

  _sortNotes() { this.notes.sort((a, b) => a.time - b.time); }

  _songTime() {
    if (!this._audioStarted) return performance.now() / 1000 - this._startWall - this.leadIn;
    return this.audio.currentTime();
  }

  _onPress(lane) {
    if (!this.running || this.mode !== "record") return;
    const now = this._songTime();
    this.stage.flashReceptor(lane);
    if (now < 0) return;
    // Crear la nota (tap por ahora) y recordar el inicio por si se vuelve hold.
    const note = { time: Math.round(now * 1000) / 1000, lane };
    this.notes.push(note);
    this._held[lane] = { note, start: now };
    this.stage.hitEffect(lane);
    if (this.hooks.onCount) this.hooks.onCount(this.notes.length);
  }

  _onRelease(lane) {
    if (!this.running || this.mode !== "record") return;
    const h = this._held[lane];
    if (!h) return;
    const now = this._songTime();
    const dur = now - h.start;
    if (dur >= HOLD_MIN) {
      // Mantuviste la tecla -> es una nota larga (hold).
      h.note.duration = Math.round(dur * 1000) / 1000;
    }
    delete this._held[lane];
  }

  _closeAllHolds() {
    const now = this._songTime();
    for (const lane in this._held) {
      const h = this._held[lane];
      const dur = now - h.start;
      if (dur >= HOLD_MIN) h.note.duration = Math.round(dur * 1000) / 1000;
    }
    this._held = {};
  }

  _loop() {
    if (!this.running) return;
    const t = performance.now();
    if (this._lastT == null) this._lastT = t;
    const dt = Math.min(0.05, (t - this._lastT) / 1000);
    this._lastT = t;

    this.input.pollGamepads();
    const now = this._songTime();

    if (!this._audioStarted && now >= 0) {
      this._audioStarted = true;
      this.audio.play(Math.max(0, now), this.rate);
    }

    if (this.mode === "preview") this._updatePreview(now);

    this.stage.update(dt);
    this.stage.render();

    if (this.hooks.onTime) this.hooks.onTime(now, this.audio.duration);

    if (now > this.audio.duration + 0.3) { this.stop(); return; }
    this._raf = requestAnimationFrame(this._loop);
  }

  _updatePreview(now) {
    const viewSec = this.stage.viewSeconds();
    while (this._spawnCursor < this._previewState.length && this._previewState[this._spawnCursor].time - now <= viewSec) {
      const n = this._previewState[this._spawnCursor];
      if (!n.entry) n.entry = this.stage.spawnNote(n);
      this._spawnCursor++;
    }
    for (const n of this._previewState) {
      if (!n.entry) continue;
      const d = n.time - now;
      this.stage.positionNote(n.entry, d);
      const tail = n.duration ? d - n.duration : d;
      if (tail < -0.25) { this.stage.removeNote(n.entry); n.entry = null; }
    }
  }

  // Junta pulsaciones casi simultaneas en un acorde (mismo tiempo exacto), sin
  // afectar notas separadas (mas alejadas que CHORD_WINDOW). Devuelve copia.
  quantizeChords(notes) {
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    const out = [];
    let i = 0;
    while (i < sorted.length) {
      // Agrupar las notas dentro de la ventana desde la primera del grupo.
      const group = [sorted[i]];
      let j = i + 1;
      while (j < sorted.length && sorted[j].time - sorted[i].time <= CHORD_WINDOW) {
        group.push(sorted[j]); j++;
      }
      // Tiempo del acorde = promedio del grupo (se siente "exacto").
      const t = group.reduce((s, n) => s + n.time, 0) / group.length;
      const usedLanes = new Set();
      for (const n of group) {
        if (usedLanes.has(n.lane)) continue; // no repetir carril en un acorde
        usedLanes.add(n.lane);
        const nn = { time: Math.round(t * 1000) / 1000, lane: n.lane };
        if (n.duration) nn.duration = n.duration;
        out.push(nn);
      }
      i = j;
    }
    return out;
  }

  // Aplica la cuantizacion a las notas grabadas (para preview y guardar).
  applyQuantize() {
    this.notes = this.quantizeChords(this.notes);
    if (this.hooks.onCount) this.hooks.onCount(this.notes.length);
  }

  buildChart() {
    const q = this.quantizeChords(this.notes);
    return {
      laneCount: this.laneCount,
      duration: this.audio.duration,
      bpm: 120,
      notes: q,
    };
  }
}
