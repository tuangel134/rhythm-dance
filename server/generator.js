// generator.js
// Generador de pistas SINCRONIZADO AL RITMO.
//
// Mejora clave respecto a la version anterior: en lugar de colocar notas en
// cada pico de energia (que produce notas "fuera de ritmo"), aqui:
//   1. Calculamos la curva de onset (flujo espectral).
//   2. Estimamos el BPM con autocorrelacion + refinado por comb filter.
//   3. Estimamos la FASE del beat (offset) alineando una rejilla a la energia.
//   4. Construimos una rejilla de beats y subdivisiones (1/1, 1/2, 1/4...).
//   5. Colocamos notas SOLO en celdas de la rejilla que tienen energia real.
// Asi las flechas caen sobre el pulso de la musica.

const FFT_SIZE = 1024;
const HOP = 256; // ~5.8ms/frame a 44.1kHz: mas resolucion temporal de onsets

// ---------------- RNG determinista (reproducibilidad) ----------------
// El generador usa azar para elegir carriles, jumps, variedad de patrones, etc.
// Con Math.random la MISMA cancion daria un chart distinto cada vez (y los
// tests serian flaky). Usamos un PRNG sembrado con una huella del audio: asi
// cada cancion produce SIEMPRE el mismo chart (reproducible) pero distintas
// canciones dan resultados distintos. mulberry32: rapido y de buena calidad.
let rng = Math.random;
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Huella numerica del audio (estable): combina longitud + muestreo disperso.
function audioSeed(samples) {
  let h = 0x811c9dc5 ^ (samples.length >>> 0);
  const step = Math.max(1, Math.floor(samples.length / 4096));
  for (let i = 0; i < samples.length; i += step) {
    const v = Math.floor(samples[i] * 32768) | 0;
    h = Math.imul(h ^ (v & 0xffff), 0x01000193);
  }
  return h >>> 0;
}
// Hash simple de string (para mezclar dificultad/genero en la semilla).
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// ---------------- FFT (Cooley-Tukey iterativa) ----------------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k], aIm = im[i + k];
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = aRe + bRe; im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe; im[i + k + len / 2] = aIm - bIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

// ---------------- Onset envelope multibanda (spectral flux) ----------------
// Calculamos el flujo espectral en bandas separadas:
//   - low  (~20-150 Hz): kick/bombo -> define el PULSO principal.
//   - mid  (~150-2000 Hz): caja, bajo melodico, voces graves.
//   - high (~2000-5500 Hz): hats, ataques agudos -> subdivisiones.
//   - cymbal (>5500 Hz): crash/ride/splash -> acentos brillantes (jumps).
// Devolvemos curvas por banda y una combinada ponderada. Esto detecta mucho
// mejor el ritmo en musica real que una sola curva de banda completa.
function onsetEnvelope(samples, sampleRate) {
  const hopSec = HOP / sampleRate;
  const numFrames = Math.max(0, Math.floor((samples.length - FFT_SIZE) / HOP));
  const half = FFT_SIZE / 2;
  const binHz = sampleRate / FFT_SIZE;

  const lowMax = Math.min(half, Math.floor(150 / binHz));
  const midMax = Math.min(half, Math.floor(2000 / binHz));
  const cymMin = Math.min(half, Math.floor(5500 / binHz)); // platillos: >5.5 kHz
  // Banda VOCAL: ~300-3000 Hz cubre la fundamental + primeros formantes de la
  // voz cantada/hablada. Los ataques de SILABA (consonantes, nuevas vocales)
  // producen flujo espectral aqui. La usamos para detectar partes donde la voz
  // va rapida (rap, canto veloz) y meter mas notas al ritmo de las silabas.
  const vocLo = Math.min(half, Math.floor(300 / binHz));
  const vocHi = Math.min(half, Math.floor(3000 / binHz));

  const fluxLow = new Float32Array(numFrames);
  const fluxMid = new Float32Array(numFrames);
  const fluxHigh = new Float32Array(numFrames);
  const fluxCym = new Float32Array(numFrames);   // crash/ride
  const fluxVoc = new Float32Array(numFrames);   // voz (ataques de silaba)
  const fluxAll = new Float32Array(numFrames);
  // Centroide espectral por frame (Hz): "altura tonal" del sonido en ese
  // instante. Lo usamos para el CONTORNO MELODICO: notas agudas -> carriles a
  // la derecha/arriba, graves -> izquierda/abajo. Se calcula con la magnitud
  // LINEAL (no log) ponderada por la frecuencia de cada bin.
  const centroidHz = new Float32Array(numFrames);
  // Energia melodica (magnitud lineal en la banda 150-4000 Hz) por frame:
  // sirve para medir estabilidad de pitch (holds) y descartar centroides de
  // tramos casi silenciosos.
  const melEnergy = new Float32Array(numFrames);
  const melLo = Math.min(half, Math.floor(150 / binHz));
  const melHi = Math.min(half, Math.floor(4000 / binHz));

  const win = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++)
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));

  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  // SUPERFLUX (Bock & Widmer 2013): en lugar de comparar el espectro con el
  // del frame anterior, lo comparamos con una version MAX-FILTRADA en frecuencia
  // del espectro de 'mu' frames atras. El max-filtro (radio MAXBINS) tolera el
  // vibrato/glissando: una nota que sube/baja de tono ligeramente NO se cuenta
  // como nuevo onset. Esto reduce muchisimo los falsos positivos en cuerdas,
  // voces y orquestal (clave para que Csikos Post caiga al ritmo real).
  const MU = 2;            // lag de comparacion (~12ms): mejor que 1 frame
  const MAXBINS = 3;       // radio del max-filtro en bins de frecuencia
  const histLen = MU + 1;
  const magHist = [];
  for (let k = 0; k < histLen; k++) magHist.push(new Float32Array(half));
  let histPos = 0;
  const maxFilt = new Float32Array(half);

  for (let f = 0; f < numFrames; f++) {
    const start = f * HOP;
    for (let i = 0; i < FFT_SIZE; i++) { re[i] = samples[start + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const mag = magHist[histPos];
    for (let i = 0; i < half; i++) {
      // Compresion logaritmica: realza ataques, reduce dominancia de picos.
      mag[i] = Math.log1p(Math.sqrt(re[i] * re[i] + im[i] * im[i]));
    }
    // Centroide espectral (Hz) con magnitud LINEAL en la banda melodica.
    {
      let num = 0, den = 0;
      for (let i = melLo; i < melHi; i++) {
        const lin = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
        num += lin * (i * binHz);
        den += lin;
      }
      centroidHz[f] = den > 1e-9 ? num / den : 0;
      melEnergy[f] = den;
    }
    // Espectro de referencia: 'mu' frames atras, max-filtrado en frecuencia.
    const refIdx = (histPos - MU + histLen) % histLen;
    const ref = magHist[refIdx];
    let lo = 0, md = 0, hi = 0, cy = 0, vo = 0;
    if (f >= MU) {
      for (let i = 0; i < half; i++) {
        // max-filtro: maximo de ref en [i-MAXBINS, i+MAXBINS].
        let mx = ref[i];
        const a = i - MAXBINS < 0 ? 0 : i - MAXBINS;
        const b = i + MAXBINS >= half ? half - 1 : i + MAXBINS;
        for (let j = a; j <= b; j++) if (ref[j] > mx) mx = ref[j];
        maxFilt[i] = mx;
        const d = mag[i] - maxFilt[i];
        if (d > 0) {
          if (i < lowMax) lo += d;
          else if (i < midMax) md += d;
          else { hi += d; if (i >= cymMin) cy += d; }
          // Banda vocal (rango propio, se solapa con mid/high a proposito).
          if (i >= vocLo && i < vocHi) vo += d;
        }
      }
    }
    fluxLow[f] = lo;
    fluxMid[f] = md;
    fluxHigh[f] = hi;
    fluxCym[f] = cy;
    fluxVoc[f] = vo;
    // Ponderacion: el bajo pesa mas (define el pulso), agudos ayudan a subdividir.
    fluxAll[f] = lo * 1.6 + md * 1.0 + hi * 0.7;
    histPos = (histPos + 1) % histLen;
  }
  return { fluxLow, fluxMid, fluxHigh, fluxCym, fluxVoc, flux: fluxAll, hopSec, centroidHz, melEnergy };
}

// Realza picos restando una linea base local y aplica normalizacion local
// (divide por el pico local) para que tanto secciones suaves como fuertes
// produzcan onsets utiles. Devuelve valores ~0..1.
function normalizeNovelty(flux) {
  const n = flux.length;
  const out = new Float32Array(n);
  // Ventanas en frames; HOP=256 (~5.8ms). ~190ms baseline, ~1s para pico local.
  const wBase = 32;
  const wPeak = 172;
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - wBase); j <= Math.min(n - 1, i + wBase); j++) { s += flux[j]; c++; }
    out[i] = Math.max(0, flux[i] - s / c);
  }
  // Normalizacion local por pico (compansion suave) para igualar dinamica.
  const norm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let localMax = 1e-9;
    for (let j = Math.max(0, i - wPeak); j <= Math.min(n - 1, i + wPeak); j++) {
      if (out[j] > localMax) localMax = out[j];
    }
    norm[i] = Math.min(1, out[i] / localMax);
  }
  return norm;
}

