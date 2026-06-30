package com.rhythmdance.app

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.io.ByteArrayInputStream
import java.util.Locale

// Aloja el juego web COMPLETO (assets/dist) en un WebView y sirve los endpoints
// /api/* de forma nativa con ApiHandler, para jugar OFFLINE sin PC.
//
// - Las peticiones GET a https://rd.local/api/* las atiende ApiHandler.handle().
// - Los assets estaticos (html/js/css/skins) se sirven desde assets/dist.
// - Las mutaciones (POST/PUT/DELETE) llegan por el puente JS AndroidBridge
//   (inyectado en index.html) -> ApiHandler.handleMutation().
class GameWebViewActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val api by lazy { ApiHandler(this) }

    // Selector de carpeta del sistema (SAF): el usuario elige CUALQUIER carpeta
    // (incl. tarjeta SD). Persistimos el permiso y la guardamos como fuente.
    private val folderPicker: ActivityResultLauncher<Uri?> =
        registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
            if (uri != null) {
                try {
                    contentResolver.takePersistableUriPermission(
                        uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                    )
                } catch (_: Exception) {}
                api.setSafTree(uri.toString())
                runOnUiThread {
                    webView.evaluateJavascript("window.dispatchEvent(new Event('rd-folder-changed'))", null)
                }
            }
        }

    companion object {
        private const val HOST = "rd.local"
        private const val BASE = "https://rd.local/"
        private const val PERM = 1001
        // Inyectado en index.html: enruta fetch() de /api/* no-GET al puente nativo.
        private const val SCRIPT_INJECT = """
<script>
(function(){
  var origFetch = window.fetch.bind(window);
  window.fetch = function(url, opts){
    var u = typeof url === 'string' ? url : (url && (url.url || url.href) || '');
    var isApi = u.indexOf('/api/') >= 0;
    if (!isApi) return origFetch(url, opts);
    if (!opts || !opts.method || opts.method === 'GET') return origFetch(url, opts);
    var p = u; try { p = new URL(u, location.href).pathname + (new URL(u, location.href).search || ''); } catch(e){}
    var uid = (window.authUserId || '') + '';
    var body = '';
    if (opts.body) body = (typeof opts.body === 'string') ? opts.body : JSON.stringify(opts.body);
    try {
      var result = AndroidBridge.apiMutate(p, opts.method, uid, body);
      return Promise.resolve(new Response(result, {status:200, statusText:'OK', headers:new Headers({'Content-Type':'application/json'})}));
    } catch(e){ return Promise.reject(new Error(e)); }
  };
})();
</script>
"""
    }

    inner class JsBridge {
        @JavascriptInterface
        fun apiMutate(url: String, method: String, uid: String, body: String): String =
            api.handleMutation(url, method, uid, body)

        // Abre el selector de carpeta del sistema (SAF) desde el juego web.
        @JavascriptInterface
        fun pickFolderSAF() {
            runOnUiThread { try { folderPicker.launch(null) } catch (_: Exception) {} }
        }

        @JavascriptInterface
        fun hasSAF(): Boolean = true
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        requestAudioPermission()

        webView = WebView(this)
        WebView.setWebContentsDebuggingEnabled(true)
        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.allowFileAccess = true
        s.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        webView.addJavascriptInterface(JsBridge(), "AndroidBridge")
        webView.webViewClient = Client()
        setContentView(webView)
        webView.loadUrl(BASE + "index.html")
    }

    private fun requestAudioPermission() {
        val perms = if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.READ_MEDIA_AUDIO)
        else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        val need = perms.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (need.isNotEmpty()) ActivityCompat.requestPermissions(this, need.toTypedArray(), PERM)
    }

    override fun onResume() {
        super.onResume()
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private inner class Client : WebViewClient() {
        override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
            val url = request?.url ?: return null
            if (url.host != HOST) return null
            val path = url.path ?: "/"
            val method = request.method ?: "GET"
            // GET /api/* -> backend nativo. (no-GET va por el puente JS)
            if (path.startsWith("/api/")) {
                if (method.equals("GET", true)) return api.handle(path, url)
                return WebResourceResponse("application/json", "UTF-8", ByteArrayInputStream("{\"ok\":true}".toByteArray()))
            }
            return serveAsset(path)
        }
    }

    // Sirve un archivo estatico desde assets/dist. Para index.html inyecta el
    // puente JS antes de </head>.
    private fun serveAsset(path: String): WebResourceResponse? {
        val rel = if (path == "/" || path.isBlank()) "index.html" else path.removePrefix("/")
        val assetPath = "dist/$rel"
        return try {
            if (rel == "index.html") {
                val html = assets.open(assetPath).bufferedReader().use { it.readText() }
                val injected = if (html.contains("</head>")) html.replaceFirst("</head>", "$SCRIPT_INJECT</head>")
                else SCRIPT_INJECT + html
                WebResourceResponse("text/html", "UTF-8", ByteArrayInputStream(injected.toByteArray(Charsets.UTF_8)))
            } else {
                val stream = assets.open(assetPath)
                WebResourceResponse(mimeOf(rel), null, stream)
            }
        } catch (e: Exception) {
            // 404 silencioso
            WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, ByteArrayInputStream(ByteArray(0)))
        }
    }

    private fun mimeOf(path: String): String {
        val ext = path.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return when (ext) {
            "js", "mjs" -> "application/javascript"
            "css" -> "text/css"
            "html" -> "text/html"
            "json" -> "application/json"
            "png" -> "image/png"; "jpg", "jpeg" -> "image/jpeg"; "gif" -> "image/gif"
            "svg" -> "image/svg+xml"; "webp" -> "image/webp"
            "woff" -> "font/woff"; "woff2" -> "font/woff2"; "ttf" -> "font/ttf"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
        }
    }
}
