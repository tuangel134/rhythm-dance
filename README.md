<div align="center">

# 🎵 Rhythm Dance

### Un juego de ritmo en 3D que convierte **tu propia música** en pistas jugables — en PC y en el teléfono, sin depender de nadie.

Dos juegos en un mismo motor: **flechas estilo Pump It Up / DDR** y **gemas estilo Guitar Hero**.
Pon tu música (MP3, FLAC, WAV…), el juego la analiza, detecta el ritmo y **genera el mapa de notas**
sincronizado al beat. Con IA de colocación de pasos, editor propio, multijugador online/local y una
**app de Android que corre el juego completo offline en el celular**.

[![Build Escritorio](https://github.com/tuangel134/rhythm-dance/actions/workflows/build.yml/badge.svg)](https://github.com/tuangel134/rhythm-dance/actions/workflows/build.yml)
[![Build APK](https://github.com/tuangel134/rhythm-dance/actions/workflows/android.yml/badge.svg)](https://github.com/tuangel134/rhythm-dance/actions/workflows/android.yml)
[![Descargas](https://img.shields.io/github/v/release/tuangel134/rhythm-dance?label=descargar)](https://github.com/tuangel134/rhythm-dance/releases/latest)
[![Licencia](https://img.shields.io/badge/licencia-GPL--3.0-blue)](LICENSE)

**Windows · Linux · macOS · Android**

</div>

---

## 📑 Contenido

- [¿Qué es?](#-qué-es)
- [Características principales](#-características-principales)
- [Instalación rápida (PC)](#-instalación-rápida-pc)
- [App de Android](#-app-de-android)
- [Cómo se genera una pista (IA + DSP)](#-cómo-se-genera-una-pista-ia--dsp)
- [Controles](#-controles)
- [Modos de juego](#-modos-de-juego)
- [Multijugador](#-multijugador)
- [Editor de pistas](#-editor-de-pistas)
- [Arquitectura](#-arquitectura)
- [Desarrollo desde el código fuente](#-desarrollo-desde-el-código-fuente)
- [Rendimiento](#-rendimiento)
- [Pruebas](#-pruebas)
- [Apoya el proyecto](#-apoya-el-proyecto)
- [Créditos y licencia](#-créditos-y-licencia)

---

## 🎮 ¿Qué es?

Rhythm Dance es un juego de ritmo que **no depende de descargar packs de canciones**: usa tu
biblioteca de música. El motor analiza el audio, encuentra el pulso y coloca las notas donde
suenan los golpes reales de la canción, no en una rejilla rígida.

Existe en dos formas que **comparten el mismo cliente web** (todo lo visual y la lógica de juego):

- **En PC** — un pequeño servidor Node hace el trabajo pesado (escanear carpetas, decodificar con
  ffmpeg, generar la pista) y el navegador (o una ventana Electron) dibuja el juego en 3D con three.js.
- **En Android** — la app embebe el juego web completo en un WebView y **reimplementa todo el
  backend en Kotlin**, así que corre **100% offline en el teléfono**, sin PC y sin internet.

---

## ✨ Características principales

### Generación de pistas
- **Análisis multibanda** (bajo · medios · agudos · platillos) con detección de onsets por flujo espectral.
- **Detección de BPM robusta**: autocorrelación + *comb* de armónicos (refuerza el tempo fundamental y
  evita errores de octava) + *prior* de tempo log-normal + refinado por rejilla.
- **Anclaje de fase al bajo** (el kick define el pulso) y **seguimiento de beats por programación
  dinámica** (tolera variaciones de tempo/rubato).
- **Densidad por género** (electrónica, clásica, pop, rock, hip-hop) con límite de notas/segundo por
  dificultad, para que una canción rápida no se vuelva imposible.
- **Imantado a los onsets**: las notas caen exactamente sobre el ataque del sonido.
- **Notas dobles/triples, jumps simultáneos y holds** (notas largas) detectados automáticamente.

### IA de colocación de pasos
- **Mini red neuronal (MLP de 2 capas)** entrenada para elegir el carril de cada nota con buen flujo de
  pies, mezclada con la heurística clásica. Entrenador en `tools/train-stepmodel.mjs` (Adam + gramática
  de patrones).
- **Reentrenamiento en el propio teléfono**: la app hace *fine-tuning* del modelo con tus mapeos del
  editor (backprop + Adam en Kotlin), así el mapeo se adapta a tu estilo con el uso.

### Jugabilidad
- **Dos juegos en un motor**: Rhythm Dance (flechas que suben) y Guitar Hero (gemas que bajan por un mástil).
- **6 dificultades** (Fácil → Experto) más modos especiales (**Locura, Supervivencia, Caos, Ciego,
  Ruleta, Precisión**) con velocidad y efectos que cambian solos según el ritmo.
- **Barra de vida** con combos positivos y negativos, **notas bomba** e **ítems**.
- **Barra de duración de la canción** en pantalla durante el gameplay.
- **Menú de pausa** con botón visible (útil en móvil) y por tecla (Esc/Espacio): reanudar, reiniciar,
  practicar desde aquí, ajustes, salir. Pausa audio y video de fondo sin romper la sincronía.
- **Efectos visuales estilo PIU**: Vanish, Appear, Hidden, Tornado, Twirl, Drunk, Mirror, Random,
  Reverse, Mini, Mega y más.
- **Video de fondo** sincronizado con la música (se adapta a vertical en móvil).
- **Calibración de latencia** audio/vídeo, **vibración/haptics**, **gráfica de precisión** en resultados.

### Meta-juego
- **Perfil de jugador** con UUID, nivel, XP y estadísticas por canción/dificultad.
- **35 logros** desbloqueables (común / raro / épico / legendario) con notificaciones.
- **Daily Challenge** determinista por fecha, con leaderboard y racha.
- **Replays** (se guarda tu mejor partida y se puede reproducir) y **Modo Fantasma** (compite contra
  tu propio récord con HUD de ventaja en vivo).
- **Ranking mundial por canción** vía GitHub Contents API (con cache y rate-limit).
- **Carrera de Combos**, **Modo Práctica** (rango + velocidad variable + loop) y **Tutorial interactivo**.

### Biblioteca y audio
- **Apuntar el juego a una carpeta de música** (modo carpeta exclusiva) y navegador de carpetas integrado.
- **Reproducción de alta calidad** (FLAC/WAV/MP3) con **normalización de volumen por pico**.
- **Carátulas**: arte embebido si existe; si no, **carátula procedural** (SVG en PC / Canvas en Android,
  degradado por hash del nombre + inicial).
- **Stepcharts reales**: lee **.sm/.ssc** (StepMania) y **.ucs** (Pump It Up).
- **Community Charts**: comparte/descarga mapeos (nunca audio) emparejados por huella de la canción.
- **Descargador de música** integrado (yt-dlp).
- **Respaldo/exportación** de mapeos, puntajes y ajustes.

### Rendimiento y controles
- **FPS desbloqueados** (120/144 Hz) con timing por delta-time + reloj de audio; **calidad adaptativa**.
- **Cache de pistas** generadas (replays instantáneos).
- **Teclado, mando/USB/tapete y táctil**; toda la interfaz se navega con el control.
- **Modo vertical estilo Piano Tiles** en móvil (dock de flechas abajo).

---

## ⬇️ Instalación rápida (PC)

### Opción 1 — Instalador listo (descarga el binario)

**Windows** — en **PowerShell**:
```powershell
irm https://raw.githubusercontent.com/tuangel134/rhythm-dance/main/install.ps1 | iex
```

**Linux / macOS** — en una **terminal**:
```bash
curl -fsSL https://raw.githubusercontent.com/tuangel134/rhythm-dance/main/install.sh | bash
```

Detecta tu sistema y baja el paquete correcto: `.exe` (Windows), `.deb` o `.AppImage` (Linux), `.dmg` (macOS).
También puedes bajarlo a mano desde **[Releases](https://github.com/tuangel134/rhythm-dance/releases/latest)**.

### Opción 2 — Desde el código fuente
```bash
git clone https://github.com/tuangel134/rhythm-dance.git
cd rhythm-dance
npm install
npm start        # navegador  → http://localhost:5174
# o:
npm run app      # app de escritorio (Electron)
```
Necesitas **Node.js 18+**, **ffmpeg/ffprobe** y opcionalmente **yt-dlp** para el descargador.

---

## 📱 App de Android

La app (en `android/`, hecha en **Kotlin**) ofrece **tres modos** desde su pantalla de inicio:

| Modo | Qué hace | ¿Necesita PC? |
|------|----------|:---:|
| **▶ Jugar en el teléfono** | Corre el **juego web completo** embebido en un WebView, con **todo el backend reimplementado en Kotlin** (`ApiHandler`): escanea tu carpeta de música, decodifica el audio (MediaCodec), genera la pista con IA, y guarda perfil, puntajes, logros y replays. **100% offline.** | ❌ No |
| **🎮 Juego nativo simple (beta)** | Un motor de ritmo nativo minimalista (flechas que caen, receptores abajo). | ❌ No |
| **🖥 Conectar a una PC (WiFi)** | Cliente WebView que se conecta al motor de escritorio por WiFi para usar tu biblioteca completa, el editor y el VS online. | ✅ Sí |

**Detalles del modo offline:**
- Elige (o apunta a) una **carpeta de música** del teléfono vía Storage Access Framework.
- La pista se **genera en el propio celular** (onsets, BPM con comb de armónicos, imantado, holds).
- **Modo vertical estilo Piano Tiles** optimizado para pulgares, con dock de flechas abajo.
- **Reentrenamiento de la IA en el dispositivo** al importar/guardar mapeos.
- Carátulas procedurales, subtítulos con artista·duración, caché de charts para replays instantáneos.

**Instalación:** descarga `RhythmDance.apk` de [Releases](https://github.com/tuangel134/rhythm-dance/releases/latest)
(lo construye GitHub Actions con el workflow `android.yml`) e instálalo. Requiere **Android 8.0+**.

---

## 🧠 Cómo se genera una pista (IA + DSP)

```
audio (PCM)
   │
   ├─▶ Envolvente de onset multibanda (flujo espectral: bajo / medios / agudos)
   │
   ├─▶ BPM  = autocorrelación + comb de armónicos + prior de tempo + refinado por rejilla
   │
   ├─▶ Fase = anclaje al bajo (kick)  ·  Beats = programación dinámica (Ellis 2007)
   │
   ├─▶ Rejilla de subdivisiones derivada de los beats reales
   │
   ├─▶ Colocación de notas: energía por celda + límite de densidad por género/dificultad
   │        └─ Carril elegido por MLP (red neuronal) mezclada con heurística de pies
   │
   ├─▶ Imantado a onsets  ·  Detección de holds (sostenidos)  ·  Jumps
   │
   └─▶ Beatmap { bpm, offset, duration, notes[] }  → cacheado
```

El mismo algoritmo corre en Node (`server/generator.js` + `server/stepmodel.js`) y en Kotlin
(`ChartGenerator.kt` + `StepModel.kt`), compartiendo los pesos entrenados en `server/model/`.

---

## 🕹️ Controles

- **Pump It Up (5 paneles)**: `Z X C V B` · numpad `1 7 5 9 3` (mismas posiciones físicas).
- **DDR (4 flechas)**: `← ↓ ↑ →` o `A S W D`.
- **Mando/USB/tapete**: conéctalo y pulsa un botón (dpad, botones de cara, stick en diagonal).
- **Navegación total con control**: dpad/stick mueve el foco, **A** selecciona, **B** vuelve, **LB/RB**
  cambian de pestaña. Se puede jugar de principio a fin sin teclado ni ratón.
- **Móvil**: toques en pantalla (un carril por columna) o control bluetooth.
- **Teclas y botones configurables** por juego y por jugador, con prueba de ghosting del teclado.

---

## 🎯 Modos de juego

- **Solitario** con las 6 dificultades y los modos especiales.
- **Carrera de Combos** — gana el combo más largo (multiplicador hasta x3.5, vida desactivada).
- **Práctica** — elige rango (inicio/fin), velocidad (0.25x–1.0x) y loop, con audio a velocidad variable.
- **Modo Fantasma** — compite contra tu mejor replay con HUD de ventaja.
- **Daily Challenge** — misma canción para todos cada día, con leaderboard y racha.
- **Tutorial interactivo** con metrónomo sintético (sin descargas).

---

## 🌐 Multijugador

### VS Online (1 contra 1)
- **Por enlace** (recomendado): crea sala + enlace para compartir; tu amigo lo abre y entra directo
  (no necesita la canción, se reproduce desde tu PC).
- **LAN**: tu amigo escribe tu IP local y el código de sala.
- Al estilo **mejor de 3** con marcador de serie, **tablero del rival en tiempo real** y **revancha**.

> El servidor de salas no usa autenticación: pensado para jugar con amigos de confianza (LAN/VPN o
> enlace temporal). No lo expongas abiertamente a internet.

### VS Local (2 jugadores, misma PC)
- Pantalla dividida, mejor de 3, cada jugador con su **propia velocidad y efectos**.
- J1: `Z X C V B` / `A S W D`. J2: numpad `1 7 5 9 3` / flechas. Con dos mandos, uno por jugador.

---

## ✏️ Editor de pistas

- **Grabación en cámara lenta**: toca las teclas al ritmo y el editor cuantiza los acordes.
- **Edición fina 2D** (timeline): arrastra para mover, doble click para agregar/borrar, `[` `]` ajustan
  holds, rueda hace scroll y `Ctrl+rueda` hace zoom.
- **Editor táctil en móvil** con stage vertical y dock de flechas enlazado a la entrada.
- **Elige chart grabado vs pista IA** por canción, y borra charts desde el menú.
- Guardar un chart dispara el **reentrenamiento de la IA** (en PC y en el teléfono).

---

## 🧱 Arquitectura

```
electron/            App de escritorio (arranca el motor + ventana Chromium)
  main.cjs

server/              Motor en Node (Express + ws) — 22 módulos
  index.js           API REST + streaming de audio + carátulas + WebSocket de salas
  decode.js          Decodifica audio a PCM con ffmpeg
  generator.js       Generador de pistas (multibanda, BPM comb, beat tracking DP)
  stepmodel.js       Mini red neuronal (MLP) de colocación de pasos
  trainStep.js       Reentrenamiento del modelo al guardar en el editor
  library.js         Escaneo/gestión de carpetas de música (incl. carpeta exclusiva)
  meta.js            Metadatos (artista/título/duración/BPM) vía ffprobe
  downloader.js      Búsqueda y descarga con yt-dlp
  rooms.js           Salas VS (relay 1v1 con revancha)
  smparser.js        Lee stepcharts .sm/.ssc (StepMania) y .ucs (Pump It Up)
  songsettings.js    Ajustes por canción, puntajes y charts del editor
  user.js            Perfil (UUID, nivel, XP, stats)
  achievements.js    Motor de logros
  daily.js           Desafío diario
  replays.js         Almacenamiento de replays
  leaderboard.js     Ranking mundial (GitHub Contents API)
  community*.js       Community charts (índice + catálogo)
  tools.js           Resolución multiplataforma de ffmpeg/ffprobe/yt-dlp

src/                 Cliente web (ESM + three.js 0.160, empaquetado con Vite)
  main.js            Orquestación: pestañas, flujo de juego, VS, carga
  render/stage.js    Escena 3D (perspectiva, upscroll, pooling, efectos, modo vertical)
  game/game.js       Lógica: reloj suave, ventana activa de notas, juicios, vida, hooks
  game/editor.js     Editor (grabación + cuantización)
  game/timeline.js   Edición fina 2D
  game/rivalboard.js Tablero del rival en tiempo real
  audio/player.js    Reproductor Web Audio (alta calidad + normalización por pico)
  input/input.js     Teclado + Gamepad (5 y 4 paneles)
  input/uinav.js     Navegación de la UI con control
  net/online.js      Cliente WebSocket del modo VS

android/             App Android (Kotlin)
  .../HomeActivity.kt         Pantalla de inicio (3 modos)
  .../GameWebViewActivity.kt  Juego web completo embebido (offline)
  .../ApiHandler.kt           Backend Node reimplementado en Kotlin
  .../MainActivity.kt         Cliente WebView a una PC
  .../game/ChartGenerator.kt  Generador de pistas nativo
  .../game/StepModel.kt       Inferencia de la red neuronal
  .../game/StepTrainer.kt     Fine-tuning on-device

tools/train-stepmodel.mjs     Entrenador del modelo de pasos (Adam)
.github/workflows/            CI: build.yml (escritorio) · android.yml (APK)
```

---

## 🛠️ Desarrollo desde el código fuente

```bash
npm install

npm start            # servidor + navegador (http://localhost:5174)
npm run dev:client   # solo Vite (frontend con HMR)
npm run app          # app de escritorio (Electron)
npm run train:model  # reentrenar el modelo de IA de pasos

# Empaquetar instalables (en dist-app/)
npm run dist:linux   # AppImage + .deb
npm run dist:win     # NSIS + portable
npm run dist         # Linux + Windows

# Android
bash build-android.sh   # compila el cliente web, lo embebe y arma el APK debug
```

Los instaladores publicados en Releases ya **incluyen ffmpeg, ffprobe y yt-dlp** (los descarga y
empaqueta GitHub Actions), así que funcionan en una PC sin nada instalado.

---

## ⚡ Rendimiento

- Solo se procesa una **ventana activa** de notas por frame (no toda la canción).
- **Pooling** de mallas/efectos; geometría y texturas compartidas.
- Pixel ratio acotado y **calidad adaptativa** (baja sola si los FPS caen).
- Contador de **FPS / ms de CPU / draws** en pantalla durante el juego.
- Las pistas generadas se **cachean** (no se regeneran la próxima vez).

---

## 🧪 Pruebas

```bash
npm test                          # suite con Vitest
node test/verify-generator.mjs    # alineación al beat
node test/verify-multiband.mjs    # detección de pulso
node test/verify-rooms.mjs        # flujo completo de sala VS
node test/verify-editor.mjs       # cuantización del editor
```

---

## 💛 Apoya el proyecto

Si disfrutas el juego y quieres ayudar a que siga mejorando:

**PayPal** — [`paypal.me/tuangel1346`](https://paypal.me/tuangel1346) · `tuangel1346@gmail.com`

**Bitcoin** — `bc1q5nrv64jchep3hpqptvwmume8rkw68937zftfpa`

¡Gracias! 🙏

---

## 📜 Créditos y licencia

- Todo el arte visual del juego es **procedural** (generado por código).
- Descargas vía **yt-dlp**; el usuario es responsable del uso del contenido y de respetar los derechos
  de autor.
- Licencia **[GPL-3.0](LICENSE)**.
