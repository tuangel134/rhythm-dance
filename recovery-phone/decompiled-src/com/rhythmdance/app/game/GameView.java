package com.rhythmdance.app.game;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.MotionEvent;
import android.view.View;
import androidx.core.app.NotificationCompat;
import com.google.android.material.card.MaterialCardViewHelper;
import java.util.ArrayList;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;
import org.schabi.newpipe.extractor.services.peertube.PeertubeParsingHelper;

/* compiled from: GameView.kt */
@Metadata(d1 = {"\u0000¤\u0001\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0007\n\u0000\n\u0002\u0010\b\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\u0006\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0015\n\u0002\b\u0004\n\u0002\u0010\t\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\b\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0010\u0014\n\u0002\b\u0011\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u000e\n\u0002\u0018\u0002\n\u0002\b\t\n\u0002\u0018\u0002\n\u0002\b\r\u0018\u00002\u00020\u0001:\u0004qrstB\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003¢\u0006\u0002\u0010\u0004J\u000e\u0010I\u001a\u00020J2\u0006\u0010K\u001a\u00020LJ@\u0010M\u001a\u00020J2\u0006\u0010N\u001a\u00020O2\u0006\u0010P\u001a\u00020\b2\u0006\u0010Q\u001a\u00020\b2\u0006\u0010R\u001a\u00020\b2\u0006\u0010S\u001a\u00020\n2\u0006\u0010T\u001a\u0002012\u0006\u0010U\u001a\u00020\u0013H\u0002J\u0018\u0010V\u001a\u00020J2\u0006\u0010N\u001a\u00020O2\u0006\u0010W\u001a\u00020\bH\u0002J\u0010\u0010X\u001a\u00020J2\u0006\u0010N\u001a\u00020OH\u0002J\u0010\u0010Y\u001a\u00020J2\u0006\u0010N\u001a\u00020OH\u0002J\u0018\u0010Z\u001a\u00020J2\u0006\u0010N\u001a\u00020O2\u0006\u0010W\u001a\u00020\bH\u0002J\b\u0010[\u001a\u00020JH\u0002J\b\u0010\\\u001a\u00020JH\u0002J\u0010\u0010]\u001a\u00020^2\u0006\u0010W\u001a\u00020\u0016H\u0002J\u0010\u0010_\u001a\u00020\b2\u0006\u0010S\u001a\u00020\nH\u0002J\u0010\u0010`\u001a\u00020J2\u0006\u0010N\u001a\u00020OH\u0014J(\u0010a\u001a\u00020J2\u0006\u0010b\u001a\u00020\n2\u0006\u0010c\u001a\u00020\n2\u0006\u0010d\u001a\u00020\n2\u0006\u0010e\u001a\u00020\nH\u0014J\u0010\u0010f\u001a\u00020\u00132\u0006\u0010g\u001a\u00020hH\u0016J\u0010\u0010i\u001a\u00020J2\u0006\u0010S\u001a\u00020\nH\u0002J\b\u0010j\u001a\u00020\bH\u0002J\b\u0010k\u001a\u00020JH\u0002J\u0016\u0010l\u001a\u00020J2\u0006\u0010\u000f\u001a\u00020\u00102\u0006\u0010m\u001a\u00020\u0016J\u0006\u0010n\u001a\u00020JJ\u0006\u0010o\u001a\u00020JJ\b\u0010p\u001a\u00020JH\u0002R\u000e\u0010\u0005\u001a\u00020\u0006X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\bX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\f\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u000e\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u0010\u0010\u000f\u001a\u0004\u0018\u00010\u0010X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0011\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0012\u001a\u00020\u0013X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0014\u001a\u00020\u0013X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0015\u001a\u00020\u0016X\u0082D¢\u0006\u0002\n\u0000R\u000e\u0010\u0017\u001a\u00020\u0016X\u0082D¢\u0006\u0002\n\u0000R\u001e\u0010\u0018\u001a\u0012\u0012\u0004\u0012\u00020\u001a0\u0019j\b\u0012\u0004\u0012\u00020\u001a`\u001bX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u001c\u001a\u00020\u001dX\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u001e\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u001f\u001a\u00020\u001dX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010 \u001a\u00020\bX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010!\u001a\u00020\"X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010#\u001a\u00020\u0016X\u0082\u000e¢\u0006\u0002\n\u0000R\u001c\u0010$\u001a\u0004\u0018\u00010%X\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b&\u0010'\"\u0004\b(\u0010)R\u000e\u0010*\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010+\u001a\u00020\u0016X\u0082D¢\u0006\u0002\n\u0000R\u000e\u0010,\u001a\u00020\bX\u0082\u000e¢\u0006\u0002\n\u0000R\u0014\u0010-\u001a\b\u0012\u0004\u0012\u00020/0.X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u00100\u001a\u000201X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u00102\u001a\u000201X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u00103\u001a\u000201X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u00104\u001a\u000201X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u00105\u001a\u000201X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u00106\u001a\u00020\u0016X\u0082D¢\u0006\u0002\n\u0000R\u000e\u00107\u001a\u000208X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u00109\u001a\u00020\bX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010:\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u001a\u0010;\u001a\u00020\u0013X\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b<\u0010=\"\u0004\b>\u0010?R\u000e\u0010@\u001a\u00020\nX\u0082\u000e¢\u0006\u0002\n\u0000R\u001a\u0010A\u001a\u00020\u0016X\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\bB\u0010C\"\u0004\bD\u0010ER\u001a\u0010F\u001a\u00020\u0016X\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\bG\u0010C\"\u0004\bH\u0010E¨\u0006u"}, d2 = {"Lcom/rhythmdance/app/game/GameView;", "Landroid/view/View;", "context", "Landroid/content/Context;", "(Landroid/content/Context;)V", "arrowPath", "Landroid/graphics/Path;", "boardLeft", "", "cGood", "", "cGreat", "cMiss", "cOk", "cPerfect", "chart", "Lcom/rhythmdance/app/game/Chart;", "combo", "ended", "", "failed", "goodW", "", "greatW", "hitFx", "Ljava/util/ArrayList;", "Lcom/rhythmdance/app/game/GameView$HitFx;", "Lkotlin/collections/ArrayList;", "laneColors", "", "laneCount", "laneCursors", "laneW", "lastFrameNs", "", "life", "listener", "Lcom/rhythmdance/app/game/GameView$Listener;", "getListener", "()Lcom/rhythmdance/app/game/GameView$Listener;", "setListener", "(Lcom/rhythmdance/app/game/GameView$Listener;)V", "maxCombo", "missW", "noteSize", "notes", "", "Lcom/rhythmdance/app/game/Note;", "pGlow", "Landroid/graphics/Paint;", "pLine", "pNote", "pReceptor", "pText", "perfectW", "receptorFlash", "", "receptorY", "resolved", "running", "getRunning", "()Z", "setRunning", "(Z)V", "score", "scrollSpeed", "getScrollSpeed", "()D", "setScrollSpeed", "(D)V", "songTime", "getSongTime", "setSongTime", "bumpJudgeCount", "", "label", "", "drawArrowPath", "canvas", "Landroid/graphics/Canvas;", "cx", "cy", "r", "lane", "paint", "fill", "drawHitFx", "dt", "drawLanes", "drawNotes", "drawReceptors", "fail", "finish", "judge", "Lcom/rhythmdance/app/game/GameView$Judgement;", "laneCenterX", "onDraw", "onSizeChanged", "w", "h", "ow", "oh", "onTouchEvent", NotificationCompat.CATEGORY_EVENT, "Landroid/view/MotionEvent;", "pressLane", "pxPerSec", "recomputeLayout", "setChart", "speed", PeertubeParsingHelper.START_KEY, "stop", "update", "HitFx", "Judgement", "Listener", "Result", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes3.dex */
public final class GameView extends View {
    private final Path arrowPath;
    private float boardLeft;
    private int cGood;
    private int cGreat;
    private int cMiss;
    private int cOk;
    private int cPerfect;
    private Chart chart;
    private int combo;
    private boolean ended;
    private boolean failed;
    private final double goodW;
    private final double greatW;
    private final ArrayList<HitFx> hitFx;
    private int[] laneColors;
    private int laneCount;
    private final int[] laneCursors;
    private float laneW;
    private long lastFrameNs;
    private double life;
    private Listener listener;
    private int maxCombo;
    private final double missW;
    private float noteSize;
    private List<Note> notes;
    private final Paint pGlow;
    private final Paint pLine;
    private final Paint pNote;
    private final Paint pReceptor;
    private final Paint pText;
    private final double perfectW;
    private final float[] receptorFlash;
    private float receptorY;
    private int resolved;
    private volatile boolean running;
    private int score;
    private double scrollSpeed;
    private volatile double songTime;

    /* compiled from: GameView.kt */
    @Metadata(d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u0007\n\u0002\b\u000b\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0000\b\u0082\b\u0018\u00002\u00020\u0001B\u0015\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0002\u0010\u0006J\t\u0010\r\u001a\u00020\u0003HÆ\u0003J\t\u0010\u000e\u001a\u00020\u0005HÆ\u0003J\u001d\u0010\u000f\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u0005HÆ\u0001J\u0013\u0010\u0010\u001a\u00020\u00112\b\u0010\u0012\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0013\u001a\u00020\u0003HÖ\u0001J\t\u0010\u0014\u001a\u00020\u0015HÖ\u0001R\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0007\u0010\bR\u001a\u0010\u0004\u001a\u00020\u0005X\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\t\u0010\n\"\u0004\b\u000b\u0010\f¨\u0006\u0016"}, d2 = {"Lcom/rhythmdance/app/game/GameView$HitFx;", "", "lane", "", "t", "", "(IF)V", "getLane", "()I", "getT", "()F", "setT", "(F)V", "component1", "component2", "copy", "equals", "", "other", "hashCode", "toString", "", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    private static final /* data */ class HitFx {
        private final int lane;
        private float t;

        public HitFx(int i, float f) {
            this.lane = i;
            this.t = f;
        }

        public static /* synthetic */ HitFx copy$default(HitFx hitFx, int i, float f, int i2, Object obj) {
            if ((i2 & 1) != 0) {
                i = hitFx.lane;
            }
            if ((i2 & 2) != 0) {
                f = hitFx.t;
            }
            return hitFx.copy(i, f);
        }

        /* renamed from: component1, reason: from getter */
        public final int getLane() {
            return this.lane;
        }

        /* renamed from: component2, reason: from getter */
        public final float getT() {
            return this.t;
        }

        public final HitFx copy(int lane, float t) {
            return new HitFx(lane, t);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof HitFx)) {
                return false;
            }
            HitFx hitFx = (HitFx) other;
            return this.lane == hitFx.lane && Float.compare(this.t, hitFx.t) == 0;
        }

        public final int getLane() {
            return this.lane;
        }

        public final float getT() {
            return this.t;
        }

        public int hashCode() {
            return (Integer.hashCode(this.lane) * 31) + Float.hashCode(this.t);
        }

        public final void setT(float f) {
            this.t = f;
        }

        public String toString() {
            return "HitFx(lane=" + this.lane + ", t=" + this.t + ")";
        }
    }

    /* compiled from: GameView.kt */
    @Metadata(d1 = {"\u0000(\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u0006\n\u0002\b\u000e\n\u0002\u0010\u000b\n\u0002\b\u0004\b\u0082\b\u0018\u00002\u00020\u0001B%\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\u0006\u0010\u0006\u001a\u00020\u0005\u0012\u0006\u0010\u0007\u001a\u00020\b¢\u0006\u0002\u0010\tJ\t\u0010\u0011\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0012\u001a\u00020\u0005HÆ\u0003J\t\u0010\u0013\u001a\u00020\u0005HÆ\u0003J\t\u0010\u0014\u001a\u00020\bHÆ\u0003J1\u0010\u0015\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\b\b\u0002\u0010\u0006\u001a\u00020\u00052\b\b\u0002\u0010\u0007\u001a\u00020\bHÆ\u0001J\u0013\u0010\u0016\u001a\u00020\u00172\b\u0010\u0018\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0019\u001a\u00020\u0005HÖ\u0001J\t\u0010\u001a\u001a\u00020\u0003HÖ\u0001R\u0011\u0010\u0004\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u000bR\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\f\u0010\rR\u0011\u0010\u0007\u001a\u00020\b¢\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\u000fR\u0011\u0010\u0006\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\u0010\u0010\u000b¨\u0006\u001b"}, d2 = {"Lcom/rhythmdance/app/game/GameView$Judgement;", "", "label", "", "color", "", "pts", "life", "", "(Ljava/lang/String;IID)V", "getColor", "()I", "getLabel", "()Ljava/lang/String;", "getLife", "()D", "getPts", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "toString", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    private static final /* data */ class Judgement {
        private final int color;
        private final String label;
        private final double life;
        private final int pts;

        public Judgement(String label, int i, int i2, double d) {
            Intrinsics.checkNotNullParameter(label, "label");
            this.label = label;
            this.color = i;
            this.pts = i2;
            this.life = d;
        }

        public static /* synthetic */ Judgement copy$default(Judgement judgement, String str, int i, int i2, double d, int i3, Object obj) {
            if ((i3 & 1) != 0) {
                str = judgement.label;
            }
            if ((i3 & 2) != 0) {
                i = judgement.color;
            }
            int i4 = i;
            if ((i3 & 4) != 0) {
                i2 = judgement.pts;
            }
            int i5 = i2;
            if ((i3 & 8) != 0) {
                d = judgement.life;
            }
            return judgement.copy(str, i4, i5, d);
        }

        /* renamed from: component1, reason: from getter */
        public final String getLabel() {
            return this.label;
        }

        /* renamed from: component2, reason: from getter */
        public final int getColor() {
            return this.color;
        }

        /* renamed from: component3, reason: from getter */
        public final int getPts() {
            return this.pts;
        }

        /* renamed from: component4, reason: from getter */
        public final double getLife() {
            return this.life;
        }

        public final Judgement copy(String label, int color, int pts, double life) {
            Intrinsics.checkNotNullParameter(label, "label");
            return new Judgement(label, color, pts, life);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Judgement)) {
                return false;
            }
            Judgement judgement = (Judgement) other;
            return Intrinsics.areEqual(this.label, judgement.label) && this.color == judgement.color && this.pts == judgement.pts && Double.compare(this.life, judgement.life) == 0;
        }

        public final int getColor() {
            return this.color;
        }

        public final String getLabel() {
            return this.label;
        }

        public final double getLife() {
            return this.life;
        }

        public final int getPts() {
            return this.pts;
        }

        public int hashCode() {
            return (((((this.label.hashCode() * 31) + Integer.hashCode(this.color)) * 31) + Integer.hashCode(this.pts)) * 31) + Double.hashCode(this.life);
        }

        public String toString() {
            return "Judgement(label=" + this.label + ", color=" + this.color + ", pts=" + this.pts + ", life=" + this.life + ")";
        }
    }

    /* compiled from: GameView.kt */
    @Metadata(d1 = {"\u0000(\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0006\bf\u0018\u00002\u00020\u0001J\u0010\u0010\u0002\u001a\u00020\u00032\u0006\u0010\u0004\u001a\u00020\u0005H&J\u0010\u0010\u0006\u001a\u00020\u00032\u0006\u0010\u0007\u001a\u00020\bH&J\u0018\u0010\t\u001a\u00020\u00032\u0006\u0010\n\u001a\u00020\u000b2\u0006\u0010\f\u001a\u00020\u0005H&J\u0010\u0010\r\u001a\u00020\u00032\u0006\u0010\u000e\u001a\u00020\u0005H&J\u0010\u0010\u000f\u001a\u00020\u00032\u0006\u0010\u0010\u001a\u00020\u0005H&¨\u0006\u0011"}, d2 = {"Lcom/rhythmdance/app/game/GameView$Listener;", "", "onCombo", "", "combo", "", "onFinish", "result", "Lcom/rhythmdance/app/game/GameView$Result;", "onJudge", "label", "", "color", "onLife", "life", "onScore", "score", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public interface Listener {
        void onCombo(int combo);

        void onFinish(Result result);

        void onJudge(String label, int color);

        void onLife(int life);

        void onScore(int score);
    }

    /* compiled from: GameView.kt */
    @Metadata(d1 = {"\u0000(\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u0006\n\u0002\b\u0006\n\u0002\u0010\u000b\n\u0002\b\u001b\n\u0002\u0010\u000e\n\u0000\b\u0086\b\u0018\u00002\u00020\u0001BM\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0003\u0012\u0006\u0010\u0005\u001a\u00020\u0006\u0012\u0006\u0010\u0007\u001a\u00020\u0003\u0012\u0006\u0010\b\u001a\u00020\u0003\u0012\u0006\u0010\t\u001a\u00020\u0003\u0012\u0006\u0010\n\u001a\u00020\u0003\u0012\u0006\u0010\u000b\u001a\u00020\u0003\u0012\u0006\u0010\f\u001a\u00020\r¢\u0006\u0002\u0010\u000eJ\t\u0010\u001b\u001a\u00020\u0003HÆ\u0003J\t\u0010\u001c\u001a\u00020\u0003HÆ\u0003J\t\u0010\u001d\u001a\u00020\u0006HÆ\u0003J\t\u0010\u001e\u001a\u00020\u0003HÆ\u0003J\t\u0010\u001f\u001a\u00020\u0003HÆ\u0003J\t\u0010 \u001a\u00020\u0003HÆ\u0003J\t\u0010!\u001a\u00020\u0003HÆ\u0003J\t\u0010\"\u001a\u00020\u0003HÆ\u0003J\t\u0010#\u001a\u00020\rHÆ\u0003Jc\u0010$\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00032\b\b\u0002\u0010\u0005\u001a\u00020\u00062\b\b\u0002\u0010\u0007\u001a\u00020\u00032\b\b\u0002\u0010\b\u001a\u00020\u00032\b\b\u0002\u0010\t\u001a\u00020\u00032\b\b\u0002\u0010\n\u001a\u00020\u00032\b\b\u0002\u0010\u000b\u001a\u00020\u00032\b\b\u0002\u0010\f\u001a\u00020\rHÆ\u0001J\u0013\u0010%\u001a\u00020\r2\b\u0010&\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010'\u001a\u00020\u0003HÖ\u0001J\t\u0010(\u001a\u00020)HÖ\u0001R\u0011\u0010\u0005\u001a\u00020\u0006¢\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u0010R\u0011\u0010\f\u001a\u00020\r¢\u0006\b\n\u0000\u001a\u0004\b\u0011\u0010\u0012R\u0011\u0010\t\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0013\u0010\u0014R\u0011\u0010\b\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0015\u0010\u0014R\u0011\u0010\u0004\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0016\u0010\u0014R\u0011\u0010\u000b\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0017\u0010\u0014R\u0011\u0010\n\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0018\u0010\u0014R\u0011\u0010\u0007\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0019\u0010\u0014R\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u001a\u0010\u0014¨\u0006*"}, d2 = {"Lcom/rhythmdance/app/game/GameView$Result;", "", "score", "", "maxCombo", "accuracy", "", "perfect", "great", "good", "ok", "miss", "failed", "", "(IIDIIIIIZ)V", "getAccuracy", "()D", "getFailed", "()Z", "getGood", "()I", "getGreat", "getMaxCombo", "getMiss", "getOk", "getPerfect", "getScore", "component1", "component2", "component3", "component4", "component5", "component6", "component7", "component8", "component9", "copy", "equals", "other", "hashCode", "toString", "", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public static final /* data */ class Result {
        private final double accuracy;
        private final boolean failed;
        private final int good;
        private final int great;
        private final int maxCombo;
        private final int miss;
        private final int ok;
        private final int perfect;
        private final int score;

        public Result(int i, int i2, double d, int i3, int i4, int i5, int i6, int i7, boolean z) {
            this.score = i;
            this.maxCombo = i2;
            this.accuracy = d;
            this.perfect = i3;
            this.great = i4;
            this.good = i5;
            this.ok = i6;
            this.miss = i7;
            this.failed = z;
        }

        /* renamed from: component1, reason: from getter */
        public final int getScore() {
            return this.score;
        }

        /* renamed from: component2, reason: from getter */
        public final int getMaxCombo() {
            return this.maxCombo;
        }

        /* renamed from: component3, reason: from getter */
        public final double getAccuracy() {
            return this.accuracy;
        }

        /* renamed from: component4, reason: from getter */
        public final int getPerfect() {
            return this.perfect;
        }

        /* renamed from: component5, reason: from getter */
        public final int getGreat() {
            return this.great;
        }

        /* renamed from: component6, reason: from getter */
        public final int getGood() {
            return this.good;
        }

        /* renamed from: component7, reason: from getter */
        public final int getOk() {
            return this.ok;
        }

        /* renamed from: component8, reason: from getter */
        public final int getMiss() {
            return this.miss;
        }

        /* renamed from: component9, reason: from getter */
        public final boolean getFailed() {
            return this.failed;
        }

        public final Result copy(int score, int maxCombo, double accuracy, int perfect, int great, int good, int ok, int miss, boolean failed) {
            return new Result(score, maxCombo, accuracy, perfect, great, good, ok, miss, failed);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Result)) {
                return false;
            }
            Result result = (Result) other;
            return this.score == result.score && this.maxCombo == result.maxCombo && Double.compare(this.accuracy, result.accuracy) == 0 && this.perfect == result.perfect && this.great == result.great && this.good == result.good && this.ok == result.ok && this.miss == result.miss && this.failed == result.failed;
        }

        public final double getAccuracy() {
            return this.accuracy;
        }

        public final boolean getFailed() {
            return this.failed;
        }

        public final int getGood() {
            return this.good;
        }

        public final int getGreat() {
            return this.great;
        }

        public final int getMaxCombo() {
            return this.maxCombo;
        }

        public final int getMiss() {
            return this.miss;
        }

        public final int getOk() {
            return this.ok;
        }

        public final int getPerfect() {
            return this.perfect;
        }

        public final int getScore() {
            return this.score;
        }

        public int hashCode() {
            return (((((((((((((((Integer.hashCode(this.score) * 31) + Integer.hashCode(this.maxCombo)) * 31) + Double.hashCode(this.accuracy)) * 31) + Integer.hashCode(this.perfect)) * 31) + Integer.hashCode(this.great)) * 31) + Integer.hashCode(this.good)) * 31) + Integer.hashCode(this.ok)) * 31) + Integer.hashCode(this.miss)) * 31) + Boolean.hashCode(this.failed);
        }

        public String toString() {
            return "Result(score=" + this.score + ", maxCombo=" + this.maxCombo + ", accuracy=" + this.accuracy + ", perfect=" + this.perfect + ", great=" + this.great + ", good=" + this.good + ", ok=" + this.ok + ", miss=" + this.miss + ", failed=" + this.failed + ")";
        }
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public GameView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.laneCount = 5;
        this.notes = CollectionsKt.emptyList();
        this.songTime = -3.0d;
        this.scrollSpeed = 3.0d;
        this.perfectW = 0.045d;
        this.greatW = 0.09d;
        this.goodW = 0.15d;
        this.missW = 0.22d;
        this.life = 50.0d;
        this.laneCursors = new int[8];
        this.receptorFlash = new float[8];
        this.hitFx = new ArrayList<>();
        this.pNote = new Paint(1);
        Paint paint = new Paint(1);
        paint.setStyle(Paint.Style.STROKE);
        this.pReceptor = paint;
        this.pGlow = new Paint(1);
        Paint paint2 = new Paint(1);
        paint2.setTextAlign(Paint.Align.CENTER);
        paint2.setFakeBoldText(true);
        this.pText = paint2;
        this.pLine = new Paint(1);
        this.arrowPath = new Path();
    }

    private final void drawArrowPath(Canvas canvas, float cx, float cy, float r, int lane, Paint paint, boolean fill) {
        float f;
        paint.setStyle(fill ? Paint.Style.FILL : Paint.Style.STROKE);
        if (this.laneCount != 5) {
            switch (lane) {
                case 0:
                    f = 90.0f;
                    break;
                case 1:
                    f = 0.0f;
                    break;
                case 2:
                    f = 180.0f;
                    break;
                default:
                    f = -90.0f;
                    break;
            }
        } else {
            switch (lane) {
                case 0:
                    f = 45.0f;
                    break;
                case 1:
                    f = 135.0f;
                    break;
                case 2:
                    f = 0.0f;
                    break;
                case 3:
                    f = -135.0f;
                    break;
                default:
                    f = -45.0f;
                    break;
            }
        }
        canvas.save();
        canvas.translate(cx, cy);
        canvas.rotate(f);
        this.arrowPath.reset();
        this.arrowPath.moveTo(0.0f, -r);
        this.arrowPath.lineTo(r * 0.85f, r * 0.15f);
        this.arrowPath.lineTo(r * 0.35f, r * 0.15f);
        this.arrowPath.lineTo(r * 0.35f, r);
        this.arrowPath.lineTo((-r) * 0.35f, r);
        this.arrowPath.lineTo((-r) * 0.35f, r * 0.15f);
        this.arrowPath.lineTo((-r) * 0.85f, 0.15f * r);
        this.arrowPath.close();
        canvas.drawPath(this.arrowPath, paint);
        canvas.restore();
    }

    private final void drawHitFx(Canvas canvas, float dt) {
        int size = this.hitFx.size() - 1;
        while (size >= 0) {
            HitFx hitFx = this.hitFx.get(size);
            Intrinsics.checkNotNullExpressionValue(hitFx, "get(...)");
            HitFx hitFx2 = hitFx;
            hitFx2.setT(hitFx2.getT() + (dt / 0.18f));
            if (hitFx2.getT() >= 1.0f) {
                this.hitFx.remove(size);
                size--;
            } else {
                float laneCenterX = laneCenterX(hitFx2.getLane());
                Paint paint = this.pGlow;
                int[] iArr = this.laneColors;
                if (iArr == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("laneColors");
                    iArr = null;
                }
                paint.setColor(iArr[hitFx2.getLane()]);
                this.pGlow.setAlpha(RangesKt.coerceIn((int) ((1.0f - hitFx2.getT()) * 180), 0, 255));
                canvas.drawCircle(laneCenterX, this.receptorY, this.noteSize * ((hitFx2.getT() * 0.6f) + 0.6f), this.pGlow);
                size--;
            }
        }
    }

    private final void drawLanes(Canvas canvas) {
        this.pLine.setColor(419430399);
        int i = 0;
        int i2 = this.laneCount;
        if (0 > i2) {
            return;
        }
        while (true) {
            float f = this.boardLeft + (this.laneW * i);
            float f2 = 1;
            canvas.drawRect(f - f2, 0.0f, f + f2, getHeight(), this.pLine);
            if (i == i2) {
                return;
            } else {
                i++;
            }
        }
    }

    private final void drawNotes(Canvas canvas) {
        double d = this.songTime;
        float pxPerSec = pxPerSec();
        float f = (this.receptorY / pxPerSec) + 0.5f;
        int size = this.notes.size();
        for (int i = 0; i < size; i++) {
            Note note = this.notes.get(i);
            if (!note.getHit() && !note.getMissed()) {
                double time = note.getTime() - d;
                if (time >= -0.3d && time <= f) {
                    float f2 = this.receptorY - ((float) (pxPerSec * time));
                    float laneCenterX = laneCenterX(note.getLane());
                    Paint paint = this.pNote;
                    int[] iArr = this.laneColors;
                    if (iArr == null) {
                        Intrinsics.throwUninitializedPropertyAccessException("laneColors");
                        iArr = null;
                    }
                    paint.setColor(iArr[note.getLane()]);
                    this.pNote.setAlpha(255);
                    drawArrowPath(canvas, laneCenterX, f2, this.noteSize * 0.5f, note.getLane(), this.pNote, true);
                }
            }
        }
    }

    private final void drawReceptors(Canvas canvas, float dt) {
        int i = this.laneCount;
        for (int i2 = 0; i2 < i; i2++) {
            if (this.receptorFlash[i2] > 0.0f) {
                this.receptorFlash[i2] = RangesKt.coerceAtLeast(this.receptorFlash[i2] - (6 * dt), 0.0f);
            }
            float laneCenterX = laneCenterX(i2);
            int[] iArr = this.laneColors;
            if (iArr == null) {
                Intrinsics.throwUninitializedPropertyAccessException("laneColors");
                iArr = null;
            }
            int i3 = iArr[i2];
            float f = this.receptorFlash[i2];
            this.pGlow.setColor(i3);
            this.pGlow.setAlpha(RangesKt.coerceIn((int) (40 + (120 * f)), 0, 255));
            canvas.drawCircle(laneCenterX, this.receptorY, this.noteSize * ((0.15f * f) + 0.7f), this.pGlow);
            this.pReceptor.setColor(i3);
            this.pReceptor.setAlpha(RangesKt.coerceIn((int) (150 + (105 * f)), 0, 255));
            this.pReceptor.setStrokeWidth(this.noteSize * 0.1f);
            drawArrowPath(canvas, laneCenterX, this.receptorY, this.noteSize * 0.5f, i2, this.pReceptor, false);
        }
    }

    private final void fail() {
        if (this.failed) {
            return;
        }
        this.failed = true;
        finish();
    }

    private final void finish() {
        if (this.ended) {
            return;
        }
        this.ended = true;
        this.running = false;
        double round = Math.round(((((this.cPerfect + this.cGreat) + this.cGood) + this.cOk) / RangesKt.coerceAtLeast(this.notes.size(), 1)) * 1000) / 10.0d;
        Listener listener = this.listener;
        if (listener != null) {
            listener.onFinish(new Result(this.score, this.maxCombo, round, this.cPerfect, this.cGreat, this.cGood, this.cOk, this.cMiss, this.failed));
        }
    }

    private final Judgement judge(double dt) {
        return dt <= this.perfectW ? new Judgement("PERFECT", -10616945, 1000, 1.5d) : dt <= this.greatW ? new Judgement("GREAT", -13703425, 600, 1.0d) : dt <= this.goodW ? new Judgement("GOOD", -11714, MaterialCardViewHelper.DEFAULT_FADE_ANIM_DURATION, 0.3d) : new Judgement("OK", -24804, 100, 0.0d);
    }

    private final float laneCenterX(int lane) {
        return this.boardLeft + (this.laneW * (lane + 0.5f));
    }

    private final void pressLane(int lane) {
        this.receptorFlash[lane] = 1.0f;
        double d = this.songTime;
        List<Note> list = this.notes;
        Note note = null;
        double d2 = Double.MAX_VALUE;
        int i = this.laneCursors[lane];
        while (i < list.size()) {
            Note note2 = list.get(i);
            if (note2.getLane() != lane) {
                i++;
            } else if (note2.getHit() || note2.getMissed()) {
                i++;
            } else if (note2.getTime() - d >= (-this.missW)) {
                break;
            } else {
                i++;
            }
        }
        for (int i2 = i; i2 < list.size(); i2++) {
            Note note3 = list.get(i2);
            if (note3.getLane() == lane && !note3.getHit() && !note3.getMissed()) {
                double time = note3.getTime() - d;
                if (time > this.missW) {
                    break;
                }
                double abs = Math.abs(time);
                if (abs < d2) {
                    d2 = abs;
                    note = note3;
                }
            }
        }
        if (note == null || d2 > this.missW) {
            this.combo = 0;
            this.life = RangesKt.coerceIn(this.life - 2.0d, 0.0d, 100.0d);
            Listener listener = this.listener;
            if (listener != null) {
                listener.onCombo(0);
            }
            Listener listener2 = this.listener;
            if (listener2 != null) {
                listener2.onLife((int) this.life);
            }
            if (this.life <= 0.0d) {
                fail();
                return;
            }
            return;
        }
        Judgement judge = judge(d2);
        note.setHit(true);
        this.combo++;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        this.score += judge.getPts() + Math.min(this.combo, 100);
        this.resolved++;
        bumpJudgeCount(judge.getLabel());
        this.life = RangesKt.coerceIn(this.life + judge.getLife(), 0.0d, 100.0d);
        this.hitFx.add(new HitFx(lane, 0.0f));
        Listener listener3 = this.listener;
        if (listener3 != null) {
            listener3.onJudge(judge.getLabel(), judge.getColor());
        }
        Listener listener4 = this.listener;
        if (listener4 != null) {
            listener4.onScore(this.score);
        }
        Listener listener5 = this.listener;
        if (listener5 != null) {
            listener5.onCombo(this.combo);
        }
        Listener listener6 = this.listener;
        if (listener6 != null) {
            listener6.onLife((int) this.life);
        }
    }

    private final float pxPerSec() {
        return ((getHeight() * 0.42f) * ((float) this.scrollSpeed)) / 3.0f;
    }

    private final void recomputeLayout() {
        if (getWidth() == 0 || getHeight() == 0) {
            return;
        }
        this.laneW = getWidth() / this.laneCount;
        this.boardLeft = 0.0f;
        this.receptorY = getHeight() * 0.82f;
        this.noteSize = Math.min(this.laneW * 0.78f, getHeight() * 0.12f);
        this.pText.setTextSize(this.noteSize * 0.5f);
    }

    private final void update() {
        double d = this.songTime;
        Chart chart = this.chart;
        if (chart == null) {
            return;
        }
        int size = this.notes.size();
        for (int i = 0; i < size; i++) {
            Note note = this.notes.get(i);
            if (!note.getHit() && !note.getMissed() && note.getTime() - d < (-this.missW)) {
                note.setMissed(true);
                this.cMiss++;
                this.resolved++;
                this.combo = 0;
                this.life = RangesKt.coerceIn(this.life - 4.0d, 0.0d, 100.0d);
                Listener listener = this.listener;
                if (listener != null) {
                    listener.onCombo(0);
                }
                Listener listener2 = this.listener;
                if (listener2 != null) {
                    listener2.onJudge("MISS", -45747);
                }
                Listener listener3 = this.listener;
                if (listener3 != null) {
                    listener3.onLife((int) this.life);
                }
                if (this.life <= 0.0d) {
                    fail();
                }
            }
        }
        if (d > chart.getDuration() + 1.0d) {
            finish();
        }
    }

    /* JADX WARN: Failed to restore switch over string. Please report as a decompilation issue
    java.lang.NullPointerException: Cannot invoke "java.util.List.iterator()" because the return value of "jadx.core.dex.visitors.regions.SwitchOverStringVisitor$SwitchData.getNewCases()" is null
    	at jadx.core.dex.visitors.regions.SwitchOverStringVisitor.restoreSwitchOverString(SwitchOverStringVisitor.java:109)
    	at jadx.core.dex.visitors.regions.SwitchOverStringVisitor.visitRegion(SwitchOverStringVisitor.java:66)
    	at jadx.core.dex.visitors.regions.DepthRegionTraversal.traverseIterativeStepInternal(DepthRegionTraversal.java:77)
    	at jadx.core.dex.visitors.regions.DepthRegionTraversal.traverseIterativeStepInternal(DepthRegionTraversal.java:82)
    	at jadx.core.dex.visitors.regions.DepthRegionTraversal.traverseIterative(DepthRegionTraversal.java:31)
    	at jadx.core.dex.visitors.regions.SwitchOverStringVisitor.visit(SwitchOverStringVisitor.java:60)
     */
    public final void bumpJudgeCount(String label) {
        Intrinsics.checkNotNullParameter(label, "label");
        switch (label.hashCode()) {
            case 2524:
                if (label.equals("OK")) {
                    this.cOk++;
                    break;
                }
                break;
            case 2193597:
                if (label.equals("GOOD")) {
                    this.cGood++;
                    break;
                }
                break;
            case 39144429:
                if (label.equals("PERFECT")) {
                    this.cPerfect++;
                    break;
                }
                break;
            case 68081261:
                if (label.equals("GREAT")) {
                    this.cGreat++;
                    break;
                }
                break;
        }
    }

    public final Listener getListener() {
        return this.listener;
    }

    public final boolean getRunning() {
        return this.running;
    }

    public final double getScrollSpeed() {
        return this.scrollSpeed;
    }

    public final double getSongTime() {
        return this.songTime;
    }

    @Override // android.view.View
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        long nanoTime = System.nanoTime();
        float coerceAtMost = this.lastFrameNs == 0 ? 0.0f : RangesKt.coerceAtMost((nanoTime - this.lastFrameNs) / 1.0E9f, 0.05f);
        this.lastFrameNs = nanoTime;
        canvas.drawColor(-16447985);
        if (this.running) {
            update();
        }
        drawLanes(canvas);
        drawReceptors(canvas, coerceAtMost);
        drawNotes(canvas);
        drawHitFx(canvas, coerceAtMost);
        if (this.running || !this.ended) {
            postInvalidateOnAnimation();
        }
    }

    @Override // android.view.View
    protected void onSizeChanged(int w, int h, int ow, int oh) {
        super.onSizeChanged(w, h, ow, oh);
        recomputeLayout();
    }

    @Override // android.view.View
    public boolean onTouchEvent(MotionEvent event) {
        Intrinsics.checkNotNullParameter(event, "event");
        if (!this.running) {
            return true;
        }
        switch (event.getActionMasked()) {
            case 0:
            case 5:
                pressLane(RangesKt.coerceIn((int) ((event.getX(event.getActionIndex()) - this.boardLeft) / this.laneW), 0, this.laneCount - 1));
            default:
                return true;
        }
    }

    public final void setChart(Chart chart, double speed) {
        Intrinsics.checkNotNullParameter(chart, "chart");
        this.chart = chart;
        this.notes = chart.getNotes();
        this.laneCount = chart.getLaneCount();
        this.scrollSpeed = speed;
        this.laneColors = this.laneCount == 5 ? new int[]{-53650, -13703425, -7859, -13703425, -53650} : new int[]{-53624, -13703425, -10616945, -11714};
        recomputeLayout();
    }

    public final void setListener(Listener listener) {
        this.listener = listener;
    }

    public final void setRunning(boolean z) {
        this.running = z;
    }

    public final void setScrollSpeed(double d) {
        this.scrollSpeed = d;
    }

    public final void setSongTime(double d) {
        this.songTime = d;
    }

    public final void start() {
        this.running = true;
        this.ended = false;
        this.lastFrameNs = System.nanoTime();
        postInvalidateOnAnimation();
    }

    public final void stop() {
        this.running = false;
    }
}
