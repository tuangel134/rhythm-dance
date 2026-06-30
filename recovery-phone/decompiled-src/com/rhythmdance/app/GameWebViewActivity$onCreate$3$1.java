package com.rhythmdance.app;

import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Lambda;
import kotlin.text.StringsKt;

/* compiled from: GameWebViewActivity.kt */
@Metadata(d1 = {"\u0000\u000e\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\u0010\u0000\u001a\u00020\u00012\u0006\u0010\u0002\u001a\u00020\u0003H\n¢\u0006\u0002\b\u0004"}, d2 = {"<anonymous>", "", NotificationCompat.CATEGORY_MESSAGE, "", "invoke"}, k = 3, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
final class GameWebViewActivity$onCreate$3$1 extends Lambda implements Function1<String, Unit> {
    final /* synthetic */ GameWebViewActivity this$0;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    GameWebViewActivity$onCreate$3$1(GameWebViewActivity gameWebViewActivity) {
        super(1);
        this.this$0 = gameWebViewActivity;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void invoke$lambda$0(GameWebViewActivity this$0, String msg) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        Intrinsics.checkNotNullParameter(msg, "$msg");
        WebView webView = this$0.webView;
        if (webView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView = null;
        }
        webView.evaluateJavascript(StringsKt.trimIndent("\n                    (function(){\n                        var e = new CustomEvent('vsMessage', {detail: " + msg + "});\n                        window.dispatchEvent(e);\n                    })();\n                "), null);
    }

    @Override // kotlin.jvm.functions.Function1
    public /* bridge */ /* synthetic */ Unit invoke(String str) {
        invoke2(str);
        return Unit.INSTANCE;
    }

    /* renamed from: invoke, reason: avoid collision after fix types in other method */
    public final void invoke2(final String msg) {
        Intrinsics.checkNotNullParameter(msg, "msg");
        WebView webView = this.this$0.webView;
        if (webView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView = null;
        }
        final GameWebViewActivity gameWebViewActivity = this.this$0;
        webView.post(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$onCreate$3$1$$ExternalSyntheticLambda0
            @Override // java.lang.Runnable
            public final void run() {
                GameWebViewActivity$onCreate$3$1.invoke$lambda$0(GameWebViewActivity.this, msg);
            }
        });
    }
}
