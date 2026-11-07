package id.muzakie.qrismuz.listener.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Warna mengikuti dashboard web: abu-abu netral, aksen hitam, hijau untuk berhasil. */
object Palette {
    val canvas = Color(0xFFF3F3F2)
    val surface = Color(0xFFFFFFFF)
    val subtle = Color(0xFFF1F1EF)
    val line = Color(0xFFE6E6E3)
    val ink = Color(0xFF111111)
    val muted = Color(0xFF4A4A47)
    val faint = Color(0xFF62625F)
    val ok = Color(0xFF157F3C)
    val okBg = Color(0xFFE8F6EC)
    val bad = Color(0xFFB42318)
    val badBg = Color(0xFFFDECEA)
    val warn = Color(0xFF8A4B05)
    val warnBg = Color(0xFFFDF3E1)
}

@Composable
fun ListenerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Palette.ink,
            onPrimary = Color.White,
            background = Palette.canvas,
            surface = Palette.surface,
            onSurface = Palette.ink,
            onBackground = Palette.ink,
            surfaceVariant = Palette.subtle,
            outline = Palette.line,
            error = Palette.bad,
        ),
        content = content,
    )
}
