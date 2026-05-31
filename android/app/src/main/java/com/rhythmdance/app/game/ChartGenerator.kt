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

    fun generate(audio: DecodedAudio, laneCount: Int, diff: Difficulty, introFreeSec: Double = 6.0): Chart {
        val sr = audio.sampleRate
        val x = audio.samples
        val hopSec = HOP.toDouble() / sr

        val novelty = spectralFlux(x)
        val peaks = detectPeaks(novelty)
        val bpm = estimateBpm(novelty, hopSec)
        val beatSec = 60.0 / bpm
        val offset = estimateOffset(peaks, hopSec, beatSec)

        val duration = audio.durationSec
        val notes = placeNotes(novelty, peaks, hopSec, bpm, offset, duration, laneCount, diff, introFreeSec)
        return Chart(notes, bpm, duration, laneCount)
    }

    // ---------- STFT + spectral flux ----------
    private fun spectralFlux(x: FloatArray): FloatArray {
        val win = hann(FFT)
        val frames = max(0, (x.size - FFT) / HOP + 1)
        if (frames <= 1) return FloatArray(0)
        val prevMag = FloatArray(FFT / 2)
        val curMag = FloatArray(FFT / 2)
        val nov = FloatArray(frames)
        val re = FloatArray(FFT)
        val im = FloatArray(FFT)

        for (f in 0 until frames) {
            val start = f * HOP
            for (i in 0 until FFT) { re[i] = x[start + i] * win[i]; im[i] = 0f }
            fft(re, im)
            for (i in 0 until FFT / 2) {
                val m = sqrt(re[i] * re[i] + im[i] * im[i])
                curMag[i] = ln(1f + m)        // compresion logaritmica
            }
            if (f > 0) {
                var sum = 0f
                for (i in 0 until FFT / 2) {
                    val d = curMag[i] - prevMag[i]
                    if (d > 0) sum += d        // solo incrementos (half-wave rectified)
                }
                nov[f] = sum
            }
            System.arraycopy(curMag, 0, prevMag, 0, FFT / 2)
        }
        var mx = 0f
        for (v in nov) if (v > mx) mx = v
        if (mx > 0) for (i in nov.indices) nov[i] /= mx
        return smooth(nov, 2)
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
        nov: FloatArray, peaks: BooleanArray, hopSec: Double,
        bpm: Double, offset: Double, duration: Double,
        laneCount: Int, diff: Difficulty, introFreeSec: Double,
    ): List<Note> {
        val beatSec = 60.0 / bpm
        val cellSec = beatSec / diff.subdiv
        val notes = ArrayList<Note>()
        var lastLane = -1
        var lastLane2 = -1
        val rnd = java.util.Random(1234)

        // Recolectar celdas candidatas con su energia.
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

        // Umbral por densidad objetivo: ordenar energias y tomar las mas fuertes.
        val targetCount = (diff.maxNps * max(1.0, duration - introFreeSec)).toInt()
        val sortedE = cells.map { it.e }.sortedDescending()
        val cutIdx = min(sortedE.size - 1, max(0, targetCount - 1))
        var cutoff = if (sortedE.isNotEmpty()) sortedE[cutIdx] else 0f
        val maxE = if (sortedE.isNotEmpty()) sortedE[0] else 0f
        val floor = maxE * 0.16f
        if (cutoff < floor) cutoff = floor

        var lastTime = -10.0
        val minGap = cellSec * 0.85
        for (c in cells) {
            if (c.t < introFreeSec) continue
            val passes = c.e >= cutoff || (c.onBeat && c.e >= cutoff * 0.5f)
            if (!passes) continue
            if (c.t - lastTime < minGap) continue
            // Imantar al pico de onset cercano para caer sobre el ataque real.
            val snapped = nearestPeak(peaks, hopSec, c.t, min(0.045, cellSec * 0.5))
            val noteTime = if (snapped >= 0) snapped else c.t

            // Elegir carril evitando repetir los 2 ultimos.
            var lane = rnd.nextInt(laneCount)
            var tries = 0
            while ((lane == lastLane || lane == lastLane2) && tries < 8) { lane = rnd.nextInt(laneCount); tries++ }
            notes.add(Note(noteTime, lane))
            lastLane2 = lastLane; lastLane = lane
            lastTime = c.t

            // Nota doble (jump) en acentos fuertes.
            if (c.e >= cutoff * 1.4f && rnd.nextDouble() < diff.jumpChance) {
                var lane2 = rnd.nextInt(laneCount)
                var t2 = 0
                while (lane2 == lane && t2 < 8) { lane2 = rnd.nextInt(laneCount); t2++ }
                if (lane2 != lane) notes.add(Note(noteTime, lane2))
            }
        }

        notes.sortBy { it.time }
        return notes
    }
}
