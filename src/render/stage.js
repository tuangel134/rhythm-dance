// stage.js
// Escena 3D estilo Pump It Up (arte 100% procedural).
//
// - Camara EN PERSPECTIVA con el campo inclinado: las flechas SUBEN desde
//   abajo (cerca, grandes) hacia los receptores arriba (lejos), dando el
//   clasico "highway" con profundidad.
// - Receptores arriba que laten con el beat; explosiones al acertar.
// - Arte 100% procedural (sin sprites con copyright).
// - Optimizado: geometria/material/textura compartidos + pooling de mallas,
//   sin crear objetos por frame.

import * as THREE from "three";

export const LAYOUTS = {
  5: [
    { key: "dl", rot: Math.PI * 0.25,  color: 0xff2e6e },
    { key: "ul", rot: Math.PI * 0.75,  color: 0x2ee6ff },
    { key: "c",  rot: 0,               color: 0xffe14d },
    { key: "ur", rot: -Math.PI * 0.75, color: 0x2ee6ff },
    { key: "dr", rot: -Math.PI * 0.25, color: 0xff2e6e },
  ],
  4: [
    { key: "left",  rot: Math.PI * 0.5,  color: 0xff2e88 },
    { key: "down",  rot: 0,              color: 0x2ee6ff },
    { key: "up",    rot: Math.PI,        color: 0x5dff8f },
    { key: "right", rot: -Math.PI * 0.5, color: 0xffd23e },
  ],
};

// Guitar Hero: gemas de colores por traste (verde, rojo, amarillo, azul, naranja).
// rot=0 (las gemas no se rotan). Sin copyright: arte procedural propio.
export const GUITAR_LAYOUTS = {
  5: [
    { key: "g", rot: 0, color: 0x3fd24a },
    { key: "r", rot: 0, color: 0xff3b3b },
    { key: "y", rot: 0, color: 0xffe14d },
    { key: "b", rot: 0, color: 0x3b9bff },
    { key: "o", rot: 0, color: 0xff8a1e },
  ],
  4: [
    { key: "g", rot: 0, color: 0x3fd24a },
    { key: "r", rot: 0, color: 0xff3b3b },
    { key: "y", rot: 0, color: 0xffe14d },
    { key: "b", rot: 0, color: 0x3b9bff },
  ],
};

const PANEL_SPACING = 1.6;  // separacion entre carriles (mas grande = flechas mas separadas)
const RECEPTOR_Y = 3.4;     // posicion local del receptor (arriba)
const NOTE_SCALE = 1.5;     // tamano de flecha (mas grande)
const TILT = -0.28;         // inclinacion del campo (perspectiva) — modo Clasico
const TILT_PIU = -0.14;     // inclinacion reducida para skins PIU (mas plano, mas "arcade")

function colHex(c) { return "#" + c.toString(16).padStart(6, "0"); }

// Flecha solida con glow (apunta arriba; se rota por panel).
function makeArrowTexture(hexColor) {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const col = colHex(hexColor);
  ctx.translate(size / 2, size / 2);
  // halo exterior
  ctx.shadowColor = col;
  ctx.shadowBlur = 55;
  ctx.fillStyle = col;
  const s = size * 0.32;
  drawArrow(ctx, s);
  ctx.fill();
  // segundo pase para glow mas intenso
  ctx.shadowBlur = 28;
  ctx.fill();
  ctx.shadowBlur = 0;
  // borde claro
  ctx.lineWidth = size * 0.022;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();
  // brillo interno
  ctx.globalCompositeOperation = "source-atop";
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, "rgba(255,255,255,0.6)");
  g.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  return toTex(cv);
}

// Receptor: contorno de flecha (hueco) con glow.
function makeReceptorTexture(hexColor) {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const col = colHex(hexColor);
  ctx.translate(size / 2, size / 2);
  ctx.shadowColor = col;
  ctx.shadowBlur = 30;
  ctx.lineWidth = size * 0.05;
  ctx.strokeStyle = col;
  const s = size * 0.32;
  drawArrow(ctx, s);
  ctx.stroke();
  return toTex(cv);
}

// Gema de Guitar Hero: circulo brillante con borde y reflejo (apunta sin rotar).
function makeGemTexture(hexColor) {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const col = colHex(hexColor);
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  // halo exterior
  ctx.shadowColor = col;
  ctx.shadowBlur = 40;
  // cuerpo (degradado radial para volumen)
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.25, col);
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // borde claro grueso
  ctx.lineWidth = size * 0.045;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // reflejo superior
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.45, r * 0.5, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  return toTex(cv);
}

// Aro de traste (receptor) de Guitar Hero: anillo hueco con glow del color.
function makeFretTexture(hexColor) {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const col = colHex(hexColor);
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  ctx.shadowColor = col;
  ctx.shadowBlur = 24;
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = col;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // anillo interior tenue
  ctx.shadowBlur = 0;
  ctx.lineWidth = size * 0.02;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.stroke();
  return toTex(cv);
}

// Glow radial suave (circulo) para halos aditivos.
function makeGlowTexture() {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTex(cv);
}

function drawArrow(ctx, s) {
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

function toTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

// Tinta una textura THREE (CanvasTexture) con un color RGB hex. Re-pinta
// cada pixel con el color destino * brillo original, en vez de multiplicar
// (que oscurece). Asi la flecha PIU se ve de colores vivos y distintos.
function tintTexture(srcTex, hexColor) {
  const img = srcTex.image;
  if (!img || !img.width) return srcTex;
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height);
  const px = d.data;
  const r = (hexColor >> 16) & 0xff;
  const g = (hexColor >> 8) & 0xff;
  const b = hexColor & 0xff;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (!a) continue;
    const lum = (px[i] + px[i + 1] + px[i + 2]) / (3 * 255);
    px[i]     = Math.round(r * lum);
    px[i + 1] = Math.round(g * lum);
    px[i + 2] = Math.round(b * lum);
  }
  ctx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// Textura de bomba: circulo rojo con brillo y signo de exclamacion.
