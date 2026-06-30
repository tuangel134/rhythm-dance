package com.rhythmdance.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;
import java.util.Iterator;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;
import kotlin.text.StringsKt;

/* compiled from: VsManager.kt */
@Metadata(d1 = {"\u0000D\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0002\b\u0004\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u0002\n\u0002\b\b\n\u0002\u0018\u0002\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0002\b\b\u0018\u00002\u00020\u0001B\r\u0012\u0006\u0010\u0002\u001a\u00020\u0003¢\u0006\u0002\u0010\u0004J\u000e\u0010\"\u001a\u00020\u000b2\u0006\u0010#\u001a\u00020\u0006J\n\u0010$\u001a\u0004\u0018\u00010\u0006H\u0002J\u000e\u0010%\u001a\u00020\u00122\u0006\u0010&\u001a\u00020\u0006J\b\u0010'\u001a\u0004\u0018\u00010\u0006J\u0006\u0010(\u001a\u00020\u0012R\"\u0010\u0007\u001a\u0004\u0018\u00010\u00062\b\u0010\u0005\u001a\u0004\u0018\u00010\u0006@BX\u0086\u000e¢\u0006\b\n\u0000\u001a\u0004\b\b\u0010\tR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004¢\u0006\u0002\n\u0000R\u0011\u0010\n\u001a\u00020\u000b8F¢\u0006\u0006\u001a\u0004\b\n\u0010\fR\u000e\u0010\r\u001a\u00020\u000bX\u0082\u000e¢\u0006\u0002\n\u0000R\u000e\u0010\u000e\u001a\u00020\u000fX\u0082\u0004¢\u0006\u0002\n\u0000R(\u0010\u0010\u001a\u0010\u0012\u0004\u0012\u00020\u0006\u0012\u0004\u0012\u00020\u0012\u0018\u00010\u0011X\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0013\u0010\u0014\"\u0004\b\u0015\u0010\u0016R(\u0010\u0017\u001a\u0010\u0012\u0004\u0012\u00020\u0006\u0012\u0004\u0012\u00020\u0012\u0018\u00010\u0011X\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0018\u0010\u0014\"\u0004\b\u0019\u0010\u0016R\"\u0010\u001a\u001a\n\u0012\u0004\u0012\u00020\u0012\u0018\u00010\u001bX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u001c\u0010\u001d\"\u0004\b\u001e\u0010\u001fR\u000e\u0010 \u001a\u00020!X\u0082\u0004¢\u0006\u0002\n\u0000¨\u0006)"}, d2 = {"Lcom/rhythmdance/app/VsManager;", "", "context", "Landroid/content/Context;", "(Landroid/content/Context;)V", "<set-?>", "", "connectionUrl", "getConnectionUrl", "()Ljava/lang/String;", "isActive", "", "()Z", "isHost", "mainHandler", "Landroid/os/Handler;", "onGameMessage", "Lkotlin/Function1;", "", "getOnGameMessage", "()Lkotlin/jvm/functions/Function1;", "setOnGameMessage", "(Lkotlin/jvm/functions/Function1;)V", "onPeerConnected", "getOnPeerConnected", "setOnPeerConnected", "onPeerDisconnected", "Lkotlin/Function0;", "getOnPeerDisconnected", "()Lkotlin/jvm/functions/Function0;", "setOnPeerDisconnected", "(Lkotlin/jvm/functions/Function0;)V", "server", "Lcom/rhythmdance/app/VsWebSocketServer;", "connect", "url", "getLocalIpv4", "send", "message", "startHost", "stop", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class VsManager {
    private String connectionUrl;
    private final Context context;
    private boolean isHost;
    private final Handler mainHandler;
    private Function1<? super String, Unit> onGameMessage;
    private Function1<? super String, Unit> onPeerConnected;
    private Function0<Unit> onPeerDisconnected;
    private final VsWebSocketServer server;

    public VsManager(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        this.context = context;
        this.server = new VsWebSocketServer(8192);
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    private final String getLocalIpv4() {
        String hostAddress;
        try {
            Enumeration<NetworkInterface> networkInterfaces = NetworkInterface.getNetworkInterfaces();
            Intrinsics.checkNotNullExpressionValue(networkInterfaces, "getNetworkInterfaces(...)");
            Iterator it = CollectionsKt.iterator(networkInterfaces);
            while (it.hasNext()) {
                NetworkInterface networkInterface = (NetworkInterface) it.next();
                if (networkInterface.isUp() && !networkInterface.isLoopback()) {
                    Enumeration<InetAddress> inetAddresses = networkInterface.getInetAddresses();
                    Intrinsics.checkNotNullExpressionValue(inetAddresses, "getInetAddresses(...)");
                    Iterator it2 = CollectionsKt.iterator(inetAddresses);
                    while (it2.hasNext()) {
                        InetAddress inetAddress = (InetAddress) it2.next();
                        if ((inetAddress instanceof Inet4Address) && !((Inet4Address) inetAddress).isLoopbackAddress() && (hostAddress = ((Inet4Address) inetAddress).getHostAddress()) != null && !StringsKt.startsWith$default(hostAddress, "169.254.", false, 2, (Object) null)) {
                            return hostAddress;
                        }
                    }
                }
            }
        } catch (Exception e) {
        }
        return null;
    }

    public final boolean connect(String url) {
        Intrinsics.checkNotNullParameter(url, "url");
        this.connectionUrl = url;
        this.isHost = false;
        return true;
    }

    public final String getConnectionUrl() {
        return this.connectionUrl;
    }

    public final Function1<String, Unit> getOnGameMessage() {
        return this.onGameMessage;
    }

    public final Function1<String, Unit> getOnPeerConnected() {
        return this.onPeerConnected;
    }

    public final Function0<Unit> getOnPeerDisconnected() {
        return this.onPeerDisconnected;
    }

    public final boolean isActive() {
        return this.server.clientCount() > 0 || this.isHost;
    }

    public final void send(String message) {
        Intrinsics.checkNotNullParameter(message, "message");
        if (this.isHost) {
            VsWebSocketServer.broadcast$default(this.server, message, null, 2, null);
        }
    }

    public final void setOnGameMessage(Function1<? super String, Unit> function1) {
        this.onGameMessage = function1;
    }

    public final void setOnPeerConnected(Function1<? super String, Unit> function1) {
        this.onPeerConnected = function1;
    }

    public final void setOnPeerDisconnected(Function0<Unit> function0) {
        this.onPeerDisconnected = function0;
    }

    public final String startHost() {
        String localIpv4 = getLocalIpv4();
        this.server.setOnMessage(new VsManager$startHost$1(this));
        this.server.setOnConnect(new VsManager$startHost$2(this));
        this.server.setOnDisconnect(new VsManager$startHost$3(this));
        if (!this.server.start()) {
            return null;
        }
        this.isHost = true;
        if (localIpv4 == null) {
            this.server.stop();
            return null;
        }
        this.connectionUrl = "ws://" + localIpv4 + ":8192";
        return "ws://127.0.0.1:8192";
    }

    public final void stop() {
        this.server.stop();
        this.connectionUrl = null;
        this.isHost = false;
    }
}
