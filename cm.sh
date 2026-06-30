#!/bin/bash
# Helper de commit (fish no maneja bien mensajes multilinea con &&)
cd "/home/angel/Descargas/juego musica/rhythm-dance" || exit 1
git add -A
git commit -m "$1" -m "$2"
git log --oneline -1
