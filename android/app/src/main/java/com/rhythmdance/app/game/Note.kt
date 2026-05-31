package com.rhythmdance.app.game

// Una nota de la pista: tiempo en segundos, carril (0..laneCount-1) y, si es
// una nota larga (hold), su duracion en segundos (0 = nota normal).
data class Note(
    val time: Double,
    val lane: Int,
    val duration: Double = 0.0,
) {
    // Estado de juego (mutable durante la partida).
    var hit: Boolean = false
    var missed: Boolean = false
    var holding: Boolean = false
    var holdDone: Boolean = false
}

// Pista generada: lista de notas + metadatos.
data class Chart(
    val notes: List<Note>,
    val bpm: Double,
    val duration: Double,
    val laneCount: Int,
)
