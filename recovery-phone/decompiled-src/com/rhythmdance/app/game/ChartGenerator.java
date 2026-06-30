package com.rhythmdance.app.game;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.Random;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.comparisons.ComparisonsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

/* compiled from: ChartGenerator.kt */
@Metadata(d1 = {"\u0000X\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010\u0018\n\u0000\n\u0002\u0010\u0014\n\u0000\n\u0002\u0010\u0007\n\u0000\n\u0002\u0010\u0006\n\u0002\b\u0007\n\u0002\u0010\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\b\n\u0002\u0018\u0002\n\u0002\b\t\bÆ\u0002\u0018\u00002\u00020\u0001:\u00011B\u0007\b\u0002¢\u0006\u0002\u0010\u0002J\u0010\u0010\u000b\u001a\u00020\f2\u0006\u0010\r\u001a\u00020\u000eH\u0002J(\u0010\u000f\u001a\u00020\u00102\u0006\u0010\r\u001a\u00020\u000e2\u0006\u0010\u0011\u001a\u00020\u00122\u0006\u0010\u0013\u001a\u00020\u00122\u0006\u0010\u0014\u001a\u00020\tH\u0002J\u0018\u0010\u0015\u001a\u00020\u00122\u0006\u0010\r\u001a\u00020\u000e2\u0006\u0010\u0011\u001a\u00020\u0012H\u0002J \u0010\u0016\u001a\u00020\u00122\u0006\u0010\u0017\u001a\u00020\f2\u0006\u0010\u0011\u001a\u00020\u00122\u0006\u0010\u0018\u001a\u00020\u0012H\u0002J\u0018\u0010\u0019\u001a\u00020\u001a2\u0006\u0010\u001b\u001a\u00020\u000e2\u0006\u0010\u001c\u001a\u00020\u000eH\u0002J(\u0010\u001d\u001a\u00020\u001e2\u0006\u0010\u001f\u001a\u00020 2\u0006\u0010!\u001a\u00020\t2\u0006\u0010\"\u001a\u00020\u00052\b\b\u0002\u0010#\u001a\u00020\u0012J\u0010\u0010$\u001a\u00020\u000e2\u0006\u0010%\u001a\u00020\tH\u0002J(\u0010&\u001a\u00020\u00122\u0006\u0010\u0017\u001a\u00020\f2\u0006\u0010\u0011\u001a\u00020\u00122\u0006\u0010\u0013\u001a\u00020\u00122\u0006\u0010'\u001a\u00020\u0012H\u0002JV\u0010(\u001a\b\u0012\u0004\u0012\u00020)0\u00042\u0006\u0010\r\u001a\u00020\u000e2\u0006\u0010\u0017\u001a\u00020\f2\u0006\u0010\u0011\u001a\u00020\u00122\u0006\u0010*\u001a\u00020\u00122\u0006\u0010+\u001a\u00020\u00122\u0006\u0010,\u001a\u00020\u00122\u0006\u0010!\u001a\u00020\t2\u0006\u0010\"\u001a\u00020\u00052\u0006\u0010#\u001a\u00020\u0012H\u0002J\u0018\u0010-\u001a\u00020\u000e2\u0006\u0010.\u001a\u00020\u000e2\u0006\u0010\u0014\u001a\u00020\tH\u0002J\u0010\u0010/\u001a\u00020\u000e2\u0006\u00100\u001a\u00020\u000eH\u0002R\u0017\u0010\u0003\u001a\b\u0012\u0004\u0012\u00020\u00050\u0004¢\u0006\b\n\u0000\u001a\u0004\b\u0006\u0010\u0007R\u000e\u0010\b\u001a\u00020\tX\u0082T¢\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\tX\u0082T¢\u0006\u0002\n\u0000¨\u00062"}, d2 = {"Lcom/rhythmdance/app/game/ChartGenerator;", "", "()V", "DIFFICULTIES", "", "Lcom/rhythmdance/app/game/ChartGenerator$Difficulty;", "getDIFFICULTIES", "()Ljava/util/List;", "FFT", "", "HOP", "detectPeaks", "", "nov", "", "energyAt", "", "hopSec", "", "t", "radius", "estimateBpm", "estimateOffset", "peaks", "beatSec", "fft", "", "re", "im", "generate", "Lcom/rhythmdance/app/game/Chart;", "audio", "Lcom/rhythmdance/app/game/DecodedAudio;", "laneCount", "diff", "introFreeSec", "hann", "n", "nearestPeak", "tolSec", "placeNotes", "Lcom/rhythmdance/app/game/Note;", "bpm", "offset", "duration", "smooth", "a", "spectralFlux", "x", "Difficulty", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes3.dex */
public final class ChartGenerator {
    private static final int FFT = 1024;
    private static final int HOP = 512;
    public static final ChartGenerator INSTANCE = new ChartGenerator();
    private static final List<Difficulty> DIFFICULTIES = CollectionsKt.listOf((Object[]) new Difficulty[]{new Difficulty("Fácil", 2.0d, 1, 0.0d), new Difficulty("Normal", 3.3d, 2, 0.1d), new Difficulty("Difícil", 5.0d, 2, 0.28d), new Difficulty("Experto", 6.5d, 4, 0.45d)});

    /* compiled from: ChartGenerator.kt */
    @Metadata(d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\u0006\n\u0000\n\u0002\u0010\b\n\u0002\b\u000f\n\u0002\u0010\u000b\n\u0002\b\u0004\b\u0086\b\u0018\u00002\u00020\u0001B%\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\u0006\u0010\u0006\u001a\u00020\u0007\u0012\u0006\u0010\b\u001a\u00020\u0005¢\u0006\u0002\u0010\tJ\t\u0010\u0011\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0012\u001a\u00020\u0005HÆ\u0003J\t\u0010\u0013\u001a\u00020\u0007HÆ\u0003J\t\u0010\u0014\u001a\u00020\u0005HÆ\u0003J1\u0010\u0015\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\b\b\u0002\u0010\u0006\u001a\u00020\u00072\b\b\u0002\u0010\b\u001a\u00020\u0005HÆ\u0001J\u0013\u0010\u0016\u001a\u00020\u00172\b\u0010\u0018\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0019\u001a\u00020\u0007HÖ\u0001J\t\u0010\u001a\u001a\u00020\u0003HÖ\u0001R\u0011\u0010\b\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\n\u0010\u000bR\u0011\u0010\u0004\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\f\u0010\u000bR\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\r\u0010\u000eR\u0011\u0010\u0006\u001a\u00020\u0007¢\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u0010¨\u0006\u001b"}, d2 = {"Lcom/rhythmdance/app/game/ChartGenerator$Difficulty;", "", "name", "", "maxNps", "", "subdiv", "", "jumpChance", "(Ljava/lang/String;DID)V", "getJumpChance", "()D", "getMaxNps", "getName", "()Ljava/lang/String;", "getSubdiv", "()I", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "toString", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public static final /* data */ class Difficulty {
        private final double jumpChance;
        private final double maxNps;
        private final String name;
        private final int subdiv;

        public Difficulty(String name, double d, int i, double d2) {
            Intrinsics.checkNotNullParameter(name, "name");
            this.name = name;
            this.maxNps = d;
            this.subdiv = i;
            this.jumpChance = d2;
        }

        public static /* synthetic */ Difficulty copy$default(Difficulty difficulty, String str, double d, int i, double d2, int i2, Object obj) {
            if ((i2 & 1) != 0) {
                str = difficulty.name;
            }
            if ((i2 & 2) != 0) {
                d = difficulty.maxNps;
            }
            double d3 = d;
            if ((i2 & 4) != 0) {
                i = difficulty.subdiv;
            }
            int i3 = i;
            if ((i2 & 8) != 0) {
                d2 = difficulty.jumpChance;
            }
            return difficulty.copy(str, d3, i3, d2);
        }

        /* renamed from: component1, reason: from getter */
        public final String getName() {
            return this.name;
        }

        /* renamed from: component2, reason: from getter */
        public final double getMaxNps() {
            return this.maxNps;
        }

        /* renamed from: component3, reason: from getter */
        public final int getSubdiv() {
            return this.subdiv;
        }

        /* renamed from: component4, reason: from getter */
        public final double getJumpChance() {
            return this.jumpChance;
        }

        public final Difficulty copy(String name, double maxNps, int subdiv, double jumpChance) {
            Intrinsics.checkNotNullParameter(name, "name");
            return new Difficulty(name, maxNps, subdiv, jumpChance);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof Difficulty)) {
                return false;
            }
            Difficulty difficulty = (Difficulty) other;
            return Intrinsics.areEqual(this.name, difficulty.name) && Double.compare(this.maxNps, difficulty.maxNps) == 0 && this.subdiv == difficulty.subdiv && Double.compare(this.jumpChance, difficulty.jumpChance) == 0;
        }

        public final double getJumpChance() {
            return this.jumpChance;
        }

        public final double getMaxNps() {
            return this.maxNps;
        }

        public final String getName() {
            return this.name;
        }

        public final int getSubdiv() {
            return this.subdiv;
        }

        public int hashCode() {
            return (((((this.name.hashCode() * 31) + Double.hashCode(this.maxNps)) * 31) + Integer.hashCode(this.subdiv)) * 31) + Double.hashCode(this.jumpChance);
        }

        public String toString() {
            return "Difficulty(name=" + this.name + ", maxNps=" + this.maxNps + ", subdiv=" + this.subdiv + ", jumpChance=" + this.jumpChance + ")";
        }
    }

    private ChartGenerator() {
    }

    private final boolean[] detectPeaks(float[] nov) {
        boolean[] zArr = new boolean[nov.length];
        int length = nov.length - 3;
        for (int i = 3; i < length; i++) {
            float f = nov[i];
            if (f >= 0.08f) {
                boolean z = true;
                int i2 = -3;
                if (i2 <= 3) {
                    while (true) {
                        if (i2 != 0 && nov[i + i2] > f) {
                            z = false;
                            break;
                        }
                        if (i2 == 3) {
                            break;
                        }
                        i2++;
                    }
                }
                if (z) {
                    float f2 = 0.0f;
                    int i3 = -8;
                    while (true) {
                        if (i3 >= 9) {
                            break;
                        }
                        int i4 = i + i3;
                        if (i4 >= 0 && i4 < nov.length) {
                            f2 += nov[i4];
                        }
                        i3++;
                    }
                    if (f >= 1.3f * (f2 / 17.0f)) {
                        zArr[i] = true;
                    }
                }
            }
        }
        return zArr;
    }

    private final float energyAt(float[] nov, double hopSec, double t, int radius) {
        int i = (int) (t / hopSec);
        float f = 0.0f;
        int i2 = -radius;
        if (i2 <= radius) {
            while (true) {
                int i3 = i + i2;
                boolean z = false;
                if (i3 >= 0 && i3 < nov.length) {
                    z = true;
                }
                if (z && nov[i3] > f) {
                    f = nov[i3];
                }
                if (i2 == radius) {
                    break;
                }
                i2++;
            }
        }
        return f;
    }

    private final double estimateBpm(float[] nov, double hopSec) {
        float[] fArr = nov;
        if (fArr.length < 8) {
            return 120.0d;
        }
        long j = 4634626229029306368L;
        long j2 = 4640889047261118464L;
        int coerceAtLeast = RangesKt.coerceAtLeast((int) ((60.0d / 190.0d) / hopSec), 1);
        int coerceAtMost = RangesKt.coerceAtMost((int) ((60.0d / 70.0d) / hopSec), fArr.length - 1);
        int i = coerceAtLeast;
        double d = -1.0d;
        int i2 = coerceAtLeast;
        if (i2 <= coerceAtMost) {
            while (true) {
                double d2 = 0.0d;
                for (int i3 = i2; i3 < fArr.length; i3++) {
                    d2 += fArr[i3] * fArr[i3 - i2];
                }
                long j3 = j;
                long j4 = j2;
                double max = Math.max(0.5d, 1.0d - (Math.abs(Math.log((60.0d / (i2 * hopSec)) / 125.0d)) * 0.2d)) * d2;
                if (max > d) {
                    d = max;
                    i = i2;
                }
                if (i2 == coerceAtMost) {
                    break;
                }
                i2++;
                fArr = nov;
                j2 = j4;
                j = j3;
            }
        }
        double d3 = 60.0d / (i * hopSec);
        while (d3 < 90.0d) {
            d3 *= 2;
        }
        while (d3 > 200.0d) {
            d3 /= 2;
        }
        return d3;
    }

    private final double estimateOffset(boolean[] peaks, double hopSec, double beatSec) {
        int length = peaks.length;
        for (int i = 0; i < length; i++) {
            if (peaks[i]) {
                return (i * hopSec) % beatSec;
            }
        }
        return 0.0d;
    }

    private final void fft(float[] re, float[] im) {
        int length = re.length;
        int i = 0;
        for (int i2 = 1; i2 < length; i2++) {
            int i3 = length >> 1;
            while ((i & i3) != 0) {
                i ^= i3;
                i3 >>= 1;
            }
            i |= i3;
            if (i2 < i) {
                float f = re[i2];
                re[i2] = re[i];
                re[i] = f;
                float f2 = im[i2];
                im[i2] = im[i];
                im[i] = f2;
            }
        }
        for (int i4 = 2; i4 <= length; i4 <<= 1) {
            double d = (-6.283185307179586d) / i4;
            float cos = (float) Math.cos(d);
            float sin = (float) Math.sin(d);
            for (int i5 = 0; i5 < length; i5 += i4) {
                float f3 = 1.0f;
                float f4 = 0.0f;
                int i6 = i4 / 2;
                for (int i7 = 0; i7 < i6; i7++) {
                    float f5 = re[i5 + i7];
                    float f6 = im[i5 + i7];
                    float f7 = (re[(i5 + i7) + (i4 / 2)] * f3) - (im[(i5 + i7) + (i4 / 2)] * f4);
                    float f8 = (re[i5 + i7 + (i4 / 2)] * f4) + (im[i5 + i7 + (i4 / 2)] * f3);
                    re[i5 + i7] = f5 + f7;
                    im[i5 + i7] = f6 + f8;
                    re[i5 + i7 + (i4 / 2)] = f5 - f7;
                    im[i5 + i7 + (i4 / 2)] = f6 - f8;
                    float f9 = (f3 * cos) - (f4 * sin);
                    f4 = (f3 * sin) + (f4 * cos);
                    f3 = f9;
                }
            }
        }
    }

    public static /* synthetic */ Chart generate$default(ChartGenerator chartGenerator, DecodedAudio decodedAudio, int i, Difficulty difficulty, double d, int i2, Object obj) {
        if ((i2 & 8) != 0) {
            d = 6.0d;
        }
        return chartGenerator.generate(decodedAudio, i, difficulty, d);
    }

    private final float[] hann(int n) {
        float[] fArr = new float[n];
        for (int i = 0; i < n; i++) {
            fArr[i] = (float) ((1 - Math.cos((i * 6.283185307179586d) / (n - 1))) * 0.5d);
        }
        return fArr;
    }

    private final double nearestPeak(boolean[] peaks, double hopSec, double t, double tolSec) {
        int abs;
        int i = (int) (t / hopSec);
        int i2 = (int) (tolSec / hopSec);
        int i3 = -1;
        int i4 = Integer.MAX_VALUE;
        int i5 = -i2;
        if (i5 <= i2) {
            while (true) {
                int i6 = i + i5;
                boolean z = false;
                if (i6 >= 0 && i6 < peaks.length) {
                    z = true;
                }
                if (z && peaks[i6] && (abs = Math.abs(i5)) < i4) {
                    i4 = abs;
                    i3 = i6;
                }
                if (i5 == i2) {
                    break;
                }
                i5++;
            }
        }
        if (i3 >= 0) {
            return i3 * hopSec;
        }
        return -1.0d;
    }

    private final List<Note> placeNotes(float[] nov, boolean[] peaks, double hopSec, double bpm, double offset, double duration, int laneCount, Difficulty diff, double introFreeSec) {
        boolean z;
        int i;
        List list;
        double d;
        double d2 = 60.0d / bpm;
        double subdiv = d2 / diff.getSubdiv();
        ArrayList arrayList = new ArrayList();
        Random random = new Random(1234L);
        ArrayList arrayList2 = new ArrayList();
        int i2 = 0;
        double d3 = offset;
        while (true) {
            z = true;
            if (d3 >= duration) {
                break;
            }
            double d4 = d3;
            arrayList2.add(new Cell(d4, energyAt(nov, hopSec, d4, 3), i2 % diff.getSubdiv() == 0));
            i2++;
            d3 = offset + (i2 * subdiv);
            d2 = d2;
        }
        if (arrayList2.isEmpty()) {
            return arrayList;
        }
        int i3 = -1;
        int maxNps = (int) (diff.getMaxNps() * Math.max(1.0d, duration - introFreeSec));
        ArrayList arrayList3 = arrayList2;
        ArrayList arrayList4 = new ArrayList(CollectionsKt.collectionSizeOrDefault(arrayList3, 10));
        Iterator it = arrayList3.iterator();
        while (it.hasNext()) {
            arrayList4.add(Float.valueOf(((Cell) it.next()).getE()));
        }
        List sortedDescending = CollectionsKt.sortedDescending(arrayList4);
        float f = 0.0f;
        float floatValue = sortedDescending.isEmpty() ^ true ? ((Number) sortedDescending.get(Math.min(sortedDescending.size() - 1, Math.max(0, maxNps - 1)))).floatValue() : 0.0f;
        if (!sortedDescending.isEmpty()) {
            f = ((Number) sortedDescending.get(0)).floatValue();
        }
        float f2 = 0.16f * f;
        if (floatValue < f2) {
            floatValue = f2;
        }
        double d5 = -10.0d;
        double d6 = 0.85d * subdiv;
        Iterator it2 = arrayList2.iterator();
        int i4 = -1;
        while (it2.hasNext()) {
            Cell cell = (Cell) it2.next();
            if (cell.getT() < introFreeSec) {
                i = maxNps;
                list = sortedDescending;
                d = subdiv;
            } else if (!((cell.getE() >= floatValue || (cell.getOnBeat() && cell.getE() >= 0.5f * floatValue)) ? z : false)) {
                i = maxNps;
                list = sortedDescending;
                d = subdiv;
            } else if (cell.getT() - d5 >= d6) {
                i = maxNps;
                list = sortedDescending;
                d = subdiv;
                double nearestPeak = nearestPeak(peaks, hopSec, cell.getT(), Math.min(0.045d, subdiv * 0.5d));
                double t = nearestPeak >= 0.0d ? nearestPeak : cell.getT();
                int nextInt = random.nextInt(laneCount);
                int i5 = 0;
                while (true) {
                    if ((nextInt == i3 || nextInt == i4) && i5 < 8) {
                        nextInt = random.nextInt(laneCount);
                        i5++;
                    }
                }
                arrayList.add(new Note(t, nextInt, 0.0d, 4, null));
                i4 = i3;
                i3 = nextInt;
                d5 = cell.getT();
                if (cell.getE() >= 1.4f * floatValue && random.nextDouble() < diff.getJumpChance()) {
                    int nextInt2 = random.nextInt(laneCount);
                    for (int i6 = 0; nextInt2 == nextInt && i6 < 8; i6++) {
                        nextInt2 = random.nextInt(laneCount);
                    }
                    if (nextInt2 != nextInt) {
                        arrayList.add(new Note(t, nextInt2, 0.0d, 4, null));
                    }
                }
            } else {
                i = maxNps;
                list = sortedDescending;
                d = subdiv;
            }
            maxNps = i;
            sortedDescending = list;
            subdiv = d;
            z = true;
        }
        ArrayList arrayList5 = arrayList;
        if (arrayList5.size() > 1) {
            CollectionsKt.sortWith(arrayList5, new Comparator() { // from class: com.rhythmdance.app.game.ChartGenerator$placeNotes$$inlined$sortBy$1
                /* JADX WARN: Multi-variable type inference failed */
                @Override // java.util.Comparator
                public final int compare(T t2, T t3) {
                    return ComparisonsKt.compareValues(Double.valueOf(((Note) t2).getTime()), Double.valueOf(((Note) t3).getTime()));
                }
            });
        }
        return arrayList;
    }

    private final float[] smooth(float[] a, int radius) {
        if (radius > 0) {
            if (!(a.length == 0)) {
                float[] fArr = new float[a.length];
                int length = a.length;
                for (int i = 0; i < length; i++) {
                    float f = 0.0f;
                    int i2 = 0;
                    int i3 = -radius;
                    if (i3 <= radius) {
                        while (true) {
                            int i4 = i + i3;
                            if (i4 >= 0 && i4 < a.length) {
                                f += a[i4];
                                i2++;
                            }
                            if (i3 != radius) {
                                i3++;
                            }
                        }
                    }
                    fArr[i] = f / i2;
                }
                return fArr;
            }
        }
        return a;
    }

    private final float[] spectralFlux(float[] x) {
        int i = 1024;
        float[] hann = hann(1024);
        int max = Math.max(0, ((x.length - 1024) / 512) + 1);
        if (max <= 1) {
            return new float[0];
        }
        float[] fArr = new float[512];
        float[] fArr2 = new float[512];
        float[] fArr3 = new float[max];
        float[] fArr4 = new float[1024];
        float[] fArr5 = new float[1024];
        int i2 = 0;
        while (i2 < max) {
            int i3 = i2 * 512;
            for (int i4 = 0; i4 < i; i4++) {
                fArr4[i4] = x[i3 + i4] * hann[i4];
                fArr5[i4] = 0.0f;
            }
            fft(fArr4, fArr5);
            int i5 = 0;
            while (i5 < 512) {
                fArr2[i5] = (float) Math.log(1.0f + ((float) Math.sqrt((fArr4[i5] * fArr4[i5]) + (fArr5[i5] * fArr5[i5]))));
                i5++;
                i3 = i3;
            }
            if (i2 > 0) {
                float f = 0.0f;
                for (int i6 = 0; i6 < 512; i6++) {
                    float f2 = fArr2[i6] - fArr[i6];
                    if (f2 > 0.0f) {
                        f += f2;
                    }
                }
                fArr3[i2] = f;
            }
            System.arraycopy(fArr2, 0, fArr, 0, 512);
            i2++;
            i = 1024;
        }
        float f3 = 0.0f;
        for (float f4 : fArr3) {
            if (f4 > f3) {
                f3 = f4;
            }
        }
        if (f3 > 0.0f) {
            int length = fArr3.length;
            for (int i7 = 0; i7 < length; i7++) {
                fArr3[i7] = fArr3[i7] / f3;
            }
        }
        return smooth(fArr3, 2);
    }

    public final Chart generate(DecodedAudio audio, int laneCount, Difficulty diff, double introFreeSec) {
        Intrinsics.checkNotNullParameter(audio, "audio");
        Intrinsics.checkNotNullParameter(diff, "diff");
        double sampleRate = 512.0d / audio.getSampleRate();
        float[] spectralFlux = spectralFlux(audio.getSamples());
        boolean[] detectPeaks = detectPeaks(spectralFlux);
        double estimateBpm = estimateBpm(spectralFlux, sampleRate);
        double estimateOffset = estimateOffset(detectPeaks, sampleRate, 60.0d / estimateBpm);
        double durationSec = audio.getDurationSec();
        return new Chart(placeNotes(spectralFlux, detectPeaks, sampleRate, estimateBpm, estimateOffset, durationSec, laneCount, diff, introFreeSec), estimateBpm, durationSec, laneCount);
    }

    public final List<Difficulty> getDIFFICULTIES() {
        return DIFFICULTIES;
    }
}