// ---------------- Envolvente de INTENSIDAD (global) ----------------
// Mide cuanta energia tiene cada momento RELATIVO a toda la cancion. Sirve para
// decidir la DENSIDAD de notas: en un "drop" de electronica la intensidad es
// ~1 (muchas notas); en una intro suave es ~0.2 (pocas notas).
// Es distinta de la novedad (que detecta golpes); aqui no normalizamos local,
// preservamos la dinamica global a proposito.
function intensityEnvelope(samples, sampleRate) {
  const hopSec = HOP / sampleRate;
  const win = FFT_SIZE;
  const n = Math.max(0, Math.floor((samples.length - win) / HOP));
  const energy = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    const start = f * HOP;
    let sum = 0;
    for (let i = 0; i < win; i++) { const s = samples[start + i]; sum += s * s; }
    energy[f] = Math.sqrt(sum / win); // RMS
  }
  // Suavizar (~0.4s) para capturar "secciones", no golpes sueltos.
  const w = Math.round(0.4 / hopSec);
  const smooth = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += energy[i];
    if (i >= 2 * w + 1) acc -= energy[i - (2 * w + 1)];
    const lo = Math.max(0, i - w), hi = Math.min(n - 1, i + w);
    // recalculo simple de media en ventana (n pequeno, costo aceptable)
    smooth[i] = energy[i];
  }
  // Media movil real
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) { s += energy[j]; c++; }
    smooth[i] = s / c;
  }
  // Normalizar globalmente por un percentil alto (robusto a picos extremos).
  const sorted = Float32Array.from(smooth).sort();
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1e-9;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.min(1, smooth[i] / p95);
  return out;
}

function sampleAt(arr, hopSec, tSec) {
  const idx = Math.round(tSec / hopSec);
  if (idx < 0 || idx >= arr.length) return 0;
  return arr[idx];
}

// ---------------- Estructura: BUILD-UPS hacia drops ----------------
// Detecta tramos donde la intensidad SUBE sostenidamente y desemboca en una
// seccion mas fuerte (un "drop"/coro). Devuelve una curva 0..1 por frame que
// indica "cuanto estamos en un build-up". La usamos para ACELERAR la densidad
// de notas segun nos acercamos al drop (el clasico crescendo de EDM/pop), y
// para permitir subdivisiones mas finas justo antes del estallido.
function analyzeStructure(intensity, hopSec) {
  const n = intensity.length;
  const buildup = new Float32Array(n);
  if (n < 4) return buildup;
  const back = Math.max(1, Math.round(3.0 / hopSec));   // mira ~3s atras
  const ahead = Math.max(1, Math.round(1.5 / hopSec));  // y ~1.5s adelante
  for (let i = 0; i < n; i++) {
    const past = intensity[Math.max(0, i - back)];
    const now = intensity[i];
    const future = intensity[Math.min(n - 1, i + ahead)];
    const rise = now - past;          // sube respecto al pasado
    const dropAhead = future - now;   // viene algo mas fuerte (drop)
    let b = 0;
    if (rise > 0.04 && dropAhead > 0.08) b = Math.min(1, rise + dropAhead);
    buildup[i] = b;
  }
  // Suavizar (~0.4s) para una rampa continua, no escalonada.
  const w = Math.max(1, Math.round(0.4 / hopSec));
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) { s += buildup[j]; c++; }
    sm[i] = s / c;
  }
  return sm;
}

// ---------------- Curva de PITCH normalizada (contorno melodico) ----------------
// Convierte el centroide espectral (Hz) en un valor 0..1 que representa "que tan
// agudo" suena cada instante, RELATIVO al rango tonal propio de la cancion.
// Usa escala logaritmica (la percepcion de altura es logaritmica) y normaliza
// por percentiles (p5..p95) de los frames con energia melodica suficiente, asi
// se adapta a la tesitura de cada tema. Suaviza un poco para evitar saltos por
// transitorios. Frames sin energia melodica heredan el pitch del vecino.
function computePitchCurve(centroidHz, melEnergy, hopSec) {
  const n = centroidHz.length;
  const out = new Float32Array(n);
  if (n === 0) return out;
  // Umbral de energia: ignoramos frames casi silenciosos para los percentiles.
  const meSorted = Float32Array.from(melEnergy).sort();
  const meThr = (meSorted[Math.floor(n * 0.4)] || 0) * 0.5 + 1e-9;
  // log(centroid) de frames con energia.
  const logs = [];
  for (let i = 0; i < n; i++) {
    if (melEnergy[i] >= meThr && centroidHz[i] > 1) logs.push(Math.log(centroidHz[i]));
  }
  if (logs.length < 8) return out; // sin contorno fiable -> todo 0 (neutro)
  logs.sort((a, b) => a - b);
  const p5 = logs[Math.floor(logs.length * 0.05)];
  const p95 = logs[Math.floor(logs.length * 0.95)];
  const span = Math.max(1e-3, p95 - p5);
  // Mapear cada frame a 0..1; los frames sin energia toman el ultimo valido.
  let last = 0.5;
  for (let i = 0; i < n; i++) {
    if (melEnergy[i] >= meThr && centroidHz[i] > 1) {
      const v = (Math.log(centroidHz[i]) - p5) / span;
      last = Math.max(0, Math.min(1, v));
    }
    out[i] = last;
  }
  // Suavizado ligero (~50ms) para que el contorno sea estable, no nervioso.
  const w = Math.max(1, Math.round(0.05 / hopSec));
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) { s += out[j]; c++; }
    sm[i] = s / c;
  }
  return sm;
}

// ---------------- Clasificador de genero (heuristico) ----------------
// No es un clasificador ML; usa rasgos simples para elegir un preset razonable
// cuando el usuario deja "auto":
//   - ratio de energia en agudos (hats brillantes -> electronica/pop)
//   - "percusividad" (variacion fuerte del bajo -> beat marcado)
//   - rango dinamico (mucha diferencia suave/fuerte -> electronica con drops,
//     o clasica con crescendos)
function detectGenre(bands, intensity) {
  const n = bands.flux.length || 1;
  let lowSum = 0, midSum = 0, highSum = 0;
  for (let i = 0; i < n; i++) { lowSum += bands.fluxLow[i]; midSum += bands.fluxMid[i]; highSum += bands.fluxHigh[i]; }
  const total = lowSum + midSum + highSum + 1e-9;
  const highRatio = highSum / total;
  const lowRatio = lowSum / total;
  const midRatio = midSum / total;

  // Rango dinamico de la intensidad (drops vs partes suaves).
  const sorted = Float32Array.from(intensity).sort();
  const p10 = sorted[Math.floor(sorted.length * 0.1)] || 0;
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || 1;
  const dynRange = p90 - p10;

  // Percusividad: cuanta energia de onset hay en el bajo en promedio.
  const kickStrength = lowSum / n;

  // Reglas simples y ordenadas (de mas especifica a mas general):
  // CLASICA / ORQUESTAL: casi sin bajo percusivo (sin kick) y dinamica pareja
  // (sin drops bruscos). Brillante o no, lo clave es lowRatio muy bajo.
  if (lowRatio < 0.06 && dynRange < 0.6) return "classical";
  if (dynRange > 0.5 && highRatio > 0.18 && lowRatio > 0.1) return "electronic"; // drops + bajo
  if (lowRatio > 0.45 && highRatio > 0.2) return "electronic";   // bajo fuerte + hats brillantes
  if (lowRatio < 0.4 && midRatio > 0.42) return "classical";     // orquestal de medios
  if (kickStrength < 0.012 && lowRatio < 0.42) return "classical"; // suave, poco kick
  if (lowRatio > 0.55) return "hiphop";   // bajo dominante, menos brillo
  if (highRatio > 0.2) return "pop";
  return "rock";
}

// ---------------- BPM por autocorrelacion ----------------
// Devuelve un BPM de alta precision usando interpolacion parabolica sub-bin
// alrededor del pico de autocorrelacion, mas un refinado fino opcional.
function estimateBPM(novelty, hopSec) {
  const minBpm = 70, maxBpm = 200;
  const minLag = Math.floor(60 / maxBpm / hopSec);
  const maxLag = Math.ceil(60 / minBpm / hopSec);

  const acf = new Float32Array(maxLag + 2);
  let bestLag = minLag, bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < novelty.length; i++) s += novelty[i] * novelty[i + lag];
    acf[lag] = s;
    // Ponderar por el prior de tempo para evitar elegir doble/mitad del real.
    const candBpm = 60 / (lag * hopSec);
    const weighted = s * tempoPrior(candBpm);
    if (weighted > bestScore) { bestScore = weighted; bestLag = lag; }
  }

  // Interpolacion parabolica para precision sub-muestra (lag fraccionario).
  let refinedLag = bestLag;
  const y0 = acf[bestLag - 1] || 0;
  const y1 = acf[bestLag];
  const y2 = acf[bestLag + 1] || 0;
  const denom = y0 - 2 * y1 + y2;
  if (denom !== 0) {
    const delta = (0.5 * (y0 - y2)) / denom; // en [-1,1]
    if (Math.abs(delta) <= 1) refinedLag = bestLag + delta;
  }

  let bpm = 60 / (refinedLag * hopSec);
  while (bpm < 90) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  // Refinado fino: probar BPM cercanos maximizando energia sobre la rejilla
  // de beats (esto corrige el error residual de la autocorrelacion).
  bpm = refineBpmByGrid(novelty, hopSec, bpm);
  return Math.round(bpm * 100) / 100;
}

// Peso "prior" de tempo: preferimos tempos centrados ~128 BPM (log-normal).
// Evita que un fuerte patron de corcheas/semicorcheas haga elegir el doble/mitad
// del tempo real.
function tempoPrior(bpm) {
  const center = Math.log(128);
  const sigma = 0.45;
  const x = Math.log(bpm);
  return Math.exp(-((x - center) ** 2) / (2 * sigma * sigma));
}

// Ajuste fino del BPM: busca en un rango estrecho el tempo que hace que los
// beats caigan sobre la mayor energia de onset acumulada (con su mejor fase).
function refineBpmByGrid(novelty, hopSec, bpm0) {
  let bestBpm = bpm0, bestScore = -Infinity;
  for (let cand = bpm0 - 2; cand <= bpm0 + 2; cand += 0.1) {
    const beatFrames = 60 / cand / hopSec;
    // mejor fase para este candidato
    let phaseBest = 0, phaseScore = -Infinity;
    const phases = 24;
    for (let p = 0; p < phases; p++) {
      const ph = (p / phases) * beatFrames;
      let s = 0;
      for (let b = 0; ; b++) {
        const idx = Math.round(ph + b * beatFrames);
        if (idx >= novelty.length) break;
        s += novelty[idx];
      }
      if (s > phaseScore) { phaseScore = s; phaseBest = ph; }
    }
    if (phaseScore > bestScore) { bestScore = phaseScore; bestBpm = cand; }
  }
  return bestBpm;
}

