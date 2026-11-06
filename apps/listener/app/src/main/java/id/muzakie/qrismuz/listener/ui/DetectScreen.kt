package id.muzakie.qrismuz.listener.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.muzakie.qrismuz.listener.capture.Detection
import kotlinx.coroutines.delay

@Composable
fun DetectScreen(onBack: () -> Unit) {
    val clipboard = LocalClipboardManager.current
    val until by Detection.until.collectAsState()
    val items by Detection.items.collectAsState()
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(1_000); now = System.currentTimeMillis() } }
    val left = ((until - now) / 1000).coerceAtLeast(0)

    LazyColumn(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Header("Mode deteksi", onBack = onBack) }
        item {
            Panel {
                Hint("Selama mode ini aktif, semua notifikasi tampil di sini beserta nama package-nya. Tidak ada yang disimpan atau dikirim ke server.")
                Hint("Caranya: bayar Rp1 ke QRIS DANA Bisnis dan ke QRIS GoPay Merchant, lalu salin package yang muncul dan daftarkan di dashboard (menu QRIS).")
                if (left > 0) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Pill("Aktif · ${left / 60}.${"%02d".format(left % 60)}", Tone.Ok)
                        TextButton(onClick = { Detection.stop() }) { Text("Hentikan") }
                    }
                } else {
                    Button(onClick = { Detection.start() }, shape = RoundedCornerShape(999.dp), modifier = Modifier.fillMaxWidth()) {
                        Text("Mulai deteksi (10 menit)")
                    }
                }
            }
        }
        if (left > 0 && items.isEmpty()) item { Hint("Menunggu notifikasi masuk…") }
        items(items, key = { "${it.packageName}-${it.at}-${it.title}" }) { n ->
            Panel {
                Text(n.appLabel, fontWeight = FontWeight.Medium)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(n.packageName, fontFamily = FontFamily.Monospace, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = { clipboard.setText(AnnotatedString(n.packageName)) }) { Text("Salin") }
                }
                Column {
                    if (!n.title.isNullOrBlank()) Text(n.title, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    if (!n.text.isNullOrBlank()) Text(n.text, fontSize = 14.sp)
                }
                Text(formatTime(n.at), color = Palette.faint, fontSize = 12.sp)
            }
        }
    }
}
