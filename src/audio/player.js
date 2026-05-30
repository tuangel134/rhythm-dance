// player.js
// Reproductor basado en Web Audio API. Es la forma correcta para un juego de
// ritmo: decodifica toda la cancion a un AudioBuffer una sola vez y la
// reproduce con un BufferSource. El reloj (ctx.currentTime) es de alta
// precision y monotono, sin la sobrecarga de streaming del elemento <audio>
// (que hacia que el rendimiento bajara conforme avanzaba la cancion).

export class AudioPlayer {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.buffer = null;
    this.source = null;
    this.startCtxTime = 0;   // ctx.currentTime cuando empezo la reproduccion
    this.startOffset = 0;    // segundos dentro de la cancion al empezar
    this.playing = false;
    // Nodo de ganancia para controlar el volumen (0..1).
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.8;
    this.gain.connect(this.ctx.destination);
  }

  // Ajusta el volumen (0..1).
  setVolume(v) {
    const vol = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = vol;
  }

  // Descarga y decodifica el audio una sola vez.
  async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo descargar el audio");
    const arr = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(arr);
    return this.buffer.duration;
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  // Inicia la reproduccion desde 'offset' segundos. rate = velocidad (1=normal,
  // 0.5 = camara lenta para el editor). El reloj currentTime() lo compensa.
  play(offset = 0, rate = 1) {
    if (!this.buffer) return;
    this.stopSource();
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;
    this._rate = rate;
    src.connect(this.gain);   // pasa por el control de volumen
    src.start(0, Math.max(0, offset));
    this.source = src;
    this.startCtxTime = this.ctx.currentTime;
    this.startOffset = offset;
    this.playing = true;
    this.ended = false;
    src.onended = () => {
      if (this.source === src) {
        this.playing = false;
        this.ended = true;
        this._endedAtCtx = this.ctx.currentTime;
      }
    };
  }

  // Tiempo actual de la cancion en segundos (compensa la velocidad de reproduccion).
  currentTime() {
    const rate = this._rate || 1;
    if (this.playing) {
      return this.startOffset + (this.ctx.currentTime - this.startCtxTime) * rate;
    }
    if (this.ended) {
      return this.startOffset + (this._endedAtCtx - this.startCtxTime) * rate + (this.ctx.currentTime - this._endedAtCtx) * rate;
    }
    return this.startOffset;
  }

  get duration() { return this.buffer ? this.buffer.duration : 0; }

  stopSource() {
    if (this.source) {
      try { this.source.onended = null; this.source.stop(); } catch (_) {}
      try { this.source.disconnect(); } catch (_) {}
      this.source = null;
    }
    this.playing = false;
    this.ended = false;
  }

  dispose() {
    this.stopSource();
    try { this.ctx.close(); } catch (_) {}
    this.buffer = null;
  }
}
