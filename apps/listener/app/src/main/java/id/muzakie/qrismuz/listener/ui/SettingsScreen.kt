package id.muzakie.qrismuz.listener.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.muzakie.qrismuz.listener.BuildConfig
import id.muzakie.qrismuz.listener.Graph
import id.muzakie.qrismuz.listener.capture.CaptureService
import id.muzakie.qrismuz.listener.data.EventSender
import id.muzakie.qrismuz.listener.service.KeepAliveService
import id.muzakie.qrismuz.listener.work.Work
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(onBack: () -> Unit, onUnpaired: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var message by remember { mutableStateOf<String?>(null) }
    var settingPin by remember { mutableStateOf(false) }
    var confirmUnpair by remember { mutableStateOf(false) }
    var hasPin by remember { mutableStateOf(Graph.prefs.hasPin) }

    Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Header("Pengaturan", onBack = onBack)
        Panel {
            KeyValue("Server") { Text(Graph.prefs.serverUrl.orEmpty(), fontSize = 13.sp) }
            KeyValue("ID device") { Text(Graph.prefs.deviceId.orEmpty(), fontFamily = FontFamily.Monospace, fontSize = 12.sp) }
            KeyValue("Versi aplikasi") { Text(BuildConfig.VERSION_NAME) }
        }
        Panel {
            ActionButton("Kirim ulang antrian sekarang", Icons.Default.Send, Modifier.fillMaxWidth()) {
                scope.launch {
                    message = when (val r = Graph.sender.flush()) {
                        is EventSender.Result.Sent -> "${r.count} notifikasi terkirim."
                        EventSender.Result.NotPaired -> "HP belum dipasangkan."
                        is EventSender.Result.Failed -> "Gagal: ${r.message}"
                    }
                }
            }
            ActionButton("Pindai ulang notifikasi yang tampil", Icons.Default.Refresh, Modifier.fillMaxWidth()) {
                val svc = CaptureService.instance
                if (svc == null) message = "Listener belum tersambung." else { svc.rescan(); message = "Notifikasi dipindai ulang." }
            }
            ActionButton(if (hasPin) "Ganti atau hapus PIN" else "Pasang PIN", Icons.Default.Lock, Modifier.fillMaxWidth()) { settingPin = true }
            if (message != null) Hint(message!!)
        }
        Panel {
            Hint("Mencabut pairing menghapus kunci dan antrian di HP ini. Notifikasi yang belum terkirim akan hilang. Untuk memakai lagi, buat token pairing baru di dashboard.", Palette.bad)
            TextButton(onClick = { confirmUnpair = true }) { Text("Cabut pairing HP ini", color = Palette.bad) }
        }
    }

    if (settingPin) {
        PinDialog(
            title = if (hasPin) "PIN baru (kosongkan untuk menghapus)" else "Buat PIN 4–6 angka",
            allowEmpty = hasPin,
            onDismiss = { settingPin = false },
            onSubmit = { pin ->
                Graph.prefs.setPin(pin.ifEmpty { null })
                hasPin = Graph.prefs.hasPin
                message = if (hasPin) "PIN disimpan." else "PIN dihapus."
                settingPin = false
                true
            },
        )
    }

    if (confirmUnpair) {
        AlertDialog(
            onDismissRequest = { confirmUnpair = false },
            title = { Text("Cabut pairing HP ini?") },
            text = { Text("HP ini berhenti mengirim notifikasi pembayaran ke server.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmUnpair = false
                    scope.launch {
                        KeepAliveService.stop(context)
                        Work.cancelAll(context)
                        Graph.db.events().clear()
                        Graph.prefs.unpair()
                        onUnpaired()
                    }
                }) { Text("Cabut pairing", color = Palette.bad) }
            },
            dismissButton = { TextButton(onClick = { confirmUnpair = false }) { Text("Batal") } },
        )
    }
}

/** Dialog PIN. onSubmit mengembalikan false bila PIN salah. */
@Composable
fun PinDialog(title: String, onDismiss: () -> Unit, onSubmit: (String) -> Boolean, allowEmpty: Boolean = false) {
    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = pin,
                    onValueChange = { v -> pin = v.filter { it.isDigit() }.take(6); error = null },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    label = { Text("PIN") },
                )
                if (error != null) Hint(error!!, Palette.bad)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                when {
                    pin.isEmpty() && allowEmpty -> onSubmit("")
                    pin.length !in 4..6 -> error = "PIN harus 4–6 angka."
                    !onSubmit(pin) -> error = "PIN salah."
                }
            }) { Text("OK") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } },
    )
}
