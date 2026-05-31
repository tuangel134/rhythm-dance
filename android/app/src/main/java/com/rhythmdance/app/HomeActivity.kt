package com.rhythmdance.app

import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

// Pantalla de inicio: el usuario elige entre JUGAR en el propio telefono (juego
// nativo, sin PC) o CONECTARSE a una PC (cliente WebView, lo de antes).
class HomeActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(0xFF05060F.toInt())
            setPadding(dp(28), dp(28), dp(28), dp(28))
        }

        root.addView(TextView(this).apply {
            text = "◤ ◣ ◆ ◢ ◥"
            setTextColor(0xFF29E7FF.toInt())
            textSize = 30f
            gravity = Gravity.CENTER
        })
        root.addView(TextView(this).apply {
            text = "RHYTHM DANCE"
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 34f
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, dp(4))
        })
        root.addView(TextView(this).apply {
            text = "Juego de ritmo con TU música"
            setTextColor(0xFF8B8FB0.toInt())
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dp(28))
        })

        root.addView(Button(this).apply {
            text = "▶  Jugar en el teléfono"
            setTextColor(0xFFFFFFFF.toInt())
            isAllCaps = false
            textSize = 18f
            backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFFF2D7E.toInt())
            setOnClickListener {
                startActivity(Intent(this@HomeActivity, SongPickerActivity::class.java))
            }
        }, lp())

        root.addView(Button(this).apply {
            text = "🖥  Conectar a una PC (WiFi)"
            setTextColor(0xFFFFFFFF.toInt())
            isAllCaps = false
            textSize = 16f
            backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF11162B.toInt())
            setOnClickListener {
                startActivity(Intent(this@HomeActivity, MainActivity::class.java))
            }
        }, lp())

        root.addView(TextView(this).apply {
            text = "«Jugar en el teléfono» genera la pista en tu propio celular a partir de un archivo de audio. No necesita PC."
            setTextColor(0xFF5B6080.toInt())
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(0, dp(22), 0, 0)
        })

        setContentView(root)
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
    private fun lp(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(10); bottomMargin = dp(2)
        }
}
