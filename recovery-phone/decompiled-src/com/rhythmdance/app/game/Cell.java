package com.rhythmdance.app.game;

import kotlin.Metadata;

/* compiled from: ChartGenerator.kt */
@Metadata(d1 = {"\u0000+\n\u0000\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u0006\n\u0000\n\u0002\u0010\u0007\n\u0000\n\u0002\u0010\u000b\n\u0002\b\u000f\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0000*\u0001\u0000\b\u008a\b\u0018\u00002\u00020\u0001B\u001d\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\u0006\u0010\u0006\u001a\u00020\u0007¢\u0006\u0002\u0010\bJ\t\u0010\u000f\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0010\u001a\u00020\u0005HÆ\u0003J\t\u0010\u0011\u001a\u00020\u0007HÆ\u0003J,\u0010\u0012\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\b\b\u0002\u0010\u0006\u001a\u00020\u0007HÆ\u0001¢\u0006\u0002\u0010\u0013J\u0013\u0010\u0014\u001a\u00020\u00072\b\u0010\u0015\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0016\u001a\u00020\u0017HÖ\u0001J\t\u0010\u0018\u001a\u00020\u0019HÖ\u0001R\u0011\u0010\u0004\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\t\u0010\nR\u0011\u0010\u0006\u001a\u00020\u0007¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\r\u0010\u000e¨\u0006\u001a"}, d2 = {"com/rhythmdance/app/game/ChartGenerator$placeNotes$Cell", "", "t", "", "e", "", "onBeat", "", "(DFZ)V", "getE", "()F", "getOnBeat", "()Z", "getT", "()D", "component1", "component2", "component3", "copy", "(DFZ)Lcom/rhythmdance/app/game/ChartGenerator$placeNotes$Cell;", "equals", "other", "hashCode", "", "toString", "", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* renamed from: com.rhythmdance.app.game.ChartGenerator$placeNotes$Cell, reason: from toString */
/* loaded from: classes3.dex */
public final /* data */ class Cell {
    private final float e;
    private final boolean onBeat;
    private final double t;

    public Cell(double d, float f, boolean z) {
        this.t = d;
        this.e = f;
        this.onBeat = z;
    }

    public static /* synthetic */ Cell copy$default(Cell cell, double d, float f, boolean z, int i, Object obj) {
        if ((i & 1) != 0) {
            d = cell.t;
        }
        if ((i & 2) != 0) {
            f = cell.e;
        }
        if ((i & 4) != 0) {
            z = cell.onBeat;
        }
        return cell.copy(d, f, z);
    }

    /* renamed from: component1, reason: from getter */
    public final double getT() {
        return this.t;
    }

    /* renamed from: component2, reason: from getter */
    public final float getE() {
        return this.e;
    }

    /* renamed from: component3, reason: from getter */
    public final boolean getOnBeat() {
        return this.onBeat;
    }

    public final Cell copy(double t, float e, boolean onBeat) {
        return new Cell(t, e, onBeat);
    }

    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Cell)) {
            return false;
        }
        Cell cell = (Cell) other;
        return Double.compare(this.t, cell.t) == 0 && Float.compare(this.e, cell.e) == 0 && this.onBeat == cell.onBeat;
    }

    public final float getE() {
        return this.e;
    }

    public final boolean getOnBeat() {
        return this.onBeat;
    }

    public final double getT() {
        return this.t;
    }

    public int hashCode() {
        return (((Double.hashCode(this.t) * 31) + Float.hashCode(this.e)) * 31) + Boolean.hashCode(this.onBeat);
    }

    public String toString() {
        return "Cell(t=" + this.t + ", e=" + this.e + ", onBeat=" + this.onBeat + ")";
    }
}
