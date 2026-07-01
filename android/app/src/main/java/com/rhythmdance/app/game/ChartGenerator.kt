package com.rhythmdance.app.game

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt
import kotlin.math.PI

// Genera una pista (Chart) a partir del audio decodificado, sincronizada al
// ritmo. Pipeline (version nativa, inspirada en el generador web):
//   1. STFT -> envolvente de novedad espectral (spectral flux).
//   2. Deteccion de picos de onset.
//   3. Estimacion de BPM por autocorrelacion de la novedad.
//   4. Colocacion de notas en una rejilla de beats, con densidad por dificultad
//      y por intensidad local; reparto de carriles evitando repeticiones.
object ChartGenerator {

    data class Difficulty(
        val name: String,
        val maxNps: Double,     // tope de notas por segundo
        val subdiv: Int,        // subdivisiones por beat (1=negras, 2=corcheas, 4=semis)
        val jumpChance: Double, // prob. de nota doble en acentos
    )

    val DIFFICULTIES = listOf(
        Difficulty("Fácil", 2.0, 1, 0.0),
        Difficulty("Normal", 3.3, 2, 0.10),
        Difficulty("Difícil", 5.0, 2, 0.28),
        Difficulty("Experto", 6.5, 4, 0.45),
    )

    private const val FFT = 1024
    private const val HOP = 512
    private const val STEP_MODEL_WEIGHT = 0.5   // peso del prior de IA (mezcla con heuristica)

    fun generate(audio: DecodedAudio, laneCount: Int, diff: Difficulty, introFreeSec: Double = 6.0, stepModel: StepModel? = null): Chart {
        val sr = audio.sampleRate
        val x = audio.samples
        val hopSec = HOP.toDouble() / sr

        val an = analyze(x)
        val novelty = an.novelty
        val peaks = detectPeaks(novelty)
        val bpm = estimateBpm(novelty, hopSec)
        val beatSec = 60.0 / bpm
        val offset = estimateOffset(peaks, hopSec, beatSec)
        val pitchCurve = computePitchCurve(an.centroidHz, an.melEnergy)

        val duration = audio.durationSec
        val notes = placeNotes(novelty, peaks, an, pitchCurve, hopSec, bpm, offset, duration, laneCount, diff, introFreeSec, stepModel)
        return Chart(notes, bpm, duration, laneCount)
    }

    // Resultado del analisis espectral por frame.
    class Analysis(
        val novelty: FloatArray,
        val centroidHz: FloatArray,   // "altura tonal" por frame (contorno melodico)
        val melEnergy: FloatArray,    // energia melodica lineal (150-4000 Hz)
        val lowE: FloatArray,         // energia banda baja (bombo) por frame
        val highE: FloatArray,        // energia banda alta (hats/agudos) por frame
    )

    // ---------- STFT + spectral flux + centroide + bandas ----------
    private fun analyze(x: FloatArray): Analysis {
        val win = hann(FFT)
        val frames = max(0, (x.size - FFT) / HOP + 1)
        if (frames <= 1) return Analysis(FloatArray(0), FloatArray(0), FloatArray(0), FloatArray(0), FloatArray(0))
        val prevMag = FloatArray(FFT / 2)
        val curMag = FloatArray(FFT / 2)
        val nov = FloatArray(frames)
        val centroid = FloatArray(frames)
        val melE = FloatArray(frames)
        val lowE = FloatArray(frames)
        val highE = FloatArray(frames)
        val re = FloatArray(FFT)
        val im = FloatArray(FFT)
        // Frecuencia por bin: sr/FFT. Asumimos sr=44100 para los limites (aprox).
        val binHz = 44100.0 / FFT
        val lowMax = min(FFT / 2, (150.0 / binHz).toInt())
        val melLo = min(FFT / 2, (150.0 / binHz).toInt())
        val melHi = min(FFT / 2, (4000.0 / binHz).toInt())
        val highMin = min(FFT / 2, (2000.0 / binHz).toInt())

        for (f in 0 until frames) {
            val start = f * HOP
            for (i in 0 until FFT) { re[i] = x[start + i] * win[i]; im[i] = 0f }
            fft(re, im)
            var cNum = 0.0; var cDen = 0.0; var lo = 0.0; var hi = 0.0
            for (i in 0 until FFT / 2) {
                val lin = sqrt(re[i] * re[i] + im[i] * im[i])
                curMag[i] = ln(1f + lin)
                if (i < lowMax) lo += lin
                if (i >= highMin) hi += lin
                if (i in melLo until melHi) { cNum += lin * (i * binHz); cDen += lin }
            }
            centroid[f] = if (cDen > 1e-9) (cNum / cDen).toFloat() else 0f
            melE[f] = cDen.toFloat()
            lowE[f] = lo.toFloat()
            highE[f] = hi.toFloat()
            if (f > 0) {
                var sum = 0f
                for (i in 0 until FFT / 2) { val d = curMag[i] - prevMag[i]; if (d > 0) sum += d }
                nov[f] = sum
            }
            System.arraycopy(curMag, 0, prevMag, 0, FFT / 2)
        }
        var mx = 0f
        for (v in nov) if (v > mx) mx = v
        if (mx > 0) for (i in nov.indices) nov[i] /= mx
        return Analysis(smooth(nov, 2), centroid, melE, lowE, highE)
    }

