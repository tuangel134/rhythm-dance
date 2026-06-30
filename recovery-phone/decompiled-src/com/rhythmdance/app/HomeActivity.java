package com.rhythmdance.app;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

/* compiled from: HomeActivity.kt */
@Metadata(d1 = {"\u0000(\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\u0018\u00002\u00020\u0001B\u0005¢\u0006\u0002\u0010\u0002J\u0010\u0010\u0003\u001a\u00020\u00042\u0006\u0010\u0005\u001a\u00020\u0004H\u0002J\b\u0010\u0006\u001a\u00020\u0007H\u0002J\u0012\u0010\b\u001a\u00020\t2\b\u0010\n\u001a\u0004\u0018\u00010\u000bH\u0014J\b\u0010\f\u001a\u00020\tH\u0014¨\u0006\r"}, d2 = {"Lcom/rhythmdance/app/HomeActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "()V", "dp", "", "v", "lp", "Landroid/widget/LinearLayout$LayoutParams;", "onCreate", "", "savedInstanceState", "Landroid/os/Bundle;", "onResume", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class HomeActivity extends AppCompatActivity {
    private final int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }

    private final LinearLayout.LayoutParams lp() {
        LinearLayout.LayoutParams layoutParams = new LinearLayout.LayoutParams(-1, -2);
        layoutParams.topMargin = dp(10);
        layoutParams.bottomMargin = dp(2);
        return layoutParams;
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onCreate$lambda$5$lambda$4(HomeActivity this$0, View view) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        this$0.startActivity(new Intent(this$0, (Class<?>) GameWebViewActivity.class));
    }

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(128);
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setGravity(17);
        linearLayout.setBackgroundColor(-16447985);
        linearLayout.setPadding(dp(28), dp(28), dp(28), dp(28));
        TextView textView = new TextView(this);
        textView.setText("◤ ◣ ◆ ◢ ◥");
        textView.setTextColor(-14030849);
        textView.setTextSize(30.0f);
        textView.setGravity(17);
        linearLayout.addView(textView);
        TextView textView2 = new TextView(this);
        textView2.setText("RHYTHM DANCE");
        textView2.setTextColor(-1);
        textView2.setTextSize(34.0f);
        textView2.setGravity(17);
        textView2.setPadding(0, dp(6), 0, dp(4));
        linearLayout.addView(textView2);
        TextView textView3 = new TextView(this);
        textView3.setText("Juego de ritmo con TU música");
        textView3.setTextColor(-7630928);
        textView3.setTextSize(14.0f);
        textView3.setGravity(17);
        textView3.setPadding(0, 0, 0, dp(28));
        linearLayout.addView(textView3);
        Button button = new Button(this);
        button.setText("▶  Jugar");
        button.setTextColor(-1);
        button.setAllCaps(false);
        button.setTextSize(22.0f);
        button.setBackgroundTintList(ColorStateList.valueOf(-53890));
        button.setOnClickListener(new View.OnClickListener() { // from class: com.rhythmdance.app.HomeActivity$$ExternalSyntheticLambda0
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                HomeActivity.onCreate$lambda$5$lambda$4(HomeActivity.this, view);
            }
        });
        linearLayout.addView(button, lp());
        TextView textView4 = new TextView(this);
        textView4.setText("Juego completo con todas las opciones: perfiles, logros,\ndesafío diario, editor, replays, community charts,\nmodificadores visuales, practice, tutorial y más.");
        textView4.setTextColor(-10788736);
        textView4.setTextSize(12.0f);
        textView4.setGravity(17);
        textView4.setPadding(0, dp(22), 0, 0);
        linearLayout.addView(textView4);
        setContentView(linearLayout);
    }

    @Override // androidx.fragment.app.FragmentActivity, android.app.Activity
    protected void onResume() {
        super.onResume();
        getWindow().getDecorView().setSystemUiVisibility(5894);
    }
}
