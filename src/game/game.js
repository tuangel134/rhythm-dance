// game.js
// Logica del juego: sincroniza el audio con el Stage 3D, evalua aciertos y
// lleva la puntuacion.
//
// RELOJ SUAVE: audio.currentTime avanza a saltos; mantenemos un reloj propio
// con performance.now() re-anclado suavemente al audio para evitar tirones.
//
// RENDIMIENTO: las notas estan ordenadas por tiempo. Cada frame solo tocamos
// una VENTANA ACTIVA [activeStart, spawnCursor) en vez de recorrer todas las
// notas de la cancion. Asi el coste por frame es ~O(notas visibles), no O(total).

import { Stage } from "../render/stage.js";

const JUDGE = [
  { name: "PERFECT", window: 0.045, score: 1000 },
  { name: "GREAT",   window: 0.09,  score: 600 },
  { name: "GOOD",    window: 0.15,  score: 300 },
  { name: "OK",      window: 0.22,  score: 100 },
];
const JUDGE_COLOR = { PERFECT: "#5dff8f", GREAT: "#2ee6ff", GOOD: "#ffd23e", OK: "#ff9f1c", MISS: "#ff4d4d" };
const MISS_WINDOW = 0.22;

export class RhythmGame {
  constructor(container, audio, beatmap, input, hooks, settings) {
    this.container = container;
    this.audio = audio;
    this.beatmap = beatmap;
    this.input = input;
    this.hooks = hooks || {};
    this.settings = Object.assign({ scrollSpeed: 3 }, settings);

    this.laneCount = beatmap.laneCount;
    this.stage = new Stage(container, this.laneCount, this.settings.scrollSpeed, this.settings.mods, { transparentBg: !!this.settings.videoBg, mode: this.settings.gameMode || "dance", sharedRenderer: this.settings.sharedRenderer || null });

    // Velocidad base y modulacion automatica (dificultades "ritmo"/"locura").
    this.baseScroll = this.settings.scrollSpeed;
    this.autoSpeed = !!beatmap.autoSpeed;
    this.autoEffects = !!beatmap.autoEffects;
    this.intensityTimeline = beatmap.intensityTimeline || null;
    this.intensityStep = beatmap.intensityStep || 0.25;
    this._fxState = {};          // estado actual de efectos auto
    this._fxCheckAccum = 0;

    this.notes = beatmap.notes
      .map((n) => ({ ...n, hit: false, missed: false, entry: null, holding: false, holdDone: false }))
      .sort((a, b) => a.time - b.time);

    this.activeHolds = []; // notas largas que se estan sosteniendo ahora

    // Indice por carril para busqueda rapida del acierto (cursor por lane).
    this.laneCursors = new Array(this.laneCount).fill(0);
    this.byLane = Array.from({ length: this.laneCount }, () => []);
    for (const n of this.notes) this.byLane[n.lane].push(n);

    this.spawnCursor = 0;   // proxima nota a spawnear
    this.activeStart = 0;   // primera nota aun no resuelta (ventana activa)

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.missCombo = 0;        // errores seguidos (combo "a la inversa")
    this.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, OK: 0, MISS: 0 };
    this.resolvedCount = 0;    // notas resueltas (acierto o fallo) para sync VS
    this.lastHit = true;

    // Umbrales de combo:
    //  - a partir de COMBO_START aciertos seguidos, el combo da bonus crecientes.
    //  - a partir de MISS_COMBO_START errores seguidos, penaliza cada vez mas.
    this.COMBO_START = 5;
    this.MISS_COMBO_START = 3;

    // ----- Barra de vida -----
    // Empieza al 50%. Acertar sube vida; fallar/teclear mal la baja.
    // Si llega a 0 -> pierdes (la cancion termina con FAILED).
    this.life = 50;            // 0..100
    this.failed = false;
    this.allowFail = settings && settings.allowFail !== false; // se puede desactivar
    this.wrongPresses = 0;
    this.LIFE = {
      PERFECT: +1.4, GREAT: +1.0, GOOD: +0.4, OK: -0.5,
      MISS: -4.0, WRONG: -2.0,   // dejar pasar / teclear mal
    };

    this.running = false;
    this.leadIn = 2.0;
    this._raf = null;

    // Modo EXTERNO (VS local): el juego no posee el audio ni corre su propio
    // bucle; un orquestador externo le pasa el reloj comun y lo dibuja. Asi dos
    // jugadores comparten una sola cancion en la misma pantalla.
    this.external = !!(settings && settings.external);
    // En VS local no se "pierde" por vida: ambos terminan la cancion y se
    // comparan los puntajes (salvo que se pida lo contrario).
    if (this.external && (!settings || settings.allowFail == null)) this.allowFail = false;

