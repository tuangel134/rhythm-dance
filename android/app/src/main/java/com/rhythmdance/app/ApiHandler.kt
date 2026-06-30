package com.rhythmdance.app

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Environment
import android.util.Base64
import android.webkit.WebResourceResponse
import androidx.documentfile.provider.DocumentFile
import com.rhythmdance.app.game.AudioDecoder
import com.rhythmdance.app.game.Chart
import com.rhythmdance.app.game.ChartGenerator
import com.rhythmdance.app.game.StepModel
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

// Backend nativo OFFLINE del juego. Sirve los endpoints /api/* que el cliente
// web (assets/dist) espera, para que el juego completo funcione en el telefono
// SIN PC. Reusa el motor Kotlin (ChartGenerator/AudioDecoder) ya presente.
//
// Sin descargas: la musica se toma de una CARPETA local que el usuario elige.
// Persistencia en JSON dentro de filesDir (privado de la app):
//   rd-config.json   -> { musicDirs: [..], musicDir: ".." }
//   profile.json, scores.json, customcharts.json, songsettings.json,
//   replays.json, unlocks.json
class ApiHandler(private val ctx: Context) {

    companion object {
        private val SONG_ID_CACHE = HashMap<String, String>()
        val AUDIO_EXT = setOf("mp3", "m4a", "aac", "ogg", "opus", "wav", "flac", "webm")

        // id de cancion = Base64(URL_SAFE) de la ruta absoluta del archivo.
        fun encodeSongId(path: String): String =
            Base64.encodeToString(path.toByteArray(Charsets.UTF_8), Base64.URL_SAFE or Base64.NO_WRAP)

        fun decodeSongPath(songId: String): String? {
            SONG_ID_CACHE[songId]?.let { return it }
            return try {
                val s = String(Base64.decode(songId, Base64.URL_SAFE), Charsets.UTF_8)
                SONG_ID_CACHE[songId] = s
                s
            } catch (e: Exception) { null }
        }
    }

    // ---------------- Persistencia JSON ----------------
    private fun jsonFile(name: String) = File(ctx.filesDir, name)
    private fun readJson(name: String): JSONObject? = try {
        val f = jsonFile(name)
        if (f.exists()) JSONObject(f.readText()) else null
    } catch (e: Exception) { null }
    private fun writeJson(name: String, obj: JSONObject) {
        try { jsonFile(name).writeText(obj.toString(2)) } catch (_: Exception) {}
    }

    private fun jsonResp(json: String): WebResourceResponse =
        WebResourceResponse("application/json", "UTF-8", ByteArrayInputStream(json.toByteArray(Charsets.UTF_8)))

    // ---------------- Config / carpetas de musica ----------------
    private fun config(): JSONObject = readJson("rd-config.json") ?: JSONObject().also {
        it.put("musicDirs", JSONArray())
    }
    private fun saveConfig(c: JSONObject) = writeJson("rd-config.json", c)