function makeBombTexture() {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  // Halo exterior rojo
  ctx.shadowColor = "#ff4d4d";
  ctx.shadowBlur = 60;
  ctx.fillStyle = "#ff4d4d";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  // Borde blanco
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = size * 0.03;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // Signo de exclamacion grande y negrita
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${size * 0.55}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 10;
  ctx.fillText("!", cx, cy + 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Textura de nota Item (Mario Kart style): caja con ? brillante.
function makeItemTexture() {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const cx = size / 2, cy = size / 2, s = size * 0.36;
  // Caja con borde blanco
  ctx.shadowColor = "#ffd23e";
  ctx.shadowBlur = 50;
  ctx.fillStyle = "#ffd23e";
  ctx.beginPath(); ctx.roundRect(cx - s, cy - s, s * 2, s * 2, size * 0.06); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = size * 0.025;
  ctx.beginPath(); ctx.roundRect(cx - s, cy - s, s * 2, s * 2, size * 0.06); ctx.stroke();
  // Signo ?
  ctx.fillStyle = "#1a1a2e";
  ctx.font = `bold ${size * 0.55}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", cx, cy + 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Stage {
  constructor(container, laneCount, scrollSpeed, mods, opts) {
    this.container = container;
    this.laneCount = laneCount;
    this.scrollSpeed = scrollSpeed;
    this.opts = opts || {};
    // Modo visual: "dance" (Pump It Up, flechas que suben) o "guitar"
    // (Guitar Hero: gemas que bajan por un mastil con trastes abajo).
    this.mode = this.opts.mode === "guitar" ? "guitar" : "dance";
    this.guitar = this.mode === "guitar";
    this.layout = (this.guitar ? GUITAR_LAYOUTS : LAYOUTS)[laneCount];
    // Skin: "classic" (procedural) o "piu-premiere" / etc. (sprites externos).
    // Cuando se usa una skin PIU, las texturas vienen precargadas por el caller
    // en opts.piuSkin = { tap:{dir}, receptor:{c}, hold:{dir} }.
    this.piuSkin = this.opts.piuSkin || null;
    this._piu4 = !!(this.piuSkin && this.laneCount === 4);
    // Dimensiones por modo. Guitar Hero: mastil mas angosto, gemas mas chicas y
    // mucha mas perspectiva (mas inclinacion) para el look clasico.
    this.PS = this.guitar ? 1.05 : PANEL_SPACING;   // separacion entre carriles
    this.NS = this.guitar ? 0.92 : NOTE_SCALE;      // tamano de nota/gema
    // Modo VERTICAL (estilo Piano Tiles): campo PLANO (sin perspectiva), dock
    // de flechas ABAJO y notas que CAEN. Es una orientacion visual independiente
    // del gameMode (funciona con dance o guitar) y no toca el timing/juicio.
    this.vertical = !!this.opts.vertical;
    if (this.vertical) {
      // Flechas mas GRANDES y mas separadas en vertical (se ven en pantalla
      // estrecha de movil). La camara se ajusta para llenar el ancho.
      this.NS = 2.6;
      this.PS = this.guitar ? 1.2 : 1.8;
    }
    // Skin PIU -> menos perspectiva para verse mas "arcade plano".
    // Vertical -> tilt 0 (totalmente plano, look 2D arcade).
    this.tilt = this.vertical ? 0 : (this.guitar ? -0.5 : (this.piuSkin ? TILT_PIU : TILT));
    // Si hay video de fondo, el canvas 3D es transparente para verlo detras.
    this.transparentBg = !!this.opts.transparentBg;
    // Modificadores visuales (estilo Pump It Up). Todos son SOLO visuales:
    // no cambian el timing ni la dificultad de la pista.
    this.mods = Object.assign({
      vanish: false, appear: false, hidden: false,
      tornado: false, twirl: false, drunk: false,
      mirror: false, random: false, reverse: false,
      mini: false, mega: false, niebla: false, gravedad: false, neon: false, rebote: false,
      _blindTime: 0,  // >0 = modo ciego (segundos que la nota es visible)
    }, mods || {});

    // Permutacion de carriles para 'random' (se calcula una vez por partida).
    this._randomMap = null;

    this.scene = new THREE.Scene();
    // Con video de fondo, no pintamos fondo (alpha) para que se vea el video.
    if (!this.transparentBg) this.scene.background = new THREE.Color(0x05060f);

    // 'random': permutacion estable de carriles para esta partida. Como notas
    // y receptores usan _laneX, el remapeo es consistente (visual, no cambia
    // que tecla corresponde a cada receptor).
    if (this.mods.random) {
      this._randomMap = Array.from({ length: laneCount }, (_, i) => i);
      for (let i = laneCount - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = this._randomMap[i]; this._randomMap[i] = this._randomMap[j]; this._randomMap[j] = tmp;
      }
    }

    // Si el contenedor aun no tiene tamano (layout no aplicado), usar la ventana.
    const w = container.clientWidth || window.innerWidth || 1280;
    const h = container.clientHeight || window.innerHeight || 720;
    this.camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 100);
    if (this.guitar) {
      // Guitar Hero: camara arriba-atras mirando hacia el frente del mastil.
      // El encuadre es como el modo dance pero con mas inclinacion del campo,
      // de modo que los trastes (abajo) quedan bien visibles y el mastil sube.
      this._camPos = new THREE.Vector3(0, 1.4, 12.5);
      this._camLook = new THREE.Vector3(0, 0.6, 0);
    } else {
      this._camPos = new THREE.Vector3(0, 0.6, 14);
      this._camLook = new THREE.Vector3(0, 1.1, 0);
    }
    // Vertical (Piano Tiles): camara DE FRENTE, encuadrando el campo plano
    // desde el dock de abajo (recY=-3.4) hasta lo alto (~10). Centro ~3.3.
    if (this.vertical) {
      const cy = (10 - RECEPTOR_Y) / 2;
      this._camPos = new THREE.Vector3(0, cy, 19);
      this._camLook = new THREE.Vector3(0, cy, 0);
    }
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);

    // Renderer COMPARTIDO (VS local): en vez de crear un segundo contexto
    // WebGL (caro: el navegador compone dos lienzos GPU por frame y deja cada
    // frame al limite), ambos tableros comparten UN solo renderer y se pintan
    // en mitades (viewports) del mismo lienzo. Reduce a la mitad la carga de
    // composicion y elimina los tirones del VS local.
    this._shared = this.opts.sharedRenderer || null;
    if (this._shared) {
      this.renderer = this._shared.renderer;
      this._quality = "auto";
      this._maxPR = this._shared._maxPR;
      this._vp = { x: 0, y: 0, w: w, h: h };
      this._shared.add(this);
    } else {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: !!this.transparentBg });
    } catch (e) {
      throw new Error("Tu navegador no pudo iniciar WebGL. Activa la aceleracion por hardware. (" + e.message + ")");
    }
    if (!this.renderer || !this.renderer.getContext()) {
      throw new Error("WebGL no disponible en este navegador/PC.");
    }
    if (this.transparentBg) this.renderer.setClearColor(0x000000, 0);
    // Calidad adaptativa. El cap de pixel ratio es lo que mas afecta el
    // "fill-rate" (coste de pintar pixeles), el cuello de botella tipico en
    // GPUs debiles. Se ajusta en runtime con setQuality().
    this._quality = "auto";
    this._maxPR = 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._maxPR));
    this.renderer.setSize(w, h);
    this.renderer.info.autoReset = false;
    // No ordenar objetos por frame: con muchas notas transparentes el sort
    // (O(n log n)) se volvia caro y se quedaba caro tras un drop denso. Ya
    // controlamos el orden de dibujo con renderOrder + depthTest:false.
    this.renderer.sortObjects = false;
    container.appendChild(this.renderer.domElement);
    }

    // Grupo inclinado (el "highway")
    this.field = new THREE.Group();
    this.field.rotation.x = this.tilt;
    this.field.position.y = 0.5;
    this.scene.add(this.field);

    // Recursos compartidos
    this._unitGeo = new THREE.PlaneGeometry(1, 1);
    this._glowTex = makeGlowTexture();
    // 4-lane DDR con skin PIU: rotacion corregida por carril para que el
    // sprite "dl" (DownLeft) apunte correctamente (←, ↓, ↑, →).
    this._piu4Rot  = [-Math.PI*0.25, Math.PI*0.25, Math.PI*1.25, Math.PI*0.75];
    this._piu4 = false;  // true si skin PIU + laneCount === 4
    this._arrowTex = [];
    this._receptorTex = [];
    this._noteMat = [];
    this._glowMat = [];
    for (let i = 0; i < laneCount; i++) {
      if (this.piuSkin) {
        // 5-lane (Pump): cada direccion usa su sprite pre-orientado (rot=0).
        // 4-lane (DDR): sprite "dl" unico, rotado por _piu4Rot por carril,
        // y tintado con el color del layout para que cada flecha sea distinta.
        const dirKey = this.laneCount === 5 ? ["dl","ul","c","ur","dr"][i] || "c" : "dl";
        const tex = this.piuSkin.tap[dirKey] || this.piuSkin.tap.c;
        // 4-lane: tintar el sprite con el color del carril (pixel-level, no
        // multiplicativo) para que izquierda/abajo/arriba/derecha se vean
        // de colores vivos y distintos (rosa, cyan, verde, amarillo).
        this._arrowTex[i] = this._piu4 ? tintTexture(tex, this.layout[i].color) : tex;
        this._receptorTex[i] = this._arrowTex[i];
      } else if (this.guitar) {
        this._arrowTex[i] = makeGemTexture(this.layout[i].color);
        this._receptorTex[i] = makeFretTexture(this.layout[i].color);
      } else {
        this._arrowTex[i] = makeArrowTexture(this.layout[i].color);
        this._receptorTex[i] = makeReceptorTexture(this.layout[i].color);
      }
      this._noteMat[i] = new THREE.MeshBasicMaterial({ map: this._arrowTex[i], transparent: true, depthTest: false });
      this._glowMat[i] = new THREE.MeshBasicMaterial({
        map: this._glowTex, transparent: true, depthTest: false,
        blending: THREE.AdditiveBlending, color: new THREE.Color(this.layout[i].color), opacity: 0.5,
      });
    }

    this._notePool = [];
    this._fxPool = [];
    this._holdPool = [];
    this.effects = [];
    this._glowEnabled = true;
    // Materiales de cuerpo de hold por lane (semitransparente, color del lane).
    this._holdMat = this.layout.map((d) => new THREE.MeshBasicMaterial({
      color: d.color, transparent: true, opacity: 0.45, depthTest: false,
    }));
    // Materiales de hold para skin PIU: usan el sprite hold de la skin
    // (ej: DownLeft Hold 6x1.PNG) como textura del cuerpo, con opacidad
    // reducida para que se vea la cola del hold sin tapar la cabeza.
    if (this.piuSkin) {
      this._holdMatPiu = Array.from({ length: laneCount }, (_, idx) => {
        const dk = this.laneCount === 5 ? (["dl","ul","c","ur","dr"][idx] || "c") : "dl";
        const texRaw = this.piuSkin.hold[dk] || this.piuSkin.hold.c;
        // 4-lane: tintar el sprite hold igual que la flecha para que combine.
        const tex = this._piu4 ? tintTexture(texRaw, this.layout[idx].color) : texRaw;
        return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0.55 });
      });
    }

    // Colores cacheados por lane (evita new THREE.Color() en cada acierto).
    this._laneColors = this.layout.map((d) => new THREE.Color(d.color));
    // Material GRIS compartido para notas falladas (pasan de largo atenuadas).
    // COMPARTIDO por carril: antes se clonaba uno por nota fallada (clone +
    // dispose por nota), lo que en un drop con varios fallos disparaba GC y
    // recompilaciones de shader -> tirones. Ahora es uno fijo por carril.
    this._missMat = this.layout.map((d, i) => new THREE.MeshBasicMaterial({
      map: this._arrowTex[i], color: new THREE.Color(0x666a80),
      transparent: true, opacity: 0.4, depthTest: false,
    }));
    // Material para Notas Bomba: circulo rojo con glow.
    this._bombTex = makeBombTexture();
    this._bombMat = new THREE.MeshBasicMaterial({ map: this._bombTex, transparent: true, depthTest: false });
    // Material para cuerpo de hold bomba: barra roja.
    this._bombHoldMat = new THREE.MeshBasicMaterial({
      color: 0xff4d4d, transparent: true, opacity: 0.5, depthTest: false,
    });
    // Material para notas Item (?: caja amarilla).
    this._itemTex = makeItemTexture();
    this._itemMat = new THREE.MeshBasicMaterial({ map: this._itemTex, transparent: true, depthTest: false });

    this._buildBackground();
    this._buildReceptors();

    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize);
    // Corregir el tamano en el siguiente frame, por si el contenedor aun no
    // tenia dimensiones al construir (evita pantalla en blanco sin flechas).
    requestAnimationFrame(() => { try { this._onResize(); } catch (_) {} });
  }

  get unitsPerSec() { return 2.6 * this.scrollSpeed; }

  // Tiempo (s) antes del receptor en que una nota debe existir (para spawnear).
  viewSeconds() { return (RECEPTOR_Y + 10) / this.unitsPerSec; }

  // Posicion X del carril. Con 'mirror' se invierte el orden de los carriles.
  // Con 'random' se aplica una permutacion estable (calculada al inicio).
  _laneX(i) {
    let idx = this.mods.mirror ? (this.laneCount - 1 - i) : i;
    if (this._randomMap) idx = this._randomMap[idx];
    const total = (this.laneCount - 1) * this.PS;
    return idx * this.PS - total / 2;
  }

  // Y del receptor. Guitar: trastes ABAJO, gemas caen. Dance: receptor arriba,
  // flechas suben (salvo 'reverse', que invierte). Vertical (Piano Tiles):
  // receptor ABAJO y las notas CAEN (reverse las invierte tambien).
  get _isDown() {
    if (this.vertical) return !this.mods.reverse;
    return this.guitar ? !this.mods.reverse : this.mods.reverse;
  }
  get recY() {
    return this._isDown ? -RECEPTOR_Y : RECEPTOR_Y;
  }
  // Direccion de scroll: +1 las notas SUBEN hacia el receptor, -1 BAJAN.
  get scrollDir() {
    return this._isDown ? -1 : 1;
  }

  // Rotacion visual del carril i. En 5-lane PIU los sprites ya vienen
  // orientados (rot=0). En 4-lane DDR con PIU usamos rotacion corregida
  // por sprite. En Clasico/Guitar usamos la del layout.
  _laneRot(i) {
    if (this.piuSkin && this.laneCount === 5) return 0;
    if (this.piuSkin && this.laneCount === 4) return this._piu4Rot[i];
    return this.layout[i].rot;
  }

  // Activa el modo ciego: las notas solo se ven los primeros `secs` segundos
  // de su viaje hacia el receptor. 0 = desactivado.
  setBlindMode(secs) { this.mods._blindTime = secs; }

  _buildBackground() {
    // Tablero MINIMALISTA (modo dance): solo flechas y receptores. Sin suelo,
    // franjas, divisores ni rieles. Si no hay video, fondo de color solido.
    if (!this.transparentBg) {
      const cv = document.createElement("canvas");
      cv.width = 16; cv.height = 256;
      const ctx = cv.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#0b1030");
      g.addColorStop(0.5, "#070a1a");
      g.addColorStop(1, "#03040c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 256);
      this._bgMat = new THREE.MeshBasicMaterial({ map: toTex(cv) });
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), this._bgMat);
      bg.position.set(0, 0, -8);
      bg.renderOrder = -10;
      this.scene.add(bg);
    }

    // Sin lineas de beat (se quitaron por pedido: tablero mas limpio).
    this._beatLines = null;
    this._beatLineCount = 0;
    this.pulseMat = new THREE.MeshBasicMaterial({ color: 0x2ee6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });

    // En modo GUITAR construimos el mastil (fretboard): carriles oscuros,
    // divisores entre cuerdas, rieles laterales y una barra en los trastes.
    if (this.guitar) this._buildFretboard();
  }

  // Mastil de Guitar Hero: pista oscura con carriles de color tenue, divisores
  // y una barra brillante a la altura de los trastes (donde se golpean las gemas).
  _buildFretboard() {
    const wTotal = this.laneCount * this.PS;
    // Suelo del mastil (oscuro, ligeramente translucido si hay video).
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(wTotal + 0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x0a0a12, transparent: this.transparentBg, opacity: this.transparentBg ? 0.6 : 1 })
    );
    board.position.set(0, this.recY - this.scrollDir * 13, -0.05);
    board.renderOrder = -5;
    this.field.add(board);

    // Carriles tintados con el color de cada cuerda (muy tenue).
    for (let i = 0; i < this.laneCount; i++) {
      const lane = new THREE.Mesh(
        new THREE.PlaneGeometry(this.PS * 0.96, 32),
        new THREE.MeshBasicMaterial({ color: this.layout[i].color, transparent: true, opacity: 0.07 })
      );
      lane.position.set(this._laneX(i), this.recY - this.scrollDir * 13, 0);
      lane.renderOrder = -4;
      this.field.add(lane);
    }

    // Divisores entre cuerdas (lineas verticales claras).
    for (let i = 0; i <= this.laneCount; i++) {
      const div = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04, 32),
        new THREE.MeshBasicMaterial({ color: 0x555a78, transparent: true, opacity: 0.55 })
      );
      div.position.set(-wTotal / 2 + i * this.PS, this.recY - this.scrollDir * 13, 0.01);
      div.renderOrder = -3;
      this.field.add(div);
    }

    // Rieles laterales con glow blanco (bordes del mastil).
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 32),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending })
      );
      rail.position.set(side * (wTotal / 2 + 0.14), this.recY - this.scrollDir * 13, 0.02);
      rail.renderOrder = -3;
      this.field.add(rail);
    }

    // Barra de trastes: linea brillante en la altura de golpeo.
    const hitBar = new THREE.Mesh(
      new THREE.PlaneGeometry(wTotal + 0.5, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })
    );
    hitBar.position.set(0, this.recY, 0.05);
    hitBar.renderOrder = -1;
    this.field.add(hitBar);

    // DOCK de trastes: base oscura + disco de color por cuerda donde se golpea
    // (debajo de los aros receptores). Es el "teclado" del Guitar Hero.
    const dock = new THREE.Mesh(
      new THREE.PlaneGeometry(wTotal + 0.6, this.NS * 1.5),
      new THREE.MeshBasicMaterial({ color: 0x05060c, transparent: true, opacity: 0.92 })
    );
    dock.position.set(0, this.recY, 0.03);
    dock.renderOrder = -1;
    this.field.add(dock);

    this._fretButtons = [];
    for (let i = 0; i < this.laneCount; i++) {
      // disco de color tenue (se ilumina al presionar) detras del aro.
      const disc = new THREE.Mesh(this._unitGeo, new THREE.MeshBasicMaterial({
        map: this._glowTex, transparent: true, depthTest: false,
        blending: THREE.AdditiveBlending, color: this._laneColors[i], opacity: 0.32,
      }));
      disc.scale.setScalar(this.NS * 1.25);
      disc.position.set(this._laneX(i), this.recY, 0.04);
      disc.renderOrder = 0;
      this.field.add(disc);
      this._fretButtons.push(disc);
    }
  }

  _buildReceptors() {
    this.receptors = [];
    // Colores del MARCO de combo por nivel: verde(20) morado(50) dorado(100) rojo(200).
    this._comboTierColors = [0x5dff8f, 0xa855ff, 0xffd23e, 0xff4d4d];
    this._comboTier = 0;
    for (let i = 0; i < this.laneCount; i++) {
      const def = this.layout[i];
      const holder = new THREE.Group();
      holder.position.set(this._laneX(i), this.recY, 0.1);

      // halo
      const glow = new THREE.Mesh(this._unitGeo, this._glowMat[i].clone());
      glow.scale.setScalar(this.NS * 2.4);
      glow.material.opacity = 0.25;
      holder.add(glow);

      // MARCO de combo: contorno de flecha extra, coloreado por nivel de combo.
      // Oculto por defecto; se enciende con setComboTier(). Es el "marco" que
      // pediste SOLO en las flechas del tablero (receptores), no en las que caen.
      const ringMat = new THREE.MeshBasicMaterial({
        map: this._receptorTex[i], transparent: true, opacity: 0, depthTest: false,
        blending: THREE.AdditiveBlending, color: new THREE.Color(0x5dff8f),
      });
      const ring = new THREE.Mesh(this._unitGeo, ringMat);
      ring.rotation.z = this._laneRot(i);
      ring.scale.setScalar(this.NS * 1.18);
      ring.renderOrder = 3;
      ring.visible = false;
      holder.add(ring);

      // contorno de flecha
      const mat = new THREE.MeshBasicMaterial({ map: this._receptorTex[i], transparent: true, opacity: 0.6, depthTest: false });
      const mesh = new THREE.Mesh(this._unitGeo, mat);
      mesh.rotation.z = this._laneRot(i);
      mesh.scale.setScalar(this.NS);
      mesh.renderOrder = 2;
      holder.add(mesh);

      this.field.add(holder);
      this.receptors.push({ mesh, glow, ring, def, flash: 0 });
    }
  }

  // Ajusta el MARCO de combo en los receptores segun el nivel:
  //   0 = sin marco · 1 = verde(>=20) · 2 = morado(>=50) · 3 = dorado(>=100) · 4 = rojo(>=200)
  setComboTier(tier) {
    if (tier === this._comboTier || !this.receptors) return;
    this._comboTier = tier;
    const on = tier > 0;
    const col = on ? this._comboTierColors[Math.min(tier, 4) - 1] : 0x000000;
    for (const r of this.receptors) {
      if (!r.ring) continue;
      r.ring.visible = on;
      if (on) r.ring.material.color.setHex(col);
    }
  }

  receptorY() { return RECEPTOR_Y; }

  // ----- Pool de notas -----
  spawnNote(note) {
    let mesh = this._notePool.pop();
    if (!mesh) {
      mesh = new THREE.Mesh(this._unitGeo, this._noteMat[note.lane]);
      mesh.scale.setScalar(this.NS);
      mesh.renderOrder = 3;
      this.field.add(mesh);
    }
    // Inicialmente todas las notas usan el material del carril, salvo items
    // y bombas (items siempre visibles como caja ?, bombas se camuflan).
    if (note.item) {
      mesh.material = this._itemMat;
    } else {
      mesh.material = this._noteMat[note.lane];
    }
    mesh.rotation.z = this._laneRot(note.lane);
    mesh.position.set(this._laneX(note.lane), -50, 0.2);
    mesh.scale.setScalar(this.NS);
    mesh.visible = true;

    const entry = { mesh, note, lane: note.lane, body: null };

    // Cuerpo del hold (barra que conecta inicio y fin de la nota larga).
    if (note.duration && note.duration > 0) {
      let body = this._holdPool.pop();
      if (!body) {
        if (this.piuSkin) {
          body = new THREE.Mesh(this._unitGeo, this._holdMatPiu[note.lane]);
        } else {
          body = new THREE.Mesh(this._unitGeo, this._holdMat[note.lane]);
        }
        body.renderOrder = 2; // detras de la cabeza
        this.field.add(body);
      }
      body.material = this.piuSkin ? this._holdMatPiu[note.lane] : this._holdMat[note.lane];
      body.rotation.z = 0;
      const lenUnits = note.duration * this.unitsPerSec;
      // Cuerpo: en skin PIU usa el sprite hold (mas ancho, ~85% del ancho de
      // la cabeza); en Clasico la barra de color solido es mas delgada.
      const bodyW = this.piuSkin ? this.NS * 0.85 : this.NS * 0.5;
      body.scale.set(bodyW, lenUnits, 1);
      body.position.set(this._laneX(note.lane), -50, 0.15);
      body.visible = true;
      entry.body = body;
      entry.holdLen = lenUnits;
    }
    return entry;
  }

  // Pre-calienta los pools y FUERZA la compilacion de shaders ANTES de empezar.
  // Causa #1 de micro-tirones en juegos de ritmo con three.js: la primera vez
  // que se usa un material/efecto, el driver compila su shader (stall de varios
  // ms). Al pisar un acorde se creaban varios efectos a la vez -> varios
  // compiles -> tiron. Aqui creamos por adelantado N notas, N holds y N fx por
  // carril, y forzamos render() para compilar todos los shaders de una vez.
  prewarm(perLane = 6) {
    const stash = [];
    for (let lane = 0; lane < this.laneCount; lane++) {
      for (let k = 0; k < perLane; k++) {
        // Nota normal
        const m = new THREE.Mesh(this._unitGeo, this._noteMat[lane]);
        m.scale.setScalar(this.NS); m.renderOrder = 3; m.position.set(this._laneX(lane), -50, 0.2);
        m.visible = true; this.field.add(m); this._notePool.push(m); stash.push(m);
        // Cuerpo de hold
        const b = new THREE.Mesh(this._unitGeo, this.piuSkin ? this._holdMatPiu[lane] : this._holdMat[lane]);
        b.renderOrder = 2; b.position.set(this._laneX(lane), -50, 0.15);
        b.visible = true; this.field.add(b); this._holdPool.push(b); stash.push(b);
        // Efecto de acierto (glow additive)
        const fxMat = new THREE.MeshBasicMaterial({ map: this._glowTex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false });
        fxMat.color = this._laneColors[lane];
        const fx = new THREE.Mesh(this._unitGeo, fxMat);
        fx.renderOrder = 4; fx.position.set(this._laneX(lane), this.recY, 0.3);
        fx.scale.setScalar(this.NS * 1.5); fx.visible = true;
        this.field.add(fx); this._fxPool.push(fx); stash.push(fx);
      }
    }
    // Forzar compilacion: compile() prepara los shaders sin pintar a pantalla.
    try { this.renderer.compile(this.scene, this.camera); } catch (_) {}
    // SUBIR TEXTURAS A LA GPU por adelantado. compile() solo prepara shaders;
    // las texturas (flechas/gemas/glow/receptores) se suben en su PRIMER uso
    // real, lo que causaba un tiron de ~250ms en el primer frame de la cancion.
    // initTexture() las sube ahora, durante la pantalla de carga.
    try {
      const texes = [this._glowTex, ...this._arrowTex, ...this._receptorTex];
      // Precargar texturas de hold PIU si las hay (evita hitch al primer hold).
      if (this._holdMatPiu) { for (const hm of this._holdMatPiu) { if (hm.map) texes.push(hm.map); } }
      for (const t of texes) { if (t) this.renderer.initTexture(t); }
    } catch (_) {}
    // Ocultar todo lo pre-creado (vuelve a los pools listo para usarse).
    for (const m of stash) m.visible = false;
  }

  // dt>0 => la nota aun no llega: esta DEBAJO del receptor y SUBE hacia el.
  // Aplica los modificadores visuales (vanish, appear, tornado, drunk, reverse,
  // mini, mega, niebla, gravedad, neon, rebote).
  positionNote(entry, dt) {
    const dir = this.scrollDir;
    const dist0 = dt * this.unitsPerSec;             // distancia lineal
    // Gravedad: la distancia crece cuadraticamente (aceleracion).
    const dist = this.mods.gravedad ? dist0 * (1 + dist0 * 0.04) : dist0;
    const y = this.recY - dir * dist;
    const baseX = this._laneX(entry.lane);
    const xoff = this._modXOffset(entry.lane, dist);
    let op = this._modOpacity(dist);

    // Mini/Mega: escala segun distancia al receptor.
    let noteScale = this.NS;
    if (this.mods.mini) noteScale = this.NS * (0.3 + 0.7 * Math.min(1, dist / 12));
    else if (this.mods.mega) noteScale = this.NS * (1.5 - 0.8 * Math.min(1, dist / 12));

    // Niebla: la opacidad parpadea sinusoidalmente.
    if (this.mods.niebla) op *= 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(dt * 8 + entry.lane));

    // Rebote: desplazamiento lateral sinusoidal extra (independiente de tornado).
    let rebX = 0;
    if (this.mods.rebote) rebX = Math.sin(dt * 3 + entry.lane * 1.5) * this.PS * 0.6;

    // Bombas: se camuflan como flecha normal hasta ~1/3 del recorrido
    // (~5 unidades del receptor), ahi se revelan con un destello.
    const isBomb = entry.note && entry.note.bomb;
    const BOMB_REVEAL_DIST = 5.0;
    const isRevealed = !isBomb || dist <= BOMB_REVEAL_DIST;
    if (isBomb && !entry._bombRevealed && isRevealed) {
      entry._bombRevealed = true;
      entry._bombFlash = 1.0;
    }
    if (isBomb && isRevealed) {
      const pulse = 1 + 0.2 * Math.sin(dt * 10 + entry.lane);
      noteScale = this.NS * 1.15 * pulse;
      entry.mesh.rotation.z += 0.03;
      if (entry._bombFlash > 0) {
        noteScale *= 1 + entry._bombFlash * 0.3;
        entry._bombFlash -= dt * 3;
        if (entry._bombFlash < 0) entry._bombFlash = 0;
      }
    }

    // Items (?): brillo pulsante y rotacion suave.
    const isItem = entry.note && entry.note.item;
    if (isItem) {
      noteScale = this.NS * (1 + 0.15 * Math.sin(dt * 5 + entry.lane));
      entry.mesh.rotation.z += 0.02;
    }

    // Ciego: invisible cuando supera el tiempo de visibilidad.
    if (this.mods._blindTime > 0 && dist > this.mods._blindTime * this.unitsPerSec) op = 0;

    entry.mesh.position.x = baseX + xoff + rebX;
    entry.mesh.position.y = y;
    entry.mesh.scale.setScalar(noteScale);
    // Nota fallada: material GRIS compartido por carril (sin clonar) para que
    // pase de largo atenuada sin tocar la opacidad de las notas buenas.
    // Bombas: antes de revelarse se ven como nota normal (camufladas), despues
    // usan _bombMat y nunca se atenuan a gris (el jugador debe verlas).
    if (entry.missed && !isBomb) {
      entry.mesh.material = this._missMat[entry.lane];
      op = Math.min(op, 0.4);
      entry.mesh.material.opacity = op;
    } else {
      // Items, bombas reveladas o nota normal: cada una con su material.
      entry.mesh.material = isItem ? this._itemMat : ((isBomb && isRevealed) ? this._bombMat : this._noteMat[entry.lane]);
      entry.mesh.material.opacity = op;
      entry.mesh.material.transparent = true;
    }
    // 'twirl': la flecha gira sobre si misma conforme sube (efecto vistoso).
    if (this.mods.twirl) {
      entry.mesh.rotation.z = this._laneRot(entry.lane) + dist * 0.6;
    }
    // Las notas falladas pueden pasar bajo el receptor (y > recY si scrollDir<0),
    // asi que ampliamos el rango visible hacia "despues" del receptor.
    const pastMargin = entry.missed ? 4.5 : 2.5;
    const onField = this.scrollDir < 0
      ? (y < this.recY + 14 && y > this.recY - pastMargin)
      : (y > this.recY - 14 && y < this.recY + pastMargin);
    entry.mesh.visible = onField && op > 0.02;

    // Neon: estela brillante detras de la nota (glow extra dinamico).
    if (this.mods.neon && !entry._neonGlow) {
      entry._neonGlow = new THREE.Mesh(this._unitGeo, this._glowMat[entry.lane].clone());
      entry._neonGlow.renderOrder = 2;
      entry._neonGlow.scale.setScalar(this.NS * 2);
      this.field.add(entry._neonGlow);
    }
    if (entry._neonGlow) {
      entry._neonGlow.position.set(entry.mesh.position.x, y - dir * 0.4, 0.05);
      entry._neonGlow.visible = entry.mesh.visible;
      entry._neonGlow.material.opacity = op * 0.35;
    }

    if (entry.body) {
      entry.body.position.x = baseX + this._modXOffset(entry.lane, dist + entry.holdLen / 2) + rebX;
      entry.body.position.y = y - dir * entry.holdLen / 2;
      // Holds bomba: cuerpo rojo al revelarse (igual que la cabeza).
      if (isBomb && isRevealed) {
        entry.body.material = this._bombHoldMat;
      }
      entry.body.material.opacity = 0.45 * Math.min(1, op + 0.3);
      entry.body.visible = onField;
    }
  }

  // Marca una nota (entry) como fallada para que se dibuje atenuada y pase de
  // largo bajo el receptor en vez de desvanecerse.
  markMissed(entry) { if (entry) entry.missed = true; }

  // Desplazamiento lateral por modificadores de movimiento.
  _modXOffset(lane, dist) {
    let x = 0;
    const t = this._now || 0;
    if (this.mods.tornado) {
      // Serpenteo lateral que avanza con la distancia (giro tipo PIU).
      const phase = dist * 0.5 + lane * 1.2;
      x += Math.sin(phase) * this.PS * 1.1;
    }
    if (this.mods.drunk) {
      // Onda suave que ademas se mueve con el tiempo (ola "borracha").
      const phase = dist * 0.28 + t * 1.5 + lane * 0.8;
      x += Math.sin(phase) * this.PS * 0.6;
    }
    return x;
  }

  // Opacidad por modificadores de visibilidad (vanish / appear).
  _modOpacity(dist) {
    // dist: 0 en el receptor, crece hacia el spawn. Rango visible ~0..14.
    if (this.mods.vanish) {
      // Desaparecen un poco por encima del centro del campo (hacia el receptor):
      // visibles desde el spawn (abajo) y se desvanecen al llegar ~dist 5-7.5.
      const f = (dist - 5) / 2.5;          // invisible <5, fade 5-7.5, visible >7.5
      return Math.max(0, Math.min(1, f));
    }
    if (this.mods.appear) {
      // Invisibles abajo; aparecen al cruzar un poco arriba de la mitad.
      const f = 1 - (dist - 5) / 2.5;
      return Math.max(0, Math.min(1, f));
    }
    if (this.mods.hidden) {
      // Opuesto a vanish: visibles abajo (lejos) y se ocultan al ACERCARSE al
      // receptor (arriba). Desaparecen cerca de dist ~2.5-5.
      const f = (dist - 2.5) / 2.5;        // invisible <2.5, fade 2.5-5, visible >5
      return Math.max(0, Math.min(1, f));
    }
    return 1;
  }

  // Mientras se sostiene un hold acertado: fija la cabeza en el receptor y
  // encoge el cuerpo (la cola sigue subiendo hacia el receptor).
  holdProgress(entry, remaining) {
    if (!entry || !entry.mesh) return;
    const dir = this.scrollDir;
    entry.mesh.position.x = this._laneX(entry.lane); // anclado, sin tornado en receptor
    entry.mesh.position.y = this.recY;
    entry.mesh.material.opacity = 1;
    entry.mesh.visible = true;
    if (entry.body) {
      const lenUnits = Math.max(0, remaining * this.unitsPerSec);
      entry.body.position.x = this._laneX(entry.lane);
      entry.body.scale.y = lenUnits;
      entry.body.position.y = this.recY - dir * lenUnits / 2;
      entry.body.material.opacity = 0.45;
      entry.body.visible = lenUnits > 0.01;
    }
  }

  removeNote(entry) {
    if (!entry || !entry.mesh) return;
    // Restaurar el material compartido del carril en la malla antes de
    // reciclarla (la fallada usaba el material gris compartido, no se libera).
    if (entry.missed) entry.mesh.material = this._noteMat[entry.lane];
    entry.missed = false;
    entry.mesh.visible = false;
    this._notePool.push(entry.mesh);
    entry.mesh = null;
    // Neon: limpiar el glow extra creado por efecto neon.
    if (entry._neonGlow) {
      this.field.remove(entry._neonGlow);
      entry._neonGlow.material.dispose();
      entry._neonGlow = null;
    }
    if (entry.body) {
      entry.body.visible = false;
      this._holdPool.push(entry.body);
      entry.body = null;
    }
  }

  flashReceptor(lane) { this.receptors[lane].flash = 1; }

  // ----- Destello al acertar (pooled) -----
  // Animacion tranquila: un destello corto que aparece y se desvanece rapido,
  // con muy poca expansion (no un anillo grande que crece y se queda).
  hitEffect(lane) {
    if (this._glowEnabled === false) return; // en calidad baja, sin destellos
    let mesh = this._fxPool.pop();
    if (!mesh) {
      const mat = new THREE.MeshBasicMaterial({ map: this._glowTex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false });
      mesh = new THREE.Mesh(this._unitGeo, mat);
      mesh.renderOrder = 4;
      this.field.add(mesh);
    }
    mesh.material.color = this._laneColors[lane];
    mesh.material.opacity = 0.7;
    mesh.position.set(this._laneX(lane), this.recY, 0.3);
    mesh.scale.setScalar(this.NS * 1.5);
    mesh.visible = true;
    this.effects.push({ mesh, t: 0, dur: 0.16 });
  }

  setBeatPulse(v) {
    // El parpadeo por beat resultaba molesto: lo dejamos desactivado.
    // La banda de pulso queda oculta y la barra de receptores con brillo fijo.
    if (this.pulseMat) this.pulseMat.opacity = 0;
  }

  // Coloca las lineas de beat subiendo hacia los receptores, ancladas a los
  // beats reales de la cancion. Da sensacion de ritmo y profundidad.
  updateBeatLines(now, bpm, offset) {
    if (!this._beatLines || bpm <= 0) return;
    const beatSec = 60 / bpm;
    const ups = this.unitsPerSec;
    // Primer beat visible justo por debajo (o en) los receptores.
    const beatsSinceOffset = Math.floor((now - offset) / beatSec);
    for (let i = 0; i < this._beatLineCount; i++) {
      const beatIndex = beatsSinceOffset + i;
      const beatTime = offset + beatIndex * beatSec;
      const dt = beatTime - now;            // >0: aun por llegar
      const y = RECEPTOR_Y - dt * ups;
      const bl = this._beatLines[i];
      if (y < RECEPTOR_Y - 13 || y > RECEPTOR_Y + 1) { bl.visible = false; continue; }
      bl.visible = true;
      bl.position.y = y;
      // Cada 4 beats (compas) la linea es mas brillante.
      bl.material.opacity = (beatIndex % 4 === 0) ? 0.5 : 0.22;
    }
  }

  update(dt) {
    this._now = (this._now || 0) + dt;
    for (let i = 0; i < this.receptors.length; i++) {
      const r = this.receptors[i];

      // Pop del receptor rapido y sutil (se siente responsivo, no pesado).
      r.flash = Math.max(0, r.flash - dt * 7);
      r.mesh.material.opacity = 0.55 + r.flash * 0.45;
      r.mesh.scale.setScalar(this.NS * (1 + r.flash * 0.08));
      r.glow.material.opacity = 0.22 + r.flash * 0.35;
      r.glow.scale.setScalar(this.NS * 2.4 * (1 + r.flash * 0.1));
      // Marco de combo: late suave si esta activo (mas intenso en niveles altos).
      if (r.ring && r.ring.visible) {
        const tier = this._comboTier;
        const pulse = 0.5 + 0.5 * Math.sin(this._now * (3 + tier));   // 0..1
        r.ring.material.opacity = (0.45 + 0.4 * pulse) * (0.7 + 0.1 * tier);
        r.ring.scale.setScalar(this.NS * (1.18 + 0.06 * pulse + r.flash * 0.08));
      }
      // Guitar: el disco del dock se enciende al presionar.
      if (this._fretButtons && this._fretButtons[i]) {
        this._fretButtons[i].material.opacity = 0.32 + r.flash * 0.6;
        this._fretButtons[i].scale.setScalar(this.NS * 1.25 * (1 + r.flash * 0.12));
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      const p = e.t / e.dur;
      if (p >= 1) {
        e.mesh.visible = false;
        this._fxPool.push(e.mesh);
        this.effects.splice(i, 1);
      } else {
        // Fade rapido (ease-out) y expansion minima: destello limpio.
        const ease = 1 - (1 - p) * (1 - p);
        e.mesh.material.opacity = 0.7 * (1 - ease);
        e.mesh.scale.setScalar(this.NS * (1.5 + p * 0.5));
      }
    }
  }

  render() {
    if (this._shared) return;   // el SharedRenderer pinta ambos stages junto
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    this._lastDraws = this.renderer.info.render.calls;
    this._lastTris = this.renderer.info.render.triangles;
  }

  // Pinta SOLO este stage en su viewport (lo usa el SharedRenderer en VS local).
  renderToViewport() {
    const vp = this._vp;
    const pr = this.renderer.getPixelRatio();
    this.renderer.setViewport(vp.x, vp.y, vp.w, vp.h);
    this.renderer.setScissor(vp.x, vp.y, vp.w, vp.h);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);
  }

  stats() {
    return { draws: this._lastDraws || 0, tris: this._lastTris || 0, pr: this.renderer.getPixelRatio(), quality: this._quality };
  }

  // Devuelve el nombre del renderer GL real (GPU o software). Critico para
  // diagnosticar: si contiene "llvmpipe"/"swiftshader"/"software", el navegador
  // NO esta usando la GPU (render por software) -> fps bajos con pocos draws.
  glRenderer() {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return String(r || "desconocido");
    } catch (_) { return "desconocido"; }
  }

  isSoftwareRender() {
    const r = this.glRenderer().toLowerCase();
    return r.includes("llvmpipe") || r.includes("swiftshader") || r.includes("software") || r.includes("softpipe");
  }

  // Ajusta la calidad. "auto" parte de un cap medio; el juego puede bajarla
  // sola si detecta FPS bajo (ver RhythmGame). Los glows (additive blending)
  // son lo mas caro en GPUs debiles, asi que en "low" se desactivan.
  setQuality(q) {
    this._quality = q;
    const prByQ = { low: 1.0, medium: 1.25, high: 2.0, auto: 1.5 };
    this._maxPR = prByQ[q] != null ? prByQ[q] : 1.5;
    if (this._shared) {
      // En modo compartido, el pixel ratio lo controla el SharedRenderer
      // (es comun a los dos tableros). Aqui solo ajustamos los glows.
      this._shared.setQuality(q);
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._maxPR));
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight || 1);
    }

    const glowOn = q !== "low";
    if (this.receptors) for (const r of this.receptors) r.glow.visible = glowOn;
    this._glowEnabled = glowOn;
    if (this.pulseMat) this.pulseMat.visible = q !== "low";
  }

  _onResize() {
    // En modo compartido, el SharedRenderer recalcula viewports y avisa con
    // setViewportAspect(); aqui no tocamos el renderer.
    if (this._shared) { this._shared.layout(); return; }
    const w = this.container.clientWidth;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    const aspect = w / h;
    this._applyCameraForAspect(aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._maxPR));
    this.renderer.setSize(w, h);
  }

  // Ajuste de camara segun aspecto (compartido por modo normal y viewport).
  _applyCameraForAspect(aspect) {
    if (this.vertical) {
      // Encaja los carriles a lo ANCHO de la pantalla (flechas lo mas grandes
      // posible) y deja el dock de receptores cerca del fondo.
      const fov = this.camera.fov * Math.PI / 180;
      const spanX = this.laneCount * this.PS;          // ancho de los carriles
      const horiz = spanX / 0.98;                       // ocupar ~98% del ancho (flechas grandes)
      const vert = horiz / Math.max(0.35, aspect);
      let z = vert / (2 * Math.tan(fov / 2));
      z = Math.max(7, Math.min(z, 32));
      const vh = 2 * z * Math.tan(fov / 2);             // alto visible en unidades
      const recYWorld = 0.5 - RECEPTOR_Y;               // y mundial del receptor
      const cy = recYWorld + vh * 0.30;                 // receptor ~20% desde abajo (sobre el dock)
      this.camera.position.set(0, cy, z);
      this.camera.lookAt(0, cy, 0);
      return;
    }
    if (this.guitar) {
      const back = aspect >= 1.2 ? 0 : (aspect >= 0.9 ? 1.5 : 3.5);
      this.camera.position.set(this._camPos.x, this._camPos.y, this._camPos.z + back);
    } else {
      this.camera.position.set(this._camPos.x, this._camPos.y, this._cameraZForAspect(aspect));
    }
    this.camera.lookAt(this._camLook);
  }

  // El SharedRenderer informa el aspecto/tamano del viewport de este stage.
  setViewport(x, y, w, h) {
    this._vp = { x, y, w, h };
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;
    this._applyCameraForAspect(aspect);
    this.camera.updateProjectionMatrix();
  }

  // Distancia de camara segun el aspecto: angostos -> mas lejos (cabe todo).
  _cameraZForAspect(aspect) {
    if (aspect >= 1.4) return 14;        // pantalla completa / ancha
    if (aspect >= 1.0) return 16;        // moderado
    if (aspect >= 0.75) return 18.5;     // pantalla dividida (VS local)
    return 21;                            // muy angosto
  }

  dispose() {
    window.removeEventListener("resize", this._onResize);
    this._unitGeo.dispose();
    this._glowTex.dispose();
    this._arrowTex.forEach((t) => t.dispose());
    this._receptorTex.forEach((t) => t.dispose());
    this._noteMat.forEach((m) => m.dispose());
    this._glowMat.forEach((m) => m.dispose());
    if (this._missMat) this._missMat.forEach((m) => m.dispose());
    if (this._shared) {
      // El renderer es compartido: no lo destruimos aqui (lo hace el
      // SharedRenderer cuando ambos stages terminan). Solo nos quitamos.
      this._shared.remove(this);
      return;
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

// Renderer WebGL UNICO para VS local: ambos tableros se pintan como dos
// viewports (mitades) del mismo lienzo. Asi el navegador compone UN solo
// contexto GL por frame (no dos), lo que da el margen necesario para que el
// teclado no provoque tirones. El lienzo ocupa todo #boards.
export class SharedRenderer {
  constructor(container, opts) {
    this.container = container;
    this.opts = opts || {};
    this.transparentBg = !!this.opts.transparentBg;   // para ver el video de fondo
    const w = container.clientWidth || window.innerWidth || 1280;
    const h = container.clientHeight || window.innerHeight || 720;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: this.transparentBg });
    if (!this.renderer || !this.renderer.getContext()) {
      throw new Error("WebGL no disponible en este navegador/PC.");
    }
    this._maxPR = 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._maxPR));
    this.renderer.setSize(w, h);
    this.renderer.info.autoReset = false;
    this.renderer.sortObjects = false;
    if (this.transparentBg) this.renderer.setClearColor(0x000000, 0);
    else this.renderer.setClearColor(0x05060f, 1);
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.inset = "0";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    container.appendChild(this.renderer.domElement);
    this.stages = [];   // [izquierda, derecha]
    this._onResize = this.layout.bind(this);
    window.addEventListener("resize", this._onResize);
  }

  add(stage) { this.stages.push(stage); }
  remove(stage) { this.stages = this.stages.filter((s) => s !== stage); }

  setQuality(q) {
    const prByQ = { low: 1.0, medium: 1.25, high: 2.0, auto: 1.5 };
    this._maxPR = prByQ[q] != null ? prByQ[q] : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._maxPR));
    this.layout();
  }

  // Recalcula tamano del lienzo y reparte viewports (mitad y mitad).
  layout() {
    const w = this.container.clientWidth || window.innerWidth || 1280;
    const h = this.container.clientHeight || window.innerHeight || 720;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._maxPR));
    this.renderer.setSize(w, h);
    // THREE.setViewport/setScissor reciben pixeles CSS (multiplican por el
    // pixelRatio internamente), asi que repartimos en pixeles CSS.
    const halfW = Math.floor(w / 2);
    if (this.stages[0]) this.stages[0].setViewport(0, 0, halfW, h);
    if (this.stages[1]) this.stages[1].setViewport(halfW, 0, w - halfW, h);
  }

  // Pinta ambos tableros en una sola pasada (dos viewports del mismo lienzo).
  render() {
    this.renderer.info.reset();
    if (this.transparentBg) this.renderer.setClearColor(0x000000, 0);
    else this.renderer.setClearColor(0x05060f, 1);
    this.renderer.clear();
    for (const s of this.stages) s.renderToViewport();
    this.renderer.setScissorTest(false);
    this._lastDraws = this.renderer.info.render.calls;
  }

  dispose() {
    window.removeEventListener("resize", this._onResize);
    this.stages = [];
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