// ---------------- Fase del beat (offset) ----------------
// Probamos varios desfases dentro de un periodo de beat y elegimos el que
// maximiza la energia de onset cayendo sobre los beats.
function estimatePhase(novelty, hopSec, bpm) {
  const beatSec = 60 / bpm;
  const beatFrames = beatSec / hopSec;
  const steps = 100;
  let bestPhase = 0, bestScore = -Infinity;

  for (let s = 0; s < steps; s++) {
    const phaseFrames = (s / steps) * beatFrames;
    let score = 0;
    for (let b = 0; ; b++) {
      const idx = Math.round(phaseFrames + b * beatFrames);
      if (idx >= novelty.length) break;
      score += novelty[idx];
    }
    if (score > bestScore) { bestScore = score; bestPhase = phaseFrames * hopSec; }
  }
  return bestPhase; // segundos del primer beat
}

// ---------------- Seguimiento de beats por PROGRAMACION DINAMICA (Ellis 2007) -
// En lugar de una rejilla rigida (BPM+fase constantes), encontramos la mejor
// SECUENCIA de tiempos de beat que (a) caen sobre picos de onset y (b) mantienen
// un espaciado cercano al periodo del tempo. Tolera pequenas variaciones de
// tempo y "rubato", asi los beats siguen la musica real mucho mejor.
//
// Recurrencia: para cada frame t, score[t] = onset[t] + max_{tau} ( score[tau]
// + alpha * transitionCost(t-tau) ), con transitionCost = -(log((t-tau)/period))^2
// que penaliza desviarse del periodo ideal. Luego backtrace desde el mejor.
function trackBeats(novelty, hopSec, bpm) {
  const n = novelty.length;
  if (n < 4) return [];
  const period = (60 / bpm) / hopSec;        // periodo de beat en frames
  if (!isFinite(period) || period < 2) return [];

  // Ventana de busqueda de beat previo: alrededor de un periodo (0.5x .. 2x).
  const tauMin = Math.max(1, Math.round(period * 0.5));
  const tauMax = Math.round(period * 2.0);
  const alpha = 100;                          // peso del coste de transicion (tightness)
  const logP = Math.log(period);

  const score = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);

  for (let t = 0; t < n; t++) {
    let best = -Infinity, bestTau = -1;
    const lo = t - tauMax, hi = t - tauMin;
    for (let tau = lo; tau <= hi; tau++) {
      if (tau < 0) continue;
      const interval = t - tau;
      const tc = -Math.pow(Math.log(interval / period) , 2) * alpha;
      const s = score[tau] + tc;
      if (s > best) { best = s; bestTau = tau; }
    }
    if (bestTau < 0) { score[t] = novelty[t]; back[t] = -1; }
    else { score[t] = novelty[t] + best; back[t] = bestTau; }
  }

  // El ultimo beat es el frame de mayor score en el ultimo tramo (~ medio
  // periodo final), para no cortar antes de tiempo.
  let endBest = -Infinity, endIdx = n - 1;
  const tail = Math.max(0, n - Math.round(period));
  for (let t = tail; t < n; t++) if (score[t] > endBest) { endBest = score[t]; endIdx = t; }

  // Backtrace.
  const beatsFrames = [];
  let t = endIdx;
  let guard = 0;
  while (t >= 0 && guard++ < n + 5) { beatsFrames.push(t); t = back[t]; }
  beatsFrames.reverse();
  if (beatsFrames.length < 2) return [];

  // Convertir a segundos.
  return beatsFrames.map((fr) => fr * hopSec);
}

// Construye una rejilla densa de tiempos a partir de los beats detectados,
// interpolando 'sub' celdas por intervalo de beat. Devuelve {times, beatFlags}.
// Si los beats fueran muy irregulares, cae a una rejilla uniforme (bpm/offset).
function buildGridFromBeats(beats, sub, duration, bpm, offset) {
  const times = [];
  const isBeat = [];
  const beatPeriod = 60 / bpm;
  if (beats && beats.length >= 4) {
    // Extender los beats hacia atras (hasta 0) y adelante (hasta duration) usando
    // el periodo local promedio, para cubrir intro y final.
    const first = beats[0], last = beats[beats.length - 1];
    const avgGap = (last - first) / (beats.length - 1) || beatPeriod;
    const ext = [];
    for (let t = first - avgGap; t > -avgGap * 0.5; t -= avgGap) ext.unshift(t);
    const allBeats = ext.concat(beats);
    for (let t = last + avgGap; t < duration + avgGap; t += avgGap) allBeats.push(t);
    // Subdividir cada intervalo.
    for (let b = 0; b < allBeats.length - 1; b++) {
      const t0 = allBeats[b], t1 = allBeats[b + 1];
      for (let s = 0; s < sub; s++) {
        const tt = t0 + (t1 - t0) * (s / sub);
        if (tt < 0 || tt >= duration) continue;
        times.push(tt);
        isBeat.push(s === 0);
      }
    }
    return { times, isBeat, ok: true };
  }
  // Fallback: rejilla uniforme.
  const cell = beatPeriod / sub;
  let k = 0;
  for (let t = offset; t < duration; t += cell, k++) {
    if (t < 0) continue;
    times.push(t);
    isBeat.push(k % sub === 0);
  }
  return { times, isBeat, ok: false };
}

// Energia de la novedad alrededor de un tiempo (busca el pico en una ventana
// de tolerancia ~+-35ms; con HOP=256 son ~6 frames).
function energyAt(novelty, hopSec, tSec, windowFrames = 6) {
  const center = tSec / hopSec;
  let max = 0;
  const lo = Math.floor(center - windowFrames);
  const hi = Math.ceil(center + windowFrames);
  for (let i = lo; i <= hi; i++) {
    if (i < 0 || i >= novelty.length) continue;
    if (novelty[i] > max) max = novelty[i];
  }
  return max;
}

// Detecta los TIEMPOS de pico de onset (peak-picking estandar, estilo Bock):
// un frame es pico si es el maximo local en +-w y supera la media movil + delta.
// Devuelve un array ordenado de tiempos (s). Sirve para "imantar" las notas a
// los ataques reales del audio y corregir cualquier desvio de la rejilla.
function detectOnsetPeaks(novelty, hopSec) {
  const n = novelty.length;
  const peaks = [];
  const w = 3;                 // ventana de maximo local (~18ms)
  const wMean = 16;            // ventana de media para el umbral (~95ms)
  for (let i = 0; i < n; i++) {
    const v = novelty[i];
    if (v < 0.06) continue;
    let isMax = true;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      if (novelty[j] > v) { isMax = false; break; }
    }
    if (!isMax) continue;
    let s = 0, c = 0;
    for (let j = Math.max(0, i - wMean); j <= Math.min(n - 1, i + wMean); j++) { s += novelty[j]; c++; }
    const mean = s / c;
    if (v >= mean + 0.04) peaks.push(i * hopSec);
  }
  return peaks;
}

// "Imanta" cada nota al pico de onset mas cercano si esta dentro de 'tolSec'.
// Asi las notas caen exactamente sobre el ataque real del sonido, no sobre la
// celda teorica de la rejilla. Mantiene el orden temporal.
function snapToOnsets(events, peaks, tolSec) {
  if (!peaks || peaks.length === 0) return;
  let pi = 0;
  for (const ev of events) {
    // Avanzar el cursor de picos hasta cerca del tiempo del evento.
    while (pi < peaks.length - 1 && peaks[pi] < ev.time - tolSec) pi++;
    // Buscar el pico mas cercano alrededor (pi-1, pi, pi+1).
    let best = null, bestD = tolSec;
    for (let k = Math.max(0, pi - 1); k <= Math.min(peaks.length - 1, pi + 1); k++) {
      const d = Math.abs(peaks[k] - ev.time);
      if (d < bestD) { bestD = d; best = peaks[k]; }
    }
    if (best != null) ev.time = best;
  }
  // Reordenar por si algun snap cambio el orden, y deduplicar tiempos iguales.
  events.sort((a, b) => a.time - b.time);
}

// Elimina eventos demasiado juntos (manteniendo el mas fuerte / el downbeat).
function dedupEvents(events, minGap) {
  if (events.length < 2) return;
  events.sort((a, b) => a.time - b.time);
  const out = [];
  let last = null;
  for (const ev of events) {
    if (last && ev.time - last.time < minGap) {
      // Conservar el que tenga mas info: downbeat o mayor fuerza.
      const keepNew = (ev.downbeat && !last.downbeat) ||
        ((ev.strength || 0) > (last.strength || 0) && !last.downbeat);
      if (keepNew) { out[out.length - 1] = ev; last = ev; }
      // si no, descartamos ev
    } else {
      out.push(ev); last = ev;
    }
  }
  events.length = 0;
  events.push(...out);
}

