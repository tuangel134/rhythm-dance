package com.rhythmdance.app.game

import android.content.Context
import org.json.JSONObject
import kotlin.math.exp
import kotlin.math.ln

// Mini-red neuronal (MLP) para STEP-SELECTION, portada 1:1 desde la versión JS
// (server/stepmodel.js). Dado el contexto musical de una nota + la historia
// reciente de carriles, predice log-probabilidades por carril. Aporta la FORMA
// del patrón (escaleras, crossovers, boxes, alternancia) que un scorer
// nota-a-nota no produce solo. Se MEZCLA con la heurística (no la reemplaza).
//
// Pesos empaquetados en assets/model/step-model-{5,4}.json (no se descarga nada).
// Arquitectura: entrada -> capa oculta (ReLU) -> salida (softmax -> log-probs).
class StepModel private constructor(
    private val inDim: Int,
    private val hidden: Int,
    private val hidden2: Int,
    private val out: Int,
    private val w1: FloatArray, private val b1: FloatArray,
    private val w2: FloatArray, private val b2: FloatArray,
    private val w3: FloatArray?, private val b3: FloatArray?,
) {
    // Contexto de UNA nota para construir el vector de features.
    class Ctx(
        val pitch: Double, val voice: String?, val onDownbeat: Boolean,
        val beatInBar: Double, val strong: Double, val reach: Double,
        val looseness: Double, val prevJump: Boolean, val foot: Int,
        val lastLane: Int, val last2Lane: Int, val last3Lane: Int,
        val last4Lane: Int = -1, val last5Lane: Int = -1,
    )

    companion object {
        private val cache = HashMap<Int, StepModel?>()

        // Carga perezosa de pesos por laneCount. Prefiere el modelo REENTRENADO
        // en el teléfono (filesDir/model) sobre el empaquetado (assets/model).
        fun load(context: Context, laneCount: Int): StepModel? {
            if (cache.containsKey(laneCount)) return cache[laneCount]
            var model: StepModel? = null
            val txt = readModelJson(context, laneCount)
            if (txt != null) {
                try {
                    val j = JSONObject(txt)
                    model = StepModel(
                        j.getInt("inDim"), j.getInt("hidden"), j.optInt("hidden2", 0), j.getInt("out"),
                        toFloatArray(j.getJSONArray("W1")), toFloatArray(j.getJSONArray("b1")),
                        toFloatArray(j.getJSONArray("W2")), toFloatArray(j.getJSONArray("b2")),
                        if (j.has("W3")) toFloatArray(j.getJSONArray("W3")) else null,
                        if (j.has("b3")) toFloatArray(j.getJSONArray("b3")) else null,
                    )
                } catch (e: Exception) { model = null }
            }
            cache[laneCount] = model
            return model
        }

        // Texto del modelo: filesDir/model (reentrenado) o assets/model (base).
        fun readModelJson(context: Context, laneCount: Int): String? {
            val f = java.io.File(java.io.File(context.filesDir, "model"), "step-model-$laneCount.json")
            if (f.exists()) { try { return f.readText() } catch (_: Exception) {} }
            return try { context.assets.open("model/step-model-$laneCount.json").bufferedReader().use { it.readText() } }
            catch (e: Exception) { null }
        }

        // Invalida la caché para releer pesos tras reentrenar en el teléfono.
        fun clearCache() { cache.clear() }

        private fun toFloatArray(arr: org.json.JSONArray): FloatArray {
            val out = FloatArray(arr.length())
            for (i in 0 until arr.length()) out[i] = arr.getDouble(i).toFloat()
            return out
        }

        private fun clamp01(x: Double): Float { if (x.isNaN()) return 0f; return if (x < 0) 0f else if (x > 1) 1f else x.toFloat() }

        // Vector de features (compartido por inferencia y entrenamiento en device).
        // Debe coincidir EXACTO con buildFeatures de stepmodel.js.
        fun features(c: Ctx, L: Int): FloatArray {
            val f = FloatArray(13 + 5 * L)
            var i = 0
            f[i++] = clamp01(c.pitch)
            f[i++] = if (c.voice == "kick") 1f else 0f
            f[i++] = if (c.voice == "hat") 1f else 0f
            f[i++] = if (c.voice == "cymbal") 1f else 0f
            f[i++] = if (c.voice == "melody" || c.voice == null) 1f else 0f
            f[i++] = if (c.onDownbeat) 1f else 0f
            f[i++] = clamp01(c.beatInBar)
            f[i++] = clamp01(c.strong)
            f[i++] = clamp01(c.reach)
            f[i++] = clamp01(c.looseness)
            f[i++] = if (c.prevJump) 1f else 0f
            f[i++] = if (c.foot < 0) 1f else 0f
            f[i++] = if (c.foot > 0) 1f else 0f
            val hist = intArrayOf(c.lastLane, c.last2Lane, c.last3Lane, c.last4Lane, c.last5Lane)
            for (hpos in 0 until 5) { val lane = hist[hpos]; for (k in 0 until L) f[i++] = if (lane == k) 1f else 0f }
            return f
        }
    }

    // Forward pass -> log-probabilidades por carril (length = out).
    // 2 capas ocultas ReLU si hay W3; si no, 1 capa (compatibilidad).
    fun predictLogits(c: Ctx, laneCount: Int): FloatArray? {
        val x = features(c, laneCount)
        if (x.size != inDim) return null
        val h1 = FloatArray(hidden)
        for (jn in 0 until hidden) {
            var s = b1[jn]; val base = jn * inDim
            for (k in 0 until inDim) s += w1[base + k] * x[k]
            h1[jn] = if (s > 0f) s else 0f
        }
        val logits = FloatArray(out)
        if (hidden2 > 0 && w3 != null && b3 != null) {
            val h2 = FloatArray(hidden2)
            for (o2 in 0 until hidden2) {
                var s = b2[o2]; val base = o2 * hidden
                for (jn in 0 until hidden) s += w2[base + jn] * h1[jn]
                h2[o2] = if (s > 0f) s else 0f
            }
            for (o in 0 until out) { var s = b3[o]; val base = o * hidden2; for (o2 in 0 until hidden2) s += w3[base + o2] * h2[o2]; logits[o] = s }
        } else {
            for (o in 0 until out) { var s = b2[o]; val base = o * hidden; for (jn in 0 until hidden) s += w2[base + jn] * h1[jn]; logits[o] = s }
        }
        var mx = Float.NEGATIVE_INFINITY
        for (o in 0 until out) if (logits[o] > mx) mx = logits[o]
        var sum = 0f
        for (o in 0 until out) { logits[o] = exp(logits[o] - mx); sum += logits[o] }
        val logp = FloatArray(out)
        for (o in 0 until out) logp[o] = ln((logits[o] / sum) + 1e-9f)
        return logp
    }
}
