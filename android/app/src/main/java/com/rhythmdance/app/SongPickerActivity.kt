package com.rhythmdance.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.rhythmdance.app.game.ChartGenerator

// Selecciona un archivo de audio del telefono, la dificultad, el estilo (4/5)
// y la velocidad; luego lanza GameActivity con esos parametros.
class SongPickerActivity : AppCompatActivity() {

    private var pickedUri: Uri? = null
    private var pickedName: String = ""
    private lateinit var fileLabel: TextView
    private lateinit var diffSpinner: Spinner
    private lateinit var laneSpinner: Spinner
    private lateinit var speedLabel: TextView
    private var speed = 3.0

    private val pickAudio = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) {}
            pickedUri = uri
            pickedName = queryName(uri)
            fileLabel.text = pickedName
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF05060F.toInt())
            setPadding(dp(24), dp(28), dp(24), dp(24))
        }

        root.addView(TextView(this).apply {
            text = "Elige una canción"
            setTextColor(0xFFFFFFFF.toInt()); textSize = 24f; setPadding(0, 0, 0, dp(16))
        })

        root.addView(Button(this).apply {
            text = "📂  Elegir archivo de audio"
            isAllCaps = false; setTextColor(0xFFFFFFFF.toInt())
            backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF29E7FF.toInt())
            setOnClickListener { pickAudio.launch(arrayOf("audio/*")) }
        }, lpW())

        fileLabel = TextView(this).apply {
            text = "(ningún archivo elegido)"
            setTextColor(0xFF8B8FB0.toInt()); textSize = 14f; setPadding(0, dp(8), 0, dp(20))
        }
        root.addView(fileLabel)

        // Dificultad
        root.addView(label("Dificultad"))
        diffSpinner = Spinner(this)
        diffSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item,
            ChartGenerator.DIFFICULTIES.map { it.name })
        diffSpinner.setSelection(1)
        root.addView(diffSpinner, lpW())

        // Estilo (carriles)
        root.addView(label("Estilo"))
        laneSpinner = Spinner(this)
        laneSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item,
            listOf("Pump It Up (5)", "DDR (4)"))
        root.addView(laneSpinner, lpW())

        // Velocidad
        speedLabel = label("Velocidad: 3.0x")
        root.addView(speedLabel)
        val seek = SeekBar(this).apply {
            max = 10; progress = 4   // 1.0 .. 6.0 en pasos de 0.5 -> progress*0.5+1
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar?, p: Int, fromUser: Boolean) {
                    speed = 1.0 + p * 0.5
                    speedLabel.text = "Velocidad: ${"%.1f".format(speed)}x"
                }
                override fun onStartTrackingTouch(sb: SeekBar?) {}
                override fun onStopTrackingTouch(sb: SeekBar?) {}
            })
        }
        root.addView(seek, lpW())

        root.addView(Button(this).apply {
            text = "▶  Generar y jugar"
            isAllCaps = false; textSize = 18f; setTextColor(0xFFFFFFFF.toInt())
            backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFFF2D7E.toInt())
            setOnClickListener { launchGame() }
        }, lpW().apply { topMargin = dp(24) })

        setContentView(root)
    }

    private fun launchGame() {
        val uri = pickedUri
        if (uri == null) {
            android.widget.Toast.makeText(this, "Elige un archivo de audio primero", android.widget.Toast.LENGTH_SHORT).show()
            return
        }
        val lanes = if (laneSpinner.selectedItemPosition == 0) 5 else 4
        val i = Intent(this, GameActivity::class.java).apply {
            putExtra("uri", uri.toString())
            putExtra("name", pickedName)
            putExtra("difficulty", diffSpinner.selectedItemPosition)
            putExtra("lanes", lanes)
            putExtra("speed", speed)
        }
        startActivity(i)
    }

    private fun queryName(uri: Uri): String {
        var name = "Canción"
        try {
            contentResolver.query(uri, null, null, null, null)?.use { c ->
                val idx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (idx >= 0 && c.moveToFirst()) name = c.getString(idx) ?: name
            }
        } catch (_: Exception) {}
        return name.substringBeforeLast('.')
    }

    private fun label(t: String) = TextView(this).apply {
        text = t; setTextColor(0xFFB9BCDA.toInt()); textSize = 14f; setPadding(0, dp(14), 0, dp(4))
    }
    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
    private fun lpW() = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
}