    // Offset de calibracion audio/video (ms -> s). El usuario lo ajusta en
    // Opciones. Positivo = el audio va adelantado, se RESTA al reloj para que
    // las notas lleguen un poco mas tarde (sincronizadas con lo que se oye).
    this.audioOffset = ((settings && settings.audioOffset) || 0) / 1000;

    // Online VS
    this.online = settings && settings.online ? settings.online : null;
    this._progressAccum = 0;

    // Reloj suave
    this._audioPlaying = false;
    this._clock = -this.leadIn;
    this._lastAudioTime = -1;
    this._perfAtSync = 0;
    this._clockAtSync = -this.leadIn;

    // FPS
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    // Calidad adaptativa: si va lento sostenidamente, baja sola.
    this.quality = (settings && settings.quality) || "auto";
    this._lowFpsStreak = 0;
    this._autoLevel = 0; // 0=auto(1.5), 1=medium, 2=low
    this._qualityLocked = this.quality !== "auto";

    this._loop = this._loop.bind(this);
    this._onPress = this._onPress.bind(this);
  }

  start() {
    this.input.setStyle(this.laneCount);
    this.input.on("press", this._onPress);
    this.stage.setQuality(this.quality);
    // Pre-calentar pools + compilar shaders ANTES de jugar (evita micro-tirones
    // la primera vez que aparece cada nota/efecto, sobre todo al pisar acordes).
    try { this.stage.prewarm(8); } catch (_) {}
    this.running = true;
    const now = performance.now() / 1000;
    // En modo online, todos arrancan en un instante de pared comun (startAtSec).
    // startAtSec es performance.now()/1000 equivalente calculado por main.js.
    this._startWall = this.settings.startAtSec != null ? this.settings.startAtSec : now;
    this._perfAtSync = this._startWall;
    this._clockAtSync = -this.leadIn;
    this._clock = -this.leadIn;
    this._lastT = null;
    // En modo externo NO arrancamos bucle propio: el orquestador llama a tick().
    if (!this.external) this._raf = requestAnimationFrame(this._loop);
  }

  // Avance de un frame en modo EXTERNO (VS local). El orquestador pasa el reloj
  // comun de la cancion (now, en segundos) y el delta (dt). Devuelve el reloj.
  tick(now, dt) {
    if (!this.running) return now;
    this.input.pollGamepads();
    this._clock = now;
    this._update(dt, now);
    this.stage.render();
    return now;
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.input.off("press", this._onPress); // evitar acumular handlers entre partidas
    // En modo externo el orquestador controla el audio comun; no lo paramos.
    if (!this.external) { try { this.audio.stopSource(); } catch (_) {} }
    this.stage.dispose();
  }

  _tickClock() {
    const perf = performance.now() / 1000;
    if (!this._audioPlaying) {
      // Lead-in: reloj de pared antes de arrancar el audio.
      this._clock = perf - this._startWall - this.leadIn;
      return this._clock;
    }
    // Web Audio: el reloj del contexto es preciso y monotono. Lo usamos
    // directo (sin correcciones), lo que evita la deriva y la sobrecarga del
    // streaming del elemento <audio>. Aplicamos el offset de calibracion.
    this._clock = this.audio.currentTime() - this.audioOffset;
    return this._clock;
  }

  _onPress(lane) {
    if (!this.running) return;
    this.stage.flashReceptor(lane);
    const now = this._clock;

    // Buscar desde el cursor del carril la primera nota no resuelta cercana.
    const arr = this.byLane[lane];
    let i = this.laneCursors[lane];
    while (i < arr.length && (arr[i].hit || arr[i].missed || arr[i].time - now < -MISS_WINDOW)) i++;
    this.laneCursors[lane] = i;

    let best = null, bestDt = Infinity;
    for (let k = i; k < arr.length; k++) {
      const n = arr[k];
      if (n.hit || n.missed) continue;
      const dt = n.time - now;
      if (dt > MISS_WINDOW) break;
      const adt = Math.abs(dt);
      if (adt < bestDt) { bestDt = adt; best = n; }
    }

    if (best && bestDt <= MISS_WINDOW) {
      const j = JUDGE.find((x) => bestDt <= x.window) || JUDGE[JUDGE.length - 1];
      best.hit = true;
      this.missCombo = 0;        // un acierto rompe la racha de errores
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.counts[j.name]++;
      this.resolvedCount++; this.lastHit = true;

      // Bonus de combo POSITIVO: a partir de COMBO_START aciertos seguidos,
      // cada acierto vale mas puntos y da algo de vida extra (creciente).
      let pts = j.score + Math.min(this.combo, 100);
      let lifeGain = this.LIFE[j.name];
      if (this.combo >= this.COMBO_START && j.name !== "OK") {
        const tier = this.combo - this.COMBO_START + 1;   // 1,2,3...
        const mult = 1 + Math.min(tier * 0.1, 1.5);        // hasta x2.5
        pts = Math.round(pts * mult);
        lifeGain += Math.min(tier * 0.15, 1.2);            // vida extra creciente
      }
      this.score += pts;
      this._changeLife(lifeGain);

      this.stage.hitEffect(lane);
      this.hooks.onJudge && this.hooks.onJudge(j.name, JUDGE_COLOR[j.name]);
      this.hooks.onScore && this.hooks.onScore(this.score);
      this.hooks.onCombo && this.hooks.onCombo(this.combo);

      // Si es nota LARGA, empieza el sostenido (no se quita aun).
      if (best.duration && best.duration > 0) {
        best.holding = true;
        best.holdEnd = best.time + best.duration;
        this.activeHolds.push(best);
      } else if (best.entry) {
        this.stage.removeNote(best.entry); best.entry = null;
      }
    } else {
      // Tecla presionada sin nota cercana = error.
      this.wrongPresses++;
      this._registerError("wrong");
    }
  }

  // Error (dejar pasar una nota o teclear mal). Mantiene un "combo inverso":
  // cuantos mas errores seguidos, mas puntos y vida se pierden (creciente).
  _registerError(kind) {
    this.combo = 0;
    this.missCombo++;
    const base = kind === "miss" ? this.LIFE.MISS : this.LIFE.WRONG;
    let lifeLoss = base;
    let scoreLoss = kind === "miss" ? 0 : 50;
    if (this.missCombo >= this.MISS_COMBO_START) {
      const tier = this.missCombo - this.MISS_COMBO_START + 1; // 1,2,3...
      const mult = 1 + Math.min(tier * 0.25, 2.0);             // hasta x3
      lifeLoss *= mult;
      scoreLoss = Math.round((scoreLoss + 100) * mult);
    }
    this.score = Math.max(0, this.score - scoreLoss);
    this._changeLife(lifeLoss);
    this.hooks.onScore && this.hooks.onScore(this.score);
    this.hooks.onCombo && this.hooks.onCombo(0);
    const label = kind === "miss" ? "MISS" : "X";
    this.hooks.onJudge && this.hooks.onJudge(this.missCombo >= this.MISS_COMBO_START ? label + " x" + this.missCombo : label, JUDGE_COLOR.MISS);
  }

  // Ajusta la vida (0..100). Si llega a 0 y el fallo esta activo, pierdes.
  _changeLife(delta) {
    this.life = Math.max(0, Math.min(100, this.life + delta));
    this.hooks.onLife && this.hooks.onLife(this.life);
    if (this.life <= 0 && this.allowFail && !this.failed) {
      this.failed = true;
      this._end();
    }
  }

  _update(dt, now) {
    if (!this._audioPlaying && now >= 0) {
      this._audioPlaying = true;
      // En modo externo el orquestador controla el audio; aqui no lo tocamos.
      if (!this.external) this.audio.play(now);
    }

    // Spawnear notas que entran por abajo
    const viewSec = this.stage.viewSeconds();
    while (this.spawnCursor < this.notes.length && this.notes[this.spawnCursor].time - now <= viewSec) {
      const n = this.notes[this.spawnCursor];
      if (!n.hit && !n.missed && !n.entry) n.entry = this.stage.spawnNote(n);
      this.spawnCursor++;
    }

    // Avanzar el inicio de la ventana activa (notas ya pasadas/resueltas)
    while (this.activeStart < this.spawnCursor) {
      const n = this.notes[this.activeStart];
      if (n.hit || (n.missed && !n.entry) || (n.time - now < -0.6 && !n.entry)) {
        this.activeStart++;
      } else break;
    }

    // Procesar SOLO la ventana activa [activeStart, spawnCursor)
    for (let idx = this.activeStart; idx < this.spawnCursor; idx++) {
      const n = this.notes[idx];
      if (n.hit) continue;
      const d = n.time - now;
      if (!n.missed && d < -MISS_WINDOW) {
        n.missed = true;
        this.counts.MISS++;
        this.resolvedCount++; this.lastHit = false;
        this._registerError("miss");
      }
      if (n.entry) {
        this.stage.positionNote(n.entry, d);
        if (d < -0.4) { this.stage.removeNote(n.entry); n.entry = null; }
      }
    }

    // Pulso del beat + lineas de beat que suben con la musica
    if (this.beatmap.bpm > 0 && now >= 0) {
      const beatSec = 60 / this.beatmap.bpm;
      const phase = ((now - this.beatmap.offset) % beatSec + beatSec) % beatSec;
      const v = 1 - phase / beatSec;
      this.stage.setBeatPulse(v * v);
      this.stage.updateBeatLines(now, this.beatmap.bpm, this.beatmap.offset);
    }

    // Modulacion automatica de velocidad y efectos (ritmo / locura).
    if ((this.autoSpeed || this.autoEffects) && now >= 0) {
      this._autoModulate(now, dt);
    }

    this.stage.update(dt);

    this._updateHolds(now);

    if (now > this.beatmap.duration + 0.5 && this.activeStart >= this.notes.length) {
      this._end();
    } else if (now > this.beatmap.duration + 2) {
      this._end();
    }
  }

  // Lee la intensidad de la cancion en 'now' (0..1) desde la linea temporal.
  _intensityAt(now) {
    if (!this.intensityTimeline) return 0.5;
    const i = Math.floor(now / this.intensityStep);
    if (i < 0) return this.intensityTimeline[0] || 0;
    if (i >= this.intensityTimeline.length) return this.intensityTimeline[this.intensityTimeline.length - 1] || 0;
    return this.intensityTimeline[i];
  }

  // Modula velocidad (autoSpeed) y efectos (autoEffects) en vivo segun el ritmo.
  _autoModulate(now, dt) {
    const inten = this._intensityAt(now);

    if (this.autoSpeed) {
      // La velocidad sigue la intensidad: desde un minimo (0.8x de tu base, sin
      // bajar de 1.5x) hasta un MAXIMO de 5.0x en las partes mas intensas.
      const minSpeed = Math.max(1.5, this.baseScroll * 0.8);
      const maxSpeed = 5.0;
      const target = minSpeed + (maxSpeed - minSpeed) * Math.min(1, inten);
      const cur = this.stage.scrollSpeed;
      this.stage.scrollSpeed = cur + (target - cur) * Math.min(1, dt * 2.5);
    }

    if (this.autoEffects) {
      // Revisar ~3 veces por segundo para activar/desactivar efectos por zonas.
      this._fxCheckAccum += dt;
      if (this._fxCheckAccum >= 0.33) {
        this._fxCheckAccum = 0;
        const m = this.stage.mods;
        // Reglas: en partes muy intensas, tornado; intensidad media-alta, drunk;
        // en bajones, vanish (mas reto visual cuando hay menos notas).
        const wantTornado = inten > 0.78;
        const wantDrunk = inten > 0.55 && inten <= 0.78;
        const wantVanish = inten < 0.35;
        // Aplicar con histeresis simple (solo cambiar si difiere).
        if (m.tornado !== wantTornado) m.tornado = wantTornado;
        if (m.drunk !== wantDrunk) m.drunk = wantDrunk;
        if (m.vanish !== wantVanish) m.vanish = wantVanish;
        // appear no se usa en auto (confunde con vanish).
        m.appear = false;
        if (this.hooks.onAutoFx) this.hooks.onAutoFx({ ...m });
      }
    }
  }

  // Procesa las notas largas activas: hay que MANTENER la tecla hasta el final.
  // Si llegas al final sosteniendo -> bonus. Si sueltas antes -> se corta.
  _updateHolds(now) {
    if (this.activeHolds.length === 0) return;
    for (let i = this.activeHolds.length - 1; i >= 0; i--) {
      const n = this.activeHolds[i];
      const held = this.input.laneHeld[n.lane];
      const remaining = n.holdEnd - now;

      if (remaining <= 0) {
        // Hold completado con exito.
        n.holding = false; n.holdDone = true;
        if (n.entry) { this.stage.removeNote(n.entry); n.entry = null; }
        this.activeHolds.splice(i, 1);
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.score += 300;            // bonus por completar el hold
        this._changeLife(+1.2);
        this.stage.hitEffect(n.lane);
        this.hooks.onScore && this.hooks.onScore(this.score);
        this.hooks.onCombo && this.hooks.onCombo(this.combo);
        this.hooks.onJudge && this.hooks.onJudge("HOLD!", JUDGE_COLOR.PERFECT);
      } else if (!held) {
        // Solto antes de tiempo: se rompe el hold (penalizacion leve).
        n.holding = false; n.holdDone = true;
        if (n.entry) { this.stage.removeNote(n.entry); n.entry = null; }
        this.activeHolds.splice(i, 1);
        this.combo = 0;
        this._changeLife(-2.0);
        this.hooks.onCombo && this.hooks.onCombo(0);
        this.hooks.onJudge && this.hooks.onJudge("SOLTASTE", JUDGE_COLOR.OK);
      } else if (n.entry) {
        // Sigue sosteniendo: anclar cabeza al receptor y encoger el cuerpo.
        this.stage.holdProgress(n.entry, remaining);
      }
    }
  }

  _loop() {
    if (!this.running) return;
    const t = performance.now();
    if (this._lastT == null) this._lastT = t;
    const dt = Math.min(0.05, (t - this._lastT) / 1000);
    this._lastT = t;

    // Medimos el tiempo de CPU que consume NUESTRO codigo por frame (sin contar
    // la espera al siguiente vsync). Si es bajo (<5ms) pero el fps cae, el
    // cuello de botella es el navegador/driver/present, no nuestro codigo.
    const cpuStart = performance.now();

    // FPS (promedio cada ~0.5s)
    this._fpsAccum += dt;
    this._fpsFrames++;
    this._cpuAccum = (this._cpuAccum || 0);
    if (this._fpsAccum >= 0.5) {
      const fps = Math.round(this._fpsFrames / this._fpsAccum);
      const st = this.stage.stats();
      st.cpuMs = Math.round((this._cpuAccum / this._fpsFrames) * 100) / 100;
      this.hooks.onFps && this.hooks.onFps(fps, st);
      this._fpsAccum = 0;
      this._fpsFrames = 0;
      this._cpuAccum = 0;

      // Auto-degradado: si el FPS cae sostenidamente y la calidad es "auto",
      // bajamos un nivel para recuperar fluidez (en vez de obligar app nativa).
      if (!this._qualityLocked) {
        if (fps < 50) this._lowFpsStreak++;
        else this._lowFpsStreak = Math.max(0, this._lowFpsStreak - 1);
        if (this._lowFpsStreak >= 3 && this._autoLevel < 2) {
          this._autoLevel++;
          const lvl = this._autoLevel === 1 ? "medium" : "low";
          this.stage.setQuality(lvl);
          this._lowFpsStreak = 0;
          this.hooks.onQuality && this.hooks.onQuality(lvl);
        }
      }
    }

    this.input.pollGamepads();
    const now = this._tickClock();
    this._update(dt, now);
    this.stage.render();

    // Reporte de progreso al rival (modo online), ~5 veces por segundo.
    if (this.online && now >= 0) {
      this._progressAccum += dt;
      if (this._progressAccum >= 0.2) {
        this._progressAccum = 0;
        const total = this.notes.length || 1;
        const hits = this.counts.PERFECT + this.counts.GREAT + this.counts.GOOD + this.counts.OK;
        this.online.progress(this.score, this.combo, Math.round((hits / total) * 1000) / 10, this.resolvedCount, this.lastHit, Math.round(this.life));
      }
    }

    if (this.hooks.onCountdown) this.hooks.onCountdown(now < 0 ? Math.ceil(-now) : 0);
    if (this.hooks.onTick) this.hooks.onTick(now, dt);

    this._cpuAccum += performance.now() - cpuStart;
    this._raf = requestAnimationFrame(this._loop);
  }

  _end() {
    if (!this.running) return;
    this.stop();
    const total = this.notes.length || 1;
    const hits = this.counts.PERFECT + this.counts.GREAT + this.counts.GOOD + this.counts.OK;
    const accuracy = Math.round((hits / total) * 1000) / 10;
    const grade = this.failed ? "F" : this._grade(accuracy);
    if (this.online) this.online.finish(this.score, accuracy, grade);
    this.hooks.onEnd && this.hooks.onEnd({
      score: this.score, maxCombo: this.maxCombo, counts: this.counts,
      accuracy, grade, total, failed: this.failed, life: Math.round(this.life),
      wrongPresses: this.wrongPresses,
    });
  }

  _grade(acc) {
    if (acc >= 95) return "S";
    if (acc >= 90) return "A";
    if (acc >= 80) return "B";
    if (acc >= 70) return "C";
    if (acc >= 50) return "D";
    return "F";
  }
}
