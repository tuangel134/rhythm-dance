package com.rhythmdance.app;

import android.os.Handler;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Lambda;

/* compiled from: VsManager.kt */
@Metadata(d1 = {"\u0000\u000e\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0000\u0010\u0000\u001a\u00020\u00012\u0006\u0010\u0002\u001a\u00020\u0003H\n¢\u0006\u0002\b\u0004"}, d2 = {"<anonymous>", "", "clientId", "", "invoke"}, k = 3, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
final class VsManager$startHost$2 extends Lambda implements Function1<String, Unit> {
    final /* synthetic */ VsManager this$0;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    VsManager$startHost$2(VsManager vsManager) {
        super(1);
        this.this$0 = vsManager;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void invoke$lambda$0(VsManager this$0, String clientId) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        Intrinsics.checkNotNullParameter(clientId, "$clientId");
        Function1<String, Unit> onPeerConnected = this$0.getOnPeerConnected();
        if (onPeerConnected != null) {
            onPeerConnected.invoke(clientId);
        }
    }

    @Override // kotlin.jvm.functions.Function1
    public /* bridge */ /* synthetic */ Unit invoke(String str) {
        invoke2(str);
        return Unit.INSTANCE;
    }

    /* renamed from: invoke, reason: avoid collision after fix types in other method */
    public final void invoke2(final String clientId) {
        Handler handler;
        Intrinsics.checkNotNullParameter(clientId, "clientId");
        handler = this.this$0.mainHandler;
        final VsManager vsManager = this.this$0;
        handler.post(new Runnable() { // from class: com.rhythmdance.app.VsManager$startHost$2$$ExternalSyntheticLambda0
            @Override // java.lang.Runnable
            public final void run() {
                VsManager$startHost$2.invoke$lambda$0(VsManager.this, clientId);
            }
        });
    }
}
