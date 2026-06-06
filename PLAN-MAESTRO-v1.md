# PLAN MAESTRO — Rhythm Dance v1.0 (Features Seleccionadas)

> 18 features solicitados. Plan de implementación detallada con archivos a tocar, contratos de mensajes, orden de ejecución, estimaciones y dependencias.

## ÍNDICE
- [0. Resumen ejecutivo](#0-resumen-ejecutivo)
- [1. Salas online mejoradas (chat + lobby) — F1](#1-f1-mejoras-de-salas-online)
- [2. Matchmaking por rango + skill — F2 (RECHAZADO)](#2-f2-matchmaking-rechazado-fuera-de-alcance)
- [3. Sala de espera con chat en lobby — F3](#3-f3-mejoras-del-lobby-con-chat)
- [4. Equipos 2v2 / 3v3 — F4](#4-f4-equipos-y-modos-de-grupo)
- [5. Battle Royale — F5](#5-f5-battle-royale)
- [6. Carrera de combos — F6](#6-f6-modo-carrera-de-combos)
- [7. Modo Historia / Boss Fight — F7](#7-f7-modo-historia--boss-fight)
- [8. Modo Tutorial — F8](#8-f8-modo-tutorial)
- [9. Puzzle mode (Stepmania) — F9](#9-f9-modo-puzzle-colocador-de-notas)
- [10. Boss Fight cooperativo — F10](#10-f10-boss-fight-cooperativo)
- [11. Perfil con stats — F11](#11-f11-perfil-con-estadísticas)
- [12. Logros — F12](#12-f12-logros)
- [13. Daily challenge — F13](#13-f13-desafío-diario)
- [14. Tienda de skins (RECHAZADO — sin tienda) — F14](#14-f14-tienda-de-skins-rechazado)
- [15. Customización de personaje (RECHAZADO) — F15](#15-f15-customización-de-personaje-rechazado)
- [16. Replays — F16](#16-f16-replays)
- [17. Leaderboards globales — F17](#17-f17-leaderboards-globales)
- [18. Ghosts — F18](#18-f18-ghost-rival)
- [19. Soporte de mods del usuario (RECHAZADO) — F19](#19-f19-soporte-de-mods-rechazado)
- [20. Calibración input lag (FUSIONADO con 22) — F20](#20-f20-input-lag-fusionado)
- [21. Editor mejorado (ya existe la base, no se rehace) — F21](#21-f21-editor-mejorado-ya-existente)
- [22. Modo práctica (loop, velocidad) — F22](#22-f22-modo-práctica)
- [Plan de releases](#plan-de-releases-por-orden-de-impacto)
- [Estimación global](#estimación-global)

> Nota: el usuario pidió los items 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, 22.
> Hay 16 items reales (los marcados con **RECHAZADO** en el índice no fueron pedidos y se listan solo para完整性).
> Lo que pidio el usuario, mapeado a la lista de mi propuesta anterior:
> - 1 (Mejor multiplayer) → aquí lo expandimos en F1, F3, F4
> - 3 (Sala de espera con chat) → F3
> - 4 (Equipos 2v2/3v3) → F4
> - 5 (Battle Royale) → F5
> - 6 (Carrera de combos) → F6
> - 7 (Modo Historia) → F7
> - 8 (Modo Tutorial) → F8
> - 9 (Puzzle) → F9
> - 10 (Boss Fight cooperativo) → F10
> - 11 (Perfil con stats) → F11
> - 12 (Logros) → F12
> - 13 (Daily challenge) → F13
> - 16 (Replays) → F16
> - 17 (Leaderboards globales) → F17
> - 18 (Ghosts) → F18
> - 22 (Modo práctica) → F22
> Total: 16 features.

---

## 0. Resumen ejecutivo

**Stack actual (relevante para el plan):**
- Frontend: ESM, Three.js 0.160, Vite. Sin React/Vue. `src/main.js` orquesta todo (3153 líneas). `src/game/game.js` (719) maneja la lógica de juego con reloj suave Web Audio. `src/render/stage.js` (1270) maneja el 3D.
- Backend: Node + Express + `ws` (WebSocket ya disponible). `server/index.js` (807) expone REST + WebSocket. `server/rooms.js` (193) ya tiene relay 1v1.
- Persistencia local: `~/.rhythm-dance/songdata.json` (scores, settings, custom charts). Pre-cache de beatmaps en `~/.rhythm-dance/charts/*.json`.
- Identidad actual: `playerName` (string libre en localStorage). No hay cuenta, no hay UUID.
- Resultados: `recordScore` en `server/songsettings.js:59` ya guarda `score/accuracy/grade/difficulty/maxCombo/date`.
- Chart: `data.customCharts[songId][difficulty@lanes]` con `{laneCount, notes, duration, bpm}`.

**Estrategia general:**
1. Añadir identidad persistente (UUID por jugador) en `server/user.js` y `clientId` en `prefs.js`. Es la base de TODO lo demás (stats, leaderboards, replays, ghosts).
2. Sistema de "meta-game" server-side: `~/.rhythm-dance/profile.json` (perfil), `~/.rhythm-dance/achievements.json` (logros), `~/.rhythm-dance/replays/` (archivos), `~/.rhythm-dance/daily/` (rotación diaria).
3. Para leaderboards globales: usar el repo de GitHub de la comunidad como "host" de un `index.json` + `entries.json` por canción (igual que `communityCatalog.js` pero para puntajes). Sin servidor central.
4. Para salas online mejoradas: extender `server/rooms.js` con chat, ready, kick. Reusar el WebSocket existente.
5. Para modos nuevos: cada uno es una "GameMode" que envuelve `RhythmGame` con reglas distintas. Se selecciona en la pantalla de selección de modo (extender `index.html` y `main.js`).

**Compatibilidad:**
- Mantener `package.json`, no añadir deps nuevas pesadas. Solo `crypto`, `fs`, `path`, `ws` (ya está).
- Mantener el patrón de Spanish en UI/comentarios.
- Mantener el relay WS existente (no romper salas 1v1 actuales).

---

## 1. F1: Mejoras de salas online

**Objetivo:** Mejorar la sala actual 1v1: añadir chat, lista de jugadores, kick/ban, ready-check, timeouts.

### Estado actual
- `server/rooms.js` ya implementa create/join/chooseSong/ready/start/progress/finish/rematch/leave. Mensajes JSON.
- `src/net/online.js` ya envuelve el WebSocket.
- `src/main.js:2117-2350` orquesta la UI de online (lobby + room view).

### Cambios

#### Backend (`server/rooms.js`)
- **Mensajes nuevos** (extender el switch):
  - `t:"chat"`, `text` → broadcast a la sala (excepto el que envía, para evitar eco si quieres; o incluir autor, decidimos incluir autor)
  - `t:"kick"`, `targetName` → solo el host puede kickear; cierra el WS del target
  - `t:"ban"`, `targetName` → idem + mete el `name` en `room.banned` durante la vida de la sala
  - `t:"readyCheck"`, `timeoutMs` → host pide ready-check; servidor broadcast a la sala
  - `t:"host"` → cede el rol de host a otro jugador (cambio de host)
- **Estado de sala**:
  - `room.chatLog = []` (últimos 50 mensajes) → al entrar, enviar el log al nuevo jugador en el mensaje `joined`
  - `room.banned = new Set()` (case-insensitive)
  - `room.readyCheck = { startedAt, acks: Set() }`
  - `room.host = ws` (referencia al socket del host actual, inicialmente el que creó)
- **Timeout de inactividad**: `setInterval` cada 60s revisa `ws.readyState` y elimina los muertos. (Ya hay uno de 30s; ajustar).
- **Límite flexible**: actualmente 2 jugadores. Para Battle Royale (F5) necesitaremos hasta 8. Hacer `maxPlayers` por sala: `create` con `maxPlayers` opcional, `join` valida `room.players.length < room.maxPlayers`. Default 2.
- **Reanudar tras reconexión**: permitir que un jugador que se desconectó re-ingrese con el mismo nombre en los próximos 30s; mantener `room.players[]` con un TTL.

#### Cliente (`src/net/online.js`)
- Añadir métodos: `sendChat(text)`, `kick(name)`, `ban(name)`, `changeHost(name)`.
- Añadir listeners: `onChat`, `onPeerKicked`, `onHostChanged`, `onReadyCheck`.
- Buffer de salida para chat offline (si WS está reconectando).

#### UI (`index.html` + `src/main.js`)
- En `onlineRoom`, añadir un panel lateral con:
  - Lista de jugadores con badges (host/guest/ready) y botones de kick/ban/ceder host (solo visibles para el host).
  - Caja de chat: input + lista de mensajes. Scroll auto. Enter envía.
  - Botón "Ready check" (solo host): marca los jugadores que no respondieron en X segundos con ⚠.
- Estilos en `style.css`: nuevo componente `.room-chat`, `.room-players-list`.
- Indicador de estado de conexión: 🟢 conectado / 🟡 reconectando / 🔴 desconectado.

#### Mensaje `joined` ampliado
- `room.chatLog` (array) + `room.maxPlayers` + `room.bannedNames` (solo para host).

### Archivos a tocar
- `server/rooms.js` (refactor: ~80 líneas añadidas, +30% tamaño)
- `src/net/online.js` (+10 métodos/listeners, ~150 líneas)
- `index.html` (~50 líneas HTML nuevo)
- `src/main.js` (~300 líneas para chat + player list, en zona ~2117-2400)
- `src/style.css` (~100 líneas para chat)

### Estimación: 1.5 días (12 h).

---

## 3. F3: Mejoras del lobby con chat

**Objetivo:** Chat global de lobbies (no atado a una sala). Ver lobbies públicos disponibles.

### Estado actual
- Solo se puede crear sala privada o entrar con código. No hay lista de salas públicas.

### Cambios

#### Backend (`server/rooms.js` + nuevo `server/lobby.js`)
- Separar `lobby` de `room`:
  - `lobby.rooms` = array de salas públicas (`{code, name, hostName, maxPlayers, currentPlayers, difficulty, songName, hasPassword, createdAt}`).
  - Salas con `public: true` (default) aparecen; `public: false` solo con código.
- Mensajes nuevos:
  - `t:"listLobby"` → server responde `t:"lobbyList"`, `rooms: [...]`
  - `t:"joinLobby"`, `roomCode` → equivalente a join por lobby (sin escribir el código a mano)
  - `t:"lobbyUpdated"` → server broadcast a todos los WS en `/ws/lobby` cuando se crea/elimina/llena una sala
- `server/index.js`: montar dos WSS: `/ws` (juego, ya existe) y `/ws/lobby` (anuncios). Reusar el `WebSocketServer`.

#### Cliente
- Nuevo panel "Salas públicas" en la pestaña Online:
  - Lista con `hostName`, `song`, `difficulty`, `players/maxPlayers`, botón "Unirse".
  - Auto-refresh cada 5s.
  - Checkbox "Mostrar mi sala en el lobby público" en el form de crear.
- Chat global opcional: si lo piden, canal `#global` en el mismo `/ws/lobby`. Decidir si entra en esta feature o se omite; por alcance, **se omite** (solo listado de salas).

#### Archivos
- `server/lobby.js` (nuevo, ~120 líneas)
- `server/index.js` (~30 líneas para el 2º WSS)
- `src/net/online.js` (ya cubre el WS; añadir métodos `listLobby`, `joinLobby`, listener `lobbyUpdated`)
- `index.html` (~40 líneas)
- `src/main.js` (~150 líneas)
- `src/style.css` (~50 líneas)

### Estimación: 1 día (8 h). **Puede fusionarse con F1** (mismo archivo, mismo WS).

---

## 4. F4: Equipos y modos de grupo

**Objetivo:** Más allá del 1v1: 2v2 (equipos), 3v3, FFA (todos contra todos). Mantener el mismo modelo de relay tonto.

### Estado actual
- `server/rooms.js` solo permite 2 jugadores y 1 partida por sala.
- `localVs` en `main.js` solo soporta 2 tableros lado a lado.

### Cambios

#### Backend
- Salas de hasta **8 jugadores** (con `maxPlayers=8`).
- Cada jugador tiene `team` (entero 0..N) o `null` si FFA.
- Mensajes:
  - `t:"create"`, `maxPlayers`, `mode` ("ffa" | "team2v2" | "team3v3" | "royale"), `teamMode`
  - `t:"setTeam"`, `team` → jugador se asigna a un team
  - `t:"autoBalance"` → servidor reparte jugadores en teams equilibrados
- Resultado final: el servidor calcula ganadores por equipo (suma de scores) y devuelve `t:"matchResult"`, `teams: {teamId: {score, players: [...]}}`.
- En el `progress` se sigue mandando individual; el agregado se calcula al final.

#### Cliente
- En el setup de online, nuevo campo "Modo" con dropdown: FFA / 2v2 / 3v3 / Battle Royale.
- En VS local: nuevo botón "VS Local 2v2 (4 tableros en grid 2x2)" o "VS Local 3v3" si quieres ir a 6. **Limitación de espacio**: 6 tableros es inviable en una pantalla. **Recomendación**: 2v2 en grid 2x2 con tableros más pequeños.
- Nueva vista de resultados con equipos: tabla por equipo + mejor jugador de cada uno.

#### Limitación práctica
- 2v2 local = 4 InputManager, 4 SharedRenderer? No: un SharedRenderer con 4 viewports.
- Ver `src/render/stage.js:1200 class SharedRenderer` — necesita extenderse a 4 viewports (grid 2x2) y a 1-2-3-4-6 viewports según modo.
- FFA 8 jugadores online = 8 SharedRenderer en 8 navegadores, **no en local**.

#### Archivos
- `server/rooms.js` (~80 líneas, restructurar `room.players[]` con `team`)
- `src/render/stage.js` (extender `SharedRenderer` con `viewport = "2"|"3"|"4"|"6"`, layout dinámico)
- `src/main.js` (nuevos paths: `playLocalTeams`, `startOnlineTeams`)
- `index.html` (selector de modo en `onlineLobby`)

### Estimación: 2 días (16 h). Es una de las features más complejas.

---

## 5. F5: Battle Royale (8 jugadores, 1 canción, último con vida gana)

**Objetivo:** 8 jugadores en línea, misma canción, **el último con vida > 0 gana**. Si nadie tiene vida al final, gana el de mayor accuracy.

### Estado actual
- `localVs` y `vs` (online) son 1v1.

### Cambios

#### Backend
- `room.mode = "royale"`, `room.maxPlayers = 8`.
- `room.started = true` cuando arranca; el `progress` se envía igual.
- `room.eliminated = new Set()`: cuando un cliente notifica `life=0` y `allowFail=true`, se añade a eliminados.
- Mensajes:
  - `t:"eliminated"`, `name` → server broadcast
  - `t:"alive"`, `count`, `lastAlive: name|null` → server broadcast cada vez que alguien cae
- `matchResult`: el último en `alive` (o el de mayor accuracy si todos cayeron) gana.

#### Cliente
- Nueva card en `modeSelect` (no en el menú actual, en una sección "Multijugador"): "⚔ Battle Royale (8 jugadores)".
- Setup: crear sala con `mode="royale"`, `maxPlayers=8`. La sala espera hasta 8; el host puede forzar inicio con `>=2` (configurable).
- HUD nuevo: lista lateral de 8 avatares con barras de vida, tachado en caídos.
- En el resultado final: corona al ganador, tabla de eliminados en orden.

#### Limitaciones
- 8 jugadores requiere una sala online. Local no es viable.
- Latencia: el relay ya la absorbe. Los markers llegan cada 200ms.

#### Archivos
- `server/rooms.js` (nuevo mode "royale", +60 líneas)
- `src/net/online.js` (+5 métodos/listeners)
- `index.html` (nueva card en `modeSelect`, +20 líneas)
- `src/main.js` (nuevo `startOnlineRoyale`, +200 líneas)
- `src/style.css` (estilos de la lista de jugadores, +60 líneas)

### Estimación: 1.5 días (12 h). Comparte infraestructura con F4.

---

## 6. F6: Modo Carrera de Combos

**Objetivo:** Gana quien tenga el **combo más largo al final** de la canción (no el score).

### Estado actual
- El score es la métrica principal.

### Cambios

#### Game mode wrapper
- Nuevo `GameMode` interface en `src/game/gamemodes.js` (nuevo archivo).
- Modos: `"score"` (default), `"combo"`, `"survival"`, `"battle-royale"`, `"practice"`.
- `RhythmGame` recibe `settings.gameMode = "combo-race"`. En `_onPress` y `_update`, no cambia nada (sigue contando aciertos), pero `_end` calcula el ganador con `maxCombo` en vez de `score`.
- En VS local: si el modo es `"combo-race"`, el ganador se decide por `maxCombo` (con desempate por accuracy).
- En online: el `matchResult` ya devuelve `score` y `accuracy`; añadir `maxCombo` y la decisión se hace cliente-lado como ahora.

#### UI
- En el menú de dificultad, nuevo subgrupo "Modo de juego" (radio buttons o dropdown):
  - Score (default)
  - Carrera de combos
  - Supervivencia (1 vida)
  - Práctica (ver F22)
- En VS local setup, mismo selector.
- En resultados: el "ganador" badge usa el criterio del modo.

#### Archivos
- `src/game/gamemodes.js` (nuevo, ~80 líneas; define interface y constantes)
- `src/game/game.js` (~30 líneas: `this.gameMode = "combo-race"` afecta `_end` y resultados)
- `src/main.js` (~100 líneas: nuevo selector UI, lógica de resultado)
- `index.html` (~30 líneas en modo local + online)

### Estimación: 0.5 día (4 h). Es un cambio pequeño pero toca varios sitios.

---

## 7. F7: Modo Historia / Boss Fight

**Objetivo:** Campaña single-player con capítulos. Cada capítulo es 1-3 canciones. Hay "boss fights" donde las notas tienen patrones especiales (bombas masivas, muros de notas que cambian la jugabilidad).

### Estado actual
- Hay single player con librería libre. No hay campaña.

### Cambios

#### Estructura de campaña
- Nuevo archivo `server/campaigns/default.json` con 5-8 capítulos.
- Cada capítulo:
  - `id`, `title`, `unlockRequirement` (capítulos previos, o level mínimo), `songIds` (1-3), `bossType` (opcional).
  - `bossType`:
    - `"bomb-storm"`: 30% de bombas
    - `"speed-ramp"`: velocidad sube 0.5x cada 15s
    - `"jumps-only"`: solo JUMPS (todas las notas son parte de un acorde)
    - `"tornado"`: mod tornado permanente + velocidad x2
    - `"mirror-mirror"`: laneCount*2-1 lanes (notas en carriles espejo)
- Nuevos archivos de assets: `public/assets/campaigns/chapter1.json` etc.

#### Cliente
- Nueva card en `modeSelect`: "📖 Modo Historia".
- Pantalla de "selección de capítulo": grid de tarjetas con candado/abre, nombre, mejor resultado.
- Al jugar un capítulo:
  - Carga cada canción en secuencia.
  - Pantalla de transición entre canciones (estilo JRPG: "¿Preparado?").
  - Al final del capítulo, pantalla de "Victoria / Derrota" con recompensas (XP para el perfil).
- Boss fight: el `RhythmGame` recibe `settings.bossType`; en `start()` aplica los modificadores.

#### Recompensas (integra con F11 perfil)
- XP por completar capítulo: 50 base + 10 por canción.
- Logros (F12): "Termina el capítulo 1 sin fallar", etc.

#### Archivos
- `public/assets/campaigns/default.json` (nuevo, ~200 líneas con 5 capítulos)
- `src/game/campaign.js` (nuevo, ~150 líneas: lógica de capítulos)
- `src/main.js` (nuevo path `playCampaign(chapterId)`, ~200 líneas)
- `index.html` (nueva card + pantalla de capítulos, ~80 líneas)
- `src/style.css` (~80 líneas: estilos de capítulo)

### Estimación: 2.5 días (20 h). Es contenido + UI, mucho.

---

## 8. F8: Modo Tutorial

**Objetivo:** Enseñanza paso a paso: un dedo, dos dedos, holds, slides, jumps, mods.

### Estado actual
- Nada de tutorial. El usuario aprende a base de prueba y error.

### Cambios

#### Estructura
- Nueva carpeta `public/assets/tutorial/lesson1.json` ... `lesson7.json`.
- Cada lección: `{id, title, description, lessons: [{intro: "Texto", pattern: "single-4beat" | "two-4beat" | ...}]}`.
- El frontend renderiza el texto + una pista generada ESPECIAL (no del audio, sino de un patrón fijo sobre el audio del usuario o silencio).
- **Decisión**: usar un beat sintético (metrónomo con 4 tipos de samples `.wav` pregrabados) y NO depender de la biblioteca del usuario. Esto garantiza reproducibilidad.

#### Backend mínimo
- `server/tutorial.js` (nuevo, ~100 líneas): sirve los JSON de lecciones + los `.wav` metrónomo.
- Endpoint `GET /api/tutorial/lessons` → lista de lecciones con `id/title/description/lessonCount`.
- Endpoint `GET /api/tutorial/lesson/:id/audio/:note` → genera un `.wav` con `ffmpeg` (sine wave con envolvente ADSR) o sirve pregrabados.

#### Cliente
- Nueva card en `modeSelect`: "🎓 Tutorial".
- Pantalla de "lecciones": lista con candado para progresiva (la N se abre al completar la N-1).
- Al jugar una lección:
  - Audio de metrónomo (4 tonos: grave/medio/agudo/muy agudo).
  - Notas generadas según el patrón de la lección.
  - Texto de ayuda en la parte superior ("MANTÉN la tecla por 2 beats").
  - Botón "Siguiente" o "Reintentar lección".
  - Al completar: marca como hecho, abre la siguiente.

#### Generador de audio tutorial
- Genera `.wav` con `ffmpeg`:
  - `ffmpeg -f lavfi -i "sine=frequency=X:duration=0.1" -af "volume=0.5,afade=in:0:0.005,afade=out:0.04:0.06" out.wav`
  - 4 tonos: 200, 400, 600, 800 Hz. Generados al primer arranque y cacheados en `~/.rhythm-dance/tutorial/`.

#### Archivos
- `public/assets/tutorial/` (4 .wav pregrabados, ~4 KB c/u)
- `server/tutorial.js` (nuevo, ~120 líneas)
- `server/index.js` (~20 líneas de endpoints)
- `src/main.js` (~250 líneas: lógica de tutorial, navegación entre lecciones)
- `index.html` (~60 líneas)

### Estimación: 2 días (16 h).

---

## 9. F9: Modo Puzzle (Stepmania)

**Objetivo:** Modo tipo StepMania: el jugador COLOCA las notas en un timeline vacío y luego las juega. Sirve para aprender a leer charts y diseñar manualmente.

### Estado actual
- Hay Editor (`src/game/editor.js`) que graba con audio. El puzzle es diferente: **NO** hay audio, o hay un loop, y el jugador solo coloca notas en una grilla.

### Cambios

#### Modo puzzle
- **NO** usa `audio`.
- Genera un metrónomo: clicks cada beat durante 1 minuto (loop).
- La pantalla muestra una grilla 2D tipo timeline (reutilizar `TimelineEditor`).
- El jugador coloca notas haciendo click. Puede borrar, mover, ajustar hold.
- Botón "▶ Probar" → reproduce el patrón con el metrónomo + debe pisar las notas.
- Botón "💾 Guardar como challenge" → guarda en `~/.rhythm-dance/puzzles/` con `{title, author, notes, bpm}`.

#### Servidor
- `server/puzzles.js` (nuevo, ~80 líneas):
  - `listPuzzles()`, `getPuzzle(id)`, `savePuzzle(data)`, `deletePuzzle(id)`.
  - Almacenamiento: `~/.rhythm-dance/puzzles/<id>.json`. Index en `puzzles.json`.
- Endpoints:
  - `GET /api/puzzles`
  - `GET /api/puzzle/:id`
  - `POST /api/puzzle` (body con `{title, notes, bpm}`) → devuelve `{id}`
  - `DELETE /api/puzzle/:id`

#### Cliente
- Nueva card en `modeSelect`: "🧩 Puzzle".
- Pantalla con tabs: "Crear" / "Tus puzzles" / "Probar uno".
- "Crear": abre `TimelineEditor` con audio = null; muestra un metrónomo visual. El botón "Probar" usa `audioEl` con un `BufferSource` que genera ticks a 1 Hz × BPM/60.
- "Tus puzzles": lista de puzzles guardados, click → "Probar".
- "Probar uno": idem.

#### Limitaciones técnicas
- `audio` en `RhythmGame` es no-null en el constructor. Hay que pasar un dummy `AudioPlayer` con `buffer.duration = 0` y que `currentTime()` siga el reloj de pared.

#### Archivos
- `server/puzzles.js` (nuevo, ~120 líneas)
- `server/index.js` (~30 líneas)
- `src/game/puzzle.js` (nuevo, ~150 líneas: wrapper sobre TimelineEditor con metrónomo)
- `src/main.js` (~150 líneas: nueva pantalla, navegación)
- `index.html` (~50 líneas)

### Estimación: 1.5 días (12 h).

---

## 10. F10: Boss Fight cooperativo

**Objetivo:** 2-4 jugadores online (o local) **contra** un "jefe" con patrones especiales. El jefe tiene vida que baja con los aciertos del grupo. Si el jefe llega a 0, ganan. Si TODOS los jugadores mueren (vida=0), pierden.

### Estado actual
- `localVs` solo 1v1 con misma canción.

### Cambios

#### Modelo del jefe
- Una "entidad jefe" con `life = 1000`, `maxLife = 1000`.
- Por cada acierto de un jugador, el jefe pierde `damage` puntos (1-5 según el juicio).
- El jefe tiene "ataques" que aplican penalizaciones:
  - `slow-rain` (todas las notas bajan al 50% velocidad durante 5s)
  - `note-storm` (se duplican las notas durante 5s)
  - `mirror-attack` (mirror mod se aplica a todos)
  - `blind-flash` (hidden mod)
  - `life-drain` (todos pierden 1% de vida por segundo durante 5s)
- Patrón de ataques: cada 15s + cuando el jefe llega a 50% y 25% de vida.

#### Backend (online)
- `room.mode = "boss"`, `room.maxPlayers = 4`.
- El servidor lleva `room.boss = { life, maxLife, attackSchedule: [...] }`.
- Los clientes mandan `progress` (igual); el servidor agrega el daño al jefe.
- Mensajes:
  - `t:"bossHit"`, `damage`, `byName` → broadcast
  - `t:"bossAttack"`, `attackType`, `duration` → broadcast
  - `t:"bossDefeated"` / `t:"playersDefeated"` → fin de la partida
- El servidor calcula el resultado. **Esto es nuevo**: el servidor pasa de "tonto relay" a "tener estado del juego". Es la primera excepción. Documentarlo.

#### Cliente (local y online)
- Nueva card: "👹 Boss Fight".
- Modo local: 1-2 jugadores vs jefe (jefe en pantalla, 1-2 tableros).
- Modo online: 2-4 jugadores vs jefe.
- HUD del jefe: barra de vida grande arriba, sprite animado (placeholder: rectángulo con cara que cambia según la vida: 100% tranquilo, 50% enfadado, 25% furioso).
- Ataques del jefe: notificación visual central ("¡LLUVIA DE BOMBAS!") + efectos.
- Música: el jefe tiene su propio tema? **Decisión**: usar la canción del jugador + un audio de "tensión" superpuesto cuando el jefe está en 25%.

#### Generador de "jefes"
- `public/assets/bosses/boss1.json` con `{name, maxLife, attacks, musicSync: "boss-theme-1.ogg"}`.
- 3-4 bosses predefinidos.

#### Archivos
- `server/rooms.js` (extender con modo "boss", +100 líneas)
- `server/bosses.js` (nuevo, ~150 líneas: lógica de bosses, ataques)
- `src/main.js` (~300 líneas: nueva card, HUD del jefe, sincronización con servidor)
- `index.html` (~40 líneas)
- `src/style.css` (~80 líneas: HUD del jefe)

### Estimación: 3 días (24 h). Es **la feature más compleja** junto con F4.

---

## 11. F11: Perfil con estadísticas

**Objetivo:** Perfil persistente del jugador con stats globales: nivel, XP, total de partidas, mejor combo, accuracy promedio, canciones jugadas, tiempo total.

### Estado actual
- No hay perfil. Solo `playerName` (string) en `prefs.js`.

### Cambios

#### Identidad
- Generar UUID en primer arranque: `crypto.randomUUID()` → guardar en `localStorage` con key `rhythmdance.userId.v1`.
- Pasar `userId` a todas las requests de score/puntaje/leaderboard.
- Si no hay userId (modo legacy), generar uno en cliente y enviarlo en headers (`X-User-Id`).

#### Backend
- `server/user.js` (nuevo, ~120 líneas):
  - Carga/perfila: `~/.rhythm-dance/profile.json` con `{userId, displayName, level, xp, stats: {plays, perfect, ...}, achievements: []}`.
  - `recordPlay(songId, score, accuracy, grade, maxCombo, duration, game)` → actualiza stats.
  - `getProfile(userId)`, `getAllProfiles()` (para leaderboard local).
  - `addXp(amount)`: cada 100 XP = +1 nivel. Level se calcula por `Math.floor(xp / 100)`.
- `server/index.js`: extender `POST /api/score/:id` para que también llame a `user.recordPlay` y `user.addXp`.
- Cálculo de stats agregados:
  - `plays`: `plays + 1` cada partida (cualquier modo)
  - `totalScore`: suma de todos los `score`
  - `totalNotes`: suma de notas
  - `totalPerfect/Great/...`: distribución
  - `bestCombo`: `max(maxCombo, bestCombo)`
  - `bestScore`: `max(score, bestScore)` por canción
  - `totalPlaytime`: suma de `duration`
  - `accuracyAvg`: `sum(accuracy * totalNotes) / sum(totalNotes)`
  - `uniqueSongs`: set de songIds

#### Cliente
- Nuevo menú lateral o tab: "👤 Perfil".
- Pantalla:
  - Avatar (placeholder: gradiente con iniciales del nombre)
  - Nombre + nivel + barra de XP al siguiente nivel
  - Tarjetas de stats en grid: "Partidas jugadas", "Mejor combo", "Accuracy promedio", "Tiempo total", "Mejor S", "Canciones únicas", "XP total".
  - Lista de "Canciones favoritas" (top 5 por plays).
- Indicador de nivel en el topbar del menú principal: `LV 12 · 340 XP`.

#### Archivos
- `server/user.js` (nuevo, ~150 líneas)
- `server/index.js` (~30 líneas: integrar en `/api/score`)
- `server/songsettings.js` (~10 líneas: hookear en `recordScore`)
- `src/profile.js` (nuevo, ~100 líneas: cliente)
- `src/main.js` (~200 líneas: pantalla de perfil, integración)
- `index.html` (~80 líneas)

### Estimación: 1.5 días (12 h). Es la base de F12, F13, F16, F17.

---

## 12. F12: Logros

**Objetivo:** 30-50 achievements: "100 PERFECT seguidos", "Termina Locura sin fallar", "Juega 100 canciones", etc.

### Estado actual
- No hay logros.

### Cambios

#### Definición de logros
- `public/assets/achievements.json` (nuevo, ~300 líneas con 40 logros):
  ```json
  [
    {
      "id": "first_play",
      "title": "Primer paso",
      "description": "Termina tu primera canción",
      "icon": "👣",
      "rarity": "common",
      "condition": { "type": "plays", "gte": 1 }
    },
    ...
  ]
  ```
- Tipos de condición:
  - `plays` (>=, ==)
  - `perfects_total` (>=)
  - `combo_max` (>=)
  - `accuracy` (>=)
  - `songs_played_unique` (>=)
  - `plays_with_difficulty` (>= con difficulty=X)
  - `plays_with_mod` (>= con mod=X)
  - `perfect_streak_max` (>=)
  - `all_perfect_song` (== 100% accuracy)
  - `no_fail_streak_X` (>= N partidas sin fallar)
  - `playtime_hours` (>=)
  - `level` (>=)
  - `campaign_chapter` (terminar capítulo X)
  - `tutorial_complete` (terminar todas las lecciones)
  - `daily_streak` (>= N días consecutivos con daily challenge)
  - `ghost_download` (>= N fantasmas descargados)
  - `replay_watched` (>= N replays)
  - ... ~40 total

#### Backend
- `server/achievements.js` (nuevo, ~150 líneas):
  - `evaluate(profile, event)`: dado un evento (`{type: 'play_end', songId, score, accuracy, ...}`) y el perfil, devuelve la lista de logros desbloqueados nuevos.
  - `unlock(userId, achievementId)`: añade a `profile.achievements[]` con `date`.
  - Carga definiciones desde `public/assets/achievements.json` al arrancar.
  - `GET /api/achievements` → todas las definiciones con marca de desbloqueadas para el user actual.
  - `POST /api/achievements/eval` (interno) → se llama desde `user.recordPlay`.

#### Cliente
- Pantalla de logros: grid de tarjetas con candado/desbloqueado. Las desbloqueadas tienen color, las bloqueadas están oscurecidas con "?".
- Notificación al desbloquear: toast animado en la esquina inferior derecha durante 4s.
- Progreso en los que están a medio completar: "7/10 PERFECT seguidos".

#### Archivos
- `public/assets/achievements.json` (nuevo, ~300 líneas)
- `server/achievements.js` (nuevo, ~150 líneas)
- `server/user.js` (integración: ~20 líneas)
- `server/index.js` (endpoint ~20 líneas)
- `src/main.js` (~150 líneas: pantalla, notificación)
- `index.html` (~50 líneas)

### Estimación: 1.5 días (12 h). Depende de F11.

---

## 13. F13: Desafío diario

**Objetivo:** Una canción aleatoria al día con condiciones especiales (mods fijos, vida baja, etc.). Leaderboard local del día.

### Estado actual
- No hay daily.

### Cambios

#### Backend
- `server/daily.js` (nuevo, ~150 líneas):
  - `getTodaysChallenge()`: basado en el día (YYYY-MM-DD), usa un hash determinista para elegir:
    - 1 canción de la biblioteca
    - 1 dificultad
    - 1-2 mods fijos
    - Opcional: "Solo 1 vida", "Solo bombas" (variantes)
  - `getDailyLeaderboard(date)`: top 20 del día, calculado de `songsettings.scores`.
  - `submitDailyScore(userId, score, accuracy)`: guarda en `~/.rhythm-dance/daily/<date>.json`.
- Endpoint:
  - `GET /api/daily` → `{songId, songName, mods, variant, leaderboard: [...]}`.
  - `POST /api/daily/submit` → `{ok, rank}`.
- Cache en memoria del día actual (cambia a medianoche local).

#### Cliente
- Banner en el menú principal: "🎯 Desafío de hoy: [Canción] · [Mods] · [Tu mejor: X]". Click → juega.
- Pantalla del daily:
  - Canción + mods en grande.
  - Leaderboard del día (top 20 local, no global en esta versión).
  - Botón "Jugar".
- Streak: si juegas el daily N días seguidos, badge "🔥 Streak: N días".

#### Archivos
- `server/daily.js` (nuevo, ~150 líneas)
- `server/index.js` (~30 líneas)
- `src/main.js` (~150 líneas: banner, pantalla)
- `index.html` (~50 líneas)

### Estimación: 1 día (8 h). Depende de F11.

---

## 16. F16: Replays

**Objetivo:** Guardar una partida terminada (eventos en JSON) y poder reproducirla. Compartir con otros.

### Estado actual
- No hay replays.

### Cambios

#### Formato de replay
- Un replay es un JSON:
  ```json
  {
    "version": 1,
    "songId": "...",
    "songName": "...",
    "difficulty": "normal",
    "lanes": 5,
    "bpm": 120,
    "duration": 180,
    "notes": [...],
    "events": [
      { "t": 12.34, "type": "press", "lane": 2, "judgment": "PERFECT" },
      ...
    ],
    "mods": {},
    "score": 12345,
    "maxCombo": 100,
    "accuracy": 95.2,
    "grade": "S",
    "userId": "...",
    "userName": "...",
    "date": "..."
  }
  ```
- Tamaño: ~5-50 KB por replay (depende de la duración de la canción).

#### Backend
- `server/replays.js` (nuevo, ~120 líneas):
  - `saveReplay(userId, replay)`: guarda en `~/.rhythm-dance/replays/<userId>/<date>-<songHash>.json`.
  - `listReplays(userId, songId?)`: lista de replays del usuario.
  - `getReplay(userId, replayId)`: devuelve el JSON.
  - `deleteReplay(userId, replayId)`.
- Endpoints:
  - `POST /api/replays` (body con `replay`)
  - `GET /api/replays?userId=X&songId=Y`
  - `GET /api/replay/:userId/:replayId`
  - `DELETE /api/replay/:userId/:replayId`

#### Captura de eventos
- En `src/game/game.js`, añadir un hook `onEvent` que se llama en cada `_onPress` y `_registerError` con `{t, type, lane, judgment}`.
- `RhythmGame` recibe `settings.captureReplay = true` (o se activa por defecto). Almacena los eventos en `this.replayEvents`.
- En `_end`, el `onEnd` callback recibe `result.replay = {notes, events, ...}`. `main.js` lo envía al servidor.

#### Reproductor
- En el menú de "Replays", lista los replays guardados.
- Click en uno → pantalla "Viendo replay" donde:
  - El audio se reproduce.
  - El tablero 3D renderiza las notas igual que en juego normal.
  - Las "pulsaciones" se reproducen desde los `events`: receptor flash + juicio mostrado.
  - El jugador NO controla nada (es solo ver).
- Botón "❨❨ 2x" para acelerar.
- Botón "💾 Exportar a archivo" → descarga el JSON.
- Botón "📋 Compartir" → copia un link codificado en base64 (pequeño, no se hostea).

#### Archivos
- `server/replays.js` (nuevo, ~120 líneas)
- `server/index.js` (~30 líneas)
- `src/game/game.js` (~30 líneas: hook de eventos)
- `src/main.js` (~200 líneas: captura, lista, reproductor)
- `index.html` (~60 líneas)

### Estimación: 1.5 días (12 h). Depende de F11 (userId).

---

## 17. F17: Leaderboards globales

**Objetivo:** Top mundial por canción. El usuario puede ver su ranking.

### Estado actual
- Solo scores locales (`~/.rhythm-dance/songdata.json`).

### Cambios

#### Estrategia: GitHub como host
- Mismo patrón que `communityCatalog.js` (ya hay código de sync).
- Repo: `community-charts/` ya existe. Crear `community-scores/` (peer de `community-charts/`).
- `community-scores/index.json`: `{songs: [{songHash, topScores: [{userId, name, score, accuracy, grade, date}, ...]}]}`.
- Por cada canción, top 20. **Solo se suben los top 20** (cliente-side filtra).

#### Backend
- `server/scoresGlobal.js` (nuevo, ~150 líneas):
  - `getSongLeaderboard(songHash, limit=20)`: lee de cache local, o pide al repo.
  - `submitGlobalScore(songId, songHash, userId, name, score, accuracy, grade, maxCombo)`: 
    - Si el puntaje entra en el top 20 local, lo escribe al repo.
    - Cache local en `~/.rhythm-dance/leaderboards/<songHash>.json`.
  - Rate limiting: solo 1 submit cada 30s por usuario por canción.
- `server/communityCatalog.js` ya tiene el patrón de fetch + cache + sync. Reusar.
- Endpoints:
  - `GET /api/leaderboard/:songHash` → top 20
  - `POST /api/leaderboard/submit` → `{ok, rank}`

#### Cliente
- En la pantalla de "Tu biblioteca", botón "🌍 Ver ranking mundial" en cada canción.
- Pantalla del leaderboard:
  - Top 20 con #, nombre, puntaje, accuracy, grade, fecha.
  - "Tú estás en el puesto #X" (resaltado).
  - Botón "Sincronizar" (si está offline).

#### Privacidad
- El `userId` es un UUID random, no identifica a la persona. El `name` es lo que el usuario pone. Decisión: mostrar el `name` tal cual o pedir un "alias público" aparte.
- **Decisión**: usar un alias público aparte (`publicAlias`) que el usuario configura una vez. Si no, mostrar el UUID truncado.

#### Archivos
- `server/scoresGlobal.js` (nuevo, ~150 líneas)
- `server/index.js` (~30 líneas)
- `src/main.js` (~120 líneas: pantalla de leaderboard)
- `index.html` (~50 líneas)

### Estimación: 1.5 días (12 h). Depende de F11 (userId).

---

## 18. F18: Ghost Rival

**Objetivo:** Jugar contra el "fantasma" de otro jugador (replay). Ver sus notas/aciertos y competir.

### Estado actual
- Hay rivalboard pero solo se llena con `peerProgress` en online 1v1.

### Cambios

#### Modelo
- Un ghost = un replay público (F16) o local.
- El ghost se reproduce EN PARALELO a tu partida: ves TUS notas en tu tablero y las del ghost en una columna al lado (o en una pista paralela).
- Las "pulsaciones" del ghost se ven como marcadores luminosos en su pista.

#### Cliente
- En el menú de "Jugar" (single), nuevo toggle: "🎮 Jugar vs fantasma":
  - Selector: "Elige un fantasma".
  - Opciones:
    - Tu propio mejor replay (auto).
    - Replay público de un amigo (código).
    - Replay de un top 1 mundial (descargado).
    - Replay local de otro jugador (si tienes la carpeta compartida).
- En la pantalla de juego: se añade un segundo tablero pequeño a la derecha (estilo VS local) con las notas del ghost.
- El resultado: al final, comparar tu score con el del ghost.

#### Datos del ghost
- Reusar el formato de replay de F16. Para "mi mejor replay", el cliente puede regenerar el replay on-the-fly desde el evento.
- Para "fantasma de amigo": link codificado en base64 (mismo que replay) o descargar de `community-replays/` (nueva carpeta, mismo patrón que `community-scores/`).

#### Backend (mínimo)
- `server/ghosts.js` (nuevo, ~80 líneas):
  - `submitGhost(replay)`: publica a `community-ghosts/` en el repo de GitHub.
  - `getGhost(ghostId)`: descarga.
  - Listado: `GET /api/ghosts?songId=X` → top 10 por score.

#### Archivos
- `server/ghosts.js` (nuevo, ~80 líneas)
- `server/index.js` (~20 líneas)
- `src/main.js` (~250 líneas: selector de ghost, render paralelo, resultado)
- `src/game/ghostboard.js` (nuevo, ~100 líneas: similar a RivalBoard pero de un replay file)
- `index.html` (~50 líneas)

### Estimación: 2 días (16 h). Depende de F11 y F16.

---

## 22. F22: Modo Práctica

**Objetivo:** Escoger sección de la canción, velocidad 0.25x-1x, loop. **NO falla** (vida infinita).

### Estado actual
- El editor ya tiene velocidad 0.3-1.0 pero es para GRABAR, no para practicar.

### Cambios

#### Wrapper `practice`
- Nueva opción en el menú de juego single (no en VS): "🎯 Práctica".
- En el setup:
  - Elige canción.
  - Elige sección: incio-fin (sliders, o "toda la canción").
  - Velocidad: 0.25x a 1.0x.
  - Loop: ON / OFF.
  - Dificultad libre.
  - Mods: ninguno (la práctica es limpia).
- Al iniciar:
  - `audio` con `playbackRate` ajustado.
  - Las notas se filtran a `[tStart, tEnd]`.
  - Si llega al final, vuelve a `tStart` automáticamente (si loop).
  - `allowFail = false` (no pierde).
  - `LIFE` con `+10` por acierto, `+0` por error → vida siempre sube.
- HUD: cambia el texto "VIDA" por "PRÁCTICA" en gris, sin barra de vida o con una "barra de práctica" que muestra accuracy de la sesión.

#### Archivos
- `src/main.js` (~150 líneas: setup, filtro de notas, loop)
- `src/game/game.js` (~30 líneas: nuevo settings para practice, loop logic)
- `index.html` (~50 líneas: nueva card y setup)

### Estimación: 0.75 día (6 h). Es una variante del modo single.

---

## Plan de releases (por orden de impacto)

### v0.9.0 — "Identidad y Progresión" (F11, F12, F13, F6, F22)
- Base para todo lo demás: UUID, perfil, XP, stats.
- 6 features pequeñas/medianas, alto valor.
- Tiempo: 1.5 + 1.5 + 1 + 0.5 + 0.75 = **5.25 días** (42 h)

### v0.10.0 — "Multijugador Expandido" (F1, F3, F4, F5)
- Salas mejoradas, lobby público, equipos, battle royale.
- Tiempo: 1.5 + 1 + 2 + 1.5 = **6 días** (48 h)

### v0.11.0 — "Replays y Competencia" (F16, F17, F18)
- Replays, leaderboards, ghosts.
- Tiempo: 1.5 + 1.5 + 2 = **5 días** (40 h)

### v0.12.0 — "Contenido y Creatividad" (F7, F8, F9, F10)
- Historia, tutorial, puzzle, boss fight.
- Tiempo: 2.5 + 2 + 1.5 + 3 = **9 días** (72 h)

### Estimación total: **~25 días** (200 h) para las 16 features.

---

## Estimación global

| Feature | Estimación (h) | Dependencias |
|---|---|---|
| F1 — Salas mejoradas | 12 | ninguna |
| F3 — Lobby con chat | 8 | F1 (mismo WS) |
| F4 — Equipos | 16 | F1 |
| F5 — Battle Royale | 12 | F4 |
| F6 — Carrera combos | 4 | ninguna |
| F7 — Modo Historia | 20 | F11, F12 |
| F8 — Tutorial | 16 | ninguna |
| F9 — Puzzle | 12 | Editor (existente) |
| F10 — Boss Fight coop | 24 | F1, F11 |
| F11 — Perfil/stats | 12 | ninguna |
| F12 — Logros | 12 | F11 |
| F13 — Daily challenge | 8 | F11 |
| F16 — Replays | 12 | F11 |
| F17 — Leaderboards | 12 | F11 |
| F18 — Ghosts | 16 | F11, F16 |
| F22 — Práctica | 6 | ninguna |
| **TOTAL** | **~202 h** | |

## Riesgos y mitigaciones

1. **Boss Fight cooperativo** es el más complejo. Mitigación: empezar con un solo boss y un ataque. Iterar.
2. **GitHub como host de leaderboards/ghosts** depende de rate limits (5000 req/h autenticado). Mitigación: cache agresivo en cliente + sync periódico.
3. **Replays online** pueden ser muy grandes. Mitigación: comprimir en cliente con gzip antes de subir.
4. **Battle Royale con 8 jugadores online** requiere buen ancho de banda. Mitigación: ya el relay manda solo 5 mensajes/s/jugador (~500 B/s).
5. **Modo Tutorial** con metrónomo generado dinámicamente puede tener latencia de primer arranque. Mitigación: pre-generar al instalar.
6. **HUD del Boss** debe ser claro y no interferir con el tablero. Mitigación: overlay CSS con `pointer-events: none`.

## Compatibilidad con lo existente

- **No rompe**: `package.json` (no nuevas deps), el relay 1v1 actual, el editor, el VS local 2P, los mods visuales, los efectos bomba/item.
- **Extiende**: `server/rooms.js` (nuevos mensajes, no incompatibles), `prefs.js` (añadir `userId`), `RhythmGame` (nuevos settings opcionales).
- **Añade**: nuevos archivos en `server/` (`user.js`, `achievements.js`, `bosses.js`, etc.) y `src/` (`gamemodes.js`, `campaign.js`, `puzzle.js`, `ghostboard.js`).