// ---------------- Asignacion de carriles ----------------
// Para PIU usamos 5 paneles: 0=dl,1=ul,2=c,3=ur,4=dr.
// Para DDR 4 paneles: 0=left,1=down,2=up,3=right.
//
// Soporta NOTAS SIMULTANEAS (jumps): en golpes fuertes puede colocar 2..maxJump
// flechas a la vez (que hay que pisar juntas), como en Pump It Up. La cantidad
// depende de la dificultad (maxJump) y de la fuerza/intensidad del golpe.
function assignLanes(events, laneCount, maxJacks, maxJump, jumpScale) {
  const notes = [];
  let lastLane = -1;
  let jacks = 0;
  let prevT = -Infinity;
  let lastWasJump = false;
  // Estado de PIE para alternancia ergonomica: -1 = ultimo paso con pie izq,
  // +1 = pie der, 0 = neutro. Preferimos alternar lado a lado (como se baila
  // de verdad) sin romper el contorno melodico.
  let foot = 0;
  const center = (laneCount - 1) / 2;
  maxJump = Math.max(1, Math.min(maxJump || 1, laneCount));
  const js = jumpScale != null ? jumpScale : 1; // factor de frecuencia de jumps

  // FLUJO DE RACHAS (staircase): en tramos de notas simples rapidas y regulares
  // (corcheas/semicorcheas seguidas), los carriles al azar se sienten "saltones"
  // e incomodos de bailar. En su lugar generamos un recorrido suave por carriles
  // ADYACENTES que rebota en los bordes (como una escalera), que es justo lo que
  // hacen las pistas reales en rachas. Estado del flujo actual:
  const flow = { active: false, dir: 1, len: 0 };

  for (let ei = 0; ei < events.length; ei++) {
    const ev = events[ei];
    const gap = ev.time - prevT;
    // ¿Cuantas flechas simultaneas para este golpe?
    let count = 1;
    if (maxJump >= 2) {
      const strong = ev.strength || 0;
      const inten = ev.intensity || 0;
      // Solo en golpes con espacio (no en rafagas rapidas) y con energia.
      const room = gap > 0.16;
      if (room && !lastWasJump) {
        // Acento de PLATILLO (crash/ride): duplica la probabilidad de doble,
        // y en dificultades altas (maxJump>=3) habilita triple con fuerza.
        const cymMult = ev.cymbal ? 2.0 : 1.0;
        // Probabilidad de jump escalada por fuerza+intensidad, dificultad y platillo.
        const p2 = (0.05 + strong * 0.3 + inten * 0.22) * js * cymMult;  // jump de 2
        let p3 = (inten > 0.7 && strong > 0.6) ? 0.16 * js : 0;          // triple en picos
        if (ev.cymbal && maxJump >= 3) p3 = Math.max(p3, 0.35 * js);     // platillo -> triple
        const r = rng();
        // Permitimos dobles no solo en downbeats/golpes fuertes: con bias alto
        // (clasica) o en un golpe de platillo, tambien en notas del flujo.
        const gate = ev.downbeat || strong > 0.5 || js >= 1.4 || ev.cymbal;
        if (gate) {
          if (maxJump >= 3 && r < p3) count = 3;
          else if (r < p2) count = 2;
        }
        // En picos extremos y dificultad alta, jumps de hasta maxJump.
        if (maxJump >= 4 && inten > 0.85 && strong > 0.75 && rng() < 0.1 * js) {
          count = Math.min(maxJump, 4 + (rng() < 0.3 ? 1 : 0));
        }
      }
    }
    count = Math.min(count, laneCount);

    // ¿Es esta nota parte de una RACHA rapida y regular de notas simples? Lo es
    // si el hueco con la anterior es corto (<=0.19s, ~corcheas a 160+ o
    // semicorcheas) y similar al hueco que viene despues. En ese caso aplicamos
    // flujo de escalera en vez de carriles al azar.
    let chosen;
    const nextGap = ei + 1 < events.length ? events[ei + 1].time - ev.time : Infinity;
    const inRun = count === 1 && lastLane >= 0 && gap <= 0.19 && gap > 0.02;
    if (inRun) {
      chosen = [pickFlowLane(laneCount, lastLane, flow)];
    } else if (count === 1) {
      // Nota simple: carril guiado por el CONTORNO MELODICO (pitch) + alternancia de pie.
      flow.active = false; flow.len = 0;
      chosen = [pickMelodicLane(laneCount, lastLane, foot, jacks, maxJacks, ev, center)];
    } else {
      // Jump/acorde: parejas comodas, centradas segun el pitch.
      flow.active = false; flow.len = 0;
      chosen = pickLanes(count, laneCount, lastLane, jacks, maxJacks, ev);
    }

    for (const lane of chosen) {
      const note = { time: ev.time, lane };
      if (ev.duration && ev.duration > 0) note.duration = ev.duration;
      notes.push(note);
    }

    // Control de jacks (repetir carril) usando el primer carril elegido.
    const primary = chosen[0];
    if (primary === lastLane) jacks++; else jacks = 0;
    lastLane = chosen.length === 1 ? primary : -1; // tras un jump, libre
    lastWasJump = chosen.length > 1;
    // Actualizar estado de pie: un carril a la izq del centro = pie izq, a la
    // der = pie der; el centro mantiene el pie previo. Tras un jump, neutro.
    if (chosen.length === 1) {
      const s = primary < center ? -1 : (primary > center ? 1 : 0);
      if (s !== 0) foot = s;
    } else {
      foot = 0;
    }
    prevT = ev.time;
  }
  return notes;
}

// Elige el carril de una NOTA SIMPLE combinando dos criterios, de forma
// DETERMINISTA (sin azar): asi una frase melodica repetida produce SIEMPRE las
// mismas flechas (patrones reconocibles, como en charts reales).
//   1) CONTORNO MELODICO: el pitch (0..1) define un carril objetivo (grave ->
//      izquierda/abajo, agudo -> derecha/arriba). Es el criterio dominante.
//   2) ALTERNANCIA DE PIE: a igualdad de cercania al objetivo, preferimos el
//      lado opuesto al ultimo paso, para que se baile comodo.
// Si el objetivo coincide con el ultimo carril (misma nota repetida), el
// castigo de jack empuja a un carril adyacente (footswitch), evitando repetir.
function pickMelodicLane(laneCount, lastLane, foot, jacks, maxJacks, ev, center) {
  const pitch = (ev && ev.pitch != null) ? ev.pitch : 0.5;
  let target = pitch * (laneCount - 1);
  // Sesgo por INSTRUMENTO (mapeo consistente por voz, estilo GenerationMania):
  //   - kick/bombo: tira hacia el CENTRO (zona de pisada del pulso).
  //   - hat/cymbal: empuja hacia AFUERA (carriles externos, agudos arriba).
  //   - melody/voz: respeta el contorno de tono (sin sesgo extra).
  const voice = ev && ev.voice;
  if (voice === "kick") {
    target = target * 0.45 + center * 0.55;          // hacia el centro
  } else if (voice === "hat" || voice === "cymbal") {
    // hacia el extremo mas cercano (afuera)
    const ext = target < center ? 0 : (laneCount - 1);
    target = target * 0.5 + ext * 0.5;
  }
  let best = 0, bestScore = -Infinity;
  for (let lane = 0; lane < laneCount; lane++) {
    // Cercania al objetivo (contorno + sesgo de instrumento) — peso dominante.
    let score = -Math.abs(lane - target) * 1.0;
    // Alternancia de pie (peso secundario): bonus si cae al lado opuesto.
    const side = lane < center ? -1 : (lane > center ? 1 : 0);
    if (foot !== 0 && side !== 0) score += (side === -foot ? 0.55 : -0.45);
    // Evitar jacks (repetir carril) salvo permiso por conteo.
    if (lane === lastLane) score += (jacks < maxJacks) ? -0.30 : -2.2;
    // Desempate determinista y estable (no azar) para reproducibilidad.
    score += lane * 1e-4;
    if (score > bestScore) { bestScore = score; best = lane; }
  }
  return best;
}

// Devuelve el siguiente carril de una RACHA en flujo de escalera: avanza un
// carril adyacente en la direccion actual y rebota al llegar a un borde. De vez
// en cuando cambia de direccion para no ser monotono. Mantiene el estado en
// 'flow' entre llamadas.
function pickFlowLane(laneCount, lastLane, flow) {
  if (!flow.active) {
    // Arranca la racha: direccion hacia el centro (mas margen para fluir).
    flow.active = true;
    flow.len = 0;
    flow.dir = lastLane < (laneCount - 1) / 2 ? 1 : -1;
  }
  flow.len++;
  // Cambio de direccion ocasional a mitad de racha (zigzag natural ~18%).
  if (flow.len >= 2 && rng() < 0.18) flow.dir = -flow.dir;
  let next = lastLane + flow.dir;
  if (next < 0 || next >= laneCount) {
    // Rebote en el borde: invierte la direccion.
    flow.dir = -flow.dir;
    next = lastLane + flow.dir;
    if (next < 0 || next >= laneCount) next = lastLane; // laneCount==1 (no pasa)
  }
  return next;
}

// Elige 'count' carriles distintos para un golpe, evitando repeticiones
// incomodas y prefiriendo combinaciones comodas para jumps.
function pickLanes(count, laneCount, lastLane, jacks, maxJacks, ev) {
  const candidates = [];
  for (let i = 0; i < laneCount; i++) candidates.push(i);

  // Evitar repetir el ultimo carril salvo "jack" permitido (solo notas simples).
  if (count === 1 && lastLane >= 0) {
    const allowJack = jacks < maxJacks && rng() < 0.12;
    if (!allowJack) {
      const idx = candidates.indexOf(lastLane);
      if (idx >= 0) candidates.splice(idx, 1);
    }
  }

  // Para jumps de 2 en PIU, ciertas parejas son mas "naturales"/comodas
  // (simetricas o adyacentes). Las preferimos para que se sienta bien bailado.
  if (count === 2 && laneCount === 5 && rng() < 0.7) {
    const nicePairs = [[0, 4], [1, 3], [0, 2], [2, 4], [1, 2], [2, 3], [0, 1], [3, 4]];
    const pair = nicePairs[(rng() * nicePairs.length) | 0];
    return rng() < 0.5 ? pair : [pair[1], pair[0]];
  }
  if (count === 2 && laneCount === 4 && rng() < 0.7) {
    const nicePairs = [[0, 3], [1, 2], [0, 1], [2, 3], [0, 2], [1, 3]];
    const pair = nicePairs[(rng() * nicePairs.length) | 0];
    return pair;
  }

  const chosen = [];
  // Primer carril: sesgo a externos en golpes fuertes.
  if ((ev.strength || 0) > 0.6 && rng() < 0.5) {
    const ext = laneCount === 5 ? [0, 4] : [0, 3];
    let lane = ext[(rng() * ext.length) | 0];
    if (!candidates.includes(lane)) lane = candidates[(rng() * candidates.length) | 0];
    chosen.push(lane);
    candidates.splice(candidates.indexOf(lane), 1);
  }

  while (chosen.length < count && candidates.length > 0) {
    const i = (rng() * candidates.length) | 0;
    chosen.push(candidates[i]);
    candidates.splice(i, 1);
  }
  return chosen;
}