    // Curva de PITCH normalizada 0..1 (contorno melodico) a partir del centroide,
    // en escala log y por percentiles de la cancion (se adapta a su tesitura).
    private fun computePitchCurve(centroidHz: FloatArray, melEnergy: FloatArray): FloatArray {
        val n = centroidHz.size
        val out = FloatArray(n)
        if (n == 0) return out
        val meSorted = melEnergy.sortedArray()
        val meThr = (if (meSorted.isNotEmpty()) meSorted[(n * 0.4).toInt().coerceIn(0, n - 1)] else 0f) * 0.5f + 1e-9f
        val logs = ArrayList<Double>()
        for (i in 0 until n) if (melEnergy[i] >= meThr && centroidHz[i] > 1f) logs.add(ln(centroidHz[i].toDouble()))
        if (logs.size < 8) return out
        logs.sort()
        val p5 = logs[(logs.size * 0.05).toInt()]
        val p95 = logs[(logs.size * 0.95).toInt()]
        val span = max(1e-3, p95 - p5)
        var last = 0.5f
        for (i in 0 until n) {
            if (melEnergy[i] >= meThr && centroidHz[i] > 1f) {
                last = ((ln(centroidHz[i].toDouble()) - p5) / span).toFloat().coerceIn(0f, 1f)
            }
            out[i] = last
        }
        return smooth(out, 4)
    }

    private fun hann(n: Int): FloatArray {
        val w = FloatArray(n)
        for (i in 0 until n) w[i] = (0.5 * (1 - cos(2 * PI * i / (n - 1)))).toFloat()
        return w
    }

    private fun smooth(a: FloatArray, radius: Int): FloatArray {
        if (radius <= 0 || a.isEmpty()) return a
        val out = FloatArray(a.size)
        for (i in a.indices) {
            var s = 0f; var c = 0
            for (j in -radius..radius) {
                val k = i + j
                if (k in a.indices) { s += a[k]; c++ }
            }
            out[i] = s / c
        }
        return out
    }

    // FFT iterativa radix-2 in-place (n potencia de 2).
    private fun fft(re: FloatArray, im: FloatArray) {
        val n = re.size
        var j = 0
        for (i in 1 until n) {
            var bit = n shr 1
            while (j and bit != 0) { j = j xor bit; bit = bit shr 1 }
            j = j or bit
            if (i < j) { val tr = re[i]; re[i] = re[j]; re[j] = tr; val ti = im[i]; im[i] = im[j]; im[j] = ti }
        }
        var len = 2
        while (len <= n) {
            val ang = -2.0 * PI / len
            val wr = cos(ang).toFloat(); val wi = kotlin.math.sin(ang).toFloat()
            var i = 0
            while (i < n) {
                var cwr = 1f; var cwi = 0f
                for (k in 0 until len / 2) {
                    val uRe = re[i + k]; val uIm = im[i + k]
                    val vRe = re[i + k + len / 2] * cwr - im[i + k + len / 2] * cwi
                    val vIm = re[i + k + len / 2] * cwi + im[i + k + len / 2] * cwr
                    re[i + k] = uRe + vRe; im[i + k] = uIm + vIm
                    re[i + k + len / 2] = uRe - vRe; im[i + k + len / 2] = uIm - vIm
                    val nwr = cwr * wr - cwi * wi; cwi = cwr * wi + cwi * wr; cwr = nwr
                }
                i += len
            }
            len = len shl 1
        }
    }

