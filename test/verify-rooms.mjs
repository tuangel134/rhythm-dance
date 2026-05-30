// Verifica el flujo de salas VS: crear, unirse, elegir cancion, ready, go.
import WebSocket from "ws";

const URL = "ws://localhost:5174/ws";
const log = (...a) => console.log(...a);
let hostCode = null;
const events = [];

function mkClient(label) {
  const ws = new WebSocket(URL);
  ws.label = label;
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    events.push(`${label}:${m.t}`);
    log(label, "<-", m.t, m.code || m.message || "");
    if (m.t === "created") { hostCode = m.code; setTimeout(() => guest.send(JSON.stringify({ t: "join", code: hostCode, name: "Bob" })), 200); }
    if (label === "GUEST" && m.t === "joined") {
      setTimeout(() => host.send(JSON.stringify({ t: "chooseSong", songHash: "abc123", songName: "Test Song", difficulty: "normal", lanes: "5" })), 200);
    }
    if (label === "GUEST" && m.t === "song") {
      host.send(JSON.stringify({ t: "ready" }));
      guest.send(JSON.stringify({ t: "ready" }));
    }
    if (label === "HOST" && m.t === "bothReady") {
      // El host pide el arranque (como hace main.js).
      host.send(JSON.stringify({ t: "start" }));
    }
    if (m.t === "go") {
      log("  >> GO recibido por", label, "delayMs:", m.delayMs);
    }
  });
  return ws;
}

const host = mkClient("HOST");
let guest;
host.on("open", () => {
  guest = mkClient("GUEST");
  guest.on("open", () => host.send(JSON.stringify({ t: "create", name: "Alice" })));
});

setTimeout(() => {
  const need = ["HOST:created", "GUEST:joined", "HOST:peerJoined", "GUEST:song", "HOST:bothReady", "GUEST:go", "HOST:go"];
  const ok = need.every((e) => events.includes(e));
  log("\nEventos:", events.join(", "));
  log(ok ? "\nOK: flujo de sala VS completo." : "\nFALLO: falto algun evento -> " + need.filter((e) => !events.includes(e)));
  host.close(); guest.close();
  process.exit(ok ? 0 : 1);
}, 2500);
