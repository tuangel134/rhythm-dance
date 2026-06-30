package com.rhythmdance.app;

import android.util.Base64;
import com.rhythmdance.app.VsWebSocketServer;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.concurrent.ThreadsKt;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.functions.Function2;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.jvm.internal.Ref;
import kotlin.text.Charsets;
import kotlin.text.StringsKt;
import org.schabi.newpipe.extractor.services.peertube.PeertubeParsingHelper;

/* compiled from: VsWebSocketServer.kt */
@Metadata(d1 = {"\u0000`\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\b\n\u0002\b\u0002\n\u0002\u0010!\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0002\b\b\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0006\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u000b\u0018\u00002\u00020\u0001:\u00016B\u000f\u0012\b\b\u0002\u0010\u0002\u001a\u00020\u0003¢\u0006\u0002\u0010\u0004J\b\u0010!\u001a\u00020\u000eH\u0002J\u001a\u0010\"\u001a\u00020\u000e2\u0006\u0010\u0018\u001a\u00020\n2\n\b\u0002\u0010#\u001a\u0004\u0018\u00010\nJ\u0006\u0010$\u001a\u00020\u0003J\u0010\u0010%\u001a\u00020\u000e2\u0006\u0010&\u001a\u00020'H\u0002J\u0012\u0010(\u001a\u0004\u0018\u00010)2\u0006\u0010\r\u001a\u00020\nH\u0002J\u0018\u0010*\u001a\u00020\u001e2\u0006\u0010+\u001a\u00020,2\u0006\u0010-\u001a\u00020)H\u0002J\u0018\u0010.\u001a\u00020\u000e2\u0006\u0010\r\u001a\u00020\n2\u0006\u0010+\u001a\u00020,H\u0002J\u0012\u0010/\u001a\u0004\u0018\u00010\n2\u0006\u0010+\u001a\u00020,H\u0002J\u0018\u00100\u001a\u00020\u000e2\u0006\u0010-\u001a\u00020)2\u0006\u00101\u001a\u00020\nH\u0002J\u0010\u00102\u001a\u00020\u000e2\u0006\u0010-\u001a\u00020)H\u0002J\u0016\u00103\u001a\u00020\u000e2\u0006\u0010\r\u001a\u00020\n2\u0006\u0010\u0018\u001a\u00020\nJ\u0006\u00104\u001a\u00020\u001eJ\u0006\u00105\u001a\u00020\u000eR\u0014\u0010\u0005\u001a\b\u0012\u0004\u0012\u00020\u00070\u0006X\u0082\u0004¢\u0006\u0002\n\u0000R7\u0010\b\u001a\u001f\u0012\u0013\u0012\u00110\n¢\u0006\f\b\u000b\u0012\b\b\f\u0012\u0004\b\b(\r\u0012\u0004\u0012\u00020\u000e\u0018\u00010\tX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u000f\u0010\u0010\"\u0004\b\u0011\u0010\u0012R7\u0010\u0013\u001a\u001f\u0012\u0013\u0012\u00110\n¢\u0006\f\b\u000b\u0012\b\b\f\u0012\u0004\b\b(\r\u0012\u0004\u0012\u00020\u000e\u0018\u00010\tX\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0014\u0010\u0010\"\u0004\b\u0015\u0010\u0012RL\u0010\u0016\u001a4\u0012\u0013\u0012\u00110\n¢\u0006\f\b\u000b\u0012\b\b\f\u0012\u0004\b\b(\r\u0012\u0013\u0012\u00110\n¢\u0006\f\b\u000b\u0012\b\b\f\u0012\u0004\b\b(\u0018\u0012\u0004\u0012\u00020\u000e\u0018\u00010\u0017X\u0086\u000e¢\u0006\u000e\n\u0000\u001a\u0004\b\u0019\u0010\u001a\"\u0004\b\u001b\u0010\u001cR\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004¢\u0006\u0002\n\u0000R\u000e\u0010\u001d\u001a\u00020\u001eX\u0082\u000e¢\u0006\u0002\n\u0000R\u0010\u0010\u001f\u001a\u0004\u0018\u00010 X\u0082\u000e¢\u0006\u0002\n\u0000¨\u00067"}, d2 = {"Lcom/rhythmdance/app/VsWebSocketServer;", "", "port", "", "(I)V", "clients", "", "Lcom/rhythmdance/app/VsWebSocketServer$WsClient;", "onConnect", "Lkotlin/Function1;", "", "Lkotlin/ParameterName;", "name", "clientId", "", "getOnConnect", "()Lkotlin/jvm/functions/Function1;", "setOnConnect", "(Lkotlin/jvm/functions/Function1;)V", "onDisconnect", "getOnDisconnect", "setOnDisconnect", "onMessage", "Lkotlin/Function2;", "message", "getOnMessage", "()Lkotlin/jvm/functions/Function2;", "setOnMessage", "(Lkotlin/jvm/functions/Function2;)V", "running", "", "serverSocket", "Ljava/net/ServerSocket;", "acceptLoop", "broadcast", "excludeId", "clientCount", "handleClient", "socket", "Ljava/net/Socket;", "outputFromId", "Ljava/io/OutputStream;", "performHandshake", "input", "Ljava/io/InputStream;", "output", "readFrames", "readLineRaw", "sendFrame", "text", "sendPong", "sendTo", PeertubeParsingHelper.START_KEY, "stop", "WsClient", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
/* loaded from: classes4.dex */
public final class VsWebSocketServer {
    private final List<WsClient> clients;
    private Function1<? super String, Unit> onConnect;
    private Function1<? super String, Unit> onDisconnect;
    private Function2<? super String, ? super String, Unit> onMessage;
    private final int port;
    private boolean running;
    private ServerSocket serverSocket;

    /* compiled from: VsWebSocketServer.kt */
    @Metadata(d1 = {"\u00004\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u000f\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0010\b\n\u0002\b\u0002\b\u0086\b\u0018\u00002\u00020\u0001B%\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u0012\u0006\u0010\u0004\u001a\u00020\u0005\u0012\u0006\u0010\u0006\u001a\u00020\u0007\u0012\u0006\u0010\b\u001a\u00020\t¢\u0006\u0002\u0010\nJ\t\u0010\u0013\u001a\u00020\u0003HÆ\u0003J\t\u0010\u0014\u001a\u00020\u0005HÆ\u0003J\t\u0010\u0015\u001a\u00020\u0007HÆ\u0003J\t\u0010\u0016\u001a\u00020\tHÆ\u0003J1\u0010\u0017\u001a\u00020\u00002\b\b\u0002\u0010\u0002\u001a\u00020\u00032\b\b\u0002\u0010\u0004\u001a\u00020\u00052\b\b\u0002\u0010\u0006\u001a\u00020\u00072\b\b\u0002\u0010\b\u001a\u00020\tHÆ\u0001J\u0013\u0010\u0018\u001a\u00020\u00192\b\u0010\u001a\u001a\u0004\u0018\u00010\u0001HÖ\u0003J\t\u0010\u001b\u001a\u00020\u001cHÖ\u0001J\t\u0010\u001d\u001a\u00020\u0003HÖ\u0001R\u0011\u0010\u0002\u001a\u00020\u0003¢\u0006\b\n\u0000\u001a\u0004\b\u000b\u0010\fR\u0011\u0010\u0006\u001a\u00020\u0007¢\u0006\b\n\u0000\u001a\u0004\b\r\u0010\u000eR\u0011\u0010\b\u001a\u00020\t¢\u0006\b\n\u0000\u001a\u0004\b\u000f\u0010\u0010R\u0011\u0010\u0004\u001a\u00020\u0005¢\u0006\b\n\u0000\u001a\u0004\b\u0011\u0010\u0012¨\u0006\u001e"}, d2 = {"Lcom/rhythmdance/app/VsWebSocketServer$WsClient;", "", "id", "", "socket", "Ljava/net/Socket;", "input", "Ljava/io/InputStream;", "output", "Ljava/io/OutputStream;", "(Ljava/lang/String;Ljava/net/Socket;Ljava/io/InputStream;Ljava/io/OutputStream;)V", "getId", "()Ljava/lang/String;", "getInput", "()Ljava/io/InputStream;", "getOutput", "()Ljava/io/OutputStream;", "getSocket", "()Ljava/net/Socket;", "component1", "component2", "component3", "component4", "copy", "equals", "", "other", "hashCode", "", "toString", "app_debug"}, k = 1, mv = {1, 9, 0}, xi = 48)
    public static final /* data */ class WsClient {
        private final String id;
        private final InputStream input;
        private final OutputStream output;
        private final Socket socket;

        public WsClient(String id, Socket socket, InputStream input, OutputStream output) {
            Intrinsics.checkNotNullParameter(id, "id");
            Intrinsics.checkNotNullParameter(socket, "socket");
            Intrinsics.checkNotNullParameter(input, "input");
            Intrinsics.checkNotNullParameter(output, "output");
            this.id = id;
            this.socket = socket;
            this.input = input;
            this.output = output;
        }

        public static /* synthetic */ WsClient copy$default(WsClient wsClient, String str, Socket socket, InputStream inputStream, OutputStream outputStream, int i, Object obj) {
            if ((i & 1) != 0) {
                str = wsClient.id;
            }
            if ((i & 2) != 0) {
                socket = wsClient.socket;
            }
            if ((i & 4) != 0) {
                inputStream = wsClient.input;
            }
            if ((i & 8) != 0) {
                outputStream = wsClient.output;
            }
            return wsClient.copy(str, socket, inputStream, outputStream);
        }

        /* renamed from: component1, reason: from getter */
        public final String getId() {
            return this.id;
        }

        /* renamed from: component2, reason: from getter */
        public final Socket getSocket() {
            return this.socket;
        }

        /* renamed from: component3, reason: from getter */
        public final InputStream getInput() {
            return this.input;
        }

        /* renamed from: component4, reason: from getter */
        public final OutputStream getOutput() {
            return this.output;
        }

        public final WsClient copy(String id, Socket socket, InputStream input, OutputStream output) {
            Intrinsics.checkNotNullParameter(id, "id");
            Intrinsics.checkNotNullParameter(socket, "socket");
            Intrinsics.checkNotNullParameter(input, "input");
            Intrinsics.checkNotNullParameter(output, "output");
            return new WsClient(id, socket, input, output);
        }

        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof WsClient)) {
                return false;
            }
            WsClient wsClient = (WsClient) other;
            return Intrinsics.areEqual(this.id, wsClient.id) && Intrinsics.areEqual(this.socket, wsClient.socket) && Intrinsics.areEqual(this.input, wsClient.input) && Intrinsics.areEqual(this.output, wsClient.output);
        }

        public final String getId() {
            return this.id;
        }

        public final InputStream getInput() {
            return this.input;
        }

        public final OutputStream getOutput() {
            return this.output;
        }

        public final Socket getSocket() {
            return this.socket;
        }

        public int hashCode() {
            return (((((this.id.hashCode() * 31) + this.socket.hashCode()) * 31) + this.input.hashCode()) * 31) + this.output.hashCode();
        }

        public String toString() {
            return "WsClient(id=" + this.id + ", socket=" + this.socket + ", input=" + this.input + ", output=" + this.output + ")";
        }
    }

    public VsWebSocketServer() {
        this(0, 1, null);
    }

    public VsWebSocketServer(int i) {
        this.port = i;
        this.clients = new ArrayList();
    }

    public /* synthetic */ VsWebSocketServer(int i, int i2, DefaultConstructorMarker defaultConstructorMarker) {
        this((i2 & 1) != 0 ? 8192 : i);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void acceptLoop() {
        ServerSocket serverSocket;
        while (this.running) {
            try {
                serverSocket = this.serverSocket;
            } catch (Exception e) {
                if (!this.running) {
                    return;
                } else {
                    Thread.sleep(100L);
                }
            }
            if (serverSocket == null || serverSocket.isClosed()) {
                return;
            }
            final Socket accept = serverSocket.accept();
            ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : true, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : "ws-client", (r12 & 16) != 0 ? -1 : 0, new Function0<Unit>() { // from class: com.rhythmdance.app.VsWebSocketServer$acceptLoop$1
                /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
                {
                    super(0);
                }

                @Override // kotlin.jvm.functions.Function0
                public /* bridge */ /* synthetic */ Unit invoke() {
                    invoke2();
                    return Unit.INSTANCE;
                }

                /* renamed from: invoke, reason: avoid collision after fix types in other method */
                public final void invoke2() {
                    VsWebSocketServer vsWebSocketServer = VsWebSocketServer.this;
                    Socket socket = accept;
                    Intrinsics.checkNotNullExpressionValue(socket, "$socket");
                    vsWebSocketServer.handleClient(socket);
                }
            });
        }
    }

    public static /* synthetic */ void broadcast$default(VsWebSocketServer vsWebSocketServer, String str, String str2, int i, Object obj) {
        if ((i & 2) != 0) {
            str2 = null;
        }
        vsWebSocketServer.broadcast(str, str2);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public final void handleClient(Socket socket) {
        try {
            InputStream inputStream = socket.getInputStream();
            Intrinsics.checkNotNullExpressionValue(inputStream, "getInputStream(...)");
            OutputStream outputStream = socket.getOutputStream();
            Intrinsics.checkNotNullExpressionValue(outputStream, "getOutputStream(...)");
            if (!performHandshake(inputStream, outputStream)) {
                socket.close();
                return;
            }
            String uuid = UUID.randomUUID().toString();
            Intrinsics.checkNotNullExpressionValue(uuid, "toString(...)");
            final String take = StringsKt.take(uuid, 8);
            WsClient wsClient = new WsClient(take, socket, inputStream, outputStream);
            synchronized (this.clients) {
                this.clients.add(wsClient);
            }
            try {
                Function1<? super String, Unit> function1 = this.onConnect;
                if (function1 != null) {
                    function1.invoke(take);
                }
                readFrames(take, inputStream);
                synchronized (this.clients) {
                    CollectionsKt.removeAll((List) this.clients, (Function1) new Function1<WsClient, Boolean>() { // from class: com.rhythmdance.app.VsWebSocketServer$handleClient$2$1
                        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
                        {
                            super(1);
                        }

                        @Override // kotlin.jvm.functions.Function1
                        public final Boolean invoke(VsWebSocketServer.WsClient it) {
                            Intrinsics.checkNotNullParameter(it, "it");
                            return Boolean.valueOf(Intrinsics.areEqual(it.getId(), take));
                        }
                    });
                }
                Function1<? super String, Unit> function12 = this.onDisconnect;
                if (function12 != null) {
                    function12.invoke(take);
                }
                try {
                    socket.close();
                } catch (Exception e) {
                }
            } catch (Throwable th) {
                synchronized (this.clients) {
                    CollectionsKt.removeAll((List) this.clients, (Function1) new Function1<WsClient, Boolean>() { // from class: com.rhythmdance.app.VsWebSocketServer$handleClient$2$1
                        /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
                        {
                            super(1);
                        }

                        @Override // kotlin.jvm.functions.Function1
                        public final Boolean invoke(VsWebSocketServer.WsClient it) {
                            Intrinsics.checkNotNullParameter(it, "it");
                            return Boolean.valueOf(Intrinsics.areEqual(it.getId(), take));
                        }
                    });
                    Function1<? super String, Unit> function13 = this.onDisconnect;
                    if (function13 != null) {
                        function13.invoke(take);
                    }
                    try {
                        socket.close();
                    } catch (Exception e2) {
                    }
                    throw th;
                }
            }
        } catch (Exception e3) {
            try {
                socket.close();
            } catch (Exception e4) {
            }
        }
    }

    private final OutputStream outputFromId(String clientId) {
        Object obj;
        OutputStream output;
        synchronized (this.clients) {
            Iterator<T> it = this.clients.iterator();
            while (true) {
                if (!it.hasNext()) {
                    obj = null;
                    break;
                }
                obj = it.next();
                if (Intrinsics.areEqual(((WsClient) obj).getId(), clientId)) {
                    break;
                }
            }
            WsClient wsClient = (WsClient) obj;
            output = wsClient != null ? wsClient.getOutput() : null;
        }
        return output;
    }

    private final boolean performHandshake(InputStream input, OutputStream output) {
        String readLineRaw = readLineRaw(input);
        if (readLineRaw == null || !StringsKt.startsWith$default(readLineRaw, "GET ", false, 2, (Object) null)) {
            return false;
        }
        String str = "";
        String readLineRaw2 = readLineRaw(input);
        while (readLineRaw2 != null && (!StringsKt.isBlank(readLineRaw2))) {
            if (StringsKt.startsWith(readLineRaw2, "Sec-WebSocket-Key:", true)) {
                str = StringsKt.trim((CharSequence) StringsKt.substringAfter$default(readLineRaw2, ":", (String) null, 2, (Object) null)).toString();
            }
            readLineRaw2 = readLineRaw(input);
        }
        if (str.length() == 0) {
            return false;
        }
        MessageDigest messageDigest = MessageDigest.getInstance("SHA-1");
        byte[] bytes = (str + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(Charsets.UTF_8);
        Intrinsics.checkNotNullExpressionValue(bytes, "getBytes(...)");
        String encodeToString = Base64.encodeToString(messageDigest.digest(bytes), 2);
        byte[] bytes2 = "HTTP/1.1 101 Switching Protocols\r\n".getBytes(Charsets.UTF_8);
        Intrinsics.checkNotNullExpressionValue(bytes2, "getBytes(...)");
        output.write(bytes2);
        byte[] bytes3 = "Upgrade: websocket\r\n".getBytes(Charsets.UTF_8);
        Intrinsics.checkNotNullExpressionValue(bytes3, "getBytes(...)");
        output.write(bytes3);
        byte[] bytes4 = "Connection: Upgrade\r\n".getBytes(Charsets.UTF_8);
        Intrinsics.checkNotNullExpressionValue(bytes4, "getBytes(...)");
        output.write(bytes4);
        byte[] bytes5 = ("Sec-WebSocket-Accept: " + encodeToString + "\r\n").getBytes(Charsets.UTF_8);
        Intrinsics.checkNotNullExpressionValue(bytes5, "getBytes(...)");
        output.write(bytes5);
        byte[] bytes6 = "\r\n".getBytes(Charsets.UTF_8);
        Intrinsics.checkNotNullExpressionValue(bytes6, "getBytes(...)");
        output.write(bytes6);
        output.flush();
        return true;
    }

    private final void readFrames(String clientId, InputStream input) {
        byte[] bArr;
        int read;
        while (this.running) {
            try {
                int read2 = input.read();
                if (read2 < 0) {
                    return;
                }
                int i = read2 & 15;
                int read3 = input.read();
                if (read3 < 0) {
                    return;
                }
                boolean z = (read3 & 128) != 0;
                long j = read3 & 127;
                if (j == 126) {
                    int read4 = input.read();
                    int read5 = input.read();
                    if (read4 >= 0 && read5 >= 0) {
                        j = (read4 << 8) | read5;
                    }
                    return;
                }
                if (j == 127) {
                    j = 0;
                    boolean z2 = true;
                    int i2 = 0;
                    while (true) {
                        if (i2 < 8) {
                            int read6 = input.read();
                            if (read6 < 0) {
                                z2 = false;
                            } else {
                                j = (j << 8) | (read6 & 255);
                                i2++;
                            }
                        }
                    }
                    if (!z2) {
                        return;
                    }
                }
                if (z) {
                    bArr = new byte[4];
                    if (input.read(bArr) < 4) {
                        return;
                    }
                } else {
                    bArr = null;
                }
                byte[] bArr2 = bArr;
                if (i == 8) {
                    return;
                }
                if (i == 9) {
                    OutputStream outputFromId = outputFromId(clientId);
                    if (outputFromId != null) {
                        sendPong(outputFromId);
                    }
                } else if (i != 10) {
                    switch (i) {
                        case 1:
                        case 2:
                            byte[] bArr3 = new byte[(int) j];
                            int i3 = 0;
                            while (i3 < j && (read = input.read(bArr3, i3, ((int) j) - i3)) >= 0) {
                                i3 += read;
                            }
                            if (bArr2 != null) {
                                int length = bArr3.length;
                                for (int i4 = 0; i4 < length; i4++) {
                                    bArr3[i4] = (byte) (bArr3[i4] ^ bArr2[i4 % 4]);
                                }
                            }
                            String str = new String(bArr3, Charsets.UTF_8);
                            Function2<? super String, ? super String, Unit> function2 = this.onMessage;
                            if (function2 == null) {
                                break;
                            } else {
                                try {
                                    function2.invoke(clientId, str);
                                    break;
                                } catch (Exception e) {
                                    return;
                                }
                            }
                    }
                }
            } catch (Exception e2) {
                return;
            }
        }
    }

    private final String readLineRaw(InputStream input) {
        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        int read = input.read();
        while (read >= 0 && read != 10) {
            if (read != 13) {
                byteArrayOutputStream.write(read);
            }
            read = input.read();
        }
        if (byteArrayOutputStream.size() != 0 || read >= 0) {
            return byteArrayOutputStream.toString("US-ASCII");
        }
        return null;
    }

    private final void sendFrame(OutputStream output, String text) {
        try {
            byte[] bytes = text.getBytes(Charsets.UTF_8);
            Intrinsics.checkNotNullExpressionValue(bytes, "getBytes(...)");
            int length = bytes.length;
            output.write(129);
            if (length < 126) {
                output.write(length);
            } else if (length < 65536) {
                output.write(126);
                output.write(length >> 8);
                output.write(length & 255);
            } else {
                output.write(127);
                for (int i = 7; -1 < i; i--) {
                    output.write((length >> (i * 8)) & 255);
                }
            }
            output.write(bytes);
            output.flush();
        } catch (Exception e) {
        }
    }

    private final void sendPong(OutputStream output) {
        try {
            output.write(138);
            output.write(0);
            output.flush();
        } catch (Exception e) {
        }
    }

    /* JADX WARN: Type inference failed for: r5v6, types: [T, java.util.List] */
    public final void broadcast(String message, String excludeId) {
        Intrinsics.checkNotNullParameter(message, "message");
        Ref.ObjectRef objectRef = new Ref.ObjectRef();
        synchronized (this.clients) {
            List<WsClient> list = this.clients;
            ArrayList arrayList = new ArrayList();
            for (Object obj : list) {
                if (!Intrinsics.areEqual(((WsClient) obj).getId(), excludeId)) {
                    arrayList.add(obj);
                }
            }
            ArrayList arrayList2 = arrayList;
            ArrayList arrayList3 = new ArrayList(CollectionsKt.collectionSizeOrDefault(arrayList2, 10));
            Iterator it = arrayList2.iterator();
            while (it.hasNext()) {
                arrayList3.add(((WsClient) it.next()).getOutput());
            }
            objectRef.element = arrayList3;
            Unit unit = Unit.INSTANCE;
        }
        Iterator it2 = ((List) objectRef.element).iterator();
        while (it2.hasNext()) {
            sendFrame((OutputStream) it2.next(), message);
        }
    }

    public final int clientCount() {
        int size;
        synchronized (this.clients) {
            size = this.clients.size();
        }
        return size;
    }

    public final Function1<String, Unit> getOnConnect() {
        return this.onConnect;
    }

    public final Function1<String, Unit> getOnDisconnect() {
        return this.onDisconnect;
    }

    public final Function2<String, String, Unit> getOnMessage() {
        return this.onMessage;
    }

    /* JADX WARN: Multi-variable type inference failed */
    public final void sendTo(String clientId, String message) {
        Object obj;
        Intrinsics.checkNotNullParameter(clientId, "clientId");
        Intrinsics.checkNotNullParameter(message, "message");
        Ref.ObjectRef objectRef = new Ref.ObjectRef();
        synchronized (this.clients) {
            Iterator<T> it = this.clients.iterator();
            while (true) {
                if (!it.hasNext()) {
                    obj = null;
                    break;
                } else {
                    obj = it.next();
                    if (Intrinsics.areEqual(((WsClient) obj).getId(), clientId)) {
                        break;
                    }
                }
            }
            WsClient wsClient = (WsClient) obj;
            objectRef.element = wsClient != null ? wsClient.getOutput() : 0;
            Unit unit = Unit.INSTANCE;
        }
        if (objectRef.element != 0) {
            sendFrame((OutputStream) objectRef.element, message);
        }
    }

    public final void setOnConnect(Function1<? super String, Unit> function1) {
        this.onConnect = function1;
    }

    public final void setOnDisconnect(Function1<? super String, Unit> function1) {
        this.onDisconnect = function1;
    }

    public final void setOnMessage(Function2<? super String, ? super String, Unit> function2) {
        this.onMessage = function2;
    }

    public final boolean start() {
        try {
            this.serverSocket = new ServerSocket(this.port);
            this.running = true;
            ThreadsKt.thread((r12 & 1) != 0, (r12 & 2) != 0 ? false : true, (r12 & 4) != 0 ? null : null, (r12 & 8) != 0 ? null : "ws-server", (r12 & 16) != 0 ? -1 : 0, new Function0<Unit>() { // from class: com.rhythmdance.app.VsWebSocketServer$start$1
                {
                    super(0);
                }

                @Override // kotlin.jvm.functions.Function0
                public /* bridge */ /* synthetic */ Unit invoke() {
                    invoke2();
                    return Unit.INSTANCE;
                }

                /* renamed from: invoke, reason: avoid collision after fix types in other method */
                public final void invoke2() {
                    VsWebSocketServer.this.acceptLoop();
                }
            });
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public final void stop() {
        this.running = false;
        try {
            ServerSocket serverSocket = this.serverSocket;
            if (serverSocket != null) {
                serverSocket.close();
            }
        } catch (Exception e) {
        }
        synchronized (this.clients) {
            Iterator it = CollectionsKt.toList(this.clients).iterator();
            while (it.hasNext()) {
                try {
                    ((WsClient) it.next()).getSocket().close();
                } catch (Exception e2) {
                }
            }
            this.clients.clear();
            Unit unit = Unit.INSTANCE;
        }
    }
}
