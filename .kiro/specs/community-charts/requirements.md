# Requirements Document

## Introduction

Esta funcionalidad ("community-charts") permite que la comunidad de Rhythm Dance comparta entre sí los charts (mapeos de notas) que crea en el editor del juego, usando GitHub como medio de distribución. El objetivo es que cualquier usuario pueda publicar un chart que hizo, descubrir charts hechos por otros y aplicarlos a sus propias canciones locales.

El punto crítico de diseño es el respeto a los derechos de autor: el sistema NUNCA distribuye audio. Solo se comparte el mapeo de notas y los metadatos necesarios para identificar a qué canción pertenece un chart. Cada usuario debe poseer su propio archivo de audio local para poder jugar un chart descargado. Para vincular un chart con la canción correcta sin incluir el audio, el sistema usa una huella/identificador de la canción (Song_Fingerprint) derivada de metadatos y características, no del contenido sonoro distribuible.

Los charts se separan por juego ("dance" = Pump It Up/DDR, "guitar" = Guitar Hero) y por número de carriles (4 o 5), igual que en el sistema actual de charts del editor.

## Glossary

- **Community_Charts_System**: subsistema que permite publicar, buscar, descargar y aplicar charts de la comunidad usando GitHub como medio de distribución.
- **Chart**: mapeo de notas de una canción para un juego, una dificultad y un número de carriles, con la forma `{ laneCount, duration, bpm, notes: [{ time, lane, duration? }] }`.
- **Chart_Package**: archivo serializable (formato JSON) que contiene un Chart, su Chart_Metadata, su Author_Attribution y su Song_Fingerprint, y que NO contiene audio.
- **Chart_Metadata**: conjunto de datos descriptivos de un Chart: juego ("dance" o "guitar"), dificultad, número de carriles (laneCount), título de la canción, artista, BPM y duración en segundos.
- **Author_Attribution**: información de autoría de un Chart, incluyendo el nombre o identificador público de quien lo creó.
- **Song_Fingerprint**: identificador reproducible derivado de los metadatos y características no sonoras de una canción (por ejemplo, título normalizado, artista, duración y BPM) que permite reconocer la canción sin incluir su audio.
- **Chart_Repository**: repositorio público de GitHub donde se almacenan los Chart_Package publicados por la comunidad.
- **Local_Chart_Catalog**: copia local que el juego mantiene del índice de charts de la comunidad (solo metadatos y mapeos de notas, nunca audio), sincronizada desde el Chart_Repository, que permite saber qué charts existen sin consultar la red en cada uso.
- **Music_Download**: acción del usuario de descargar una canción (audio) mediante el descargador integrado del juego.
- **Editor**: editor de charts existente dentro del juego, donde el usuario crea y guarda mapeos localmente.
- **Local_Song_Library**: conjunto de archivos de audio locales del usuario gestionados por la biblioteca del juego.
- **User**: persona que usa Rhythm Dance.
- **Contributor**: User que publica un Chart_Package en el Chart_Repository.

## Requirements

### Requirement 1: Identificación de la canción sin distribuir audio

**User Story:** Como usuario, quiero que un chart compartido identifique a qué canción pertenece sin incluir el audio, para respetar los derechos de autor y poder emparejarlo con mi propio archivo local.

#### Acceptance Criteria

1. THE Community_Charts_System SHALL compute a Song_Fingerprint from a song's Chart_Metadata without reading or including the song's audio content.
2. WHEN the Community_Charts_System computes a Song_Fingerprint twice from identical Chart_Metadata, THE Community_Charts_System SHALL produce identical Song_Fingerprint values.
3. WHEN the Community_Charts_System creates a Chart_Package, THE Community_Charts_System SHALL include the Song_Fingerprint, the Chart, the Chart_Metadata, and the Author_Attribution.
4. THE Community_Charts_System SHALL include in a Chart_Package only note data and metadata, excluding any audio data.
5. WHERE two distinct songs differ in title, artist, duration, or BPM, THE Community_Charts_System SHALL compute different Song_Fingerprint values for the two songs.

### Requirement 2: Serialización y lectura del Chart_Package

**User Story:** Como desarrollador, quiero un formato de Chart_Package que se pueda serializar y leer de forma confiable, para que los charts compartidos no se corrompan al pasar por GitHub.

#### Acceptance Criteria

