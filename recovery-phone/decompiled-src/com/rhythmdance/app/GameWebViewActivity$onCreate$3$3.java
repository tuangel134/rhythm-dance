package com.rhythmdance.app;

import android.webkit.WebView;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Lambda;

/* compiled from: GameWebViewActivity.kt */
@Metadata(d1 = {"\u0000\b\n\u0000\n\u0002\u0010\u0002\n\u0000\u0010\u0000\u001a\u00020\u0001H\n¢\u0006\u0002\b\u0002"}, d2 = {"<anonymous>", "", "invoke"}, k = 3, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
final class GameWebViewActivity$onCreate$3$3 extends Lambda implements Function0<Unit> {
    final /* synthetic */ GameWebViewActivity this$0;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    GameWebViewActivity$onCreate$3$3(GameWebViewActivity gameWebViewActivity) {
        super(0);
        this.this$0 = gameWebViewActivity;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void invoke$lambda$0(GameWebViewActivity this$0) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        WebView webView = this$0.webView;
        if (webView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView = null;
        }
        webView.evaluateJavascript("(function(){\n    var e = new CustomEvent('vsDisconnected', {detail: {}});\n    window.dispatchEvent(e);\n})();", null);
    }

    @Override // kotlin.jvm.functions.Function0
    public /* bridge */ /* synthetic */ Unit invoke() {
        invoke2();
        return Unit.INSTANCE;
    }

    /* renamed from: invoke, reason: avoid collision after fix types in other method */
    public final void invoke2() {
        WebView webView = this.this$0.webView;
        if (webView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("webView");
            webView = null;
        }
        final GameWebViewActivity gameWebViewActivity = this.this$0;
        webView.post(new Runnable() { // from class: com.rhythmdance.app.GameWebViewActivity$onCreate$3$3$$ExternalSyntheticLambda0
            @Override // java.lang.Runnable
            public final void run() {
                GameWebViewActivity$onCreate$3$3.invoke$lambda$0(GameWebViewActivity.this);
            }
        });
    }
}
