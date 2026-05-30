// rivalboard.js
// Tablero del RIVAL en el modo VS. Muestra las MISMAS notas que tu pista
// (ambos juegan la misma cancion) desplazandose con el mismo reloj, y refleja
// lo que hace el rival: cuando acierta una nota, esta desaparece con un
// destello; cuando la falla, se atenua. Los eventos llegan por la red, asi
// que NO hay que transmitir cada flecha: solo "el rival resolvio la nota i".

import { Stage } from "../render/stage.js";

export class RivalBoard {
  /**
   * @param {HTMLElement} container
   * @param {Object} beatmap  el mismo beatmap que juega el local
   * @param {Object} settings { scrollSpeed }
   */
  constructor(container, beatmap, settings) {
    this.beatmap = beatmap;
    this.laneCount = beatmap.laneCount;
    // Tablero sin efectos raros (el rival ve los suyos; aqui mostramos limpio).
    this.stage = new Stage(container, this.laneCount, (settings && settings.scrollSpeed) || 3, {}, { mode: (settings && settings.gameMode) || "dance" });

    this.notes = beatmap.notes
      .map((n) => ({ ...n, resolved: false, entry: null }))
      .sort((a, b) => a.time - b.time);
    this.spawnCursor = 0;
    this.activeStart = 0;
    this.nextResolveIndex = 0; // proxima nota a resolver por evento de red
  }

  // El servidor/cliente nos dice cuantas notas ha resuelto el rival y si la
  // ultima fue acierto. Resolvemos en orden (las notas estan ordenadas igual
  // en ambos lados porque comparten beatmap).
  applyResolved(count, lastHit) {
    while (this.nextResolveIndex < count && this.nextResolveIndex < this.notes.length) {
      const n = this.notes[this.nextResolveIndex];
      n.resolved = true;
      n.wasHit = lastHit; // aproximacion: marca el estado del ultimo evento
      if (n.entry) {
        if (lastHit) this.stage.hitEffect(n.lane);
        this.stage.removeNote(n.entry);
        n.entry = null;
      }
      this.nextResolveIndex++;
    }
  }

  flashReceptor(lane) { this.stage.flashReceptor(lane); }

  update(dt, now) {
    // Spawnear notas que entran en vista
    const viewSec = this.stage.viewSeconds();
    while (this.spawnCursor < this.notes.length && this.notes[this.spawnCursor].time - now <= viewSec) {
      const n = this.notes[this.spawnCursor];
      if (!n.resolved && !n.entry) n.entry = this.stage.spawnNote(n);
      this.spawnCursor++;
    }
    // Avanzar ventana activa
    while (this.activeStart < this.spawnCursor) {
      const n = this.notes[this.activeStart];
      if (n.resolved || (n.time - now < -0.6)) this.activeStart++;
      else break;
    }
    // Posicionar notas activas
    for (let idx = this.activeStart; idx < this.spawnCursor; idx++) {
      const n = this.notes[idx];
      if (n.resolved) continue;
      const d = n.time - now;
      if (n.entry) {
        this.stage.positionNote(n.entry, d);
        // Si paso de largo sin que el rival la resolviera (lag de red), la
        // quitamos para no acumular.
        if (d < -0.6) { this.stage.removeNote(n.entry); n.entry = null; n.resolved = true; }
      }
    }
    this.stage.update(dt);
  }

  render() { this.stage.render(); }
  dispose() { this.stage.dispose(); }
}