1. THE Community_Charts_System SHALL serialize a Chart, its Chart_Metadata, its Author_Attribution, and its Song_Fingerprint into a Chart_Package in JSON format.
2. WHEN a valid Chart_Package is provided, THE Community_Charts_System SHALL parse the Chart_Package into a Chart, Chart_Metadata, Author_Attribution, and Song_Fingerprint.
3. FOR ALL valid Chart_Package objects, serializing a Chart_Package and then parsing the result SHALL produce an equivalent Chart_Package (round-trip property).
4. IF a Chart_Package is malformed or missing required fields, THEN THE Community_Charts_System SHALL reject the Chart_Package and return a descriptive error message.
5. THE Community_Charts_System SHALL record a format version identifier inside each Chart_Package.

### Requirement 3: Publicar un chart propio en GitHub

**User Story:** Como contribuidor, quiero publicar en GitHub un chart que hice en el editor, para que la comunidad pueda usarlo.

#### Acceptance Criteria

1. WHEN a user requests to publish a Chart stored in the Editor, THE Community_Charts_System SHALL build a Chart_Package from that Chart and submit the Chart_Package to the Chart_Repository.
2. WHEN a user publishes a Chart_Package, THE Community_Charts_System SHALL attach the Author_Attribution provided by the user.
3. WHEN a user publishes a Chart_Package, THE Community_Charts_System SHALL attach the Chart_Metadata including game, difficulty, laneCount, song title, artist, BPM, and duration.
4. THE Community_Charts_System SHALL exclude audio data from every published Chart_Package.
5. WHERE publishing to the Chart_Repository requires authentication, THE Community_Charts_System SHALL request the required credentials from the user before submitting the Chart_Package.
6. IF submission to the Chart_Repository fails, THEN THE Community_Charts_System SHALL report a descriptive error message to the user and SHALL retain the local Chart unchanged.

### Requirement 4: Buscar charts de la comunidad

**User Story:** Como usuario, quiero buscar charts publicados por otros, para encontrar mapeos de las canciones que tengo.

#### Acceptance Criteria

1. WHEN a user submits a search request, THE Community_Charts_System SHALL query the Chart_Repository and return the matching Chart_Packages with their Chart_Metadata and Author_Attribution.
2. WHERE a user selects a song from the Local_Song_Library, THE Community_Charts_System SHALL list the Chart_Packages whose Song_Fingerprint matches the selected song's Song_Fingerprint.
3. WHERE a user applies a filter by game, difficulty, or laneCount, THE Community_Charts_System SHALL return only the Chart_Packages that match the applied filter.
4. IF the Chart_Repository is unreachable, THEN THE Community_Charts_System SHALL report a descriptive error message and SHALL allow the user to continue using local charts.
5. WHEN a search request returns no matching Chart_Packages, THE Community_Charts_System SHALL display an empty-result indication to the user.

### Requirement 5: Descargar charts de la comunidad

**User Story:** Como usuario, quiero descargar un chart de la comunidad, para tenerlo disponible en mi instalación.

#### Acceptance Criteria

1. WHEN a user selects a Chart_Package from the search results, THE Community_Charts_System SHALL download the Chart_Package from the Chart_Repository.
2. WHEN the Community_Charts_System downloads a Chart_Package, THE Community_Charts_System SHALL validate the Chart_Package against the format defined in Requirement 2 before storing the Chart_Package.
3. IF a downloaded Chart_Package fails validation, THEN THE Community_Charts_System SHALL reject the Chart_Package and report a descriptive error message.
4. IF a downloaded Chart_Package contains audio data, THEN THE Community_Charts_System SHALL reject the Chart_Package.
5. WHEN a download fails before completion, THEN THE Community_Charts_System SHALL report a descriptive error message and SHALL leave the Local_Song_Library and stored charts unchanged.

### Requirement 6: Aplicar un chart descargado a la canción local

**User Story:** Como usuario, quiero aplicar un chart descargado a mi propia canción local, para jugarlo con mi audio.

#### Acceptance Criteria

1. WHEN a downloaded Chart_Package's Song_Fingerprint matches a song in the Local_Song_Library, THE Community_Charts_System SHALL offer to apply the Chart to that local song.
2. WHEN a user applies a downloaded Chart, THE Community_Charts_System SHALL store the Chart so that the game loads the Chart for the corresponding game, difficulty, and laneCount.
3. THE Community_Charts_System SHALL keep charts separated by game and by laneCount when applying a downloaded Chart, so that a 4-lane chart and a 5-lane chart of the same song and difficulty do not overwrite each other.
4. IF the Local_Song_Library contains no playable local song for the Chart_Package, whether because no Song_Fingerprint matches or because the matched audio file is missing or unreadable, THEN THE Community_Charts_System SHALL inform the user that the matching audio file is required to play the Chart.
5. IF applying a downloaded Chart would overwrite an existing local Chart for the same song, game, difficulty, and laneCount, THEN THE Community_Charts_System SHALL request the user's confirmation before overwriting.

