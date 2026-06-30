package com.rhythmdance.app;

import android.os.Handler;
import androidx.core.app.NotificationCompat;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.functions.Function2;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Lambda;

/* compiled from: VsManager.kt */
@Metadata(d1 = {"\u0000\u0010\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\u0010\u0000\u001a\u00020\u00012\u0006\u0010\u0002\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u0003H\n¢\u0006\u0002\b\u0005"}, d2 = {"<anonymous>", "", "clientId", "", NotificationCompat.CATEGORY_MESSAGE, "invoke"}, k = 3, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
final class VsManager$startHost$1 extends Lambda implements Function2<String, String, Unit> {
    final /* synthetic */ VsManager this$0;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    VsManager$startHost$1(VsManager vsManager) {
        super(2);
        this.this$0 = vsManager;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void invoke$lambda$0(VsManager this$0, String msg) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        Intrinsics.checkNotNullParameter(msg, "$msg");
        Function1<String, Unit> onGameMessage = this$0.getOnGameMessage();
        if (onGameMessage != null) {
            onGameMessage.invoke(msg);
        }
    }

    @Override // kotlin.jvm.functions.Function2
    public /* bridge */ /* synthetic */ Unit invoke(String str, String str2) {
        invoke2(str, str2);
        return Unit.INSTANCE;
    }

    /* renamed from: invoke, reason: avoid collision after fix types in other method */
    public final void invoke2(String clientId, final String msg) {
        Handler handler;
        VsWebSocketServer vsWebSocketServer;
        Intrinsics.checkNotNullParameter(clientId, "clientId");
        Intrinsics.checkNotNullParameter(msg, "msg");
        handler = this.this$0.mainHandler;
        final VsManager vsManager = this.this$0;
        handler.post(new Runnable() { // from class: com.rhythmdance.app.VsManager$startHost$1$$ExternalSyntheticLambda0
            @Override // java.lang.Runnable
            public final void run() {
                VsManager$startHost$1.invoke$lambda$0(VsManager.this, msg);
            }
        });
        vsWebSocketServer = this.this$0.server;
        vsWebSocketServer.broadcast(msg, clientId);
    }
}
