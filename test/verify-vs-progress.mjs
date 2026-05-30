// Verifica que el relay reenvia el progreso con resolved/lastHit/life
// (lo que alimenta el tablero del rival en tiempo real).
import WebSocket from "ws";
const URL = "ws://localhost:5174/ws";
let host, guest, code = null;
let got = null;

function mk(label) {
  const ws = new WebSocket(URL);
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.t === "created") { code = m.code; setTimeout(() => guest.send(JSON.stringify({ t: "join", code, name: "B" })), 150); }
    if (label === "GUEST" && m.t === "joined") {
      // El invitado envia un progreso con notas resueltas
      setTimeout(() => guest.send(JSON.stringify({ t: "progress", score: 1234, combo: 7, accuracy: 95.5, resolved: 12, lastHit: true, life: 80 })), 150);
    }
    if (label === "HOST" && m.t === "peerProgress") { got = m; }
  });
  return ws;
}

host = mk("HOST");
host.on("open", () => { guest = mk("GUEST"); guest.on("open", () => host.send(JSON.stringify({ t: "create", name: "A" }))); });

setTimeout(() => {
  const ok = got && got.resolved === 12 && got.lastHit === true && got.life === 80 && got.score === 1234;
  console.log("peerProgress recibido por HOST:", JSON.stringify(got));
  console.log(ok ? "\nOK: el relay reenvia resolved/lastHit/life para el tablero del rival."
                 : "\nFALLO: el progreso no llego completo.");
  try { host.close(); guest.close(); } catch (_) {}
  process.exit(ok ? 0 : 1);
}, 1500);