### Requirement 7: Atribución y metadatos del chart

**User Story:** Como creador de charts, quiero que se conserve mi autoría y los datos de la canción, para recibir crédito y para que los usuarios reconozcan el chart.

#### Acceptance Criteria

1. THE Community_Charts_System SHALL display the Author_Attribution and the Chart_Metadata for each Chart_Package shown to the user.
2. WHEN a user applies a downloaded Chart, THE Community_Charts_System SHALL preserve the original Author_Attribution together with the stored Chart.
3. IF a user attempts to publish a Chart_Package with an empty Author_Attribution, THEN THE Community_Charts_System SHALL block the submission until a non-empty Author_Attribution is provided.
4. THE Community_Charts_System SHALL display the song title, artist, BPM, duration, game, difficulty, and laneCount for each Chart_Package shown to the user.

### Requirement 8: Validación de calidad, moderación y abusos

**User Story:** Como miembro de la comunidad, quiero que los charts compartidos cumplan un mínimo de calidad y que existan controles ante abusos, para que la colección sea confiable.

#### Acceptance Criteria

1. WHEN the Community_Charts_System receives a Chart_Package for publishing or downloading, THE Community_Charts_System SHALL validate that the Chart contains at least one note and that every note has a time within the song duration and a lane within the laneCount range.
2. IF a Chart_Package fails the note validation defined in acceptance criterion 8.1, THEN THE Community_Charts_System SHALL reject the Chart_Package and report which note validation rule failed.
3. THE Community_Charts_System SHALL reject any Chart_Package whose Chart_Metadata is missing the game, difficulty, laneCount, song title, BPM, or duration.
4. WHERE a user views a published Chart_Package, THE Community_Charts_System SHALL provide a mechanism for the user to report the Chart_Package as inappropriate or infringing.
5. THE Community_Charts_System SHALL reject any Chart_Package that exceeds the maximum allowed Chart_Package size of 5 megabytes.

### Requirement 9: Sincronización del catálogo local de charts de la comunidad

**User Story:** Como usuario, quiero que el juego mantenga al día una copia local del catálogo de charts de la comunidad (sin audio), para saber al instante qué canciones tienen charts disponibles sin tener que buscar en línea cada vez.

#### Acceptance Criteria

1. WHEN the game starts and a network connection to the Chart_Repository is available, THE Community_Charts_System SHALL synchronize the Local_Chart_Catalog from the Chart_Repository.
2. THE Community_Charts_System SHALL store in the Local_Chart_Catalog only chart metadata and note data, excluding any audio data.
3. WHEN the Community_Charts_System synchronizes the Local_Chart_Catalog, THE Community_Charts_System SHALL include every published Chart_Package entry available in the Chart_Repository index.
4. IF the Chart_Repository is unreachable during synchronization, THEN THE Community_Charts_System SHALL retain the previously stored Local_Chart_Catalog and SHALL allow the user to continue using the game.
5. WHERE a synchronization has completed at least once, THE Community_Charts_System SHALL resolve searches and availability checks against the Local_Chart_Catalog without requiring a new network request.
6. THE Community_Charts_System SHALL allow the user to trigger a manual re-synchronization of the Local_Chart_Catalog on demand.

### Requirement 10: Aviso automático de charts disponibles al descargar música

**User Story:** Como usuario, quiero que cuando descargo una canción el juego me avise si la comunidad ya tiene charts para ella, para poder usarlos en vez de generar el mapeo automáticamente.

#### Acceptance Criteria

1. WHEN a Music_Download completes, THE Community_Charts_System SHALL compute the Song_Fingerprint of the downloaded song and look it up in the Local_Chart_Catalog.
2. WHEN the downloaded song's Song_Fingerprint matches at least one entry in the Local_Chart_Catalog, THE Community_Charts_System SHALL notify the user that community charts are available for that song.
3. WHEN the Community_Charts_System notifies the user of available charts, THE Community_Charts_System SHALL list the matching charts grouped by game, difficulty, and laneCount.
4. WHEN the user accepts using a matching chart, THE Community_Charts_System SHALL download (if not already cached) and apply the corresponding Chart_Package to the downloaded song for the selected game, difficulty, and laneCount, following the apply rules of Requirement 6.
5. WHEN the downloaded song's Song_Fingerprint matches no entry in the Local_Chart_Catalog, THE Community_Charts_System SHALL take no action and SHALL let the game proceed with automatic chart generation as usual.
6. IF the user declines the available charts, THEN THE Community_Charts_System SHALL leave the downloaded song without applying any community chart and SHALL let automatic generation proceed as usual.
