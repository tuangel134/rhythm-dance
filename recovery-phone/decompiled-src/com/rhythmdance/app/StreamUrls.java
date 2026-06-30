package com.rhythmdance.app;

import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

/* compiled from: GameWebViewActivity.kt */
@Metadata(d1 = {"\u0000\"\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u000f\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\b\u0086\b\u0018\u00002\u00020\u0001B-\u0012\b\u0010\u0002\u001a\u0004\u0018\u00010\u0003\u0012\b\u0010\u0004\u001a\u0004\u0018\u00010\u0003\u0012\b\u0010\u0005\u001a\u0004\u0018\u00010\u0003\u0012\b\u0010\u0006\u001a\u0004\u0018\u00010\u0003¢\u0006\u0002\u0010\u0007J\u000b\u0010\r\u001a\u0004\u0018\u00010\u0003HÆ\u0003J\u000b\u0010\u000e\u001a\u0004\u0018\u00010\u0003HÆ\u0003J\u000b\u0010\u000f\u001a\u0004\u0018\u00010\u0003HÆ\u0003J\u000b\u0010\u0010\u001a\u0004\u0018\u00010\u0003HÆ\u0003J9\u0010\u0011\u001a\u00020\u00002\n\b\u0002\u0010\u0002\u001a\u0004\u0018\u00010\u00032\n\b\u0002\u0010\u0004\u001a\u0004\u0018\u00010\u00032\n\b\u0002\u0010\u0005\u001a\u0004\u0018\u00010\u00032\n\b\u0002\u0010\u0006\u001a\u0004\u0018\u00010\u0003HÆ\u0001J\u0013\u0010\u0012\u001a\u00020\u00132\b\u0010\u0014\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u0015\u001a\u00020\u0016HÖ\u0001J\t\u0010\u0017\u001a\u00020\u0003HÖ\u0001R\u0013\u0010\u0004\u001a\u0004\u0018\u00010\u0003¢\u0006\b\n\u0000\u001a\u0004\b\b\u0010\tR\u0013\u0010\u0006\u001a\u0004\u0018\u00010\u0003¢\u0006\b\n\u0000\u001a\u0004\b\n\u0010\tR\u0013\u0010\u0002\u001a\u0004\u0018\u00010\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\tR\u0013\u0010\u0005\u001a\u0004\u0018\u00010\u0003¢\u0006\b\n\u0000\u001a\u0004\b\f\u0010\t¨\u0006\u0018"}, d2 = {"Lcom/rhythmdance/app/StreamUrls;", "", "title", "", "audioUrl", "videoUrl", "error", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V", "getAudioUrl", "()Ljava/lang/String;", "getError", "getTitle", "getVideoUrl", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "", "toString", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final /* data */ class StreamUrls {
    private final String audioUrl;
    private final String error;
    private final String title;
    private final String videoUrl;

    public StreamUrls(String str, String str2, String str3, String str4) {
        this.title = str;
        this.audioUrl = str2;
        this.videoUrl = str3;
        this.error = str4;
    }

    public static /* synthetic */ StreamUrls copy$default(StreamUrls streamUrls, String str, String str2, String str3, String str4, int i, Object obj) {
        if ((i & 1) != 0) {
            str = streamUrls.title;
        }
        if ((i & 2) != 0) {
            str2 = streamUrls.audioUrl;
        }
        if ((i & 4) != 0) {
            str3 = streamUrls.videoUrl;
        }
        if ((i & 8) != 0) {
            str4 = streamUrls.error;
        }
        return streamUrls.copy(str, str2, str3, str4);
    }

    /* renamed from: component1, reason: from getter */
    public final String getTitle() {
        return this.title;
    }

    /* renamed from: component2, reason: from getter */
    public final String getAudioUrl() {
        return this.audioUrl;
    }

    /* renamed from: component3, reason: from getter */
    public final String getVideoUrl() {
        return this.videoUrl;
    }

    /* renamed from: component4, reason: from getter */
    public final String getError() {
        return this.error;
    }

    public final StreamUrls copy(String title, String audioUrl, String videoUrl, String error) {
        return new StreamUrls(title, audioUrl, videoUrl, error);
    }

    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof StreamUrls)) {
            return false;
        }
        StreamUrls streamUrls = (StreamUrls) other;
        return Intrinsics.areEqual(this.title, streamUrls.title) && Intrinsics.areEqual(this.audioUrl, streamUrls.audioUrl) && Intrinsics.areEqual(this.videoUrl, streamUrls.videoUrl) && Intrinsics.areEqual(this.error, streamUrls.error);
    }

    public final String getAudioUrl() {
        return this.audioUrl;
    }

    public final String getError() {
        return this.error;
    }

    public final String getTitle() {
        return this.title;
    }

    public final String getVideoUrl() {
        return this.videoUrl;
    }

    public int hashCode() {
        return ((((((this.title == null ? 0 : this.title.hashCode()) * 31) + (this.audioUrl == null ? 0 : this.audioUrl.hashCode())) * 31) + (this.videoUrl == null ? 0 : this.videoUrl.hashCode())) * 31) + (this.error != null ? this.error.hashCode() : 0);
    }

    public String toString() {
        return "StreamUrls(title=" + this.title + ", audioUrl=" + this.audioUrl + ", videoUrl=" + this.videoUrl + ", error=" + this.error + ")";
    }
}
