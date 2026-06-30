package com.rhythmdance.app.game;

import java.util.Arrays;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

/* compiled from: AudioDecoder.kt */
@Metadata(d1 = {"\u0000.\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u0014\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u0006\n\u0002\b\n\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0000\b\u0086\b\u0018\u00002\u00020\u0001B\u0015\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005¢\u0006\u0002\u0010\u0006J\t\u0010\u000f\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0010\u001a\u00020\u0005HÆ\u0003J\u001d\u0010\u0011\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u0005HÆ\u0001J\u0013\u0010\u0012\u001a\u00020\u00132\b\u0010\u0014\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0015\u001a\u00020\u0005HÖ\u0001J\t\u0010\u0016\u001a\u00020\u0017HÖ\u0001R\u0011\u0010\u0007\u001a\u00020\b8F¢\u0006\u0006\u001a\u0004\b\t\u0010\nR\u0011\u0010\u0004\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\r\u0010\u000e¨\u0006\u0018"}, d2 = {"Lcom/rhythmdance/app/game/DecodedAudio;", "", "samples", "", "sampleRate", "", "([FI)V", "durationSec", "", "getDurationSec", "()D", "getSampleRate", "()I", "getSamples", "()[F", "component1", "component2", "copy", "equals", "", "other", "hashCode", "toString", "", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes3.dex */
public final /* data */ class DecodedAudio {
    private final int sampleRate;
    private final float[] samples;

    public DecodedAudio(float[] samples, int i) {
        Intrinsics.checkNotNullParameter(samples, "samples");
        this.samples = samples;
        this.sampleRate = i;
    }

    public static /* synthetic */ DecodedAudio copy$default(DecodedAudio decodedAudio, float[] fArr, int i, int i2, Object obj) {
        if ((i2 & 1) != 0) {
            fArr = decodedAudio.samples;
        }
        if ((i2 & 2) != 0) {
            i = decodedAudio.sampleRate;
        }
        return decodedAudio.copy(fArr, i);
    }

    /* renamed from: component1, reason: from getter */
    public final float[] getSamples() {
        return this.samples;
    }

    /* renamed from: component2, reason: from getter */
    public final int getSampleRate() {
        return this.sampleRate;
    }

    public final DecodedAudio copy(float[] samples, int sampleRate) {
        Intrinsics.checkNotNullParameter(samples, "samples");
        return new DecodedAudio(samples, sampleRate);
    }

    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DecodedAudio)) {
            return false;
        }
        DecodedAudio decodedAudio = (DecodedAudio) other;
        return Intrinsics.areEqual(this.samples, decodedAudio.samples) && this.sampleRate == decodedAudio.sampleRate;
    }

    public final double getDurationSec() {
        if (this.sampleRate > 0) {
            return this.samples.length / this.sampleRate;
        }
        return 0.0d;
    }

    public final int getSampleRate() {
        return this.sampleRate;
    }

    public final float[] getSamples() {
        return this.samples;
    }

    public int hashCode() {
        return (Arrays.hashCode(this.samples) * 31) + Integer.hashCode(this.sampleRate);
    }

    public String toString() {
        return "DecodedAudio(samples=" + Arrays.toString(this.samples) + ", sampleRate=" + this.sampleRate + ")";
    }
}
