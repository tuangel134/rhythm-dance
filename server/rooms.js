// rooms.js
// Servidor de salas para el modo VS online entre dos amigos.
//
// Diseno (privado, 1 contra 1):
//   - Un jugador crea una sala -> recibe un CODIGO corto (p.ej. "K7QX").
//   - El amigo se une con ese codigo. Maximo 2 jugadores por sala.
//   - No hay matchmaking publico: solo entra quien tiene el codigo.
//   - El servidor RELAYA mensajes entre ambos (es un relay tonto, la logica
//     de juego corre en cada cliente). Asi el "emparejamiento" se reduce a
//     compartir un codigo.
//
// Mensajes (JSON sobre WebSocket):
//   cliente -> servidor:
//     {t:"create", name}                     crea sala
//     {t:"join", code, name}                  une a sala
//     {t:"chooseSong", songHash, songName, difficulty, lanes}  el host propone cancion
//     {t:"ready"}                             jugador listo (cancion cargada)
//     {t:"start", startAt}                    host fija el instante de inicio (epoch ms)
//     {t:"progress", score, combo, accuracy}  estado en vivo durante la partida
//     {t:"finish", score, accuracy, grade}    resultado final
//     {t:"leave"}                             salir
//   servidor -> cliente:
//     {t:"created", code, you}
//     {t:"joined", code, you, peers:[...]}
//     {t:"peerJoined", name} / {t:"peerLeft"}
//     {t:"song", songHash, songName, difficulty, lanes}
//     {t:"peerReady"} / {t:"bothReady"}
//     {t:"go", startAt}
//     {t:"peerProgress", ...} / {t:"peerFinish", ...}
//     {t:"error", message}

import { WebSocketServer } from "ws";
import crypto from "node:crypto";

const rooms = new Map(); // code -> { code, players: [ {ws, name, ready, role} ] }

function makeCode() {
  // Codigo de 4 caracteres sin ambiguos (sin O/0/I/1).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = "";
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) code += alphabet[bytes[i] % alphabet.length];
  } while (rooms.has(code));
  return code;
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(room, obj, exceptWs = null) {
  for (const p of room.players) if (p.ws !== exceptWs) send(p.ws, obj);
}

function peerOf(room, ws) {
  return room.players.find((p) => p.ws !== ws);
}

function leaveRoom(ws) {
  const code = ws._roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter((p) => p.ws !== ws);
  broadcast(room, { t: "peerLeft" });
  if (room.players.length === 0) rooms.delete(code);
  ws._roomCode = null;
}

export function attachRoomServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    ws._roomCode = null;
    ws._name = "Jugador";

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      const room = ws._roomCode ? rooms.get(ws._roomCode) : null;

      switch (msg.t) {
        case "create": {
          const code = makeCode();
          ws._name = (msg.name || "Jugador").slice(0, 20);
          const newRoom = { code, players: [{ ws, name: ws._name, ready: false, role: "host" }] };
          rooms.set(code, newRoom);
          ws._roomCode = code;
          send(ws, { t: "created", code, you: "host" });
          break;
        }

        case "join": {
          const code = String(msg.code || "").toUpperCase().trim();
          const target = rooms.get(code);
          if (!target) return send(ws, { t: "error", message: "Sala no encontrada" });
          if (target.players.length >= 2) return send(ws, { t: "error", message: "La sala esta llena" });
          ws._name = (msg.name || "Jugador").slice(0, 20);
          target.players.push({ ws, name: ws._name, ready: false, role: "guest" });
          ws._roomCode = code;
          const peers = target.players.filter((p) => p.ws !== ws).map((p) => p.name);
          send(ws, { t: "joined", code, you: "guest", peers });
          broadcast(target, { t: "peerJoined", name: ws._name }, ws);
          break;
        }

        case "chooseSong": {
          if (!room) return;
          room.song = {
            songHash: msg.songHash, songName: msg.songName,
            songId: msg.songId || null, genre: msg.genre || "auto",
            difficulty: msg.difficulty, lanes: msg.lanes,
          };
          // resetear listos al cambiar de cancion
          room.players.forEach((p) => (p.ready = false));
          broadcast(room, { t: "song", ...room.song });
          break;
        }

        case "ready": {
          if (!room) return;
          const me = room.players.find((p) => p.ws === ws);
          if (me) me.ready = true;
          broadcast(room, { t: "peerReady" }, ws);
          if (room.players.length === 2 && room.players.every((p) => p.ready)) {
            broadcast(room, { t: "bothReady" });
          }
          break;
        }

        case "start": {
          if (!room) return;
          // Arranque sincronizado SIN depender de relojes de pared sincronizados:
          // el servidor reenvia "go" con un delay relativo. Cada cliente arranca
          // ese delay despues de recibirlo. Como el relay llega casi a la vez a
          // ambos, quedan sincronizados aunque sus relojes difieran.
          const delayMs = 3000;
          broadcast(room, { t: "go", delayMs });
          break;
        }

        case "progress": {
          if (!room) return;
          broadcast(room, {
            t: "peerProgress", score: msg.score, combo: msg.combo, accuracy: msg.accuracy,
            resolved: msg.resolved, lastHit: msg.lastHit, life: msg.life,
          }, ws);
          break;
        }

        case "finish": {
          if (!room) return;
          broadcast(room, { t: "peerFinish", score: msg.score, accuracy: msg.accuracy, grade: msg.grade }, ws);
          break;
        }

        case "rematch": {
          if (!room) return;
          // Un jugador pide revancha. Marcamos su deseo; cuando ambos quieren,
          // reseteamos los "ready" y avisamos para volver a la sala.
          const me = room.players.find((p) => p.ws === ws);
          if (me) me.wantsRematch = true;
          broadcast(room, { t: "peerRematch", name: ws._name }, ws);
          if (room.players.length === 2 && room.players.every((p) => p.wantsRematch)) {
            room.players.forEach((p) => { p.ready = false; p.wantsRematch = false; });
            broadcast(room, { t: "rematchReady", song: room.song || null });
          }
          break;
        }

        case "leave": {
          leaveRoom(ws);
          break;
        }
      }
    });

    ws.on("close", () => leaveRoom(ws));
    ws.on("error", () => leaveRoom(ws));
  });

  // Limpieza periodica de conexiones muertas
  setInterval(() => {
    for (const room of rooms.values()) {
      room.players = room.players.filter((p) => p.ws.readyState <= 1);
      if (room.players.length === 0) rooms.delete(room.code);
    }
  }, 30000);

  return wss;
}
