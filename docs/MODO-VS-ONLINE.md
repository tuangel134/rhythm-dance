# Plan del modo VS online (1 contra 1 privado)

## Objetivo
Que dos amigos puedan jugar la MISMA cancion en un VS, sin matchmaking publico
ni servidor central. Solo se conectan entre ellos mediante un codigo de sala.

## Decisiones de diseno

### 1. Relay, no autoridad
El servidor de salas (`server/rooms.js`) es un **relay tonto**: solo reenvia
mensajes entre los dos jugadores. La logica del juego (notas, juicios, puntaje)
corre en cada cliente. Esto es:
- Simple y robusto: el servidor no simula nada.
- Suficiente para un VS amistoso (no es competitivo anti-trampas).

Tradeoff: no hay validacion anti-trampa. Para jugar con un amigo es lo correcto;
para un ranking global haria falta validacion del lado servidor.

### 2. Quien hospeda
El que **crea** la sala actua de servidor (su PC corre el motor + relay). El otro
se conecta a su IP. Asi no necesitamos infraestructura propia.
Alternativa futura: un pequeno relay publico gratuito para no depender de IPs.

### 3. Emparejar la cancion entre dos PCs
Cada jugador tiene sus propios archivos. Para asegurar que juegan "lo mismo":
- El host envia un **hash de contenido** de la cancion (`songHash`), derivado de
  duracion + BPM + numero de notas + estilo. Es estable ante recodificaciones.
- El invitado busca en su biblioteca por nombre y **verifica el hash**. Si no
  coincide exactamente, avisa pero permite intentar (puede ser otra version).

Tradeoff: si el amigo no tiene la cancion, debe descargarla (pestana Descargar).
Futuro posible: transferir el audio directamente entre pares (WebRTC datachannel).

### 4. Arranque sincronizado
Cuando ambos pulsan "Listo", el host fija un instante de inicio comun
(`startAt = Date.now() + 3000`). Ambos clientes convierten ese epoch a su reloj
local de `performance.now()` y arrancan a la vez. El reloj suave del juego
mantiene la sincronia con el audio.

Tradeoff: depende de relojes razonablemente cercanos; 3s de margen lo absorbe.
No corregimos latencia de red para el inicio (no hace falta a este nivel).

### 5. Marcadores en vivo
Durante la partida cada cliente envia su `score/combo/accuracy` ~5 veces por
segundo. El rival los muestra en el HUD VS. Al terminar, cada uno envia su
`finish` y se decide el ganador comparando puntajes.

## Protocolo (WebSocket JSON sobre /ws)
- cliente: `create`, `join`, `chooseSong`, `ready`, `start`, `progress`, `finish`, `leave`
- servidor: `created`, `joined`, `peerJoined`, `peerLeft`, `song`, `peerReady`,
  `bothReady`, `go`, `peerProgress`, `peerFinish`, `error`

## Conexion entre PCs
- LAN: IP local del host (la imprime la consola al arrancar).
- Internet: reenvio de puerto 5174 o VPN (Tailscale/Hamachi). Recomendado VPN.

## Estado actual
- [x] Salas con codigo, maximo 2 jugadores.
- [x] Eleccion de cancion + verificacion por hash.
- [x] Arranque sincronizado.
- [x] Marcadores en vivo + resultado.
- [x] Host de relay configurable (IP del amigo).
- [ ] (futuro) Relay publico opcional.
- [ ] (futuro) Transferencia de audio por WebRTC si el amigo no tiene la cancion.
- [ ] (futuro) Revancha sin salir de la sala.
```
