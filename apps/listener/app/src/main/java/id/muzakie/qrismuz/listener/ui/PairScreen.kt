package id.muzakie.qrismuz.listener.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import androidx.activity.compose.rememberLauncherForActivityResult
import id.muzakie.qrismuz.listener.BuildConfig
import id.muzakie.qrismuz.listener.Graph
import id.muzakie.qrismuz.listener.capture.PairingLink
import id.muzakie.qrismuz.listener.net.ApiException
import id.muzakie.qrismuz.listener.service.KeepAliveService
import id.muzakie.qrismuz.listener.work.Work
import kotlinx.coroutines.launch
import java.io.IOException

@Composable
fun PairScreen(initial: PairingLink?, onPaired: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var server by remember { mutableStateOf(initial?.server ?: "https://") }
    var token by remember { mutableStateOf(initial?.token ?: "") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(initial) {
        if (initial != null) {
            server = initial.server
            token = initial.token
        }
    }

    val scanner = rememberLauncherForActivityResult(ScanContract()) { result ->
        val link = result.contents?.let { PairingLink.parse(it) }
        if (result.contents == null) return@rememberLauncherForActivityResult
        if (link == null) {
            error = "QR ini bukan QR pairing qrismuz."
        } else {
            server = link.server
            token = link.token
            error = null
        }
    }

    fun pair() {
        val url = server.trim().trimEnd('/')
        val allowed = url.startsWith("https://") || (BuildConfig.ALLOW_HTTP && url.startsWith("http://"))
        if (!allowed) {
            error = "Alamat server harus diawali https://"
            return
        }
        if (token.isBlank()) {
            error = "Isi token pairing dari dashboard."
            return
        }
        busy = true
        error = null
        scope.launch {
            try {
                val res = Graph.api.register(url, token.trim())
                Graph.prefs.serverUrl = url
                Graph.prefs.deviceId = res.deviceId
                Graph.prefs.deviceName = res.name
                Graph.prefs.secret = res.secret
                Graph.sender.credentials()?.let { c ->
                    runCatching { Graph.prefs.packages = Graph.api.config(c).packages.toSet() }
                }
                Graph.prefs.markServerOk()
                KeepAliveService.start(context)
                Work.scheduleWatchdog(context)
                onPaired()
            } catch (e: ApiException) {
                error = if (e.status == 410) "Token tidak valid, sudah dipakai, atau kedaluwarsa. Buat token baru di dashboard." else e.message
            } catch (e: IOException) {
                error = "Tidak bisa menghubungi server: ${e.message}"
            } finally {
                busy = false
            }
        }
    }

    Column(
        Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Header("Pasangkan HP", subtitle = "Hubungkan listener ini ke server qrismuz")
        Panel {
            Hint("Di dashboard, buka Perangkat lalu Tambah perangkat. Scan QR yang muncul, atau isi alamat server dan token secara manual. Token berlaku 10 menit.")
            ActionButton("Scan QR pairing", Icons.Default.Search, Modifier.fillMaxWidth()) {
                scanner.launch(
                    ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Arahkan ke QR pairing").setBeepEnabled(false).setOrientationLocked(false),
                )
            }
            OutlinedTextField(
                value = server,
                onValueChange = { server = it },
                label = { Text("Alamat server") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = token,
                onValueChange = { token = it },
                label = { Text("Token pairing") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            if (error != null) Hint(error!!, Palette.bad)
            Button(
                onClick = ::pair,
                enabled = !busy,
                shape = RoundedCornerShape(999.dp),
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            ) { Text(if (busy) "Menghubungkan…" else "Pasangkan") }
        }
    }
}
