# Carpeta bin/ — herramientas externas

El juego necesita **ffmpeg** y **ffprobe** para decodificar audio, y
opcionalmente **yt-dlp** para descargar musica.

Si los colocas aqui, se incluiran dentro del paquete de escritorio (.exe /
.AppImage / .deb) y la app funcionara en una PC que NO los tenga instalados.

## Que poner aqui

### Windows (para el .exe)
- `ffmpeg.exe`
- `ffprobe.exe`
- `yt-dlp.exe` (opcional, para descargas)

Descarga ffmpeg "full" desde https://www.gyan.dev/ffmpeg/builds/ y yt-dlp desde
https://github.com/yt-dlp/yt-dlp/releases

### Linux (para el .AppImage / .deb)
- `ffmpeg`
- `ffprobe`
- `yt-dlp` (opcional)

Puedes copiarlos desde tu sistema:
```bash
cp "$(which ffmpeg)" bin/
cp "$(which ffprobe)" bin/
cp "$(which yt-dlp)" bin/   # opcional
```

Si NO pones nada aqui, la app usara el ffmpeg/yt-dlp instalado en el sistema
(via PATH). El empaquetado funciona igual; solo que el paquete dependera de que
la PC destino tenga esas herramientas.