    private fun defaultMusicDir(): File =
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)

    fun musicDirs(): List<File> {
        val c = config()
        val arr = c.optJSONArray("musicDirs") ?: JSONArray()
        val out = ArrayList<File>()
        for (i in 0 until arr.length()) {
            val p = arr.optString(i, "")
            if (p.isNotBlank()) out.add(File(p))
        }
        if (out.isEmpty()) {
            val d = defaultMusicDir()
            if (d.isDirectory) out.add(d)
        }
        return out
    }

    private fun addFolder(path: String): Boolean {
        val f = File(path)
        if (!f.isDirectory) return false
        val c = config()
        val arr = c.optJSONArray("musicDirs") ?: JSONArray()
        var exists = false
        for (i in 0 until arr.length()) if (arr.optString(i) == f.absolutePath) exists = true
        if (!exists) { arr.put(f.absolutePath); c.put("musicDirs", arr); saveConfig(c) }
        return true
    }
    private fun removeFolder(path: String) {
        val c = config(); val arr = c.optJSONArray("musicDirs") ?: return
        val keep = JSONArray()
        for (i in 0 until arr.length()) if (arr.optString(i) != File(path).absolutePath) keep.put(arr.optString(i))
        c.put("musicDirs", keep); saveConfig(c)
    }

    // Carpeta del sistema (SAF): persistida como URI de árbol.
    fun setSafTree(uri: String) { val c = config(); c.put("safTree", uri); saveConfig(c) }
    private fun safTree(): String = config().optString("safTree", "")
    fun clearSafTree() { val c = config(); c.remove("safTree"); saveConfig(c) }

    // Uri para un id decodificado: content:// (SAF) o ruta de archivo.
    private fun uriOf(path: String): Uri =
        if (path.startsWith("content://")) Uri.parse(path) else Uri.fromFile(File(path))

    // Escanea la carpeta SAF (si hay) buscando audio. id = base64 del content URI.
    private fun scanSaf(out: JSONArray, seen: HashSet<String>) {
        val tree = safTree(); if (tree.isBlank()) return
        val root = try { DocumentFile.fromTreeUri(ctx, Uri.parse(tree)) } catch (e: Exception) { null } ?: return
        val customs = readJson("customcharts.json")
        fun walk(dir: DocumentFile, depth: Int) {
            val files = try { dir.listFiles() } catch (e: Exception) { return }
            for (f in files) {
                if (f.isDirectory) { if (depth > 0) walk(f, depth - 1); continue }
                val name = f.name ?: continue
                val ext = name.substringAfterLast('.', "").lowercase()
                if (!AUDIO_EXT.contains(ext)) continue
                val uriStr = f.uri.toString()
                if (seen.contains(uriStr)) continue
                seen.add(uriStr)
                val id = encodeSongId(uriStr)
                var hasChart = false
                if (customs != null) { val ks = customs.keys(); while (ks.hasNext()) { if (ks.next().startsWith(id)) { hasChart = true; break } } }
                out.put(JSONObject().put("id", id).put("name", name.substringBeforeLast('.'))
                    .put("file", name).put("folder", "SD/SAF").put("hasChart", hasChart).put("hasVideo", false))
            }
        }
        walk(root, 3)
    }

    // ---------------- Canciones ----------------
    private fun scanDir(dir: File, depth: Int, seen: HashSet<String>, out: JSONArray) {
        if (!dir.isDirectory) return
        val files = dir.listFiles() ?: return
        val customs = readJson("customcharts.json")
        for (f in files) {
            if (f.isDirectory) { if (depth > 0) scanDir(f, depth - 1, seen, out); continue }
            val ext = f.extension.lowercase()
            if (!AUDIO_EXT.contains(ext)) continue
            if (seen.contains(f.absolutePath)) continue
            seen.add(f.absolutePath)
            val id = encodeSongId(f.absolutePath)
            var hasChart = false
            if (customs != null) {
                val keys = customs.keys()
                while (keys.hasNext()) { if (keys.next().startsWith(id)) { hasChart = true; break } }
            }
            val o = JSONObject()
            o.put("id", id)
            o.put("name", f.nameWithoutExtension)
            o.put("file", f.name)
            o.put("folder", dir.absolutePath)
            o.put("hasChart", hasChart)
            o.put("hasVideo", false)
            out.put(o)
        }
    }

    private fun listSongs(): String {
        val arr = JSONArray()
        val seen = HashSet<String>()
        for (d in musicDirs()) scanDir(d, 2, seen, arr)
        scanSaf(arr, seen)   // carpeta del sistema (SAF), si el usuario eligió una
        // ordenar por nombre
        val list = ArrayList<JSONObject>()
        for (i in 0 until arr.length()) list.add(arr.getJSONObject(i))
        list.sortBy { it.optString("name").lowercase() }
        val sorted = JSONArray(); for (o in list) sorted.put(o)
        return JSONObject().put("songs", sorted).toString()
    }

    // ---------------- Audio ----------------
    private fun serveAudio(songId: String): WebResourceResponse? {
        val path = decodeSongPath(songId) ?: return null
        if (path.startsWith("content://")) {
            val uri = Uri.parse(path)
            val mime = ctx.contentResolver.getType(uri) ?: "audio/*"
            val stream = try { ctx.contentResolver.openInputStream(uri) } catch (e: Exception) { null } ?: return null
            return WebResourceResponse(mime, null, stream)
        }
        val file = File(path)
        if (!file.exists()) return null
        val mime = when (file.extension.lowercase()) {
            "wav" -> "audio/wav"; "flac" -> "audio/flac"; "ogg", "opus" -> "audio/ogg"
            "m4a", "aac" -> "audio/mp4"; "webm" -> "audio/webm"; else -> "audio/mpeg"
        }
        return WebResourceResponse(mime, null, FileInputStream(file))
    }

    // Carátula embebida (album art) del archivo de audio (FLAC/MP3/M4A…).
    private fun serveCover(songId: String): WebResourceResponse {
        val empty = WebResourceResponse("text/plain", "UTF-8", 204, "No Content", null, ByteArrayInputStream(ByteArray(0)))
        val path = decodeSongPath(songId) ?: return empty
        if (!path.startsWith("content://") && !File(path).exists()) return empty
        val mmr = MediaMetadataRetriever()
        return try {
            mmr.setDataSource(ctx, uriOf(path))
            val pic = mmr.embeddedPicture
            if (pic != null) WebResourceResponse("image/jpeg", null, ByteArrayInputStream(pic)) else empty
        } catch (e: Exception) { empty } finally { try { mmr.release() } catch (_: Exception) {} }
    }

    // Metadatos (artista, duración, título) para mostrar en la lista.
    private fun songMeta(songId: String): String {
        val path = decodeSongPath(songId) ?: return "{}"
        val mmr = MediaMetadataRetriever()
        return try {
            mmr.setDataSource(ctx, uriOf(path))
            val artist = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
                ?: mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST) ?: ""
            val title = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE) ?: ""
            val durMs = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            JSONObject().put("artist", artist).put("title", title).put("duration", durMs / 1000.0).toString()
        } catch (e: Exception) { "{}" } finally { try { mmr.release() } catch (_: Exception) {} }
    }

    // ---------------- Generación de chart ----------------
    private fun diffFor(difficulty: String, lanes: Int): ChartGenerator.Difficulty {
        val base = when (difficulty.lowercase()) {
            "easy", "facil", "fácil" -> ChartGenerator.DIFFICULTIES[0]
            "normal", "ritmo" -> ChartGenerator.DIFFICULTIES[1]
            "hard", "dificil", "difícil", "precision", "precisión" -> ChartGenerator.DIFFICULTIES[2]
            "expert", "experto", "locura", "caos", "supervivencia", "ciego", "ruleta" -> ChartGenerator.DIFFICULTIES[3]
            else -> ChartGenerator.DIFFICULTIES[1]
        }
        // Override de densidad (NPS) si el usuario lo guardó en songsettings.
        return base
    }

    private fun chartToJson(chart: Chart, songPath: String, difficulty: String): String {
        val notes = JSONArray()
        for (n in chart.notes) {
            val o = JSONObject(); o.put("time", n.time); o.put("lane", n.lane)
            if (n.duration > 0.0) o.put("duration", n.duration)
            notes.put(o)
        }
        val o = JSONObject()
        o.put("id", encodeSongId(songPath))
        o.put("bpm", chart.bpm)
        o.put("offset", 0)
        o.put("duration", chart.duration)
        o.put("laneCount", chart.laneCount)
        o.put("notes", notes)
        o.put("difficulty", difficulty)
        val raw = "${(chart.duration * 10).toInt()}:${chart.bpm}:${chart.notes.size}:${chart.laneCount}"
        val digest = MessageDigest.getInstance("SHA1").digest(raw.toByteArray(Charsets.UTF_8))
        o.put("songHash", digest.joinToString("") { "%02x".format(it) }.take(16))
        return o.toString()
    }

    // Genera (o devuelve cacheado/editado) el chart de una canción.
    private fun generateChart(songId: String, difficulty: String, lanes: Int, genre: String, game: String): String {
        // 1) ¿Hay chart guardado del editor para id_diff_game_lanes?
        val key = "${songId}_${difficulty}_${game}_${lanes}"
        val customs = readJson("customcharts.json")
        val saved = customs?.optJSONObject(key)
        if (saved != null && (saved.optJSONArray("notes")?.length() ?: 0) > 0) return saved.toString()

        val path = decodeSongPath(songId) ?: return "{\"error\":\"Song not found\"}"
        val isContent = path.startsWith("content://")
        if (!isContent && !File(path).exists()) return "{\"error\":\"Song not found\"}"
        val audio = AudioDecoder.decode(ctx, uriOf(path))
            ?: return "{\"error\":\"No se pudo decodificar el audio\"}"
        val model = StepModel.load(ctx, lanes)   // mini-IA de step-selection (assets)
        val chart = ChartGenerator.generate(audio, lanes, diffFor(difficulty, lanes), 6.0, model)
        return chartToJson(chart, path, difficulty)
    }

    // ---------------- Perfil / scores / logros / etc ----------------
    private fun defaultProfile(uid: String): JSONObject {
        val stats = JSONObject()
            .put("plays", 0).put("failedPlays", 0).put("songsPlayed", JSONArray())
            .put("bestScore", 0).put("bestCombo", 0).put("bestAccuracy", 0).put("bestGrade", JSONObject.NULL)
            .put("totalNotes", 0).put("totalPerfect", 0).put("totalGreat", 0).put("totalGood", 0)
            .put("totalOk", 0).put("totalMiss", 0).put("totalPlaytime", 0).put("totalXp", 0)
            .put("dailyStreak", 0).put("lastDailyDate", JSONObject.NULL)
            .put("byDifficulty", JSONObject()).put("bySong", JSONObject())
        return JSONObject()
            .put("userId", if (uid.isBlank()) JSONObject.NULL else uid)
            .put("displayName", "Jugador").put("publicAlias", JSONObject.NULL)
            .put("createdAt", JSONObject.NULL).put("level", 1).put("xp", 0)
            .put("stats", stats).put("achievements", JSONArray()).put("achievementProgress", JSONObject())
    }
    private fun getProfile(uid: String): String {
        var p = readJson("profile.json")
        if (p == null) { p = defaultProfile(uid); writeJson("profile.json", p) }
        else if (uid.isNotBlank() && p.optString("userId") != uid) { p.put("userId", uid); writeJson("profile.json", p) }
        return p.toString()
    }
    private fun saveProfile(p: JSONObject) = writeJson("profile.json", p)

    private fun getAllScores(): String {
        val s = readJson("scores.json") ?: JSONObject()
        return JSONObject().put("scores", s).toString()
    }
    private fun getSongScores(songId: String): String {
        val s = readJson("scores.json") ?: JSONObject()
        val entry = s.optJSONObject(songId)
        return JSONObject().put("scores", entry ?: JSONObject()).toString()
    }

    private fun getAchievements(): String {
        val unlocks = readJson("unlocks.json")?.optJSONArray("unlocked") ?: JSONArray()
        // El catálogo viene embebido en assets/dist/assets/achievements.json.
        var catalog = JSONArray()
        try {
            val txt = ctx.assets.open("dist/assets/achievements.json").bufferedReader().use { it.readText() }
            catalog = JSONArray(txt)
        } catch (_: Exception) {}
        return JSONObject().put("achievements", catalog).put("unlocked", unlocks)
            .put("progress", readJson("profile.json")?.optJSONObject("achievementProgress") ?: JSONObject()).toString()
    }

    private fun getCustomChart(songId: String, difficulty: String, game: String, lanes: Int): String {
        val key = "${songId}_${difficulty}_${game}_${lanes}"
        val customs = readJson("customcharts.json")
        val c = customs?.optJSONObject(key)
        return JSONObject().put("chart", c ?: JSONObject.NULL).toString()
    }

    private fun getSongSettings(songId: String, game: String): String {
        val key = if (game == "dance" || game.isBlank()) songId else "$game::$songId"
        val s = readJson("songsettings.json")?.optJSONObject(key)
        return JSONObject().put("settings", s ?: JSONObject()).toString()
    }

    private fun getAllReplays(): String {
        val r = readJson("replays.json")?.optJSONArray("replays") ?: JSONArray()
        return JSONObject().put("replays", r).toString()
    }
    private fun getReplayBest(songId: String): String {
        val r = readJson("replays.json")?.optJSONArray("replays") ?: JSONArray()
        var best: JSONObject? = null
        for (i in 0 until r.length()) {
            val e = r.getJSONObject(i)
            if (e.optString("songId") == songId && (best == null || e.optInt("score") > best!!.optInt("score"))) best = e
        }
        return JSONObject().put("replay", best ?: JSONObject.NULL).toString()
    }
    private fun getReplayById(id: String): String {
        val r = readJson("replays.json")?.optJSONArray("replays") ?: JSONArray()
        for (i in 0 until r.length()) { val e = r.getJSONObject(i); if (e.optString("id") == id) return JSONObject().put("replay", e).toString() }
        return JSONObject().put("replay", JSONObject.NULL).toString()
    }

    private fun getDailyChallenge(): String {
        val songsJson = JSONObject(listSongs()).optJSONArray("songs") ?: JSONArray()
        if (songsJson.length() == 0) return JSONObject().put("date", today()).put("error", "sin_canciones").toString()
        val date = today()
        fun hash(s: String): Int { var h = 0; for (c in s) h = (h * 31 + c.code); return Math.abs(h) }
        val song = songsJson.getJSONObject(hash("daily-$date") % songsJson.length())
        val diffs = listOf("normal", "hard", "expert", "ritmo", "locura")
        val difficulty = diffs[hash(date + "diff") % diffs.size]
        val mods = JSONArray()
        val modList = listOf("vanish", "hidden", "drunk", "tornado", "mirror", "reverse", "mini", "mega", "rebote", "gravedad")
        val numMods = if (hash("daily-$date") % 3 == 0) 2 else 1
        for (i in 0 until numMods) { val m = modList[hash(date + "mod" + i) % modList.size]; if (!modsContains(mods, m)) mods.put(m) }
        return JSONObject().put("date", date).put("songId", song.optString("id"))
            .put("songName", song.optString("name")).put("difficulty", difficulty)
            .put("mods", mods).put("variant", JSONObject.NULL).toString()
    }
    private fun modsContains(a: JSONArray, m: String): Boolean { for (i in 0 until a.length()) if (a.optString(i) == m) return true; return false }
    private fun today(): String = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())

    private fun getLeaderboard(songHash: String): String {
        // Sin servidor central: leaderboard local (vacío por ahora).
        return JSONObject().put("scores", JSONArray()).toString()
    }

    private fun getFolders(): String {
        val arr = JSONArray(); for (d in musicDirs()) arr.put(d.absolutePath)
        return JSONObject().put("folders", arr).toString()
    }

    private fun browse(path: String?): String {
        val base = if (path.isNullOrBlank()) Environment.getExternalStorageDirectory() else File(path)
        val dir = if (base.isDirectory) base else (base.parentFile ?: Environment.getExternalStorageDirectory())
        val dirs = JSONArray()
        (dir.listFiles() ?: arrayOf()).filter { it.isDirectory && !it.name.startsWith(".") }
            .sortedBy { it.name.lowercase() }
            .forEach { dirs.put(JSONObject().put("name", it.name).put("path", it.absolutePath)) }
        val parent = dir.parentFile
        return JSONObject().put("path", dir.absolutePath)
            .put("parent", if (parent != null && parent.absolutePath != dir.absolutePath) parent.absolutePath else JSONObject.NULL)
            .put("home", Environment.getExternalStorageDirectory().absolutePath)
            .put("dirs", dirs).toString()
    }

    // ---------------- Router GET ----------------
    fun handle(path: String, uri: Uri): WebResourceResponse? {
        fun q(k: String, d: String) = uri.getQueryParameter(k) ?: d
        try {
            if (path == "/api/status") return jsonResp(getStatus())
            if (path == "/api/songs") return jsonResp(listSongs())
            if (path == "/api/folders") return jsonResp(getFolders())
            if (path == "/api/browse") return jsonResp(browse(uri.getQueryParameter("path")))
            if (path == "/api/download-dir") {
                val dirs = musicDirs(); return jsonResp(JSONObject().put("dir", if (dirs.isNotEmpty()) dirs[0].absolutePath else "").toString())
            }
            if (path.startsWith("/api/audio/")) return serveAudio(path.removePrefix("/api/audio/").substringBefore("?"))
            if (path.startsWith("/api/chart-progress/")) {
                val id = path.removePrefix("/api/chart-progress/").substringBefore("?")
                val beatmap = generateChart(id, q("difficulty", "normal"), q("lanes", "5").toIntOrNull() ?: 5, q("genre", "auto"), q("game", "dance"))
                val sb = StringBuilder()
                sb.append("data: {\"type\":\"progress\",\"percent\":10,\"label\":\"Analizando audio...\"}\n\n")
                if (beatmap.contains("\"error\"")) sb.append("data: {\"type\":\"error\",\"message\":\"fallo al generar\"}\n\n")
                else { sb.append("data: {\"type\":\"progress\",\"percent\":90,\"label\":\"Pista lista\"}\n\n"); sb.append("data: {\"type\":\"done\",\"beatmap\":$beatmap}\n\n") }
                return WebResourceResponse("text/event-stream", "UTF-8", ByteArrayInputStream(sb.toString().toByteArray(Charsets.UTF_8)))
            }
            if (path.startsWith("/api/chart/") || path == "/api/chart") {
                val id = if (path == "/api/chart") (uri.getQueryParameter("id") ?: "") else path.removePrefix("/api/chart/").substringBefore("?")
                return jsonResp(generateChart(id, q("difficulty", "normal"), q("lanes", "5").toIntOrNull() ?: 5, q("genre", "auto"), q("game", "dance")))
            }
            if (path == "/api/profile") return jsonResp(getProfile(uri.getQueryParameter("uid") ?: ""))
            if (path == "/api/scores") return jsonResp(getAllScores())
            if (path.startsWith("/api/score/")) return jsonResp(getSongScores(path.removePrefix("/api/score/").substringBefore("?")))
            if (path == "/api/achievements") return jsonResp(getAchievements())
            if (path.startsWith("/api/songsettings/")) return jsonResp(getSongSettings(path.removePrefix("/api/songsettings/").substringBefore("?"), q("game", "dance")))
            if (path.startsWith("/api/customchart/")) return jsonResp(getCustomChart(path.removePrefix("/api/customchart/").substringBefore("?"), q("difficulty", "normal"), q("game", "dance"), q("lanes", "5").toIntOrNull() ?: 5))
            if (path == "/api/replays") return jsonResp(getAllReplays())
            if (path.startsWith("/api/replay/best")) return jsonResp(getReplayBest(uri.getQueryParameter("songId") ?: ""))
            if (path.startsWith("/api/replay/")) { val rid = path.removePrefix("/api/replay/").substringBefore("?"); return jsonResp(if (rid.isBlank() || rid == "best") getAllReplays() else getReplayById(rid)) }
            if (path.startsWith("/api/daily")) return jsonResp(getDailyChallenge())
            if (path.startsWith("/api/leaderboard/")) return jsonResp(getLeaderboard(path.removePrefix("/api/leaderboard/").substringBefore("?")))
            // Stubs para que la UI no se rompa.
            if (path.startsWith("/api/inputenv")) return jsonResp("{\"os\":\"android\",\"twoKeyboardLagRisk\":false}")
            if (path.startsWith("/api/unlockfps")) return jsonResp("{\"unlockFps\":false}")
            if (path == "/api/tunnel") return jsonResp("{\"ok\":false,\"url\":null,\"publicIp\":null}")
            if (path.startsWith("/api/community")) return jsonResp("{\"entries\":[],\"results\":[],\"charts\":{},\"count\":0,\"fingerprint\":\"\",\"meta\":{}}")
            if (path.startsWith("/api/search")) return jsonResp("{\"results\":[]}")
            if (path.startsWith("/api/cover/")) return serveCover(path.removePrefix("/api/cover/").substringBefore("?"))
            if (path.startsWith("/api/songmeta/")) return jsonResp(songMeta(path.removePrefix("/api/songmeta/").substringBefore("?")))
            if (path.startsWith("/api/video/")) return WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, ByteArrayInputStream(ByteArray(0)))
            if (path.startsWith("/api/download")) return jsonResp("{\"type\":\"error\",\"message\":\"Descargas no disponibles en esta version\"}")
        } catch (e: Exception) {
            return jsonResp("{\"error\":\"${(e.message ?: "error").replace("\"", "'")}\"}")
        }
        return null
    }

    private fun getStatus(): String {
        val dirs = musicDirs()
        return JSONObject().put("ok", true).put("ffmpeg", true).put("ytdlp", false)
            .put("downloadDir", if (dirs.isNotEmpty()) dirs[0].absolutePath else "")
            .put("platform", "android").toString()
    }

    // Importa los charts recuperados del teléfono (bundled en assets). Re-asocia
    // cada chart a la canción ACTUAL que coincida por NOMBRE de archivo (el id
    // viejo es base64 de la ruta del teléfono, que ya no existe).
    private fun importRecoveredCharts(): String {
        val txt = try { ctx.assets.open("recovered-charts.json").bufferedReader().use { it.readText() } }
            catch (e: Exception) { return "{\"ok\":false,\"error\":\"sin datos recuperados\"}" }
        val rec = try { JSONObject(txt) } catch (e: Exception) { return "{\"ok\":false,\"error\":\"json invalido\"}" }
        val songsArr = JSONObject(listSongs()).optJSONArray("songs") ?: JSONArray()
        val nameToId = HashMap<String, String>()
        for (i in 0 until songsArr.length()) { val s = songsArr.getJSONObject(i); nameToId[s.optString("name").lowercase()] = s.optString("id") }
        val out = readJson("customcharts.json") ?: JSONObject()
        var imported = 0
        val keys = rec.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            val sp = k.split("_")
            if (sp.size < 4) continue
            val lanes = sp[sp.size - 1]; val game = sp[sp.size - 2]; val diff = sp[sp.size - 3]
            val oldId = sp.subList(0, sp.size - 3).joinToString("_")
            val path = try { String(Base64.decode(oldId, Base64.URL_SAFE), Charsets.UTF_8) } catch (e: Exception) { continue }
            val base = path.substringAfterLast('/').substringBeforeLast('.').lowercase()
            val newId = nameToId[base] ?: continue
            out.put("${newId}_${diff}_${game}_${lanes}", rec.get(k))
            imported++
        }
        writeJson("customcharts.json", out)
        return JSONObject().put("ok", true).put("imported", imported).put("total", rec.length()).toString()
    }

    // ---------------- Mutaciones (POST/PUT/DELETE via AndroidBridge) ----------------
    fun handleMutation(url: String, method: String, uid: String, body: String): String {
        try {
            val path = url.substringBefore("?")
            val b = try { if (body.isNotBlank()) JSONObject(body) else JSONObject() } catch (_: Exception) { JSONObject() }
            val uri = Uri.parse(if (url.startsWith("http")) url else "https://rd.local$url")

            // Importar charts recuperados del teléfono (re-asociados por nombre).
            if (path == "/api/import-charts") return importRecoveredCharts()
            // Guardar score + actualizar perfil.
            if (path == "/api/score" || path.startsWith("/api/leaderboard/submit")) {
                recordScore(b); return "{\"ok\":true}"
            }
            // Perfil (nombre/alias).
            if (path == "/api/profile") {
                val p = readJson("profile.json") ?: defaultProfile(uid)
                if (b.has("displayName")) p.put("displayName", b.optString("displayName").take(20))
                if (b.has("publicAlias")) p.put("publicAlias", b.optString("publicAlias"))
                if (uid.isNotBlank()) p.put("userId", uid)
                saveProfile(p); return p.toString()
            }
            // Ajustes por canción (NPS).
            if (path.startsWith("/api/songsettings/")) {
                val songId = path.removePrefix("/api/songsettings/")
                val game = b.optString("game", "dance")
                val key = if (game == "dance" || game.isBlank()) songId else "$game::$songId"
                val all = readJson("songsettings.json") ?: JSONObject()
                val s = all.optJSONObject(key) ?: JSONObject().put("nps", JSONObject())
                val nps = s.optJSONObject("nps") ?: JSONObject()
                val diff = b.optString("difficulty", "normal")
                if (b.isNull("nps")) nps.remove(diff) else nps.put(diff, b.optDouble("nps"))
                s.put("nps", nps); all.put(key, s); writeJson("songsettings.json", all)
                return JSONObject().put("ok", true).put("settings", s).toString()
            }
            // Guardar / borrar chart del editor.
            if (path.startsWith("/api/customchart/")) {
                val songId = path.removePrefix("/api/customchart/")
                val game = b.optString("game", "dance")
                val lanes = b.optInt("lanes", 5)
                val diff = b.optString("difficulty", "normal")
                val key = "${songId}_${diff}_${game}_${lanes}"
                val all = readJson("customcharts.json") ?: JSONObject()
                if (method.equals("DELETE", true)) { all.remove(key); writeJson("customcharts.json", all); return "{\"ok\":true}" }
                val chart = b.optJSONObject("chart")
                if (chart != null) { all.put(key, chart); writeJson("customcharts.json", all) }
                return "{\"ok\":true}"
            }
            // Guardar replay.
            if (path == "/api/replays") {
                val all = readJson("replays.json") ?: JSONObject().put("replays", JSONArray())
                val arr = all.optJSONArray("replays") ?: JSONArray()
                if (!b.has("id")) b.put("id", System.currentTimeMillis().toString())
                arr.put(b); all.put("replays", arr); writeJson("replays.json", all)
                return JSONObject().put("ok", true).put("id", b.optString("id")).toString()
            }
            // Daily submit: persiste el score del día con ranking local.
            if (path.startsWith("/api/daily")) {
                val all = readJson("daily.json") ?: JSONObject()
                val date = today()
                val day = all.optJSONObject(date) ?: JSONObject().put("scores", JSONArray())
                val scores = day.optJSONArray("scores") ?: JSONArray()
                scores.put(JSONObject().put("name", b.optString("name", "Tú")).put("score", b.optInt("score"))
                    .put("accuracy", b.optDouble("accuracy", 0.0)).put("grade", b.optString("grade")).put("date", date))
                val list = ArrayList<JSONObject>(); for (i in 0 until scores.length()) list.add(scores.getJSONObject(i))
                list.sortByDescending { it.optInt("score") }
                val sorted = JSONArray(); for (o in list.take(100)) sorted.put(o)
                day.put("scores", sorted); all.put(date, day); writeJson("daily.json", all)
                val rank = list.indexOfFirst { it.optInt("score") == b.optInt("score") } + 1
                return JSONObject().put("ok", true).put("rank", if (rank < 1) 1 else rank).put("total", sorted.length()).toString()
            }
            // Carpetas de música.
            if (path == "/api/folders") {
                if (method.equals("DELETE", true)) { removeFolder(b.optString("path")); return "{\"ok\":true}" }
                // exclusive = usar SOLO esta carpeta (borra las demás).
                if (b.optBoolean("exclusive")) { val c = config(); c.put("musicDirs", JSONArray()); saveConfig(c) }
                val ok = addFolder(b.optString("path")); return JSONObject().put("ok", ok).put("folder", b.optString("path")).toString()
            }
            if (path == "/api/download-dir") {
                val p = b.optString("path"); if (addFolder(p)) { val c = config(); c.put("musicDir", p); saveConfig(c) }
                return JSONObject().put("ok", true).put("dir", p).toString()
            }
            // Borrar canción (solo del índice; no borramos el archivo del usuario).
            if (path.startsWith("/api/songs/")) return "{\"ok\":true}"
        } catch (e: Exception) {
            return "{\"ok\":false,\"error\":\"${(e.message ?: "error").replace("\"", "'")}\"}"
        }
        return "{\"ok\":true}"
    }

    // Registra un score y actualiza estadísticas del perfil (versión compacta).
    private fun recordScore(b: JSONObject) {
        val songId = if (b.has("songId")) b.optString("songId") else b.optString("songHash")
        if (songId.isNotBlank()) {
            val all = readJson("scores.json") ?: JSONObject()
            val entry = all.optJSONObject(songId) ?: JSONObject().put("plays", 0).put("best", JSONObject.NULL)
            entry.put("name", b.optString("name", entry.optString("name")))
            entry.put("plays", entry.optInt("plays") + 1)
            val best = entry.optJSONObject("best")
            if (best == null || b.optInt("score") > best.optInt("score")) {
                entry.put("best", JSONObject().put("score", b.optInt("score")).put("accuracy", b.optDouble("accuracy", 0.0))
                    .put("grade", b.optString("grade")).put("difficulty", b.optString("difficulty"))
                    .put("maxCombo", b.optInt("maxCombo")).put("date", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).format(java.util.Date())))
            }
            all.put(songId, entry); writeJson("scores.json", all)
        }
        // Perfil: stats agregadas + XP.
        val p = readJson("profile.json") ?: defaultProfile("")
        val s = p.optJSONObject("stats")!!
        s.put("plays", s.optInt("plays") + 1)
        if (!b.optBoolean("failed")) {
            if (b.optInt("score") > s.optInt("bestScore")) s.put("bestScore", b.optInt("score"))
            if (b.optInt("maxCombo") > s.optInt("bestCombo")) s.put("bestCombo", b.optInt("maxCombo"))
            if (b.optDouble("accuracy", 0.0) > s.optDouble("bestAccuracy", 0.0)) s.put("bestAccuracy", b.optDouble("accuracy", 0.0))
        }
        var xp = if (b.optBoolean("failed")) 1 else (10 + (b.optDouble("accuracy", 0.0) / 5).toInt())
        p.put("xp", p.optInt("xp") + xp); p.put("level", p.optInt("xp") / 100 + 1)
        saveProfile(p)
    }
}
