package com.rhythmdance.app.game

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.min

// Vista del juego: dibuja las flechas que SUBEN desde abajo hacia los
// receptores arriba (estilo Pump It Up / DDR), evalua los toques por carril,
// lleva puntaje, combo y vida. El reloj se lo provee la Activity (sincronizado
// con el MediaPlayer que reproduce la cancion).
class GameView(context: Context) : View(context) {

    interface Listener {
        fun onScore(score: Int)
        fun onCombo(combo: Int)
        fun onLife(life: Int)
        fun onJudge(label: String, color: Int)
        fun onFinish(result: Result)
    }

    data class Result(
        val score: Int, val maxCombo: Int, val accuracy: Double,
        val perfect: Int, val great: Int, val good: Int, val ok: Int, val miss: Int,
        val failed: Boolean,
    )

    var listener: Listener? = null

    private var chart: Chart? = null
    private var laneCount = 5
    private lateinit var laneColors: IntArray
    private var notes: List<Note> = emptyList()

    // Reloj de la cancion en segundos (lo actualiza la Activity). <0 = cuenta atras.
    @Volatile var songTime: Double = -3.0
    @Volatile var running = false

    // Parametros de juego
    var scrollSpeed = 3.0          // velocidad de caida (multiplicador)
    private val perfectW = 0.045
    private val greatW = 0.09
    private val goodW = 0.15
    private val missW = 0.22

    // Estado
    private var score = 0
    private var combo = 0
    private var maxCombo = 0
    private var life = 50.0
    private var cPerfect = 0; private var cGreat = 0; private var cGood = 0; private var cOk = 0; private var cMiss = 0
    private var resolved = 0
    private var failed = false
    private var ended = false
    private val laneCursors = IntArray(8)

    // Layout (px) calculado en onSizeChanged
    private var receptorY = 0f
    private var laneW = 0f
    private var boardLeft = 0f
    private var noteSize = 0f
    private val receptorFlash = FloatArray(8)
    private val hitFx = ArrayList<HitFx>()

    private data class HitFx(val lane: Int, var t: Float)

