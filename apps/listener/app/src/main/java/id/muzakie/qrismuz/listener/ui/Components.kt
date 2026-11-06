package id.muzakie.qrismuz.listener.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val idLocale = Locale.forLanguageTag("id-ID")

fun formatTime(ms: Long): String = SimpleDateFormat("d MMM, HH.mm.ss", idLocale).format(Date(ms))

fun ago(ms: Long, now: Long = System.currentTimeMillis()): String {
    if (ms <= 0) return "belum pernah"
    val s = (now - ms) / 1000
    return when {
        s < 5 -> "baru saja"
        s < 60 -> "$s detik lalu"
        s < 3600 -> "${s / 60} menit lalu"
        s < 86400 -> "${s / 3600} jam lalu"
        else -> formatTime(ms)
    }
}

@Composable
fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = Palette.surface,
        border = BorderStroke(1.dp, Palette.line),
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(text, fontSize = 17.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(top = 6.dp))
}

@Composable
fun Header(title: String, onBack: (() -> Unit)? = null, subtitle: String? = null) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
        if (onBack != null) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali") }
            Spacer(Modifier.width(4.dp))
        }
        Column {
            Text(title, fontSize = 24.sp, fontWeight = FontWeight.Medium)
            if (subtitle != null) Text(subtitle, color = Palette.faint, fontSize = 13.sp)
        }
    }
}

enum class Tone { Ok, Bad, Warn, Neutral }

@Composable
fun Pill(text: String, tone: Tone) {
    val (fg, bg) = when (tone) {
        Tone.Ok -> Palette.ok to Palette.okBg
        Tone.Bad -> Palette.bad to Palette.badBg
        Tone.Warn -> Palette.warn to Palette.warnBg
        Tone.Neutral -> Palette.muted to Palette.subtle
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.background(bg, RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Box(Modifier.size(6.dp).background(fg, CircleShape))
        Spacer(Modifier.width(6.dp))
        Text(text, color = fg, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun KeyValue(label: String, value: @Composable () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 32.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Palette.muted, modifier = Modifier.weight(1f))
        value()
    }
}

@Composable
fun ActionButton(text: String, icon: ImageVector? = null, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = 44.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, Palette.line),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Palette.surface, contentColor = Palette.ink),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text)
    }
}

@Composable
fun Hint(text: String, color: Color = Palette.faint) {
    Text(text, color = color, fontSize = 13.sp, lineHeight = 18.sp)
}
