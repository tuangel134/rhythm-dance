package com.rhythmdance.app;

import android.content.Intent;
import android.content.res.ColorStateList;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.SpinnerAdapter;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import com.rhythmdance.app.game.ChartGenerator;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.io.CloseableKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;

/* compiled from: SongPickerActivity.kt */
@Metadata(d1 = {"\u0000V\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0010\u0011\n\u0002\u0010\u000e\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0006\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0004\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\u0018\u00002\u00020\u0001B\u0005¢\u0006\u0002\u0010\u0002J\u0010\u0010\u0013\u001a\u00020\u00142\u0006\u0010\u0015\u001a\u00020\u0014H\u0002J\u0010\u0010\u0016\u001a\u00020\u00062\u0006\u0010\u0017\u001a\u00020\u000bH\u0002J\b\u0010\u0018\u001a\u00020\u0019H\u0002J\b\u0010\u001a\u001a\u00020\u001bH\u0002J\u0012\u0010\u001c\u001a\u00020\u00192\b\u0010\u001d\u001a\u0004\u0018\u00010\u001eH\u0014J\u0010\u0010\u001f\u001a\u00020\u000b2\u0006\u0010 \u001a\u00020\u000fH\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0006X\u0082.¢\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0004X\u0082.¢\u0006\u0002\n\u0000R(\u0010\b\u001a\u001c\u0012\u0018\u0012\u0016\u0012\u0004\u0012\u00020\u000b \f*\n\u0012\u0004\u0012\u00020\u000b\u0018\u00010\n0\n0\tX\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\u000bX\u0082\u000e¢\u0006\u0002\n\u0000R\u0010\u0010\u000e\u001a\u0004\u0018\u00010\u000fX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0010\u001a\u00020\u0011X\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u0012\u001a\u00020\u0006X\u0082.¢\u0006\u0002\n\u0000¨\u0006!"}, d2 = {"Lcom/rhythmdance/app/SongPickerActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "()V", "diffSpinner", "Landroid/widget/Spinner;", "fileLabel", "Landroid/widget/TextView;", "laneSpinner", "pickAudio", "Landroidx/activity/result/ActivityResultLauncher;", "", "", "kotlin.jvm.PlatformType", "pickedName", "pickedUri", "Landroid/net/Uri;", "speed", "", "speedLabel", "dp", "", "v", "label", "t", "launchGame", "", "lpW", "Landroid/widget/LinearLayout$LayoutParams;", "onCreate", "savedInstanceState", "Landroid/os/Bundle;", "queryName", "uri", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class SongPickerActivity extends AppCompatActivity {
    private Spinner diffSpinner;
    private TextView fileLabel;
    private Spinner laneSpinner;
    private final ActivityResultLauncher<String[]> pickAudio;
    private Uri pickedUri;
    private TextView speedLabel;
    private String pickedName = "";
    private double speed = 3.0d;

    public SongPickerActivity() {
        ActivityResultLauncher<String[]> registerForActivityResult = registerForActivityResult(new ActivityResultContracts.OpenDocument(), new ActivityResultCallback() { // from class: com.rhythmdance.app.SongPickerActivity$$ExternalSyntheticLambda0
            @Override // androidx.activity.result.ActivityResultCallback
            public final void onActivityResult(Object obj) {
                SongPickerActivity.pickAudio$lambda$0(SongPickerActivity.this, (Uri) obj);
            }
        });
        Intrinsics.checkNotNullExpressionValue(registerForActivityResult, "registerForActivityResult(...)");
        this.pickAudio = registerForActivityResult;
    }

    private final int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }

    private final TextView label(String t) {
        TextView textView = new TextView(this);
        textView.setText(t);
        textView.setTextColor(-4604710);
        textView.setTextSize(14.0f);
        textView.setPadding(0, dp(14), 0, dp(4));
        return textView;
    }

    private final void launchGame() {
        Uri uri = this.pickedUri;
        if (uri == null) {
            Toast.makeText(this, "Elige un archivo de audio primero", 0).show();
            return;
        }
        Spinner spinner = this.laneSpinner;
        Spinner spinner2 = null;
        if (spinner == null) {
            Intrinsics.throwUninitializedPropertyAccessException("laneSpinner");
            spinner = null;
        }
        int i = spinner.getSelectedItemPosition() == 0 ? 5 : 4;
        Intent intent = new Intent(this, (Class<?>) GameActivity.class);
        intent.putExtra("uri", uri.toString());
        intent.putExtra("name", this.pickedName);
        Spinner spinner3 = this.diffSpinner;
        if (spinner3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("diffSpinner");
        } else {
            spinner2 = spinner3;
        }
        intent.putExtra("difficulty", spinner2.getSelectedItemPosition());
        intent.putExtra("lanes", i);
        intent.putExtra("speed", this.speed);
        startActivity(intent);
    }

    private final LinearLayout.LayoutParams lpW() {
        return new LinearLayout.LayoutParams(-1, -2);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onCreate$lambda$4$lambda$3(SongPickerActivity this$0, View view) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        this$0.pickAudio.launch(new String[]{"audio/*"});
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void onCreate$lambda$9$lambda$8(SongPickerActivity this$0, View view) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        this$0.launchGame();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public static final void pickAudio$lambda$0(SongPickerActivity this$0, Uri uri) {
        Intrinsics.checkNotNullParameter(this$0, "this$0");
        if (uri != null) {
            try {
                this$0.getContentResolver().takePersistableUriPermission(uri, 1);
            } catch (Exception e) {
            }
            this$0.pickedUri = uri;
            this$0.pickedName = this$0.queryName(uri);
            TextView textView = this$0.fileLabel;
            if (textView == null) {
                Intrinsics.throwUninitializedPropertyAccessException("fileLabel");
                textView = null;
            }
            textView.setText(this$0.pickedName);
        }
    }

    private final String queryName(Uri uri) {
        String str = "Canción";
        try {
            Cursor query = getContentResolver().query(uri, null, null, null, null);
            if (query != null) {
                Cursor cursor = query;
                try {
                    Cursor cursor2 = cursor;
                    int columnIndex = cursor2.getColumnIndex("_display_name");
                    if (columnIndex >= 0 && cursor2.moveToFirst()) {
                        String string = cursor2.getString(columnIndex);
                        if (string == null) {
                            string = "Canción";
                        } else {
                            Intrinsics.checkNotNull(string);
                        }
                        str = string;
                    }
                    Unit unit = Unit.INSTANCE;
                    CloseableKt.closeFinally(cursor, null);
                } finally {
                }
            }
        } catch (Exception e) {
        }
        return StringsKt.substringBeforeLast$default(str, '.', (String) null, 2, (Object) null);
    }

    @Override // androidx.fragment.app.FragmentActivity, androidx.activity.ComponentActivity, androidx.core.app.ComponentActivity, android.app.Activity
    protected void onCreate(Bundle savedInstanceState) {
        TextView textView;
        super.onCreate(savedInstanceState);
        LinearLayout linearLayout = new LinearLayout(this);
        linearLayout.setOrientation(1);
        linearLayout.setBackgroundColor(-16447985);
        linearLayout.setPadding(dp(24), dp(28), dp(24), dp(24));
        TextView textView2 = new TextView(this);
        textView2.setText("Elige una canción");
        textView2.setTextColor(-1);
        textView2.setTextSize(24.0f);
        textView2.setPadding(0, 0, 0, dp(16));
        linearLayout.addView(textView2);
        Button button = new Button(this);
        button.setText("📂  Elegir archivo de audio");
        button.setAllCaps(false);
        button.setTextColor(-1);
        button.setBackgroundTintList(ColorStateList.valueOf(-14030849));
        button.setOnClickListener(new View.OnClickListener() { // from class: com.rhythmdance.app.SongPickerActivity$$ExternalSyntheticLambda1
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                SongPickerActivity.onCreate$lambda$4$lambda$3(SongPickerActivity.this, view);
            }
        });
        linearLayout.addView(button, lpW());
        TextView textView3 = new TextView(this);
        textView3.setText("(ningún archivo elegido)");
        textView3.setTextColor(-7630928);
        textView3.setTextSize(14.0f);
        textView3.setPadding(0, dp(8), 0, dp(20));
        this.fileLabel = textView3;
        TextView textView4 = this.fileLabel;
        if (textView4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("fileLabel");
            textView4 = null;
        }
        linearLayout.addView(textView4);
        linearLayout.addView(label("Dificultad"));
        this.diffSpinner = new Spinner(this);
        Spinner spinner = this.diffSpinner;
        if (spinner == null) {
            Intrinsics.throwUninitializedPropertyAccessException("diffSpinner");
            spinner = null;
        }
        SongPickerActivity songPickerActivity = this;
        List<ChartGenerator.Difficulty> difficulties = ChartGenerator.INSTANCE.getDIFFICULTIES();
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(difficulties, 10));
        Iterator<T> it = difficulties.iterator();
        while (it.hasNext()) {
            arrayList.add(((ChartGenerator.Difficulty) it.next()).getName());
        }
        spinner.setAdapter((SpinnerAdapter) new ArrayAdapter(songPickerActivity, android.R.layout.simple_spinner_dropdown_item, arrayList));
        Spinner spinner2 = this.diffSpinner;
        if (spinner2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("diffSpinner");
            spinner2 = null;
        }
        spinner2.setSelection(1);
        Spinner spinner3 = this.diffSpinner;
        if (spinner3 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("diffSpinner");
            spinner3 = null;
        }
        linearLayout.addView(spinner3, lpW());
        linearLayout.addView(label("Estilo"));
        this.laneSpinner = new Spinner(this);
        Spinner spinner4 = this.laneSpinner;
        if (spinner4 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("laneSpinner");
            spinner4 = null;
        }
        spinner4.setAdapter((SpinnerAdapter) new ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, CollectionsKt.listOf((Object[]) new String[]{"Pump It Up (5)", "DDR (4)"})));
        Spinner spinner5 = this.laneSpinner;
        if (spinner5 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("laneSpinner");
            spinner5 = null;
        }
        linearLayout.addView(spinner5, lpW());
        this.speedLabel = label("Velocidad: 3.0x");
        TextView textView5 = this.speedLabel;
        if (textView5 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("speedLabel");
            textView = null;
        } else {
            textView = textView5;
        }
        linearLayout.addView(textView);
        SeekBar seekBar = new SeekBar(this);
        seekBar.setMax(10);
        seekBar.setProgress(4);
        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() { // from class: com.rhythmdance.app.SongPickerActivity$onCreate$seek$1$1
            @Override // android.widget.SeekBar.OnSeekBarChangeListener
            public void onProgressChanged(SeekBar sb, int p, boolean fromUser) {
                TextView textView6;
                double d;
                SongPickerActivity.this.speed = (p * 0.5d) + 1.0d;
                textView6 = SongPickerActivity.this.speedLabel;
                if (textView6 == null) {
                    Intrinsics.throwUninitializedPropertyAccessException("speedLabel");
                    textView6 = null;
                }
                d = SongPickerActivity.this.speed;
                String format = String.format("%.1f", Arrays.copyOf(new Object[]{Double.valueOf(d)}, 1));
                Intrinsics.checkNotNullExpressionValue(format, "format(...)");
                textView6.setText("Velocidad: " + format + "x");
            }

            @Override // android.widget.SeekBar.OnSeekBarChangeListener
            public void onStartTrackingTouch(SeekBar sb) {
            }

            @Override // android.widget.SeekBar.OnSeekBarChangeListener
            public void onStopTrackingTouch(SeekBar sb) {
            }
        });
        linearLayout.addView(seekBar, lpW());
        Button button2 = new Button(this);
        button2.setText("▶  Generar y jugar");
        button2.setAllCaps(false);
        button2.setTextSize(18.0f);
        button2.setTextColor(-1);
        button2.setBackgroundTintList(ColorStateList.valueOf(-53890));
        button2.setOnClickListener(new View.OnClickListener() { // from class: com.rhythmdance.app.SongPickerActivity$$ExternalSyntheticLambda2
            @Override // android.view.View.OnClickListener
            public final void onClick(View view) {
                SongPickerActivity.onCreate$lambda$9$lambda$8(SongPickerActivity.this, view);
            }
        });
        LinearLayout.LayoutParams lpW = lpW();
        lpW.topMargin = dp(24);
        Unit unit = Unit.INSTANCE;
        linearLayout.addView(button2, lpW);
        setContentView(linearLayout);
    }
}
