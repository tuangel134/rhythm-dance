package com.rhythmdance.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.util.TypedValue;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import kotlin.Metadata;
import kotlin.collections.ArraysKt;
import kotlin.collections.CollectionsKt;
import kotlin.collections.SetsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;
import org.schabi.newpipe.extractor.services.peertube.PeertubeParsingHelper;

/* compiled from: TouchControlsOverlay.kt */
@Metadata(d1 = {"\u0000\u008c\u0001\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010%\n\u0002\u0010\b\n\u0002\u0010#\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0007\n\u0002\b\u0003\n\u0002\u0010!\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u000b\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0010\u0018\n\u0002\b\u0005\n\u0002\u0010\u0002\n\u0002\b\u0005\n\u0002\u0010\"\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\u0007\n\u0002\u0018\u0002\n\u0002\b\b\u0018\u00002\u00020\u0001:\u0002QRB\u0015\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0002\u0010\u0006J\u0018\u00103\u001a\u00020\t2\u0006\u00104\u001a\u00020\t2\u0006\u00105\u001a\u00020\tH\u0002J\u0018\u00106\u001a\u0002072\u0006\u00108\u001a\u00020\t2\u0006\u00109\u001a\u00020-H\u0002J\u001e\u0010:\u001a\u0002072\u0006\u0010;\u001a\u00020\t2\f\u0010<\u001a\b\u0012\u0004\u0012\u00020\t0=H\u0002J\u001e\u0010>\u001a\b\u0012\u0004\u0012\u00020\t0=2\u0006\u0010?\u001a\u00020\u00142\u0006\u0010@\u001a\u00020\u0014H\u0002J\u0010\u0010A\u001a\u0002072\u0006\u0010B\u001a\u00020CH\u0014J(\u0010D\u001a\u0002072\u0006\u0010E\u001a\u00020\t2\u0006\u0010F\u001a\u00020\t2\u0006\u0010G\u001a\u00020\t2\u0006\u0010H\u001a\u00020\tH\u0014J\u0010\u0010I\u001a\u00020-2\u0006\u0010J\u001a\u00020KH\u0016J\b\u0010L\u001a\u000207H\u0002J\u0016\u0010M\u001a\u0002072\f\u0010*\u001a\b\u0012\u0004\u0012\u00020\t0=H\u0002J\u0016\u0010N\u001a\u0002072\u0006\u0010O\u001a\u00020\t2\u0006\u0010P\u001a\u00020\u001bR \u0010\u0007\u001a\u0014\u0012\u0004\u0012\u00020\t\u0012\n\u0012\b\u0012\u0004\u0012\u00020\t0\n0\bX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u000b\u001a\u00020\fX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\fX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u000e\u001a\u00020\fX\u0082\u0004¢\u0006\u0002\n\u0000R\u0014\u0010\u000f\u001a\b\u0012\u0004\u0012\u00020\u00110\u0010X\u0082\u0004¢\u0006\u0002\n\u0000R\u0014\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\u00110\u0010X\u0082\u0004¢\u0006\u0002\n\u0000R\u0014\u0010\u0013\u001a\u00020\u00148BX\u0082\u0004¢\u0006\u0006\u001a\u0004\b\u0015\u0010\u0016R\u0014\u0010\u0017\u001a\b\u0012\u0004\u0012\u00020\u00190\u0018X\u0082\u0004¢\u0006\u0002\n\u0000R\u001a\u0010\u001a\u001a\u00020\u001bX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u001c\u0010\u001d\"\u0004\b\u001e\u0010\u001fR\u001a\u0010 \u001a\u00020\tX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b!\u0010\"\"\u0004\b#\u0010$R\u000e\u0010%\u001a\u00020\fX\u0082\u0004¢\u0006\u0002\n\u0000R\u0014\u0010&\u001a\b\u0012\u0004\u0012\u00020'0\u0018X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010(\u001a\u00020\u0014X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010)\u001a\u00020\u0014X\u0082\u000e¢\u0006\u0002\n\u0000R\u0014\u0010*\u001a\b\u0012\u0004\u0012\u00020\u00110\u0018X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010+\u001a\u00020\fX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010,\u001a\u00020-X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010.\u001a\u00020'X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010/\u001a\u00020\fX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u00100\u001a\u000201X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u00102\u001a\u00020\fX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006S"}, d2 = {"Lcom/rhythmdance/app/TouchControlsOverlay;", "Landroid/view/View;", "context", "Landroid/content/Context;", "webView", "Landroid/webkit/WebView;", "(Landroid/content/Context;Landroid/webkit/WebView;)V", "activeTouches", "", "", "", "borderPaint", "Landroid/graphics/Paint;", "btnPaint", "btnTextPaint", "col4", "", "Lcom/rhythmdance/app/TouchControlsOverlay$LaneData;", "col5", "density", "", "getDensity", "()F", "dualButtons", "", "Lcom/rhythmdance/app/TouchControlsOverlay$DualButtonData;", "gameMode", "", "getGameMode", "()Ljava/lang/String;", "setGameMode", "(Ljava/lang/String;)V", "laneCount", "getLaneCount", "()I", "setLaneCount", "(I)V", "lanePaint", "laneRects", "Landroid/graphics/RectF;", "laneTopThreshold", "laneWidth", "lanes", "pausePaint", "pausePressed", "", "pauseRect", "pauseText", "pressedLanes", "", "textPaint", "blendColors", "c1", "c2", "dispatchKey", "", "lane", "down", "doPress", "pointerId", "targetLanes", "", "hitTest", "x", "y", "onDraw", "canvas", "Landroid/graphics/Canvas;", "onSizeChanged", "w", "h", "oldw", "oldh", "onTouchEvent", NotificationCompat.CATEGORY_EVENT, "Landroid/view/MotionEvent;", "recalcRects", "releaseLanes", "setLanes", PeertubeParsingHelper.COUNT_KEY, "mode", "DualButtonData", "LaneData", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class TouchControlsOverlay extends View {
    private final Map<Integer, Set<Integer>> activeTouches;
    private final Paint borderPaint;
    private final Paint btnPaint;
    private final Paint btnTextPaint;
    private final List<LaneData> col4;
    private final List<LaneData> col5;
    private final List<DualButtonData> dualButtons;
    private String gameMode;
    private int laneCount;
    private final Paint lanePaint;
    private final List<RectF> laneRects;
    private float laneTopThreshold;
    private float laneWidth;
    private final List<LaneData> lanes;
    private final Paint pausePaint;
    private boolean pausePressed;
    private RectF pauseRect;
    private final Paint pauseText;
    private final boolean[] pressedLanes;
    private final Paint textPaint;
    private final WebView webView;

    /* compiled from: TouchControlsOverlay.kt */
    @Metadata(d1 = {"\u0000(\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u000e\n\u0002\u0010\u000b\n\u0002\b\u0004\b\u0082\b\u0018\u00002\u00020\u0001B%\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0003\u0012\u0006\u0010\u0005\u001a\u00020\u0006\u0012\u0006\u0010\u0007\u001a\u00020\b¢\u0006\u0002\u0010\tJ\t\u0010\u0011\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0012\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0013\u001a\u00020\u0006HÆ\u0003J\t\u0010\u0014\u001a\u00020\bHÆ\u0003J1\u0010\u0015\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00032\b\b\u0002\u0010\u0005\u001a\u00020\u00062\b\b\u0002\u0010\u0007\u001a\u00020\bHÆ\u0001J\u0013\u0010\u0016\u001a\u00020\u00172\b\u0010\u0018\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0019\u001a\u00020\u0003HÖ\u0001J\t\u0010\u001a\u001a\u00020\bHÖ\u0001R\u0011\u0010\u0007\u001a\u00020\b¢\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u000bR\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\f\u0010\rR\u0011\u0010\u0005\u001a\u00020\u0006¢\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\u000fR\u0011\u0010\u0004\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0010\u0010\r¨\u0006\u001b"}, d2 = {"Lcom/rhythmdance/app/TouchControlsOverlay$DualButtonData;", "", "left", "", "right", "rect", "Landroid/graphics/RectF;", "label", "", "(IILandroid/graphics/RectF;Ljava/lang/String;)V", "getLabel", "()Ljava/lang/String;", "getLeft", "()I", "getRect", "()Landroid/graphics/RectF;", "getRight", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "toString", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    private static final /* data */ class DualButtonData {
        private final String label;
        private final int left;
        private final RectF rect;
        private final int right;

        public DualButtonData(int i, int i2, RectF rect, String label) {
            Intrinsics.checkNotNullParameter(rect, "rect");
            Intrinsics.checkNotNullParameter(label, "label");
            this.left = i;
            this.right = i2;
            this.rect = rect;
            this.label = label;
        }

        public static /* synthetic */ DualButtonData copy$default(DualButtonData dualButtonData, int i, int i2, RectF rectF, String str, int i3, Object obj) {
            if ((i3 & 1) != 0) {
                i = dualButtonData.left;
            }
            if ((i3 & 2) != 0) {
                i2 = dualButtonData.right;
            }
            if ((i3 & 4) != 0) {
                rectF = dualButtonData.rect;
            }
            if ((i3 & 8) != 0) {
                str = dualButtonData.label;
            }
            return dualButtonData.copy(i, i2, rectF, str);
        }

        /* renamed from: component1, reason: from getter */
        public final int getLeft() {
            return this.left;
        }

        /* renamed from: component2, reason: from getter */
        public final int getRight() {
            return this.right;
        }

        /* renamed from: component3, reason: from getter */
        public final RectF getRect() {
            return this.rect;
        }

        /* renamed from: component4, reason: from getter */
        public final String getLabel() {
            return this.label;
        }

        public final DualButtonData copy(int left, int right, RectF rect, String label) {
            Intrinsics.checkNotNullParameter(rect, "rect");
            Intrinsics.checkNotNullParameter(label, "label");
            return new DualButtonData(left, right, rect, label);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof DualButtonData)) {
                return false;
            }
            DualButtonData dualButtonData = (DualButtonData) other;
            return this.left == dualButtonData.left && this.right == dualButtonData.right && Intrinsics.areEqual(this.rect, dualButtonData.rect) && Intrinsics.areEqual(this.label, dualButtonData.label);
        }

        public final String getLabel() {
            return this.label;
        }

        public final int getLeft() {
            return this.left;
        }

        public final RectF getRect() {
            return this.rect;
        }

        public final int getRight() {
            return this.right;
        }

        public int hashCode() {
            return (((((Integer.hashCode(this.left) * 31) + Integer.hashCode(this.right)) * 31) + this.rect.hashCode()) * 31) + this.label.hashCode();
        }

        public String toString() {
            return "DualButtonData(left=" + this.left + ", right=" + this.right + ", rect=" + this.rect + ", label=" + this.label + ")";
        }
    }

    /* compiled from: TouchControlsOverlay.kt */
    @Metadata(d1 = {"\u0000\"\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u000e\n\u0002\u0010\u000b\n\u0002\b\u0004\b\u0086\b\u0018\u00002\u00020\u0001B%\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0003\u0012\u0006\u0010\u0005\u001a\u00020\u0006\u0012\u0006\u0010\u0007\u001a\u00020\u0003¢\u0006\u0002\u0010\bJ\t\u0010\u000f\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0010\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0011\u001a\u00020\u0006HÆ\u0003J\t\u0010\u0012\u001a\u00020\u0003HÆ\u0003J1\u0010\u0013\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00032\b\b\u0002\u0010\u0005\u001a\u00020\u00062\b\b\u0002\u0010\u0007\u001a\u00020\u0003HÆ\u0001J\u0013\u0010\u0014\u001a\u00020\u00152\b\u0010\u0016\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0017\u001a\u00020\u0006HÖ\u0001J\t\u0010\u0018\u001a\u00020\u0003HÖ\u0001R\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\t\u0010\nR\u0011\u0010\u0005\u001a\u00020\u0006¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u0011\u0010\u0004\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\r\u0010\nR\u0011\u0010\u0007\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\n¨\u0006\u0019"}, d2 = {"Lcom/rhythmdance/app/TouchControlsOverlay$LaneData;", "", "code", "", "key", "color", "", "label", "(Ljava/lang/String;Ljava/lang/String;ILjava/lang/String;)V", "getCode", "()Ljava/lang/String;", "getColor", "()I", "getKey", "getLabel", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "toString", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public static final /* data */ class LaneData {
        private final String code;
        private final int color;
        private final String key;
        private final String label;

        public LaneData(String code, String key, int i, String label) {
            Intrinsics.checkNotNullParameter(code, "code");
            Intrinsics.checkNotNullParameter(key, "key");
            Intrinsics.checkNotNullParameter(label, "label");
            this.code = code;
            this.key = key;
            this.color = i;
            this.label = label;
        }

        public static /* synthetic */ LaneData copy$default(LaneData laneData, String str, String str2, int i, String str3, int i2, Object obj) {
            if ((i2 & 1) != 0) {
                str = laneData.code;
            }
            if ((i2 & 2) != 0) {
                str2 = laneData.key;
            }
            if ((i2 & 4) != 0) {
                i = laneData.color;
            }
            if ((i2 & 8) != 0) {
                str3 = laneData.label;
            }
            return laneData.copy(str, str2, i, str3);
        }

        /* renamed from: component1, reason: from getter */
        public final String getCode() {
            return this.code;
        }

        /* renamed from: component2, reason: from getter */
        public final String getKey() {
            return this.key;
        }

        /* renamed from: component3, reason: from getter */
        public final int getColor() {
            return this.color;
        }

        /* renamed from: component4, reason: from getter */
        public final String getLabel() {
            return this.label;
        }

        public final LaneData copy(String code, String key, int color, String label) {
            Intrinsics.checkNotNullParameter(code, "code");
            Intrinsics.checkNotNullParameter(key, "key");
            Intrinsics.checkNotNullParameter(label, "label");
            return new LaneData(code, key, color, label);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof LaneData)) {
                return false;
            }
            LaneData laneData = (LaneData) other;
            return Intrinsics.areEqual(this.code, laneData.code) && Intrinsics.areEqual(this.key, laneData.key) && this.color == laneData.color && Intrinsics.areEqual(this.label, laneData.label);
        }

        public final String getCode() {
            return this.code;
        }

        public final int getColor() {
            return this.color;
        }

        public final String getKey() {
            return this.key;
        }

        public final String getLabel() {
            return this.label;
        }

        public int hashCode() {
            return (((((this.code.hashCode() * 31) + this.key.hashCode()) * 31) + Integer.hashCode(this.color)) * 31) + this.label.hashCode();
        }

        public String toString() {
            return "LaneData(code=" + this.code + ", key=" + this.key + ", color=" + this.color + ", label=" + this.label + ")";
        }
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public TouchControlsOverlay(Context context, WebView webView) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(webView, "webView");
        this.webView = webView;
        setClickable(true);
        setVisibility(8);
        this.gameMode = "dance";
        this.laneCount = 5;
        this.col5 = CollectionsKt.listOf((Object[]) new LaneData[]{new LaneData("KeyZ", "z", -12594614, "◀"), new LaneData("KeyX", "x", -50373, "▲"), new LaneData("KeyC", "c", -7859, "●"), new LaneData("KeyV", "v", -12870657, "▼"), new LaneData("KeyB", "b", -30178, "▶")});
        this.col4 = CollectionsKt.listOf((Object[]) new LaneData[]{new LaneData("ArrowLeft", "ArrowLeft", -12594614, "◀"), new LaneData("ArrowDown", "ArrowDown", -50373, "▼"), new LaneData("ArrowUp", "ArrowUp", -7859, "▲"), new LaneData("ArrowRight", "ArrowRight", -12870657, "▶")});
        this.activeTouches = new LinkedHashMap();
        this.pressedLanes = new boolean[5];
        this.pauseRect = new RectF();
        Paint paint = new Paint();
        paint.setAntiAlias(true);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(-1996488705);
        this.pausePaint = paint;
        Paint paint2 = new Paint();
        paint2.setAntiAlias(true);
        paint2.setTextSize(40.0f);
        paint2.setColor(-1);
        paint2.setTextAlign(Paint.Align.CENTER);
        paint2.setTypeface(Typeface.DEFAULT_BOLD);
        this.pauseText = paint2;
        Paint paint3 = new Paint();
        paint3.setAntiAlias(true);
        paint3.setStyle(Paint.Style.FILL);
        this.lanePaint = paint3;
        Paint paint4 = new Paint();
        paint4.setAntiAlias(true);
        paint4.setTextSize(28.0f);
        paint4.setColor(-1);
        paint4.setTextAlign(Paint.Align.CENTER);
        this.textPaint = paint4;
        Paint paint5 = new Paint();
        paint5.setStyle(Paint.Style.STROKE);
        paint5.setStrokeWidth(2.0f);
        paint5.setColor(1157627903);
        this.borderPaint = paint5;
        Paint paint6 = new Paint();
        paint6.setAntiAlias(true);
        paint6.setStyle(Paint.Style.FILL);
        this.btnPaint = paint6;
        Paint paint7 = new Paint();
        paint7.setAntiAlias(true);
        paint7.setTextSize(24.0f);
        paint7.setColor(-1);
        paint7.setTextAlign(Paint.Align.CENTER);
        this.btnTextPaint = paint7;
        this.lanes = new ArrayList();
        this.laneRects = new ArrayList();
        this.dualButtons = new ArrayList();
    }

    private final int blendColors(int c1, int c2) {
        return (-16777216) | (((((c1 >> 16) & 255) + ((c2 >> 16) & 255)) / 2) << 16) | (((((c1 >> 8) & 255) + ((c2 >> 8) & 255)) / 2) << 8) | (((c1 & 255) + (c2 & 255)) / 2);
    }

    private final void dispatchKey(int lane, boolean down) {
        LaneData laneData = (LaneData) CollectionsKt.getOrNull(this.lanes, lane);
        if (laneData == null) {
            return;
        }
        this.webView.evaluateJavascript(StringsKt.trimIndent("\n(function(){\n    var e = new KeyboardEvent('" + (down ? "keydown" : "keyup") + "', {\n        key: '" + laneData.getKey() + "',\n        code: '" + laneData.getCode() + "',\n        bubbles: true,\n        cancelable: true\n    });\n    window.dispatchEvent(e);\n})();\n"), null);
    }

    private final void doPress(int pointerId, Set<Integer> targetLanes) {
        this.activeTouches.put(Integer.valueOf(pointerId), CollectionsKt.toMutableSet(targetLanes));
        Iterator<Integer> it = targetLanes.iterator();
        while (it.hasNext()) {
            int intValue = it.next().intValue();
            boolean z = false;
            if (intValue >= 0 && intValue < this.lanes.size()) {
                z = true;
            }
            if (z && intValue < this.pressedLanes.length && !this.pressedLanes[intValue]) {
                this.pressedLanes[intValue] = true;
                dispatchKey(intValue, true);
            }
        }
        invalidate();
    }

    private final float getDensity() {
        return getResources().getDisplayMetrics().density;
    }

    private final Set<Integer> hitTest(float x, float y) {
        DualButtonData next;
        Iterator<DualButtonData> it = this.dualButtons.iterator();
        do {
            if (!it.hasNext()) {
                int i = (int) (x / this.laneWidth);
                return i >= 0 && i < this.lanes.size() ? SetsKt.setOf(Integer.valueOf(i)) : SetsKt.emptySet();
            }
            next = it.next();
        } while (!next.getRect().contains(x, y));
        return SetsKt.setOf((Object[]) new Integer[]{Integer.valueOf(next.getLeft()), Integer.valueOf(next.getRight())});
    }

    private final void recalcRects() {
        int size = this.lanes.size();
        if (size == 0) {
            return;
        }
        float width = getWidth();
        float height = getHeight();
        boolean z = getResources().getConfiguration().orientation == 2;
        float f = z ? 100.0f : 180.0f;
        float coerceAtMost = RangesKt.coerceAtMost(TypedValue.applyDimension(1, f, getResources().getDisplayMetrics()), height * 0.5f);
        float f2 = height - coerceAtMost;
        this.laneTopThreshold = f2;
        this.laneWidth = width / size;
        int size2 = this.lanes.size();
        for (int i = 0; i < size2; i++) {
            this.laneRects.get(i).set(i * this.laneWidth, f2, (i + 1) * this.laneWidth, height);
        }
        this.dualButtons.clear();
        if (size > 1) {
            float f3 = this.laneWidth * 0.5f;
            float f4 = 0.25f * coerceAtMost;
            float density = getDensity() * 4.0f;
            int i2 = 0;
            int i3 = size - 1;
            while (i2 < i3) {
                float f5 = (i2 + 1) * this.laneWidth;
                float f6 = 2;
                float f7 = (f2 - (f4 / f6)) - density;
                this.dualButtons.add(new DualButtonData(i2, i2 + 1, new RectF(f5 - (f3 / f6), f7 - (f4 / f6), f5 + (f3 / f6), f7 + (f4 / f6)), this.lanes.get(i2).getLabel() + this.lanes.get(i2 + 1).getLabel()));
                i2++;
                size = size;
                width = width;
                height = height;
                z = z;
                f = f;
                f3 = f3;
            }
        }
    }

    private final void releaseLanes(Set<Integer> lanes) {
        Iterator<Integer> it = lanes.iterator();
        while (it.hasNext()) {
            int intValue = it.next().intValue();
            if ((intValue >= 0 && intValue < this.lanes.size()) && intValue < this.pressedLanes.length && this.pressedLanes[intValue]) {
                this.pressedLanes[intValue] = false;
                dispatchKey(intValue, false);
            }
        }
        invalidate();
    }

    public final String getGameMode() {
        return this.gameMode;
    }

    public final int getLaneCount() {
        return this.laneCount;
    }

    @Override // android.view.View
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        super.onDraw(canvas);
        float density = getDensity() * 44.0f;
        this.pauseRect.set(getDensity() * 16.0f, getDensity() * 80.0f, (getDensity() * 16.0f) + density, (getDensity() * 80.0f) + density);
        this.pausePaint.setAlpha(this.pausePressed ? 180 : 100);
        canvas.drawRoundRect(this.pauseRect, 8.0f, 8.0f, this.pausePaint);
        canvas.drawRoundRect(this.pauseRect, 8.0f, 8.0f, this.borderPaint);
        canvas.drawText("⏸", this.pauseRect.centerX(), this.pauseRect.centerY() + 14, this.pauseText);
        for (DualButtonData dualButtonData : this.dualButtons) {
            RectF rect = dualButtonData.getRect();
            this.btnPaint.setColor(blendColors(this.lanes.get(dualButtonData.getLeft()).getColor(), this.lanes.get(dualButtonData.getRight()).getColor()));
            this.btnPaint.setAlpha(150);
            canvas.drawRoundRect(rect, 8.0f, 8.0f, this.btnPaint);
            canvas.drawRoundRect(rect, 8.0f, 8.0f, this.borderPaint);
            this.btnTextPaint.setAlpha(240);
            canvas.drawText(dualButtonData.getLabel(), rect.centerX(), rect.centerY() + 9, this.btnTextPaint);
        }
    }

    @Override // android.view.View
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        recalcRects();
    }

    /* JADX WARN: Can't fix incorrect switch cases order, some code will duplicate */
    @Override // android.view.View
    public boolean onTouchEvent(MotionEvent event) {
        Intrinsics.checkNotNullParameter(event, "event");
        int actionMasked = event.getActionMasked();
        int actionIndex = event.getActionIndex();
        int pointerId = event.getPointerId(actionIndex);
        float x = event.getX(actionIndex);
        float y = event.getY(actionIndex);
        boolean z = true;
        if (!this.pauseRect.contains(x, y)) {
            if (y < this.laneTopThreshold) {
                for (DualButtonData dualButtonData : this.dualButtons) {
                    if (dualButtonData.getRect().contains(x, y)) {
                        switch (actionMasked) {
                            case 0:
                            case 5:
                                doPress(pointerId, SetsKt.setOf((Object[]) new Integer[]{Integer.valueOf(dualButtonData.getLeft()), Integer.valueOf(dualButtonData.getRight())}));
                                break;
                            case 1:
                            case 6:
                                releaseLanes(SetsKt.setOf((Object[]) new Integer[]{Integer.valueOf(dualButtonData.getLeft()), Integer.valueOf(dualButtonData.getRight())}));
                                break;
                        }
                    }
                }
                return false;
            }
            switch (actionMasked) {
                case 0:
                case 5:
                    Set<Integer> hitTest = hitTest(x, y);
                    if (!hitTest.isEmpty()) {
                        doPress(pointerId, hitTest);
                        break;
                    }
                    break;
                case 1:
                case 6:
                    Set<Integer> remove = this.activeTouches.remove(Integer.valueOf(pointerId));
                    if (remove != null) {
                        releaseLanes(remove);
                        break;
                    }
                    break;
                case 2:
                    int i = 0;
                    int pointerCount = event.getPointerCount();
                    while (i < pointerCount) {
                        int pointerId2 = event.getPointerId(i);
                        float x2 = event.getX(i);
                        float y2 = event.getY(i);
                        if (y2 < this.laneTopThreshold) {
                            Set<Integer> remove2 = this.activeTouches.remove(Integer.valueOf(pointerId2));
                            if (remove2 != null) {
                                releaseLanes(remove2);
                            }
                        } else {
                            Set<Integer> hitTest2 = hitTest(x2, y2);
                            Set<Integer> set = this.activeTouches.get(Integer.valueOf(pointerId2));
                            if (!Intrinsics.areEqual(hitTest2, set)) {
                                if (set != null) {
                                    releaseLanes(set);
                                }
                                if (hitTest2.isEmpty() ^ z) {
                                    doPress(pointerId2, hitTest2);
                                } else {
                                    this.activeTouches.remove(Integer.valueOf(pointerId2));
                                }
                            }
                        }
                        i++;
                        z = true;
                    }
                    break;
                case 3:
                    int size = this.lanes.size();
                    for (int i2 = 0; i2 < size; i2++) {
                        if (i2 < this.pressedLanes.length && this.pressedLanes[i2]) {
                            dispatchKey(i2, false);
                        }
                    }
                    ArraysKt.fill$default(this.pressedLanes, false, 0, 0, 6, (Object) null);
                    this.activeTouches.clear();
                    invalidate();
                    break;
            }
            return true;
        }
        switch (actionMasked) {
            case 0:
            case 5:
                this.pausePressed = true;
                invalidate();
                this.webView.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));", null);
                this.webView.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));", null);
                break;
            case 1:
            case 6:
                this.pausePressed = false;
                invalidate();
                break;
        }
    }

    public final void setGameMode(String str) {
        Intrinsics.checkNotNullParameter(str, "<set-?>");
        this.gameMode = str;
    }

    public final void setLaneCount(int i) {
        this.laneCount = i;
    }

    public final void setLanes(int count, String mode) {
        Intrinsics.checkNotNullParameter(mode, "mode");
        this.laneCount = count;
        this.gameMode = mode;
        this.lanes.clear();
        this.lanes.addAll(count == 4 ? this.col4 : this.col5);
        this.laneRects.clear();
        int size = this.lanes.size();
        for (int i = 0; i < size; i++) {
            this.laneRects.add(new RectF());
        }
        ArraysKt.fill$default(this.pressedLanes, false, 0, 0, 6, (Object) null);
        this.activeTouches.clear();
        this.dualButtons.clear();
        if (getWidth() > 0 && getHeight() > 0) {
            recalcRects();
        }
        invalidate();
    }
}
