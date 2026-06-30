package com.rhythmdance.app;

import android.app.AlertDialog;
import android.content.DialogInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

/* compiled from: GameWebViewActivity.kt */
@Metadata(d1 = {"\u0000'\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002*\u0001\u0000\b\n\u0018\u00002\u00020\u0001J(\u0010\u0002\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u00072\u0006\u0010\b\u001a\u00020\u00072\u0006\u0010\t\u001a\u00020\nH\u0016J(\u0010\u000b\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u00052\u0006\u0010\u0006\u001a\u00020\u00072\u0006\u0010\b\u001a\u00020\u00072\u0006\u0010\t\u001a\u00020\nH\u0016¨\u0006\f"}, d2 = {"com/rhythmdance/app/GameWebViewActivity$onCreate$1$2", "Landroid/webkit/WebChromeClient;", "onJsAlert", "", "view", "Landroid/webkit/WebView;", "url", "", "message", "result", "Landroid/webkit/JsResult;", "onJsConfirm", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class GameWebViewActivity$onCreate$1$2 extends WebChromeClient {
    GameWebViewActivity$onCreate$1$2() {
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onJsAlert$lambda$0(JsResult result, DialogInterface dialogInterface, int i) {
        Intrinsics.checkNotNullParameter(result, "$result");
        result.confirm();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onJsAlert$lambda$1(JsResult result, DialogInterface dialogInterface) {
        Intrinsics.checkNotNullParameter(result, "$result");
        result.cancel();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onJsConfirm$lambda$2(JsResult result, DialogInterface dialogInterface, int i) {
        Intrinsics.checkNotNullParameter(result, "$result");
        result.confirm();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onJsConfirm$lambda$3(JsResult result, DialogInterface dialogInterface, int i) {
        Intrinsics.checkNotNullParameter(result, "$result");
        result.cancel();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onJsConfirm$lambda$4(JsResult result, DialogInterface dialogInterface) {
        Intrinsics.checkNotNullParameter(result, "$result");
        result.cancel();
    }

    @Override // android.webkit.WebChromeClient
    public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
        Intrinsics.checkNotNullParameter(view, "view");
        Intrinsics.checkNotNullParameter(url, "url");
        Intrinsics.checkNotNullParameter(message, "message");
        Intrinsics.checkNotNullParameter(result, "result");
        new AlertDialog.Builder(view.getContext()).setMessage(message).setPositiveButton("OK", new DialogInterface.OnClickListener() { // from class: com.rhythmdance.app.GameWebViewActivity$onCreate$1$2$$ExternalSyntheticLambda3
            @Override // android.content.DialogInterface.OnClickListener
            public final void onClick(DialogInterface dialogInterface, int i) {
                GameWebViewActivity$onCreate$1$2.onJsAlert$lambda$0(result, dialogInterface, i);
            }
        }).setOnCancelListener(new DialogInterface.OnCancelListener() { // from class: com.rhythmdance.app.GameWebViewActivity$onCreate$1$2$$ExternalSyntheticLambda4
            @Override // android.content.DialogInterface.OnCancelListener
            public final void onCancel(DialogInterface dialogInterface) {
                GameWebViewActivity$onCreate$1$2.onJsAlert$lambda$1(result, dialogInterface);
            }
        }).create().show();
        return true;
    }

    @Override // android.webkit.WebChromeClient
    public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
        Intrinsics.checkNotNullParameter(view, "view");
        Intrinsics.checkNotNullParameter(url, "url");
        Intrinsics.checkNotNullParameter(message, "message");
        Intrinsics.checkNotNullParameter(result, "result");
        new AlertDialog.Builder(view.getContext()).setMessage(message).setPositiveButton("OK", new DialogInterface.OnClickListener() { // from class: com.rhythmdance.app.GameWebViewActivity$onCreate$1$2$$ExternalSyntheticLambda0
            @Override // android.content.DialogInterface.OnClickListener
            public final void onClick(DialogInterface dialogInterface, int i) {
                GameWebViewActivity$onCreate$1$2.onJsConfirm$lambda$2(result, dialogInterface, i);
            }
        }).setNegativeButton("Cancelar", new DialogInterface.OnClickListener() { // from class: com.rhythmdance.app.GameWebViewActivity$onCreate$1$2$$ExternalSyntheticLambda1
            @Override // android.content.DialogInterface.OnClickListener
            public final void onClick(DialogInterface dialogInterface, int i) {
                GameWebViewActivity$onCreate$1$2.onJsConfirm$lambda$3(result, dialogInterface, i);
            }
        }).setOnCancelListener(new DialogInterface.OnCancelListener() { // from class: com.rhythmdance.app.GameWebViewActivity$onCreate$1$2$$ExternalSyntheticLambda2
            @Override // android.content.DialogInterface.OnCancelListener
            public final void onCancel(DialogInterface dialogInterface) {
                GameWebViewActivity$onCreate$1$2.onJsConfirm$lambda$4(result, dialogInterface);
            }
        }).create().show();
        return true;
    }
}
