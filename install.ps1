# install.ps1 — Instalador de un comando para Rhythm Dance (Windows).
#
# Descarga el ultimo instalador (.exe NSIS) publicado en GitHub Releases y lo
# ejecuta. Pega esto en PowerShell:
#
#   irm https://raw.githubusercontent.com/tuangel134/rhythm-dance/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$Repo = "tuangel134/rhythm-dance"
$Api  = "https://api.github.com/repos/$Repo/releases/latest"

function Say($m) { Write-Host "▶ $m" -ForegroundColor Cyan }
function Ok($m)  { Write-Host "✓ $m" -ForegroundColor Green }

Say "Consultando el ultimo release de Rhythm Dance..."
$release = Invoke-RestMethod -Uri $Api -Headers @{ "User-Agent" = "rhythm-dance-installer" }

# Preferimos el instalador NSIS (Setup .exe). Si no, el portable.
$asset = $release.assets | Where-Object { $_.name -match "Setup.*\.exe$" } | Select-Object -First 1
if (-not $asset) {
  $asset = $release.assets | Where-Object { $_.name -match "\.exe$" } | Select-Object -First 1
}
if (-not $asset) { throw "No encontre un instalador .exe en el ultimo release." }

$dest = Join-Path $env:TEMP $asset.name
Say "Descargando $($asset.name) ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest -Headers @{ "User-Agent" = "rhythm-dance-installer" }

Ok "Descargado. Ejecutando el instalador..."
Start-Process -FilePath $dest
Ok "Sigue el asistente. Al terminar, busca 'Rhythm Dance' en el menu de Inicio."
