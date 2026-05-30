// arrowicon.js
// Dibuja la MISMA forma de flecha que el tablero 3D, pero en un canvas 2D, para
// usarla como icono en la UI (config de teclas, ayudas). Asi el icono coincide
// exactamente con lo que el jugador ve en el juego y no hay confusion.

// Forma base de flecha apuntando hacia ARRIBA (igual que en stage.js).
function drawArrowShape(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s, 0);
  ctx.lineTo(s * 0.45, 0);
  ctx.lineTo(s * 0.45, s * 0.85);
  ctx.lineTo(-s * 0.45, s * 0.85);
  ctx.lineTo(-s * 0.45, 0);
  ctx.lineTo(-s, 0);
  ctx.closePath();
}

// Direcciones -> rotacion en grados (canvas, horario). La flecha base apunta ↑.
const DIR_DEG = {
  up: 0, right: 90, down: 180, left: 270,
  ur: 45, dr: 135, dl: 225, ul: 315,
};

// Devuelve un dataURL (PNG) de una flecha del color y direccion dados.
// dir: "up|down|left|right|ul|ur|dl|dr|center". "center" dibuja un diamante.
export function arrowDataURL(color, dir, size = 64) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.translate(size / 2, size / 2);
  const s = size * 0.34;

  if (dir === "center") {
    // Centro de Pump It Up: diamante relleno con glow.
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = color; ctx.shadowBlur = size * 0.18;
    ctx.fillStyle = color;
    ctx.fillRect(-s * 0.72, -s * 0.72, s * 1.44, s * 1.44);
    ctx.shadowBlur = 0;
    ctx.lineWidth = size * 0.04;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeRect(-s * 0.72, -s * 0.72, s * 1.44, s * 1.44);
    return cv.toDataURL();
  }

  const deg = DIR_DEG[dir] != null ? DIR_DEG[dir] : 0;
  ctx.rotate((deg * Math.PI) / 180);
  // Glow + relleno.
  ctx.shadowColor = color; ctx.shadowBlur = size * 0.18;
  ctx.fillStyle = color;
  drawArrowShape(ctx, s);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Borde claro para que resalte sobre fondos.
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.stroke();
  return cv.toDataURL();
}

// Direcciones por carril, por estilo (coinciden con el tablero del juego).
export const LANE_DIRS = {
  5: ["dl", "ul", "center", "ur", "dr"],
  4: ["left", "down", "up", "right"],
};
