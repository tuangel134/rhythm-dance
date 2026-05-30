# Como usar Rhythm Dance en otra PC

Este paquete trae el juego listo. Solo necesitas **Node.js** y **ffmpeg**
en la PC donde lo vayas a correr.

## 1. Requisitos (instalar una vez)

### Linux
```bash
# Node.js (v18 o superior) y ffmpeg
sudo apt install nodejs npm ffmpeg     # Debian/Ubuntu
# o:  sudo dnf install nodejs ffmpeg    # Fedora
# yt-dlp (opcional, para el descargador de musica):
pip install -U yt-dlp                   # o: sudo pacman -S yt-dlp
```

### Windows
1. Instala Node.js desde https://nodejs.org (boton "LTS").
2. ffmpeg: descarga desde https://www.gyan.dev/ffmpeg/builds/ (release "full"),
   descomprime, y copia `ffmpeg.exe` y `ffprobe.exe` dentro de la carpeta `bin/`
   de este proyecto (creala si no existe). Tambien puedes ponerlos en el PATH.
3. yt-dlp (opcional, para descargar musica): descarga `yt-dlp.exe` desde
   https://github.com/yt-dlp/yt-dlp/releases y ponlo tambien en `bin/`.

## 2. Arrancar

### Linux
```bash
./start.sh
```
(si dice permiso denegado: `chmod +x start.sh` y vuelve a intentar)

### Windows
Doble clic en **start-windows.bat**

La primera vez instala dependencias y construye (tarda 1-2 min). Luego abre
el navegador en http://localhost:5174

## 3. Jugar

- Pon tus canciones en una carpeta y agregala en la pestana "Carpetas".
- O usa la pestana "Descargar musica" (necesita yt-dlp).
- Elige una cancion y a jugar.

### Controles (5 paneles / Pump It Up)
- Teclado: **Z X C V B** (abajo-izq, arriba-izq, centro, arriba-der, abajo-der).
- Numpad: **1 7 5 9 3** (mismas posiciones fisicas que los paneles).
- Mando/USB: caras y dpad, o el stick en diagonal.

### Controles (4 flechas / DDR)
- Teclado: flechas **← ↓ ↑ →** o **A S W D**.

### VS local (2 jugadores en la misma PC)
Pulsa el boton **2P** en cualquier cancion de la lista. La pantalla se divide en dos:
- **Jugador 1**: `Z X C V B` (5 paneles) o `A S W D` (4 flechas).
- **Jugador 2**: numpad `1 7 5 9 3` (5 paneles) o flechas `← ↓ ↑ →` (4).
- Si conectas dos mandos, J1 usa el primero y J2 el segundo.
Ambos juegan la cancion completa con un solo audio; al final se comparan los
puntajes y gana el mas alto (no se pierde por vida en este modo).

> **¿El jugador 2 no registra teclas?** Es el MISMO teclado, pero muchos teclados
> no pueden detectar muchas teclas pulsadas a la vez (ghosting), o no tienen numpad.
> Solucion: en Opciones pulsa **⌨ Configurar teclas** y asigna a cada jugador teclas
> separadas que tu teclado registre bien a la vez (o que cada uno use su mando).

## App de escritorio (opcional)

Ademas del modo navegador, puedes correrlo como **app nativa** (ventana propia,
sin abrir el navegador). Usa Electron y arranca el mismo motor por dentro.

```bash
npm install          # instala tambien electron y electron-builder
npm run app          # construye y abre la app de escritorio
```

Para generar un instalable/portable que puedas pasar a otra PC:
```bash
npm run dist:linux   # genera AppImage + paquete .deb (Linux) en dist-app/
npm run dist:win     # genera instalador NSIS + portable (Windows) en dist-app/
```
(En Windows necesitas ffmpeg/ffprobe en `bin/` para que el ejecutable los incluya.)

En `dist-app/` te quedaran:
- **Linux**: un `.AppImage` (corre sin instalar: permiso de ejecucion + doble clic)
  y un `.deb` (se instala con doble clic o `sudo dpkg -i Rhythm*.deb` y queda en el menu).
