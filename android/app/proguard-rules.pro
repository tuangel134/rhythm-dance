# Reglas ProGuard. La app es un WebView simple; no se necesita ofuscacion
# especial. Se conservan las clases con @JavascriptInterface por seguridad.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