// Coloca notas recorriendo la rejilla a la MAXIMA subdivision posible, pero
// aceptando subdivisiones finas SOLO donde la intensidad de la seccion lo
// justifica. Asi un drop intenso recibe semicorcheas (muchas notas) y una
// intro suave solo negras (pocas notas): la densidad sigue a la energia.
function placeNotesByIntensity(p) {
  const { duration, offset, beatSec, hopSec, novLow, novHigh, novFull, novCym, intensity, cfg, genrePreset, beats, novVoc, vocPeaks, vocRate, pitchCurve, buildup } = p;
  const maxSubdiv = Math.max(cfg.baseSubdiv, genrePreset.maxSubdiv);
  const cellSec = beatSec / maxSubdiv;     // rejilla mas fina posible (fallback)
  const minGap = cellSec * 0.85;
  const bpm = 60 / beatSec;

  // Rejilla derivada de los BEATS detectados (programacion dinamica). Las
  // subdivisiones se interpolan DENTRO de cada intervalo real de beat, asi que
  // siguen el tempo aunque varie un poco. Cae a rejilla uniforme si hace falta.
  const grid = buildGridFromBeats(beats, maxSubdiv, duration, bpm, offset);

  // PASO 1: recolectar TODAS las celdas candidatas de la rejilla con su energia
  // de onset. No filtramos por un umbral absoluto (eso fallaba con musica sin
  // percusion, como orquestal: casi nada pasaba el corte). En su lugar elegimos
  // despues las mas fuertes hasta alcanzar una densidad objetivo.
  const cells = [];
  for (let gi = 0; gi < grid.times.length; gi++) {
    const t = grid.times[gi];
    if (t < 0) continue;
    const onDownbeat = grid.isBeat[gi];
    // Nivel de subdivision: 1 en beat; si no, segun su posicion fraccionaria
    // dentro del beat (2=corchea, 4=semicorchea...).
    const sub = onDownbeat ? 1 : subdivisionOfGridIndex(gi, grid, maxSubdiv);

    const inten = Math.pow(sampleAt(intensity, hopSec, t), genrePreset.intensityPow);
    // Ritmo vocal local (silabas/seg): permite subdivisiones mas finas en
    // partes de voz rapida (rap/canto veloz).
    const vr = vocRate ? vocalRateAt(vocRate, hopSec, t) : 0;
    // Build-up hacia un drop: acelera la densidad y permite subdivisiones mas
    // finas conforme nos acercamos al estallido (crescendo de EDM/pop).
    const bu = buildup ? sampleAt(buildup, hopSec, t) : 0;
    const allowedSubdiv = allowedSubdivForIntensity(inten, cfg, genrePreset, vr, bu);
    if (sub > allowedSubdiv) continue;

    const eLow = energyAt(novLow, hopSec, t, 6);
    const eFull = energyAt(novFull, hopSec, t, 6);
    const eHigh = energyAt(novHigh, hopSec, t, 6);
    const eVoc = novVoc ? energyAt(novVoc, hopSec, t, 6) : 0;
    let e;
    if (onDownbeat) e = Math.max(eLow * 1.2, eFull);
    else if (sub >= 4 && genrePreset.useHighForSub) e = Math.max(eFull, eHigh * 1.1);
    else e = eFull;
    // En subdivisiones finas con voz rapida, la SILABA manda: usa la energia
    // vocal para que la celda sobreviva al corte por densidad (la voz veloz
    // suele tener poco onset instrumental nuevo).
    if (!onDownbeat && vr > 4 && eVoc > 0) e = Math.max(e, eVoc * 1.05);
    // Boost de build-up: las celdas en la rampa hacia el drop ganan energia,
    // asi sobreviven al corte por densidad y la pista se va "llenando".
    if (bu > 0) e *= (1 + 0.6 * bu);

    cells.push({ time: t, e, sub, onDownbeat, intensity: inten, vocRate: vr });
  }

  // PASO 2: densidad objetivo (notas/segundo) por dificultad. Esto hace que
  // CUALQUIER cancion —con o sin bateria— reciba una cantidad acorde a su
  // dificultad, decifrando bien la orquestal intensa (Csikos Post, etc.).
  const targetNPS = densityScaleToNPS(cfg.densityScale);
  const playable = Math.max(1, duration - offset);
  let targetCount = Math.round(targetNPS * playable);

  // Umbral adaptativo: tomamos las celdas mas fuertes hasta la densidad objetivo,
  // PERO con un piso minimo de energia para no inventar notas en celdas casi
  // silenciosas (eso desalineaba la pista en canciones de pocos onsets).
  const sortedByE = cells.map((c) => c.e).sort((a, b) => b - a);
  const idx = Math.min(sortedByE.length - 1, Math.max(0, targetCount - 1));
  let cutoff = sortedByE.length ? sortedByE[idx] : 0;
  // Piso: relativo al onset mas fuerte de la cancion (ignora celdas de ruido).
  const maxE = sortedByE.length ? sortedByE[0] : 0;
  const floor = maxE * 0.18;
  if (cutoff < floor) cutoff = floor;

  // Umbral de PLATILLO: un golpe brillante (crash/ride) destaca claramente en
  // la banda de platillos. Usamos un percentil alto de novCym como referencia.
  let cymThr = 0.45;
  if (novCym) {
    const cymVals = [];
    for (let i = 0; i < novCym.length; i++) if (novCym[i] > 0.01) cymVals.push(novCym[i]);
    if (cymVals.length > 20) {
      cymVals.sort((a, b) => a - b);
      cymThr = Math.max(0.35, cymVals[Math.floor(cymVals.length * 0.85)]); // top ~15%
    }
  }

  // PASO 3: recorrer en orden temporal y aceptar celdas por encima del cutoff
  // (los downbeats con algo de energia se conservan para no perder el pulso).
  const events = [];
  let lastTime = -Infinity;
  for (const c of cells) {
    const passes = c.e >= cutoff || (c.onDownbeat && c.e >= cutoff * 0.5);
    if (passes && c.time - lastTime >= minGap) {
      // ¿Hay un golpe de platillo (crash/ride) en esta celda? -> acento => jump.
      const cym = novCym ? energyAt(novCym, hopSec, c.time, 4) : 0;
      const isCymbal = cym >= cymThr;
      events.push({ time: c.time, strength: Math.max(c.e, c.onDownbeat ? 0.3 : 0), downbeat: c.onDownbeat, intensity: c.intensity, cymbal: isCymbal });
      lastTime = c.time;
    }
  }

  // PASO 4: RELLENO DE PATRON CONSTANTE. Aplica a todas las dificultades, pero
  // cada una rellena a su propia subdivision (Facil en negras al ritmo, etc.).
  fillSteadyStreams(events, cells, offset, duration, beatSec, cutoff, minGap, cfg);

  // PASO 4.2: RELLENO VOCAL. En tramos de voz rapida (rap/canto veloz),
  // añadimos notas siguiendo los ataques de SILABA, cuantizadas a la rejilla.
  // Asi una parte donde el cantante habla rapidisimo recibe muchas mas notas,
  // pero al ritmo (no caos). El tope por dificultad (maxNPS) acota el exceso.
  fillVocalSyllables(events, { offset, duration, beatSec, maxSubdiv, minGap, cfg, vocPeaks, vocRate, hopSec });

  ensurePulse(events, offset, duration, beatSec, novLow, hopSec, minGap);

  // PASO 4.5: IMANTAR a los ataques reales. Cada nota se mueve al pico de onset
  // mas cercano (dentro de ~half-cell) para que caiga exactamente sobre el
  // sonido, corrigiendo cualquier desvio de la rejilla. Tolerancia limitada
  // para no romper el patron ritmico (no salta a un onset lejano).
  const peaks = detectOnsetPeaks(novFull, hopSec);
  const snapTol = Math.min(0.045, (beatSec / maxSubdiv) * 0.5);
  snapToOnsets(events, peaks, snapTol);
  // Re-deduplicar por si dos notas cayeron casi encima tras imantar.
  dedupEvents(events, minGap);

  // PASO 5: LIMITE DE DENSIDAD (notas/segundo). Va AL FINAL (despues de relleno
  // y ensurePulse) para garantizar que ninguna seccion supere el tope de la
  // dificultad, sin importar el BPM. Asi una cancion muy rapida (Csikos Post)
  // no se vuelve imposible: la progresion easy->normal->ritmo->hard es suave.
  if (cfg.maxNPS) limitDensity(events, cfg.maxNPS);

  // Detectar notas LARGAS (holds): tramos donde el sonido se SOSTIENE (energia
  // alta) pero NO hay nuevos ataques (novedad baja). Tipico de sintes/voces
  // mantenidas. Convertimos la nota de inicio en un hold con duracion.
  detectHolds(events, { hopSec, novFull, intensity, beatSec, cfg, genrePreset, pitchCurve });

  // Adjuntar el PITCH (contorno melodico) a cada evento, en una sola pasada.
  // Lo usa la asignacion de carriles para que las notas agudas caigan a la
  // derecha/arriba y las graves a la izquierda/abajo.
  if (pitchCurve && pitchCurve.length) {
    for (const ev of events) ev.pitch = sampleAt(pitchCurve, hopSec, ev.time);
  }

  // Adjuntar la VOZ/INSTRUMENTO dominante a cada evento (idea de GenerationMania:
  // identificar la nota por instrumento y mapearla de forma consistente). Asi el
  // chart "toca los instrumentos": el bombo en una zona, la melodia trazando el
  // tono, los hats/platillos hacia afuera. Mucho mas conectado a la musica.
  for (const ev of events) {
    const lo = energyAt(novLow, hopSec, ev.time, 5);
    const hi = energyAt(novHigh, hopSec, ev.time, 5);
    const cy = novCym ? energyAt(novCym, hopSec, ev.time, 5) : 0;
    const vo = novVoc ? energyAt(novVoc, hopSec, ev.time, 5) : 0;
    // Prioridad: voz/melodia manda (contorno); luego platillo, hat, y bombo.
    if (ev.vocal || vo > Math.max(lo, hi, cy) * 1.1) ev.voice = "melody";
    else if (cy > 0.4 && cy >= hi) ev.voice = "cymbal";
    else if (lo >= hi && lo >= cy) ev.voice = "kick";
    else if (hi > lo) ev.voice = "hat";
    else ev.voice = "melody";
  }

  return events;
}

