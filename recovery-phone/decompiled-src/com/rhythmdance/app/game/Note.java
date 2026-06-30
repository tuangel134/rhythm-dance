package com.rhythmdance.app.game;

import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;

/* compiled from: Note.kt */
@Metadata(d1 = {"\u0000&\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u0006\n\u0000\n\u0002\u0010\b\n\u0002\b\u0005\n\u0002\u0010\u000b\n\u0002\b\u0018\n\u0002\u0010\u000e\n\u0000\b\u0086\b\u0018\u00002\u00020\u0001B\u001f\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\b\b\u0002\u0010\u0006\u001a\u00020\u0003¢\u0006\u0002\u0010\u0007J\t\u0010\u001c\u001a\u00020\u0003HÆ\u0003J\t\u0010\u001d\u001a\u00020\u0005HÆ\u0003J\t\u0010\u001e\u001a\u00020\u0003HÆ\u0003J'\u0010\u001f\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\b\b\u0002\u0010\u0006\u001a\u00020\u0003HÆ\u0001J\u0013\u0010 \u001a\u00020\u000b2\b\u0010!\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\"\u001a\u00020\u0005HÖ\u0001J\t\u0010#\u001a\u00020$HÖ\u0001R\u0011\u0010\u0006\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\b\u0010\tR\u001a\u0010\n\u001a\u00020\u000bX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\f\u0010\r\"\u0004\b\u000e\u0010\u000fR\u001a\u0010\u0010\u001a\u00020\u000bX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0011\u0010\r\"\u0004\b\u0012\u0010\u000fR\u001a\u0010\u0013\u001a\u00020\u000bX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0014\u0010\r\"\u0004\b\u0015\u0010\u000fR\u0011\u0010\u0004\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\u0016\u0010\u0017R\u001a\u0010\u0018\u001a\u00020\u000bX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0019\u0010\r\"\u0004\b\u001a\u0010\u000fR\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u001b\u0010\t¨\u0006%"}, d2 = {"Lcom/rhythmdance/app/game/Note;", "", "time", "", "lane", "", "duration", "(DID)V", "getDuration", "()D", "hit", "", "getHit", "()Z", "setHit", "(Z)V", "holdDone", "getHoldDone", "setHoldDone", "holding", "getHolding", "setHolding", "getLane", "()I", "missed", "getMissed", "setMissed", "getTime", "component1", "component2", "component3", "copy", "equals", "other", "hashCode", "toString", "", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes3.dex */
public final /* data */ class Note {
    private final double duration;
    private boolean hit;
    private boolean holdDone;
    private boolean holding;
    private final int lane;
    private boolean missed;
    private final double time;

    public Note(double d, int i, double d2) {
        this.time = d;
        this.lane = i;
        this.duration = d2;
    }

    public /* synthetic */ Note(double d, int i, double d2, int i2, DefaultConstructorMarker defaultConstructorMarker) {
        this(d, i, (i2 & 4) != 0 ? 0.0d : d2);
    }

    public static /* synthetic */ Note copy$default(Note note, double d, int i, double d2, int i2, Object obj) {
        if ((i2 & 1) != 0) {
            d = note.time;
        }
        double d3 = d;
        if ((i2 & 2) != 0) {
            i = note.lane;
        }
        int i3 = i;
        if ((i2 & 4) != 0) {
            d2 = note.duration;
        }
        return note.copy(d3, i3, d2);
    }

    /* renamed from: component1, reason: from getter */
    public final double getTime() {
        return this.time;
    }

    /* renamed from: component2, reason: from getter */
    public final int getLane() {
        return this.lane;
    }

    /* renamed from: component3, reason: from getter */
    public final double getDuration() {
        return this.duration;
    }

    public final Note copy(double time, int lane, double duration) {
        return new Note(time, lane, duration);
    }

    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Note)) {
            return false;
        }
        Note note = (Note) other;
        return Double.compare(this.time, note.time) == 0 && this.lane == note.lane && Double.compare(this.duration, note.duration) == 0;
    }

    public final double getDuration() {
        return this.duration;
    }

    public final boolean getHit() {
        return this.hit;
    }

    public final boolean getHoldDone() {
        return this.holdDone;
    }

    public final boolean getHolding() {
        return this.holding;
    }

    public final int getLane() {
        return this.lane;
    }

    public final boolean getMissed() {
        return this.missed;
    }

    public final double getTime() {
        return this.time;
    }

    public int hashCode() {
        return (((Double.hashCode(this.time) * 31) + Integer.hashCode(this.lane)) * 31) + Double.hashCode(this.duration);
    }

    public final void setHit(boolean z) {
        this.hit = z;
    }

    public final void setHoldDone(boolean z) {
        this.holdDone = z;
    }

    public final void setHolding(boolean z) {
        this.holding = z;
    }

    public final void setMissed(boolean z) {
        this.missed = z;
    }

    public String toString() {
        return "Note(time=" + this.time + ", lane=" + this.lane + ", duration=" + this.duration + ")";
    }
}
