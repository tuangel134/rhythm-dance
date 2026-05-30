// online.js
// Cliente del modo VS. Envuelve el WebSocket del servidor de salas y expone
// una API por eventos. La logica de juego sigue en el cliente; esto solo
// sincroniza: misma cancion, arranque comun y marcadores en vivo.

export class OnlineClient {
  constructor() {
    this.ws = null;
    this.listeners = {};
    this.code = null;
    this.role = null;
    this.connected = false;
    this.relayHost = null; // null => mismo origen (location.host)
  }

  setRelayHost(host) {
    // host: "" o null para usar el propio servidor; o "ip:puerto" del amigo.
    this.relayHost = (host || "").trim() || null;
  }

  on(ev, cb) { (this.listeners[ev] = this.listeners[ev] || []).push(cb); }
  _emit(ev, data) { (this.listeners[ev] || []).forEach((cb) => cb(data)); }

  _connect() {
    return new Promise((resolve, reject) => {
      if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) return resolve();
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const host = this.relayHost || location.host;
      this.ws = new WebSocket(`${proto}://${host}/ws`);
      this.ws.onopen = () => { this.connected = true; resolve(); };
      this.ws.onerror = () => reject(new Error("No se pudo conectar al servidor de salas"));
      this.ws.onclose = () => { this.connected = false; this._emit("disconnected"); };
      this.ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        this._handle(m);
      };
    });
  }

  _handle(m) {
    switch (m.t) {
      case "created": this.code = m.code; this.role = m.you; this._emit("created", m); break;
      case "joined": this.code = m.code; this.role = m.you; this._emit("joined", m); break;
      case "peerJoined": this._emit("peerJoined", m); break;
      case "peerLeft": this._emit("peerLeft", m); break;
      case "song": this._emit("song", m); break;
      case "peerReady": this._emit("peerReady", m); break;
      case "bothReady": this._emit("bothReady", m); break;
      case "go": this._emit("go", m); break;
      case "peerProgress": this._emit("peerProgress", m); break;
      case "peerFinish": this._emit("peerFinish", m); break;
      case "peerRematch": this._emit("peerRematch", m); break;
      case "rematchReady": this._emit("rematchReady", m); break;
      case "error": this._emit("error", m); break;
    }
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  async create(name) { await this._connect(); this._send({ t: "create", name }); }
  async join(code, name) { await this._connect(); this._send({ t: "join", code, name }); }
  chooseSong(songHash, songName, difficulty, lanes, songId, genre) { this._send({ t: "chooseSong", songHash, songName, difficulty, lanes, songId, genre }); }
  ready() { this._send({ t: "ready" }); }
  start() { this._send({ t: "start" }); }
  progress(score, combo, accuracy, resolved, lastHit, life) { this._send({ t: "progress", score, combo, accuracy, resolved, lastHit, life }); }
  finish(score, accuracy, grade) { this._send({ t: "finish", score, accuracy, grade }); }
  rematch() { this._send({ t: "rematch" }); }
  leave() { this._send({ t: "leave" }); this.code = null; this.role = null; }
}
