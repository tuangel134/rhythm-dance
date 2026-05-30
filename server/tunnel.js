// tunnel.js
// Crea un tunel publico para que un amigo pueda entrar a tu partida desde su
// navegador con un simple enlace, sin IP ni reenvio de puertos.
//
// Usa localtunnel (servicio gratuito). El enlace es temporal y vive mientras
// el servidor este abierto. Pensado para jugar con un amigo, no para produccion.

import localtunnel from "localtunnel";

let tunnel = null;
let starting = null;

/**
 * Inicia (o reutiliza) el tunel. Devuelve { url }.
 * @param {number} port
 */
export async function startTunnel(port) {
  if (tunnel && tunnel.url && !tunnel.clientId?.closed) {
    return { url: tunnel.url };
  }
  if (starting) return starting;

  starting = (async () => {
    try {
      tunnel = await localtunnel({ port });
      tunnel.on("close", () => { tunnel = null; });
      tunnel.on("error", () => { /* se reintenta al pedirlo de nuevo */ });
      return { url: tunnel.url };
    } catch (e) {
      tunnel = null;
      throw new Error("No se pudo crear el enlace publico: " + e.message);
    } finally {
      starting = null;
    }
  })();
  return starting;
}

export function getTunnelUrl() {
  return tunnel && tunnel.url ? tunnel.url : null;
}

export function stopTunnel() {
  if (tunnel) { try { tunnel.close(); } catch (_) {} tunnel = null; }
}