    // ---------- Picos de onset ----------
    private fun detectPeaks(nov: FloatArray): BooleanArray {
        val peaks = BooleanArray(nov.size)
        val w = 3
        for (i in w until nov.size - w) {
            val v = nov[i]
            if (v < 0.08f) continue
            var isMax = true
            for (j in -w..w) { if (j != 0 && nov[i + j] > v) { isMax = false; break } }
            if (!isMax) continue
            // umbral local
            var mean = 0f
            for (j in -8..8) { val k = i + j; if (k in nov.indices) mean += nov[k] }
            mean /= 17f
            if (v >= mean * 1.3f) peaks[i] = true
        }
        return peaks
    }

    // ---------- Estimacion de BPM ----------
    private fun estimateBpm(nov: FloatArray, hopSec: Double): Double {
        if (nov.size < 8) return 120.0
        val minBpm = 70.0; val maxBpm = 190.0
        val minLag = (60.0 / maxBpm / hopSec).toInt().coerceAtLeast(1)
        val maxLag = (60.0 / minBpm / hopSec).toInt().coerceAtMost(nov.size - 1)
        var bestLag = minLag; var bestScore = -1.0
        for (lag in minLag..maxLag) {
            var s = 0.0
            var i = lag
            while (i < nov.size) { s += nov[i] * nov[i - lag]; i++ }
            // prior: favorecer tempos cercanos a 120
            val bpm = 60.0 / (lag * hopSec)
            val prior = 1.0 - abs(ln(bpm / 125.0)) * 0.2
            val score = s * max(0.5, prior)
            if (score > bestScore) { bestScore = score; bestLag = lag }
        }
        var bpm = 60.0 / (bestLag * hopSec)
        // Normalizar a rango comodo
        while (bpm < 90) bpm *= 2
        while (bpm > 200) bpm /= 2
        return bpm
    }

    private fun estimateOffset(peaks: BooleanArray, hopSec: Double, beatSec: Double): Double {
        // Tomar el primer pico fuerte como referencia de fase.
        for (i in peaks.indices) if (peaks[i]) return (i * hopSec) % beatSec
        return 0.0
    }

    private fun energyAt(nov: FloatArray, hopSec: Double, t: Double, radius: Int): Float {
        val idx = (t / hopSec).toInt()
        var mx = 0f
        for (j in -radius..radius) { val k = idx + j; if (k in nov.indices && nov[k] > mx) mx = nov[k] }
        return mx
    }

    private fun nearestPeak(peaks: BooleanArray, hopSec: Double, t: Double, tolSec: Double): Double {
        val idx = (t / hopSec).toInt()
        val tol = (tolSec / hopSec).toInt()
        var best = -1; var bestD = Int.MAX_VALUE
        for (j in -tol..tol) {
            val k = idx + j
            if (k in peaks.indices && peaks[k]) { val d = abs(j); if (d < bestD) { bestD = d; best = k } }
        }
        return if (best >= 0) best * hopSec else -1.0
    }

