#!/usr/bin/env bash
# install.sh — Instalador de un comando para Rhythm Dance (Linux / macOS).
#
# Descarga el ultimo binario publicado en GitHub Releases y lo instala:
#   - Debian/Ubuntu/Zorin/Mint  -> paquete .deb (queda en el menu de apps)
#   - Otras distros Linux        -> AppImage en ~/.local/bin (corre sin instalar)
#   - macOS                      -> .dmg (lo abre para que arrastres la app)
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/tuangel134/rhythm-dance/main/install.sh | bash

set -euo pipefail

REPO="tuangel134/rhythm-dance"
API="https://api.github.com/repos/${REPO}/releases/latest"

say()  { printf "\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$1" >&2; }

# Localiza la URL de descarga de un asset cuyo nombre contiene $1.
asset_url() {
  local pattern="$1"
  curl -fsSL "$API" \
    | grep -o '"browser_download_url": *"[^"]*"' \
    | sed 's/.*"browser_download_url": *"//; s/"$//' \
    | grep -i "$pattern" \
    | head -n1
}

OS="$(uname -s)"

if [ "$OS" = "Darwin" ]; then
  say "Detectado macOS. Buscando el ultimo .dmg..."
  URL="$(asset_url '\.dmg$' || true)"
  [ -z "${URL:-}" ] && { err "No encontre un .dmg en el ultimo release."; exit 1; }
  TMP="$(mktemp -d)"; FILE="$TMP/RhythmDance.dmg"
  say "Descargando..."; curl -fL "$URL" -o "$FILE"
  ok "Descargado. Abriendo el instalador (arrastra la app a Aplicaciones)."
  open "$FILE"
  exit 0
fi

if [ "$OS" != "Linux" ]; then
  err "Sistema no soportado por este script: $OS"; exit 1
fi

# ----- Linux -----
# ¿Es una distro basada en Debian (tiene dpkg)?
if command -v dpkg >/dev/null 2>&1 && command -v apt >/dev/null 2>&1; then
  say "Detectado Linux con APT (Debian/Ubuntu/Zorin/Mint). Buscando el .deb..."
  URL="$(asset_url '\.deb$' || true)"
  [ -z "${URL:-}" ] && { err "No encontre un .deb en el ultimo release."; exit 1; }
  TMP="$(mktemp -d)"; FILE="$TMP/rhythm-dance.deb"
  say "Descargando..."; curl -fL "$URL" -o "$FILE"
  say "Instalando (pedira tu contrasena de sudo)..."
  sudo apt install -y "$FILE"
  ok "Instalado. Busca 'Rhythm Dance' en tu menu de aplicaciones."
  exit 0
fi

# ----- Otras distros: AppImage -----
say "Buscando el AppImage..."
URL="$(asset_url '\.AppImage$' || true)"
[ -z "${URL:-}" ] && { err "No encontre un AppImage en el ultimo release."; exit 1; }
DEST="$HOME/.local/bin"
mkdir -p "$DEST"
FILE="$DEST/RhythmDance.AppImage"
say "Descargando a $FILE ..."
curl -fL "$URL" -o "$FILE"
chmod +x "$FILE"
ok "Listo. Ejecutalo con:  $FILE"
case ":$PATH:" in
  *":$DEST:"*) : ;;
  *) printf "\033[1;33m  (Sugerencia: agrega %s a tu PATH para llamarlo por nombre)\033[0m\n" "$DEST" ;;
esac