// Marca holds: si entre una nota y la siguiente hay un hueco "sostenido"
// (energia alta, sin onsets nuevos), la nota de inicio recibe una 'duration'.
function detectHolds(events, p) {
  const { hopSec, novFull, intensity, beatSec, cfg, genrePreset, pitchCurve } = p;
  // Solo en dificultades media+ y generos donde tiene sentido sostener.
  const maxHolds = { easy: 0.0, normal: 0.12, hard: 0.18, expert: 0.22 };
  // (no tenemos el nombre de dificultad aqui; usamos densityScale como proxy)
  const holdChance = cfg.densityScale >= 1.3 ? 0.30
                   : cfg.densityScale >= 1.0 ? 0.24
                   : cfg.densityScale >= 0.75 ? 0.16 : 0.0;
  if (holdChance <= 0) return;

  const minHold = beatSec * 0.75;   // duracion minima para que valga la pena
  const maxHold = beatSec * 4;      // tope (4 beats)

  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i];
    const b = events[i + 1];
    const gap = b.time - a.time;
    if (gap < minHold) continue;

    // En el hueco: ¿el sonido se mantiene sin nuevos ataques?
    // Medimos novedad media (baja), intensidad media (alta) y ESTABILIDAD DE
    // PITCH (el tono no cambia => nota sostenida real, no varias notas).
    let novSum = 0, intSum = 0, n = 0;
    let pSum = 0, pSum2 = 0, pn = 0;
    for (let t = a.time + hopSec * 3; t < b.time - hopSec * 2; t += hopSec * 2) {
      novSum += sampleAt(novFull, hopSec, t);
      intSum += sampleAt(intensity, hopSec, t);
      n++;
      if (pitchCurve && pitchCurve.length) {
        const pv = sampleAt(pitchCurve, hopSec, t);
        pSum += pv; pSum2 += pv * pv; pn++;
      }
    }
    if (n < 2) continue;
    const novAvg = novSum / n;
    const intAvg = intSum / n;
    // Desviacion estandar del pitch en el hueco (0 = tono perfectamente estable).
    let pitchStd = 0;
    if (pn >= 2) {
      const mean = pSum / pn;
      pitchStd = Math.sqrt(Math.max(0, pSum2 / pn - mean * mean));
    }

    // Sostenido = poca novedad (sin golpes nuevos) + energia + pitch estable.
    const sustained = novAvg < 0.14 && intAvg > 0.30 && pitchStd < 0.10;
    // Muy claro: tono mantenido y limpio => SIEMPRE hold (determinista).
    const strong = novAvg < 0.08 && intAvg > 0.40 && pitchStd < 0.06;
    if (sustained && (strong || rng() < holdChance)) {
      const dur = Math.min(gap * 0.9, maxHold);
      a.duration = Math.round(dur * 1000) / 1000;
      i++; // saltar la siguiente para no encadenar holds
    }
  }
}

// ---------------- Ritmo VOCAL (densidad de silabas) ----------------
// A partir del flujo de la banda vocal, detecta los ataques de SILABA y mide,
// para cada momento de la cancion, cuantas silabas por segundo hay alrededor.
// Donde el cantante va rapido (rap, canto veloz) la tasa es alta -> permitimos
// mas subdivisiones y metemos notas siguiendo las silabas. Donde no hay voz
// (instrumental), la tasa es ~0 y no afecta nada.
//
// Devuelve:
//   peaks: tiempos (s) de ataque de silaba (picos del flux vocal).
//   rate:  Float32Array por-frame con silabas/seg suavizado (0..~12).
function vocalSyllables(fluxVoc, hopSec, duration) {
  const novVoc = normalizeNovelty(fluxVoc);
  // Picos de silaba: pico local + sobre umbral relativo a la media local.
  const n = novVoc.length;
  const peaks = [];
  const w = 2;                 // ~12ms: las silabas pueden ir muy juntas (rap)
  const wMean = 24;            // ~140ms de media para el umbral
  for (let i = 0; i < n; i++) {
    const v = novVoc[i];
    if (v < 0.10) continue;
    let isMax = true;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      if (j !== i && novVoc[j] > v) { isMax = false; break; }
    }
    if (!isMax) continue;
    let s = 0, c = 0;
    for (let j = Math.max(0, i - wMean); j <= Math.min(n - 1, i + wMean); j++) { s += novVoc[j]; c++; }
    if (v >= s / c + 0.06) peaks.push(i * hopSec);
  }

  // Tasa de silabas/seg en ventana deslizante de ~1s, muestreada por-frame.
  const rate = new Float32Array(n);
  if (peaks.length >= 2) {
    const winSec = 1.0;
    let lo = 0, hi = 0;
    for (let f = 0; f < n; f++) {
      const t = f * hopSec;
      while (hi < peaks.length && peaks[hi] <= t + winSec / 2) hi++;
      while (lo < peaks.length && peaks[lo] < t - winSec / 2) lo++;
      rate[f] = (hi - lo) / winSec;   // silabas por segundo alrededor de t
    }
  }
  return { peaks, novVoc, rate };
}

// Tasa de silabas/seg en un tiempo dado (con suavizado por la propia ventana).
function vocalRateAt(rate, hopSec, t) {
  const idx = Math.round(t / hopSec);
  if (idx < 0 || idx >= rate.length) return 0;
  return rate[idx];
}

// Nivel de subdivision de una celda: 1 (negra), 2 (corchea), 4, 8...
function subdivisionLevel(cellIndex, maxSubdiv) {
  if (cellIndex % maxSubdiv === 0) return 1;
  for (let s = 2; s <= maxSubdiv; s *= 2) {
    if (cellIndex % (maxSubdiv / s) === 0) return s;
  }
  return maxSubdiv;
}

// Nivel de subdivision de una celda de la rejilla por-beats. La rejilla tiene
// 'maxSubdiv' celdas por beat; la posicion dentro del beat (0..maxSubdiv-1)
// define el nivel: pos 0 = negra(1), mitad = corchea(2), cuartos = 4, etc.
function subdivisionOfGridIndex(gi, grid, maxSubdiv) {
  // Contar cuantas celdas van desde el ultimo beat (isBeat=true) hasta gi.
  let pos = 0;
  for (let k = gi; k >= 0; k--) { if (grid.isBeat[k]) { pos = gi - k; break; } }
  if (pos === 0) return 1;
  return subdivisionLevel(pos, maxSubdiv);
}

// Subdivision maxima permitida segun intensidad (0..1), dificultad y, si hay,
// el ritmo VOCAL (silabas/seg). En partes de voz rapida (rap/canto veloz)
// subimos la subdivision permitida para que las notas sigan las silabas.
function allowedSubdivForIntensity(inten, cfg, genrePreset, vocRate = 0, buildup = 0) {
  const maxSubdiv = Math.max(cfg.baseSubdiv, genrePreset.maxSubdiv);
  const scaled = Math.min(1, inten * cfg.densityScale * genrePreset.burst);
  let allowed = cfg.baseSubdiv;
  if (scaled > 0.3) allowed = Math.max(allowed, 2);
  if (scaled > 0.55) allowed = Math.max(allowed, 4);
  if (scaled > 0.8) allowed = Math.max(allowed, 8);
  // Empuje VOCAL: si la voz va rapida, permite subdivisiones mas finas aunque
  // la energia instrumental sea moderada (el rap suele tener bajo constante).
  //   >4 silabas/s -> al menos corcheas; >6 -> semicorcheas; >9 -> fusas.
  if (vocRate > 4) allowed = Math.max(allowed, 2);
  if (vocRate > 6) allowed = Math.max(allowed, 4);
  if (vocRate > 9) allowed = Math.max(allowed, 8);
  // Empuje de BUILD-UP: en la rampa hacia el drop subimos la subdivision para
  // el clasico aumento progresivo de notas (riser/snare-roll).
  if (buildup > 0.35) allowed = Math.max(allowed, 4);
  if (buildup > 0.7) allowed = Math.max(allowed, 8);
  return Math.min(allowed, maxSubdiv);
}

