// Ayudante CDP: conecta al WebView por DevTools y evalúa una expresión JS.
// Uso: node cdp.mjs "<expr js>"   (requiere adb forward tcp:9222 ya hecho)
import WebSocket from "ws";

const expr = process.argv[2] || "1+1";

async function main() {
  const list = await (await fetch("http://localhost:9222/json/list")).json();
  const page = list.find((p) => p.type === "page") || list[0];
  if (!page) { console.log("NO_PAGE"); process.exit(2); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on("open", r));
  const id = 1;
  ws.send(JSON.stringify({ id, method: "Runtime.evaluate",
    params: { expression: expr, returnByValue: true, awaitPromise: true } }));
  const result = await new Promise((resolve) => {
    ws.on("message", (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) resolve(m);
    });
  });
  if (result.result && result.result.result) {
    const v = result.result.result;
    console.log(typeof v.value === "object" ? JSON.stringify(v.value) : String(v.value));
  } else {
    console.log("ERR:" + JSON.stringify(result.result || result));
  }
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.log("FAIL:" + e.message); process.exit(1); });