    // ---------- Colocacion de notas ----------
    private fun placeNotes(
        nov: FloatArray, peaks: BooleanArray, an: Analysis, pitchCurve: FloatArray, hopSec: Double,
        bpm: Double, offset: Double, duration: Double,
        laneCount: Int, diff: Difficulty, introFreeSec: Double,
        stepModel: StepModel?,
    ): List<Note> {
        val beatSec = 60.0 / bpm
        val cellSec = beatSec / diff.subdiv
        val notes = ArrayList<Note>()
        var lastLane = -1
        val center = (laneCount - 1) / 2.0
        var foot = 0   // -1 izq, +1 der, 0 neutro
        val laneUsage = IntArray(laneCount)
        // "Soltura" por dificultad (easy estricto, experto suelto), por maxNps.
        val looseness = ((diff.maxNps - 2.0) / 4.5).coerceIn(0.0, 1.0)
        fun sampleAt(a: FloatArray, t: Double): Float { val i = (t / hopSec).toInt(); return if (i in a.indices) a[i] else 0f }

        data class Cell(val t: Double, val e: Float, val onBeat: Boolean)
        val cells = ArrayList<Cell>()
        var k = 0
        var t = offset
        while (t < duration) {
            val onBeat = (k % diff.subdiv == 0)
            val e = energyAt(nov, hopSec, t, 3)
            cells.add(Cell(t, e, onBeat))
            k++
            t = offset + k * cellSec
        }
        if (cells.isEmpty()) return notes

        val targetCount = (diff.maxNps * max(1.0, duration - introFreeSec)).toInt()
        val sortedE = cells.map { it.e }.sortedDescending()
        val cutIdx = min(sortedE.size - 1, max(0, targetCount - 1))
        var cutoff = if (sortedE.isNotEmpty()) sortedE[cutIdx] else 0f
        val maxE = if (sortedE.isNotEmpty()) sortedE[0] else 0f
        val floor = maxE * 0.16f
        if (cutoff < floor) cutoff = floor

        // DENSIDAD POR SECCIONES: envolvente de energia lenta (~3s) normalizada.
        // En secciones intensas (coro/drop) bajamos el umbral -> mas notas; en
        // secciones suaves (intro/verso) lo subimos -> menos notas. Asi el mapa
        // "respira" como la cancion en vez de densidad plana.
        val secRadius = max(1, (3.0 / hopSec).toInt())
        val secEnv = smooth(nov, secRadius)
        var secMax = 0f; for (v in secEnv) if (v > secMax) secMax = v
        fun sectionEnergy(t: Double): Float { val v = sampleAt(secEnv, t); return if (secMax > 1e-6f) (v / secMax) else 0.5f }

        var lastTime = -10.0
        val minGap = cellSec * 0.85
        var prevT = -1e9
        var last2Lane = -1; var last3Lane = -1; var last4Lane = -1; var last5Lane = -1; var prevWasJump = false
        val rnd = java.util.Random(1234)
        for (c in cells) {
            if (c.t < introFreeSec) continue
            // Umbral local modulado por la energia de la seccion (coro<verso).
            val se = sectionEnergy(c.t)
            val localCut = cutoff * (1.25f - 0.5f * se)
            val passes = c.e >= localCut || (c.onBeat && c.e >= localCut * 0.5f)
            if (!passes) continue
            if (c.t - lastTime < minGap) continue
            val snapped = nearestPeak(peaks, hopSec, c.t, min(0.045, cellSec * 0.5))
            val noteTime = if (snapped >= 0) snapped else c.t

            // VOZ dominante (instrumento) en esta celda: bombo (low) vs hat (high).
            val lo = sampleAt(an.lowE, c.t); val hi = sampleAt(an.highE, c.t)
            val voice = if (lo >= hi) "kick" else "hat"
            val pitch = sampleAt(pitchCurve, c.t).toDouble()
            val gap = c.t - prevT
            // Posicion dentro del compas (0..1) para el modelo.
            var beatPos = (c.t - offset) / beatSec
            beatPos = ((beatPos % 4.0) + 4.0) % 4.0
            val beatInBar = beatPos / 4.0

            val lane = pickLane(laneCount, lastLane, foot, c.onBeat, pitch, voice, gap, looseness, center, laneUsage,
                last2Lane, last3Lane, beatInBar, prevWasJump, c.e.toDouble(), stepModel, last4Lane, last5Lane)
            notes.add(Note(noteTime, lane))
            laneUsage[lane]++
            last5Lane = last4Lane; last4Lane = last3Lane; last3Lane = last2Lane; last2Lane = lastLane; lastLane = lane
            prevWasJump = false
            val side = if (lane < center) -1 else if (lane > center) 1 else 0
            if (side != 0) foot = side
            lastTime = c.t
            prevT = c.t

            // Nota doble (jump) en acentos fuertes. La 2a nota la elige el MODELO
            // (mejor carril != lane segun el contexto) si esta disponible; si no,
            // al azar. Asi los saltos siguen el estilo aprendido.
            if (c.e >= cutoff * 1.4f && rnd.nextDouble() < diff.jumpChance) {
                var lane2 = -1
                val logits = stepModel?.predictLogits(
                    StepModel.Ctx(pitch, voice, c.onBeat, beatInBar, c.e.toDouble(), if (gap <= 0.10) 1.0 else if (gap >= 0.30) 0.0 else (0.30 - gap) / 0.20,
                        looseness, true, foot, lane, last2Lane, last3Lane, last4Lane, last5Lane), laneCount)
                if (logits != null) {
                    var bestL = -1; var bestV = -1e9f
                    for (l in 0 until laneCount) { if (l == lane) continue; if (logits[l] > bestV) { bestV = logits[l]; bestL = l } }
                    lane2 = bestL
                } else {
                    lane2 = rnd.nextInt(laneCount); var tr = 0
                    while (lane2 == lane && tr < 8) { lane2 = rnd.nextInt(laneCount); tr++ }
                }
                if (lane2 != lane && lane2 >= 0) { notes.add(Note(noteTime, lane2)); laneUsage[lane2]++; foot = 0; lastLane = -1; prevWasJump = true }
            }
        }

        notes.sortBy { it.time }
        return notes
    }

