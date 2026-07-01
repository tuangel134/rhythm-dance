package com.rhythmdance.app.game

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.sqrt

// Reentrenamiento EN EL TELÉFONO (fine-tuning) del mini-modelo de step-selection.
// Parte de los pesos actuales (el modelo general ya entrenado) y los AJUSTA a TUS
// charts (customcharts.json: editor + importados del teléfono). Así el mapeo se
// adapta a tu estilo sin PC y sin descargar nada. Guarda en filesDir/model, que
// StepModel.load prefiere sobre los pesos empaquetados.
//
// 100% Kotlin, sin dependencias. Backprop + Adam sobre la MLP de 2 capas.
object StepTrainer {

    private class Ex(val x: FloatArray, val y: Int)

    @Volatile private var training = false

    // Reentrena para 5 y 4 carriles. Devuelve JSON resumen. Evita solaparse.
    fun retrainAll(ctx: Context): String {
        if (training) return "{\"ok\":false,\"error\":\"ya entrenando\"}"
        training = true
        try {
            val done = StringBuilder()
            var any = false
            for (L in intArrayOf(5, 4)) {
                val ex = buildExamples(ctx, L)
                if (ex.size < 40) continue
                if (fineTune(ctx, L, ex)) { any = true; done.append("${L}c:${ex.size} ") }
            }
            if (!any) return "{\"ok\":false,\"error\":\"Necesito más charts tuyos (mapea o importa) para aprender.\"}"
            StepModel.clearCache()                                   // recargar pesos nuevos
            File(ctx.filesDir, "beatmap-cache").listFiles()?.forEach { it.delete() }  // regenerar con el modelo nuevo
            return "{\"ok\":true,\"trained\":\"${done.toString().trim()}\"}"
        } finally { training = false }
    }

