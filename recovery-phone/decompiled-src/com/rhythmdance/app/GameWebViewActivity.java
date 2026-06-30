package com.rhythmdance.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.os.EnvironmentCompat;
import androidx.webkit.internal.AssetHelper;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import com.rhythmdance.app.GameWebViewActivity;
import com.rhythmdance.app.game.AudioDecoder;
import com.rhythmdance.app.game.Chart;
import com.rhythmdance.app.game.ChartGenerator;
import com.rhythmdance.app.game.DecodedAudio;
import com.rhythmdance.app.game.Note;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PipedInputStream;
import java.io.PipedOutputStream;
import java.io.Reader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import kotlin.Metadata;
import kotlin.UByte;
import kotlin.Unit;
import kotlin.collections.ArraysKt;
import kotlin.collections.CollectionsKt;
import kotlin.collections.IntIterator;
import kotlin.collections.SetsKt;
import kotlin.comparisons.ComparisonsKt;
import kotlin.concurrent.ThreadsKt;
import kotlin.io.ByteStreamsKt;
import kotlin.io.CloseableKt;
import kotlin.io.FilesKt;
import kotlin.io.TextStreamsKt;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.IntRange;
import kotlin.ranges.RangesKt;
import kotlin.sequences.Sequence;
import kotlin.sequences.SequencesKt;
import kotlin.text.Charsets;
import kotlin.text.MatchResult;
import kotlin.text.Regex;
import kotlin.text.StringsKt;
import kotlinx.coroutines.DebugKt;
import org.json.JSONArray;
import org.json.JSONObject;
import org.schabi.newpipe.extractor.InfoItem;
import org.schabi.newpipe.extractor.ListExtractor;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.linkhandler.SearchQueryHandlerFactory;
import org.schabi.newpipe.extractor.search.SearchExtractor;
import org.schabi.newpipe.extractor.services.peertube.PeertubeParsingHelper;
import org.schabi.newpipe.extractor.services.youtube.YoutubeParsingHelper;
import org.schabi.newpipe.extractor.services.youtube.YoutubeService;
import org.schabi.newpipe.extractor.stream.Stream;
import org.schabi.newpipe.extractor.stream.StreamInfoItem;
import org.schabi.newpipe.extractor.utils.Utils;

