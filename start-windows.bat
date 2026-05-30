@echo off
REM ============================================================
REM  Rhythm Dance - arranque en Windows
REM  Requisitos: Node.js instalado. ffmpeg y yt-dlp opcionales
REM  (ponlos en la carpeta bin\ o en el PATH).
REM ============================================================
cd /d "%~dp0"

echo.
echo   RHYTHM DANCE - iniciando en Windows...
echo.

REM Instalar dependencias la primera vez
if not exist "node_modules" (
  echo   Instalando dependencias (solo la primera vez)...
  call npm install
)

REM Construir el frontend si no existe
if not exist "dist\index.html" (
  echo   Construyendo el frontend...
  call npm run build:client
)

REM Abrir el navegador y arrancar el motor
start "" http://localhost:5174
call npm start

pause