// Rellena patrones ritmicos CONSTANTES (galops continuos, como Csikos Post).
// Detecta ventanas con flujo ritmico parejo y completa las celdas faltantes
// a la SUBDIVISION propia de la dificultad, para que el patron sea consistente
// y al ritmo (no salteado/aleatorio). Asi Facil sigue el pulso en negras y las
// dificultades altas en corcheas/semicorcheas.
function fillSteadyStreams(events, cells, offset, duration, beatSec, cutoff, minGap, cfg) {
  // Subdivision de relleno por dificultad (cuantas notas por beat en zonas
  // de patron constante). Esto define que tan "lleno" queda el galop.
  //   fillSub: 1=negras, 2=corcheas, 4=semicorcheas.
  let fillSub;
  if (cfg.densityScale <= 0.45) fillSub = 2;          // easy: corcheas (maxNPS lo limita)
  else if (cfg.densityScale <= 0.7) fillSub = 4;      // normal: semicorcheas (maxNPS limita)
  else if (cfg.densityScale <= 0.9) fillSub = 4;      // ritmo: semicorcheas
  else fillSub = 4;                                    // hard/expert/locura: semicorcheas

  const cellDur = beatSec / fillSub;
  // Energia de la celda mas cercana en la rejilla de analisis (corcheas).
  const eighth = beatSec / 2;
  const cellByEighth = new Map();
  for (const c of cells) cellByEighth.set(Math.round(c.time / eighth), c);
  const energyNear = (t) => {
    const c = cellByEighth.get(Math.round(t / eighth));
    return c ? c.e : 0;
  };

  const have = new Set(events.map((e) => Math.round(e.time / cellDur)));
  const fillFloor = cutoff * 0.5;
  const winBeats = 2;                          // ventana ~medio compas
  const winCells = winBeats * fillSub;

  const startK = Math.ceil(offset / cellDur);
  const endK = Math.floor(duration / cellDur);
  const additions = [];

  for (let k0 = startK; k0 < endK; k0 += winCells) {
    // ¿La ventana es un flujo constante? Medimos cuantas celdas tienen energia.
    let active = 0, total = 0;
    for (let k = k0; k < k0 + winCells && k < endK; k++) {
      total++;
      if (energyNear(k * cellDur) >= fillFloor) active++;
    }
    if (total > 0 && active / total >= 0.55) {
      // Rellenar TODAS las celdas de la subdivision en esta ventana (patron
      // continuo y al ritmo), si tienen algo de energia.
      for (let k = k0; k < k0 + winCells && k < endK; k++) {
        if (have.has(k)) continue;
        const t = k * cellDur;
        if (t < offset) continue;
        const e = energyNear(t);
        if (e >= fillFloor * 0.6) {
          additions.push({ time: t, strength: Math.max(e, 0.25), downbeat: false, intensity: 0.6 });
          have.add(k);
        }
      }
    }
  }

  if (additions.length) {
    events.push(...additions);
    events.sort((a, b) => a.time - b.time);
    // Dedup respetando la separacion minima de la subdivision de relleno.
    const gap = Math.min(minGap, cellDur * 0.9);
    const out = [];
    let pt = -Infinity;
    for (const ev of events) { if (ev.time - pt >= gap) { out.push(ev); pt = ev.time; } }
    events.length = 0;
    events.push(...out);
  }
}

// Rellena notas siguiendo las SILABAS de la voz en partes de canto/rap rapido.
// Para cada pico de silaba en un tramo donde la tasa vocal es alta, coloca una
// nota cuantizada a la rejilla de la dificultad (corcheas/semicorcheas/fusas
// segun la velocidad), respetando la separacion minima. No toca instrumentales
// (donde no hay voz, vocPeaks/vocRate son ~0, asi que no añade nada).
function fillVocalSyllables(events, p) {
  const { offset, duration, beatSec, maxSubdiv, minGap, cfg, vocPeaks, vocRate, hopSec } = p;
  if (!vocPeaks || vocPeaks.length === 0 || !vocRate) return;

  // Solo dificultades media+ reciben relleno vocal denso (en facil saturaria).
  const minRate = cfg.densityScale >= 1.0 ? 3.5      // hard/expert/locura
                : cfg.densityScale >= 0.6 ? 4.5      // normal/ritmo
                : 99;                                 // easy: nada
  if (minRate > 50) return;

  // Resolucion de cuantizacion segun la velocidad vocal (mas rapido = mas fino).
  const have = new Set(events.map((e) => Math.round(e.time / (beatSec / maxSubdiv))));
  const additions = [];

  for (const pt of vocPeaks) {
    if (pt < offset || pt >= duration) continue;
    const vr = vocalRateAt(vocRate, hopSec, pt);
    if (vr < minRate) continue;

    // Subdivision objetivo segun velocidad de la voz (acotada por la dificultad).
    let sub = vr > 9 ? 8 : vr > 6 ? 4 : 2;
    sub = Math.min(sub, maxSubdiv);
    const cell = beatSec / sub;
    // Cuantizar el pico de silaba a la celda de rejilla mas cercana.
    const k = Math.round((pt - offset) / cell);
    const qt = offset + k * cell;
    if (qt < offset || qt >= duration) continue;

    const key = Math.round(qt / (beatSec / maxSubdiv));
    if (have.has(key)) continue;
    have.add(key);
    // strength moderada: la voz no es un golpe percusivo fuerte, pero marca ritmo.
    additions.push({ time: qt, strength: 0.4, downbeat: false, intensity: 0.7, vocal: true });
  }

  if (additions.length) {
    events.push(...additions);
    events.sort((a, b) => a.time - b.time);
    // Dedup respetando separacion minima (conserva el de mayor fuerza/downbeat).
    const out = [];
    let last = null;
    for (const ev of events) {
      if (last && ev.time - last.time < minGap) {
        const keepNew = (ev.downbeat && !last.downbeat) || ((ev.strength || 0) > (last.strength || 0) && !last.downbeat);
        if (keepNew) { out[out.length - 1] = ev; last = ev; }
      } else { out.push(ev); last = ev; }
    }
    events.length = 0;
    events.push(...out);
  }
}

// Limita la densidad a maxNPS notas/segundo. Divide la cancion en ventanas
// fijas; si una ventana excede el tope, elimina las notas mas debiles
// (conservando downbeats y golpes fuertes). Define la dificultad real de pisar
// de forma consistente entre canciones, sin importar el BPM.
function limitDensity(events, maxNPS) {
  if (events.length === 0) return;
  // Ventana de 2s: permite densidades fraccionarias (p.ej. 3.3/s = 7 en 2s),
  // asi se distinguen bien dificultades cercanas (easy 2.0 vs normal 3.3).
  const win = 2.0;
  const allowed = Math.max(1, Math.round(maxNPS * win));
  const toRemove = new Set();

  const buckets = new Map();
  for (let k = 0; k < events.length; k++) {
    const w = Math.floor(events[k].time / win);
    if (!buckets.has(w)) buckets.set(w, []);
    buckets.get(w).push(k);
  }
  for (const idxs of buckets.values()) {
    if (idxs.length <= allowed) continue;
    // Conservar SIEMPRE downbeats y los golpes fuertes; del resto, repartir
    // uniformemente en el tiempo para no dejar huecos ni amontonar.
    const sortedByTime = [...idxs].sort((a, b) => events[a].time - events[b].time);
    const must = sortedByTime.filter((k) => events[k].downbeat);
    const rest = sortedByTime.filter((k) => !events[k].downbeat);
    const slots = Math.max(0, allowed - must.length);
    const keep = new Set(must);
    if (slots > 0 && rest.length > 0) {
      // muestreo uniforme de 'rest' para llenar los huecos restantes
      const stepF = rest.length / slots;
      for (let s = 0; s < slots; s++) keep.add(rest[Math.floor(s * stepF)]);
    }
    for (const k of idxs) if (!keep.has(k)) toRemove.add(k);
  }
  if (toRemove.size) {
    const kept = events.filter((_, k) => !toRemove.has(k));
    events.length = 0;
    events.push(...kept);
  }
}

// Convierte la "escala de densidad" de cada dificultad en notas-por-segundo
// objetivo. Esto define cuantas notas tendra la pista independientemente de si
// la cancion tiene bateria marcada o no (orquestal, jazz, etc.). Es el "techo"
// promedio; las partes intensas concentran mas notas y las suaves menos.
function densityScaleToNPS(densityScale) {
  // densityScale: easy .40, normal .60, ritmo .85, hard 1.0, expert 1.3, locura 1.04
  // Mapeo a notas/seg promedio. Antes era 0.9 + scale*2.6 (hard ~3.5/s), lo
  // que hacia que "dificil" se sintiera FACIL: la densidad base quedaba muy por
  // debajo del tope (maxNPS 6.5). Ahora nps = scale*5.0, que da una progresion
  // clara y deja la densidad base justo debajo del tope de cada dificultad:
  //   easy ~2.0/s, normal ~3.0/s, ritmo ~4.25/s, hard ~5.0/s, expert ~6.5/s.
  return densityScale * 5.0;
}

// Garantiza un pulso minimo si una zona quedo demasiado vacia.
function ensurePulse(events, offset, duration, beatSec, novLow, hopSec, minGap) {
  if (events.length >= duration * 0.6) return;
  const have = new Set(events.map((e) => Math.round(e.time / (beatSec / 8))));
  for (let t = offset; t < duration; t += beatSec) {
    if (t < 0) continue;
    const key = Math.round(t / (beatSec / 8));
    if (have.has(key)) continue;
    const e = energyAt(novLow, hopSec, t, 8);
    if (e > 0.12) events.push({ time: t, strength: Math.max(e, 0.3), downbeat: true, intensity: 0.5 });
  }
  events.sort((a, b) => a.time - b.time);
  const out = [];
  let pt = -Infinity;
  for (const ev of events) { if (ev.time - pt >= minGap) { out.push(ev); pt = ev.time; } }
  events.length = 0;
  events.push(...out);
}

/**
 * Genera la pista (beatmap) sincronizada al ritmo.
 * @param {Float32Array} samples - PCM mono
 * @param {number} sampleRate
 * @param {Object} opts
 * @param {string} opts.difficulty - easy|normal|hard|expert
 * @param {number} opts.laneCount - 5 (PIU) o 4 (DDR)
 * @param {(p:number,label:string)=>void} [opts.onProgress]
 * @returns {{ bpm:number, offset:number, duration:number, laneCount:number, notes:Array<{time,lane}> }}
 */
