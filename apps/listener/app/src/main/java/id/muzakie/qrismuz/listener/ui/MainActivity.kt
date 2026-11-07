package id.muzakie.qrismuz.listener.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import id.muzakie.qrismuz.listener.Graph
import id.muzakie.qrismuz.listener.capture.PairingLink

enum class Screen { Home, Detect, Log, Settings }

class MainActivity : ComponentActivity() {
    /** Link pairing yang dibuka dari luar (qrismuz://pair?...), diteruskan ke layar pairing. */
    private val incomingLink = mutableStateOf<PairingLink?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        readLink(intent)
        setContent {
            ListenerTheme {
                Surface(color = Palette.canvas, modifier = Modifier.fillMaxSize()) {
                    Box(Modifier.safeDrawingPadding()) { Root() }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        readLink(intent)
    }

    private fun readLink(intent: Intent?) {
        intent?.dataString?.let { PairingLink.parse(it) }?.let { incomingLink.value = it }
    }

    @androidx.compose.runtime.Composable
    private fun Root() {
        var paired by remember { mutableStateOf(Graph.prefs.isPaired) }
        var screen by remember { mutableStateOf(Screen.Home) }
        var pinUnlocked by remember { mutableStateOf(false) }

        if (!paired) {
            PairScreen(initial = incomingLink.value, onPaired = { paired = true; screen = Screen.Home })
            return
        }
        BackHandler(enabled = screen != Screen.Home) { screen = Screen.Home }
        when (screen) {
            Screen.Home -> HomeScreen(onNavigate = { screen = it })
            Screen.Detect -> DetectScreen(onBack = { screen = Screen.Home })
            Screen.Log -> LogScreen(onBack = { screen = Screen.Home })
            Screen.Settings ->
                if (Graph.prefs.hasPin && !pinUnlocked) {
                    PinDialog(
                        title = "Masukkan PIN",
                        onDismiss = { screen = Screen.Home },
                        onSubmit = { pin -> Graph.prefs.checkPin(pin).also { if (it) pinUnlocked = true } },
                    )
                } else {
                    SettingsScreen(
                        onBack = { screen = Screen.Home; pinUnlocked = false },
                        onUnpaired = { paired = false; pinUnlocked = false },
                    )
                }
        }
    }
}
