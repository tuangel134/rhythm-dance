#!/bin/bash
cd "/home/angel/Descargas/juego musica/rhythm-dance"
git add -A
git commit -m "fix: el teclado ya no se bloquea al escribir en menus (buscador, etc.)

El InputManager global capturaba teclas de juego (Z X C V B, flechas,
A S W D) y hacia preventDefault incluso fuera del juego. Si el foco no
caia exactamente en un input, las teclas se comian y no se podia
escribir en el buscador de canciones.

Ahora el InputManager solo procesa el teclado cuando la pantalla #game
o #editor esta activa. En menus, splash, resultados y setup ignora el
teclado por completo, dejando que el navegador maneje los inputs."
