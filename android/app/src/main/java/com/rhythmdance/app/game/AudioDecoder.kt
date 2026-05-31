package com.rhythmdance.app.game

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.nio.ByteBuffer
import java.nio.ByteOrder

// Resultado de la decodificacion: muestras PCM mono normalizadas (-1..1) y la
// frecuencia de muestreo. Usado por el generador de pistas para analizar el
// audio. La reproduccion en sí la hace MediaPlayer aparte (con el archivo
// original), porque aqui solo necesitamos los datos para el analisis.
data class DecodedAudio(
    val samples: FloatArray,
    val sampleRate: Int,
) {
    val durationSec: Double get() = if (sampleRate > 0) samples.size.toDouble() / sampleRate else 0.0
}

object AudioDecoder {

    // Decodifica un archivo de audio (Uri de contenido o ruta) a PCM mono.
    // Devuelve null si no se puede decodificar.
    fun decode(context: Context, uri: Uri): DecodedAudio? {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(context, uri, null)
        } catch (e: Exception) {
            try { extractor.setDataSource(uri.toString()) } catch (e2: Exception) { return null }
        }

        // Buscar la primera pista de audio.
        var trackIndex = -1
        var format: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val f = extractor.getTrackFormat(i)
            val mime = f.getString(MediaFormat.KEY_MIME) ?: ""
            if (mime.startsWith("audio/")) { trackIndex = i; format = f; break }
        }
        if (trackIndex < 0 || format == null) { extractor.release(); return null }

        extractor.selectTrack(trackIndex)
        val mime = format.getString(MediaFormat.KEY_MIME)!!
        val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        val channels = if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT))
            format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 1

        val codec = try { MediaCodec.createDecoderByType(mime) } catch (e: Exception) { extractor.release(); return null }
        codec.configure(format, null, null, 0)
        codec.start()

        val out = ArrayList<Float>(sampleRate * 60)   // reserva ~1 min
        val info = MediaCodec.BufferInfo()
        var sawInputEOS = false
        var sawOutputEOS = false
        val timeoutUs = 10_000L

        try {
            while (!sawOutputEOS) {
                if (!sawInputEOS) {
                    val inIndex = codec.dequeueInputBuffer(timeoutUs)
                    if (inIndex >= 0) {
                        val inBuf = codec.getInputBuffer(inIndex)!!
                        val sampleSize = extractor.readSampleData(inBuf, 0)
                        if (sampleSize < 0) {
                            codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            sawInputEOS = true
                        } else {
                            codec.queueInputBuffer(inIndex, 0, sampleSize, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }

                val outIndex = codec.dequeueOutputBuffer(info, timeoutUs)
                if (outIndex >= 0) {
                    if (info.size > 0) {
                        val outBuf = codec.getOutputBuffer(outIndex)!!
                        outBuf.position(info.offset)
                        outBuf.limit(info.offset + info.size)
                        appendPcm(outBuf, channels, out)
                    }
                    codec.releaseOutputBuffer(outIndex, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) sawOutputEOS = true
                } else if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    // El formato real puede cambiar; lo ignoramos (16-bit PCM tipico).
                }
            }
        } catch (e: Exception) {
            // Devolvemos lo que llevemos decodificado.
        } finally {
            try { codec.stop() } catch (_: Exception) {}
            try { codec.release() } catch (_: Exception) {}
            extractor.release()
        }

        if (out.isEmpty()) return null
        val arr = FloatArray(out.size)
        for (i in out.indices) arr[i] = out[i]
        return DecodedAudio(arr, sampleRate)
    }

    // Convierte un buffer PCM 16-bit (intercalado por canales) a mono float.
    private fun appendPcm(buf: ByteBuffer, channels: Int, out: ArrayList<Float>) {
        buf.order(ByteOrder.LITTLE_ENDIAN)
        val shorts = buf.asShortBuffer()
        val n = shorts.remaining()
        var i = 0
        if (channels <= 1) {
            while (i < n) { out.add(shorts.get(i) / 32768f); i++ }
        } else {
            // Promediar canales para obtener mono.
            while (i + channels - 1 < n) {
                var sum = 0f
                for (c in 0 until channels) sum += shorts.get(i + c) / 32768f
                out.add(sum / channels)
                i += channels
            }
        }
    }
}
