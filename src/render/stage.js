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
const TILT = -0.28;         // inclinacion del campo (perspectiva)

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
    // Dimensiones por modo. Guitar Hero: mastil mas angosto, gemas mas chicas y
    // mucha mas perspectiva (mas inclinacion) para el look clasico.
    this.PS = this.guitar ? 1.05 : PANEL_SPACING;   // separacion entre carriles
    this.NS = this.guitar ? 0.92 : NOTE_SCALE;      // tamano de nota/gema
    this.tilt = this.guitar ? -0.62 : TILT;         // inclinacion del campo
    // Si hay video de fondo, el canvas 3D es transparente para verlo detras.
    this.transparentBg = !!this.opts.transparentBg;
    // Modificadores visuales (estilo Pump It Up). Todos son SOLO visuales:
    // no cambian el timing ni la dificultad de la pista.
    this.mods = Object.assign({
      vanish: false,   // las notas desaparecen a media subida
      appear: false,   // las notas solo se ven cerca del receptor
      hidden: false,   // se ocultan al acercarse al receptor (arriba)
      tornado: false,  // serpentean lateralmente
      twirl: false,    // las flechas giran sobre si mismas al subir
      drunk: false,    // ondulan como olas
      mirror: false,   // invierte los carriles izquierda<->derecha
      random: false,   // remapea los carriles al azar (shuffle visual)
      reverse: false,  // el scroll va al reves (de arriba hacia abajo)
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
      // Guitar Hero clasico: camara baja y cercana mirando hacia el fondo del
      // mastil, que se aleja con fuerte perspectiva. Trastes cerca abajo.
      this._camPos = new THREE.Vector3(0, 2.4, 9.5);
      this._camLook = new THREE.Vector3(0, 3.2, -6);
    } else {
      this._camPos = new THREE.Vector3(0, 0.6, 14);
      this._camLook = new THREE.Vector3(0, 1.1, 0);
    }
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camLook);

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

    // Grupo inclinado (el "highway")
    this.field = new THREE.Group();
    this.field.rotation.x = this.tilt;
    this.field.position.y = 0.5;
    this.scene.add(this.field);

    // Recursos compartidos
    this._unitGeo = new THREE.PlaneGeometry(1, 1);
    this._glowTex = makeGlowTexture();
    this._arrowTex = [];
    this._receptorTex = [];
    this._noteMat = [];
    this._glowMat = [];
    for (let i = 0; i < laneCount; i++) {
      this._arrowTex[i] = this.guitar ? makeGemTexture(this.layout[i].color) : makeArrowTexture(this.layout[i].color);
      this._receptorTex[i] = this.guitar ? makeFretTexture(this.layout[i].color) : makeReceptorTexture(this.layout[i].color);
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
    // Colores cacheados por lane (evita new THREE.Color() en cada acierto).
    this._laneColors = this.layout.map((d) => new THREE.Color(d.color));

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
  // flechas suben (salvo 'reverse', que invierte). Guitar + reverse se cancela.
  get recY() {
    const down = this.guitar ? !this.mods.reverse : this.mods.reverse;
    return down ? -RECEPTOR_Y : RECEPTOR_Y;
  }
  // Direccion de scroll: +1 las notas SUBEN hacia el receptor, -1 BAJAN.
  get scrollDir() {
    const down = this.guitar ? !this.mods.reverse : this.mods.reverse;
    return down ? -1 : 1;
  }

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
  }

  _buildReceptors() {
    this.receptors = [];
    for (let i = 0; i < this.laneCount; i++) {
      const def = this.layout[i];
      const holder = new THREE.Group();
      holder.position.set(this._laneX(i), this.recY, 0.1);

      // halo
      const glow = new THREE.Mesh(this._unitGeo, this._glowMat[i].clone());
      glow.scale.setScalar(this.NS * 2.4);
      glow.material.opacity = 0.25;
      holder.add(glow);

      // contorno de flecha
      const mat = new THREE.MeshBasicMaterial({ map: this._receptorTex[i], transparent: true, opacity: 0.6, depthTest: false });
      const mesh = new THREE.Mesh(this._unitGeo, mat);
      mesh.rotation.z = def.rot;
      mesh.scale.setScalar(this.NS);
      mesh.renderOrder = 2;
      holder.add(mesh);

      this.field.add(holder);
      this.receptors.push({ mesh, glow, def, flash: 0 });
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
    mesh.material = this._noteMat[note.lane];
    mesh.rotation.z = this.layout[note.lane].rot;
    mesh.position.set(this._laneX(note.lane), -50, 0.2);
    mesh.scale.setScalar(this.NS);
    mesh.visible = true;

    const entry = { mesh, note, lane: note.lane, body: null };

    // Cuerpo del hold (barra que conecta inicio y fin de la nota larga).
    if (note.duration && note.duration > 0) {
      let body = this._holdPool.pop();
      if (!body) {
        body = new THREE.Mesh(this._unitGeo, this._holdMat[note.lane]);
        body.renderOrder = 2; // detras de la cabeza
        this.field.add(body);
      }
      body.material = this._holdMat[note.lane];
      body.rotation.z = 0;
      const lenUnits = note.duration * this.unitsPerSec;
      body.scale.set(this.NS * 0.5, lenUnits, 1);
      body.position.set(this._laneX(note.lane), -50, 0.15);
      body.visible = true;
      entry.body = body;
      entry.holdLen = lenUnits;
    }
    return entry;
  }

  // dt>0 => la nota aun no llega: esta DEBAJO del receptor y SUBE hacia el.
  // Aplica los modificadores visuales (vanish, appear, tornado, drunk, reverse).
  positionNote(entry, dt) {
    const dir = this.scrollDir;
    const dist = dt * this.unitsPerSec;            // distancia al receptor (>0 = aun no llega)
    const y = this.recY - dir * dist;              // reverse invierte la direccion
    const baseX = this._laneX(entry.lane);
    const xoff = this._modXOffset(entry.lane, dist);
    const op = this._modOpacity(dist);

    entry.mesh.position.x = baseX + xoff;
    entry.mesh.position.y = y;
    entry.mesh.material = this._noteMat[entry.lane];
    entry.mesh.material.opacity = op;
    entry.mesh.material.transparent = true;
    // 'twirl': la flecha gira sobre si misma conforme sube (efecto vistoso).
    if (this.mods.twirl) {
      entry.mesh.rotation.z = this.layout[entry.lane].rot + dist * 0.6;
    }
    const onField = this.scrollDir < 0
      ? (y < this.recY + 14 && y > this.recY - 2.5)
      : (y > this.recY - 14 && y < this.recY + 2.5);
    entry.mesh.visible = onField && op > 0.02;

    if (entry.body) {
      // La cola es mas tarde en el tiempo => mas lejos del receptor.
      entry.body.position.x = baseX + this._modXOffset(entry.lane, dist + entry.holdLen / 2);
      entry.body.position.y = y - dir * entry.holdLen / 2;
      entry.body.material.opacity = 0.45 * Math.min(1, op + 0.3);
      entry.body.visible = onField;
    }
  }

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
    entry.mesh.visible = false;
    this._notePool.push(entry.mesh);
    entry.mesh = null;
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
    for (const r of this.receptors) {
      // Pop del receptor rapido y sutil (se siente responsivo, no pesado).
      r.flash = Math.max(0, r.flash - dt * 7);
      r.mesh.material.opacity = 0.55 + r.flash * 0.45;
      r.mesh.scale.setScalar(this.NS * (1 + r.flash * 0.08));
      r.glow.material.opacity = 0.22 + r.flash * 0.35;
      r.glow.scale.setScalar(this.NS * 2.4 * (1 + r.flash * 0.1));
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
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    this._lastDraws = this.renderer.info.render.calls;
    this._lastTris = this.renderer.info.render.triangles;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._maxPR));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight || 1);

    const glowOn = q !== "low";
    if (this.receptors) for (const r of this.receptors) r.glow.visible = glowOn;
    this._glowEnabled = glowOn;
    if (this.pulseMat) this.pulseMat.visible = q !== "low";
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    const aspect = w / h;
    if (this.guitar) {
      // Mastil angosto: si la pantalla es estrecha, alejar un poco para que
      // quepan los 5 trastes sin recortar.
      const back = aspect >= 1.2 ? 0 : (aspect >= 0.9 ? 1.5 : 3.5);
      this.camera.position.set(this._camPos.x, this._camPos.y, this._camPos.z + back);
    } else {
      this.camera.position.set(this._camPos.x, this._camPos.y, this._cameraZForAspect(aspect));
    }
    this.camera.lookAt(this._camLook);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this._maxPR));
    this.renderer.setSize(w, h);
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
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