- **Windows**: un instalador `.exe` (NSIS) y un `.exe` portable (sin instalar).

## Opciones y efectos

- **Calibracion audio/video**: si sientes que las flechas van adelantadas o
  atrasadas respecto a la musica, ajusta el deslizador en Opciones (+/- ms).
  Se guarda automaticamente.
- **Efectos** (estilo Pump It Up, solo visuales): Vanish, Appear, Hidden,
  Tornado, Twirl, Drunk, Mirror, Random, Reverse. Combinables (salvo los de
  visibilidad, que son uno a la vez).
- Tus preferencias (estilo, dificultad, velocidad, volumen, etc.) **se guardan**
  y se restauran la proxima vez que abras el juego.

## Video de fondo

El juego puede mostrar un video detras de las flechas, sincronizado con la musica.

- **Al descargar**: marca la casilla **"Descargar tambien el video"** en la pestana
  Descargar. Se guarda un `.mp4` junto al `.mp3` y el juego lo detecta solo.
- **Manual**: pon un video con el **mismo nombre** que el audio, en la misma carpeta
  (p.ej. `Cancion.mp3` + `Cancion.mp4`). Tambien sirve un `.mp4`/`.webm` que ya
  contenga la pista de video.
- Actívalo/desactívalo con la casilla **"Video de fondo"** en Opciones. Si una
  cancion no tiene video, se usa el fondo normal.

## Editor: edicion fina de notas

En el Editor, ademas de grabar tus teclas en camara lenta, puedes pulsar
**✎ Editar notas** para abrir un timeline 2D donde:
- Arrastras una nota para moverla (en tiempo y de carril).
- Doble click en vacio = agregar nota; doble click sobre una nota = borrarla.
- **Supr** borra la nota seleccionada; **[** y **]** acortan/alargan un hold.
- Rueda = scroll en el tiempo; **Ctrl+Rueda** = zoom.

## Rendimiento / FPS

Si los FPS no llegan al maximo de tu monitor:
- Prueba **pantalla completa (F11)**: suele desbloquear la tasa real (ej. 165Hz).
- Activa la **aceleracion por hardware** del navegador:
  - Chrome: Configuracion -> Sistema -> "Usar aceleracion grafica cuando este disponible".
  - Firefox: about:config -> `gfx.webrender.all` = true.
- El contador abajo a la izquierda muestra: fps, ms de CPU del juego y draws.
  Si "ms" es bajo (<5) pero los fps no suben, el limite es del navegador/monitor,
  no del juego.

## Modo VS online (contra un amigo)

Mira la pestana "VS Online". Opcion facil: "Crear sala + enlace para compartir"
genera un link que le mandas a tu amigo; el lo abre y entra directo.

## Usar mapeos REALES (stepcharts de la comunidad)

Para tus canciones favoritas (p.ej. Csikos Post de Pump It Up) puedes usar el
mapeo hecho a mano en vez de la autogeneracion. El juego lee archivos
**.sm** y **.ssc** (formato StepMania, el estandar que usa toda la comunidad).

Pasos:
1. Consigue el stepchart de la cancion (sitios como ZIV / Zenius-I-vanisher,
   o packs de StepMania). Es un archivo `.sm` o `.ssc`.
2. Ponlo en la **misma carpeta** que tu audio, idealmente con el **mismo nombre**:
   ```
   MiMusica/
     Csikos Post.mp3
     Csikos Post.sm      <- el chart
   ```
   (Tambien sirve si pones el .mp3 y el .sm juntos en su propia subcarpeta,
   como hacen los packs de StepMania.)
3. En la lista de canciones aparecera la etiqueta **★ CHART**. Al jugarla, el
   juego usa ese mapeo real (con sus holds y su dificultad) en vez de autogenerar.

Notas:
- Soporta cambios de BPM, STOPS y holds del formato.
- Si el chart es de 5 paneles (Pump) y juegas en 4 (DDR) o viceversa, se adapta.
- La dificultad que elijas (Facil..Experto) intenta corresponder a la del chart.
- Si no hay .sm/.ssc, se autogenera como siempre.
