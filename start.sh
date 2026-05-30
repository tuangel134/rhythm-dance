#!/usr/bin/env bash
# Arranque en Linux / macOS
set -e
cd "$(dirname "$0")"

echo
echo "  RHYTHM DANCE - iniciando..."
echo

if [ ! -d "node_modules" ]; then
  echo "  Instalando dependencias (solo la primera vez)..."
  npm install
fi

if [ ! -f "dist/index.html" ]; then
  echo "  Construyendo el frontend..."
  npm run build:client
fi

# Abrir navegador (best-effort)
( sleep 1.5; (xdg-open http://localhost:5174 >/dev/null 2>&1 || open http://localhost:5174 >/dev/null 2>&1 || true) ) &

npm start
