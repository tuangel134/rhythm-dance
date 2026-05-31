package com.rhythmdance.app

import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.rhythmdance.app.game.AudioDecoder
import com.rhythmdance.app.game.Chart
import com.rhythmdance.app.game.ChartGenerator
import com.rhythmdance.app.game.GameView
import kotlin.concurrent.thread

// Pantalla de juego nativa: decodifica el audio, genera la pista, reproduce con
// MediaPlayer y conduce el reloj del GameView sincronizado con la cancion.
class GameActivity : AppCompatActivity(), GameView.Listener {

    private lateinit var container: FrameLayout
    private lateinit var loading: LinearLayout
    private lateinit var loadingText: TextView
    private var gameView: GameView? = null
    private var player: MediaPlayer? = null

    // HUD
    private lateinit var scoreText: TextView
    private lateinit var comboText: TextView
    private lateinit var judgeText: TextView
    private lateinit var lifeBar: View
    private lateinit var lifeBarBg: FrameLayout

    private val ui = Handler(Looper.getMainLooper())
    private var chart: Chart? = null
    private var speed = 3.0
    private var leadIn = 3.0          // segundos de cuenta atras antes del audio
    private var startWallMs = 0L
    private var audioStarted = false
    private var clockRunner: Runnable? = null
    private var finished = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersive()

        container = FrameLayout(this).apply { setBackgroundColor(0xFF05060F.toInt()) }
        setContentView(container)

