package com.rhythmdance.app.game;

import java.util.List;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

/* compiled from: Note.kt */
@Metadata(d1 = {"\u00002\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010 \n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0006\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u000e\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0010\u000e\n\u0000\b\u0086\b\u0018\u00002\u00020\u0001B+\u0012\f\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u0003\u0012\u0006\u0010\u0005\u001a\u00020\u0006\u0012\u0006\u0010\u0007\u001a\u00020\u0006\u0012\u0006\u0010\b\u001a\u00020\t¢\u0006\u0002\u0010\nJ\u000f\u0010\u0012\u001a\b\u0012\u0004\u0012\u00020\u00040\u0003HÆ\u0003J\t\u0010\u0013\u001a\u00020\u0006HÆ\u0003J\t\u0010\u0014\u001a\u00020\u0006HÆ\u0003J\t\u0010\u0015\u001a\u00020\tHÆ\u0003J7\u0010\u0016\u001a\u00020\u00002\u000e\b\u0002\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0002\u0010\u0005\u001a\u00020\u00062\b\b\u0002\u0010\u0007\u001a\u00020\u00062\b\b\u0002\u0010\b\u001a\u00020\tHÆ\u0001J\u0013\u0010\u0017\u001a\u00020\u00182\b\u0010\u0019\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u001a\u001a\u00020\tHÖ\u0001J\t\u0010\u001b\u001a\u00020\u001cHÖ\u0001R\u0011\u0010\u0005\u001a\u00020\u0006¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u0011\u0010\u0007\u001a\u00020\u0006¢\u0006\b\n\u0000\u001a\u0004\b\r\u0010\fR\u0011\u0010\b\u001a\u00020\t¢\u0006\b\n\u0000\u001a\u0004\b\u000e\u0010\u000fR\u0017\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u0010\u0010\u0011¨\u0006\u001d"}, d2 = {"Lcom/rhythmdance/app/game/Chart;", "", "notes", "", "Lcom/rhythmdance/app/game/Note;", "bpm", "", "duration", "laneCount", "", "(Ljava/util/List;DDI)V", "getBpm", "()D", "getDuration", "getLaneCount", "()I", "getNotes", "()Ljava/util/List;", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "toString", "", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes3.dex */
public final /* data */ class Chart {
    private final double bpm;
    private final double duration;
    private final int laneCount;
    private final List<Note> notes;

    public Chart(List<Note> notes, double d, double d2, int i) {
        Intrinsics.checkNotNullParameter(notes, "notes");
        this.notes = notes;
        this.bpm = d;
        this.duration = d2;
        this.laneCount = i;
    }

    public static /* synthetic */ Chart copy$default(Chart chart, List list, double d, double d2, int i, int i2, Object obj) {
        if ((i2 & 1) != 0) {
            list = chart.notes;
        }
        if ((i2 & 2) != 0) {
            d = chart.bpm;
        }
        double d3 = d;
        if ((i2 & 4) != 0) {
            d2 = chart.duration;
        }
        double d4 = d2;
        if ((i2 & 8) != 0) {
            i = chart.laneCount;
        }
        return chart.copy(list, d3, d4, i);
    }

    public final List<Note> component1() {
        return this.notes;
    }

    /* renamed from: component2, reason: from getter */
    public final double getBpm() {
        return this.bpm;
    }

    /* renamed from: component3, reason: from getter */
    public final double getDuration() {
        return this.duration;
    }

    /* renamed from: component4, reason: from getter */
    public final int getLaneCount() {
        return this.laneCount;
    }

    public final Chart copy(List<Note> notes, double bpm, double duration, int laneCount) {
        Intrinsics.checkNotNullParameter(notes, "notes");
        return new Chart(notes, bpm, duration, laneCount);
    }

    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Chart)) {
            return false;
        }
        Chart chart = (Chart) other;
        return Intrinsics.areEqual(this.notes, chart.notes) && Double.compare(this.bpm, chart.bpm) == 0 && Double.compare(this.duration, chart.duration) == 0 && this.laneCount == chart.laneCount;
    }

    public final double getBpm() {
        return this.bpm;
    }

    public final double getDuration() {
        return this.duration;
    }

    public final int getLaneCount() {
        return this.laneCount;
    }

    public final List<Note> getNotes() {
        return this.notes;
    }

    public int hashCode() {
        return (((((this.notes.hashCode() * 31) + Double.hashCode(this.bpm)) * 31) + Double.hashCode(this.duration)) * 31) + Integer.hashCode(this.laneCount);
    }

    public String toString() {
        return "Chart(notes=" + this.notes + ", bpm=" + this.bpm + ", duration=" + this.duration + ", laneCount=" + this.laneCount + ")";
    }
}
