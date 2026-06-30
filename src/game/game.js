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
// Notas que comparten tiempo (un acorde/JUMP) deben pisarse casi a la vez. Si
// pisas una flecha del jump pero tardas mas de JUMP_SYNC en pisar el resto, las
// que falten se cuentan como MISS aunque las toques despues (no puedes
// "desgranar" un jump tocando cada flecha por separado).
const JUMP_SYNC = 0.11;

export class RhythmGame {
  constructor(container, audio, beatmap, input, hooks, settings) {
    this.container = container;
    this.audio = audio;
    this.beatmap = beatmap;
    this.input = input;
    this.hooks = hooks || {};
    this.settings = Object.assign({ scrollSpeed: 3 }, settings);
    // Tope de FPS (0 = sin tope). Por defecto desbloqueado (window.__fpsCap).
    this.fpsCap = this.settings.fpsCap != null ? this.settings.fpsCap
      : (typeof window !== "undefined" && window.__fpsCap != null ? window.__fpsCap : 0);

    this.laneCount = beatmap.laneCount;
    // Dificultad
    this.difficulty = (settings && settings.difficulty) || "normal";
    // Precision: override ventanas de juicio
    if (this.difficulty === "precision") {
      this._judge = JUDGE.map((j) => ({ ...j, window: j.name === "PERFECT" ? j.window : 0 }));
    } else {
      this._judge = JUDGE;
    }
    // Notas Bomba: si el mod bombas esta activo, marcar un 8-18% de las
    // notas como bombas (no deben pisarse). Usa seed determinista por cancion.
    // Si la pista ya tiene bombas del editor, se conservan y se agregan mas.
    const bombMod = this.settings.mods && this.settings.mods.bomba;
    if (bombMod) {
      // Marcar usando un seed determinista basado en el beatmap para que sea
      // consistente en cada partida (no aleatorio cada vez que se carga).
      const seed = this.beatmap.songHash || this.beatmap.name || "bomba";
      let hash = 0; for (let k = 0; k < seed.length; k++) hash = ((hash << 5) - hash + seed.charCodeAt(k)) | 0;
      const ratio = 0.08 + (Math.abs(hash % 10) / 100); // 8-18% segun el hash
      const bombCount = Math.floor(beatmap.notes.length * ratio);
      const bombIdx = new Set();
      for (let i = 0; i < bombCount; i++) {
        const idx = Math.abs((hash * (i + 1) * 2654435761) % beatmap.notes.length);
        bombIdx.add(idx);
      }
      beatmap.notes.forEach((n, i) => { if (bombIdx.has(i)) n.bomb = true; });
    }
    this.stage = new Stage(container, this.laneCount, this.settings.scrollSpeed, this.settings.mods, {
      transparentBg: !!this.settings.videoBg,
      mode: this.settings.gameMode || "dance",
      vertical: !!this.settings.vertical,
      sharedRenderer: this.settings.sharedRenderer || null,
      // Pasa la skin precargada al Stage (null = procedural, igual que antes).
      piuSkin: this.settings.piuSkin || null,
    });

    // Velocidad base y modulacion automatica (dificultades "ritmo"/"locura").
    this.baseScroll = this.settings.scrollSpeed;

    // Precision: copiar JUDGE con ventanas reducidas (sin mutar la original).
    this._judge = this.difficulty === "precision"
      ? JUDGE.map((j) => ({ ...j, window: j.name === "PERFECT" ? j.window : 0 }))
      : JUDGE;
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

    // Agrupar SALTOS (jumps): notas que comparten tiempo (acorde) en distintos
    // carriles. Hay que pisarlas casi a la vez; ver _onPress.
    this._buildJumpGroups();

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
      MISS: -6.0, WRONG: -1.5,
      HOLD_DROP: -3.5,
    };
    // Supervivencia: la vida se drena sola, las notas recuperan mucho menos
    // y fallar/errar castiga el doble. La tension es constante.
    if (this.difficulty === "supervivencia") {
      this.LIFE = {
        PERFECT: +0.3, GREAT: +0.15, GOOD: 0, OK: -1.5,
        MISS: -12.0, WRONG: -4.0,
        HOLD_DROP: -6.0,
      };
    }

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