        // Pantalla de carga
        loading = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setBackgroundColor(0xFF05060F.toInt())
        }
        loading.addView(ProgressBar(this))
        loadingText = TextView(this).apply {
            text = "Analizando la música…"; setTextColor(0xFFFFFFFF.toInt()); textSize = 16f
            gravity = Gravity.CENTER; setPadding(0, 40, 0, 0)
        }
        loading.addView(loadingText)
        container.addView(loading)

        val uri = Uri.parse(intent.getStringExtra("uri"))
        val diffIdx = intent.getIntExtra("difficulty", 1)
        val lanes = intent.getIntExtra("lanes", 5)
        speed = intent.getDoubleExtra("speed", 3.0)

        prepare(uri, diffIdx, lanes)
    }

    private fun prepare(uri: Uri, diffIdx: Int, lanes: Int) {
        thread {
            val decoded = AudioDecoder.decode(this, uri)
            if (decoded == null) {
                ui.post { loadingText.text = "No se pudo leer el audio.\nPrueba otro archivo."; }
                return@thread
            }
            ui.post { loadingText.text = "Generando la pista al ritmo…" }
            val diff = ChartGenerator.DIFFICULTIES[diffIdx.coerceIn(0, ChartGenerator.DIFFICULTIES.size - 1)]
            val generated = try {
                ChartGenerator.generate(decoded, lanes, diff)
            } catch (e: Exception) {
                ui.post { loadingText.text = "Error generando la pista: ${e.message}" }
                return@thread
            }
            chart = generated
            ui.post { startGame(uri) }
        }
    }

    private fun startGame(uri: Uri) {
        val chart = chart ?: return
        // Preparar reproductor
        player = MediaPlayer().apply {
            setDataSource(this@GameActivity, uri)
            setOnCompletionListener { /* el GameView termina por su cuenta */ }
            prepare()
        }

        // Construir UI de juego (tablero + HUD)
        container.removeAllViews()

        val gv = GameView(this).apply { listener = this@GameActivity; setChart(chart, speed) }
        gameView = gv
        container.addView(gv, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        buildHud()

        gv.songTime = -leadIn
        gv.start()
        startWallMs = System.currentTimeMillis()
        audioStarted = false

        // Bucle de reloj: lead-in con reloj de pared, luego el tiempo del player.
        clockRunner = object : Runnable {
            override fun run() {
                val g = gameView ?: return
                val mp = player
                if (!audioStarted) {
                    val now = (System.currentTimeMillis() - startWallMs) / 1000.0 - leadIn
                    g.songTime = now
                    if (now >= 0 && mp != null) { mp.start(); audioStarted = true }
                } else if (mp != null) {
                    g.songTime = mp.currentPosition / 1000.0
                }
                if (!finished) ui.postDelayed(this, 16)
            }
        }
        ui.post(clockRunner!!)
    }

    private fun buildHud() {
        val density = resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        // Puntaje (arriba izquierda)
        scoreText = TextView(this).apply {
            text = "0"; setTextColor(0xFFFFFFFF.toInt()); textSize = 26f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        container.addView(scoreText, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.START
        ).apply { topMargin = dp(10); leftMargin = dp(16) })

        // Combo (centro)
        comboText = TextView(this).apply {
            text = ""; setTextColor(0xFFFFE14D.toInt()); textSize = 22f; gravity = Gravity.CENTER
        }
        container.addView(comboText, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.CENTER_HORIZONTAL
        ).apply { topMargin = dp(48) })

        // Juicio (centro de pantalla)
        judgeText = TextView(this).apply {
            text = ""; textSize = 34f; gravity = Gravity.CENTER
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        container.addView(judgeText, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER
        ).apply { topMargin = dp(-40) })

        // Barra de vida (arriba derecha)
        lifeBarBg = FrameLayout(this).apply { setBackgroundColor(0x33FFFFFF) }
        container.addView(lifeBarBg, FrameLayout.LayoutParams(dp(160), dp(14), Gravity.TOP or Gravity.END).apply {
            topMargin = dp(16); rightMargin = dp(16)
        })
        lifeBar = View(this).apply { setBackgroundColor(0xFF5DFF8F.toInt()) }
        lifeBarBg.addView(lifeBar, FrameLayout.LayoutParams(dp(80), dp(14)))   // 50% inicial
    }

    // ---------- GameView.Listener ----------
    override fun onScore(score: Int) { scoreText.text = score.toString() }
    override fun onCombo(combo: Int) { comboText.text = if (combo >= 3) "combo $combo" else "" }
    override fun onLife(life: Int) {
        val density = resources.displayMetrics.density
        val full = (160 * density).toInt()
        val w = (full * life / 100).coerceIn(0, full)
        lifeBar.layoutParams = (lifeBar.layoutParams as FrameLayout.LayoutParams).apply { width = w }
        lifeBar.requestLayout()
        lifeBar.setBackgroundColor(if (life <= 25) 0xFFFF4D4D.toInt() else 0xFF5DFF8F.toInt())
    }
    override fun onJudge(label: String, color: Int) {
        judgeText.text = label; judgeText.setTextColor(color)
        judgeText.alpha = 1f
        judgeText.animate().alpha(0f).setDuration(400).start()
    }
    override fun onFinish(result: GameView.Result) {
        finished = true
        ui.post { showResults(result) }
    }

    private fun showResults(r: GameView.Result) {
        try { player?.stop() } catch (_: Exception) {}
        container.removeAllViews()
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setBackgroundColor(0xFF05060F.toInt()); setPadding(40, 40, 40, 40)
        }
        box.addView(TextView(this).apply {
            text = if (r.failed) "FALLASTE" else "¡Completado!"
            setTextColor(if (r.failed) 0xFFFF4D4D.toInt() else 0xFF5DFF8F.toInt())
            textSize = 30f; gravity = Gravity.CENTER
        })
        val info = "Puntos: ${r.score}\nCombo máx: ${r.maxCombo}\nPrecisión: ${r.accuracy}%\n" +
                "PERFECT ${r.perfect} · GREAT ${r.great} · GOOD ${r.good} · OK ${r.ok} · MISS ${r.miss}"
        box.addView(TextView(this).apply {
            text = info; setTextColor(0xFFB9BCDA.toInt()); textSize = 16f; gravity = Gravity.CENTER
            setPadding(0, 30, 0, 30)
        })
        box.addView(android.widget.Button(this).apply {
            text = "Volver"; isAllCaps = false; setTextColor(0xFFFFFFFF.toInt())
            backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFFF2D7E.toInt())
            setOnClickListener { finish() }
        })
        container.addView(box)
    }

    private fun enterImmersive() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)
    }

    override fun onPause() {
        super.onPause()
        try { player?.pause() } catch (_: Exception) {}
        gameView?.stop()
    }

    override fun onDestroy() {
        super.onDestroy()
        finished = true
        clockRunner?.let { ui.removeCallbacks(it) }
        try { player?.release() } catch (_: Exception) {}
        player = null
    }
}
