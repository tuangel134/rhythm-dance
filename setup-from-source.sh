#!/usr/bin/env bash
# setup-from-source.sh — Instala Rhythm Dance desde el codigo fuente (Linux/macOS).
#
# No descarga binarios pesados: clona el repo, instala dependencias con npm y deja
# todo listo. Necesita git, Node.js 18+ y ffmpeg (te avisa si falta algo).
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/tuangel134/rhythm-dance/main/setup-from-source.sh | bash
#
# Variables opcionales:
#   DEST=ruta   carpeta donde instalar (por defecto ~/rhythm-dance)

set -euo pipefail

REPO_URL="https://github.com/tuangel134/rhythm-dance.git"
DEST="${DEST:-$HOME/rhythm-dance}"

say()  { printf "\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }
warn() { printf "\033[1;33m! %s\033[0m\n" "$1"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$1" >&2; }

# --- Comprobar requisitos ---
need_node=0; need_git=0; need_ffmpeg=0
command -v node >/dev/null 2>&1 || need_node=1
command -v git  >/dev/null 2>&1 || need_git=1
command -v ffmpeg >/dev/null 2>&1 || need_ffmpeg=1

if [ "$need_node" = "1" ] || [ "$need_git" = "1" ] || [ "$need_ffmpeg" = "1" ]; then
  warn "Faltan algunas herramientas. Intentando instalarlas..."
  if command -v apt >/dev/null 2>&1; then
    say "Usando APT (pedira tu contrasena de sudo)..."
    sudo apt update -y
    PKGS=""
    [ "$need_git" = "1" ] && PKGS="$PKGS git"
    [ "$need_ffmpeg" = "1" ] && PKGS="$PKGS ffmpeg"
    [ "$need_node" = "1" ] && PKGS="$PKGS nodejs npm"
    [ -n "$PKGS" ] && sudo apt install -y $PKGS
  elif command -v brew >/dev/null 2>&1; then
    say "Usando Homebrew..."
    [ "$need_git" = "1" ] && brew install git
    [ "$need_ffmpeg" = "1" ] && brew install ffmpeg
    [ "$need_node" = "1" ] && brew install node
  elif command -v dnf >/dev/null 2>&1; then
    say "Usando DNF..."
    sudo dnf install -y git ffmpeg nodejs
  elif command -v pacman >/dev/null 2>&1; then
    say "Usando pacman..."
    sudo pacman -S --needed --noconfirm git ffmpeg nodejs npm
  else
    err "No pude instalar dependencias automaticamente. Instala manualmente: Node.js 18+, git y ffmpeg."
    exit 1
  fi
fi

# Verificar version de Node (>=18)
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "Tu Node.js es viejo (v$NODE_MAJOR). Se recomienda Node 18 o superior."
fi

# --- Clonar o actualizar ---
if [ -d "$DEST/.git" ]; then
  say "Ya existe $DEST. Actualizando..."
  git -C "$DEST" pull --ff-only
else
  say "Clonando en $DEST ..."
  git clone --depth 1 "$REPO_URL" "$DEST"
fi

cd "$DEST"

# --- Instalar dependencias y construir el cliente ---
say "Instalando dependencias (npm)..."
npm install

say "Construyendo el cliente..."
npm run build:client

ok "Instalado en: $DEST"
echo ""
echo "Para jugar:"
echo "  cd \"$DEST\""
echo "  npm start          # modo navegador (http://localhost:5174)"
echo "  npm run app        # app de escritorio (ventana propia)"
echo ""

# Ofrecer arrancar ya mismo (solo si es una terminal interactiva).
if [ -t 0 ]; then
  printf "¿Arrancar ahora en el navegador? [s/N] "
  read -r ans || ans=""
  case "$ans" in
    s|S|y|Y) exec npm start ;;
    *) ok "Listo. Arrancalo cuando quieras con 'npm start'." ;;
  esac
fi