    // ---------- Ejemplos (contexto -> carril) desde tus charts ----------
    private fun buildExamples(ctx: Context, L: Int): List<Ex> {
        val out = ArrayList<Ex>()
        val cc = try { JSONObject(File(ctx.filesDir, "customcharts.json").readText()) } catch (e: Exception) { return out }
        val keys = cc.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            val chart = cc.optJSONObject(k) ?: continue
            val notesArr = chart.optJSONArray("notes") ?: continue
            if (chart.optInt("laneCount", 5) != L) continue
            val bpm = chart.optDouble("bpm", 120.0)
            val parts = k.split("_")
            val diff = if (parts.size >= 3) parts[parts.size - 3] else "normal"
            addChartExamples(notesArr, L, bpm, looseFor(diff), out)
        }
        return out
    }

    private fun looseFor(diff: String): Double = when (diff.lowercase()) {
        "easy", "facil", "fácil" -> 0.15
        "normal", "ritmo" -> 0.4
        "hard", "dificil", "difícil" -> 0.6
        "expert", "experto", "locura", "caos" -> 0.85
        else -> 0.5
    }

    // Igual que examplesFromChart de train-stepmodel.mjs: agrupa notas en frames
    // (acordes), calcula contexto (reach, beat, pie, historia 5) y saca (x,y).
    private fun addChartExamples(notesArr: JSONArray, L: Int, bpm: Double, looseness: Double, out: ArrayList<Ex>) {
        val times = DoubleArray(notesArr.length())
        val lanes = IntArray(notesArr.length())
        val order = (0 until notesArr.length()).sortedBy { notesArr.getJSONObject(it).optDouble("time") }
        var idx = 0
        for (oi in order) { val o = notesArr.getJSONObject(oi); times[idx] = o.optDouble("time"); lanes[idx] = o.optInt("lane"); idx++ }
        val center = (L - 1) / 2.0
        val beatSec = 60.0 / (if (bpm > 0) bpm else 120.0)
        var lastLane = -1; var last2 = -1; var last3 = -1; var last4 = -1; var last5 = -1
        var foot = 0; var prevJump = false; var prevT = -1e9
        var i = 0
        while (i < times.size) {
            val t = times[i]
            val frameLanes = ArrayList<Int>()
            while (i < times.size && abs(times[i] - t) < 0.012) { frameLanes.add(lanes[i]); i++ }
            val gap = t - prevT
            val reach = if (gap <= 0.10) 1.0 else if (gap >= 0.30) 0.0 else (0.30 - gap) / 0.20
            val beat = t / beatSec; val frac = beat - Math.floor(beat)
            val onDown = frac < 0.06 || frac > 0.94
            val beatInBar = ((Math.floor(beat) % 4) + frac) / 4.0
            if (frameLanes.size == 1) {
                val lane = frameLanes[0]
                if (lane in 0 until L) {
                    val c = StepModel.Ctx(0.5, "melody", onDown, beatInBar, if (onDown) 0.7 else 0.4, reach, looseness, prevJump, foot, lastLane, last2, last3, last4, last5)
                    out.add(Ex(StepModel.features(c, L), lane))
                    last5 = last4; last4 = last3; last3 = last2; last2 = lastLane; lastLane = lane
                    val sd = if (lane < center) -1 else if (lane > center) 1 else 0; if (sd != 0) foot = sd
                    prevJump = false
                }
            } else { last5 = last4; last4 = last3; last3 = last2; last2 = lastLane; lastLane = -1; foot = 0; prevJump = true }
            prevT = t
        }
    }

    private fun arr(j: JSONObject, key: String): FloatArray {
        val a = j.getJSONArray(key); val out = FloatArray(a.length())
        for (i in 0 until a.length()) out[i] = a.getDouble(i).toFloat()
        return out
    }

    // ---------- Fine-tune (Adam, MLP 2 capas) ----------
    private fun fineTune(ctx: Context, L: Int, ex: List<Ex>): Boolean {
        val txt = StepModel.readModelJson(ctx, L) ?: return false
        val j = try { JSONObject(txt) } catch (e: Exception) { return false }
        val inDim = j.getInt("inDim"); val h1 = j.getInt("hidden"); val h2 = j.optInt("hidden2", 0); val out = j.getInt("out")
        if (h2 <= 0 || !j.has("W3")) return false          // requiere arquitectura 2-capas
        if (ex.isNotEmpty() && ex[0].x.size != inDim) return false
        val W1 = arr(j, "W1"); val B1 = arr(j, "b1"); val W2 = arr(j, "W2"); val B2 = arr(j, "b2"); val W3 = arr(j, "W3"); val B3 = arr(j, "b3")
        // Estado Adam (m,v) por parámetro.
        val mW1 = FloatArray(W1.size); val vW1 = FloatArray(W1.size); val mB1 = FloatArray(B1.size); val vB1 = FloatArray(B1.size)
        val mW2 = FloatArray(W2.size); val vW2 = FloatArray(W2.size); val mB2 = FloatArray(B2.size); val vB2 = FloatArray(B2.size)
        val mW3 = FloatArray(W3.size); val vW3 = FloatArray(W3.size); val mB3 = FloatArray(B3.size); val vB3 = FloatArray(B3.size)
        val lr = 0.004f; val epochs = 8; val batch = 32; var tstep = 0
        val idxs = (ex.indices).toMutableList(); val rnd = java.util.Random(1234)

        // Gradientes acumulados por batch.
        val gW1 = FloatArray(W1.size); val gB1 = FloatArray(B1.size); val gW2 = FloatArray(W2.size); val gB2 = FloatArray(B2.size); val gW3 = FloatArray(W3.size); val gB3 = FloatArray(B3.size)

        fun adam(arr: FloatArray, g: FloatArray, m: FloatArray, v: FloatArray, t: Int) {
            val b1 = 0.9f; val b2 = 0.999f; val eps = 1e-8f
            val c1 = 1f - Math.pow(0.9, t.toDouble()).toFloat(); val c2 = 1f - Math.pow(0.999, t.toDouble()).toFloat()
            for (i in arr.indices) {
                val gi = g[i]
                m[i] = b1 * m[i] + (1 - b1) * gi
                v[i] = b2 * v[i] + (1 - b2) * gi * gi
                arr[i] -= lr * (m[i] / c1) / (sqrt(v[i] / c2) + eps)
            }
        }

        repeat(epochs) {
            for (i in idxs.indices.reversed()) { val jx = rnd.nextInt(i + 1); val tmp = idxs[i]; idxs[i] = idxs[jx]; idxs[jx] = tmp }
            var b = 0
            while (b < idxs.size) {
                java.util.Arrays.fill(gW1, 0f); java.util.Arrays.fill(gB1, 0f); java.util.Arrays.fill(gW2, 0f)
                java.util.Arrays.fill(gB2, 0f); java.util.Arrays.fill(gW3, 0f); java.util.Arrays.fill(gB3, 0f)
                var nb = 0; var ii = b
                while (ii < minOf(b + batch, idxs.size)) {
                    val e = ex[idxs[ii]]; val x = e.x; val y = e.y
                    // forward
                    val a1 = FloatArray(h1); val z1 = FloatArray(h1)
                    for (jn in 0 until h1) { var s = B1[jn]; val bs = jn * inDim; for (k in 0 until inDim) s += W1[bs + k] * x[k]; z1[jn] = s; a1[jn] = if (s > 0f) s else 0f }
                    val a2 = FloatArray(h2); val z2 = FloatArray(h2)
                    for (o2 in 0 until h2) { var s = B2[o2]; val bs = o2 * h1; for (jn in 0 until h1) s += W2[bs + jn] * a1[jn]; z2[o2] = s; a2[o2] = if (s > 0f) s else 0f }
                    val p = FloatArray(out); var mx = Float.NEGATIVE_INFINITY
                    for (o in 0 until out) { var s = B3[o]; val bs = o * h2; for (o2 in 0 until h2) s += W3[bs + o2] * a2[o2]; p[o] = s; if (s > mx) mx = s }
                    var sum = 0f; for (o in 0 until out) { p[o] = exp(p[o] - mx); sum += p[o] }; for (o in 0 until out) p[o] /= sum
                    // backward
                    val dl = FloatArray(out); for (o in 0 until out) dl[o] = p[o]; dl[y] -= 1f
                    val dA2 = FloatArray(h2)
                    for (o in 0 until out) { val gg = dl[o]; val bs = o * h2; for (o2 in 0 until h2) { dA2[o2] += gg * W3[bs + o2]; gW3[bs + o2] += gg * a2[o2] }; gB3[o] += gg }
                    val dA1 = FloatArray(h1)
                    for (o2 in 0 until h2) { if (z2[o2] <= 0f) continue; val gg = dA2[o2]; val bs = o2 * h1; for (jn in 0 until h1) { dA1[jn] += gg * W2[bs + jn]; gW2[bs + jn] += gg * a1[jn] }; gB2[o2] += gg }
                    for (jn in 0 until h1) { if (z1[jn] <= 0f) continue; val gg = dA1[jn]; val bs = jn * inDim; for (k in 0 until inDim) gW1[bs + k] += gg * x[k]; gB1[jn] += gg }
                    nb++; ii++
                }
                if (nb > 0) {
                    val inv = 1f / nb
                    for (i in gW1.indices) gW1[i] *= inv; for (i in gB1.indices) gB1[i] *= inv
                    for (i in gW2.indices) gW2[i] *= inv; for (i in gB2.indices) gB2[i] *= inv
                    for (i in gW3.indices) gW3[i] *= inv; for (i in gB3.indices) gB3[i] *= inv
                    tstep++
                    adam(W1, gW1, mW1, vW1, tstep); adam(B1, gB1, mB1, vB1, tstep)
                    adam(W2, gW2, mW2, vW2, tstep); adam(B2, gB2, mB2, vB2, tstep)
                    adam(W3, gW3, mW3, vW3, tstep); adam(B3, gB3, mB3, vB3, tstep)
                }
                b += batch
            }
        }
        return saveModel(ctx, L, inDim, h1, h2, out, W1, B1, W2, B2, W3, B3)
    }

    private fun saveModel(ctx: Context, L: Int, inDim: Int, h1: Int, h2: Int, out: Int,
                          W1: FloatArray, B1: FloatArray, W2: FloatArray, B2: FloatArray, W3: FloatArray, B3: FloatArray): Boolean {
        return try {
            fun ja(a: FloatArray): JSONArray { val r = JSONArray(); for (v in a) r.put((Math.round(v * 100000.0) / 100000.0)); return r }
            val o = JSONObject()
            o.put("inDim", inDim).put("hidden", h1).put("hidden2", h2).put("out", out)
            o.put("W1", ja(W1)).put("b1", ja(B1)).put("W2", ja(W2)).put("b2", ja(B2)).put("W3", ja(W3)).put("b3", ja(B3))
            o.put("trainedOnDevice", true)
            val dir = File(ctx.filesDir, "model").apply { mkdirs() }
            File(dir, "step-model-$L.json").writeText(o.toString())
            true
        } catch (e: Exception) { false }
    }
}
