package com.rhythmdance.app;

import android.content.res.ColorStateList;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.rhythmdance.app.game.Chart;
import com.rhythmdance.app.game.GameView;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.concurrent.ThreadsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

/* compiled from: GameActivity.kt */
@Metadata(d1 = {"\u0000\u0092\u0001\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0006\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\t\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0002\b\u0003\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\b\n\u0002\u0018\u0002\n\u0002\b\u0006\u0018\u00002\u00020\u00012\u00020\u0002B\u0005¢\u0006\u0002\u0010\u0003J\b\u0010\"\u001a\u00020#H\u0002J\b\u0010$\u001a\u00020#H\u0002J\u0010\u0010%\u001a\u00020#2\u0006\u0010&\u001a\u00020'H\u0016J\u0012\u0010(\u001a\u00020#2\b\u0010)\u001a\u0004\u0018\u00010*H\u0014J\b\u0010+\u001a\u00020#H\u0014J\u0010\u0010,\u001a\u00020#2\u0006\u0010-\u001a\u00020.H\u0016J\u0018\u0010/\u001a\u00020#2\u0006\u00100\u001a\u0002012\u0006\u00102\u001a\u00020'H\u0016J\u0010\u00103\u001a\u00020#2\u0006\u00104\u001a\u00020'H\u0016J\b\u00105\u001a\u00020#H\u0014J\u0010\u00106\u001a\u00020#2\u0006\u00107\u001a\u00020'H\u0016J \u00108\u001a\u00020#2\u0006\u00109\u001a\u00020:2\u0006\u0010;\u001a\u00020'2\u0006\u0010<\u001a\u00020'H\u0002J\u0010\u0010=\u001a\u00020#2\u0006\u0010>\u001a\u00020.H\u0002J\u0010\u0010?\u001a\u00020#2\u0006\u00109\u001a\u00020:H\u0002R\u000e\u0010\u0004\u001a\u00020\u0005X\u0082\u000e¢\u0006\u0002\n\u0000R\u0010\u0010\u0006\u001a\u0004\u0018\u00010\u0007X\u0082\u000e¢\u0006\u0002\n\u0000R\u0010\u0010\b\u001a\u0004\u0018\u00010\tX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u000bX\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\f\u001a\u00020\rX\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u000e\u001a\u00020\u0005X\u0082\u000e¢\u0006\u0002\n\u0000R\u0010\u0010\u000f\u001a\u0004\u0018\u00010\u0010X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0011\u001a\u00020\u000bX\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u0012\u001a\u00020\u0013X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0014\u001a\u00020\u0015X\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u0016\u001a\u00020\rX\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u0017\u001a\u00020\u0018X\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u0019\u001a\u00020\u000bX\u0082.¢\u0006\u0002\n\u0000R\u0010\u0010\u001a\u001a\u0004\u0018\u00010\u001bX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u001c\u001a\u00020\u000bX\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u001d\u001a\u00020\u0013X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u001e\u001a\u00020\u001fX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010 \u001a\u00020!X\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006@"}, d2 = {"Lcom/rhythmdance/app/GameActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "Lcom/rhythmdance/app/game/GameView$Listener;", "()V", "audioStarted", "", "chart", "Lcom/rhythmdance/app/game/Chart;", "clockRunner", "Ljava/lang/Runnable;", "comboText", "Landroid/widget/TextView;", "container", "Landroid/widget/FrameLayout;", "finished", "gameView", "Lcom/rhythmdance/app/game/GameView;", "judgeText", "leadIn", "", "lifeBar", "Landroid/view/View;", "lifeBarBg", "loading", "Landroid/widget/LinearLayout;", "loadingText", "player", "Landroid/media/MediaPlayer;", "scoreText", "speed", "startWallMs", "", "ui", "Landroid/os/Handler;", "buildHud", "", "enterImmersive", "onCombo", "combo", "", "onCreate", "savedInstanceState", "Landroid/os/Bundle;", "onDestroy", "onFinish", "result", "Lcom/rhythmdance/app/game/GameView$Result;", "onJudge", "label", "", "color", "onLife", "life", "onPause", "onScore", "score", "prepare", "uri", "Landroid/net/Uri;", "diffIdx", "lanes", "showResults", "r", "startGame", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class GameActivity extends AppCompatActivity implements GameView.Listener {
    private boolean audioStarted;
    private Chart chart;
    private Runnable clockRunner;
    private TextView comboText;
    private FrameLayout container;
    private boolean finished;
    private GameView gameView;
    private TextView judgeText;
    private View lifeBar;
    private FrameLayout lifeBarBg;
    private LinearLayout loading;
    private TextView loadingText;
    private MediaPlayer player;
    private TextView scoreText;
    private long startWallMs;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private double speed = 3.0d;
    private double leadIn = 3.0d;

    private final void buildHud() {
        float f = getResources().getDisplayMetrics().density;
        TextView textView = new TextView(this);
        textView.setText("0");
        textView.setTextColor(-1);
        textView.setTextSize(26.0f);
        textView.setTypeface(textView.getTypeface(), 1);
        this.scoreText = textView;
        FrameLayout frameLayout = this.container;
        View view = null;
        if (frameLayout == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
            frameLayout = null;
        }
        TextView textView2 = this.scoreText;
        if (textView2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("scoreText");
            textView2 = null;
        }
        FrameLayout.LayoutParams layoutParams = new FrameLayout.LayoutParams(-2, -2, 8388659);
        layoutParams.topMargin = buildHud$dp(f, 10);
        layoutParams.leftMargin = buildHud$dp(f, 16);
        Unit unit = Unit.INSTANCE;
        frameLayout.addView(textView2, layoutParams);
        TextView textView3 = new TextView(this);
        textView3.setText("");
        textView3.setTextColor(-7859);
        textView3.setTextSize(22.0f);
        textView3.setGravity(17);
        this.comboText = textView3;
        FrameLayout frameLayout2 = this.container;
        if (frameLayout2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
            frameLayout2 = null;
        }
        TextView textView4 = this.comboText;
        if (textView4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("comboText");
            textView4 = null;
        }
        FrameLayout.LayoutParams layoutParams2 = new FrameLayout.LayoutParams(-2, -2, 49);
        layoutParams2.topMargin = buildHud$dp(f, 48);
        Unit unit2 = Unit.INSTANCE;
        frameLayout2.addView(textView4, layoutParams2);
        TextView textView5 = new TextView(this);
        textView5.setText("");
        textView5.setTextSize(34.0f);
        textView5.setGravity(17);
        textView5.setTypeface(textView5.getTypeface(), 1);
        this.judgeText = textView5;
        FrameLayout frameLayout3 = this.container;
        if (frameLayout3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
            frameLayout3 = null;
        }
        TextView textView6 = this.judgeText;
        if (textView6 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("judgeText");
            textView6 = null;
        }
        FrameLayout.LayoutParams layoutParams3 = new FrameLayout.LayoutParams(-2, -2, 17);
        layoutParams3.topMargin = buildHud$dp(f, -40);
        Unit unit3 = Unit.INSTANCE;
        frameLayout3.addView(textView6, layoutParams3);
        FrameLayout frameLayout4 = new FrameLayout(this);
        frameLayout4.setBackgroundColor(872415231);
        this.lifeBarBg = frameLayout4;
        FrameLayout frameLayout5 = this.container;
        if (frameLayout5 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
            frameLayout5 = null;
        }
        FrameLayout frameLayout6 = this.lifeBarBg;
        if (frameLayout6 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("lifeBarBg");
            frameLayout6 = null;
        }
        FrameLayout.LayoutParams layoutParams4 = new FrameLayout.LayoutParams(buildHud$dp(f, 160), buildHud$dp(f, 14), 8388661);
        layoutParams4.topMargin = buildHud$dp(f, 16);
        layoutParams4.rightMargin = buildHud$dp(f, 16);
        Unit unit4 = Unit.INSTANCE;
        frameLayout5.addView(frameLayout6, layoutParams4);
        View view2 = new View(this);
        view2.setBackgroundColor(-10616945);
        this.lifeBar = view2;
        FrameLayout frameLayout7 = this.lifeBarBg;
        if (frameLayout7 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("lifeBarBg");
            frameLayout7 = null;
        }
        View view3 = this.lifeBar;
        if (view3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("lifeBar");
        } else {
            view = view3;
        }
        frameLayout7.addView(view, new FrameLayout.LayoutParams(buildHud$dp(f, 80), buildHud$dp(f, 14)));
    }

    private static final int buildHud$dp(float f, int i) {
        return (int) (i * f);
    }

    private final void enterImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(5894);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onFinish$lambda$16(GameActivity this$0, GameView.Result result) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        Intrinsics.checkNotNullParameter(result, "$result");
        this$0.showResults(result);
    }

    private final void prepare(Uri uri, int diffIdx, int lanes) {
        ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : false, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : null, (r12 & 16) != 0 ? -1 : 0, new GameActivity$prepare$1(this, uri, diffIdx, lanes));
    }

    private final void showResults(GameView.Result r) {
        try {
            MediaPlayer mediaPlayer = this.player;
            if (mediaPlayer != null) {
                mediaPlayer.stop();
            }
        } catch (Exception e) {
        }
        FrameLayout frameLayout = this.container;
        FrameLayout frameLayout2 = null;
        if (frameLayout == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
            frameLayout = null;
        }
        frameLayout.removeAllViews();
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setGravity(17);
        linearLayout.setBackgroundColor(-16447985);
        linearLayout.setPadding(40, 40, 40, 40);
        TextView textView = new TextView(this);
        textView.setText(r.getFailed() ? "FALLASTE" : "¡Completado!");
        textView.setTextColor(r.getFailed() ? -45747 : -10616945);
        textView.setTextSize(30.0f);
        textView.setGravity(17);
        linearLayout.addView(textView);
        String str = "Puntos: " + r.getScore() + "\nCombo máx: " + r.getMaxCombo() + "\nPrecisión: " + r.getAccuracy() + "%\nPERFECT " + r.getPerfect() + " · GREAT " + r.getGreat() + " · GOOD " + r.getGood() + " · OK " + r.getOk() + " · MISS " + r.getMiss();
        TextView textView2 = new TextView(this);
        textView2.setText(str);
        textView2.setTextColor(-4604710);
        textView2.setTextSize(16.0f);
        textView2.setGravity(17);
        textView2.setPadding(0, 30, 0, 30);
        linearLayout.addView(textView2);
        Button button = new Button(this);
        button.setText("Volver");
        button.setAllCaps(false);
        button.setTextColor(-1);
        button.setBackgroundTintList(ColorStateList.valueOf(-53890));
        button.setOnClickListener(new View.OnClickListener() { // from class: com.rhythmdance.app.GameActivity$$ExternalSyntheticLambda0
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                GameActivity.showResults$lambda$21$lambda$20(GameActivity.this, view);
            }
        });
        linearLayout.addView(button);
        FrameLayout frameLayout3 = this.container;
        if (frameLayout3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
        } else {
            frameLayout2 = frameLayout3;
        }
        frameLayout2.addView(linearLayout);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void showResults$lambda$21$lambda$20(GameActivity this$0, View view) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        this$0.finish();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void startGame(Uri uri) {
        Chart chart = this.chart;
        if (chart == null) {
            return;
        }
        MediaPlayer mediaPlayer = new MediaPlayer();
        mediaPlayer.setDataSource(this, uri);
        mediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() { // from class: com.rhythmdance.app.GameActivity$$ExternalSyntheticLambda1
            @Override // android.media.MediaPlayer.OnCompletionListener
            public final void onCompletion(MediaPlayer mediaPlayer2) {
                GameActivity.startGame$lambda$4$lambda$3(mediaPlayer2);
            }
        });
        mediaPlayer.prepare();
        this.player = mediaPlayer;
        FrameLayout frameLayout = this.container;
        FrameLayout frameLayout2 = null;
        if (frameLayout == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
            frameLayout = null;
        }
        frameLayout.removeAllViews();
        GameView gameView = new GameView(this);
        gameView.setListener(this);
        gameView.setChart(chart, this.speed);
        this.gameView = gameView;
        FrameLayout frameLayout3 = this.container;
        if (frameLayout3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
        } else {
            frameLayout2 = frameLayout3;
        }
        frameLayout2.addView(gameView, new FrameLayout.LayoutParams(-1, -1));
        buildHud();
        gameView.setSongTime(-this.leadIn);
        gameView.start();
        this.startWallMs = System.currentTimeMillis();
        this.audioStarted = false;
        this.clockRunner = new Runnable() { // from class: com.rhythmdance.app.GameActivity$startGame$2
            @Override // java.lang.Runnable
            public void run() {
                GameView gameView2;
                MediaPlayer mediaPlayer2;
                boolean z;
                boolean z2;
                Handler handler;
                long j;
                double d;
                gameView2 = GameActivity.this.gameView;
                if (gameView2 == null) {
                    return;
                }
                mediaPlayer2 = GameActivity.this.player;
                z = GameActivity.this.audioStarted;
                if (!z) {
                    long currentTimeMillis = System.currentTimeMillis();
                    j = GameActivity.this.startWallMs;
                    d = GameActivity.this.leadIn;
                    double d2 = ((currentTimeMillis - j) / 1000.0d) - d;
                    gameView2.setSongTime(d2);
                    if (d2 >= 0.0d && mediaPlayer2 != null) {
                        mediaPlayer2.start();
                        GameActivity.this.audioStarted = true;
                    }
                } else if (mediaPlayer2 != null) {
                    gameView2.setSongTime(mediaPlayer2.getCurrentPosition() / 1000.0d);
                }
                z2 = GameActivity.this.finished;
                if (z2) {
                    return;
                }
                handler = GameActivity.this.ui;
                handler.postDelayed(this, 16L);
            }
        };
        Handler handler = this.ui;
        Runnable runnable = this.clockRunner;
        Intrinsics.checkNotNull(runnable);
        handler.post(runnable);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void startGame$lambda$4$lambda$3(MediaPlayer mediaPlayer) {
    }

    @Override // com.rhythmdance.app.game.GameView.Listener
    public void onCombo(int combo) {
        TextView textView = this.comboText;
        if (textView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("comboText");
            textView = null;
        }
        textView.setText(combo >= 3 ? "combo " + combo : "");
    }

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(128);
        enterImmersive();
        FrameLayout frameLayout = new FrameLayout(this);
        frameLayout.setBackgroundColor(-16447985);
        this.container = frameLayout;
        FrameLayout frameLayout2 = this.container;
        LinearLayout linearLayout = null;
        if (frameLayout2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
            frameLayout2 = null;
        }
        setContentView(frameLayout2);
        LinearLayout linearLayout2 = new LinearLayout(this);
        linearLayout2.setOrientation(1);
        linearLayout2.setGravity(17);
        linearLayout2.setBackgroundColor(-16447985);
        this.loading = linearLayout2;
        LinearLayout linearLayout3 = this.loading;
        if (linearLayout3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("loading");
            linearLayout3 = null;
        }
        linearLayout3.addView(new ProgressBar(this));
        TextView textView = new TextView(this);
        textView.setText("Analizando la música…");
        textView.setTextColor(-1);
        textView.setTextSize(16.0f);
        textView.setGravity(17);
        textView.setPadding(0, 40, 0, 0);
        this.loadingText = textView;
        LinearLayout linearLayout4 = this.loading;
        if (linearLayout4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("loading");
            linearLayout4 = null;
        }
        TextView textView2 = this.loadingText;
        if (textView2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("loadingText");
            textView2 = null;
        }
        linearLayout4.addView(textView2);
        FrameLayout frameLayout3 = this.container;
        if (frameLayout3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("container");
            frameLayout3 = null;
        }
        LinearLayout linearLayout5 = this.loading;
        if (linearLayout5 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("loading");
        } else {
            linearLayout = linearLayout5;
        }
        frameLayout3.addView(linearLayout);
        Uri parse = Uri.parse(getIntent().getStringExtra("uri"));
        int intExtra = getIntent().getIntExtra("difficulty", 1);
        int intExtra2 = getIntent().getIntExtra("lanes", 5);
        this.speed = getIntent().getDoubleExtra("speed", 3.0d);
        Intrinsics.checkNotNull(parse);
        prepare(parse, intExtra, intExtra2);
    }

    @Override // androidx.appcompat.app.AppCompatActivity, androidx.fragment.app.FragmentActivity, android.app.Activity
    protected void onDestroy() {
        super.onDestroy();
        this.finished = true;
        Runnable runnable = this.clockRunner;
        if (runnable != null) {
            this.ui.removeCallbacks(runnable);
        }
        try {
            MediaPlayer mediaPlayer = this.player;
            if (mediaPlayer != null) {
                mediaPlayer.release();
            }
        } catch (Exception e) {
        }
        this.player = null;
    }

    @Override // com.rhythmdance.app.game.GameView.Listener
    public void onFinish(final GameView.Result result) {
        Intrinsics.checkNotNullParameter(result, "result");
        this.finished = true;
        this.ui.post(new Runnable() { // from class: com.rhythmdance.app.GameActivity$$ExternalSyntheticLambda2
            @Override // java.lang.Runnable
            public final void run() {
                GameActivity.onFinish$lambda$16(GameActivity.this, result);
            }
        });
    }

    @Override // com.rhythmdance.app.game.GameView.Listener
    public void onJudge(String label, int color) {
        Intrinsics.checkNotNullParameter(label, "label");
        TextView textView = this.judgeText;
        TextView textView2 = null;
        if (textView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("judgeText");
            textView = null;
        }
        textView.setText(label);
        TextView textView3 = this.judgeText;
        if (textView3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("judgeText");
            textView3 = null;
        }
        textView3.setTextColor(color);
        TextView textView4 = this.judgeText;
        if (textView4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("judgeText");
            textView4 = null;
        }
        textView4.setAlpha(1.0f);
        TextView textView5 = this.judgeText;
        if (textView5 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("judgeText");
        } else {
            textView2 = textView5;
        }
        textView2.animate().alpha(0.0f).setDuration(400L).start();
    }

    @Override // com.rhythmdance.app.game.GameView.Listener
    public void onLife(int life) {
        int i = (int) (160 * getResources().getDisplayMetrics().density);
        int coerceIn = RangesKt.coerceIn((i * life) / 100, 0, i);
        View view = this.lifeBar;
        View view2 = null;
        if (view == null) {
            Intrinsics.throwUninitializedPropertyAccessException("lifeBar");
            view = null;
        }
        View view3 = this.lifeBar;
        if (view3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("lifeBar");
            view3 = null;
        }
        ViewGroup.LayoutParams layoutParams = view3.getLayoutParams();
        Intrinsics.checkNotNull(layoutParams, "null cannot be cast to non-null type android.widget.FrameLayout.LayoutParams");
        FrameLayout.LayoutParams layoutParams2 = (FrameLayout.LayoutParams) layoutParams;
        layoutParams2.width = coerceIn;
        view.setLayoutParams(layoutParams2);
        View view4 = this.lifeBar;
        if (view4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("lifeBar");
            view4 = null;
        }
        view4.requestLayout();
        View view5 = this.lifeBar;
        if (view5 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("lifeBar");
        } else {
            view2 = view5;
        }
        view2.setBackgroundColor(life <= 25 ? -45747 : -10616945);
    }

    @Override // androidx.fragment.app.FragmentActivity, android.app.Activity
    protected void onPause() {
        super.onPause();
        try {
            MediaPlayer mediaPlayer = this.player;
            if (mediaPlayer != null) {
                mediaPlayer.pause();
            }
        } catch (Exception e) {
        }
        GameView gameView = this.gameView;
        if (gameView != null) {
            gameView.stop();
        }
    }

    @Override // com.rhythmdance.app.game.GameView.Listener
    public void onScore(int score) {
        TextView textView = this.scoreText;
        if (textView == null) {
            Intrinsics.throwUninitializedPropertyAccessException("scoreText");
            textView = null;
        }
        textView.setText(String.valueOf(score));
    }
}