    // v0.9+ sistema de pausa (menu de pausa a mitad de cancion).
    this.paused = false;
    this._pauseAt = 0;        // reloj (segundos) en que se pauso (para no perder tiempo).
    this._pauseAccum = 0;     // segundos totales en pausa (para no contarlos como dt).

    // v0.9+ Carrera de Combos: el objetivo NO es el score sino el maxCombo.
    // El multiplicador de combo escala mas agresivo (hasta x3.5 vs x1.8 normal)
    // y la vida no mata (allowFail ya esta en false en main.js).
    this.comboRace = !!(settings && settings.comboRace);

    // Extras v0.9+: replay, perfect-streak, modos especiales.
    this.replayEvents = [];        // [{t, type, l?, j?}] registrado durante la partida.
    this.maxPerfectStreak = 0;     // mayor racha de PERFECT consecutivos.
    this._perfStreak = 0;          // racha actual (resetea con cualquier no-PERFECT).
    this.gameMode = (settings && settings.gameMode) || "score"; // "score" | "combo" | "practice" | "replay"
    this.isDaily = !!(settings && settings.isDaily);
    this.dailyChallenge = (settings && settings.dailyChallenge) || null;
    this.isPractice = !!(settings && settings.isPractice);
    this.practiceRate = (settings && settings.practiceRate) || 1.0;
    this.practiceLoop = !!(settings && settings.practiceLoop);
  }

  // Detecta SALTOS (jumps): grupos de notas que comparten el mismo tiempo en
  // distintos carriles (un acorde). Cada nota del grupo apunta a su grupo via
  // n.jump. El grupo lleva firstHitClock = instante (reloj) en que se piso la
  // PRIMERA flecha del salto; a partir de ahi hay JUMP_SYNC para pisar el resto
  // o las que falten se cuentan como MISS (no se puede "desgranar" un salto).
  _buildJumpGroups() {
    const eps = 0.004;          // mismas notas = mismo tiempo (acorde)
    let i = 0;
    while (i < this.notes.length) {
      let j = i + 1;
      while (j < this.notes.length && Math.abs(this.notes[j].time - this.notes[i].time) <= eps) j++;
      if (j - i >= 2) {
        const group = { size: j - i, firstHitClock: null };
        for (let k = i; k < j; k++) this.notes[k].jump = group;
      }
      i = j;
    }
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

  // Ajusta el marco de combo en los receptores segun el combo actual.
  //   >=200 rojo · >=100 dorado · >=50 morado · >=20 verde · si no, sin marco.
  _updateComboTier() {
    const c = this.combo;
    const tier = c >= 200 ? 4 : c >= 100 ? 3 : c >= 50 ? 2 : c >= 20 ? 1 : 0;
    if (tier !== this._comboTierShown) {
      this._comboTierShown = tier;
      try { this.stage.setComboTier(tier); } catch (_) {}
    }
  }

  _onPress(lane) {
    if (!this.running) return;
    this.stage.flashReceptor(lane);
    const now = this._clock;

    // Si el modo es "replay" (visor), desactivamos el input: solo se visualiza.
    if (this.gameMode === "replay") {
      this.replayEvents.push({ t: now, type: "tap", l: lane });
      return;
    }
    // Si es práctica, igual registramos taps para el replay.
    // (continua la lógica normal de juicio).

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
      // Si la nota pertenece a un SALTO cuyo tiempo de sincronia ya expiro
      // (pisaste otra flecha del salto hace > JUMP_SYNC), ya no es acertable:
      // hay que pisar las flechas del salto casi a la vez.
      if (n.jump && n.jump.firstHitClock != null && (now - n.jump.firstHitClock) > JUMP_SYNC) continue;
      const adt = Math.abs(dt);
      if (adt < bestDt) { bestDt = adt; best = n; }
    }

    if (best && bestDt <= MISS_WINDOW) {
      // NOTA BOMBA: si la pisaste, castigo SEVERO — combinacion de error y
      // penalizacion extra porque NO debias tocarla.
      if (best.bomb) {
        best.hit = true;
        this.score = Math.max(0, this.score - 800);
        this._changeLife(-15);
        this.combo = 0;
        this.missCombo += 2;
        this.resolvedCount++; this.lastHit = false;
        this.hooks.onScore && this.hooks.onScore(this.score);
        this.hooks.onCombo && this.hooks.onCombo(0);
        this.hooks.onJudge && this.hooks.onJudge("💥 BOMBA!", "#ff4d4d");
        if (best.entry) { this.stage.removeNote(best.entry); best.entry = null; }
        return;
      }
      // NOTA ITEM (?): al agarrarla se lanza un efecto contra el rival y la
      // nota se consume sin puntuar (no suma combo ni vida).
      if (best.item) {
        best.hit = true;
        this.hooks.onItem && this.hooks.onItem();
        this.stage.hitEffect(lane);
        this.hooks.onJudge && this.hooks.onJudge("🎁 ITEM!", "#ffd23e");
        if (best.entry) { this.stage.removeNote(best.entry); best.entry = null; }
        return;
      }
      const j = this._judge.find((x) => bestDt <= x.window) || this._judge[this._judge.length - 1];
      best.hit = true;
      // Si es la PRIMERA flecha de un salto, arranca el cronometro de sincronia:
      // el resto del salto debe pisarse antes de JUMP_SYNC.
      if (best.jump && best.jump.firstHitClock == null) best.jump.firstHitClock = now;
      this.missCombo = 0;        // un acierto rompe la racha de errores
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.counts[j.name]++;
      this.resolvedCount++; this.lastHit = true;

      // Bonus de combo POSITIVO: a partir de COMBO_START aciertos seguidos,
      // cada acierto vale algo mas. El multiplicador es MODERADO (hasta x1.8)
      // para que el combo no domine sobre la precision (antes x2.5 hacia que
      // mantener combo pesara mucho mas que acertar con buen timing).
      let pts = j.score + Math.min(this.combo, 100);
      let lifeGain = this.LIFE[j.name];
      if (this.combo >= this.COMBO_START && j.name !== "OK") {
        const tier = this.combo - this.COMBO_START + 1;   // 1,2,3...
        // Carrera de combos: bonus agresivo (hasta x3.5) para que el score
        // refleje mas el combo que la precision. En modo normal queda en x1.8.
        const cap = this.comboRace ? 3.5 : 0.8;
        const step = this.comboRace ? 0.15 : 0.05;
        const mult = 1 + Math.min(tier * step, cap);
        pts = Math.round(pts * mult);
        lifeGain += Math.min(tier * 0.15, 1.2);            // vida extra creciente
      }
      this.score += pts;
      this._changeLife(lifeGain);

      this.stage.hitEffect(lane);
      this.hooks.onJudge && this.hooks.onJudge(j.name, JUDGE_COLOR[j.name]);
      this.hooks.onScore && this.hooks.onScore(this.score);
      this.hooks.onCombo && this.hooks.onCombo(this.combo);
      this._updateComboTier();
      // v0.9+ replay + perfect-streak
      this.replayEvents.push({ t: now, type: "press", l: lane, j: j.name });
      if (j.name === "PERFECT") {
        this._perfStreak++;
        if (this._perfStreak > this.maxPerfectStreak) this.maxPerfectStreak = this._perfStreak;
      } else {
        this._perfStreak = 0;
      }

      // Si es nota LARGA, empieza el sostenido (no se quita aun).
      if (best.duration && best.duration > 0) {
        best.holding = true;
        best.holdEnd = best.time + best.duration;
        this.activeHolds.push(best);
      } else if (best.entry) {
        this.stage.removeNote(best.entry); best.entry = null;
      }
    } else {
      // Tecla presionada sin nota acertable. La penalizacion ESCALA con la
      // cercania: si habia una nota muy cerca (casi aciertas), castiga poco; si
      // no habia ninguna nota cerca, castiga lo normal. 'best' puede existir
      // pero fuera de MISS_WINDOW; usamos su distancia como medida de cercania.
      this.wrongPresses++;
      // closeness 0..1: 1 = estuviste casi en ventana, 0 = no habia nada cerca.
      let closeness = 0;
      if (best && isFinite(bestDt)) {
        const near = 0.4;       // a <=0.4s de una nota se considera "cerca"
        closeness = Math.max(0, 1 - bestDt / near);
      }
      this._registerError("wrong", closeness);
    }
  }

  // Error. kind="miss" (dejar pasar una nota), "wrong" (teclear sin acierto) o
  // "hold" (soltar/fallar una nota larga). closeness (0..1) solo aplica a
  // "wrong": cuanto mas cerca estuviste de acertar, menos castigo.
  _registerError(kind, closeness = 0) {
    this.combo = 0;
    this.missCombo++;
    let lifeLoss, scoreLoss;
    if (kind === "miss") {
      lifeLoss = this.LIFE.MISS;        // dejar pasar = castigo grande
      scoreLoss = 0;                    // no resta puntos (ya no los gano)
    } else if (kind === "hold") {
      lifeLoss = this.LIFE.HOLD_DROP;   // soltar un hold = castigo fuerte
      scoreLoss = 200;                  // y resta puntos
    } else {
      // wrong: castigo MENOR cuanto mas cerca estuviste (0.4x..1x del base).
      const scale = 1 - 0.6 * closeness;
      lifeLoss = this.LIFE.WRONG * scale;
      scoreLoss = Math.round(20 * scale);
    }
    if (this.missCombo >= this.MISS_COMBO_START) {
      const tier = this.missCombo - this.MISS_COMBO_START + 1; // 1,2,3...
      const mult = 1 + Math.min(tier * 0.15, 1.0);             // hasta x2
      lifeLoss *= mult;
      scoreLoss = Math.round((scoreLoss + 40) * mult);
    }
    this.score = Math.max(0, this.score - scoreLoss);
    this._changeLife(lifeLoss);
    this.hooks.onScore && this.hooks.onScore(this.score);
    this.hooks.onCombo && this.hooks.onCombo(0);
    this._updateComboTier();
    this._perfStreak = 0;
    this.replayEvents.push({ t: this._clock, type: "miss", k: kind });
    const label = kind === "miss" ? "MISS" : (kind === "hold" ? "SOLTASTE" : "X");
    this.hooks.onJudge && this.hooks.onJudge(this.missCombo >= this.MISS_COMBO_START ? label + " x" + this.missCombo : label, JUDGE_COLOR.MISS);
  }

  // Ajusta la vida (0..100). Si llega a 0 y el fallo esta activo, pierdes.
  _changeLife(delta) {
    // Modo Desarrollador: solo cambios positivos (inmortal).
    if (this.settings.devMode && delta < 0) delta = 0;
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
      if (!this.external) {
        // Practica: aplicar rate al audio (si el player lo soporta).
        if (this.practiceRate && this.practiceRate !== 1.0 && this.audio.setRate) {
          try { this.audio.setRate(this.practiceRate); } catch (_) {}
        }
        this.audio.play(now);
      }
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
        // Bomba no pisada = esquivada correctamente: sin castigo ni ruido.
        if (n.bomb) {
          n.hit = true;
          if (n.entry) { this.stage.removeNote(n.entry); n.entry = null; }
          continue;
        }
        n.missed = true;
        this.counts.MISS++;
        this.resolvedCount++; this.lastHit = false;
        this._registerError("miss");
        // Marcar visualmente la nota como fallada para que se vea PASAR de
        // largo (atenuada), en vez de desaparecer en el receptor.
        if (n.entry) this.stage.markMissed(n.entry);
      }
      if (n.entry) {
        this.stage.positionNote(n.entry, d);
        // Las notas falladas viajan mas alla del receptor (se ven pasar);
        // las no resueltas se quitan antes. Hold fallado: igual pasa de largo.
        const cutoff = n.missed ? -0.9 : -0.4;
        if (d < cutoff) { this.stage.removeNote(n.entry); n.entry = null; }
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

    // Supervivencia: la vida se drena constantemente (0.8%/s, fallar acelera).
    if (this.difficulty === "supervivencia") {
      const drain = 0.008 * dt;
      this.life = Math.max(0, this.life - drain);
      this.hooks.onLife && this.hooks.onLife(this.life);
      if (this.life <= 0) this._end();
    }

    // Caos: cada 8s activa mods aleatorios y apaga los anteriores.
    if (this.difficulty === "caos" && now >= 0) {
      this._caosTimer = (this._caosTimer || 0) + dt;
      if (this._caosTimer > 8) {
        this._caosTimer = 0;
        const allMods = ["vanish","hidden","twirl","tornado","drunk","mini","mega","niebla","gravedad","rebote"];
        this.stage.mods = {};
        const k = allMods[Math.floor(Math.random() * allMods.length)];
        this.stage.mods[k] = true;
      }
    }

    // Ciego: las notas solo se ven los primeros 0.3s de vida.
    if (this.difficulty === "ciego" && this._blindInit == null) {
      this._blindInit = true;
      this.stage.setBlindMode(0.3);
    }

    // Ruleta: cada 30s activa 2 mods aleatorios, reemplazando los anteriores.
    if (this.difficulty === "ruleta" && now >= 0) {
      this._ruletaTimer = (this._ruletaTimer || 0) + dt;
      if (this._ruletaTimer > 30) {
        this._ruletaTimer = 0;
        const pool = ["vanish","hidden","twirl","tornado","drunk","mini","mega","niebla","gravedad","rebote","mirror","reverse"];
        // Resetear mods visuales
        for (const k of pool) this.stage.mods[k] = false;
        // Elegir 2 aleatorios
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        for (let k = 0; k < 2; k++) this.stage.mods[shuffled[k]] = true;
        // Notificar al jugador via status (gancho)
        const active = shuffled.slice(0, 2).map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(" + ");
        this.hooks.onStatus && this.hooks.onStatus("🎰 Ruleta: " + active);
      }
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
        this._updateComboTier();
        this.hooks.onJudge && this.hooks.onJudge("HOLD!", JUDGE_COLOR.PERFECT);
      } else if (!held) {
        // Solto antes de tiempo: se rompe el hold. Castigo FUERTE (vida y
        // puntos) via _registerError("hold"). La nota ya estaba acertada
        // (hit=true) y anclada al receptor, asi que el bucle principal NO la
        // procesa; hay que QUITARLA aqui mismo o se queda pegada en pantalla.
        n.holding = false; n.holdDone = true;
        if (n.entry) { this.stage.removeNote(n.entry); n.entry = null; }
        this.activeHolds.splice(i, 1);
        this._registerError("hold");
      } else if (n.entry) {
        // Sigue sosteniendo: anclar cabeza al receptor y encoger el cuerpo.
        this.stage.holdProgress(n.entry, remaining);
      }
    }
  }

  _loop() {
    if (!this.running) return;
    // Pausa: no actualizamos, no acumulamos dt, no spawneamos notas. Volvemos
    // a pedir frame para seguir dibujando el HUD/fondo, pero sin avanzar el
    // reloj de la cancion.
    if (this.paused) {
      this._lastT = null;   // al reanudar, reiniciamos el dt
      this._raf = requestAnimationFrame(this._loop);
      return;
    }
    const t = performance.now();
    if (this._lastT == null) this._lastT = t;

    // Tope de FPS opcional (si el usuario apago "FPS desbloqueados"). Con vsync
    // desactivado en Electron, esto evita correr a cientos de fps sin necesidad.
    if (this.fpsCap && this.fpsCap > 0) {
      const minMs = 1000 / this.fpsCap - 0.5;   // margen pequeno
      if (t - this._lastT < minMs) { this._raf = requestAnimationFrame(this._loop); return; }
    }

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
    // En Carrera de Combos, la "calificacion" sale del combo, no del accuracy.
    // Mantenemos el grade por accuracy para coherencia visual, pero el
    // verdadero "score" del modo es maxCombo (lo refleja showResults en main.js).
    const grade = this.failed ? "F" : this._grade(accuracy);
    if (this.online) this.online.finish(this.score, accuracy, grade);
    this.hooks.onEnd && this.hooks.onEnd({
      score: this.score, maxCombo: this.maxCombo, counts: this.counts,
      accuracy, grade, total, failed: this.failed, life: Math.round(this.life),
      wrongPresses: this.wrongPresses,
      gameMode: this.gameMode,
      comboRace: this.comboRace,
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

  // v0.9+ Pausa. Suspende el bucle (no avanza reloj), suspende el AudioContext
  // (pausa audio y congela ctx.currentTime) y congela notas. Llamar antes de
  // mostrar el menu de pausa. Si el juego ya termino, no hace nada.
  pause() {
    if (!this.running || this.paused || this.failed) return false;
    this.paused = true;
    this._pauseAt = this._clock;
    if (this.audio) {
      try { this.audio.suspend(); } catch (_) {}
    }
    return true;
  }

  // Quita la pausa. Resume el AudioContext: el audio sigue desde donde se
  // quedo y ctx.currentTime vuelve a avanzar (asi _clock continua correcto).
  resume() {
    if (!this.paused) return false;
    this.paused = false;
    if (this.audio) {
      try {
        const r = this.audio.resume();
        if (r && r.then) r.catch(() => {});
      } catch (_) {}
    }
    return true;
  }
}
