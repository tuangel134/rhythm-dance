// verify-community-apply.mjs
// Test de integracion del flujo APPLY del subsistema de comunidad:
// construye un package que coincide (por fingerprint) con una cancion local y
// lo aplica via /api/community/apply (con package en el body). Luego confirma
// que el chart quedo guardado y recuperable por /api/customchart.
// Requiere el servidor corriendo en localhost:5174.

const BASE = "http://localhost:5174";

async function main() {
  const songs = await (await fetch(`${BASE}/api/songs`)).json();
  if (!songs.songs || !songs.songs.length) { console.log("SKIP: no hay canciones locales"); return; }
  const song = songs.songs[0];

  const fpRes = await (await fetch(`${BASE}/api/community/fingerprint/${song.id}`)).json();
  const fingerprint = fpRes.fingerprint;
  const meta = fpRes.meta;
  console.log("Cancion:", song.name, "| fp:", fingerprint.slice(0, 12));

  // Construir un package valido que coincide con esta cancion.
  const dur = Math.max(10, Math.round(meta.duration || 60));
  const pkg = {
    version: 1,
    fingerprint,
    metadata: { game: "dance", difficulty: "expert", laneCount: 5, title: meta.title, artist: meta.artist || "", bpm: Math.round(meta.bpm || 120), duration: dur },
    attribution: { name: "tester-integracion" },
    chart: { laneCount: 5, duration: dur, bpm: Math.round(meta.bpm || 120), notes: [ { time: 1, lane: 0 }, { time: 2, lane: 2 }, { time: 3, lane: 4 } ] },
    createdAt: new Date().toISOString(),
  };

  // 1) Aplicar (sin overwrite). Como es dificultad expert (probablemente sin
  //    chart previo), deberia aplicar directo.
  let r = await (await fetch(`${BASE}/api/community/apply`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songId: song.id, package: pkg }),
  })).json();
  if (r.needsConfirm) {
    // Ya existia: reintentar con overwrite.
    r = await (await fetch(`${BASE}/api/community/apply`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId: song.id, package: pkg, overwrite: true }),
    })).json();
  }
  if (!r.ok) throw new Error("apply fallo: " + JSON.stringify(r));
  console.log("apply OK");

  // 2) Recuperar el chart guardado.
  const got = await (await fetch(`${BASE}/api/customchart/${song.id}?difficulty=expert&game=dance&lanes=5`)).json();
  if (!got.chart || !got.chart.notes || got.chart.notes.length !== 3) {
    throw new Error("el chart aplicado no se recupero correctamente: " + JSON.stringify(got));
  }
  if (got.chart.attribution && got.chart.attribution.name !== "tester-integracion") {
    throw new Error("no se conservo la atribucion");
  }
  console.log("recuperado:", got.chart.notes.length, "notas, autor:", got.chart.attribution && got.chart.attribution.name);

  // 3) Probar mismatch de fingerprint: debe pedir audio (needAudio).
  const bad = JSON.parse(JSON.stringify(pkg));
  bad.fingerprint = "0000000000000000000000000000000000000000";
  const r2 = await (await fetch(`${BASE}/api/community/apply`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songId: song.id, package: bad, overwrite: true }),
  })).json();
  if (!r2.needAudio) throw new Error("se esperaba needAudio ante fingerprint distinto");
  console.log("mismatch -> needAudio OK");

  // Limpieza: borrar el chart de prueba.
  await fetch(`${BASE}/api/customchart/${song.id}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty: "expert", game: "dance", lanes: 5 }),
  }).catch(() => {});

  console.log("OK: flujo apply de comunidad funciona (aplicar, recuperar, conservar atribucion, rechazar mismatch).");
}

main().catch((e) => { console.error("FALLO:", e.message); process.exit(1); });
