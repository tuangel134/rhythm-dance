package com.rhythmdance.app;

import android.net.Uri;
import android.os.Handler;
import android.widget.TextView;
import com.rhythmdance.app.game.AudioDecoder;
import com.rhythmdance.app.game.ChartGenerator;
import com.rhythmdance.app.game.DecodedAudio;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Lambda;
import kotlin.ranges.RangesKt;

/* compiled from: GameActivity.kt */
@Metadata(d1 = {"\u0000\b\n\u0000\n\u0002\u0010\u0002\n\u0000\u0010\u0000\u001a\u00020\u0001H\n¢\u0006\u0002\b\u0002"}, d2 = {"<anonymous>", "", "invoke"}, k = 3, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
final class GameActivity$prepare$1 extends Lambda implements Function0<Unit> {
    final /* synthetic */ int $diffIdx;
    final /* synthetic */ int $lanes;
    final /* synthetic */ Uri $uri;
    final /* synthetic */ GameActivity this$0;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    GameActivity$prepare$1(GameActivity gameActivity, Uri uri, int i, int i2) {
        super(0);
        this.this$0 = gameActivity;
        this.$uri = uri;
        this.$diffIdx = i;
        this.$lanes = i2;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void invoke$lambda$0(GameActivity this$0) {
        TextView textView;
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        textView = this$0.loadingText;
        if (textView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("loadingText");
            textView = null;
        }
        textView.setText("No se pudo leer el audio.\nPrueba otro archivo.");
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void invoke$lambda$1(GameActivity this$0) {
        TextView textView;
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        textView = this$0.loadingText;
        if (textView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("loadingText");
            textView = null;
        }
        textView.setText("Generando la pista al ritmo…");
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void invoke$lambda$2(GameActivity this$0, Exception e) {
        TextView textView;
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        Intrinsics.checkNotNullParameter(e, "$e");
        textView = this$0.loadingText;
        if (textView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("loadingText");
            textView = null;
        }
        textView.setText("Error generando la pista: " + e.getMessage());
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void invoke$lambda$3(GameActivity this$0, Uri uri) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        Intrinsics.checkNotNullParameter(uri, "$uri");
        this$0.startGame(uri);
    }

    @Override // kotlin.jvm.functions.Function0
    public /* bridge */ /* synthetic */ Unit invoke() {
        invoke2();
        return Unit.INSTANCE;
    }

    /* renamed from: invoke, reason: avoid collision after fix types in other method */
    public final void invoke2() {
        Handler handler;
        Handler handler2;
        Handler handler3;
        Handler handler4;
        DecodedAudio decode = AudioDecoder.INSTANCE.decode(this.this$0, this.$uri);
        if (decode == null) {
            handler4 = this.this$0.ui;
            final GameActivity gameActivity = this.this$0;
            handler4.post(new Runnable() { // from class: com.rhythmdance.app.GameActivity$prepare$1$$ExternalSyntheticLambda0
                @Override // java.lang.Runnable
                public final void run() {
                    GameActivity$prepare$1.invoke$lambda$0(GameActivity.this);
                }
            });
            return;
        }
        handler = this.this$0.ui;
        final GameActivity gameActivity2 = this.this$0;
        handler.post(new Runnable() { // from class: com.rhythmdance.app.GameActivity$prepare$1$$ExternalSyntheticLambda1
            @Override // java.lang.Runnable
            public final void run() {
                GameActivity$prepare$1.invoke$lambda$1(GameActivity.this);
            }
        });
        try {
            this.this$0.chart = ChartGenerator.generate$default(ChartGenerator.INSTANCE, decode, this.$lanes, ChartGenerator.INSTANCE.getDIFFICULTIES().get(RangesKt.coerceIn(this.$diffIdx, 0, ChartGenerator.INSTANCE.getDIFFICULTIES().size() - 1)), 0.0d, 8, null);
            handler3 = this.this$0.ui;
            final GameActivity gameActivity3 = this.this$0;
            final Uri uri = this.$uri;
            handler3.post(new Runnable() { // from class: com.rhythmdance.app.GameActivity$prepare$1$$ExternalSyntheticLambda3
                @Override // java.lang.Runnable
                public final void run() {
                    GameActivity$prepare$1.invoke$lambda$3(GameActivity.this, uri);
                }
            });
        } catch (Exception e) {
            handler2 = this.this$0.ui;
            final GameActivity gameActivity4 = this.this$0;
            handler2.post(new Runnable() { // from class: com.rhythmdance.app.GameActivity$prepare$1$$ExternalSyntheticLambda2
                @Override // java.lang.Runnable
                public final void run() {
                    GameActivity$prepare$1.invoke$lambda$2(GameActivity.this, e);
                }
            });
        }
    }
}
