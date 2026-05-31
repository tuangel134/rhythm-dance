package com.rhythmdance.app

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

/**
 * App Android (Kotlin) de Rhythm Dance / Guitar Hero.
 *
 * El motor del juego (analisis de audio, generacion de pistas, biblioteca de
 * musica) corre en una PC con Node; Android no puede ejecutarlo de forma
 * nativa. Por eso esta app es un CLIENTE: un WebView a pantalla completa que se
 * conecta al servidor del juego en tu PC (misma red WiFi) o al enlace publico
 * que genera el modo VS. En el telefono se juega con los controles tactiles o
 * con un control bluetooth.
 *
 * Flujo:
 *  1. Pantalla de conexion: el usuario escribe la IP:puerto de su PC
 *     (p.ej. 192.168.1.50:5174) o una URL completa, o pega un enlace de sala.
 *  2. Se carga el juego en el WebView a pantalla completa (inmersivo).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var connectView: View
    private var connected = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Mantener la pantalla encendida mientras se juega.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.webview)
        connectView = findViewById(R.id.connectPanel)

        configureWebView()

        val urlInput = findViewById<android.widget.EditText>(R.id.serverUrl)
        // Restaurar la ultima URL usada.
        val prefs = getSharedPreferences("rd", Context.MODE_PRIVATE)
        urlInput.setText(prefs.getString("lastUrl", ""))

        findViewById<android.widget.Button>(R.id.connectBtn).setOnClickListener {
            val raw = urlInput.text.toString().trim()
            if (raw.isEmpty()) return@setOnClickListener
            val url = normalizeUrl(raw)
            prefs.edit().putString("lastUrl", raw).apply()
            connect(url)
        }

        // Boton atras: si estamos en el juego, volver primero dentro del WebView
        // o a la pantalla de conexion; si no, salir.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (connected) {
                    if (web.canGoBack()) web.goBack() else showConnectPanel()
                } else {
                    finish()
                }
            }
        })
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true           // localStorage (preferencias)
            mediaPlaybackRequiresUserGesture = false  // audio/video sin gesto
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            // Permitir audio/WebGL a pleno rendimiento.
            setSupportZoom(false)
        }
        web.setBackgroundColor(0xFF05060F.toInt())
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                // Una vez cargado, entrar en modo inmersivo.
                enterImmersive()
            }
        }
        web.webChromeClient = WebChromeClient()
    }

    private fun connect(url: String) {
        connected = true
        connectView.visibility = View.GONE
        web.visibility = View.VISIBLE
        web.loadUrl(url)
        enterImmersive()
    }

    private fun showConnectPanel() {
        connected = false
        web.loadUrl("about:blank")
        web.visibility = View.GONE
        connectView.visibility = View.VISIBLE
    }

    /** Acepta "ip:puerto", "ip", "host/#join=XXXX" o una URL http(s) completa. */
    private fun normalizeUrl(raw: String): String {
        var s = raw
        if (!s.startsWith("http://") && !s.startsWith("https://")) {
            // Si no trae puerto ni es un dominio publico, asumimos :5174 (LAN).
            s = if (s.contains(":") || s.contains(".lt") || s.contains("loca.lt") || s.contains("/")) {
                "http://$s"
            } else {
                "http://$s:5174"
            }
        }
        return s
    }

    private fun enterImmersive() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && connected) enterImmersive()
    }

    override fun onPause() {
        super.onPause()
        if (connected) web.onPause()
    }

    override fun onResume() {
        super.onResume()
        if (connected) web.onResume()
    }
}