    // Elige el carril de una nota: contorno melodico (pitch) + sesgo por
    // instrumento (bombo al centro, hats afuera) + alternancia de pie +
    // jugabilidad (no saltar lejos en notas rapidas) + balance de lados.
    // Determinista (sin azar) para patrones reconocibles, igual que en PC.
    private fun pickLane(
        laneCount: Int, lastLane: Int, foot: Int, onBeat: Boolean,
        pitch: Double, voice: String, gap: Double, looseness: Double,
        center: Double, laneUsage: IntArray,
        last2Lane: Int, last3Lane: Int, beatInBar: Double, prevJump: Boolean,
        strong: Double, stepModel: StepModel?, last4Lane: Int, last5Lane: Int,
    ): Int {
        var target = pitch * (laneCount - 1)
        if (voice == "kick") target = target * 0.45 + center * 0.55
        else if (voice == "hat") { val ext = if (target < center) 0.0 else (laneCount - 1).toDouble(); target = target * 0.5 + ext * 0.5 }
        val g = if (gap < 0) 1.0 else gap
        val reach = if (g <= 0.10) 1.0 else if (g >= 0.30) 0.0 else (0.30 - g) / 0.20
        var totalUse = 0; for (u in laneUsage) totalUse += u
        // PRIOR del MINI-MODELO de IA (forma de patron aprendida). Se SUMA a la
        // puntuacion musical; mas influencia en dificultades altas (looseness).
        val modelLogits: FloatArray? = stepModel?.predictLogits(
            StepModel.Ctx(pitch, voice, onBeat, beatInBar, strong, reach, looseness, prevJump, foot, lastLane, last2Lane, last3Lane, last4Lane, last5Lane),
            laneCount,
        )
        val modelW = STEP_MODEL_WEIGHT * (0.7 + 0.6 * looseness)
        var best = 0; var bestScore = -1e9
        for (lane in 0 until laneCount) {
            var score = -abs(lane - target) * 1.0
            val side = if (lane < center) -1 else if (lane > center) 1 else 0
            if (foot != 0 && side != 0) score += if (side == -foot) 0.55 else -0.45
            if (lastLane >= 0 && reach > 0) { val distW = 0.6 * (1.25 - looseness * 0.85); score -= abs(lane - lastLane) * distW * reach }
            if (totalUse > 8) { val expected = totalUse.toDouble() / laneCount; score += ((expected - laneUsage[lane]) / max(1.0, expected) * 0.25).coerceIn(-0.3, 0.3) }
            if (modelLogits != null && lane < modelLogits.size) score += modelW * modelLogits[lane]
            if (lane == lastLane) score -= 2.0
            score += lane * 1e-4
            if (score > bestScore) { bestScore = score; best = lane }
        }
        return best
    }
}
