# Plan de Implementación — community-charts

- [x] 1. Núcleo de lógica pura en `server/community.js`
  - Implementar `normalizeText`, `computeFingerprint`, `PACKAGE_VERSION`, `buildPackage`, `serializePackage`, `parsePackage`, `validatePackage`, `filterEntries` y `applyToStore` (store inyectable con semántica gkey/ckey).
  - `validatePackage` rechaza: versión ausente, metadata incompleta, sin notas, notas fuera de rango, atribución vacía, campos de audio, tamaño > límite.
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 4.2, 4.3, 5.4, 6.1, 6.2, 6.3, 7.2, 7.3, 8.1, 8.2, 8.3, 8.5_

- [x] 2. Tests de propiedades (vitest + fast-check)
  - Añadir `vitest` y `fast-check` como devDependencies y script `"test"`.
  - Implementar P1–P9 en `server/__tests__/community.properties.test.js`, mínimo 100 iteraciones, cada test etiquetado con su propiedad.
  - _Requisitos: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.5, 3.2, 3.3, 4.2, 4.3, 5.4, 6.1, 6.2, 6.3, 7.2, 7.3, 8.1, 8.2, 8.3, 8.5_

- [x] 3. Metadatos de canción con ffprobe (`server/meta.js`)
  - `readSongMeta(filePath)` lee título/artista/BPM de tags y combina con duración; fallback al nombre de archivo y al BPM del beatmap.
  - _Requisitos: 1.1, 1.2_

- [x] 4. Cliente de GitHub (`server/githubClient.js`)
  - `fetchIndex`, `fetchPackageFile` (lectura raw sin auth) y `publishPackage` (Contents API con token, modos commit/pr). Timeouts y errores descriptivos. Trata todo como datos no confiables.
  - _Requisitos: 3.1, 3.6, 4.1, 4.4, 5.1, 5.5_

- [x] 5. Catálogo local (`server/communityCatalog.js`)
  - `syncCatalog`, `getCatalog`, `entriesForFingerprint`. Persistencia en `~/.rhythm-dance/community-index.json`. Conserva el catálogo previo si falla la red.
  - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1_

- [x] 6. Endpoints `/api/community/*` en `server/index.js`
  - config (GET/POST sin exponer token), fingerprint/:id, sync, catalog, search, available/:id, package, publish, apply, report.
  - Manejo de errores con la tabla del diseño (needAuth, needsConfirm, needAudio, 502/503).
  - Sincronización del catálogo al arrancar (no bloqueante).
  - _Requisitos: 3.1–3.6, 4.1–4.5, 5.1–5.5, 6.1–6.5, 7.1–7.4, 8.4, 9.1, 9.5, 9.6, 10.1–10.3_

- [x] 7. Integración con el descargador (Req 10)
  - Tras el evento `done` de `/api/download`, calcular fingerprint y adjuntar `communityCharts` si hay coincidencias en el catálogo.
  - _Requisitos: 10.1, 10.2, 10.3, 10.5, 10.6_

- [x] 8. UI pestaña "Comunidad" (`index.html` + `src/main.js`)
  - Configuración (token/repo), buscar (selector de canción local + filtros), resultados con metadata+atribución, descargar y aplicar (con confirmación de sobrescritura), reportar, y publicar desde el editor (atribución obligatoria).
  - Aviso post-descarga de charts disponibles con opción de aplicar.
  - _Requisitos: 3.5, 4.4, 4.5, 6.5, 7.1, 7.3, 7.4, 8.4, 9.6, 10.2, 10.4_

- [x] 9. Verificación final
  - Correr `npm test` (propiedades), `npm run build:client`, y un arranque de la app. Confirmar que la carpeta `community-charts/` no entra al empaquetado.
  - _Requisitos: todos_
