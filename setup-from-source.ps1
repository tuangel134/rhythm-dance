# setup-from-source.ps1 — Instala Rhythm Dance desde el codigo fuente (Windows).
#
# No descarga binarios pesados: clona el repo, instala dependencias con npm y deja
# todo listo. Necesita git, Node.js 18+ y ffmpeg.
#
# Uso (en PowerShell):
#   irm https://raw.githubusercontent.com/tuangel134/rhythm-dance/main/setup-from-source.ps1 | iex

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/tuangel134/rhythm-dance.git"
$Dest = Join-Path $env:USERPROFILE "rhythm-dance"

function Say($m)  { Write-Host "> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "OK $m" -ForegroundColor Green }
function Warn($m) { Write-Host "! $m" -ForegroundColor Yellow }

function Have($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

# --- Comprobar/instalar requisitos con winget si esta disponible ---
$haveWinget = Have "winget"

if (-not (Have "git")) {
  if ($haveWinget) { Say "Instalando Git..."; winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements }
  else { Warn "Falta Git. Instalalo desde https://git-scm.com/download/win y vuelve a ejecutar." ; exit 1 }
}
if (-not (Have "node")) {
  if ($haveWinget) { Say "Instalando Node.js LTS..."; winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements }
  else { Warn "Falta Node.js. Instalalo desde https://nodejs.org (LTS) y vuelve a ejecutar." ; exit 1 }
}
if (-not (Have "ffmpeg")) {
  if ($haveWinget) { Say "Instalando ffmpeg..."; winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements }
  else { Warn "Falta ffmpeg. Instalalo (https://www.gyan.dev/ffmpeg/builds/) o ponlo en bin/. Continuo igual." }
}

# Refrescar PATH de la sesion (por si winget acaba de instalar algo).
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# --- Clonar o actualizar ---
if (Test-Path (Join-Path $Dest ".git")) {
  Say "Ya existe $Dest. Actualizando..."
  git -C $Dest pull --ff-only
} else {
  Say "Clonando en $Dest ..."
  git clone --depth 1 $RepoUrl $Dest
}

Set-Location $Dest

Say "Instalando dependencias (npm)..."
npm install

Say "Construyendo el cliente..."
npm run build:client

Ok "Instalado en: $Dest"
Write-Host ""
Write-Host "Para jugar:"
Write-Host "  cd `"$Dest`""
Write-Host "  npm start      # modo navegador (http://localhost:5174)"
Write-Host "  npm run app    # app de escritorio (ventana propia)"
Write-Host ""

$ans = Read-Host "Arrancar ahora en el navegador? [s/N]"
if ($ans -match '^[sSyY]$') { npm start }
else { Ok "Listo. Arrancalo cuando quieras con 'npm start'." }
