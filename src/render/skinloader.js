// skinloader.js
// Carga sprites de noteskins externos (estilo StepMania 5 NewSkins) y los
// convierte en THREE.Texture utilizables por Stage.
//
// Formato de archivo esperado (sprite sheet):
//   "<Direction> <Type> <W>x<H>.PNG"
//   ej: "DownLeft TapNote 3x2.PNG"  -> grilla 3 columnas x 2 filas = 6 frames.
//   ej: "Center Hold 6x1.PNG"       -> grilla 6 columnas x 1 fila = 6 frames.
//   ej: "Center Receptor 1x2.PNG"   -> 1x2 = frame arriba "in", abajo "press".
//
// Convencion StepMania: el frame (col=0, row=0) es el estado de reposo.
//
// MVP: extraemos SOLO el frame (0,0) de cada sprite (un "still" del estado
// de reposo). El cambio de frame al presionar / fallar queda como TODO.

import * as THREE from "three";

const BASE = "/assets/skins/piu";

// Catálogo de skins disponibles. Cada entrada mapea el id (que va al select
// de Opciones) a su carpeta en /public. Agregar mas = nueva entrada + nueva
// carpeta con PNGs.
export const SKIN_CATALOG = {
  "piu-premiere": {
    label: "PIU Premiere",
    folder: "PREMIERE",
  },
};

// Cache de skins ya cargadas: nombre -> { tap, receptor, hold, _centerReceptor, _centerTap }.
const cache = new Map();

// Carga una skin y devuelve las texturas listas para usar en Stage.
// Devuelve:
//   {
//     tap:    { dl, ul, c, ur, dr }  -> THREE.Texture (frame 0,0 del tap note)
//     receptor: { c }                 -> THREE.Texture (frame 0,0 del center receptor)
//     hold:   { dl, ul, c, ur, dr }  -> THREE.Texture (frame 0,0 del hold head)
//   }
// Si algo falla (404, PNG corrupto), lanza un Error con mensaje legible.
export async function loadPiuSkin(skinId) {
  if (cache.has(skinId)) return cache.get(skinId);

  const meta = SKIN_CATALOG[skinId];
  if (!meta) throw new Error("Skin desconocida: " + skinId);

  const base = `${BASE}/${meta.folder}/HD`;

  // Centro y direcciones laterales. El receptor usa la misma textura que la
  // tap note de cada direccion (no hay sprite separado para receptor).
  const centerTapImg  = await loadImg(`${base}/${encodeURIComponent("Center TapNote 3x2.PNG")}`);
  const centerHoldImg = await loadImg(`${base}/${encodeURIComponent("Center Hold 6x1.PNG")}`);

  const tap = { c: frameTexture(centerTapImg, 3, 2, 0, 0) };
  const hold = { c: frameTexture(centerHoldImg, 6, 1, 0, 0) };
  const dirName = { dl: "DownLeft", ul: "UpLeft", ur: "UpRight", dr: "DownRight" };
  for (const [dir, name] of Object.entries(dirName)) {
    tap[dir]  = frameTexture(await loadImg(`${base}/${encodeURIComponent(name + " TapNote 3x2.PNG")}`), 3, 2, 0, 0);
    hold[dir] = frameTexture(await loadImg(`${base}/${encodeURIComponent(name + " Hold 6x1.PNG")}`),   6, 1, 0, 0);
  }

  const result = { tap, hold };
  cache.set(skinId, result);
  return result;
}

// Carga una imagen via Image() y devuelve el HTMLImageElement listo para
// dibujar en un canvas.
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar imagen: " + src));
    img.src = src;
  });
}

// Extrae un frame (col, row) de un sprite sheet y lo convierte en una
// THREE.Texture. W = columnas, H = filas del sheet.
// El frame se recorta al tamano exacto (img.width/W x img.height/H) y se
// sube a un canvas intermedio, porque THREE no puede "sub-texturear" un
// PNG facilmente (habria que usar offset+repeat, y los bordes de frame se
// mezclarian por el filtrado bilinear).
function frameTexture(img, W, H, col, row) {
  const fw = Math.floor(img.width  / W);
  const fh = Math.floor(img.height / H);
  const cv = document.createElement("canvas");
  cv.width = fw; cv.height = fh;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// Helper para descarga completa del stage: precarga una skin y devuelve
// los datos en el formato que Stage espera. Si id === "classic" devuelve null.
// Timeout de 12s: si las imagenes no cargan (red lenta, servidor caido), no
// bloquea el juego; el Stage cae a procedural silenciosamente.
export async function preloadNoteskin(id) {
  if (!id || id === "classic") return null;
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout 12s")), 12000));
  return Promise.race([loadPiuSkin(id), timeout]);
}
