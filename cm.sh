#!/bin/bash
cd "/home/angel/Descargas/juego musica/rhythm-dance"
git add -A
git commit -m "fix: forzar EGL bajo Wayland nativo (WebGL/3D funciona en NVIDIA)

Al pasar a Wayland nativo, el proceso GPU se caia (sin WebGL -> el juego
3D no renderizaba) en GPUs NVIDIA/hibridas. Forzar --use-gl=egl lo
arregla: WebGL vuelve a funcionar y desaparecen los crashes de GPU.
Asi obtenemos las dos cosas: teclado OK (Wayland nativo) + 3D OK (EGL)."