/* compiled from: GameWebViewActivity.kt */
@Metadata(d1 = {"\u0000d\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\u0011\n\u0000\n\u0002\u0010\u0015\n\u0002\b\u0004\n\u0002\u0010\u000b\n\u0000\n\u0002\u0010\u0012\n\u0002\b\b\u0018\u0000 *2\u00020\u0001:\u0004)*+,B\u0005¢\u0006\u0002\u0010\u0002J\b\u0010\u000f\u001a\u00020\u0010H\u0002J\"\u0010\u0011\u001a\u00020\u00102\u0006\u0010\u0012\u001a\u00020\b2\u0006\u0010\u0013\u001a\u00020\b2\b\u0010\u0014\u001a\u0004\u0018\u00010\u0015H\u0014J\u0012\u0010\u0016\u001a\u00020\u00102\b\u0010\u0017\u001a\u0004\u0018\u00010\u0018H\u0015J\b\u0010\u0019\u001a\u00020\u0010H\u0014J+\u0010\u001a\u001a\u00020\u00102\u0006\u0010\u0012\u001a\u00020\b2\f\u0010\u001b\u001a\b\u0012\u0004\u0012\u00020\u00060\u001c2\u0006\u0010\u001d\u001a\u00020\u001eH\u0016¢\u0006\u0002\u0010\u001fJ\b\u0010 \u001a\u00020\u0010H\u0014J\u0010\u0010!\u001a\u00020\u00102\u0006\u0010\"\u001a\u00020#H\u0016J\u0012\u0010$\u001a\u0004\u0018\u00010%2\u0006\u0010&\u001a\u00020\u0006H\u0002J\u0012\u0010'\u001a\u0004\u0018\u00010\u00062\u0006\u0010&\u001a\u00020\u0006H\u0002J\b\u0010(\u001a\u00020\u0010H\u0002R\u0012\u0010\u0003\u001a\u00060\u0004R\u00020\u0000X\u0082\u0004¢\u0006\u0002\n\u0000R\u0010\u0010\u0005\u001a\u0004\u0018\u00010\u0006X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\bX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\nX\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\fX\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\u000eX\u0082.¢\u0006\u0002\n\u0000¨\u0006-"}, d2 = {"Lcom/rhythmdance/app/GameWebViewActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "()V", "api", "Lcom/rhythmdance/app/GameWebViewActivity$ApiHandler;", "pendingQrCallback", "", "qrCallbackId", "", "touchOverlay", "Lcom/rhythmdance/app/TouchControlsOverlay;", "vsManager", "Lcom/rhythmdance/app/VsManager;", "webView", "Landroid/webkit/WebView;", "enterImmersive", "", "onActivityResult", "requestCode", "resultCode", "data", "Landroid/content/Intent;", "onCreate", "savedInstanceState", "Landroid/os/Bundle;", "onDestroy", "onRequestPermissionsResult", "permissions", "", "grantResults", "", "(I[Ljava/lang/String;[I)V", "onResume", "onWindowFocusChanged", "hasFocus", "", "readAssetBytes", "", "path", "readAssetString", "requestAudioPermission", "ApiHandler", "Companion", "GameWebViewClient", "JsBridge", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class GameWebViewActivity extends AppCompatActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private final ApiHandler api = new ApiHandler();
    private String pendingQrCallback;
    private int qrCallbackId;
    private TouchControlsOverlay touchOverlay;
    private VsManager vsManager;
    private WebView webView;

    /* renamed from: Companion, reason: from kotlin metadata */
    public static final Companion INSTANCE = new Companion(null);
    private static final Map<String, String> SONG_ID_CACHE = new LinkedHashMap();
    private static final String SCRIPT_FETCH_OVERRIDE = "\n<script>\n(function(){\n    const origFetch = window.fetch.bind(window);\n    window.fetch = function(url, opts) {\n        const u = typeof url === 'string' ? url : (url.url || url.href || '');\n        if (!u.startsWith('/api/')) return origFetch(url, opts);\n        if (!opts || !opts.method || opts.method === 'GET') {\n            return origFetch(url, opts);\n        }\n        var uid = (window.authUserId || '') + '';\n        var body = '';\n        if (opts.body) {\n            body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);\n        }\n        try {\n            var result = AndroidBridge.apiMutate(u, opts.method, uid, body);\n            return Promise.resolve(new Response(result, {\n                status: 200, statusText: 'OK',\n                headers: new Headers({'Content-Type': 'application/json'})\n            }));\n        } catch(e) {\n            return Promise.reject(new Error(e));\n        }\n    };\n})();\n</script>\n<script>\n// Override EventSource para /api/download (SSE -> POST + polling)\n(function(){\n    if (window.__dlPatched) return;\n    window.__dlPatched = true;\n    var OrigES = window.EventSource;\n    window.EventSource = function(url) {\n        if (typeof url !== 'string') return new OrigES(url);\n        // Download: POST + polling\n        if (url.indexOf('/api/download') >= 0) {\n            var target = {\n                _listeners: {}, readyState: 0, onmessage: null, onerror: null,\n                addEventListener: function(t, cb) {\n                    if (!this._listeners[t]) this._listeners[t] = [];\n                    this._listeners[t].push(cb);\n                },\n                removeEventListener: function(t, cb) {\n                    if (!this._listeners[t]) return;\n                    this._listeners[t] = this._listeners[t].filter(function(f){ return f !== cb; });\n                },\n                _fire: function(t, data) {\n                    var ev = {type:t, data:data};\n                    var arr = this._listeners[t];\n                    if (arr) arr.forEach(function(f){ f(ev); });\n                    if (t === 'message' && this.onmessage) this.onmessage(ev);\n                    if (t === 'error' && this.onerror) this.onerror(ev);\n                },\n                close: function(){}\n            };\n            try {\n                var parts = url.split('?')[0].split('/');\n                var songId = parts[parts.length - 1];\n                var qs = url.split('?')[1] || '';\n                var params = new URLSearchParams(qs);\n                var dlUrl = params.get('url') || '';\n                var folder = params.get('folder') || '';\n                fetch('/api/download', {\n                    method: 'POST',\n                    headers: {'Content-Type': 'application/json'},\n                    body: JSON.stringify({url: dlUrl})\n                }).then(function(r){ return r.json(); }).then(function(data){\n                    if (data.type === 'started' && data.id) {\n                        target.readyState = 1;\n                        var poll = setInterval(function(){\n                            fetch('/api/download/status/' + data.id)\n                                .then(function(r){ return r.json(); })\n                                .then(function(st){\n                                    if (st.type === 'success' || st.type === 'done') {\n                                        target._fire('message', JSON.stringify({type:'done', file:st.file || ''}));\n                                        clearInterval(poll);\n                                        target.readyState = 2;\n                                    } else if (st.type === 'error') {\n                                        target._fire('message', JSON.stringify({type:'error', message:st.message || ''}));\n                                        clearInterval(poll);\n                                        target.readyState = 2;\n                                    } else {\n                                        target._fire('message', JSON.stringify({type:'progress', percent:st.progress || 0, stage:st.message || ''}));\n                                    }\n                                });\n                        }, 1000);\n                    } else {\n                        target._fire('message', JSON.stringify({type:'error', message: data.message || 'Error al iniciar descarga'}));\n                        target.readyState = 2;\n                    }\n                }).catch(function(err){\n                    target._fire('message', JSON.stringify({type:'error', message: 'Error: ' + (err.message || 'desconocido')}));\n                    target.readyState = 2;\n                });\n            } catch(e) {}\n        }\n        return new OrigES(url);\n    };\n})();\n</script>\n";
    private static final String errorPage = "<html><body style='color:white;background:#05060F;padding:40px;font-family:sans-serif'><h1>Error: frontend no encontrado</h1><p>Ejecutá npm run build:client antes de compilar el APK</p></body></html>";
    private static final String SYNC_PANEL_HTML = "\n<hr style=\"margin:20px 0;opacity:0.3\">\n<div id=\"syncPanel\" style=\"padding:16px;background:#0a0b1a;border:1px solid #333;border-radius:12px;margin:12px 0\">\n  <h2 style=\"margin:0 0 4px\">🔄 Sincronizar con PC</h2>\n  <p style=\"color:#888;font-size:12px;margin:4px 0 12px\">Conectate al juego de PC en la misma red WiFi para copiar canciones</p>\n  <div id=\"syncInputs\" style=\"display:flex;gap:8px;margin:8px 0\">\n    <input id=\"syncIP\" placeholder=\"IP del PC (ej: 192.168.1.50)\" style=\"flex:1;padding:10px;background:#0a0b1a;border:1px solid #333;color:#fff;border-radius:6px\">\n    <input id=\"syncPort\" value=\"5174\" style=\"width:70px;padding:10px;background:#0a0b1a;border:1px solid #333;color:#fff;border-radius:6px\">\n    <button id=\"scanQrBtn\" class=\"mini-btn\" style=\"padding:10px 14px;font-size:18px\" title=\"Escanear QR del PC\">📷</button>\n  </div>\n  <button id=\"syncStartBtn\" class=\"btn btn-accent\">Sincronizar con PC</button>\n  <div id=\"syncProgressArea\" style=\"display:none;margin-top:10px\">\n    <div style=\"display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px\">\n      <span id=\"syncStatus\">Conectando...</span>\n      <span id=\"syncPct\">0%</span>\n    </div>\n    <div style=\"width:100%;height:14px;background:#111;border-radius:7px;overflow:hidden\">\n      <div id=\"syncBar\" style=\"width:0%;height:100%;background:linear-gradient(90deg,#4a9eff,#7c5cfc);border-radius:7px;transition:width .3s\"></div>\n    </div>\n    <p id=\"syncDetail\" style=\"color:#888;font-size:11px;margin:6px 0 0\">Iniciando...</p>\n  </div>\n  <div id=\"syncDone\" style=\"display:none;margin-top:10px;padding:10px;background:#0a1a0a;border:1px solid #2a5a2a;border-radius:8px;color:#8f8\">\n    <strong>✓ Sincronización completa</strong>\n    <span id=\"syncSummary\" style=\"display:block;font-size:12px;margin-top:4px\"></span>\n  </div>\n  <div id=\"syncError\" style=\"display:none;margin-top:10px;padding:10px;background:#1a0a0a;border:1px solid #5a2a2a;border-radius:8px;color:#f88\"></div>\n</div>\n<script>\n(function(){\n  var syncing = false;\n  document.getElementById('scanQrBtn').addEventListener('click', function(){\n    try { AndroidBridge.scanQR(Date.now()+''); } catch(e) { alert('Error al abrir escáner: '+e.message); }\n  });\n  function setUI(s, p, detail){\n    document.getElementById('syncStatus').textContent = s;\n    document.getElementById('syncPct').textContent = p+'%';\n    document.getElementById('syncBar').style.width = p+'%';\n    if(detail) document.getElementById('syncDetail').textContent = detail;\n  }\n  function showError(msg){\n    document.getElementById('syncError').style.display='block';\n    document.getElementById('syncError').textContent='Error: '+msg;\n    document.getElementById('syncProgressArea').style.display='none';\n    syncing=false;\n  }\n  function syncAll(ip, port){\n    if(syncing) return; syncing=true;\n    document.getElementById('syncInputs').style.display='none';\n    document.getElementById('syncStartBtn').style.display='none';\n    document.getElementById('syncProgressArea').style.display='block';\n    document.getElementById('syncDone').style.display='none';\n    document.getElementById('syncError').style.display='none';\n    setUI('Conectando...',0,'');\n    fetch('/api/sync/sync-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:ip,port:port})})\n    .then(function(r){return r.json()}).then(function(d){\n      if(d.type!=='started'){showError(d.message||'Error al iniciar');return;}\n      var id=d.id;\n      var poll=setInterval(function(){\n        fetch('/api/download/status/'+id).then(function(r){return r.json()}).then(function(st){\n          if(st.type==='success'){\n            clearInterval(poll);\n            document.getElementById('syncDone').style.display='block';\n            document.getElementById('syncSummary').textContent=st.message||'Completado';\n            setUI('Completado',100,st.message||'');\n            syncing=false;\n          } else if(st.type==='error'){\n            clearInterval(poll);\n            showError(st.message||'Error durante sincronización');\n          } else {\n            setUI(st.message||'Sincronizando...',st.progress||0,'');\n          }\n        }).catch(function(){});\n      },500);\n    }).catch(function(e){showError(e.message);});\n  }\n  document.getElementById('syncStartBtn').addEventListener('click', function(){\n    var ip = document.getElementById('syncIP').value.trim();\n    var port = document.getElementById('syncPort').value.trim() || '5174';\n    syncAll(ip, port);\n  });\n  window.__onQrResult = function(cbId, ip, port) {\n    if (ip) {\n      document.getElementById('syncIP').value = ip;\n      document.getElementById('syncPort').value = port || '5174';\n      setTimeout(function(){ syncAll(ip, port||'5174'); }, 300);\n    }\n  };\n})();\n</script>\n";

    /* compiled from: GameWebViewActivity.kt */
    @Metadata(d1 = {"\u0000\u0094\u0001\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\b\n\u0000\n\u0002\u0010%\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0002\b\b\n\u0002\u0010\u000b\n\u0002\b\b\n\u0002\u0010\u0002\n\u0002\b\u0007\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u0012\n\u0002\b\u000b\n\u0002\u0018\u0002\n\u0002\b\u0016\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010$\n\u0002\b\f\n\u0002\u0010\"\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0012\b\u0086\u0004\u0018\u00002\u00020\u0001B\u0005¢\u0006\u0002\u0010\u0002J\u0010\u0010\u0014\u001a\u00020\r2\u0006\u0010\u0015\u001a\u00020\u0010H\u0002J\u0018\u0010\u0016\u001a\u00020\u00052\u0006\u0010\u0017\u001a\u00020\u00182\u0006\u0010\u0019\u001a\u00020\tH\u0002J\u001e\u0010\u001a\u001a\b\u0012\u0004\u0012\u00020\u00100\u00042\u0006\u0010\u001b\u001a\u00020\u00052\u0006\u0010\u001c\u001a\u00020\u0010H\u0002J\u001a\u0010\u001d\u001a\u0004\u0018\u00010\u00052\u0006\u0010\u001e\u001a\u00020\u00052\u0006\u0010\u001f\u001a\u00020\tH\u0002J\u0018\u0010 \u001a\u00020!2\u0006\u0010\"\u001a\u00020\u00052\u0006\u0010\u001f\u001a\u00020\tH\u0002J:\u0010#\u001a\u0004\u0018\u00010\t2\u0006\u0010$\u001a\u00020\u00052\u0006\u0010%\u001a\u00020\u00052\u0006\u0010\u001e\u001a\u00020\u00052\u0006\u0010&\u001a\u00020\u00052\u0006\u0010'\u001a\u00020\u00052\u0006\u0010(\u001a\u00020\tH\u0002J\b\u0010)\u001a\u00020*H\u0002J\b\u0010+\u001a\u00020*H\u0002J\u0010\u0010,\u001a\u00020\u00052\u0006\u0010-\u001a\u00020\u0005H\u0002J\u0018\u0010.\u001a\u00020\u00052\u0006\u0010/\u001a\u00020\u00052\u0006\u00100\u001a\u00020\u0005H\u0002J\u0010\u00101\u001a\u0002022\u0006\u00103\u001a\u00020\u0005H\u0002J\u0012\u00104\u001a\u0004\u0018\u00010\u00052\u0006\u0010\u001e\u001a\u00020\u0005H\u0002J\b\u00105\u001a\u00020\tH\u0002J\u0018\u00106\u001a\u00020\r2\u0006\u00107\u001a\u0002082\u0006\u00109\u001a\u000208H\u0002J\u0012\u0010:\u001a\u0004\u0018\u00010\u00052\u0006\u0010;\u001a\u00020\tH\u0002J.\u0010<\u001a\u00020\u00052\u0006\u0010=\u001a\u00020\u00052\u0006\u0010>\u001a\u00020\u00052\u0006\u0010?\u001a\u00020\r2\u0006\u0010@\u001a\u00020\u00052\u0006\u0010A\u001a\u00020\u0005J\u000e\u0010B\u001a\u00020\u00052\u0006\u0010C\u001a\u00020DJ\u0006\u0010E\u001a\u00020\u0005J\u0006\u0010F\u001a\u00020\u0005J\u000e\u0010G\u001a\u00020\u00052\u0006\u0010=\u001a\u00020\u0005J&\u0010H\u001a\u00020\u00052\u0006\u0010I\u001a\u00020\u00052\u0006\u0010>\u001a\u00020\u00052\u0006\u0010A\u001a\u00020\u00052\u0006\u0010?\u001a\u00020\rJ\u0006\u0010J\u001a\u00020\u0005J\u0010\u0010K\u001a\u00020\u00052\u0006\u0010L\u001a\u00020\u0005H\u0002J\u000e\u0010M\u001a\u00020\u00052\u0006\u0010N\u001a\u00020\u0005J\u000e\u0010O\u001a\u00020\u00052\u0006\u0010C\u001a\u00020DJ\u000e\u0010P\u001a\u00020\u00052\u0006\u0010I\u001a\u00020\u0005J\u000e\u0010Q\u001a\u00020\u00052\u0006\u0010R\u001a\u00020\u0005J\u000e\u0010S\u001a\u00020\u00052\u0006\u0010I\u001a\u00020\u0005J\u0016\u0010T\u001a\u00020\u00052\u0006\u0010I\u001a\u00020\u00052\u0006\u0010A\u001a\u00020\u0005J\u000e\u0010U\u001a\u00020\u00052\u0006\u0010C\u001a\u00020DJ\b\u0010V\u001a\u00020\u0005H\u0002J\b\u0010W\u001a\u00020\u0005H\u0002J \u0010X\u001a\u0004\u0018\u00010\u00132\u0006\u0010Y\u001a\u00020\u00052\u0006\u0010Z\u001a\u00020[2\u0006\u0010\\\u001a\u00020\u0005J&\u0010]\u001a\u00020\u00052\u0006\u0010\u001e\u001a\u00020\u00052\u0006\u0010\\\u001a\u00020\u00052\u0006\u0010\u001b\u001a\u00020\u00052\u0006\u0010^\u001a\u00020\u0005J,\u0010_\u001a\u00020*2\u0006\u0010$\u001a\u00020\u00052\u0006\u0010%\u001a\u00020\u00052\u0012\u0010`\u001a\u000e\u0012\u0004\u0012\u00020\u0005\u0012\u0004\u0012\u00020\u00050aH\u0002J\u0012\u0010b\u001a\u0004\u0018\u00010\u00052\u0006\u0010Y\u001a\u00020\u0005H\u0002J\u0010\u0010c\u001a\u00020\t2\u0006\u0010&\u001a\u00020\u0005H\u0002J\u000e\u0010d\u001a\u00020\u00052\u0006\u0010C\u001a\u00020DJ\u0010\u0010e\u001a\u0002082\u0006\u0010f\u001a\u000208H\u0002J\u0012\u0010g\u001a\u0004\u0018\u00010\u00102\u0006\u0010&\u001a\u00020\u0005H\u0002J\b\u0010h\u001a\u00020\tH\u0002J\u0016\u0010i\u001a\u00020*2\u0006\u0010C\u001a\u00020D2\u0006\u0010j\u001a\u00020\u0005J>\u0010k\u001a\u00020*2\u0006\u0010l\u001a\u00020\t2\f\u0010m\u001a\b\u0012\u0004\u0012\u00020\u00050n2\u0016\u0010o\u001a\u0012\u0012\u0004\u0012\u00020\u00050pj\b\u0012\u0004\u0012\u00020\u0005`q2\u0006\u0010r\u001a\u00020sH\u0002J\b\u0010t\u001a\u00020\tH\u0002J\u0010\u0010u\u001a\u00020\u00052\u0006\u0010v\u001a\u00020\u0005H\u0002J\u0012\u0010w\u001a\u0004\u0018\u00010\u00132\u0006\u0010I\u001a\u00020\u0005H\u0002J\u0018\u0010x\u001a\u00020\u00052\u0006\u0010$\u001a\u00020\u00052\u0006\u0010%\u001a\u00020\u0005H\u0002J(\u0010y\u001a\u00020\u00052\u0006\u0010$\u001a\u00020\u00052\u0006\u0010%\u001a\u00020\u00052\u0006\u0010\u001e\u001a\u00020\u00052\u0006\u0010&\u001a\u00020\u0005H\u0002J\u0010\u0010z\u001a\u00020\u00052\u0006\u0010\u001e\u001a\u00020\u0005H\u0002J\u0010\u0010{\u001a\u00020*2\u0006\u0010-\u001a\u00020\u0005H\u0002J\b\u0010|\u001a\u0004\u0018\u00010\u0005J\b\u0010}\u001a\u0004\u0018\u00010\u0005J\u0018\u0010~\u001a\u00020\u00052\u0006\u0010$\u001a\u00020\u00052\u0006\u0010%\u001a\u00020\u0005H\u0002J\b\u0010\u007f\u001a\u00020*H\u0002J\t\u0010\u0080\u0001\u001a\u00020!H\u0002J\t\u0010\u0081\u0001\u001a\u00020!H\u0002J\u0019\u0010\u0082\u0001\u001a\u00020*2\u0006\u0010&\u001a\u00020\u00052\u0006\u0010\u0015\u001a\u00020\u0010H\u0002J\t\u0010\u0083\u0001\u001a\u00020\tH\u0002J\u0011\u0010\u0084\u0001\u001a\u00020\u00052\u0006\u0010\u001e\u001a\u00020\u0005H\u0002R\u0014\u0010\u0003\u001a\b\u0012\u0004\u0012\u00020\u00050\u0004X\u0082\u0004¢\u0006\u0002\n\u0000R\u0014\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\u00050\u0004X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0005X\u0082D¢\u0006\u0002\n\u0000R\u0014\u0010\b\u001a\u00020\t8BX\u0082\u0004¢\u0006\u0006\u001a\u0004\b\n\u0010\u000bR\u000e\u0010\f\u001a\u00020\rX\u0082\u000e¢\u0006\u0002\n\u0000R\u001a\u0010\u000e\u001a\u000e\u0012\u0004\u0012\u00020\u0005\u0012\u0004\u0012\u00020\u00100\u000fX\u0082\u0004¢\u0006\u0002\n\u0000R\u001a\u0010\u0011\u001a\u000e\u0012\u0004\u0012\u00020\u0005\u0012\u0004\u0012\u00020\u00130\u0012X\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006\u0085\u0001"}, d2 = {"Lcom/rhythmdance/app/GameWebViewActivity$ApiHandler;", "", "(Lcom/rhythmdance/app/GameWebViewActivity;)V", "FFPEG_SOURCES", "", "", "INVIDIOUS_FB", "YTDLP_URL", "binDir", "Ljava/io/File;", "getBinDir", "()Ljava/io/File;", "dlCounter", "", "downloadStatuses", "", "Lorg/json/JSONObject;", "jsonResp", "Lkotlin/Function1;", "Landroid/webkit/WebResourceResponse;", "bodySize", "obj", "chartToJson", "chart", "Lcom/rhythmdance/app/game/Chart;", "file", "checkNewAchievements", "userId", "scoreEntry", "downloadBinary", "url", "dest", "downloadFile", "", "rawUrl", "downloadSyncFile", "ip", "port", "name", "ext", "musicDir", "ensureFfmpeg", "", "ensureYtdlp", NotificationCompat.CATEGORY_ERROR, NotificationCompat.CATEGORY_MESSAGE, "extractExtFromShareUrl", "shareUrl", "defaultExt", "extractStreams", "Lcom/rhythmdance/app/StreamUrls;", YoutubeParsingHelper.VIDEO_ID, "extractVideoId", "ffmpegBin", "findBytes", "haystack", "", "needle", "findVideoFile", "audioFile", "generateChart", "songPath", "difficulty", "lanes", "genre", "game", "getAchievements", "ctx", "Landroid/content/Context;", "getAllReplays", "getAllScores", "getAudioUriString", "getCustomChart", "songId", "getDailyChallenge", "getDownloadStatus", "id", "getLeaderboard", "songHash", "getProfile", "getReplayBest", "getReplayById", "replayId", "getSongScores", "getSongSettings", "getStatus", "getYtdlpInfo", "getYtdlpState", "handle", "path", "uri", "Landroid/net/Uri;", "method", "handleMutation", "body", "importPCBackup", "idMap", "", "invGet", "jsonFile", "listSongs", "patchElfForAndroid", "bytes", "readJson", "replaysFile", "saveProfile", "json", "scanMusicFiles", "dir", "exts", "", "seen", "Ljava/util/HashSet;", "Lkotlin/collections/HashSet;", "out", "Lorg/json/JSONArray;", "scoresFile", "searchYoutube", "query", "serveAudio", "startSyncAll", "startSyncDownload", "startYtdlpDownload", "statusMsg", "syncDownloadFfmpeg", "syncDownloadYtdlp", "syncList", "triggerAutoDownload", "updateFfmpeg", "updateYtdlpBinary", "writeJson", "ytDlpBin", "ytDlpName", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public final class ApiHandler {
        private int dlCounter;
        private final Function1<String, WebResourceResponse> jsonResp = new Function1<String, WebResourceResponse>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$jsonResp$1
            @Override // kotlin.jvm.functions.Function1
            public final WebResourceResponse invoke(String json) {
                Intrinsics.checkNotNullParameter(json, "json");
                byte[] bytes = json.getBytes(Charsets.UTF_8);
                Intrinsics.checkNotNullExpressionValue(bytes, "getBytes(...)");
                return new WebResourceResponse("application/json", "UTF-8", new ByteArrayInputStream(bytes));
            }
        };
        private final Map<String, JSONObject> downloadStatuses = new LinkedHashMap();
        private final List<String> FFPEG_SOURCES = CollectionsKt.listOf((Object[]) new String[]{"https://github.com/icn3/ffmpeg-android-binaries/raw/master/bin/ffmpeg", "https://github.com/nicknisi/ffmpeg-android-binaries/raw/master/bin/arm64-v8a/ffmpeg"});
        private final String YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64";
        private final List<String> INVIDIOUS_FB = CollectionsKt.listOf("https://invidious.flokinet.to");

        public ApiHandler() {
        }

        private final int bodySize(JSONObject obj) {
            return obj.toString().length();
        }

        private final String chartToJson(Chart chart, File file) {
            JSONArray jSONArray = new JSONArray();
            for (Note note : chart.getNotes()) {
                JSONObject jSONObject = new JSONObject();
                jSONObject.put("time", note.getTime());
                jSONObject.put("lane", note.getLane());
                if (note.getDuration() > 0.0d) {
                    jSONObject.put("duration", note.getDuration());
                }
                jSONArray.put(jSONObject);
            }
            String absolutePath = file.getAbsolutePath();
            Intrinsics.checkNotNullExpressionValue(absolutePath, "getAbsolutePath(...)");
            byte[] bytes = absolutePath.getBytes(Charsets.UTF_8);
            Intrinsics.checkNotNullExpressionValue(bytes, "getBytes(...)");
            String encodeToString = Base64.encodeToString(bytes, 10);
            JSONObject jSONObject2 = new JSONObject();
            jSONObject2.put("id", encodeToString);
            jSONObject2.put("bpm", chart.getBpm());
            jSONObject2.put("offset", 0);
            jSONObject2.put("duration", chart.getDuration());
            jSONObject2.put("laneCount", chart.getLaneCount());
            jSONObject2.put("notes", jSONArray);
            jSONObject2.put("difficulty", "normal");
            MessageDigest messageDigest = MessageDigest.getInstance("SHA1");
            byte[] bytes2 = (((int) (chart.getDuration() * 10)) + ":" + chart.getBpm() + ":" + chart.getNotes().size() + ":" + chart.getLaneCount()).getBytes(Charsets.UTF_8);
            Intrinsics.checkNotNullExpressionValue(bytes2, "getBytes(...)");
            byte[] digest = messageDigest.digest(bytes2);
            Intrinsics.checkNotNullExpressionValue(digest, "digest(...)");
            jSONObject2.put("songHash", StringsKt.take(ArraysKt.joinToString$default(digest, (CharSequence) "", (CharSequence) null, (CharSequence) null, 0, (CharSequence) null, (Function1) new Function1<Byte, CharSequence>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$chartToJson$2$1
                public final CharSequence invoke(byte b) {
                    String format = String.format("%02x", Arrays.copyOf(new Object[]{Byte.valueOf(b)}, 1));
                    Intrinsics.checkNotNullExpressionValue(format, "format(...)");
                    return format;
                }

                @Override // kotlin.jvm.functions.Function1
                public /* bridge */ /* synthetic */ CharSequence invoke(Byte b) {
                    return invoke(b.byteValue());
                }
            }, 30, (Object) null), 16));
            String jSONObject3 = jSONObject2.toString();
            Intrinsics.checkNotNullExpressionValue(jSONObject3, "toString(...)");
            return jSONObject3;
        }

        private final List<JSONObject> checkNewAchievements(String userId, JSONObject scoreEntry) {
            JSONArray jSONArray;
            JSONArray jSONArray2;
            Set set;
            String str;
            int i;
            JSONObject readJson = readJson("unlocks.json");
            if (readJson == null) {
                readJson = new JSONObject();
                readJson.put("unlocked", new JSONArray());
            }
            JSONObject jSONObject = readJson;
            JSONArray optJSONArray = jSONObject.optJSONArray("unlocked");
            if (optJSONArray == null) {
                optJSONArray = new JSONArray();
            }
            JSONArray jSONArray3 = optJSONArray;
            int i2 = 0;
            IntRange until = RangesKt.until(0, jSONArray3.length());
            ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(until, 10));
            Iterator<Integer> it = until.iterator();
            while (it.hasNext()) {
                arrayList.add(jSONArray3.getString(((IntIterator) it).nextInt()));
            }
            Set mutableSet = CollectionsKt.toMutableSet(arrayList);
            ArrayList arrayList2 = new ArrayList();
            String readAssetString = GameWebViewActivity.this.readAssetString("dist/assets/achievements.json");
            if (readAssetString != null) {
                try {
                    jSONArray = new JSONArray(readAssetString);
                } catch (Exception e) {
                    jSONArray = new JSONArray();
                }
            } else {
                jSONArray = new JSONArray();
            }
            int i3 = 0;
            int length = jSONArray.length();
            while (i3 < length) {
                JSONObject jSONObject2 = jSONArray.getJSONObject(i3);
                String optString = jSONObject2.optString("id", "ach_" + i3);
                if (mutableSet.contains(optString)) {
                    jSONArray2 = jSONArray;
                    set = mutableSet;
                    str = readAssetString;
                    i = length;
                } else {
                    JSONObject optJSONObject = jSONObject2.optJSONObject("condition");
                    if (optJSONObject != null) {
                        jSONArray2 = jSONArray;
                        str = readAssetString;
                        if (scoreEntry.optInt("score", i2) >= optJSONObject.optInt("gte", i2)) {
                            mutableSet.add(optString);
                            jSONArray3.put(optString);
                            JSONObject jSONObject3 = new JSONObject();
                            set = mutableSet;
                            i = length;
                            jSONObject3.put("title", jSONObject2.optString("title", ""));
                            jSONObject3.put("description", jSONObject2.optString("description", ""));
                            jSONObject3.put("icon", jSONObject2.optString("icon", ""));
                            jSONObject3.put("rarity", jSONObject2.optString("rarity", "common"));
                            arrayList2.add(jSONObject3);
                        } else {
                            set = mutableSet;
                            i = length;
                        }
                    } else {
                        jSONArray2 = jSONArray;
                        set = mutableSet;
                        str = readAssetString;
                        i = length;
                    }
                }
                i3++;
                jSONArray = jSONArray2;
                readAssetString = str;
                mutableSet = set;
                length = i;
                i2 = 0;
            }
            jSONObject.put("unlocked", jSONArray3);
            writeJson("unlocks.json", jSONObject);
            return arrayList2;
        }

        private final String downloadBinary(String url, File dest) {
            String str;
            try {
                File parentFile = dest.getParentFile();
                if (parentFile != null) {
                    parentFile.mkdirs();
                }
                URL url2 = new URL(url);
                Log.e("YtDlp", "downloadBinary: connecting to " + url);
                URLConnection openConnection = url2.openConnection();
                Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
                HttpURLConnection httpURLConnection = (HttpURLConnection) openConnection;
                httpURLConnection.setRequestProperty("User-Agent", "RhythmDance/Android");
                httpURLConnection.setRequestProperty("Accept", "application/octet-stream");
                httpURLConnection.setInstanceFollowRedirects(true);
                httpURLConnection.setConnectTimeout(15000);
                httpURLConnection.setReadTimeout(120000);
                httpURLConnection.connect();
                int responseCode = httpURLConnection.getResponseCode();
                Log.e("YtDlp", "downloadBinary: HTTP " + responseCode);
                if (responseCode != 200) {
                    httpURLConnection.disconnect();
                    return "HTTP " + responseCode;
                }
                Log.e("YtDlp", "downloadBinary: content-length=" + httpURLConnection.getContentLength() + ", reading...");
                InputStream inputStream = httpURLConnection.getInputStream();
                try {
                    InputStream inputStream2 = inputStream;
                    Intrinsics.checkNotNull(inputStream2);
                    byte[] readBytes = ByteStreamsKt.readBytes(inputStream2);
                    CloseableKt.closeFinally(inputStream, null);
                    httpURLConnection.disconnect();
                    FilesKt.writeBytes(dest, patchElfForAndroid(readBytes));
                    dest.setExecutable(true);
                    Log.e("YtDlp", "downloadBinary: SUCCESS, file size=" + dest.length());
                    return null;
                } finally {
                }
            } catch (Exception e) {
                String message = e.getMessage();
                if (message == null || (str = StringsKt.take(message, 120)) == null) {
                    str = "?";
                }
                String str2 = "Ex: " + str;
                Log.e("YtDlp", "downloadBinary: " + str2, e);
                return str2;
            }
        }

        /* JADX INFO: Access modifiers changed from: private */
        public final boolean downloadFile(String rawUrl, File dest) {
            List split$default = StringsKt.split$default((CharSequence) rawUrl, new String[]{"|cookies="}, false, 0, 6, (Object) null);
            String replace$default = StringsKt.replace$default((String) split$default.get(0), "\\u0026", "&", false, 4, (Object) null);
            String str = (String) CollectionsKt.getOrNull(split$default, 1);
            if (str == null) {
                str = "";
            }
            Log.e("RhythmDance", "downloadFile: url=" + StringsKt.take(replace$default, 80) + "...");
            try {
                URLConnection openConnection = new URL(replace$default).openConnection();
                Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
                HttpURLConnection httpURLConnection = (HttpURLConnection) openConnection;
                httpURLConnection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36");
                httpURLConnection.setRequestProperty("Referer", "https://www.youtube.com/");
                httpURLConnection.setRequestProperty("Accept", "*/*");
                if (!StringsKt.isBlank(str)) {
                    httpURLConnection.setRequestProperty("Cookie", str);
                }
                httpURLConnection.setInstanceFollowRedirects(true);
                httpURLConnection.setConnectTimeout(10000);
                httpURLConnection.setReadTimeout(120000);
                int responseCode = httpURLConnection.getResponseCode();
                Log.e("RhythmDance", "downloadFile: HTTP " + responseCode + ", len=" + httpURLConnection.getContentLength());
                if (responseCode != 200) {
                    httpURLConnection.disconnect();
                    return false;
                }
                InputStream inputStream = httpURLConnection.getInputStream();
                try {
                    try {
                        InputStream inputStream2 = inputStream;
                        Intrinsics.checkNotNull(inputStream2);
                        byte[] readBytes = ByteStreamsKt.readBytes(inputStream2);
                        CloseableKt.closeFinally(inputStream, null);
                        FilesKt.writeBytes(dest, readBytes);
                        httpURLConnection.disconnect();
                        Log.e("RhythmDance", "downloadFile: wrote " + readBytes.length + " bytes to " + dest.getAbsolutePath());
                        return true;
                    } finally {
                    }
                } catch (Exception e) {
                    e = e;
                    Log.e("RhythmDance", "downloadFile FAIL: " + e.getMessage());
                    return false;
                }
            } catch (Exception e2) {
                e = e2;
            }
        }

        /* JADX INFO: Access modifiers changed from: private */
        public final File downloadSyncFile(String ip, String port, String url, String name, String ext, File musicDir) {
            String str = Utils.HTTP + ip + ":" + port + url;
            String take = StringsKt.take(new Regex("[/\\\\:*?\"<>|]").replace(name, "_"), 80);
            int i = 1;
            File file = new File(musicDir, take + "." + ext);
            while (file.exists()) {
                file = new File(musicDir, take + "_" + i + "." + ext);
                i++;
            }
            URLConnection openConnection = new URL(str).openConnection();
            Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
            HttpURLConnection httpURLConnection = (HttpURLConnection) openConnection;
            httpURLConnection.setConnectTimeout(10000);
            httpURLConnection.setReadTimeout(300000);
            if (httpURLConnection.getResponseCode() != 200) {
                throw new RuntimeException("HTTP " + httpURLConnection.getResponseCode());
            }
            FileOutputStream inputStream = httpURLConnection.getInputStream();
            try {
                InputStream inputStream2 = inputStream;
                inputStream = new FileOutputStream(file);
                try {
                    Intrinsics.checkNotNull(inputStream2);
                    ByteStreamsKt.copyTo$default(inputStream2, inputStream, 0, 2, null);
                    CloseableKt.closeFinally(inputStream, null);
                    CloseableKt.closeFinally(inputStream, null);
                    return file;
                } finally {
                }
            } finally {
            }
        }

        private final void ensureFfmpeg() {
            if (ffmpegBin().exists()) {
                return;
            }
            ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : true, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : null, (r12 & 16) != 0 ? -1 : 0, new Function0<Unit>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$ensureFfmpeg$1
                {
                    super(0);
                }

                @Override // kotlin.jvm.functions.Function0
                public /* bridge */ /* synthetic */ Unit invoke() {
                    invoke2();
                    return Unit.INSTANCE;
                }

                /* renamed from: invoke, reason: avoid collision after fix types in other method */
                public final void invoke2() {
                    GameWebViewActivity.ApiHandler.this.syncDownloadFfmpeg();
                }
            });
        }

        private final void ensureYtdlp() {
            if (ytDlpBin().exists()) {
                return;
            }
            ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : true, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : null, (r12 & 16) != 0 ? -1 : 0, new Function0<Unit>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$ensureYtdlp$1
                {
                    super(0);
                }

                @Override // kotlin.jvm.functions.Function0
                public /* bridge */ /* synthetic */ Unit invoke() {
                    invoke2();
                    return Unit.INSTANCE;
                }

                /* renamed from: invoke, reason: avoid collision after fix types in other method */
                public final void invoke2() {
                    GameWebViewActivity.ApiHandler.this.syncDownloadYtdlp();
                }
            });
        }

        private final String err(String msg) {
            return "{\"ok\":false,\"error\":\"" + StringsKt.replace$default(StringsKt.replace$default(msg, "\"", "\\\"", false, 4, (Object) null), "\n", "\\n", false, 4, (Object) null) + "\"}";
        }

        /* JADX INFO: Access modifiers changed from: private */
        public final String extractExtFromShareUrl(String shareUrl, String defaultExt) {
            try {
                byte[] decode = Base64.decode(StringsKt.substringAfterLast$default(shareUrl, "/", (String) null, 2, (Object) null), 8);
                Intrinsics.checkNotNullExpressionValue(decode, "decode(...)");
                String take = StringsKt.take(StringsKt.substringAfterLast$default(new String(decode, Charsets.UTF_8), ".", (String) null, 2, (Object) null), 5);
                if (take.length() == 0) {
                    take = defaultExt;
                }
                return take;
            } catch (Exception e) {
                return defaultExt;
            }
        }

        /* JADX INFO: Access modifiers changed from: private */
        /* JADX WARN: Code restructure failed: missing block: B:149:?, code lost:
        
            return new com.rhythmdance.app.StreamUrls(r13, null, null, "No audio URL");
         */
        /* JADX WARN: Removed duplicated region for block: B:106:0x03e8 A[Catch: Exception -> 0x04e0, TryCatch #0 {Exception -> 0x04e0, blocks: (B:3:0x0020, B:5:0x0067, B:8:0x0087, B:10:0x0093, B:12:0x009d, B:13:0x00a4, B:15:0x00aa, B:17:0x00c9, B:19:0x00e8, B:20:0x00f3, B:21:0x0138, B:23:0x013e, B:30:0x0166, B:32:0x016c, B:35:0x01af, B:37:0x017f, B:40:0x0192, B:41:0x01b7, B:43:0x01cf, B:47:0x01dc, B:49:0x01e4, B:51:0x01ed, B:53:0x01f5, B:56:0x04be, B:58:0x0212, B:60:0x026b, B:62:0x0294, B:64:0x02a3, B:70:0x02b8, B:72:0x02be, B:78:0x02d3, B:79:0x0314, B:81:0x0319, B:88:0x032a, B:90:0x032f, B:95:0x033b, B:97:0x035a, B:100:0x0396, B:102:0x039c, B:104:0x03a7, B:106:0x03e8, B:108:0x03f6, B:112:0x042c, B:116:0x040a, B:141:0x0442, B:143:0x0457, B:148:0x0461, B:150:0x046c, B:152:0x0487, B:153:0x04a1, B:161:0x00eb), top: B:2:0x0020 }] */
        /* JADX WARN: Removed duplicated region for block: B:126:0x0427  */
        /* JADX WARN: Removed duplicated region for block: B:133:0x0327  */
        /* JADX WARN: Removed duplicated region for block: B:135:0x02d0  */
        /* JADX WARN: Removed duplicated region for block: B:137:0x02b5  */
        /* JADX WARN: Removed duplicated region for block: B:69:0x02b1  */
        /* JADX WARN: Removed duplicated region for block: B:77:0x02cc  */
        /* JADX WARN: Removed duplicated region for block: B:86:0x0325  */
        /* JADX WARN: Removed duplicated region for block: B:88:0x032a A[Catch: Exception -> 0x04e0, TryCatch #0 {Exception -> 0x04e0, blocks: (B:3:0x0020, B:5:0x0067, B:8:0x0087, B:10:0x0093, B:12:0x009d, B:13:0x00a4, B:15:0x00aa, B:17:0x00c9, B:19:0x00e8, B:20:0x00f3, B:21:0x0138, B:23:0x013e, B:30:0x0166, B:32:0x016c, B:35:0x01af, B:37:0x017f, B:40:0x0192, B:41:0x01b7, B:43:0x01cf, B:47:0x01dc, B:49:0x01e4, B:51:0x01ed, B:53:0x01f5, B:56:0x04be, B:58:0x0212, B:60:0x026b, B:62:0x0294, B:64:0x02a3, B:70:0x02b8, B:72:0x02be, B:78:0x02d3, B:79:0x0314, B:81:0x0319, B:88:0x032a, B:90:0x032f, B:95:0x033b, B:97:0x035a, B:100:0x0396, B:102:0x039c, B:104:0x03a7, B:106:0x03e8, B:108:0x03f6, B:112:0x042c, B:116:0x040a, B:141:0x0442, B:143:0x0457, B:148:0x0461, B:150:0x046c, B:152:0x0487, B:153:0x04a1, B:161:0x00eb), top: B:2:0x0020 }] */
        /* JADX WARN: Removed duplicated region for block: B:95:0x033b A[Catch: Exception -> 0x04e0, TryCatch #0 {Exception -> 0x04e0, blocks: (B:3:0x0020, B:5:0x0067, B:8:0x0087, B:10:0x0093, B:12:0x009d, B:13:0x00a4, B:15:0x00aa, B:17:0x00c9, B:19:0x00e8, B:20:0x00f3, B:21:0x0138, B:23:0x013e, B:30:0x0166, B:32:0x016c, B:35:0x01af, B:37:0x017f, B:40:0x0192, B:41:0x01b7, B:43:0x01cf, B:47:0x01dc, B:49:0x01e4, B:51:0x01ed, B:53:0x01f5, B:56:0x04be, B:58:0x0212, B:60:0x026b, B:62:0x0294, B:64:0x02a3, B:70:0x02b8, B:72:0x02be, B:78:0x02d3, B:79:0x0314, B:81:0x0319, B:88:0x032a, B:90:0x032f, B:95:0x033b, B:97:0x035a, B:100:0x0396, B:102:0x039c, B:104:0x03a7, B:106:0x03e8, B:108:0x03f6, B:112:0x042c, B:116:0x040a, B:141:0x0442, B:143:0x0457, B:148:0x0461, B:150:0x046c, B:152:0x0487, B:153:0x04a1, B:161:0x00eb), top: B:2:0x0020 }] */
        /*
            Code decompiled incorrectly, please refer to instructions dump.
        */
        public final StreamUrls extractStreams(String videoId) {
            Object obj;
            JSONArray jSONArray;
            JSONArray jSONArray2;
            String str;
            String str2;
            String str3;
            boolean z;
            String str4;
            String str5;
            String str6;
            String str7;
            boolean z2;
            String str8;
            List<String> groupValues;
            boolean z3;
            boolean z4;
            String str9;
            boolean z5;
            boolean z6;
            List<String> list;
            String str10 = "UTF-8";
            String str11 = "|cookies=";
            Log.e("RhythmDance", "scrape: vid=" + videoId);
            String str12 = null;
            try {
                URLConnection openConnection = new URL("https://www.youtube.com/watch?v=" + videoId).openConnection();
                Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
                HttpURLConnection httpURLConnection = (HttpURLConnection) openConnection;
                httpURLConnection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
                httpURLConnection.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                httpURLConnection.setInstanceFollowRedirects(true);
                httpURLConnection.setConnectTimeout(10000);
                httpURLConnection.setReadTimeout(15000);
                if (httpURLConnection.getResponseCode() != 200) {
                    httpURLConnection.disconnect();
                    return new StreamUrls(null, null, null, "HTTP " + httpURLConnection.getResponseCode());
                }
                StringBuilder sb = new StringBuilder();
                Map<String, List<String>> headerFields = httpURLConnection.getHeaderFields();
                if (headerFields != null && (list = headerFields.get("Set-Cookie")) != null) {
                    for (String str13 : list) {
                        Intrinsics.checkNotNull(str13);
                        sb.append(StringsKt.substringBefore$default(str13, ";", str12, 2, str12)).append("; ");
                        str12 = null;
                    }
                }
                String sb2 = sb.toString();
                Intrinsics.checkNotNullExpressionValue(sb2, "toString(...)");
                InputStream inputStream = httpURLConnection.getInputStream();
                Intrinsics.checkNotNullExpressionValue(inputStream, "getInputStream(...)");
                Reader inputStreamReader = new InputStreamReader(inputStream, Charsets.UTF_8);
                String readText = TextStreamsKt.readText(inputStreamReader instanceof BufferedReader ? (BufferedReader) inputStreamReader : new BufferedReader(inputStreamReader, 8192));
                httpURLConnection.disconnect();
                Log.e("RhythmDance", "scrape: got " + readText.length() + " bytes HTML");
                List list2 = SequencesKt.toList(Regex.findAll$default(new Regex("ytInitialPlayerResponse\\s*=\\s*(\\{.+?\\});"), readText, 0, 2, null));
                Iterator it = list2.iterator();
                while (true) {
                    if (!it.hasNext()) {
                        obj = null;
                        break;
                    }
                    obj = it.next();
                    if (((MatchResult) obj).getGroupValues().get(1).length() > 50) {
                        break;
                    }
                }
                MatchResult matchResult = (MatchResult) obj;
                if (matchResult == null) {
                    return new StreamUrls(null, null, null, StringsKt.contains$default((CharSequence) readText, (CharSequence) "sign in to confirm", false, 2, (Object) null) ? "YouTube requiere login" : StringsKt.contains$default((CharSequence) readText, (CharSequence) "robot", false, 2, (Object) null) ? "YouTube detectó bot" : "No se pudo extraer player response (" + readText.length() + " bytes)");
                }
                JSONObject jSONObject = new JSONObject(matchResult.getGroupValues().get(1));
                JSONObject optJSONObject = jSONObject.optJSONObject("videoDetails");
                String optString = optJSONObject != null ? optJSONObject.optString("title") : null;
                String str14 = "";
                if (optString == null) {
                    optString = "";
                }
                JSONObject optJSONObject2 = jSONObject.optJSONObject("streamingData");
                if (optJSONObject2 == null) {
                    return new StreamUrls(optString, null, null, "No streamingData");
                }
                JSONArray optJSONArray = optJSONObject2.optJSONArray("adaptiveFormats");
                if (optJSONArray == null) {
                    jSONArray = optJSONArray;
                } else {
                    if (optJSONArray.length() != 0) {
                        int length = optJSONArray.length();
                        Iterator<String> keys = optJSONObject2.keys();
                        Intrinsics.checkNotNullExpressionValue(keys, "keys(...)");
                        Log.e("RhythmDance", "scrape: " + length + " formats, streamingKeys=" + SequencesKt.toList(SequencesKt.asSequence(keys)));
                        int length2 = optJSONArray.length();
                        int i = 0;
                        String str15 = null;
                        int i2 = 0;
                        int i3 = 0;
                        String str16 = null;
                        while (i2 < length2) {
                            JSONObject jSONObject2 = optJSONArray.getJSONObject(i2);
                            int i4 = length2;
                            List list3 = list2;
                            String optString2 = jSONObject2.optString("mimeType", str14);
                            JSONObject jSONObject3 = jSONObject;
                            String str17 = str14;
                            String optString3 = jSONObject2.optString("url", null);
                            JSONObject jSONObject4 = optJSONObject2;
                            String optString4 = jSONObject2.optString("signatureCipher", null);
                            if (i2 < 3) {
                                Intrinsics.checkNotNull(optString2);
                                String take = StringsKt.take(optString2, 40);
                                String str18 = optString3;
                                if (str18 != null && !StringsKt.isBlank(str18)) {
                                    z3 = false;
                                    if (z3) {
                                        jSONArray2 = optJSONArray;
                                        z4 = true;
                                    } else {
                                        jSONArray2 = optJSONArray;
                                        z4 = false;
                                    }
                                    str9 = optString4;
                                    if (str9 != null && !StringsKt.isBlank(str9)) {
                                        z5 = false;
                                        if (z5) {
                                            str3 = str16;
                                            z6 = true;
                                        } else {
                                            str3 = str16;
                                            z6 = false;
                                        }
                                        str2 = sb2;
                                        str = str11;
                                        Log.e("RhythmDance", "fmt " + i2 + ": mime=" + take + ", hasUrl=" + z4 + ", hasCipher=" + z6);
                                    }
                                    z5 = true;
                                    if (z5) {
                                    }
                                    str2 = sb2;
                                    str = str11;
                                    Log.e("RhythmDance", "fmt " + i2 + ": mime=" + take + ", hasUrl=" + z4 + ", hasCipher=" + z6);
                                }
                                z3 = true;
                                if (z3) {
                                }
                                str9 = optString4;
                                if (str9 != null) {
                                    z5 = false;
                                    if (z5) {
                                    }
                                    str2 = sb2;
                                    str = str11;
                                    Log.e("RhythmDance", "fmt " + i2 + ": mime=" + take + ", hasUrl=" + z4 + ", hasCipher=" + z6);
                                }
                                z5 = true;
                                if (z5) {
                                }
                                str2 = sb2;
                                str = str11;
                                Log.e("RhythmDance", "fmt " + i2 + ": mime=" + take + ", hasUrl=" + z4 + ", hasCipher=" + z6);
                            } else {
                                jSONArray2 = optJSONArray;
                                str = str11;
                                str2 = sb2;
                                str3 = str16;
                            }
                            String str19 = optString3;
                            if (str19 != null && !StringsKt.isBlank(str19)) {
                                z = false;
                                str4 = z ? optString3 : null;
                                if (str4 == null) {
                                    String str20 = optString4;
                                    if (str20 != null && !StringsKt.isBlank(str20)) {
                                        z2 = false;
                                        if (!z2) {
                                            String decode = URLDecoder.decode(optString4, str10);
                                            Regex regex = new Regex("url=([^&]+)");
                                            Intrinsics.checkNotNull(decode);
                                            str6 = str4;
                                            MatchResult find$default = Regex.find$default(regex, decode, 0, 2, null);
                                            if (find$default != null) {
                                                String decode2 = URLDecoder.decode(find$default.getGroupValues().get(1), str10);
                                                str5 = str10;
                                                MatchResult find$default2 = Regex.find$default(new Regex("[&?]s=([^&]+)"), decode, 0, 2, null);
                                                MatchResult find$default3 = Regex.find$default(new Regex("sp=([^&]+)"), decode, 0, 2, null);
                                                if (find$default2 != null) {
                                                    if (find$default3 == null || (groupValues = find$default3.getGroupValues()) == null || (str8 = (String) CollectionsKt.getOrNull(groupValues, 1)) == null) {
                                                        str8 = "sig";
                                                    }
                                                    str7 = decode2 + "&" + str8 + "=" + ((Object) find$default2.getGroupValues().get(1));
                                                } else {
                                                    str7 = decode2;
                                                }
                                                if (str7 == null) {
                                                    Intrinsics.checkNotNull(optString2);
                                                    if (StringsKt.startsWith$default(optString2, "audio/", false, 2, (Object) null)) {
                                                        int optInt = jSONObject2.optInt("bitrate", 0);
                                                        if (optInt > i) {
                                                            str15 = str7;
                                                            i = optInt;
                                                            str16 = str3;
                                                        }
                                                    } else {
                                                        int optInt2 = jSONObject2.optInt("height", 0);
                                                        if ((1 <= optInt2 && optInt2 < 721) && optInt2 > i3) {
                                                            i3 = optInt2;
                                                            str16 = str7;
                                                        }
                                                    }
                                                    i2++;
                                                    length2 = i4;
                                                    jSONObject = jSONObject3;
                                                    list2 = list3;
                                                    str14 = str17;
                                                    optJSONObject2 = jSONObject4;
                                                    optJSONArray = jSONArray2;
                                                    sb2 = str2;
                                                    str11 = str;
                                                    str10 = str5;
                                                }
                                                str16 = str3;
                                                i2++;
                                                length2 = i4;
                                                jSONObject = jSONObject3;
                                                list2 = list3;
                                                str14 = str17;
                                                optJSONObject2 = jSONObject4;
                                                optJSONArray = jSONArray2;
                                                sb2 = str2;
                                                str11 = str;
                                                str10 = str5;
                                            } else {
                                                str5 = str10;
                                                str7 = str6;
                                                if (str7 == null) {
                                                }
                                                str16 = str3;
                                                i2++;
                                                length2 = i4;
                                                jSONObject = jSONObject3;
                                                list2 = list3;
                                                str14 = str17;
                                                optJSONObject2 = jSONObject4;
                                                optJSONArray = jSONArray2;
                                                sb2 = str2;
                                                str11 = str;
                                                str10 = str5;
                                            }
                                        }
                                    }
                                    z2 = true;
                                    if (!z2) {
                                    }
                                }
                                str5 = str10;
                                str6 = str4;
                                str7 = str6;
                                if (str7 == null) {
                                }
                                str16 = str3;
                                i2++;
                                length2 = i4;
                                jSONObject = jSONObject3;
                                list2 = list3;
                                str14 = str17;
                                optJSONObject2 = jSONObject4;
                                optJSONArray = jSONArray2;
                                sb2 = str2;
                                str11 = str;
                                str10 = str5;
                            }
                            z = true;
                            if (z) {
                            }
                            if (str4 == null) {
                            }
                            str5 = str10;
                            str6 = str4;
                            str7 = str6;
                            if (str7 == null) {
                            }
                            str16 = str3;
                            i2++;
                            length2 = i4;
                            jSONObject = jSONObject3;
                            list2 = list3;
                            str14 = str17;
                            optJSONObject2 = jSONObject4;
                            optJSONArray = jSONArray2;
                            sb2 = str2;
                            str11 = str;
                            str10 = str5;
                        }
                        String str21 = str11;
                        String str22 = sb2;
                        String str23 = str16;
                        boolean z7 = true;
                        String str24 = str15;
                        if (str24 != null && !StringsKt.isBlank(str24)) {
                            z7 = false;
                        }
                        return new StreamUrls(optString, str15 + str21 + str22, str23 != null ? str23 + str21 + str22 : null, null);
                    }
                    jSONArray = optJSONArray;
                }
                return new StreamUrls(optString, null, null, "No formatos (" + jSONArray + ")");
            } catch (Exception e) {
                String message = e.getMessage();
                if (message == null) {
                    message = e.toString();
                }
                Log.e("RhythmDance", "scrape FAIL: " + message, e);
                return new StreamUrls(null, null, null, "Error: " + StringsKt.take(message, 80));
            }
        }

        /* JADX INFO: Access modifiers changed from: private */
        public final String extractVideoId(String url) {
            List<String> groupValues;
            MatchResult find$default = Regex.find$default(new Regex("(?:v=|/)([A-Za-z0-9_-]{11})(?:&|/|$)"), url, 0, 2, null);
            if (find$default == null || (groupValues = find$default.getGroupValues()) == null) {
                return null;
            }
            return (String) CollectionsKt.getOrNull(groupValues, 1);
        }

        private final File ffmpegBin() {
            return new File(getBinDir(), "ffmpeg");
        }

        private final int findBytes(byte[] haystack, byte[] needle) {
            int i = 0;
            int length = haystack.length - needle.length;
            if (0 > length) {
                return -1;
            }
            while (true) {
                boolean z = true;
                int i2 = 0;
                int length2 = needle.length;
                while (true) {
                    if (i2 >= length2) {
                        break;
                    }
                    if (haystack[i + i2] != needle[i2]) {
                        z = false;
                        break;
                    }
                    i2++;
                }
                if (z) {
                    return i;
                }
                if (i == length) {
                    return -1;
                }
                i++;
            }
        }

        private final String findVideoFile(File audioFile) {
            String absolutePath = audioFile.getAbsolutePath();
            Intrinsics.checkNotNullExpressionValue(absolutePath, "getAbsolutePath(...)");
            String substringBeforeLast$default = StringsKt.substringBeforeLast$default(absolutePath, '.', (String) null, 2, (Object) null);
            char c = 1;
            char c2 = 3;
            Iterator it = CollectionsKt.listOf((Object[]) new String[]{".mp4", ".webm", ".mkv", ".mov", ".m4v"}).iterator();
            while (it.hasNext()) {
                File file = new File(substringBeforeLast$default + ((String) it.next()));
                if (file.exists()) {
                    return file.getAbsolutePath();
                }
            }
            File parentFile = audioFile.getParentFile();
            if (parentFile == null) {
                return null;
            }
            String lowerCase = FilesKt.getNameWithoutExtension(audioFile).toLowerCase(Locale.ROOT);
            Intrinsics.checkNotNullExpressionValue(lowerCase, "toLowerCase(...)");
            File[] listFiles = parentFile.listFiles();
            if (listFiles == null) {
                return null;
            }
            int length = listFiles.length;
            int i = 0;
            while (i < length) {
                File file2 = listFiles[i];
                Intrinsics.checkNotNull(file2);
                String lowerCase2 = FilesKt.getNameWithoutExtension(file2).toLowerCase(Locale.ROOT);
                Intrinsics.checkNotNullExpressionValue(lowerCase2, "toLowerCase(...)");
                String lowerCase3 = FilesKt.getExtension(file2).toLowerCase(Locale.ROOT);
                Intrinsics.checkNotNullExpressionValue(lowerCase3, "toLowerCase(...)");
                String[] strArr = new String[4];
                strArr[0] = "mp4";
                strArr[c] = "webm";
                strArr[2] = "mkv";
                strArr[c2] = "mov";
                if (CollectionsKt.listOf((Object[]) strArr).contains(lowerCase3) && StringsKt.contains$default((CharSequence) lowerCase2, (CharSequence) lowerCase, false, 2, (Object) null)) {
                    return file2.getAbsolutePath();
                }
                i++;
                c = 1;
                c2 = 3;
            }
            return null;
        }

        private final File getBinDir() {
            File file = new File(GameWebViewActivity.this.getFilesDir(), "bin");
            file.mkdirs();
            return file;
        }

        private final String getDownloadStatus(String id) {
            JSONObject jSONObject = this.downloadStatuses.get(id);
            if (jSONObject == null) {
                return "{\"type\":\"error\",\"message\":\"ID no encontrado\"}";
            }
            String optString = jSONObject.optString("type");
            String optString2 = jSONObject.optString("message", "");
            Intrinsics.checkNotNullExpressionValue(optString2, "optString(...)");
            return "{\"type\":\"" + optString + "\",\"message\":\"" + StringsKt.replace$default(optString2, "\"", "\\\"", false, 4, (Object) null) + "\",\"progress\":" + jSONObject.optInt(NotificationCompat.CATEGORY_PROGRESS, 0) + "}";
        }

        private final String getYtdlpInfo() {
            triggerAutoDownload();
            File ytDlpBin = ytDlpBin();
            File ffmpegBin = ffmpegBin();
            String str = null;
            if (ytDlpBin.exists()) {
                try {
                    Process start = new ProcessBuilder(ytDlpBin.getAbsolutePath(), "--version").redirectErrorStream(true).start();
                    InputStream inputStream = start.getInputStream();
                    Intrinsics.checkNotNullExpressionValue(inputStream, "getInputStream(...)");
                    Reader inputStreamReader = new InputStreamReader(inputStream, Charsets.UTF_8);
                    String obj = StringsKt.trim((CharSequence) TextStreamsKt.readText(inputStreamReader instanceof BufferedReader ? (BufferedReader) inputStreamReader : new BufferedReader(inputStreamReader, 8192))).toString();
                    start.waitFor(5L, TimeUnit.SECONDS);
                    str = obj;
                } catch (Exception e) {
                }
            }
            String str2 = str;
            return "{\"currentVersion\":" + (str2 != null ? "\"" + str2 + "\"" : "null") + ",\"installMethod\":" + (ytDlpBin.exists() ? "\"android_binary\"" : "\"none\"") + ",\"hasFfmpeg\":" + ffmpegBin.exists() + ",\"daysUntilNext\":7}";
        }

        private final String getYtdlpState() {
            return "{\"currentVersion\":\"newpipe\",\"installMethod\":\"newpipe\",\"hasFfmpeg\":false,\"daysUntilNext\":999,\"autoUpdateIntervalDays\":30,\"lastAttempt\":0,\"lastSuccess\":0}";
        }

        /* JADX INFO: Access modifiers changed from: private */
        public final void importPCBackup(String ip, String port, Map<String, String> idMap) {
            URL url = new URL(Utils.HTTP + ip + ":" + port + "/api/share/backup");
            URLConnection openConnection = url.openConnection();
            Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
            HttpURLConnection httpURLConnection = (HttpURLConnection) openConnection;
            httpURLConnection.setConnectTimeout(5000);
            httpURLConnection.setReadTimeout(15000);
            if (httpURLConnection.getResponseCode() != 200) {
                return;
            }
            InputStream inputStream = httpURLConnection.getInputStream();
            Intrinsics.checkNotNullExpressionValue(inputStream, "getInputStream(...)");
            Reader inputStreamReader = new InputStreamReader(inputStream, Charsets.UTF_8);
            String readText = TextStreamsKt.readText(inputStreamReader instanceof BufferedReader ? (BufferedReader) inputStreamReader : new BufferedReader(inputStreamReader, 8192));
            httpURLConnection.disconnect();
            JSONObject optJSONObject = new JSONObject(readText).optJSONObject("customCharts");
            if (optJSONObject == null) {
                return;
            }
            File file = new File(GameWebViewActivity.this.getFilesDir(), "customcharts.json");
            JSONObject jSONObject = file.exists() ? new JSONObject(FilesKt.readText$default(file, null, 1, null)) : new JSONObject();
            Iterator<String> keys = optJSONObject.keys();
            Intrinsics.checkNotNullExpressionValue(keys, "keys(...)");
            while (keys.hasNext()) {
                String next = keys.next();
                JSONObject optJSONObject2 = optJSONObject.optJSONObject(next);
                if (optJSONObject2 != null) {
                    Intrinsics.checkNotNull(next);
                    URL url2 = url;
                    HttpURLConnection httpURLConnection2 = httpURLConnection;
                    String substringBefore$default = StringsKt.contains$default((CharSequence) next, (CharSequence) "::", false, 2, (Object) null) ? StringsKt.substringBefore$default(next, "::", (String) null, 2, (Object) null) : "dance";
                    String str = readText;
                    String substringAfter$default = StringsKt.contains$default((CharSequence) next, (CharSequence) "::", false, 2, (Object) null) ? StringsKt.substringAfter$default(next, "::", (String) null, 2, (Object) null) : next;
                    String str2 = idMap.get(substringAfter$default);
                    if (str2 == null) {
                        str2 = substringAfter$default;
                    }
                    Iterator<String> keys2 = optJSONObject2.keys();
                    Intrinsics.checkNotNullExpressionValue(keys2, "keys(...)");
                    while (keys2.hasNext()) {
                        String next2 = keys2.next();
                        Intrinsics.checkNotNull(next2);
                        jSONObject.put(str2 + "_" + StringsKt.substringBefore$default(next2, "@", (String) null, 2, (Object) null) + "_" + substringBefore$default + "_" + StringsKt.substringAfter$default(next2, "@", (String) null, 2, (Object) null), optJSONObject2.get(next2));
                        substringAfter$default = substringAfter$default;
                        keys2 = keys2;
                    }
                    url = url2;
                    httpURLConnection = httpURLConnection2;
                    readText = str;
                }
            }
            String jSONObject2 = jSONObject.toString(2);
            Intrinsics.checkNotNullExpressionValue(jSONObject2, "toString(...)");
            FilesKt.writeText$default(file, jSONObject2, null, 2, null);
        }

        /* JADX WARN: Multi-variable type inference failed */
        /* JADX WARN: Type inference failed for: r0v1, types: [java.util.Iterator] */
        /* JADX WARN: Type inference failed for: r0v2, types: [java.util.Iterator] */
        /* JADX WARN: Type inference failed for: r0v4 */
        /* JADX WARN: Type inference failed for: r0v5 */
        /* JADX WARN: Type inference failed for: r0v6, types: [java.lang.String] */
        private final String invGet(String path) {
            HttpURLConnection httpURLConnection;
            ?? it = this.INVIDIOUS_FB.iterator();
            while (it.hasNext()) {
                try {
                    URLConnection openConnection = new URL(((String) it.next()) + path).openConnection();
                    Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
                    httpURLConnection = (HttpURLConnection) openConnection;
                    httpURLConnection.setRequestProperty("User-Agent", "RhythmDance/Android");
                    httpURLConnection.setConnectTimeout(8000);
                    httpURLConnection.setReadTimeout(12000);
                } catch (Exception e) {
                }
                if (httpURLConnection.getResponseCode() == 200) {
                    InputStream inputStream = httpURLConnection.getInputStream();
                    Intrinsics.checkNotNullExpressionValue(inputStream, "getInputStream(...)");
                    Reader inputStreamReader = new InputStreamReader(inputStream, Charsets.UTF_8);
                    it = TextStreamsKt.readText(inputStreamReader instanceof BufferedReader ? (BufferedReader) inputStreamReader : new BufferedReader(inputStreamReader, 8192));
                    return it;
                }
                httpURLConnection.disconnect();
            }
            return null;
        }

        private final File jsonFile(String name) {
            return new File(GameWebViewActivity.this.getFilesDir(), name);
        }

        private final byte[] patchElfForAndroid(byte[] bytes) {
            if (bytes.length < 64 || bytes[0] != Byte.MAX_VALUE || bytes[1] != 69 || bytes[2] != 76 || bytes[3] != 70) {
                return bytes;
            }
            if ((((bytes[17] & UByte.MAX_VALUE) << 8) | (bytes[16] & UByte.MAX_VALUE)) == 2) {
                bytes[16] = 3;
                bytes[17] = 0;
            }
            byte[] bytes2 = "/lib/ld-linux-aarch64.so.1".getBytes(Charsets.UTF_8);
            Intrinsics.checkNotNullExpressionValue(bytes2, "getBytes(...)");
            byte[] bytes3 = "/system/bin/linker64".getBytes(Charsets.UTF_8);
            Intrinsics.checkNotNullExpressionValue(bytes3, "getBytes(...)");
            int findBytes = findBytes(bytes, bytes2);
            if (findBytes >= 0) {
                int length = bytes3.length;
                for (int i = 0; i < length; i++) {
                    bytes[findBytes + i] = bytes3[i];
                }
                int length2 = bytes2.length;
                for (int length3 = bytes3.length; length3 < length2; length3++) {
                    bytes[findBytes + length3] = 0;
                }
            }
            return bytes;
        }

        private final JSONObject readJson(String name) {
            try {
                File jsonFile = jsonFile(name);
                if (jsonFile.exists()) {
                    return new JSONObject(FilesKt.readText$default(jsonFile, null, 1, null));
                }
                return null;
            } catch (Exception e) {
                return null;
            }
        }

        private final File replaysFile() {
            return jsonFile("replays.json");
        }

        /* JADX WARN: Removed duplicated region for block: B:43:0x014d  */
        /* JADX WARN: Removed duplicated region for block: B:46:0x0157  */
        /* JADX WARN: Removed duplicated region for block: B:49:0x014f  */
        /*
            Code decompiled incorrectly, please refer to instructions dump.
        */
        private final void scanMusicFiles(File dir, Set<String> exts, HashSet<String> seen, JSONArray out) {
            File[] fileArr;
            String str;
            boolean z;
            boolean z2;
            Iterator<String> keys;
            Sequence asSequence;
            boolean z3;
            ApiHandler apiHandler = this;
            Set<String> set = exts;
            HashSet<String> hashSet = seen;
            String str2 = "RhythmDance";
            if (!dir.isDirectory()) {
                Log.w("RhythmDance", "scanMusicFiles: not a dir " + dir.getAbsolutePath());
                return;
            }
            File[] listFiles = dir.listFiles();
            if (listFiles == null) {
                Log.w("RhythmDance", "scanMusicFiles: listFiles null for " + dir.getAbsolutePath());
                return;
            }
            JSONObject readJson = apiHandler.readJson("customcharts.json");
            int length = listFiles.length;
            char c = 0;
            int i = 0;
            while (i < length) {
                File file = listFiles[i];
                if (file.isDirectory()) {
                    String[] strArr = new String[3];
                    strArr[c] = str2;
                    strArr[1] = ".thumbs";
                    strArr[2] = "playlists";
                    if (!CollectionsKt.listOf((Object[]) strArr).contains(file.getName())) {
                        Intrinsics.checkNotNull(file);
                        apiHandler.scanMusicFiles(file, set, hashSet, out);
                    }
                    fileArr = listFiles;
                    str = str2;
                } else {
                    Intrinsics.checkNotNull(file);
                    String lowerCase = FilesKt.getExtension(file).toLowerCase(Locale.ROOT);
                    Intrinsics.checkNotNullExpressionValue(lowerCase, "toLowerCase(...)");
                    if (set.contains(lowerCase)) {
                        String absolutePath = file.getAbsolutePath();
                        Intrinsics.checkNotNull(absolutePath);
                        byte[] bytes = absolutePath.getBytes(Charsets.UTF_8);
                        Intrinsics.checkNotNullExpressionValue(bytes, "getBytes(...)");
                        String encodeToString = Base64.encodeToString(bytes, 10);
                        if (hashSet.contains(encodeToString)) {
                            fileArr = listFiles;
                            str = str2;
                        } else {
                            hashSet.add(encodeToString);
                            String nameWithoutExtension = FilesKt.getNameWithoutExtension(file);
                            long length2 = file.length();
                            String findVideoFile = apiHandler.findVideoFile(file);
                            if (readJson == null || (keys = readJson.keys()) == null || (asSequence = SequencesKt.asSequence(keys)) == null) {
                                fileArr = listFiles;
                                z = false;
                            } else {
                                Iterator it = asSequence.iterator();
                                while (true) {
                                    if (!it.hasNext()) {
                                        fileArr = listFiles;
                                        z = false;
                                        z3 = false;
                                        break;
                                    }
                                    String str3 = (String) it.next();
                                    Intrinsics.checkNotNull(str3);
                                    Intrinsics.checkNotNull(encodeToString);
                                    fileArr = listFiles;
                                    z = false;
                                    if (StringsKt.startsWith$default(str3, encodeToString, false, 2, (Object) null)) {
                                        z3 = true;
                                        break;
                                    }
                                    listFiles = fileArr;
                                }
                                if (z3) {
                                    z2 = true;
                                    JSONObject jSONObject = new JSONObject();
                                    jSONObject.put("id", encodeToString);
                                    jSONObject.put("name", nameWithoutExtension);
                                    str = str2;
                                    jSONObject.put("path", file.getAbsolutePath());
                                    jSONObject.put("size", length2);
                                    jSONObject.put("ext", lowerCase);
                                    jSONObject.put("hasChart", z2);
                                    jSONObject.put("hasVideo", findVideoFile == null);
                                    if (findVideoFile != null) {
                                        jSONObject.put("videoPath", findVideoFile);
                                    }
                                    out.put(jSONObject);
                                }
                            }
                            z2 = z;
                            JSONObject jSONObject2 = new JSONObject();
                            jSONObject2.put("id", encodeToString);
                            jSONObject2.put("name", nameWithoutExtension);
                            str = str2;
                            jSONObject2.put("path", file.getAbsolutePath());
                            jSONObject2.put("size", length2);
                            jSONObject2.put("ext", lowerCase);
                            jSONObject2.put("hasChart", z2);
                            jSONObject2.put("hasVideo", findVideoFile == null);
                            if (findVideoFile != null) {
                            }
                            out.put(jSONObject2);
                        }
                    } else {
                        fileArr = listFiles;
                        str = str2;
                    }
                }
                i++;
                apiHandler = this;
                set = exts;
                hashSet = seen;
                str2 = str;
                listFiles = fileArr;
                c = 0;
            }
        }

        private final File scoresFile() {
            return jsonFile("scores.json");
        }

        private final String searchYoutube(String query) {
            if (!StringsKt.startsWith$default(query, Utils.HTTP, false, 2, (Object) null) && !StringsKt.startsWith$default(query, Utils.HTTPS, false, 2, (Object) null)) {
                int i = 10;
                try {
                    YoutubeService youtubeService = ServiceList.YouTube;
                    SearchQueryHandlerFactory searchQHFactory = youtubeService.getSearchQHFactory();
                    Intrinsics.checkNotNull(searchQHFactory, "null cannot be cast to non-null type org.schabi.newpipe.extractor.linkhandler.SearchQueryHandlerFactory");
                    SearchExtractor searchExtractor = youtubeService.getSearchExtractor(searchQHFactory.fromQuery(query, CollectionsKt.listOf("video"), ""));
                    searchExtractor.fetchPage();
                    JSONArray jSONArray = new JSONArray();
                    ListExtractor.InfoItemsPage<InfoItem> initialPage = searchExtractor.getInitialPage();
                    Intrinsics.checkNotNullExpressionValue(initialPage, "getInitialPage(...)");
                    for (InfoItem infoItem : initialPage.getItems()) {
                        if (!(infoItem instanceof StreamInfoItem) || jSONArray.length() >= i) {
                            i = 10;
                        } else {
                            JSONObject jSONObject = new JSONObject();
                            jSONObject.put("url", ((StreamInfoItem) infoItem).getUrl());
                            jSONObject.put("title", ((StreamInfoItem) infoItem).getName());
                            jSONObject.put("duration", ((StreamInfoItem) infoItem).getDuration());
                            jSONArray.put(jSONObject);
                            i = 10;
                        }
                    }
                    if (jSONArray.length() > 0) {
                        return "{\"results\":" + jSONArray + "}";
                    }
                } catch (Exception e) {
                    Log.e("RhythmDance", "NewPipe search: " + e.getMessage());
                }
                String encode = URLEncoder.encode(query, "UTF-8");
                String invGet = invGet("/api/v1/search?q=" + encode + "&type=video");
                if (invGet == null) {
                    return "{\"results\":[],\"error\":\"Sin conexión. Reintentá.\"}";
                }
                try {
                    JSONArray jSONArray2 = new JSONArray(invGet);
                    JSONArray jSONArray3 = new JSONArray();
                    int i2 = 0;
                    int min = Math.min(jSONArray2.length(), 10);
                    while (i2 < min) {
                        JSONObject jSONObject2 = jSONArray2.getJSONObject(i2);
                        JSONObject jSONObject3 = new JSONObject();
                        JSONArray jSONArray4 = jSONArray2;
                        String str = encode;
                        try {
                            jSONObject3.put("url", "https://youtube.com/watch?v=" + jSONObject2.optString(YoutubeParsingHelper.VIDEO_ID));
                            jSONObject3.put("title", jSONObject2.optString("title"));
                            jSONObject3.put("duration", jSONObject2.optInt("lengthSeconds", 0));
                            jSONArray3.put(jSONObject3);
                            i2++;
                            jSONArray2 = jSONArray4;
                            encode = str;
                        } catch (Exception e2) {
                            e = e2;
                            String message = e.getMessage();
                            return "{\"results\":[],\"error\":\"" + (message != null ? StringsKt.take(message, 80) : null) + "\"}";
                        }
                    }
                    return "{\"results\":" + jSONArray3 + "}";
                } catch (Exception e3) {
                    e = e3;
                }
            }
            return "{\"results\":[{\"url\":\"" + query + "\",\"title\":\"" + query + "\",\"duration\":0}]}";
        }

        /* JADX WARN: Code restructure failed: missing block: B:11:0x0035, code lost:
        
            if (r1.equals("opus") == false) goto L38;
         */
        /* JADX WARN: Code restructure failed: missing block: B:12:0x0059, code lost:
        
            r4 = "audio/ogg";
         */
        /* JADX WARN: Code restructure failed: missing block: B:20:0x0056, code lost:
        
            if (r1.equals("ogg") == false) goto L38;
         */
        /* JADX WARN: Code restructure failed: missing block: B:24:0x006c, code lost:
        
            if (r1.equals("m4a") == false) goto L38;
         */
        /* JADX WARN: Code restructure failed: missing block: B:25:0x0078, code lost:
        
            r4 = "audio/mp4";
         */
        /* JADX WARN: Code restructure failed: missing block: B:27:0x0075, code lost:
        
            if (r1.equals("aac") == false) goto L38;
         */
        /* JADX WARN: Failed to restore switch over string. Please report as a decompilation issue
        java.lang.NullPointerException: Cannot invoke "java.util.List.iterator()" because the return value of "jadx.core.dex.visitors.regions.SwitchOverStringVisitor$SwitchData.getNewCases()" is null
        	at jadx.core.dex.visitors.regions.SwitchOverStringVisitor.restoreSwitchOverString(SwitchOverStringVisitor.java:109)
        	at jadx.core.dex.visitors.regions.SwitchOverStringVisitor.visitRegion(SwitchOverStringVisitor.java:66)
        	at jadx.core.dex.visitors.regions.DepthRegionTraversal.traverseIterativeStepInternal(DepthRegionTraversal.java:77)
        	at jadx.core.dex.visitors.regions.DepthRegionTraversal.traverseIterativeStepInternal(DepthRegionTraversal.java:82)
         */
        /*
            Code decompiled incorrectly, please refer to instructions dump.
        */
        private final WebResourceResponse serveAudio(String songId) {
            String decodeSongPath = GameWebViewActivity.INSTANCE.decodeSongPath(songId);
            if (decodeSongPath == null) {
                return null;
            }
            File file = new File(decodeSongPath);
            if (!file.exists()) {
                return null;
            }
            String lowerCase = FilesKt.getExtension(file).toLowerCase(Locale.ROOT);
            Intrinsics.checkNotNullExpressionValue(lowerCase, "toLowerCase(...)");
            String str = "audio/mpeg";
            switch (lowerCase.hashCode()) {
                case 96323:
                    break;
                case 106458:
                    break;
                case 108272:
                    if (!lowerCase.equals("mp3")) {
                    }
                    break;
                case 109967:
                    break;
                case 117484:
                    if (lowerCase.equals("wav")) {
                        str = "audio/wav";
                        break;
                    }
                    break;
                case 3145576:
                    if (lowerCase.equals("flac")) {
                        str = "audio/flac";
                        break;
                    }
                    break;
                case 3418175:
                    break;
            }
            return new WebResourceResponse(str, "UTF-8", new FileInputStream(file));
        }

        private final String startSyncAll(final String ip, final String port) {
            this.dlCounter++;
            String str = "sync_all_" + this.dlCounter + "_" + System.currentTimeMillis();
            final JSONObject jSONObject = new JSONObject();
            jSONObject.put("type", "initializing");
            jSONObject.put("message", "Conectando...");
            jSONObject.put(NotificationCompat.CATEGORY_PROGRESS, 0);
            this.downloadStatuses.put(str, jSONObject);
            ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : true, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : null, (r12 & 16) != 0 ? -1 : 0, new Function0<Unit>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$startSyncAll$1
                /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
                {
                    super(0);
                }

                @Override // kotlin.jvm.functions.Function0
                public /* bridge */ /* synthetic */ Unit invoke() {
                    invoke2();
                    return Unit.INSTANCE;
                }

                /* JADX WARN: Removed duplicated region for block: B:38:0x0177  */
                /* JADX WARN: Removed duplicated region for block: B:53:0x0418  */
                /* JADX WARN: Removed duplicated region for block: B:58:0x01ed A[Catch: Exception -> 0x0400, TRY_LEAVE, TryCatch #7 {Exception -> 0x0400, blocks: (B:42:0x01ae, B:44:0x01d2, B:45:0x01dd, B:58:0x01ed, B:145:0x038d, B:148:0x03a8), top: B:41:0x01ae }] */
                /* renamed from: invoke, reason: avoid collision after fix types in other method */
                /*
                    Code decompiled incorrectly, please refer to instructions dump.
                */
                public final void invoke2() {
                    String str2;
                    String str3;
                    String str4;
                    String message;
                    String syncList;
                    String str5;
                    JSONObject jSONObject2;
                    String str6;
                    String str7;
                    JSONObject jSONObject3;
                    JSONObject jSONObject4;
                    JSONArray jSONArray;
                    String optString;
                    String optString2;
                    String optString3;
                    boolean z;
                    String str8;
                    LinkedHashMap linkedHashMap;
                    int i;
                    String str9;
                    String str10;
                    File file;
                    File downloadSyncFile;
                    String extractExtFromShareUrl;
                    String str11 = ".";
                    String str12 = "_";
                    String str13 = "[/\\\\:*?\"<>|]";
                    String str14 = "error";
                    String str15 = "type";
                    String str16 = "message";
                    try {
                        jSONObject.put("type", "downloading");
                        jSONObject.put("message", "Obteniendo lista de canciones del PC...");
                        syncList = this.syncList(ip, port);
                        str5 = syncList;
                        jSONObject2 = new JSONObject(str5);
                    } catch (Exception e) {
                        e = e;
                        str2 = "error";
                        str3 = "type";
                        str4 = "message";
                    }
                    if (!jSONObject2.optBoolean("ok", false)) {
                        jSONObject.put("type", "error");
                        jSONObject.put("message", jSONObject2.optString("error", "Error al conectar"));
                        return;
                    }
                    JSONObject optJSONObject = jSONObject2.optJSONObject("data");
                    JSONArray optJSONArray = optJSONObject != null ? optJSONObject.optJSONArray("songs") : null;
                    if (optJSONArray == null) {
                        optJSONArray = new JSONArray();
                    }
                    JSONArray jSONArray2 = optJSONArray;
                    int length = jSONArray2.length();
                    String str17 = "success";
                    String str18 = NotificationCompat.CATEGORY_PROGRESS;
                    if (length == 0) {
                        jSONObject.put("type", "success");
                        jSONObject.put("message", "No hay canciones en el PC.");
                        jSONObject.put(NotificationCompat.CATEGORY_PROGRESS, 100);
                        return;
                    }
                    File externalStoragePublicDirectory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
                    externalStoragePublicDirectory.mkdirs();
                    File file2 = externalStoragePublicDirectory;
                    LinkedHashMap linkedHashMap2 = new LinkedHashMap();
                    int i2 = 0;
                    int i3 = 0;
                    int i4 = 0;
                    while (true) {
                        String str19 = str5;
                        str6 = "";
                        if (i4 >= length) {
                            break;
                        }
                        try {
                            jSONObject3 = jSONArray2.getJSONObject(i4);
                            jSONObject4 = jSONObject2;
                            jSONArray = jSONArray2;
                            optString = jSONObject3.optString("name", "song");
                            optString2 = jSONObject3.optString("url", "");
                            str2 = str14;
                        } catch (Exception e2) {
                            e = e2;
                            str2 = str14;
                        }
                        try {
                            optString3 = jSONObject3.optString("ext", "mp3");
                            str7 = str15;
                        } catch (Exception e3) {
                            e = e3;
                            str7 = str15;
                            str4 = str16;
                            str3 = str7;
                            jSONObject.put(str3, str2);
                            JSONObject jSONObject5 = jSONObject;
                            message = e.getMessage();
                            if (message != null) {
                            }
                            String str20 = "?";
                            jSONObject5.put(str4, "Error: " + str20);
                            return;
                        }
                        try {
                            boolean optBoolean = jSONObject3.optBoolean("hasVideo", false);
                            String optString4 = jSONObject3.optString("videoUrl", "");
                            String str21 = str16;
                            try {
                                long optLong = jSONObject3.optLong("size", 0L);
                                Intrinsics.checkNotNull(optString2);
                                int i5 = i2;
                                String str22 = str17;
                                String substringAfterLast$default = StringsKt.substringAfterLast$default(optString2, "/", (String) null, 2, (Object) null);
                                jSONObject.put(str18, (int) ((i4 / length) * 75));
                                Intrinsics.checkNotNull(optString);
                                File file3 = file2;
                                File file4 = new File(file3, StringsKt.take(new Regex(str13).replace(optString, str12), 80) + str11 + optString3);
                                if (file4.exists()) {
                                    try {
                                        if (Math.abs(file4.length() - optLong) < 1024) {
                                            z = true;
                                            String str23 = str18;
                                            if (z) {
                                                str8 = str11;
                                                String str24 = str12;
                                                String str25 = str13;
                                                linkedHashMap = linkedHashMap2;
                                                str4 = str21;
                                                i3 = i3;
                                                i = i4;
                                                jSONObject.put(str4, "Descargando " + (i4 + 1) + " de " + length + ": " + optString);
                                                if (!StringsKt.isBlank(optString2)) {
                                                    try {
                                                        GameWebViewActivity.ApiHandler apiHandler = this;
                                                        String str26 = ip;
                                                        String str27 = port;
                                                        Intrinsics.checkNotNull(optString3);
                                                        Intrinsics.checkNotNull(file3);
                                                        downloadSyncFile = apiHandler.downloadSyncFile(str26, str27, optString2, optString, optString3, file3);
                                                        if (downloadSyncFile != null) {
                                                            try {
                                                                String absolutePath = downloadSyncFile.getAbsolutePath();
                                                                Intrinsics.checkNotNullExpressionValue(absolutePath, "getAbsolutePath(...)");
                                                                byte[] bytes = absolutePath.getBytes(Charsets.UTF_8);
                                                                Intrinsics.checkNotNullExpressionValue(bytes, "getBytes(...)");
                                                                String encodeToString = Base64.encodeToString(bytes, 10);
                                                                if (!StringsKt.isBlank(substringAfterLast$default)) {
                                                                    Intrinsics.checkNotNull(encodeToString);
                                                                    linkedHashMap.put(substringAfterLast$default, encodeToString);
                                                                }
                                                            } catch (Exception e4) {
                                                                str9 = str24;
                                                                str10 = str25;
                                                                file = file3;
                                                            }
                                                        }
                                                        if (optBoolean) {
                                                            Intrinsics.checkNotNull(optString4);
                                                            if (!StringsKt.isBlank(optString4)) {
                                                                try {
                                                                    extractExtFromShareUrl = this.extractExtFromShareUrl(optString4, "mp4");
                                                                    str10 = str25;
                                                                    try {
                                                                        str9 = str24;
                                                                        try {
                                                                            String str28 = StringsKt.take(new Regex(str10).replace(optString, str9), 80) + str8 + extractExtFromShareUrl;
                                                                            str8 = str8;
                                                                            file = file3;
                                                                            try {
                                                                                if (!new File(file, str28).exists()) {
                                                                                    try {
                                                                                        this.downloadSyncFile(ip, port, optString4, optString, extractExtFromShareUrl, file);
                                                                                    } catch (Exception e5) {
                                                                                    }
                                                                                }
                                                                                i2 = i5 + 1;
                                                                            } catch (Exception e6) {
                                                                            }
                                                                        } catch (Exception e7) {
                                                                            str8 = str8;
                                                                            file = file3;
                                                                            i2 = i5;
                                                                            linkedHashMap2 = linkedHashMap;
                                                                            file2 = file;
                                                                            str16 = str4;
                                                                            str13 = str10;
                                                                            str12 = str9;
                                                                            str5 = str19;
                                                                            jSONObject2 = jSONObject4;
                                                                            jSONArray2 = jSONArray;
                                                                            str14 = str2;
                                                                            str15 = str7;
                                                                            str17 = str22;
                                                                            str18 = str23;
                                                                            str11 = str8;
                                                                            i4 = i + 1;
                                                                        }
                                                                    } catch (Exception e8) {
                                                                        str9 = str24;
                                                                    }
                                                                } catch (Exception e9) {
                                                                    str9 = str24;
                                                                    str10 = str25;
                                                                }
                                                            }
                                                        }
                                                        str9 = str24;
                                                        str10 = str25;
                                                        file = file3;
                                                        i2 = i5 + 1;
                                                    } catch (Exception e10) {
                                                        str9 = str24;
                                                        str10 = str25;
                                                        file = file3;
                                                    }
                                                } else {
                                                    str9 = str24;
                                                    str10 = str25;
                                                    file = file3;
                                                }
                                                i2 = i5;
                                            } else {
                                                str8 = str11;
                                                String str29 = str12;
                                                String str30 = str13;
                                                str4 = str21;
                                                try {
                                                    jSONObject.put(str4, "Saltando " + (i4 + 1) + " de " + length + ": " + optString + " (ya existe)");
                                                    String absolutePath2 = file4.getAbsolutePath();
                                                    Intrinsics.checkNotNullExpressionValue(absolutePath2, "getAbsolutePath(...)");
                                                    byte[] bytes2 = absolutePath2.getBytes(Charsets.UTF_8);
                                                    Intrinsics.checkNotNullExpressionValue(bytes2, "getBytes(...)");
                                                    String encodeToString2 = Base64.encodeToString(bytes2, 10);
                                                    if (!StringsKt.isBlank(substringAfterLast$default)) {
                                                        Intrinsics.checkNotNull(encodeToString2);
                                                        linkedHashMap = linkedHashMap2;
                                                        linkedHashMap.put(substringAfterLast$default, encodeToString2);
                                                    } else {
                                                        linkedHashMap = linkedHashMap2;
                                                    }
                                                    i3++;
                                                    i = i4;
                                                    i2 = i5;
                                                    str9 = str29;
                                                    str10 = str30;
                                                    file = file3;
                                                } catch (Exception e11) {
                                                    e = e11;
                                                }
                                            }
                                            linkedHashMap2 = linkedHashMap;
                                            file2 = file;
                                            str16 = str4;
                                            str13 = str10;
                                            str12 = str9;
                                            str5 = str19;
                                            jSONObject2 = jSONObject4;
                                            jSONArray2 = jSONArray;
                                            str14 = str2;
                                            str15 = str7;
                                            str17 = str22;
                                            str18 = str23;
                                            str11 = str8;
                                            i4 = i + 1;
                                        }
                                    } catch (Exception e12) {
                                        e = e12;
                                        str3 = str7;
                                        str4 = str21;
                                    }
                                }
                                z = false;
                                String str232 = str18;
                                if (z) {
                                }
                                linkedHashMap2 = linkedHashMap;
                                file2 = file;
                                str16 = str4;
                                str13 = str10;
                                str12 = str9;
                                str5 = str19;
                                jSONObject2 = jSONObject4;
                                jSONArray2 = jSONArray;
                                str14 = str2;
                                str15 = str7;
                                str17 = str22;
                                str18 = str232;
                                str11 = str8;
                                i4 = i + 1;
                            } catch (Exception e13) {
                                e = e13;
                                str4 = str21;
                            }
                        } catch (Exception e14) {
                            e = e14;
                            str4 = str16;
                            str3 = str7;
                            jSONObject.put(str3, str2);
                            JSONObject jSONObject52 = jSONObject;
                            message = e.getMessage();
                            if (message != null) {
                            }
                            String str202 = "?";
                            jSONObject52.put(str4, "Error: " + str202);
                            return;
                        }
                        e = e11;
                        str3 = str7;
                        jSONObject.put(str3, str2);
                        JSONObject jSONObject522 = jSONObject;
                        message = e.getMessage();
                        if (message != null || (str202 = StringsKt.take(message, 100)) == null) {
                            String str2022 = "?";
                        }
                        jSONObject522.put(str4, "Error: " + str2022);
                        return;
                    }
                    str2 = str14;
                    str7 = str15;
                    str4 = str16;
                    int i6 = i2;
                    String str31 = str18;
                    String str32 = str17;
                    LinkedHashMap linkedHashMap3 = linkedHashMap2;
                    jSONObject.put(str31, 85);
                    jSONObject.put(str4, "Importando charts y ajustes del PC...");
                    try {
                        this.importPCBackup(ip, port, linkedHashMap3);
                    } catch (Exception e15) {
                    }
                    str3 = str7;
                    try {
                        jSONObject.put(str3, str32);
                        if (i3 > 0) {
                            str6 = " (" + i3 + " ya existían)";
                        }
                        jSONObject.put(str4, "Sincronización completa: " + i6 + " canciones descargadas" + str6);
                        jSONObject.put(str31, 100);
                    } catch (Exception e16) {
                        e = e16;
                    }
                }
            });
            return "{\"type\":\"started\",\"id\":\"" + str + "\"}";
        }

        private final String startSyncDownload(final String ip, final String port, final String url, final String name) {
            this.dlCounter++;
            String str = "sync_" + this.dlCounter + "_" + System.currentTimeMillis();
            final JSONObject jSONObject = new JSONObject();
            jSONObject.put("type", "downloading");
            jSONObject.put("message", "Conectando...");
            jSONObject.put(NotificationCompat.CATEGORY_PROGRESS, 0);
            this.downloadStatuses.put(str, jSONObject);
            ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : true, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : null, (r12 & 16) != 0 ? -1 : 0, new Function0<Unit>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$startSyncDownload$1
                /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
                {
                    super(0);
                }

                @Override // kotlin.jvm.functions.Function0
                public /* bridge */ /* synthetic */ Unit invoke() {
                    invoke2();
                    return Unit.INSTANCE;
                }

                /* renamed from: invoke, reason: avoid collision after fix types in other method */
                public final void invoke2() {
                    String str2;
                    String str3;
                    Throwable th;
                    Throwable th2;
                    FileOutputStream fileOutputStream;
                    try {
                        String str4 = Utils.HTTP + ip + ":" + port + url;
                        String take = StringsKt.take(new Regex("[/\\\\:*?\"<>|]").replace(name, "_"), 80);
                        File externalStoragePublicDirectory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
                        externalStoragePublicDirectory.mkdirs();
                        String take2 = StringsKt.take(StringsKt.substringBefore$default(StringsKt.substringAfterLast$default(url, ".", (String) null, 2, (Object) null), "?", (String) null, 2, (Object) null), 5);
                        if (take2.length() == 0) {
                            take2 = "mp3";
                        }
                        String str5 = take2;
                        File file = new File(externalStoragePublicDirectory, take + "." + str5);
                        int i = 1;
                        while (file.exists()) {
                            file = new File(externalStoragePublicDirectory, take + "_" + i + "." + str5);
                            i++;
                        }
                        jSONObject.put("message", "Descargando de PC...");
                        jSONObject.put(NotificationCompat.CATEGORY_PROGRESS, 10);
                        URLConnection openConnection = new URL(str4).openConnection();
                        Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
                        HttpURLConnection httpURLConnection = (HttpURLConnection) openConnection;
                        httpURLConnection.setConnectTimeout(10000);
                        httpURLConnection.setReadTimeout(300000);
                        if (httpURLConnection.getResponseCode() != 200) {
                            jSONObject.put("type", "error");
                            jSONObject.put("message", "HTTP " + httpURLConnection.getResponseCode());
                            return;
                        }
                        try {
                            FileOutputStream inputStream = httpURLConnection.getInputStream();
                            try {
                                try {
                                    InputStream inputStream2 = inputStream;
                                    inputStream = new FileOutputStream(file);
                                    try {
                                        fileOutputStream = inputStream;
                                        Intrinsics.checkNotNull(inputStream2);
                                        str2 = "?";
                                    } catch (Throwable th3) {
                                        th = th3;
                                        str2 = "?";
                                    }
                                    try {
                                        try {
                                            ByteStreamsKt.copyTo$default(inputStream2, fileOutputStream, 0, 2, null);
                                            CloseableKt.closeFinally(inputStream, null);
                                            CloseableKt.closeFinally(inputStream, null);
                                            jSONObject.put("type", "success");
                                            jSONObject.put("message", "Descargado: " + file.getName());
                                            jSONObject.put("file", file.getAbsolutePath());
                                        } catch (Throwable th4) {
                                            th2 = th4;
                                            try {
                                                throw th2;
                                            } finally {
                                            }
                                        }
                                    } catch (Throwable th5) {
                                        th = th5;
                                        th2 = th;
                                        throw th2;
                                    }
                                } catch (Throwable th6) {
                                    th = th6;
                                    try {
                                        throw th2;
                                    } finally {
                                    }
                                }
                            } catch (Throwable th7) {
                                str2 = "?";
                                th = th7;
                                throw th2;
                            }
                        } catch (Exception e) {
                            e = e;
                            jSONObject.put("type", "error");
                            JSONObject jSONObject2 = jSONObject;
                            String message = e.getMessage();
                            if (message == null || (str3 = StringsKt.take(message, 100)) == null) {
                                str3 = str2;
                            }
                            jSONObject2.put("message", "Error: " + str3);
                        }
                    } catch (Exception e2) {
                        e = e2;
                        str2 = "?";
                    }
                }
            });
            return "{\"type\":\"started\",\"id\":\"" + str + "\",\"message\":\"Descargando " + name + "...\"}";
        }

        private final String startYtdlpDownload(final String url) {
            this.dlCounter++;
            String str = "dl_" + this.dlCounter + "_" + System.currentTimeMillis();
            Log.e("RhythmDance", "startYtdlpDownload: url=" + url + ", id=" + str);
            final JSONObject jSONObject = new JSONObject();
            jSONObject.put("type", "downloading");
            jSONObject.put("message", "Iniciando...");
            jSONObject.put(NotificationCompat.CATEGORY_PROGRESS, 0);
            this.downloadStatuses.put(str, jSONObject);
            ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : true, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : null, (r12 & 16) != 0 ? -1 : 0, new Function0<Unit>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$startYtdlpDownload$1
                /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
                {
                    super(0);
                }

                @Override // kotlin.jvm.functions.Function0
                public /* bridge */ /* synthetic */ Unit invoke() {
                    invoke2();
                    return Unit.INSTANCE;
                }

                /* JADX WARN: Removed duplicated region for block: B:28:0x00d1 A[Catch: Exception -> 0x02a5, TryCatch #1 {Exception -> 0x02a5, blocks: (B:17:0x0072, B:19:0x00ae, B:21:0x00bd, B:23:0x00c5, B:28:0x00d1, B:30:0x00de, B:33:0x00f1, B:34:0x011b, B:36:0x0121, B:38:0x0143, B:40:0x0160, B:42:0x0187, B:44:0x0194, B:46:0x019d, B:51:0x01a9, B:61:0x01e4, B:62:0x01f7, B:64:0x01fd, B:66:0x022d, B:68:0x024e, B:69:0x0262, B:72:0x0276, B:74:0x029d), top: B:16:0x0072 }] */
                /* JADX WARN: Removed duplicated region for block: B:30:0x00de A[Catch: Exception -> 0x02a5, TryCatch #1 {Exception -> 0x02a5, blocks: (B:17:0x0072, B:19:0x00ae, B:21:0x00bd, B:23:0x00c5, B:28:0x00d1, B:30:0x00de, B:33:0x00f1, B:34:0x011b, B:36:0x0121, B:38:0x0143, B:40:0x0160, B:42:0x0187, B:44:0x0194, B:46:0x019d, B:51:0x01a9, B:61:0x01e4, B:62:0x01f7, B:64:0x01fd, B:66:0x022d, B:68:0x024e, B:69:0x0262, B:72:0x0276, B:74:0x029d), top: B:16:0x0072 }] */
                /* JADX WARN: Removed duplicated region for block: B:51:0x01a9 A[Catch: Exception -> 0x02a5, TRY_LEAVE, TryCatch #1 {Exception -> 0x02a5, blocks: (B:17:0x0072, B:19:0x00ae, B:21:0x00bd, B:23:0x00c5, B:28:0x00d1, B:30:0x00de, B:33:0x00f1, B:34:0x011b, B:36:0x0121, B:38:0x0143, B:40:0x0160, B:42:0x0187, B:44:0x0194, B:46:0x019d, B:51:0x01a9, B:61:0x01e4, B:62:0x01f7, B:64:0x01fd, B:66:0x022d, B:68:0x024e, B:69:0x0262, B:72:0x0276, B:74:0x029d), top: B:16:0x0072 }] */
                /* JADX WARN: Removed duplicated region for block: B:71:0x0271  */
                /* JADX WARN: Removed duplicated region for block: B:74:0x029d A[Catch: Exception -> 0x02a5, TRY_LEAVE, TryCatch #1 {Exception -> 0x02a5, blocks: (B:17:0x0072, B:19:0x00ae, B:21:0x00bd, B:23:0x00c5, B:28:0x00d1, B:30:0x00de, B:33:0x00f1, B:34:0x011b, B:36:0x0121, B:38:0x0143, B:40:0x0160, B:42:0x0187, B:44:0x0194, B:46:0x019d, B:51:0x01a9, B:61:0x01e4, B:62:0x01f7, B:64:0x01fd, B:66:0x022d, B:68:0x024e, B:69:0x0262, B:72:0x0276, B:74:0x029d), top: B:16:0x0072 }] */
                /* JADX WARN: Removed duplicated region for block: B:76:? A[RETURN, SYNTHETIC] */
                /* JADX WARN: Removed duplicated region for block: B:77:0x0274  */
                /* JADX WARN: Removed duplicated region for block: B:91:0x0258  */
                /* renamed from: invoke, reason: avoid collision after fix types in other method */
                /*
                    Code decompiled incorrectly, please refer to instructions dump.
                */
                public final void invoke2() {
                    String str2;
                    String take;
                    String extractVideoId;
                    StreamUrls extractStreams;
                    boolean z;
                    boolean downloadFile;
                    boolean z2;
                    String str3;
                    String str4;
                    boolean downloadFile2;
                    boolean downloadFile3;
                    try {
                        extractVideoId = GameWebViewActivity.ApiHandler.this.extractVideoId(url);
                        Log.e("RhythmDance", "extractVideoId: " + extractVideoId);
                        if (extractVideoId == null) {
                            jSONObject.put("type", "error");
                            jSONObject.put("message", "No se pudo extraer ID del video");
                            return;
                        }
                        jSONObject.put("message", "Extrayendo streams de YouTube...");
                        extractStreams = GameWebViewActivity.ApiHandler.this.extractStreams(extractVideoId);
                        String title = extractStreams.getTitle();
                        String audioUrl = extractStreams.getAudioUrl();
                        String take2 = audioUrl != null ? StringsKt.take(audioUrl, 50) : null;
                        String videoUrl = extractStreams.getVideoUrl();
                        str2 = "?";
                        try {
                            Log.e("RhythmDance", "extractStreams: title=" + title + ", audio=" + take2 + ", video=" + (videoUrl != null ? StringsKt.take(videoUrl, 50) : null) + ", err=" + extractStreams.getError());
                            if (extractStreams.getError() != null) {
                                jSONObject.put("type", "error");
                                jSONObject.put("message", extractStreams.getError());
                                return;
                            }
                            String audioUrl2 = extractStreams.getAudioUrl();
                            if (audioUrl2 != null && !StringsKt.isBlank(audioUrl2)) {
                                z = false;
                                if (!z) {
                                    jSONObject.put("type", "error");
                                    jSONObject.put("message", "No se encontró audio");
                                    return;
                                }
                                File externalStoragePublicDirectory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
                                externalStoragePublicDirectory.mkdirs();
                                String title2 = extractStreams.getTitle();
                                if (title2 == null) {
                                    title2 = "audio";
                                }
                                String take3 = StringsKt.take(new Regex("[/\\\\:*?\"<>|]").replace(title2, "_"), 80);
                                File file = new File(externalStoragePublicDirectory, take3 + ".m4a");
                                int i = 1;
                                while (file.exists()) {
                                    file = new File(externalStoragePublicDirectory, take3 + "_" + i + ".m4a");
                                    i++;
                                }
                                jSONObject.put("message", "Descargando audio...");
                                jSONObject.put(NotificationCompat.CATEGORY_PROGRESS, 20);
                                GameWebViewActivity.ApiHandler apiHandler = GameWebViewActivity.ApiHandler.this;
                                String audioUrl3 = extractStreams.getAudioUrl();
                                Intrinsics.checkNotNull(audioUrl3);
                                downloadFile = apiHandler.downloadFile(audioUrl3, file);
                                if (!downloadFile) {
                                    Log.e("RhythmDance", "Direct download failed, trying Invidious proxy...");
                                    downloadFile3 = GameWebViewActivity.ApiHandler.this.downloadFile("https://invidious.flokinet.to/latest_version?id=" + extractVideoId + "&itag=140", file);
                                    downloadFile = downloadFile3;
                                }
                                if (!downloadFile) {
                                    jSONObject.put("type", "error");
                                    jSONObject.put("message", "Error al descargar audio (HTTP 403/proxy)");
                                    return;
                                }
                                String videoUrl2 = extractStreams.getVideoUrl();
                                if (videoUrl2 != null && !StringsKt.isBlank(videoUrl2)) {
                                    z2 = false;
                                    if (z2) {
                                        str3 = null;
                                        try {
                                            String take4 = StringsKt.take(StringsKt.substringBefore$default(StringsKt.substringAfterLast$default(extractStreams.getVideoUrl(), ".", (String) null, 2, (Object) null), str2, (String) null, 2, (Object) null), 5);
                                            if (take4.length() == 0) {
                                                take4 = "mp4";
                                            }
                                            String str5 = take4;
                                            File file2 = new File(externalStoragePublicDirectory, take3 + "_bg." + str5);
                                            int i2 = 1;
                                            while (file2.exists()) {
                                                file2 = new File(externalStoragePublicDirectory, take3 + "_bg" + i2 + "." + str5);
                                                i2++;
                                                extractVideoId = extractVideoId;
                                                take3 = take3;
                                            }
                                            jSONObject.put("message", "Descargando video...");
                                            jSONObject.put(NotificationCompat.CATEGORY_PROGRESS, 60);
                                            GameWebViewActivity.ApiHandler apiHandler2 = GameWebViewActivity.ApiHandler.this;
                                            String videoUrl3 = extractStreams.getVideoUrl();
                                            Intrinsics.checkNotNull(videoUrl3);
                                            downloadFile2 = apiHandler2.downloadFile(videoUrl3, file2);
                                            if (downloadFile2) {
                                                str4 = file2.getAbsolutePath();
                                                jSONObject.put("type", "success");
                                                jSONObject.put("message", "Descargado: " + file.getName() + (str4 != null ? " + video" : ""));
                                                jSONObject.put("file", file.getAbsolutePath());
                                                if (str4 != null) {
                                                    jSONObject.put("videoFile", str4);
                                                    return;
                                                }
                                                return;
                                            }
                                        } catch (Exception e) {
                                            e = e;
                                            str2 = str2;
                                            jSONObject.put("type", "error");
                                            JSONObject jSONObject2 = jSONObject;
                                            String message = e.getMessage();
                                            jSONObject2.put("message", "Error: " + ((message == null || (take = StringsKt.take(message, 100)) == null) ? str2 : take));
                                            return;
                                        }
                                    } else {
                                        str3 = null;
                                    }
                                    str4 = str3;
                                    jSONObject.put("type", "success");
                                    jSONObject.put("message", "Descargado: " + file.getName() + (str4 != null ? " + video" : ""));
                                    jSONObject.put("file", file.getAbsolutePath());
                                    if (str4 != null) {
                                    }
                                }
                                z2 = true;
                                if (z2) {
                                }
                                str4 = str3;
                                jSONObject.put("type", "success");
                                jSONObject.put("message", "Descargado: " + file.getName() + (str4 != null ? " + video" : ""));
                                jSONObject.put("file", file.getAbsolutePath());
                                if (str4 != null) {
                                }
                            }
                            z = true;
                            if (!z) {
                            }
                        } catch (Exception e2) {
                            e = e2;
                        }
                    } catch (Exception e3) {
                        e = e3;
                        str2 = "?";
                    }
                }
            });
            return str;
        }

        private final void statusMsg(final String msg) {
            WebView webView = GameWebViewActivity.this.webView;
            if (webView == null) {
                Intrinsics.throwUninitializedPropertyAccessException("webView");
                webView = null;
            }
            final GameWebViewActivity gameWebViewActivity = GameWebViewActivity.this;
            webView.post(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$$ExternalSyntheticLambda0
                @Override // java.lang.Runnable
                public final void run() {
                    GameWebViewActivity.ApiHandler.statusMsg$lambda$38(GameWebViewActivity.this, msg);
                }
            });
        }

        /* JADX INFO: Access modifiers changed from: private */
        public static final void statusMsg$lambda$38(GameWebViewActivity this$0, String msg) {
            Intrinsics.checkNotNullParameter(this$0, "this$0");
            Intrinsics.checkNotNullParameter(msg, "$msg");
            WebView webView = this$0.webView;
            if (webView == null) {
                Intrinsics.throwUninitializedPropertyAccessException("webView");
                webView = null;
            }
            webView.evaluateJavascript(StringsKt.trimIndent("\n                (function(){\n                    var e = new CustomEvent('statusMessage', {detail: {message: '" + msg + "'}});\n                    window.dispatchEvent(e);\n                })();\n            "), null);
        }

        /* JADX INFO: Access modifiers changed from: private */
        public final String syncList(String ip, String port) {
            try {
                URLConnection openConnection = new URL(Utils.HTTP + ip + ":" + port + "/api/share/songs").openConnection();
                Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
                HttpURLConnection httpURLConnection = (HttpURLConnection) openConnection;
                httpURLConnection.setConnectTimeout(5000);
                httpURLConnection.setReadTimeout(10000);
                if (httpURLConnection.getResponseCode() != 200) {
                    return "{\"ok\":false,\"error\":\"PC no accesible (HTTP " + httpURLConnection.getResponseCode() + ")\"}";
                }
                InputStream inputStream = httpURLConnection.getInputStream();
                Intrinsics.checkNotNullExpressionValue(inputStream, "getInputStream(...)");
                Reader inputStreamReader = new InputStreamReader(inputStream, Charsets.UTF_8);
                String readText = TextStreamsKt.readText(inputStreamReader instanceof BufferedReader ? (BufferedReader) inputStreamReader : new BufferedReader(inputStreamReader, 8192));
                httpURLConnection.disconnect();
                return "{\"ok\":true,\"data\":" + readText + "}";
            } catch (Exception e) {
                String message = e.getMessage();
                return "{\"ok\":false,\"error\":\"No se pudo conectar: " + (message != null ? StringsKt.take(message, 60) : null) + "\"}";
            }
        }

        private final void triggerAutoDownload() {
            ensureYtdlp();
            ensureFfmpeg();
        }

        private final boolean updateFfmpeg() {
            return syncDownloadFfmpeg() == null;
        }

        private final boolean updateYtdlpBinary() {
            return syncDownloadYtdlp() == null;
        }

        private final void writeJson(String name, JSONObject obj) {
            File jsonFile = jsonFile(name);
            String jSONObject = obj.toString(2);
            Intrinsics.checkNotNullExpressionValue(jSONObject, "toString(...)");
            FilesKt.writeText$default(jsonFile, jSONObject, null, 2, null);
        }

        private final File ytDlpBin() {
            return new File(getBinDir(), "yt-dlp");
        }

        private final String ytDlpName(String url) {
            String take = StringsKt.take(StringsKt.substringBefore$default(StringsKt.substringAfterLast$default(url, "/", (String) null, 2, (Object) null), "?", (String) null, 2, (Object) null), 40);
            if (take.length() == 0) {
                take = StringsKt.take(url, 40);
            }
            return take;
        }

        /* JADX WARN: Can't fix incorrect switch cases order, some code will duplicate */
        public final String generateChart(String songPath, String difficulty, int lanes, String genre, String game) {
            ChartGenerator.Difficulty difficulty2;
            String str;
            String str2;
            String replace$default;
            Intrinsics.checkNotNullParameter(songPath, "songPath");
            Intrinsics.checkNotNullParameter(difficulty, "difficulty");
            Intrinsics.checkNotNullParameter(genre, "genre");
            Intrinsics.checkNotNullParameter(game, "game");
            Log.e("RhythmDance", "generateChart: " + songPath + ", diff=" + difficulty + ", lanes=" + lanes);
            File file = new File(songPath);
            if (!file.exists()) {
                return "{\"error\":\"Archivo no encontrado: " + file.getName() + "\"}";
            }
            if (file.length() == 0) {
                return "{\"error\":\"Archivo vacio: " + file.getName() + "\"}";
            }
            switch (difficulty.hashCode()) {
                case -1289163222:
                    if (difficulty.equals("expert")) {
                        difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(3);
                        break;
                    }
                    difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(1);
                    break;
                case -1039745817:
                    if (difficulty.equals("normal")) {
                        difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(1);
                        break;
                    }
                    difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(1);
                    break;
                case 3105794:
                    if (difficulty.equals("easy")) {
                        difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(0);
                        break;
                    }
                    difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(1);
                    break;
                case 3195115:
                    if (difficulty.equals("hard")) {
                        difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(2);
                        break;
                    }
                    difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(1);
                    break;
                default:
                    difficulty2 = ChartGenerator.INSTANCE.getDIFFICULTIES().get(1);
                    break;
            }
            try {
                Uri fromFile = Uri.fromFile(file);
                AudioDecoder audioDecoder = AudioDecoder.INSTANCE;
                GameWebViewActivity gameWebViewActivity = GameWebViewActivity.this;
                Intrinsics.checkNotNull(fromFile);
                DecodedAudio decode = audioDecoder.decode(gameWebViewActivity, fromFile);
                if (decode == null) {
                    try {
                        return "{\"error\":\"No se pudo decodificar el audio: " + file.getName() + "\"}";
                    } catch (Exception e) {
                        e = e;
                        str = "\"}";
                    }
                } else {
                    Log.e("RhythmDance", "decoded: " + decode.getSamples().length + " samples, sr=" + decode.getSampleRate());
                    str = "\"}";
                    try {
                        Chart generate$default = ChartGenerator.generate$default(ChartGenerator.INSTANCE, decode, lanes, difficulty2, 0.0d, 8, null);
                        Log.e("RhythmDance", "chart: " + generate$default.getNotes().size() + " notes, bpm=" + generate$default.getBpm());
                        return chartToJson(generate$default, file);
                    } catch (Exception e2) {
                        e = e2;
                    }
                }
            } catch (Exception e3) {
                e = e3;
                str = "\"}";
            }
            Log.e("RhythmDance", "generateChart EX: " + e.getMessage(), e);
            String message = e.getMessage();
            if (message == null || (replace$default = StringsKt.replace$default(message, "\"", "\\\"", false, 4, (Object) null)) == null || (str2 = StringsKt.replace$default(replace$default, "\n", "\\n", false, 4, (Object) null)) == null) {
                str2 = EnvironmentCompat.MEDIA_UNKNOWN;
            }
            return "{\"error\":\"" + str2 + str;
        }

        public final String getAchievements(Context ctx) {
            JSONArray jSONArray;
            Intrinsics.checkNotNullParameter(ctx, "ctx");
            String readAssetString = GameWebViewActivity.this.readAssetString("dist/assets/achievements.json");
            JSONObject readJson = readJson("unlocks.json");
            if (readJson == null) {
                readJson = new JSONObject();
            }
            JSONArray optJSONArray = readJson.optJSONArray("unlocked");
            if (optJSONArray == null) {
                optJSONArray = new JSONArray();
            }
            IntRange until = RangesKt.until(0, optJSONArray.length());
            ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(until, 10));
            Iterator<Integer> it = until.iterator();
            while (it.hasNext()) {
                arrayList.add(optJSONArray.getString(((IntIterator) it).nextInt()));
            }
            Set set = CollectionsKt.toSet(arrayList);
            if (readAssetString != null) {
                try {
                    jSONArray = new JSONArray(readAssetString);
                } catch (Exception e) {
                    jSONArray = new JSONArray();
                }
            } else {
                jSONArray = new JSONArray();
            }
            JSONArray jSONArray2 = new JSONArray();
            int length = jSONArray.length();
            for (int i = 0; i < length; i++) {
                JSONObject jSONObject = jSONArray.getJSONObject(i);
                jSONObject.put("unlocked", set.contains(jSONObject.optString("id", "ach_" + i)));
                jSONArray2.put(jSONObject);
            }
            return "{\"achievements\":" + jSONArray2 + ",\"unlocked\":" + set.size() + "}";
        }

        public final String getAllReplays() {
            String str;
            String str2 = "date";
            String str3 = "{\"replays\":[]}";
            try {
                JSONObject readJson = readJson("replays.json");
                if (readJson == null) {
                    return "{\"replays\":[]}";
                }
                JSONArray jSONArray = new JSONArray();
                Iterator<String> keys = readJson.keys();
                Intrinsics.checkNotNullExpressionValue(keys, "keys(...)");
                while (keys.hasNext()) {
                    String next = keys.next();
                    JSONArray optJSONArray = readJson.optJSONArray(next);
                    if (optJSONArray != null) {
                        int i = 0;
                        int length = optJSONArray.length();
                        while (i < length) {
                            JSONObject jSONObject = optJSONArray.getJSONObject(i);
                            str = str3;
                            try {
                                JSONObject jSONObject2 = new JSONObject();
                                jSONObject2.put("id", next + "_" + i);
                                jSONObject2.put("songId", next);
                                jSONObject2.put("songName", jSONObject.optString("songName", ""));
                                jSONObject2.put("difficulty", jSONObject.optString("difficulty", "normal"));
                                jSONObject2.put("gameMode", jSONObject.optString("gameMode", "dance"));
                                jSONObject2.put("score", jSONObject.optInt("score", 0));
                                jSONObject2.put("grade", jSONObject.optString("grade", "F"));
                                jSONObject2.put(str2, jSONObject.optString(str2, ""));
                                Intrinsics.checkNotNull(jSONObject);
                                jSONObject2.put("size", bodySize(jSONObject));
                                jSONArray.put(jSONObject2);
                                i++;
                                str3 = str;
                                str2 = str2;
                                readJson = readJson;
                                keys = keys;
                                optJSONArray = optJSONArray;
                            } catch (Exception e) {
                                return str;
                            }
                        }
                    }
                }
                str = str3;
                return "{\"replays\":" + jSONArray + "}";
            } catch (Exception e2) {
                str = str3;
            }
        }

        /* JADX WARN: Unreachable blocks removed: 2, instructions: 2 */
        public final String getAllScores() {
            String str;
            String str2 = "{\"scores\":{}}";
            try {
                JSONObject readJson = readJson("scores.json");
                if (readJson == null) {
                    return "{\"scores\":{}}";
                }
                JSONObject jSONObject = new JSONObject();
                Iterator<String> keys = readJson.keys();
                Intrinsics.checkNotNullExpressionValue(keys, "keys(...)");
                while (keys.hasNext()) {
                    String next = keys.next();
                    JSONArray optJSONArray = readJson.optJSONArray(next);
                    if (optJSONArray != null && optJSONArray.length() != 0) {
                        JSONObject jSONObject2 = optJSONArray.getJSONObject(0);
                        JSONObject jSONObject3 = new JSONObject();
                        JSONObject jSONObject4 = new JSONObject();
                        str = str2;
                        try {
                            jSONObject4.put("score", jSONObject2.optInt("score", 0));
                            jSONObject4.put("grade", jSONObject2.optString("grade", "F"));
                            jSONObject4.put("difficulty", jSONObject2.optString("difficulty", "normal"));
                            Unit unit = Unit.INSTANCE;
                            jSONObject3.put("best", jSONObject4);
                            Unit unit2 = Unit.INSTANCE;
                            jSONObject.put(next, jSONObject3);
                            readJson = readJson;
                            str2 = str;
                        } catch (Exception e) {
                            return str;
                        }
                    }
                }
                str = str2;
                return "{\"scores\":" + jSONObject + "}";
            } catch (Exception e2) {
                str = str2;
            }
        }

        public final String getAudioUriString(String songPath) {
            Intrinsics.checkNotNullParameter(songPath, "songPath");
            String uri = Uri.fromFile(new File(songPath)).toString();
            Intrinsics.checkNotNullExpressionValue(uri, "toString(...)");
            return uri;
        }

        public final String getCustomChart(String songId, String difficulty, String game, int lanes) {
            JSONObject optJSONObject;
            Intrinsics.checkNotNullParameter(songId, "songId");
            Intrinsics.checkNotNullParameter(difficulty, "difficulty");
            Intrinsics.checkNotNullParameter(game, "game");
            try {
                String str = songId + "_" + difficulty + "_" + game + "_" + lanes;
                JSONObject readJson = readJson("customcharts.json");
                return (readJson == null || (optJSONObject = readJson.optJSONObject(str)) == null) ? "{\"chart\":null}" : "{\"chart\":" + optJSONObject + "}";
            } catch (Exception e) {
                return "{\"chart\":null}";
            }
        }

        public final String getDailyChallenge() {
            try {
                JSONArray optJSONArray = new JSONObject(listSongs(GameWebViewActivity.this)).optJSONArray("songs");
                if (optJSONArray == null || optJSONArray.length() == 0) {
                    return "{\"ok\":false,\"error\":\"sin_canciones\"}";
                }
                String format = new SimpleDateFormat("yyyyMMdd", Locale.US).format(new Date());
                Intrinsics.checkNotNullExpressionValue(format, "format(...)");
                Integer intOrNull = StringsKt.toIntOrNull(format);
                int intValue = intOrNull != null ? intOrNull.intValue() : 0;
                JSONObject jSONObject = optJSONArray.getJSONObject(intValue % optJSONArray.length());
                String optString = jSONObject.optString("id", "");
                String optString2 = jSONObject.optString("name", "Canción");
                List listOf = CollectionsKt.listOf((Object[]) new String[]{"easy", "normal", "hard", "expert"});
                return "{\"ok\":true,\"challenge\":{\"songId\":\"" + optString + "\",\"songName\":\"" + optString2 + "\",\"difficulty\":\"" + ((String) listOf.get(intValue % listOf.size())) + "\",\"mods\":[]},\"leaderboard\":[],\"myBest\":null}";
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":\"sin_canciones\"}";
            }
        }

        public final String getLeaderboard(String songHash) {
            String str;
            String str2;
            String str3;
            String str4;
            String songHash2 = songHash;
            String str5 = "score";
            String str6 = "name";
            String str7 = "";
            String str8 = "{\"ok\":true,\"leaderboard\":{\"entries\":[]}}";
            Intrinsics.checkNotNullParameter(songHash2, "songHash");
            try {
                JSONObject readJson = readJson("scores.json");
                if (readJson == null) {
                    return "{\"ok\":true,\"leaderboard\":{\"entries\":[]}}";
                }
                JSONArray jSONArray = new JSONArray();
                Iterator<String> keys = readJson.keys();
                Intrinsics.checkNotNullExpressionValue(keys, "keys(...)");
                while (keys.hasNext()) {
                    JSONArray optJSONArray = readJson.optJSONArray(keys.next());
                    if (optJSONArray != null) {
                        int length = optJSONArray.length();
                        str = str8;
                        int i = 0;
                        while (i < length) {
                            try {
                                JSONObject jSONObject = optJSONArray.getJSONObject(i);
                                JSONObject jSONObject2 = readJson;
                                if (!Intrinsics.areEqual(jSONObject.optString("songHash", str7), songHash2)) {
                                    if (!(songHash2.length() == 0)) {
                                        str4 = str5;
                                        str3 = str6;
                                        str2 = str7;
                                        i++;
                                        str5 = str4;
                                        readJson = jSONObject2;
                                        str6 = str3;
                                        str7 = str2;
                                        songHash2 = songHash;
                                    }
                                }
                                JSONObject jSONObject3 = new JSONObject();
                                str2 = str7;
                                jSONObject3.put("userId", jSONObject.optString("userId", str7));
                                jSONObject3.put(str6, jSONObject.optString(str6, "Jugador"));
                                str3 = str6;
                                jSONObject3.put(str5, jSONObject.optInt(str5, 0));
                                str4 = str5;
                                jSONObject3.put("accuracy", jSONObject.optDouble("accuracy", 0.0d));
                                jSONObject3.put("grade", jSONObject.optString("grade", "F"));
                                jSONArray.put(jSONObject3);
                                i++;
                                str5 = str4;
                                readJson = jSONObject2;
                                str6 = str3;
                                str7 = str2;
                                songHash2 = songHash;
                            } catch (Exception e) {
                                return str;
                            }
                        }
                        str8 = str;
                        songHash2 = songHash;
                    }
                }
                str = str8;
                IntRange until = RangesKt.until(0, jSONArray.length());
                ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(until, 10));
                Iterator<Integer> it = until.iterator();
                while (it.hasNext()) {
                    arrayList.add(jSONArray.getJSONObject(((IntIterator) it).nextInt()));
                }
                List sortedWith = CollectionsKt.sortedWith(arrayList, new Comparator() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$getLeaderboard$lambda$30$$inlined$sortedByDescending$1
                    /* JADX WARN: Multi-variable type inference failed */
                    @Override // java.util.Comparator
                    public final int compare(T t, T t2) {
                        return ComparisonsKt.compareValues(Integer.valueOf(((JSONObject) t2).optInt("score", 0)), Integer.valueOf(((JSONObject) t).optInt("score", 0)));
                    }
                });
                JSONArray jSONArray2 = new JSONArray();
                Iterator it2 = sortedWith.iterator();
                while (it2.hasNext()) {
                    jSONArray2.put((JSONObject) it2.next());
                }
                return "{\"ok\":true,\"leaderboard\":{\"entries\":" + jSONArray2 + "}}";
            } catch (Exception e2) {
                str = str8;
            }
        }

        public final String getProfile(Context ctx) {
            String str = "\"}";
            Intrinsics.checkNotNullParameter(ctx, "ctx");
            File file = new File(ctx.getFilesDir(), "profile.json");
            try {
                if (file.exists()) {
                    str = FilesKt.readText$default(file, null, 1, null);
                } else {
                    String uuid = UUID.randomUUID().toString();
                    Intrinsics.checkNotNullExpressionValue(uuid, "toString(...)");
                    String str2 = "{\"profile\":{\"displayName\":\"Jugador\",\"level\":1,\"xp\":0},\"publicName\":\"Jugador\",\"userId\":\"" + uuid + "\"}";
                    FilesKt.writeText$default(file, str2, null, 2, null);
                    str = str2;
                }
                return str;
            } catch (Exception e) {
                return "{\"profile\":{\"displayName\":\"Jugador\",\"level\":1,\"xp\":0},\"publicName\":\"Jugador\",\"userId\":\"" + UUID.randomUUID() + str;
            }
        }

        /* JADX WARN: Unreachable blocks removed: 2, instructions: 2 */
        public final String getReplayBest(String songId) {
            JSONArray optJSONArray;
            Object obj;
            Object obj2;
            Intrinsics.checkNotNullParameter(songId, "songId");
            try {
                JSONObject readJson = readJson("replays.json");
                if (readJson == null || (optJSONArray = readJson.optJSONArray(songId)) == null || optJSONArray.length() == 0) {
                    return "{\"ok\":false,\"error\":\"sin_fantasma\"}";
                }
                IntRange until = RangesKt.until(0, optJSONArray.length());
                ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(until, 10));
                Iterator<Integer> it = until.iterator();
                while (it.hasNext()) {
                    arrayList.add(optJSONArray.getJSONObject(((IntIterator) it).nextInt()));
                }
                Iterator it2 = arrayList.iterator();
                if (it2.hasNext()) {
                    Object next = it2.next();
                    if (it2.hasNext()) {
                        int optInt = ((JSONObject) next).optInt("score", 0);
                        Object obj3 = next;
                        while (true) {
                            Object next2 = it2.next();
                            int optInt2 = ((JSONObject) next2).optInt("score", 0);
                            obj = obj3;
                            if (optInt < optInt2) {
                                obj = next2;
                                optInt = optInt2;
                            }
                            if (!it2.hasNext()) {
                                break;
                            }
                            obj3 = obj;
                        }
                        obj2 = obj;
                    } else {
                        obj2 = next;
                    }
                } else {
                    obj2 = null;
                }
                JSONObject jSONObject = (JSONObject) obj2;
                if (jSONObject == null) {
                    jSONObject = optJSONArray.getJSONObject(0);
                }
                return "{\"replay\":" + jSONObject + "}";
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":\"sin_fantasma\"}";
            }
        }

        public final String getReplayById(String replayId) {
            Intrinsics.checkNotNullParameter(replayId, "replayId");
            try {
                JSONObject readJson = readJson("replays.json");
                if (readJson == null) {
                    return "{\"ok\":false,\"error\":\"no encontrado\"}";
                }
                List split$default = StringsKt.split$default((CharSequence) replayId, new String[]{"_"}, false, 0, 6, (Object) null);
                if (split$default.size() < 2) {
                    return "{\"ok\":false,\"error\":\"sin_fantasma\"}";
                }
                String joinToString$default = CollectionsKt.joinToString$default(CollectionsKt.dropLast(split$default, 1), "_", null, null, 0, null, null, 62, null);
                Integer intOrNull = StringsKt.toIntOrNull((String) CollectionsKt.last(split$default));
                int intValue = intOrNull != null ? intOrNull.intValue() : -1;
                JSONArray optJSONArray = readJson.optJSONArray(joinToString$default);
                if (optJSONArray != null && intValue >= 0 && intValue < optJSONArray.length()) {
                    return "{\"replay\":" + optJSONArray.getJSONObject(intValue) + "}";
                }
                return "{\"ok\":false,\"error\":\"sin_fantasma\"}";
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":\"sin_fantasma\"}";
            }
        }

        public final String getSongScores(String songId) {
            JSONArray optJSONArray;
            Intrinsics.checkNotNullParameter(songId, "songId");
            try {
                JSONObject readJson = readJson("scores.json");
                return (readJson == null || (optJSONArray = readJson.optJSONArray(songId)) == null || optJSONArray.length() <= 0) ? "{\"ok\":true,\"entry\":null,\"newlyUnlocked\":[],\"dailyResult\":null}" : "{\"ok\":true,\"entry\":{\"best\":" + optJSONArray.getJSONObject(0) + "},\"newlyUnlocked\":[],\"dailyResult\":null}";
            } catch (Exception e) {
                return "{\"ok\":true,\"entry\":null,\"newlyUnlocked\":[],\"dailyResult\":null}";
            }
        }

        public final String getSongSettings(String songId, String game) {
            JSONObject optJSONObject;
            Intrinsics.checkNotNullParameter(songId, "songId");
            Intrinsics.checkNotNullParameter(game, "game");
            try {
                String str = songId + "_" + game;
                JSONObject readJson = readJson("songsettings.json");
                if (readJson == null || (optJSONObject = readJson.optJSONObject(str)) == null) {
                    return "{\"settings\":null,\"score\":null}";
                }
                JSONObject optJSONObject2 = optJSONObject.optJSONObject("nps");
                if (optJSONObject2 == null) {
                    optJSONObject2 = new JSONObject();
                }
                return "{\"settings\":{\"nps\":" + optJSONObject2 + "},\"score\":null}";
            } catch (Exception e) {
                return "{\"settings\":null,\"score\":null}";
            }
        }

        public final String getStatus(Context ctx) {
            Intrinsics.checkNotNullParameter(ctx, "ctx");
            return "{\n                \"tools\":{\"ffmpeg\":false,\"ffprobe\":false,\"ytdlp\":true},\n                \"downloadDir\":\"" + Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC) + "\",\n                \"ytdlp\":" + getYtdlpState() + "\n            }";
        }

        /* JADX WARN: Code restructure failed: missing block: B:189:0x04d1, code lost:
        
            if (r6 == null) goto L199;
         */
        /* JADX WARN: Code restructure failed: missing block: B:212:0x057a, code lost:
        
            if ((!kotlin.text.StringsKt.isBlank(r3)) != false) goto L223;
         */
        /* JADX WARN: Code restructure failed: missing block: B:273:0x06e3, code lost:
        
            if (r3 == true) goto L289;
         */
        /*
            Code decompiled incorrectly, please refer to instructions dump.
        */
        public final WebResourceResponse handle(String path, Uri uri, String method) {
            String str;
            String str2;
            boolean z;
            boolean z2;
            int i;
            Iterator<String> keys;
            Sequence<String> asSequence;
            Iterator<String> keys2;
            Sequence asSequence2;
            boolean z3;
            Iterator<String> keys3;
            Sequence asSequence3;
            boolean z4;
            String str3;
            String str4;
            Intrinsics.checkNotNullParameter(path, "path");
            Intrinsics.checkNotNullParameter(uri, "uri");
            Intrinsics.checkNotNullParameter(method, "method");
            if (Intrinsics.areEqual(path, "/api/songs")) {
                return this.jsonResp.invoke(listSongs(GameWebViewActivity.this));
            }
            if (Intrinsics.areEqual(path, "/api/status")) {
                return this.jsonResp.invoke(getStatus(GameWebViewActivity.this));
            }
            if (StringsKt.startsWith$default(path, "/api/chart-progress/", false, 2, (Object) null)) {
                String substringBefore$default = StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/chart-progress/"), "?", (String) null, 2, (Object) null);
                String queryParameter = uri.getQueryParameter("difficulty");
                String str5 = queryParameter != null ? queryParameter : "normal";
                String queryParameter2 = uri.getQueryParameter("lanes");
                Integer intOrNull = StringsKt.toIntOrNull(queryParameter2 != null ? queryParameter2 : "5");
                final int intValue = intOrNull != null ? intOrNull.intValue() : 5;
                String queryParameter3 = uri.getQueryParameter("genre");
                if (queryParameter3 == null) {
                    queryParameter3 = DebugKt.DEBUG_PROPERTY_VALUE_AUTO;
                }
                final String str6 = queryParameter3;
                String queryParameter4 = uri.getQueryParameter("game");
                final String str7 = queryParameter4 != null ? queryParameter4 : "dance";
                boolean areEqual = Intrinsics.areEqual(uri.getQueryParameter("forceGenerate"), "1");
                final String decodeSongPath = GameWebViewActivity.INSTANCE.decodeSongPath(substringBefore$default);
                if (decodeSongPath == null) {
                    return this.jsonResp.invoke("{\"type\":\"error\",\"message\":\"Song not found\"}");
                }
                if (!areEqual) {
                    String str8 = substringBefore$default + "_" + str5 + "_" + str7 + "_" + intValue;
                    JSONObject readJson = readJson("customcharts.json");
                    JSONObject optJSONObject = readJson != null ? readJson.optJSONObject(str8) : null;
                    if (optJSONObject != null && optJSONObject.optJSONArray("notes") != null) {
                        JSONArray optJSONArray = optJSONObject.optJSONArray("notes");
                        Intrinsics.checkNotNull(optJSONArray);
                        if (optJSONArray.length() > 0) {
                            Log.i("RhythmDance", "chart-progress: usando chart guardado para " + str8);
                            byte[] bytes = ("data: {\"type\":\"done\",\"beatmap\":" + optJSONObject + "}\n\n").getBytes(Charsets.UTF_8);
                            Intrinsics.checkNotNullExpressionValue(bytes, "getBytes(...)");
                            return new WebResourceResponse("text/event-stream", "UTF-8", new ByteArrayInputStream(bytes));
                        }
                    }
                }
                final PipedOutputStream pipedOutputStream = new PipedOutputStream();
                PipedInputStream pipedInputStream = new PipedInputStream(pipedOutputStream);
                final String str9 = str5;
                ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : true, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : null, (r12 & 16) != 0 ? -1 : 0, new Function0<Unit>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$handle$1
                    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
                    {
                        super(0);
                    }

                    @Override // kotlin.jvm.functions.Function0
                    public /* bridge */ /* synthetic */ Unit invoke() {
                        invoke2();
                        return Unit.INSTANCE;
                    }

                    /* renamed from: invoke, reason: avoid collision after fix types in other method */
                    public final void invoke2() {
                        try {
                            PipedOutputStream pipedOutputStream2 = pipedOutputStream;
                            byte[] bytes2 = "data: {\"type\":\"progress\",\"percent\":10,\"label\":\"Analizando audio...\"}\n\n".getBytes(Charsets.UTF_8);
                            Intrinsics.checkNotNullExpressionValue(bytes2, "getBytes(...)");
                            pipedOutputStream2.write(bytes2);
                            pipedOutputStream.flush();
                            String generateChart = this.generateChart(decodeSongPath, str9, intValue, str6, str7);
                            JSONObject jSONObject = new JSONObject(generateChart);
                            PipedOutputStream pipedOutputStream3 = pipedOutputStream;
                            byte[] bytes3 = "data: {\"type\":\"progress\",\"percent\":90,\"label\":\"Pista lista\"}\n\n".getBytes(Charsets.UTF_8);
                            Intrinsics.checkNotNullExpressionValue(bytes3, "getBytes(...)");
                            pipedOutputStream3.write(bytes3);
                            pipedOutputStream.flush();
                            if (jSONObject.has("error")) {
                                PipedOutputStream pipedOutputStream4 = pipedOutputStream;
                                byte[] bytes4 = ("data: {\"type\":\"error\",\"message\":\"" + jSONObject.getString("error") + "\"}\n\n").getBytes(Charsets.UTF_8);
                                Intrinsics.checkNotNullExpressionValue(bytes4, "getBytes(...)");
                                pipedOutputStream4.write(bytes4);
                            } else {
                                PipedOutputStream pipedOutputStream5 = pipedOutputStream;
                                byte[] bytes5 = ("data: {\"type\":\"done\",\"beatmap\":" + generateChart + "}\n\n").getBytes(Charsets.UTF_8);
                                Intrinsics.checkNotNullExpressionValue(bytes5, "getBytes(...)");
                                pipedOutputStream5.write(bytes5);
                            }
                            pipedOutputStream.flush();
                        } catch (Exception e) {
                            try {
                                PipedOutputStream pipedOutputStream6 = pipedOutputStream;
                                byte[] bytes6 = ("data: {\"type\":\"error\",\"message\":\"" + e.getMessage() + "\"}\n\n").getBytes(Charsets.UTF_8);
                                Intrinsics.checkNotNullExpressionValue(bytes6, "getBytes(...)");
                                pipedOutputStream6.write(bytes6);
                                pipedOutputStream.flush();
                            } catch (Exception e2) {
                            }
                        }
                        try {
                            pipedOutputStream.close();
                        } catch (Exception e3) {
                        }
                    }
                });
                return new WebResourceResponse("text/event-stream", "UTF-8", pipedInputStream);
            }
            str = "";
            if (StringsKt.startsWith$default(path, "/api/chart/", false, 2, (Object) null) || Intrinsics.areEqual(path, "/api/chart")) {
                if (Intrinsics.areEqual(path, "/api/chart")) {
                    String queryParameter5 = uri.getQueryParameter("id");
                    if (queryParameter5 != null) {
                        str = queryParameter5;
                    }
                } else {
                    str = StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/chart/"), "?", (String) null, 2, (Object) null);
                }
                Intrinsics.checkNotNull(str);
                String str10 = str;
                String queryParameter6 = uri.getQueryParameter("difficulty");
                String str11 = queryParameter6 == null ? "normal" : queryParameter6;
                String queryParameter7 = uri.getQueryParameter("lanes");
                Integer intOrNull2 = StringsKt.toIntOrNull(queryParameter7 != null ? queryParameter7 : "5");
                int intValue2 = intOrNull2 != null ? intOrNull2.intValue() : 5;
                String queryParameter8 = uri.getQueryParameter("genre");
                if (queryParameter8 == null) {
                    queryParameter8 = DebugKt.DEBUG_PROPERTY_VALUE_AUTO;
                }
                String str12 = queryParameter8;
                String queryParameter9 = uri.getQueryParameter("game");
                String str13 = queryParameter9 == null ? "dance" : queryParameter9;
                String decodeSongPath2 = GameWebViewActivity.INSTANCE.decodeSongPath(str10);
                return decodeSongPath2 != null ? this.jsonResp.invoke(generateChart(decodeSongPath2, str11, intValue2, str12, str13)) : this.jsonResp.invoke("{\"error\":\"Song not found\"}");
            }
            if (StringsKt.startsWith$default(path, "/api/audio/", false, 2, (Object) null)) {
                return serveAudio(StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/audio/"), "?", (String) null, 2, (Object) null));
            }
            if (Intrinsics.areEqual(path, "/api/profile")) {
                return this.jsonResp.invoke(getProfile(GameWebViewActivity.this));
            }
            if (Intrinsics.areEqual(path, "/api/scores")) {
                return this.jsonResp.invoke(getAllScores());
            }
            if (StringsKt.startsWith$default(path, "/api/score/", false, 2, (Object) null)) {
                return this.jsonResp.invoke(getSongScores(StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/score/"), "?", (String) null, 2, (Object) null)));
            }
            if (Intrinsics.areEqual(path, "/api/achievements")) {
                return this.jsonResp.invoke(getAchievements(GameWebViewActivity.this));
            }
            if (StringsKt.startsWith$default(path, "/api/songsettings/", false, 2, (Object) null)) {
                String substringBefore$default2 = StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/songsettings/"), "?", (String) null, 2, (Object) null);
                String queryParameter10 = uri.getQueryParameter("game");
                return this.jsonResp.invoke(getSongSettings(substringBefore$default2, queryParameter10 != null ? queryParameter10 : "dance"));
            }
            if (StringsKt.startsWith$default(path, "/api/customchart/", false, 2, (Object) null)) {
                String substringBefore$default3 = StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/customchart/"), "?", (String) null, 2, (Object) null);
                String queryParameter11 = uri.getQueryParameter("difficulty");
                String str14 = queryParameter11 != null ? queryParameter11 : "normal";
                String queryParameter12 = uri.getQueryParameter("game");
                String str15 = queryParameter12 != null ? queryParameter12 : "dance";
                String queryParameter13 = uri.getQueryParameter("lanes");
                Integer intOrNull3 = StringsKt.toIntOrNull(queryParameter13 != null ? queryParameter13 : "5");
                return this.jsonResp.invoke(getCustomChart(substringBefore$default3, str14, str15, intOrNull3 != null ? intOrNull3.intValue() : 5));
            }
            if (Intrinsics.areEqual(path, "/api/replays")) {
                return this.jsonResp.invoke(getAllReplays());
            }
            if (StringsKt.startsWith$default(path, "/api/replay/best", false, 2, (Object) null)) {
                Function1<String, WebResourceResponse> function1 = this.jsonResp;
                String queryParameter14 = uri.getQueryParameter("songId");
                return function1.invoke(getReplayBest(queryParameter14 != null ? queryParameter14 : ""));
            }
            if (StringsKt.startsWith$default(path, "/api/replay/", false, 2, (Object) null)) {
                String substringBefore$default4 = StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/replay/"), "?", (String) null, 2, (Object) null);
                return (!(StringsKt.isBlank(substringBefore$default4) ^ true) || Intrinsics.areEqual(substringBefore$default4, "best")) ? this.jsonResp.invoke(getAllReplays()) : this.jsonResp.invoke(getReplayById(substringBefore$default4));
            }
            if (StringsKt.startsWith$default(path, "/api/daily", false, 2, (Object) null)) {
                return this.jsonResp.invoke(getDailyChallenge());
            }
            if (Intrinsics.areEqual(path, "/api/leaderboard/submit")) {
                return this.jsonResp.invoke("{\"ok\":true}");
            }
            if (StringsKt.startsWith$default(path, "/api/leaderboard/", false, 2, (Object) null)) {
                return this.jsonResp.invoke(getLeaderboard(StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/leaderboard/"), "?", (String) null, 2, (Object) null)));
            }
            if (Intrinsics.areEqual(path, "/api/backup")) {
                return this.jsonResp.invoke("{}");
            }
            if (StringsKt.startsWith$default(path, "/api/folders", false, 2, (Object) null)) {
                return this.jsonResp.invoke("{\"folders\":[" + Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC).getAbsolutePath() + "]}");
            }
            if (StringsKt.startsWith$default(path, "/api/cover/", false, 2, (Object) null)) {
                return new WebResourceResponse(AssetHelper.DEFAULT_MIME_TYPE, "UTF-8", 204, "No Content", null, new ByteArrayInputStream(new byte[0]));
            }
            if (StringsKt.startsWith$default(path, "/api/search", false, 2, (Object) null)) {
                String queryParameter15 = uri.getQueryParameter("q");
                return queryParameter15 == null ? this.jsonResp.invoke("{\"results\":[]}") : this.jsonResp.invoke(searchYoutube(queryParameter15));
            }
            if (Intrinsics.areEqual(path, "/api/download/status")) {
                str2 = null;
            } else {
                if (!StringsKt.startsWith$default(path, "/api/download/status/", false, 2, (Object) null)) {
                    if (StringsKt.startsWith$default(path, "/api/download", false, 2, (Object) null)) {
                        return this.jsonResp.invoke("{\"type\":\"error\",\"message\":\"Usa POST /api/download para descargar\"}");
                    }
                    if (StringsKt.startsWith$default(path, "/api/tools/ytdlp", false, 2, (Object) null)) {
                        return this.jsonResp.invoke(getYtdlpInfo());
                    }
                    if (Intrinsics.areEqual(path, "/api/tools/update-ytdlp")) {
                        return this.jsonResp.invoke("{\"ok\":false,\"error\":\"Usa POST /api/tools/update-ytdlp\"}");
                    }
                    if (StringsKt.startsWith$default(path, "/api/inputenv", false, 2, (Object) null)) {
                        return this.jsonResp.invoke("{\"os\":\"android\",\"twoKeyboardLagRisk\":false}");
                    }
                    if (StringsKt.startsWith$default(path, "/api/unlockfps", false, 2, (Object) null)) {
                        return this.jsonResp.invoke("{\"unlockFps\":false}");
                    }
                    if (Intrinsics.areEqual(path, "/api/tunnel")) {
                        VsManager vsManager = GameWebViewActivity.this.vsManager;
                        if (vsManager == null) {
                            Intrinsics.throwUninitializedPropertyAccessException("vsManager");
                            vsManager = null;
                        }
                        String connectionUrl = vsManager.getConnectionUrl();
                        String str16 = connectionUrl != null ? "ws://127.0.0.1:8192" : null;
                        Function1<String, WebResourceResponse> function12 = this.jsonResp;
                        r2 = connectionUrl != null;
                        if (str16 != null) {
                            str3 = "\"" + str16 + "\"";
                        }
                        str3 = "null";
                        if (connectionUrl == null || (str4 = "\"" + connectionUrl + "\"") == null) {
                            str4 = "null";
                        }
                        return function12.invoke("{\"ok\":" + r2 + ",\"url\":" + str3 + ",\"publicIp\":" + str4 + "}");
                    }
                    if (StringsKt.startsWith$default(path, "/api/community", false, 2, (Object) null)) {
                        if (Intrinsics.areEqual(path, "/api/community/catalog")) {
                            return this.jsonResp.invoke("{\"count\":0,\"syncedAt\":null}");
                        }
                        if (!Intrinsics.areEqual(path, "/api/community/config")) {
                            return StringsKt.startsWith$default(path, "/api/community/fingerprint/", false, 2, (Object) null) ? this.jsonResp.invoke("{\"fingerprint\":\"android_only\",\"meta\":{}}") : StringsKt.startsWith$default(path, "/api/community/search", false, 2, (Object) null) ? this.jsonResp.invoke("{\"results\":[]}") : Intrinsics.areEqual(path, "/api/community/report") ? this.jsonResp.invoke("{\"url\":\"\"}") : this.jsonResp.invoke("{\"entries\":[],\"results\":[],\"charts\":{},\"fingerprint\":\"\",\"meta\":{}}");
                        }
                        JSONObject readJson2 = readJson("community.json");
                        if (readJson2 == null) {
                            readJson2 = new JSONObject();
                        }
                        Function1<String, WebResourceResponse> function13 = this.jsonResp;
                        String optString = readJson2.optString("repo", "");
                        if (readJson2.has("token")) {
                            Intrinsics.checkNotNullExpressionValue(readJson2.optString("token", ""), "optString(...)");
                        }
                        r2 = false;
                        return function13.invoke("{\"repo\":\"" + optString + "\",\"hasToken\":" + r2 + "}");
                    }
                    if (StringsKt.startsWith$default(path, "/api/video/", false, 2, (Object) null)) {
                        return new WebResourceResponse(AssetHelper.DEFAULT_MIME_TYPE, "UTF-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
                    }
                    if (!StringsKt.endsWith$default(path, "/datasummary", false, 2, (Object) null) || !StringsKt.startsWith$default(path, "/api/songs/", false, 2, (Object) null)) {
                        return null;
                    }
                    String substringBefore$default5 = StringsKt.substringBefore$default(StringsKt.removeSuffix(StringsKt.removePrefix(path, (CharSequence) "/api/songs/"), (CharSequence) "/datasummary"), "?", (String) null, 2, (Object) null);
                    JSONObject readJson3 = readJson("scores.json");
                    JSONObject readJson4 = readJson("customcharts.json");
                    JSONObject readJson5 = readJson("songsettings.json");
                    boolean z5 = readJson3 != null && readJson3.has(substringBefore$default5);
                    if (readJson4 != null && (keys3 = readJson4.keys()) != null && (asSequence3 = SequencesKt.asSequence(keys3)) != null) {
                        Iterator it = asSequence3.iterator();
                        while (true) {
                            if (!it.hasNext()) {
                                z4 = false;
                                break;
                            }
                            String str17 = (String) it.next();
                            Intrinsics.checkNotNull(str17);
                            JSONObject jSONObject = readJson3;
                            Sequence sequence = asSequence3;
                            if (StringsKt.startsWith$default(str17, substringBefore$default5, false, 2, (Object) null)) {
                                z4 = true;
                                break;
                            }
                            readJson3 = jSONObject;
                            asSequence3 = sequence;
                        }
                        if (z4) {
                            z = true;
                            if (readJson5 == null && (keys2 = readJson5.keys()) != null && (asSequence2 = SequencesKt.asSequence(keys2)) != null) {
                                boolean z6 = false;
                                Iterator it2 = asSequence2.iterator();
                                while (true) {
                                    if (!it2.hasNext()) {
                                        z3 = false;
                                        break;
                                    }
                                    String str18 = (String) it2.next();
                                    Intrinsics.checkNotNull(str18);
                                    Sequence sequence2 = asSequence2;
                                    JSONObject jSONObject2 = readJson5;
                                    boolean z7 = z6;
                                    if (StringsKt.startsWith$default(str18, substringBefore$default5, false, 2, (Object) null)) {
                                        z3 = true;
                                        break;
                                    }
                                    asSequence2 = sequence2;
                                    readJson5 = jSONObject2;
                                    z6 = z7;
                                }
                                z2 = true;
                            }
                            z2 = false;
                            boolean z8 = z2;
                            if (readJson4 != null || (keys = readJson4.keys()) == null || (asSequence = SequencesKt.asSequence(keys)) == null) {
                                i = 0;
                            } else {
                                boolean z9 = false;
                                i = 0;
                                for (String str19 : asSequence) {
                                    Intrinsics.checkNotNull(str19);
                                    JSONObject jSONObject3 = readJson4;
                                    Sequence sequence3 = asSequence;
                                    boolean z10 = z9;
                                    if (StringsKt.startsWith$default(str19, substringBefore$default5, false, 2, (Object) null)) {
                                        i++;
                                        if (i < 0) {
                                            CollectionsKt.throwCountOverflow();
                                        }
                                        asSequence = sequence3;
                                        readJson4 = jSONObject3;
                                        z9 = z10;
                                    } else {
                                        asSequence = sequence3;
                                        readJson4 = jSONObject3;
                                        z9 = z10;
                                    }
                                }
                            }
                            return this.jsonResp.invoke("{\"hasScores\":" + z5 + ",\"hasCustomCharts\":" + z + ",\"hasSettings\":" + z8 + ",\"customChartCount\":" + i + "}");
                        }
                    }
                    z = false;
                    if (readJson5 == null) {
                    }
                    z2 = false;
                    boolean z82 = z2;
                    if (readJson4 != null) {
                    }
                    i = 0;
                    return this.jsonResp.invoke("{\"hasScores\":" + z5 + ",\"hasCustomCharts\":" + z + ",\"hasSettings\":" + z82 + ",\"customChartCount\":" + i + "}");
                }
                str2 = null;
            }
            return this.jsonResp.invoke(getDownloadStatus(StringsKt.substringBefore$default(StringsKt.removePrefix(path, (CharSequence) "/api/download/status/"), "?", str2, 2, str2)));
        }

        public final String handleMutation(String url, String method, String userId, String body) {
            JSONObject jSONObject;
            String str;
            String str2;
            String str3;
            String str4;
            String str5;
            String str6;
            boolean z;
            boolean z2;
            String str7;
            String str8;
            Object obj;
            String str9;
            Object obj2;
            String str10;
            String str11;
            String str12;
            String str13;
            boolean z3;
            Boolean bool;
            File[] fileArr;
            Boolean bool2;
            Boolean bool3;
            JSONArray optJSONArray;
            Boolean bool4;
            Boolean bool5;
            int i;
            JSONArray jSONArray;
            int i2;
            Boolean bool6;
            Intrinsics.checkNotNullParameter(url, "url");
            Intrinsics.checkNotNullParameter(method, "method");
            Intrinsics.checkNotNullParameter(userId, "userId");
            Intrinsics.checkNotNullParameter(body, "body");
            Log.e("RhythmDance", "handleMutation: " + method + Stream.ID_UNKNOWN + Uri.parse(url).getPath());
            try {
                String path = Uri.parse(url).getPath();
                if (path == null) {
                    return err("bad url");
                }
                if (!StringsKt.isBlank(body)) {
                    try {
                        jSONObject = new JSONObject(body);
                    } catch (Exception e) {
                        jSONObject = new JSONObject();
                    }
                } else {
                    jSONObject = new JSONObject();
                }
                if (Intrinsics.areEqual(method, "POST")) {
                    str3 = "url";
                    str4 = "userId";
                    MatchResult find$default = Regex.find$default(new Regex("^/api/score/(.+)$"), path, 0, 2, null);
                    if (find$default != null) {
                        String str14 = find$default.getGroupValues().get(1);
                        JSONObject readJson = readJson("scores.json");
                        if (readJson == null) {
                            readJson = new JSONObject();
                        }
                        JSONArray optJSONArray2 = readJson.optJSONArray(str14);
                        if (optJSONArray2 == null) {
                            optJSONArray2 = new JSONArray();
                        } else {
                            Intrinsics.checkNotNull(optJSONArray2);
                        }
                        str = "repo";
                        str2 = "token";
                        jSONObject.put("date", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date()));
                        optJSONArray2.put(jSONObject);
                        readJson.put(str14, optJSONArray2);
                        writeJson("scores.json", readJson);
                        bool6 = true;
                    } else {
                        str = "repo";
                        str2 = "token";
                        bool6 = null;
                    }
                    if (bool6 != null) {
                        List<JSONObject> checkNewAchievements = checkNewAchievements(userId, jSONObject);
                        JSONArray jSONArray2 = new JSONArray();
                        Iterator<JSONObject> it = checkNewAchievements.iterator();
                        while (it.hasNext()) {
                            jSONArray2.put(it.next());
                        }
                        return "{\"entry\":{\"best\":" + jSONObject + "},\"newlyUnlocked\":" + jSONArray2 + ",\"dailyResult\":null}";
                    }
                } else {
                    str = "repo";
                    str2 = "token";
                    str3 = "url";
                    str4 = "userId";
                }
                if (Intrinsics.areEqual(method, "POST") && Intrinsics.areEqual(path, "/api/replays")) {
                    String optString = jSONObject.optString("songId", EnvironmentCompat.MEDIA_UNKNOWN);
                    JSONObject readJson2 = readJson("replays.json");
                    if (readJson2 == null) {
                        readJson2 = new JSONObject();
                    }
                    JSONArray optJSONArray3 = readJson2.optJSONArray(optString);
                    if (optJSONArray3 == null) {
                        optJSONArray3 = new JSONArray();
                    }
                    jSONObject.put("date", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(new Date()));
                    optJSONArray3.put(jSONObject);
                    readJson2.put(optString, optJSONArray3);
                    writeJson("replays.json", readJson2);
                    return "{\"ok\":true}";
                }
                if (Intrinsics.areEqual(method, "DELETE")) {
                    str5 = "{\"ok\":true}";
                    MatchResult find$default2 = Regex.find$default(new Regex("^/api/replay/(.+)$"), path, 0, 2, null);
                    if (find$default2 != null) {
                        JSONObject readJson3 = readJson("replays.json");
                        if (readJson3 == null) {
                            readJson3 = new JSONObject();
                        }
                        List split$default = StringsKt.split$default((CharSequence) find$default2.getGroupValues().get(1), new String[]{"_"}, false, 0, 6, (Object) null);
                        if (split$default.size() >= 2) {
                            String joinToString$default = CollectionsKt.joinToString$default(CollectionsKt.dropLast(split$default, 1), "_", null, null, 0, null, null, 62, null);
                            Integer intOrNull = StringsKt.toIntOrNull((String) CollectionsKt.last(split$default));
                            int intValue = intOrNull != null ? intOrNull.intValue() : -1;
                            JSONArray optJSONArray4 = readJson3.optJSONArray(joinToString$default);
                            if (optJSONArray4 == null) {
                                bool5 = null;
                            } else {
                                Intrinsics.checkNotNull(optJSONArray4);
                                JSONArray jSONArray3 = optJSONArray4;
                                if (intValue >= 0 && intValue < jSONArray3.length()) {
                                    JSONArray jSONArray4 = new JSONArray();
                                    int length = jSONArray3.length();
                                    int i3 = 0;
                                    while (i3 < length) {
                                        if (i3 != intValue) {
                                            i = length;
                                            jSONArray = jSONArray3;
                                            i2 = intValue;
                                            jSONArray4.put(jSONArray.get(i3));
                                        } else {
                                            i = length;
                                            jSONArray = jSONArray3;
                                            i2 = intValue;
                                        }
                                        i3++;
                                        intValue = i2;
                                        jSONArray3 = jSONArray;
                                        length = i;
                                    }
                                    if (jSONArray4.length() > 0) {
                                        readJson3.put(joinToString$default, jSONArray4);
                                    } else {
                                        readJson3.remove(joinToString$default);
                                    }
                                    writeJson("replays.json", readJson3);
                                }
                            }
                        }
                        bool5 = true;
                    } else {
                        bool5 = null;
                    }
                    if (bool5 != null) {
                        return str5;
                    }
                } else {
                    str5 = "{\"ok\":true}";
                }
                if (Intrinsics.areEqual(method, "POST") || Intrinsics.areEqual(method, "PUT")) {
                    if (Intrinsics.areEqual(path, "/api/profile")) {
                        str6 = "}";
                        z = true;
                        z2 = false;
                    } else if (Intrinsics.areEqual(path, "/api/profile/save")) {
                        str6 = "}";
                        z = true;
                        z2 = false;
                    }
                    JSONObject readJson4 = readJson("profile.json");
                    if (readJson4 == null) {
                        readJson4 = new JSONObject();
                    }
                    Iterator<String> keys = jSONObject.keys();
                    Intrinsics.checkNotNullExpressionValue(keys, "keys(...)");
                    while (keys.hasNext()) {
                        String next = keys.next();
                        readJson4.put(next, jSONObject.get(next));
                    }
                    String str15 = userId;
                    if (str15.length() == 0 ? z : z2) {
                        str7 = str4;
                        str15 = readJson4.optString(str7, UUID.randomUUID().toString());
                    } else {
                        str7 = str4;
                    }
                    readJson4.put(str7, str15);
                    writeJson("profile.json", readJson4);
                    return "{\"ok\":true,\"profile\":" + readJson4 + str6;
                }
                if (Intrinsics.areEqual(method, "POST")) {
                    str8 = "replays.json";
                    obj = "DELETE";
                    str9 = "scores.json";
                    MatchResult find$default3 = Regex.find$default(new Regex("^/api/songsettings/(.+)$"), path, 0, 2, null);
                    if (find$default3 != null) {
                        String str16 = find$default3.getGroupValues().get(1) + "_" + jSONObject.optString("game", "dance");
                        JSONObject readJson5 = readJson("songsettings.json");
                        if (readJson5 == null) {
                            readJson5 = new JSONObject();
                        }
                        JSONObject jSONObject2 = readJson5;
                        jSONObject2.put(str16, jSONObject);
                        writeJson("songsettings.json", jSONObject2);
                        bool4 = true;
                    } else {
                        bool4 = null;
                    }
                    if (bool4 != null) {
                        return str5;
                    }
                } else {
                    str8 = "replays.json";
                    obj = "DELETE";
                    str9 = "scores.json";
                }
                if (Intrinsics.areEqual(method, "POST")) {
                    obj2 = "POST";
                    MatchResult find$default4 = Regex.find$default(new Regex("^/api/customchart/(.+)$"), path, 0, 2, null);
                    if (find$default4 != null) {
                        String str17 = find$default4.getGroupValues().get(1) + "_" + jSONObject.optString("difficulty", "normal") + "_" + jSONObject.optString("game", "dance") + "_" + jSONObject.optInt("lanes", 5);
                        JSONObject readJson6 = readJson("customcharts.json");
                        if (readJson6 == null) {
                            readJson6 = new JSONObject();
                        }
                        JSONObject jSONObject3 = readJson6;
                        jSONObject3.put(str17, jSONObject);
                        writeJson("customcharts.json", jSONObject3);
                        bool3 = true;
                    } else {
                        bool3 = null;
                    }
                    if (bool3 != null) {
                        JSONObject optJSONObject = jSONObject.optJSONObject("chart");
                        return "{\"ok\":true,\"notes\":" + ((optJSONObject == null || (optJSONArray = optJSONObject.optJSONArray("notes")) == null) ? 0 : optJSONArray.length()) + "}";
                    }
                } else {
                    obj2 = "POST";
                }
                Object obj3 = obj;
                if (Intrinsics.areEqual(method, obj3)) {
                    str10 = "}";
                    str11 = "songsettings.json";
                    MatchResult find$default5 = Regex.find$default(new Regex("^/api/customchart/(.+)$"), path, 0, 2, null);
                    if (find$default5 != null) {
                        String str18 = find$default5.getGroupValues().get(1) + "_" + jSONObject.optString("difficulty", "") + "_" + jSONObject.optString("game", "dance") + "_" + jSONObject.optInt("lanes", 5);
                        JSONObject readJson7 = readJson("customcharts.json");
                        if (readJson7 == null) {
                            readJson7 = new JSONObject();
                        }
                        readJson7.remove(str18);
                        writeJson("customcharts.json", readJson7);
                        bool2 = true;
                    } else {
                        bool2 = null;
                    }
                    if (bool2 != null) {
                        return str5;
                    }
                } else {
                    str10 = "}";
                    str11 = "songsettings.json";
                }
                if (Intrinsics.areEqual(method, obj3)) {
                    MatchResult find$default6 = Regex.find$default(new Regex("^/api/songs/(.+)$"), path, 0, 2, null);
                    if (find$default6 != null) {
                        GameWebViewActivity gameWebViewActivity = GameWebViewActivity.this;
                        boolean z4 = false;
                        final String str19 = find$default6.getGroupValues().get(1);
                        String decodeSongPath = GameWebViewActivity.INSTANCE.decodeSongPath(str19);
                        Log.e("RhythmDance", "DELETE /api/songs/" + str19 + " → decodeSongPath=" + decodeSongPath);
                        if (decodeSongPath != null) {
                            File file = new File(decodeSongPath);
                            if (file.exists()) {
                                file.delete();
                            }
                            String findVideoFile = findVideoFile(file);
                            if (findVideoFile != null) {
                                new File(findVideoFile).delete();
                            }
                        }
                        Iterator it2 = CollectionsKt.listOf((Object[]) new String[]{str9, str8, "customcharts.json", str11}).iterator();
                        while (it2.hasNext()) {
                            String str20 = (String) it2.next();
                            JSONObject readJson8 = readJson(str20);
                            if (readJson8 != null) {
                                Iterator<String> keys2 = readJson8.keys();
                                Iterator it3 = it2;
                                Intrinsics.checkNotNullExpressionValue(keys2, "keys(...)");
                                List list = SequencesKt.toList(SequencesKt.filter(SequencesKt.asSequence(keys2), new Function1<String, Boolean>() { // from class: com.rhythmdance.app.GameWebViewActivity$ApiHandler$handleMutation$7$keysToRemove$1
                                    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
                                    {
                                        super(1);
                                    }

                                    @Override // kotlin.jvm.functions.Function1
                                    public final Boolean invoke(String str21) {
                                        Intrinsics.checkNotNull(str21);
                                        return Boolean.valueOf(StringsKt.startsWith$default(str21, str19, false, 2, (Object) null));
                                    }
                                }));
                                Iterator it4 = list.iterator();
                                while (it4.hasNext()) {
                                    readJson8.remove((String) it4.next());
                                    list = list;
                                }
                                writeJson(str20, readJson8);
                                it2 = it3;
                            }
                        }
                        try {
                            File file2 = new File(gameWebViewActivity.getFilesDir(), "beatmap-cache");
                            if (file2.exists()) {
                                File[] listFiles = file2.listFiles();
                                if (listFiles == null) {
                                    try {
                                        fileArr = new File[0];
                                    } catch (Exception e2) {
                                    }
                                } else {
                                    fileArr = listFiles;
                                }
                                int length2 = fileArr.length;
                                int i4 = 0;
                                while (i4 < length2) {
                                    File file3 = fileArr[i4];
                                    String name = file3.getName();
                                    File[] fileArr2 = fileArr;
                                    Intrinsics.checkNotNullExpressionValue(name, "getName(...)");
                                    int i5 = length2;
                                    boolean z5 = z4;
                                    String str21 = str19;
                                    try {
                                        if (StringsKt.endsWith$default(name, ".json", false, 2, (Object) null)) {
                                            try {
                                                Intrinsics.checkNotNull(file3);
                                                String readText$default = FilesKt.readText$default(file3, null, 1, null);
                                                if (decodeSongPath != null && StringsKt.contains$default((CharSequence) readText$default, (CharSequence) decodeSongPath, false, 2, (Object) null)) {
                                                    file3.delete();
                                                }
                                            } catch (Exception e3) {
                                            }
                                        }
                                        i4++;
                                        fileArr = fileArr2;
                                        length2 = i5;
                                        z4 = z5;
                                        str19 = str21;
                                    } catch (Exception e4) {
                                    }
                                }
                            }
                        } catch (Exception e5) {
                        }
                        bool = true;
                    } else {
                        bool = null;
                    }
                    if (bool != null) {
                        return str5;
                    }
                }
                Object obj4 = obj2;
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/unlockfps")) {
                    return str5;
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/folders")) {
                    String optString2 = jSONObject.optString("path", "");
                    Intrinsics.checkNotNull(optString2);
                    return "{\"ok\":" + (optString2.length() > 0) + ",\"folder\":\"" + optString2 + "\"}";
                }
                if (Intrinsics.areEqual(method, obj3) && StringsKt.startsWith$default(path, "/api/folders", false, 2, (Object) null)) {
                    return str5;
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/community/config")) {
                    JSONObject readJson9 = readJson("community.json");
                    if (readJson9 == null) {
                        readJson9 = new JSONObject();
                    }
                    String str22 = str2;
                    if (jSONObject.has(str22)) {
                        readJson9.put(str22, jSONObject.getString(str22));
                    }
                    String str23 = str;
                    if (jSONObject.has(str23)) {
                        readJson9.put(str23, jSONObject.getString(str23));
                    }
                    writeJson("community.json", readJson9);
                    if (readJson9.has(str22)) {
                        Intrinsics.checkNotNullExpressionValue(readJson9.getString(str22), "getString(...)");
                        if (!StringsKt.isBlank(r4)) {
                            z3 = true;
                            return "{\"hasToken\":" + z3 + str10;
                        }
                    }
                    z3 = false;
                    return "{\"hasToken\":" + z3 + str10;
                }
                String str24 = str10;
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/community/sync")) {
                    return str5;
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/community/apply")) {
                    return "{\"ok\":false,\"needsConfirm\":false,\"needAudio\":false,\"message\":\"No disponible offline\"}";
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/community/publish")) {
                    return "{\"ok\":false,\"needAuth\":true,\"error\":\"Sin conexión a comunidad\"}";
                }
                if (StringsKt.startsWith$default(path, "/api/import", false, 2, (Object) null)) {
                    return "{\"ok\":false,\"error\":\"Import no disponible en Android\"}";
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/backup/restore")) {
                    return "{\"ok\":false,\"error\":\"Restore no disponible\",\"summary\":{\"charts\":0,\"scores\":0}}";
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/tunnel")) {
                    VsManager vsManager = GameWebViewActivity.this.vsManager;
                    if (vsManager == null) {
                        Intrinsics.throwUninitializedPropertyAccessException("vsManager");
                        vsManager = null;
                    }
                    String startHost = vsManager.startHost();
                    VsManager vsManager2 = GameWebViewActivity.this.vsManager;
                    if (vsManager2 == null) {
                        Intrinsics.throwUninitializedPropertyAccessException("vsManager");
                        vsManager2 = null;
                    }
                    String connectionUrl = vsManager2.getConnectionUrl();
                    boolean z6 = startHost != null;
                    if (startHost == null || (str12 = "\"" + startHost + "\"") == null) {
                        str12 = "null";
                    }
                    if (connectionUrl == null || (str13 = "\"" + connectionUrl + "\"") == null) {
                        str13 = "null";
                    }
                    return "{\"ok\":" + z6 + ",\"url\":" + str12 + ",\"publicIp\":" + str13 + ",\"error\":" + (startHost == null ? "\"No se pudo iniciar VS\"" : "null") + str24;
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/tools/update-ytdlp")) {
                    return updateYtdlpBinary() ? str5 : "{\"ok\":false,\"error\":\"Error al actualizar yt-dlp\"}";
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/tools/update-ffmpeg")) {
                    return updateFfmpeg() ? str5 : "{\"ok\":false,\"error\":\"Error al actualizar ffmpeg\"}";
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/sync/list")) {
                    String optString3 = jSONObject.optString("ip", "");
                    Intrinsics.checkNotNullExpressionValue(optString3, "optString(...)");
                    String obj5 = StringsKt.trim((CharSequence) optString3).toString();
                    String optString4 = jSONObject.optString("port", "5174");
                    Intrinsics.checkNotNullExpressionValue(optString4, "optString(...)");
                    return StringsKt.isBlank(obj5) ? "{\"ok\":false,\"error\":\"IP requerida\"}" : syncList(obj5, StringsKt.trim((CharSequence) optString4).toString());
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/sync/download")) {
                    String optString5 = jSONObject.optString("ip", "");
                    Intrinsics.checkNotNullExpressionValue(optString5, "optString(...)");
                    String obj6 = StringsKt.trim((CharSequence) optString5).toString();
                    String optString6 = jSONObject.optString("port", "5174");
                    Intrinsics.checkNotNullExpressionValue(optString6, "optString(...)");
                    String obj7 = StringsKt.trim((CharSequence) optString6).toString();
                    String optString7 = jSONObject.optString(str3, "");
                    Intrinsics.checkNotNullExpressionValue(optString7, "optString(...)");
                    String obj8 = StringsKt.trim((CharSequence) optString7).toString();
                    String optString8 = jSONObject.optString("name", "song");
                    Intrinsics.checkNotNullExpressionValue(optString8, "optString(...)");
                    String obj9 = StringsKt.trim((CharSequence) optString8).toString();
                    if (!StringsKt.isBlank(obj6) && !StringsKt.isBlank(obj8)) {
                        return startSyncDownload(obj6, obj7, obj8, obj9);
                    }
                    return "{\"type\":\"error\",\"message\":\"IP y URL requeridas\"}";
                }
                String str25 = str3;
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/sync/sync-all")) {
                    String optString9 = jSONObject.optString("ip", "");
                    Intrinsics.checkNotNullExpressionValue(optString9, "optString(...)");
                    String obj10 = StringsKt.trim((CharSequence) optString9).toString();
                    String optString10 = jSONObject.optString("port", "5174");
                    Intrinsics.checkNotNullExpressionValue(optString10, "optString(...)");
                    return StringsKt.isBlank(obj10) ? "{\"ok\":false,\"error\":\"IP requerida\"}" : startSyncAll(obj10, StringsKt.trim((CharSequence) optString10).toString());
                }
                if (Intrinsics.areEqual(method, obj4) && Intrinsics.areEqual(path, "/api/download")) {
                    String optString11 = jSONObject.optString(str25, "");
                    Intrinsics.checkNotNull(optString11);
                    return StringsKt.isBlank(optString11) ? "{\"type\":\"error\",\"message\":\"URL vacía\"}" : "{\"type\":\"started\",\"id\":\"" + startYtdlpDownload(optString11) + "\",\"message\":\"Descarga iniciada: " + ytDlpName(optString11) + "\"}";
                }
                JSONObject jSONObject4 = new JSONObject();
                jSONObject4.put("ok", false);
                jSONObject4.put("error", "endpoint not found: " + path);
                String jSONObject5 = jSONObject4.toString();
                Intrinsics.checkNotNullExpressionValue(jSONObject5, "toString(...)");
                return jSONObject5;
            } catch (Exception e6) {
                String message = e6.getMessage();
                if (message == null) {
                    message = EnvironmentCompat.MEDIA_UNKNOWN;
                }
                return err(message);
            }
        }

        public final String listSongs(Context ctx) {
            Intrinsics.checkNotNullParameter(ctx, "ctx");
            JSONArray jSONArray = new JSONArray();
            File[] fileArr = new File[5];
            fileArr[0] = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC);
            fileArr[1] = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File externalFilesDir = ctx.getExternalFilesDir(null);
            fileArr[2] = externalFilesDir != null ? new File(externalFilesDir, "music") : null;
            fileArr[3] = new File(Environment.getExternalStorageDirectory(), "Music");
            fileArr[4] = new File(Environment.getExternalStorageDirectory(), "Música");
            List filterNotNull = CollectionsKt.filterNotNull(CollectionsKt.listOf((Object[]) fileArr));
            ArrayList arrayList = new ArrayList();
            for (Object obj : filterNotNull) {
                if (((File) obj).exists()) {
                    arrayList.add(obj);
                }
            }
            ArrayList arrayList2 = arrayList;
            Log.i("RhythmDance", "listSongs: dirs=" + arrayList2.size() + ", hasPerm=" + (ContextCompat.checkSelfPermission(ctx, Build.VERSION.SDK_INT >= 33 ? "android.permission.READ_MEDIA_AUDIO" : "android.permission.READ_EXTERNAL_STORAGE") == 0));
            HashSet<String> hashSet = new HashSet<>();
            Set<String> of = SetsKt.setOf((Object[]) new String[]{"mp3", "ogg", "wav", "m4a", "flac", "aac", "opus", "webm", "mp4"});
            Iterator it = arrayList2.iterator();
            while (it.hasNext()) {
                scanMusicFiles((File) it.next(), of, hashSet, jSONArray);
            }
            Log.i("RhythmDance", "listSongs found " + jSONArray.length() + " songs");
            return "{\"songs\":" + jSONArray + "}";
        }

        public final void saveProfile(Context ctx, String json) {
            Intrinsics.checkNotNullParameter(ctx, "ctx");
            Intrinsics.checkNotNullParameter(json, "json");
            try {
                FilesKt.writeText$default(new File(ctx.getFilesDir(), "profile.json"), json, null, 2, null);
            } catch (Exception e) {
            }
        }

        public final String syncDownloadFfmpeg() {
            for (String str : this.FFPEG_SOURCES) {
                String downloadBinary = downloadBinary(str, ffmpegBin());
                if (downloadBinary == null) {
                    return null;
                }
                Log.e("YtDlp", "ffmpeg from " + str + ": " + downloadBinary);
            }
            return "all ffmpeg sources failed";
        }

        public final String syncDownloadYtdlp() {
            String downloadBinary = downloadBinary(this.YTDLP_URL, ytDlpBin());
            if (downloadBinary != null) {
                Log.e("YtDlp", "yt-dlp download: " + downloadBinary);
            }
            return downloadBinary;
        }
    }

    /* compiled from: GameWebViewActivity.kt */
    @Metadata(d1 = {"\u0000 \n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010%\n\u0002\b\u0005\b\u0086\u0003\u0018\u00002\u00020\u0001B\u0007\b\u0002¢\u0006\u0002\u0010\u0002J\u0010\u0010\u000b\u001a\u0004\u0018\u00010\u00062\u0006\u0010\f\u001a\u00020\u0006R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0006X\u0082D¢\u0006\u0002\n\u0000R\u001a\u0010\u0007\u001a\u000e\u0012\u0004\u0012\u00020\u0006\u0012\u0004\u0012\u00020\u00060\bX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\u0006X\u0082D¢\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u0006X\u0082D¢\u0006\u0002\n\u0000¨\u0006\r"}, d2 = {"Lcom/rhythmdance/app/GameWebViewActivity$Companion;", "", "()V", "PERMISSION_REQUEST_CODE", "", "SCRIPT_FETCH_OVERRIDE", "", "SONG_ID_CACHE", "", "SYNC_PANEL_HTML", "errorPage", "decodeSongPath", "songId", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public static final class Companion {
        private Companion() {
        }

        public /* synthetic */ Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        public final String decodeSongPath(String songId) {
            Intrinsics.checkNotNullParameter(songId, "songId");
            if (GameWebViewActivity.SONG_ID_CACHE.containsKey(songId)) {
                return (String) GameWebViewActivity.SONG_ID_CACHE.get(songId);
            }
            try {
                byte[] decode = Base64.decode(songId, 8);
                Intrinsics.checkNotNullExpressionValue(decode, "decode(...)");
                String str = new String(decode, Charsets.UTF_8);
                GameWebViewActivity.SONG_ID_CACHE.put(songId, str);
                return str;
            } catch (Exception e) {
                return null;
            }
        }
    }

    /* compiled from: GameWebViewActivity.kt */
    @Metadata(d1 = {"\u0000$\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\b\u0086\u0004\u0018\u00002\u00020\u0001B\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003¢\u0006\u0002\u0010\u0004J\u0010\u0010\u0005\u001a\u00020\u00032\u0006\u0010\u0006\u001a\u00020\u0003H\u0002J\u001a\u0010\u0007\u001a\u0004\u0018\u00010\b2\u0006\u0010\t\u001a\u00020\n2\u0006\u0010\u000b\u001a\u00020\fH\u0016R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006\r"}, d2 = {"Lcom/rhythmdance/app/GameWebViewActivity$GameWebViewClient;", "Landroid/webkit/WebViewClient;", "assetsBase", "", "(Lcom/rhythmdance/app/GameWebViewActivity;Ljava/lang/String;)V", "getMimeType", "path", "shouldInterceptRequest", "Landroid/webkit/WebResourceResponse;", "view", "Landroid/webkit/WebView;", "request", "Landroid/webkit/WebResourceRequest;", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public final class GameWebViewClient extends WebViewClient {
        private final String assetsBase;
        final /* synthetic */ GameWebViewActivity this$0;

        public GameWebViewClient(GameWebViewActivity gameWebViewActivity, String assetsBase) {
            Intrinsics.checkNotNullParameter(assetsBase, "assetsBase");
            this.this$0 = gameWebViewActivity;
            this.assetsBase = assetsBase;
        }

        /* JADX WARN: Can't fix incorrect switch cases order, some code will duplicate */
        /* JADX WARN: Code restructure failed: missing block: B:17:0x0056, code lost:
        
            if (r1.equals("jpeg") == false) goto L72;
         */
        /* JADX WARN: Code restructure failed: missing block: B:18:0x00d8, code lost:
        
            return "image/jpeg";
         */
        /* JADX WARN: Code restructure failed: missing block: B:47:0x00d4, code lost:
        
            if (r1.equals("jpg") == false) goto L72;
         */
        /* JADX WARN: Removed duplicated region for block: B:56:0x00ff A[ORIG_RETURN, RETURN] */
        /* JADX WARN: Removed duplicated region for block: B:57:? A[RETURN, SYNTHETIC] */
        /*
            Code decompiled incorrectly, please refer to instructions dump.
        */
        private final String getMimeType(String path) {
            String substringAfterLast = StringsKt.substringAfterLast(path, '.', "");
            String lowerCase = substringAfterLast.toLowerCase(Locale.ROOT);
            Intrinsics.checkNotNullExpressionValue(lowerCase, "toLowerCase(...)");
            switch (lowerCase.hashCode()) {
                case 3401:
                    if (lowerCase.equals("js")) {
                        return "application/javascript";
                    }
                    String mimeTypeFromExtension = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    return mimeTypeFromExtension != null ? "application/octet-stream" : mimeTypeFromExtension;
                case 98819:
                    if (lowerCase.equals("css")) {
                        return "text/css";
                    }
                    String mimeTypeFromExtension2 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension2 != null) {
                    }
                    break;
                case 105441:
                    break;
                case 106458:
                    if (lowerCase.equals("m4a")) {
                        return "audio/mp4";
                    }
                    String mimeTypeFromExtension22 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension22 != null) {
                    }
                    break;
                case 108272:
                    if (lowerCase.equals("mp3")) {
                        return "audio/mpeg";
                    }
                    String mimeTypeFromExtension222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension222 != null) {
                    }
                    break;
                case 108273:
                    if (lowerCase.equals("mp4")) {
                        return "video/mp4";
                    }
                    String mimeTypeFromExtension2222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension2222 != null) {
                    }
                    break;
                case 109967:
                    if (lowerCase.equals("ogg")) {
                        return "audio/ogg";
                    }
                    String mimeTypeFromExtension22222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension22222 != null) {
                    }
                    break;
                case 111145:
                    if (lowerCase.equals("png")) {
                        return "image/png";
                    }
                    String mimeTypeFromExtension222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension222222 != null) {
                    }
                    break;
                case 114276:
                    if (lowerCase.equals("svg")) {
                        return "image/svg+xml";
                    }
                    String mimeTypeFromExtension2222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension2222222 != null) {
                    }
                    break;
                case 115174:
                    if (lowerCase.equals("ttf")) {
                        return "font/ttf";
                    }
                    String mimeTypeFromExtension22222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension22222222 != null) {
                    }
                    break;
                case 117484:
                    if (lowerCase.equals("wav")) {
                        return "audio/wav";
                    }
                    String mimeTypeFromExtension222222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension222222222 != null) {
                    }
                    break;
                case 3213227:
                    if (lowerCase.equals("html")) {
                        return "text/html";
                    }
                    String mimeTypeFromExtension2222222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension2222222222 != null) {
                    }
                    break;
                case 3268712:
                    break;
                case 3271912:
                    if (lowerCase.equals("json")) {
                        return "application/json";
                    }
                    String mimeTypeFromExtension22222222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension22222222222 != null) {
                    }
                    break;
                case 3645340:
                    if (lowerCase.equals("webp")) {
                        return "image/webp";
                    }
                    String mimeTypeFromExtension222222222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension222222222222 != null) {
                    }
                    break;
                case 3655064:
                    if (lowerCase.equals("woff")) {
                        return "font/woff";
                    }
                    String mimeTypeFromExtension2222222222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension2222222222222 != null) {
                    }
                    break;
                case 113307034:
                    if (lowerCase.equals("woff2")) {
                        return "font/woff2";
                    }
                    String mimeTypeFromExtension22222222222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension22222222222222 != null) {
                    }
                    break;
                default:
                    String mimeTypeFromExtension222222222222222 = MimeTypeMap.getSingleton().getMimeTypeFromExtension(substringAfterLast);
                    if (mimeTypeFromExtension222222222222222 != null) {
                    }
                    break;
            }
        }

        @Override // android.webkit.WebViewClient
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String str;
            Intrinsics.checkNotNullParameter(view, "view");
            Intrinsics.checkNotNullParameter(request, "request");
            String path = request.getUrl().getPath();
            String method = request.getMethod();
            if (path != null) {
                try {
                    if (StringsKt.startsWith$default(path, "/api/", false, 2, (Object) null)) {
                        ApiHandler apiHandler = this.this$0.api;
                        Uri url = request.getUrl();
                        Intrinsics.checkNotNullExpressionValue(url, "getUrl(...)");
                        Intrinsics.checkNotNull(method);
                        return apiHandler.handle(path, url, method);
                    }
                } catch (Exception e) {
                    Log.e("RhythmDance", "shouldInterceptRequest error: " + e.getMessage(), e);
                    String message = e.getMessage();
                    if (message == null || (str = StringsKt.replace$default(message, "\"", "'", false, 4, (Object) null)) == null) {
                        str = EnvironmentCompat.MEDIA_UNKNOWN;
                    }
                    byte[] bytes = ("{\"error\":\"" + str + "\"}").getBytes(Charsets.UTF_8);
                    Intrinsics.checkNotNullExpressionValue(bytes, "getBytes(...)");
                    return new WebResourceResponse("application/json", "UTF-8", new ByteArrayInputStream(bytes));
                }
            }
            if (path == null) {
                return null;
            }
            String str2 = this.assetsBase + path;
            String mimeType = getMimeType(path);
            byte[] readAssetBytes = this.this$0.readAssetBytes(str2);
            if (readAssetBytes != null) {
                return new WebResourceResponse(mimeType, "UTF-8", new ByteArrayInputStream(readAssetBytes));
            }
            if (Intrinsics.areEqual(path, "/assets/achievements.json")) {
                byte[] readAssetBytes2 = this.this$0.readAssetBytes(this.assetsBase + "/assets/achievements.json");
                if (readAssetBytes2 != null) {
                    return new WebResourceResponse("application/json", "UTF-8", new ByteArrayInputStream(readAssetBytes2));
                }
            }
            return null;
        }
    }

    /* compiled from: GameWebViewActivity.kt */
    @Metadata(d1 = {"\u0000,\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\f\n\u0002\u0010\b\n\u0002\b\t\n\u0002\u0010\u0002\n\u0002\b\u0006\n\u0002\u0010\u000b\n\u0002\b\u0006\b\u0086\u0004\u0018\u00002\u00020\u0001B\u0005¢\u0006\u0002\u0010\u0002J(\u0010\u0003\u001a\u00020\u00042\u0006\u0010\u0005\u001a\u00020\u00042\u0006\u0010\u0006\u001a\u00020\u00042\u0006\u0010\u0007\u001a\u00020\u00042\u0006\u0010\b\u001a\u00020\u0004H\u0007J\u0010\u0010\t\u001a\u00020\u00042\u0006\u0010\n\u001a\u00020\u0004H\u0007J\b\u0010\u000b\u001a\u00020\u0004H\u0007J\u0010\u0010\f\u001a\u00020\u00042\u0006\u0010\r\u001a\u00020\u0004H\u0007J0\u0010\u000e\u001a\u00020\u00042\u0006\u0010\r\u001a\u00020\u00042\u0006\u0010\u000f\u001a\u00020\u00042\u0006\u0010\u0010\u001a\u00020\u00112\u0006\u0010\u0012\u001a\u00020\u00042\u0006\u0010\u0013\u001a\u00020\u0004H\u0007J\b\u0010\u0014\u001a\u00020\u0004H\u0007J\b\u0010\u0015\u001a\u00020\u0004H\u0007J\b\u0010\u0016\u001a\u00020\u0004H\u0007J\b\u0010\u0017\u001a\u00020\u0004H\u0007J\u0010\u0010\u0018\u001a\u00020\u00042\u0006\u0010\u0019\u001a\u00020\u0004H\u0007J\u0010\u0010\u001a\u001a\u00020\u001b2\u0006\u0010\u001c\u001a\u00020\u0004H\u0007J\u0018\u0010\u001d\u001a\u00020\u001b2\u0006\u0010\u001e\u001a\u00020\u00112\u0006\u0010\u001f\u001a\u00020\u0004H\u0007J\u0010\u0010 \u001a\u00020\u001b2\u0006\u0010!\u001a\u00020\"H\u0007J\u0010\u0010#\u001a\u00020\"2\u0006\u0010\u0005\u001a\u00020\u0004H\u0007J\u0010\u0010$\u001a\u00020\u001b2\u0006\u0010%\u001a\u00020\u0004H\u0007J\b\u0010&\u001a\u00020\u0004H\u0007J\b\u0010'\u001a\u00020\u001bH\u0007¨\u0006("}, d2 = {"Lcom/rhythmdance/app/GameWebViewActivity$JsBridge;", "", "(Lcom/rhythmdance/app/GameWebViewActivity;)V", "apiMutate", "", "url", "method", "userId", "body", "decodeSongId", "songId", "getAchievements", "getAudioUrl", "songPath", "getChart", "difficulty", "lanes", "", "genre", "game", "getExternalStorage", "getProfile", "getSongs", "getStatus", "pickFile", "mimeType", "scanQR", "", "callbackId", "setTouchLanes", PeertubeParsingHelper.COUNT_KEY, "mode", "showTouchControls", "visible", "", "vsConnect", "vsSend", "message", "vsStartHost", "vsStop", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public final class JsBridge {
        public JsBridge() {
        }

        /* JADX INFO: Access modifiers changed from: private */
        public static final void scanQR$lambda$3(GameWebViewActivity this$0) {
            Intrinsics.checkNotNullParameter(this$0, "this$0");
            IntentIntegrator intentIntegrator = new IntentIntegrator(this$0);
            intentIntegrator.setOrientationLocked(false);
            intentIntegrator.initiateScan();
        }

        /* JADX INFO: Access modifiers changed from: private */
        public static final void setTouchLanes$lambda$0(GameWebViewActivity this$0, int i, String mode) {
            Intrinsics.checkNotNullParameter(this$0, "this$0");
            Intrinsics.checkNotNullParameter(mode, "$mode");
            TouchControlsOverlay touchControlsOverlay = this$0.touchOverlay;
            if (touchControlsOverlay == null) {
                Intrinsics.throwUninitializedPropertyAccessException("touchOverlay");
                touchControlsOverlay = null;
            }
            touchControlsOverlay.setLanes(i, mode);
        }

        /* JADX INFO: Access modifiers changed from: private */
        public static final void showTouchControls$lambda$1(GameWebViewActivity this$0, boolean z) {
            Intrinsics.checkNotNullParameter(this$0, "this$0");
            TouchControlsOverlay touchControlsOverlay = this$0.touchOverlay;
            if (touchControlsOverlay == null) {
                Intrinsics.throwUninitializedPropertyAccessException("touchOverlay");
                touchControlsOverlay = null;
            }
            touchControlsOverlay.setVisibility(z ? 0 : 8);
        }

        @JavascriptInterface
        public final String apiMutate(String url, String method, String userId, String body) {
            Intrinsics.checkNotNullParameter(url, "url");
            Intrinsics.checkNotNullParameter(method, "method");
            Intrinsics.checkNotNullParameter(userId, "userId");
            Intrinsics.checkNotNullParameter(body, "body");
            return GameWebViewActivity.this.api.handleMutation(url, method, userId, body);
        }

        @JavascriptInterface
        public final String decodeSongId(String songId) {
            Intrinsics.checkNotNullParameter(songId, "songId");
            String decodeSongPath = GameWebViewActivity.INSTANCE.decodeSongPath(songId);
            return decodeSongPath == null ? "" : decodeSongPath;
        }

        @JavascriptInterface
        public final String getAchievements() {
            return GameWebViewActivity.this.api.getAchievements(GameWebViewActivity.this);
        }

        @JavascriptInterface
        public final String getAudioUrl(String songPath) {
            Intrinsics.checkNotNullParameter(songPath, "songPath");
            return GameWebViewActivity.this.api.getAudioUriString(songPath);
        }

        @JavascriptInterface
        public final String getChart(String songPath, String difficulty, int lanes, String genre, String game) {
            Intrinsics.checkNotNullParameter(songPath, "songPath");
            Intrinsics.checkNotNullParameter(difficulty, "difficulty");
            Intrinsics.checkNotNullParameter(genre, "genre");
            Intrinsics.checkNotNullParameter(game, "game");
            return GameWebViewActivity.this.api.generateChart(songPath, difficulty, lanes, genre, game);
        }

        @JavascriptInterface
        public final String getExternalStorage() {
            String absolutePath = Environment.getExternalStorageDirectory().getAbsolutePath();
            Intrinsics.checkNotNullExpressionValue(absolutePath, "getAbsolutePath(...)");
            return absolutePath;
        }

        @JavascriptInterface
        public final String getProfile() {
            return GameWebViewActivity.this.api.getProfile(GameWebViewActivity.this);
        }

        @JavascriptInterface
        public final String getSongs() {
            return GameWebViewActivity.this.api.listSongs(GameWebViewActivity.this);
        }

        @JavascriptInterface
        public final String getStatus() {
            return GameWebViewActivity.this.api.getStatus(GameWebViewActivity.this);
        }

        @JavascriptInterface
        public final String pickFile(String mimeType) {
            Intrinsics.checkNotNullParameter(mimeType, "mimeType");
            return "";
        }

        @JavascriptInterface
        public final void scanQR(String callbackId) {
            Intrinsics.checkNotNullParameter(callbackId, "callbackId");
            GameWebViewActivity.this.pendingQrCallback = callbackId;
            GameWebViewActivity gameWebViewActivity = GameWebViewActivity.this;
            final GameWebViewActivity gameWebViewActivity2 = GameWebViewActivity.this;
            gameWebViewActivity.runOnUiThread(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$JsBridge$$ExternalSyntheticLambda2
                @Override // java.lang.Runnable
                public final void run() {
                    GameWebViewActivity.JsBridge.scanQR$lambda$3(GameWebViewActivity.this);
                }
            });
        }

        @JavascriptInterface
        public final void setTouchLanes(final int count, final String mode) {
            Intrinsics.checkNotNullParameter(mode, "mode");
            Log.i("RhythmDance", "setTouchLanes(count=" + count + ", mode=" + mode + ")");
            GameWebViewActivity gameWebViewActivity = GameWebViewActivity.this;
            final GameWebViewActivity gameWebViewActivity2 = GameWebViewActivity.this;
            gameWebViewActivity.runOnUiThread(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$JsBridge$$ExternalSyntheticLambda0
                @Override // java.lang.Runnable
                public final void run() {
                    GameWebViewActivity.JsBridge.setTouchLanes$lambda$0(GameWebViewActivity.this, count, mode);
                }
            });
        }

        @JavascriptInterface
        public final void showTouchControls(final boolean visible) {
            Log.i("RhythmDance", "showTouchControls(" + visible + ")");
            GameWebViewActivity gameWebViewActivity = GameWebViewActivity.this;
            final GameWebViewActivity gameWebViewActivity2 = GameWebViewActivity.this;
            gameWebViewActivity.runOnUiThread(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$JsBridge$$ExternalSyntheticLambda1
                @Override // java.lang.Runnable
                public final void run() {
                    GameWebViewActivity.JsBridge.showTouchControls$lambda$1(GameWebViewActivity.this, visible);
                }
            });
        }

        @JavascriptInterface
        public final boolean vsConnect(String url) {
            Intrinsics.checkNotNullParameter(url, "url");
            VsManager vsManager = GameWebViewActivity.this.vsManager;
            if (vsManager == null) {
                Intrinsics.throwUninitializedPropertyAccessException("vsManager");
                vsManager = null;
            }
            return vsManager.connect(url);
        }

        @JavascriptInterface
        public final void vsSend(String message) {
            Intrinsics.checkNotNullParameter(message, "message");
            VsManager vsManager = GameWebViewActivity.this.vsManager;
            if (vsManager == null) {
                Intrinsics.throwUninitializedPropertyAccessException("vsManager");
                vsManager = null;
            }
            vsManager.send(message);
        }

        @JavascriptInterface
        public final String vsStartHost() {
            VsManager vsManager = GameWebViewActivity.this.vsManager;
            if (vsManager == null) {
                Intrinsics.throwUninitializedPropertyAccessException("vsManager");
                vsManager = null;
            }
            String startHost = vsManager.startHost();
            return startHost == null ? "" : startHost;
        }

        @JavascriptInterface
        public final void vsStop() {
            VsManager vsManager = GameWebViewActivity.this.vsManager;
            if (vsManager == null) {
                Intrinsics.throwUninitializedPropertyAccessException("vsManager");
                vsManager = null;
            }
            vsManager.stop();
        }
    }

    private final void enterImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(5894);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onActivityResult$lambda$6(GameWebViewActivity this$0, String js) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        Intrinsics.checkNotNullParameter(js, "$js");
        WebView webView = this$0.webView;
        if (webView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView = null;
        }
        webView.evaluateJavascript(js, null);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onActivityResult$lambda$7(GameWebViewActivity this$0, String str) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        WebView webView = this$0.webView;
        if (webView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView = null;
        }
        webView.evaluateJavascript("window.__onQrResult && window.__onQrResult(\"" + str + "\",null,null)", null);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onRequestPermissionsResult$lambda$4(GameWebViewActivity this$0) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        WebView webView = this$0.webView;
        if (webView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView = null;
        }
        webView.reload();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final byte[] readAssetBytes(String path) {
        try {
            InputStream open = getAssets().open(path);
            Intrinsics.checkNotNullExpressionValue(open, "open(...)");
            return ByteStreamsKt.readBytes(open);
        } catch (Exception e) {
            return null;
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final String readAssetString(String path) {
        try {
            InputStream open = getAssets().open(path);
            Intrinsics.checkNotNullExpressionValue(open, "open(...)");
            Reader inputStreamReader = new InputStreamReader(open, Charsets.UTF_8);
            BufferedReader bufferedReader = inputStreamReader instanceof BufferedReader ? (BufferedReader) inputStreamReader : new BufferedReader(inputStreamReader, 8192);
            try {
                String readText = TextStreamsKt.readText(bufferedReader);
                CloseableKt.closeFinally(bufferedReader, null);
                return readText;
            } finally {
            }
        } catch (Exception e) {
            return null;
        }
    }

    private final void requestAudioPermission() {
        String str = Build.VERSION.SDK_INT >= 33 ? "android.permission.READ_MEDIA_AUDIO" : "android.permission.READ_EXTERNAL_STORAGE";
        if (ContextCompat.checkSelfPermission(this, str) != 0) {
            ActivityCompat.requestPermissions(this, new String[]{str}, 1001);
        }
    }

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, android.app.Activity
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult parseActivityResult = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (parseActivityResult == null) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        final String str = this.pendingQrCallback;
        this.pendingQrCallback = null;
        if (parseActivityResult.getContents() == null) {
            runOnUiThread(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$$ExternalSyntheticLambda1
                @Override // java.lang.Runnable
                public final void run() {
                    GameWebViewActivity.onActivityResult$lambda$7(GameWebViewActivity.this, str);
                }
            });
            return;
        }
        String contents = parseActivityResult.getContents();
        Intrinsics.checkNotNullExpressionValue(contents, "getContents(...)");
        String obj = StringsKt.trim((CharSequence) contents).toString();
        String str2 = "5174";
        try {
            JSONObject jSONObject = new JSONObject(obj);
            String optString = jSONObject.optString("ip", obj);
            Intrinsics.checkNotNullExpressionValue(optString, "optString(...)");
            obj = optString;
            String optString2 = jSONObject.optString("port", "5174");
            Intrinsics.checkNotNullExpressionValue(optString2, "optString(...)");
            str2 = optString2;
        } catch (Exception e) {
            List split$default = StringsKt.split$default((CharSequence) obj, new String[]{":"}, false, 0, 6, (Object) null);
            if (split$default.size() == 2) {
                obj = (String) split$default.get(0);
                str2 = (String) split$default.get(1);
            }
        }
        final String str3 = "window.__onQrResult && window.__onQrResult(\"" + str + "\",\"" + StringsKt.replace$default(obj, "\"", "\\\"", false, 4, (Object) null) + "\",\"" + str2 + "\")";
        runOnUiThread(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$$ExternalSyntheticLambda0
            @Override // java.lang.Runnable
            public final void run() {
                GameWebViewActivity.onActivityResult$lambda$6(GameWebViewActivity.this, str3);
            }
        });
    }

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        WebView webView;
        super.onCreate(savedInstanceState);
        requestAudioPermission();
        try {
            NewPipe.init(new SimpleDownloader());
        } catch (Exception e) {
            Log.e("RhythmDance", "NewPipe init failed", e);
        }
        WebView webView2 = new WebView(this);
        WebSettings settings = webView2.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(0);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(-1);
        webView2.setBackgroundColor(-16447985);
        webView2.setWebViewClient(new GameWebViewClient(this, "dist"));
        webView2.setWebChromeClient(new GameWebViewActivity$onCreate$1$2());
        webView2.addJavascriptInterface(new JsBridge(), "AndroidBridge");
        WebView.setWebContentsDebuggingEnabled(true);
        this.webView = webView2;
        GameWebViewActivity gameWebViewActivity = this;
        WebView webView3 = this.webView;
        if (webView3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView3 = null;
        }
        TouchControlsOverlay touchControlsOverlay = new TouchControlsOverlay(gameWebViewActivity, webView3);
        touchControlsOverlay.setVisibility(8);
        touchControlsOverlay.setLanes(5, "dance");
        this.touchOverlay = touchControlsOverlay;
        VsManager vsManager = new VsManager(this);
        vsManager.setOnGameMessage(new GameWebViewActivity$onCreate$3$1(this));
        vsManager.setOnPeerConnected(new GameWebViewActivity$onCreate$3$2(this));
        vsManager.setOnPeerDisconnected(new GameWebViewActivity$onCreate$3$3(this));
        this.vsManager = vsManager;
        FrameLayout frameLayout = new FrameLayout(this);
        WebView webView4 = this.webView;
        if (webView4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView4 = null;
        }
        frameLayout.addView(webView4, new ViewGroup.LayoutParams(-1, -1));
        TouchControlsOverlay touchControlsOverlay2 = this.touchOverlay;
        if (touchControlsOverlay2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("touchOverlay");
            touchControlsOverlay2 = null;
        }
        frameLayout.addView(touchControlsOverlay2, new ViewGroup.LayoutParams(-1, -1));
        setContentView(frameLayout);
        String readAssetString = readAssetString("dist/index.html");
        if (readAssetString == null) {
            readAssetString = errorPage;
        }
        String replace$default = StringsKt.replace$default(StringsKt.replace$default(StringsKt.replace$default(readAssetString, "width=device-width, initial-scale=1.0", "width=1920, user-scalable=no", false, 4, (Object) null), "</head>", SCRIPT_FETCH_OVERRIDE + "\n</head>", false, 4, (Object) null), "<div id=\"dlResults\" class=\"dl-results\"></div>", "<div id=\"dlResults\" class=\"dl-results\"></div>" + SYNC_PANEL_HTML, false, 4, (Object) null);
        WebView webView5 = this.webView;
        if (webView5 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView = null;
        } else {
            webView = webView5;
        }
        webView.loadDataWithBaseURL("https://rd.local/", replace$default, "text/html", "UTF-8", null);
    }

    @Override // androidx.appcompat.app.AppCompatActivity, androidx.fragment.app.FragmentActivity, android.app.Activity
    protected void onDestroy() {
        VsManager vsManager = this.vsManager;
        WebView webView = null;
        if (vsManager == null) {
            Intrinsics.throwUninitializedPropertyAccessException("vsManager");
            vsManager = null;
        }
        vsManager.stop();
        WebView webView2 = this.webView;
        if (webView2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView2 = null;
        }
        webView2.removeAllViews();
        WebView webView3 = this.webView;
        if (webView3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
        } else {
            webView = webView3;
        }
        webView.destroy();
        super.onDestroy();
    }

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, android.app.Activity
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        Intrinsics.checkNotNullParameter(permissions, "permissions");
        Intrinsics.checkNotNullParameter(grantResults, "grantResults");
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1001) {
            boolean z = ((grantResults.length == 0) ^ true) && grantResults[0] == 0;
            Log.i("RhythmDance", "Permission result: granted=" + z);
            if (z) {
                WebView webView = this.webView;
                if (webView == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("webView");
                    webView = null;
                }
                webView.post(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$$ExternalSyntheticLambda2
                    @Override // java.lang.Runnable
                    public final void run() {
                        GameWebViewActivity.onRequestPermissionsResult$lambda$4(GameWebViewActivity.this);
                    }
                });
            }
        }
    }

    @Override // androidx.fragment.app.FragmentActivity, android.app.Activity
    protected void onResume() {
        super.onResume();
        enterImmersive();
    }

    @Override // android.app.Activity, android.view.Window.Callback
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enterImmersive();
        }
    }
}
