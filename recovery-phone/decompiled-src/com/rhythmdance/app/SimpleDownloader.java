package com.rhythmdance.app;

import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.io.TextStreamsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.Charsets;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.stream.Stream;

/* compiled from: SimpleDownloader.kt */
@Metadata(d1 = {"\u0000\u0018\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\u0018\u00002\u00020\u0001B\u0005¢\u0006\u0002\u0010\u0002J\u0010\u0010\u0003\u001a\u00020\u00042\u0006\u0010\u0005\u001a\u00020\u0006H\u0016¨\u0006\u0007"}, d2 = {"Lcom/rhythmdance/app/SimpleDownloader;", "Lorg/schabi/newpipe/extractor/downloader/Downloader;", "()V", "execute", "Lorg/schabi/newpipe/extractor/downloader/Response;", "request", "Lorg/schabi/newpipe/extractor/downloader/Request;", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class SimpleDownloader extends Downloader {
    /* JADX WARN: Code restructure failed: missing block: B:51:0x0150, code lost:
    
        if (r6 == null) goto L38;
     */
    @Override // org.schabi.newpipe.extractor.downloader.Downloader
    /*
        Code decompiled incorrectly, please refer to instructions dump.
    */
    public Response execute(Request request) {
        int i;
        String str;
        String str2;
        Intrinsics.checkNotNullParameter(request, "request");
        String url = request.url();
        String httpMethod = request.httpMethod();
        byte[] dataToSend = request.dataToSend();
        Log.e("RhythmDance", "Downloader: " + httpMethod + Stream.ID_UNKNOWN + url + " (body=" + (dataToSend != null ? dataToSend.length : 0) + "b)");
        URLConnection openConnection = new URL(url).openConnection();
        Intrinsics.checkNotNull(openConnection, "null cannot be cast to non-null type java.net.HttpURLConnection");
        HttpURLConnection httpURLConnection = (HttpURLConnection) openConnection;
        httpURLConnection.setRequestMethod(httpMethod);
        Map<String, List<String>> headers = request.headers();
        Intrinsics.checkNotNullExpressionValue(headers, "headers(...)");
        for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
            String key = entry.getKey();
            List<String> value = entry.getValue();
            Intrinsics.checkNotNull(value);
            httpURLConnection.setRequestProperty(key, CollectionsKt.joinToString$default(value, "; ", null, null, 0, null, null, 62, null));
        }
        httpURLConnection.setInstanceFollowRedirects(true);
        httpURLConnection.setConnectTimeout(15000);
        httpURLConnection.setReadTimeout(30000);
        if (dataToSend != null) {
            if (!(dataToSend.length == 0)) {
                httpURLConnection.setDoOutput(true);
                httpURLConnection.getOutputStream().write(dataToSend);
                httpURLConnection.getOutputStream().flush();
            }
        }
        try {
            i = httpURLConnection.getResponseCode();
        } catch (Exception e) {
            i = -1;
        }
        int i2 = i;
        Log.e("RhythmDance", "Downloader: HTTP " + i2 + ", len=" + httpURLConnection.getContentLength());
        try {
            InputStream inputStream = httpURLConnection.getInputStream();
            Intrinsics.checkNotNullExpressionValue(inputStream, "getInputStream(...)");
            Reader inputStreamReader = new InputStreamReader(inputStream, Charsets.UTF_8);
            str2 = TextStreamsKt.readText(inputStreamReader instanceof BufferedReader ? (BufferedReader) inputStreamReader : new BufferedReader(inputStreamReader, 8192));
        } catch (Exception e2) {
            InputStream errorStream = httpURLConnection.getErrorStream();
            if (errorStream != null) {
                Reader inputStreamReader2 = new InputStreamReader(errorStream, Charsets.UTF_8);
                str = TextStreamsKt.readText(inputStreamReader2 instanceof BufferedReader ? (BufferedReader) inputStreamReader2 : new BufferedReader(inputStreamReader2, 8192));
            }
            str = "";
            str2 = str;
        }
        LinkedHashMap linkedHashMap = new LinkedHashMap();
        Map<String, List<String>> headerFields = httpURLConnection.getHeaderFields();
        if (headerFields != null) {
            for (Map.Entry<String, List<String>> entry2 : headerFields.entrySet()) {
                String key2 = entry2.getKey();
                List<String> value2 = entry2.getValue();
                if (key2 != null) {
                    Intrinsics.checkNotNull(value2);
                    linkedHashMap.put(key2, value2);
                }
            }
        }
        httpURLConnection.disconnect();
        return new Response(i2, "", linkedHashMap, str2, null);
    }
}
