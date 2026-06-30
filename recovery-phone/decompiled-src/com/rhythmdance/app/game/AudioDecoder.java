package com.rhythmdance.app.game;

import android.content.Context;
import android.media.MediaCodec;
import android.media.MediaCrypto;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.view.Surface;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Map;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;

/* compiled from: AudioDecoder.kt */
@Metadata(d1 = {"\u0000>\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u0007\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\bÆ\u0002\u0018\u00002\u00020\u0001B\u0007\b\u0002¢\u0006\u0002\u0010\u0002J0\u0010\u0003\u001a\u00020\u00042\u0006\u0010\u0005\u001a\u00020\u00062\u0006\u0010\u0007\u001a\u00020\b2\u0016\u0010\t\u001a\u0012\u0012\u0004\u0012\u00020\u000b0\nj\b\u0012\u0004\u0012\u00020\u000b`\fH\u0002J\u0018\u0010\r\u001a\u0004\u0018\u00010\u000e2\u0006\u0010\u000f\u001a\u00020\u00102\u0006\u0010\u0011\u001a\u00020\u0012¨\u0006\u0013"}, d2 = {"Lcom/rhythmdance/app/game/AudioDecoder;", "", "()V", "appendPcm", "", "buf", "Ljava/nio/ByteBuffer;", "channels", "", "out", "Ljava/util/ArrayList;", "", "Lkotlin/collections/ArrayList;", "decode", "Lcom/rhythmdance/app/game/DecodedAudio;", "context", "Landroid/content/Context;", "uri", "Landroid/net/Uri;", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes3.dex */
public final class AudioDecoder {
    public static final AudioDecoder INSTANCE = new AudioDecoder();

    private AudioDecoder() {
    }

    private final void appendPcm(ByteBuffer buf, int channels, ArrayList<Float> out) {
        buf.order(ByteOrder.LITTLE_ENDIAN);
        int remaining = buf.asShortBuffer().remaining();
        int i = 0;
        if (channels <= 1) {
            while (i < remaining) {
                out.add(Float.valueOf(r0.get(i) / 32768.0f));
                i++;
            }
            return;
        }
        while ((i + channels) - 1 < remaining) {
            float f = 0.0f;
            for (int i2 = 0; i2 < channels; i2++) {
                f += r0.get(i + i2) / 32768.0f;
            }
            out.add(Float.valueOf(f / channels));
            i += channels;
        }
    }

    /* JADX WARN: Removed duplicated region for block: B:59:0x01b8 A[RETURN] */
    /* JADX WARN: Removed duplicated region for block: B:60:0x01ba  */
    /*
        Code decompiled incorrectly, please refer to instructions dump.
    */
    public final DecodedAudio decode(Context context, Uri uri) {
        int i;
        MediaFormat mediaFormat;
        int i2;
        DecodedAudio decodedAudio;
        Throwable th;
        MediaCodec mediaCodec;
        MediaCodec.BufferInfo bufferInfo;
        ArrayList<Float> arrayList;
        MediaCodec mediaCodec2;
        int i3;
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(uri, "uri");
        MediaExtractor mediaExtractor = new MediaExtractor();
        try {
            mediaExtractor.setDataSource(context, uri, (Map<String, String>) null);
        } catch (Exception e) {
            try {
                mediaExtractor.setDataSource(uri.toString());
            } catch (Exception e2) {
                return null;
            }
        }
        int i4 = 0;
        int trackCount = mediaExtractor.getTrackCount();
        while (true) {
            i = 0;
            if (i4 >= trackCount) {
                mediaFormat = null;
                i2 = -1;
                break;
            }
            MediaFormat trackFormat = mediaExtractor.getTrackFormat(i4);
            Intrinsics.checkNotNullExpressionValue(trackFormat, "getTrackFormat(...)");
            String string = trackFormat.getString("mime");
            if (string == null) {
                string = "";
            }
            if (StringsKt.startsWith$default(string, "audio/", false, 2, (Object) null)) {
                int i5 = i4;
                mediaFormat = trackFormat;
                i2 = i5;
                break;
            }
            i4++;
        }
        if (i2 < 0) {
            decodedAudio = null;
        } else {
            if (mediaFormat != null) {
                mediaExtractor.selectTrack(i2);
                String string2 = mediaFormat.getString("mime");
                Intrinsics.checkNotNull(string2);
                int integer = mediaFormat.getInteger("sample-rate");
                int integer2 = mediaFormat.containsKey("channel-count") ? mediaFormat.getInteger("channel-count") : 1;
                try {
                    MediaCodec createDecoderByType = MediaCodec.createDecoderByType(string2);
                    Intrinsics.checkNotNull(createDecoderByType);
                    MediaCodec mediaCodec3 = createDecoderByType;
                    mediaCodec3.configure(mediaFormat, (Surface) null, (MediaCrypto) null, 0);
                    mediaCodec3.start();
                    ArrayList<Float> arrayList2 = new ArrayList<>(integer * 60);
                    MediaCodec.BufferInfo bufferInfo2 = new MediaCodec.BufferInfo();
                    boolean z = false;
                    boolean z2 = false;
                    while (!z2) {
                        if (z) {
                            bufferInfo = bufferInfo2;
                            arrayList = arrayList2;
                            mediaCodec2 = mediaCodec3;
                        } else {
                            try {
                                int dequeueInputBuffer = mediaCodec3.dequeueInputBuffer(10000L);
                                if (dequeueInputBuffer >= 0) {
                                    ByteBuffer inputBuffer = mediaCodec3.getInputBuffer(dequeueInputBuffer);
                                    Intrinsics.checkNotNull(inputBuffer);
                                    int readSampleData = mediaExtractor.readSampleData(inputBuffer, i);
                                    if (readSampleData < 0) {
                                        bufferInfo = bufferInfo2;
                                        arrayList = arrayList2;
                                        mediaCodec2 = mediaCodec3;
                                        try {
                                            mediaCodec3.queueInputBuffer(dequeueInputBuffer, 0, 0, 0L, 4);
                                            z = true;
                                        } catch (Exception e3) {
                                            mediaCodec = mediaCodec2;
                                            arrayList2 = arrayList;
                                            try {
                                                mediaCodec.stop();
                                            } catch (Exception e4) {
                                            }
                                            try {
                                                mediaCodec.release();
                                            } catch (Exception e5) {
                                            }
                                            mediaExtractor.release();
                                            if (arrayList2.isEmpty()) {
                                            }
                                        } catch (Throwable th2) {
                                            th = th2;
                                            mediaCodec = mediaCodec2;
                                            try {
                                                mediaCodec.stop();
                                            } catch (Exception e6) {
                                            }
                                            try {
                                                mediaCodec.release();
                                            } catch (Exception e7) {
                                            }
                                            mediaExtractor.release();
                                            throw th;
                                        }
                                    } else {
                                        bufferInfo = bufferInfo2;
                                        arrayList = arrayList2;
                                        mediaCodec2 = mediaCodec3;
                                        mediaCodec2.queueInputBuffer(dequeueInputBuffer, 0, readSampleData, mediaExtractor.getSampleTime(), 0);
                                        mediaExtractor.advance();
                                    }
                                } else {
                                    bufferInfo = bufferInfo2;
                                    arrayList = arrayList2;
                                    mediaCodec2 = mediaCodec3;
                                }
                            } catch (Exception e8) {
                                mediaCodec = mediaCodec3;
                            } catch (Throwable th3) {
                                th = th3;
                                mediaCodec = mediaCodec3;
                            }
                        }
                        mediaCodec = mediaCodec2;
                        try {
                            int dequeueOutputBuffer = mediaCodec.dequeueOutputBuffer(bufferInfo, 10000L);
                            if (dequeueOutputBuffer >= 0) {
                                if (bufferInfo.size > 0) {
                                    ByteBuffer outputBuffer = mediaCodec.getOutputBuffer(dequeueOutputBuffer);
                                    Intrinsics.checkNotNull(outputBuffer);
                                    outputBuffer.position(bufferInfo.offset);
                                    outputBuffer.limit(bufferInfo.offset + bufferInfo.size);
                                    arrayList2 = arrayList;
                                    try {
                                        appendPcm(outputBuffer, integer2, arrayList2);
                                    } catch (Exception e9) {
                                        mediaCodec.stop();
                                        mediaCodec.release();
                                        mediaExtractor.release();
                                        if (arrayList2.isEmpty()) {
                                        }
                                    } catch (Throwable th4) {
                                        th = th4;
                                        mediaCodec.stop();
                                        mediaCodec.release();
                                        mediaExtractor.release();
                                        throw th;
                                    }
                                } else {
                                    arrayList2 = arrayList;
                                }
                                i3 = 0;
                                mediaCodec.releaseOutputBuffer(dequeueOutputBuffer, false);
                                if ((bufferInfo.flags & 4) != 0) {
                                    z2 = true;
                                    bufferInfo2 = bufferInfo;
                                    mediaCodec3 = mediaCodec;
                                    i = 0;
                                }
                            } else {
                                i3 = 0;
                                arrayList2 = arrayList;
                            }
                            bufferInfo2 = bufferInfo;
                            mediaCodec3 = mediaCodec;
                            i = i3;
                        } catch (Exception e10) {
                            arrayList2 = arrayList;
                        } catch (Throwable th5) {
                            th = th5;
                        }
                    }
                    MediaCodec mediaCodec4 = mediaCodec3;
                    try {
                        mediaCodec4.stop();
                    } catch (Exception e11) {
                    }
                    try {
                        mediaCodec4.release();
                    } catch (Exception e12) {
                    }
                    mediaExtractor.release();
                    if (arrayList2.isEmpty()) {
                        return null;
                    }
                    float[] fArr = new float[arrayList2.size()];
                    int size = arrayList2.size();
                    for (int i6 = 0; i6 < size; i6++) {
                        Float f = arrayList2.get(i6);
                        Intrinsics.checkNotNullExpressionValue(f, "get(...)");
                        fArr[i6] = f.floatValue();
                    }
                    return new DecodedAudio(fArr, integer);
                } catch (Exception e13) {
                    mediaExtractor.release();
                    return null;
                }
            }
            decodedAudio = null;
        }
        mediaExtractor.release();
        return decodedAudio;
    }
}