    // Pinceles
    private val pNote = Paint(Paint.ANTI_ALIAS_FLAG)
    private val pReceptor = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val pGlow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val pText = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; isFakeBoldText = true }
    private val pLine = Paint(Paint.ANTI_ALIAS_FLAG)

    private var lastFrameNs = 0L

    fun setChart(chart: Chart, speed: Double) {
        this.chart = chart
        this.notes = chart.notes
        this.laneCount = chart.laneCount
        this.scrollSpeed = speed
        laneColors = if (laneCount == 5)
            intArrayOf(0xFFFF2E6E.toInt(), 0xFF2EE6FF.toInt(), 0xFFFFE14D.toInt(), 0xFF2EE6FF.toInt(), 0xFFFF2E6E.toInt())
        else
            intArrayOf(0xFFFF2E88.toInt(), 0xFF2EE6FF.toInt(), 0xFF5DFF8F.toInt(), 0xFFFFD23E.toInt())
        recomputeLayout()
    }

    override fun onSizeChanged(w: Int, h: Int, ow: Int, oh: Int) {
        super.onSizeChanged(w, h, ow, oh)
        recomputeLayout()
    }

    private fun recomputeLayout() {
        if (width == 0 || height == 0) return
        laneW = width.toFloat() / laneCount
        boardLeft = 0f
        receptorY = height * 0.82f          // receptores ABAJO (comodo para los pulgares)
        noteSize = min(laneW * 0.78f, height * 0.12f)
        pText.textSize = noteSize * 0.5f
    }

    // unidades px/seg que se mueve una nota
    private fun pxPerSec(): Float = height * 0.42f * scrollSpeed.toFloat() / 3f

    private fun laneCenterX(lane: Int): Float = boardLeft + laneW * (lane + 0.5f)

    fun start() {
        running = true
        ended = false
        lastFrameNs = System.nanoTime()
        postInvalidateOnAnimation()
    }

    fun stop() { running = false }

    // ---------- Toque por carril ----------
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!running) return true
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                val idx = event.actionIndex
                val x = event.getX(idx)
                val lane = ((x - boardLeft) / laneW).toInt().coerceIn(0, laneCount - 1)
                pressLane(lane)
            }
        }
        return true
    }

    private fun pressLane(lane: Int) {
        receptorFlash[lane] = 1f
        val now = songTime
        val arr = notes
        // buscar la nota no resuelta mas cercana en este carril
        var best: Note? = null
        var bestDt = Double.MAX_VALUE
        var i = laneCursors[lane]
        // avanzar cursor sobre notas ya resueltas/pasadas
        while (i < arr.size) {
            val n = arr[i]
            if (n.lane != lane) { i++; continue }
            if (n.hit || n.missed) { i++; continue }
            if (n.time - now < -missW) { i++; continue }
            break
        }
        var k = i
        while (k < arr.size) {
            val n = arr[k]
            if (n.lane == lane && !n.hit && !n.missed) {
                val dt = n.time - now
                if (dt > missW) break
                val adt = abs(dt)
                if (adt < bestDt) { bestDt = adt; best = n }
            }
            k++
        }

        if (best != null && bestDt <= missW) {
            val j = judge(bestDt)
            best.hit = true
            combo++
            if (combo > maxCombo) maxCombo = combo
            score += j.pts + min(combo, 100)
            resolved++
            bumpJudgeCount(j.label)
            life = (life + j.life).coerceIn(0.0, 100.0)
            hitFx.add(HitFx(lane, 0f))
            listener?.onJudge(j.label, j.color)
            listener?.onScore(score)
            listener?.onCombo(combo)
            listener?.onLife(life.toInt())
        } else {
            // toque sin nota = error leve
            combo = 0
            life = (life - 2.0).coerceIn(0.0, 100.0)
            listener?.onCombo(0)
            listener?.onLife(life.toInt())
            if (life <= 0) fail()
        }
    }

    private data class Judgement(val label: String, val color: Int, val pts: Int, val life: Double)
    private fun judge(dt: Double): Judgement = when {
        dt <= perfectW -> Judgement("PERFECT", 0xFF5DFF8F.toInt(), 1000, 1.5)
        dt <= greatW -> Judgement("GREAT", 0xFF2EE6FF.toInt(), 600, 1.0)
        dt <= goodW -> Judgement("GOOD", 0xFFFFD23E.toInt(), 300, 0.3)
        else -> Judgement("OK", 0xFFFF9F1C.toInt(), 100, 0.0)
    }

    private fun fail() {
        if (failed) return
        failed = true
        finish()
    }

    private fun finish() {
        if (ended) return
        ended = true
        running = false
        val total = (notes.size).coerceAtLeast(1)
        val hits = cPerfect + cGreat + cGood + cOk
        val acc = Math.round((hits.toDouble() / total) * 1000) / 10.0
        listener?.onFinish(Result(score, maxCombo, acc, cPerfect, cGreat, cGood, cOk, cMiss, failed))
    }

    // ---------- Update + render ----------
    private fun update() {
        val now = songTime
        val chart = chart ?: return

        // marcar MISS de notas que pasaron la ventana
        for (idx in 0 until notes.size) {
            val n = notes[idx]
            if (n.hit || n.missed) continue
            if (n.time - now < -missW) {
                n.missed = true
                cMiss++
                resolved++
                combo = 0
                life = (life - 4.0).coerceIn(0.0, 100.0)
                listener?.onCombo(0)
                listener?.onJudge("MISS", 0xFFFF4D4D.toInt())
                listener?.onLife(life.toInt())
                if (life <= 0) fail()
            }
        }

        // fin de cancion
        if (now > chart.duration + 1.0) finish()
    }

    override fun onDraw(canvas: Canvas) {
        val nowNs = System.nanoTime()
        val dt = if (lastFrameNs == 0L) 0f else ((nowNs - lastFrameNs) / 1e9f).coerceAtMost(0.05f)
        lastFrameNs = nowNs

        // fondo
        canvas.drawColor(0xFF05060F.toInt())

        if (running) update()

        drawLanes(canvas)
        drawReceptors(canvas, dt)
        drawNotes(canvas)
        drawHitFx(canvas, dt)

        if (running || !ended) postInvalidateOnAnimation()
    }

    private fun drawLanes(canvas: Canvas) {
        pLine.color = 0x18FFFFFF
        for (i in 0..laneCount) {
            val x = boardLeft + laneW * i
            canvas.drawRect(x - 1, 0f, x + 1, height.toFloat(), pLine)
        }
    }

    private fun drawReceptors(canvas: Canvas, dt: Float) {
        for (lane in 0 until laneCount) {
            if (receptorFlash[lane] > 0) receptorFlash[lane] = (receptorFlash[lane] - dt * 6).coerceAtLeast(0f)
            val cx = laneCenterX(lane)
            val col = laneColors[lane]
            val flash = receptorFlash[lane]
            // glow
            pGlow.color = col
            pGlow.alpha = (40 + flash * 120).toInt().coerceIn(0, 255)
            canvas.drawCircle(cx, receptorY, noteSize * (0.7f + flash * 0.15f), pGlow)
            // contorno
            pReceptor.color = col
            pReceptor.alpha = (150 + flash * 105).toInt().coerceIn(0, 255)
            pReceptor.strokeWidth = noteSize * 0.10f
            drawArrowPath(canvas, cx, receptorY, noteSize * 0.5f, lane, pReceptor, false)
        }
    }

    private fun drawNotes(canvas: Canvas) {
        val now = songTime
        val pps = pxPerSec()
        val viewSec = (receptorY / pps) + 0.5f
        for (idx in 0 until notes.size) {
            val n = notes[idx]
            if (n.hit || n.missed) continue
            val dtt = n.time - now
            if (dtt < -0.3 || dtt > viewSec) continue
            // futuro (dtt>0) = ARRIBA del receptor; baja hacia el al acercarse.
            val y = receptorY - (dtt * pps).toFloat()
            val cx = laneCenterX(n.lane)
            pNote.color = laneColors[n.lane]
            pNote.alpha = 255
            drawArrowPath(canvas, cx, y, noteSize * 0.5f, n.lane, pNote, true)
        }
    }

    private fun drawHitFx(canvas: Canvas, dt: Float) {
        var i = hitFx.size - 1
        while (i >= 0) {
            val fx = hitFx[i]
            fx.t += dt / 0.18f
            if (fx.t >= 1f) { hitFx.removeAt(i); i--; continue }
            val cx = laneCenterX(fx.lane)
            pGlow.color = laneColors[fx.lane]
            pGlow.alpha = ((1f - fx.t) * 180).toInt().coerceIn(0, 255)
            canvas.drawCircle(cx, receptorY, noteSize * (0.6f + fx.t * 0.6f), pGlow)
            i--
        }
    }

    // Dibuja una flecha (relleno o contorno) apuntando segun el carril.
    private val arrowPath = Path()
    private fun drawArrowPath(canvas: Canvas, cx: Float, cy: Float, r: Float, lane: Int, paint: Paint, fill: Boolean) {
        paint.style = if (fill) Paint.Style.FILL else Paint.Style.STROKE
        // rotacion por carril
        val rot = if (laneCount == 5) when (lane) {
            0 -> 45f; 1 -> 135f; 2 -> 0f; 3 -> -135f; else -> -45f
        } else when (lane) {
            0 -> 90f; 1 -> 0f; 2 -> 180f; else -> -90f
        }
        canvas.save()
        canvas.translate(cx, cy)
        canvas.rotate(rot)
        arrowPath.reset()
        // flecha simple apuntando hacia arriba
        arrowPath.moveTo(0f, -r)
        arrowPath.lineTo(r * 0.85f, r * 0.15f)
        arrowPath.lineTo(r * 0.35f, r * 0.15f)
        arrowPath.lineTo(r * 0.35f, r)
        arrowPath.lineTo(-r * 0.35f, r)
        arrowPath.lineTo(-r * 0.35f, r * 0.15f)
        arrowPath.lineTo(-r * 0.85f, r * 0.15f)
        arrowPath.close()
        canvas.drawPath(arrowPath, paint)
        canvas.restore()
    }

    // Exponer conteos finos: re-juzgamos en pressLane sumando al contador.
    fun bumpJudgeCount(label: String) {
        when (label) {
            "PERFECT" -> cPerfect++
            "GREAT" -> cGreat++
            "GOOD" -> cGood++
            "OK" -> cOk++
        }
    }
}
