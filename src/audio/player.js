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
    this._userVol = 0.8;
    this._normGain = 1;
    this.gain.connect(this.ctx.destination);
  }

  // Ajusta el volumen (0..1). Se combina con la normalización por canción.
  setVolume(v) {
    this._userVol = Math.max(0, Math.min(1, v));
    this._applyGain();
  }

  // Ganancia final = volumen del usuario × normalización (nivela canciones
  // FLAC/MP3 de loudness muy distinto para que suenen parejas).
  _applyGain() {
    const uv = this._userVol != null ? this._userVol : 0.8;
    const ng = this._normGain || 1;
    if (this.gain) this.gain.gain.value = uv * ng;
  }

  // Calcula una ganancia de normalización por pico (~0.9 objetivo), acotada
  // para no reventar ni amplificar ruido de más.
  _computeNormGain() {
    if (!this.buffer) { this._normGain = 1; return; }
    let peak = 0;
    for (let ch = 0; ch < this.buffer.numberOfChannels; ch++) {
      const d = this.buffer.getChannelData(ch);
      for (let i = 0; i < d.length; i += 64) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
    }
    this._normGain = peak > 0.02 ? Math.min(2.0, Math.max(0.7, 0.9 / peak)) : 1;
    this._applyGain();
  }

  // Descarga y decodifica el audio una sola vez.
  async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("No se pudo descargar el audio");
    const arr = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(arr);
    this._computeNormGain();   // nivelar loudness entre canciones
    return this.buffer.duration;
  }

  async resume() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  // Suspende TODO el AudioContext. Esto pausa el audio Y congela
  // ctx.currentTime, que es lo que usa _clock para el reloj de la cancion.
  // Asi al reanudar, el audio sigue desde donde se quedo y el reloj tambien.
  // Es la forma robusta de pausar (vs. source.suspend() que es fragil).
  async suspend() {
    if (this.ctx.state === "running") {
      try { await this.ctx.suspend(); } catch (_) {}
    }
  }

  // Inyecta un buffer en memoria (no descargado de red). Usado por el tutorial
  // para generar un metronomo sintetico sin tener que descargar audio.
  setBuffer(buffer) {
    this.stopSource();
    this.buffer = buffer;
  }

  // Genera un buffer de metronomo: un click breve en cada uno de los
  // `noteTimes` (segundos). Si no se pasa nada, hace click cada 0.5s
  // durante `duration` segundos. Asi el juego tiene un audio valido para
  // avanzar el reloj aunque no haya cancion real.
  generateMetronome(noteTimes, opts = {}) {
    const sampleRate = this.ctx.sampleRate;
    const duration = opts.duration || 30;
    const buffer = this.ctx.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    const clickHz = opts.hz || 880;
    const clickDur = opts.clickDur || 0.04;
    const clickSamples = Math.floor(sampleRate * clickDur);
    const times = (noteTimes && noteTimes.length) ? noteTimes : (() => {
      const arr = [];
      for (let t = 0; t < duration; t += 0.5) arr.push(t);
      return arr;
    })();
    for (const t of times) {
      const start = Math.floor(t * sampleRate);
      for (let j = 0; j < clickSamples; j++) {
        if (start + j >= data.length) break;
        const env = 1 - j / clickSamples;
        data[start + j] += Math.sin(2 * Math.PI * clickHz * j / sampleRate) * 0.3 * env;
      }
    }
    this.setBuffer(buffer);
    return buffer;
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

  // Cambia la velocidad de reproduccion del source actual (modo práctica).
  setRate(rate) {
    if (this.source) {
      try { this.source.playbackRate.value = rate; this._rate = rate; } catch (_) {}
    } else {
      this._rate = rate;
    }
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