export function generateBeatmap(samples, sampleRate, opts = {}) {
  const { difficulty = "normal", laneCount = 5, genre = "auto", introFree = 8, npsOverride = null, onProgress = () => {} } = opts;
  const duration = samples.length / sampleRate;

  // Sembrar el RNG con una huella del audio: chart REPRODUCIBLE por cancion.
  rng = mulberry32(audioSeed(samples) ^ (laneCount * 2654435761) ^ hashStr(String(difficulty)));

  onProgress(0.2, "Analizando espectro");
  const bands = onsetEnvelope(samples, sampleRate);
  const hopSec = bands.hopSec;
  const novelty = normalizeNovelty(bands.flux);     // combinada (para BPM/fase)
  const novLow = normalizeNovelty(bands.fluxLow);   // bajo (pulso/downbeats)
  const novHigh = normalizeNovelty(bands.fluxHigh); // agudos (hats/subdivisiones)
  const novCym = normalizeNovelty(bands.fluxCym);   // platillos crash/ride (acentos)
  const novFull = novelty;

  // Ritmo VOCAL: silabas/seg a lo largo de la cancion. En partes de voz rapida
  // (rap/canto veloz) metemos mas notas siguiendo las silabas. En instrumental
  // la tasa es ~0 y no afecta. (bands.fluxVoc = banda 300-3000 Hz.)
  const voc = vocalSyllables(bands.fluxVoc, hopSec, duration);

  // Contorno MELODICO: pitch normalizado 0..1 por frame (centroide espectral).
  const pitchCurve = computePitchCurve(bands.centroidHz, bands.melEnergy, hopSec);

  onProgress(0.45, "Midiendo intensidad");
  const intensity = intensityEnvelope(samples, sampleRate);
  // Estructura: rampas de build-up hacia drops (para acelerar densidad).
  const buildup = analyzeStructure(intensity, hopSec);

  // Auto-deteccion de genero si el usuario no eligio uno.
  const effectiveGenre = genre === "auto" ? detectGenre(bands, intensity) : genre;

  onProgress(0.55, "Detectando BPM");
  const bpm = estimateBPM(novelty, hopSec);

  onProgress(0.65, "Alineando beats");
  // La fase se ancla al BAJO (kick), que define el pulso con mas fiabilidad.
  const offset = estimatePhase(novLow, hopSec, bpm);

  // Seguimiento de beats por programacion dinamica: secuencia de tiempos de
  // beat que siguen los onsets reales (tolera variaciones de tempo). Se usa
  // para construir la rejilla, asi las notas caen sobre la musica real.
  // Usamos la novedad combinada (mejor cobertura que solo el bajo).
  const beats = trackBeats(novelty, hopSec, bpm);

  onProgress(0.8, "Colocando notas en la rejilla");
  const beatSec = 60 / bpm;

  // Preset de genero: controla COMO reacciona la densidad a la intensidad.
  //  - maxSubdiv: subdivision maxima en las partes mas intensas (drops).
  //  - burst: cuanto se permite rellenar subdivisiones rapidas en lo intenso.
  //  - useHighForSub: si los agudos (hats) guian las subdivisiones (electronica).
  //  - intensityPow: curva (>1 exagera la diferencia entre suave y drop).
  const genrePreset = {
    auto:       { maxSubdiv: 4, burst: 1.0, useHighForSub: true,  intensityPow: 1.0, jumpBias: 1.0 },
    electronic: { maxSubdiv: 8, burst: 1.6, useHighForSub: true,  intensityPow: 1.4, jumpBias: 1.0 },
    rock:       { maxSubdiv: 4, burst: 1.1, useHighForSub: false, intensityPow: 1.0, jumpBias: 1.1 },
    pop:        { maxSubdiv: 4, burst: 1.0, useHighForSub: true,  intensityPow: 1.0, jumpBias: 1.0 },
    // clasica/orquestal: las dobles acentuan muy bien el caracter sinfonico,
    // asi que generamos bastantes mas (galops como Csikos Post quedan genial).
    classical:  { maxSubdiv: 3, burst: 0.8, useHighForSub: false, intensityPow: 0.8, jumpBias: 1.9, npsBias: 1.6 },
    hiphop:     { maxSubdiv: 4, burst: 1.0, useHighForSub: false, intensityPow: 1.1, jumpBias: 0.9, npsBias: 1.0 },
  }[effectiveGenre] || { maxSubdiv: 4, burst: 1.0, useHighForSub: true, intensityPow: 1.0, jumpBias: 1.0, npsBias: 1.0 };

  // Config base por dificultad: subdivision MINIMA y umbral de energia.
  // La subdivision real sube hasta maxSubdiv segun la intensidad de la seccion.
  // maxJump = maximo de flechas simultaneas (jumps) en esa dificultad.
  //   autoSpeed  = la velocidad de scroll se modula sola con el ritmo (cliente).
  //   autoEffects= efectos (vanish/tornado/etc.) se activan/desactivan solos.
  const cfg = {
    // Progresion suave de densidad. maxNPS = tope de notas/segundo en las
    // partes mas densas (define la dificultad REAL de pisar, independiente del
    // BPM: una cancion rapida ya no se vuelve imposible de golpe).
    easy:   { baseSubdiv: 1, energy: 0.24, maxJacks: 0, densityScale: 0.40, maxJump: 2, jumpScale: 0.28, maxNPS: 2.0 },
    normal: { baseSubdiv: 2, energy: 0.18, maxJacks: 1, densityScale: 0.60, maxJump: 2, jumpScale: 0.56, maxNPS: 3.3 },
    // ritmo: entre normal y dificil; la velocidad se ajusta sola con la cancion.
    ritmo:  { baseSubdiv: 2, energy: 0.14, maxJacks: 1, densityScale: 0.85, maxJump: 3, jumpScale: 0.85, autoSpeed: true, maxNPS: 4.5 },
    hard:   { baseSubdiv: 2, energy: 0.12, maxJacks: 2, densityScale: 1.0,  maxJump: 3, jumpScale: 1.1, maxNPS: 6.5 },
    expert: { baseSubdiv: 4, energy: 0.08, maxJacks: 3, densityScale: 1.3,  maxJump: laneCount, jumpScale: 1.5, maxNPS: 9.0 },
    // locura: por encima de experto pero ~20% menos densa; efectos y velocidad
    // se activan/cambian solos durante la partida segun el ritmo.
    locura: { baseSubdiv: 4, energy: 0.10, maxJacks: 3, densityScale: 1.04, maxJump: laneCount, jumpScale: 1.2, autoSpeed: true, autoEffects: true, maxNPS: 7.5 },
  }[difficulty] || { baseSubdiv: 2, energy: 0.15, maxJacks: 1, densityScale: 0.75, maxJump: 2, jumpScale: 0.7, maxNPS: 4.5 };

  // Ajuste de densidad por genero. Para CLASICA/orquestal ritmica (galops como
  // Csikos Post) subimos el tope en dificultades bajas a valores concretos
  // (Facil ~4, Normal ~5 pisadas/s), que es como se siente bien esa musica.
  const cfg2 = { ...cfg };
  if (effectiveGenre === "classical") {
    const clsNPS = { easy: 3.5, normal: 4.2, ritmo: 5.5, hard: 7.0, expert: 9.5, locura: 8.0 };
    if (clsNPS[difficulty]) cfg2.maxNPS = clsNPS[difficulty];
    // Subir tambien la densidad de GENERACION en dificultades bajas, para que
    // haya suficientes notas que el tope (maxNPS) pueda conservar.
    const clsScale = { easy: 0.7, normal: 0.95, ritmo: 1.0 };
    if (clsScale[difficulty]) cfg2.densityScale = Math.max(cfg.densityScale, clsScale[difficulty]);
  } else if (genrePreset.npsBias && genrePreset.npsBias !== 1) {
    cfg2.maxNPS = cfg.maxNPS * genrePreset.npsBias;
  }
  // Override por cancion (configurado por el usuario): manda sobre todo lo demas.
  if (npsOverride && npsOverride > 0) {
    cfg2.maxNPS = npsOverride;
    // asegurar densidad de generacion suficiente para alcanzar el override
    cfg2.densityScale = Math.max(cfg2.densityScale, Math.min(1.3, npsOverride / 6));
  }

  const events = placeNotesByIntensity({
    duration, offset, beatSec, hopSec,
    novLow, novHigh, novFull, novCym, intensity, cfg: cfg2, genrePreset, beats,
    novVoc: voc.novVoc, vocPeaks: voc.peaks, vocRate: voc.rate, pitchCurve, buildup,
  });

  let notes = assignLanes(events, laneCount, cfg.maxJacks, cfg.maxJump, cfg.jumpScale * (genrePreset.jumpBias || 1));

  // Intro sin notas: los primeros 'introFree' segundos de la cancion suenan
  // como entrada/calentamiento sin que aparezcan teclas.
  if (introFree > 0) {
    notes = notes.filter((n) => n.time >= introFree);
  }

  // Linea de intensidad downsampleada (un valor cada 0.25s) para que el cliente
  // module velocidad y efectos en vivo en las dificultades "ritmo" y "locura".
  const step = 0.25;
  const intensityTimeline = [];
  for (let t = 0; t < duration; t += step) {
    intensityTimeline.push(Math.round(sampleAt(intensity, hopSec, t) * 100) / 100);
  }

  onProgress(1.0, "Pista lista");
  return {
    bpm, offset: Math.round(offset * 1000) / 1000, duration, laneCount,
    genre: effectiveGenre, introFree, notes,
    autoSpeed: !!cfg.autoSpeed,
    autoEffects: !!cfg.autoEffects,
    intensityStep: step,
    intensityTimeline,
  };
}
