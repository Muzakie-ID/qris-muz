package id.muzakie.qrismuz.listener.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import id.muzakie.qrismuz.listener.Graph
import id.muzakie.qrismuz.listener.capture.CaptureService
import id.muzakie.qrismuz.listener.data.EventSender
import id.muzakie.qrismuz.listener.data.db.EventEntity
import id.muzakie.qrismuz.listener.net.Signer
import id.muzakie.qrismuz.listener.system.DeviceInfo
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(onNavigate: (Screen) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    // Dinaikkan setiap kembali ke layar ini, agar status setelan HP dibaca ulang.
    var refresh by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { refresh++ }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(5_000); now = System.currentTimeMillis() } }

    val connected by CaptureService.connected.collectAsState()
    val server by Graph.prefs.server.collectAsState()
    val packages by Graph.prefs.packagesFlow.collectAsState()
    val queued by Graph.db.events().unsentCount().collectAsState(initial = 0)
    val recent by Graph.db.events().recent(0, 5).collectAsState(initial = emptyList())
    var testResult by remember { mutableStateOf<String?>(null) }

    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { refresh++ }

    Column(
        Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Header("qrismuz Listener", subtitle = Graph.prefs.deviceName ?: Graph.prefs.deviceId)

        // --- Status ---
        val access = remember(refresh) { DeviceInfo.hasNotificationAccess(context) }
        val canNotify = remember(refresh) { DeviceInfo.canPostNotifications(context) }
        val batteryFree = remember(refresh) { DeviceInfo.isIgnoringBatteryOptimizations(context) }
        val serverOk = server.lastOkAt > 0 && now - server.lastOkAt < 3 * 60_000 && server.lastError == null
        Panel {
            KeyValue("Listener") {
                when {
                    !access -> Pill("Belum diberi akses", Tone.Bad)
                    connected -> Pill("Aktif", Tone.Ok)
                    else -> Pill("Menyambung ulang", Tone.Warn)
                }
            }
            KeyValue("Server") {
                if (serverOk) Pill("Terhubung · ${ago(server.lastOkAt, now)}", Tone.Ok)
                else Pill(if (server.lastError != null) "Gagal" else "Menunggu", if (server.lastError != null) Tone.Bad else Tone.Neutral)
            }
            if (!serverOk && server.lastError != null) Hint(server.lastError!!, Palette.bad)
            KeyValue("Antrian belum terkirim") { Text("$queued", fontWeight = FontWeight.Medium) }
            KeyValue("Aplikasi dipantau") { Text("${packages.size}", fontWeight = FontWeight.Medium) }
            if (packages.isEmpty()) {
                Hint("Belum ada aplikasi yang dipantau. Pakai Mode deteksi untuk mencari nama package DANA Bisnis dan GoPay Merchant, lalu daftarkan di dashboard.", Palette.warn)
            }
        }

        // --- Daftar cek pemasangan ---
        SectionTitle("Daftar cek pemasangan")
        Panel {
            CheckRow("Akses notifikasi", access, "Buka") { DeviceInfo.openNotificationAccess(context) }
            if (Build.VERSION.SDK_INT >= 33) {
                CheckRow("Izin menampilkan notifikasi", canNotify, "Izinkan") {
                    notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
            CheckRow("Penghemat baterai: tanpa batasan", batteryFree, "Atur") {
                DeviceInfo.requestIgnoreBatteryOptimizations(context)
            }
            ManualCheckRow(
                key = "autostart",
                label = if (DeviceInfo.isXiaomi) "Mulai otomatis (MIUI) aktif" else "Izin berjalan otomatis aktif",
                actionLabel = "Buka",
                onAction = { DeviceInfo.openAutostart(context) },
            )
            ManualCheckRow(key = "recents_lock", label = "Dikunci di daftar aplikasi terbaru (ikon gembok)")
            ManualCheckRow(key = "auto_update_off", label = "Update otomatis DANA Bisnis dan GoPay Merchant dimatikan")
            packages.sorted().forEach { pkg ->
                val installed = CaptureService.isInstalled(context, pkg)
                val version = CaptureService.appVersion(context, pkg)
                CheckRow(
                    "${CaptureService.appLabel(context, pkg)}${version?.let { " · v$it" } ?: ""}",
                    installed,
                    if (installed) null else "Info",
                ) { DeviceInfo.openAppDetails(context, pkg) }
            }
        }

        // --- Aksi ---
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            ActionButton("Mode deteksi", Icons.Default.Search, Modifier.weight(1f)) { onNavigate(Screen.Detect) }
            ActionButton("Log", Icons.Default.List, Modifier.weight(1f)) { onNavigate(Screen.Log) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            ActionButton("Kirim uji", Icons.Default.Send, Modifier.weight(1f)) {
                testResult = "Mengirim…"
                scope.launch { testResult = sendTestEvent() }
            }
            ActionButton("Pengaturan", Icons.Default.Settings, Modifier.weight(1f)) { onNavigate(Screen.Settings) }
        }
        if (testResult != null) Hint(testResult!!)

        // --- Terakhir ---
        SectionTitle("Notifikasi terakhir")
        Panel {
            if (recent.isEmpty()) Hint("Belum ada notifikasi pembayaran yang tertangkap.")
            recent.forEachIndexed { i, e ->
                if (i > 0) HorizontalDivider(color = Palette.line)
                EventRow(e)
            }
        }
    }
}

private suspend fun sendTestEvent(): String {
    val now = System.currentTimeMillis()
    Graph.db.events().insert(
        EventEntity(
            hash = Signer.sha256Hex("test-$now-${Signer.newNonce()}"),
            packageName = Graph.prefs.packages.firstOrNull() ?: "qrismuz.test",
            title = "Uji listener",
            text = "Notifikasi uji dari HP listener",
            bigText = null,
            subText = null,
            postedAt = now,
            notificationKey = "test-$now",
            appVersion = null,
            capturedAt = now,
            isTest = true,
        ),
    )
    return when (val r = Graph.sender.flush()) {
        is EventSender.Result.Sent -> "Notifikasi uji diterima server."
        EventSender.Result.NotPaired -> "HP belum dipasangkan."
        is EventSender.Result.Failed -> "Gagal: ${r.message}. Akan dicoba lagi otomatis."
    }
}

@Composable
private fun CheckRow(label: String, done: Boolean, actionLabel: String?, onAction: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Icon(
            if (done) Icons.Default.CheckCircle else Icons.Default.Warning,
            contentDescription = if (done) "Sudah" else "Belum",
            tint = if (done) Palette.ok else Palette.warn,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(10.dp))
        Text(label, modifier = Modifier.weight(1f), fontSize = 14.sp)
        if (!done && actionLabel != null) TextButton(onClick = onAction) { Text(actionLabel) }
    }
}

/** Setelan yang tidak bisa dicek aplikasi: owner mencentangnya sendiri. */
@Composable
private fun ManualCheckRow(key: String, label: String, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    var done by remember { mutableStateOf(Graph.prefs.manualCheck(key)) }
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Icon(
            if (done) Icons.Default.CheckCircle else Icons.Default.Warning,
            contentDescription = if (done) "Sudah" else "Belum",
            tint = if (done) Palette.ok else Palette.warn,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(10.dp))
        Text(label, modifier = Modifier.weight(1f), fontSize = 14.sp)
        if (!done && actionLabel != null && onAction != null) TextButton(onClick = onAction) { Text(actionLabel) }
        TextButton(onClick = { done = !done; Graph.prefs.setManualCheck(key, done) }) { Text(if (done) "Batal" else "Sudah") }
    }
}

@Composable
fun EventRow(e: EventEntity) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(vertical = 2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(e.title ?: e.packageName, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            when {
                e.isTest -> Pill("Uji", Tone.Neutral)
                e.sentAt != null -> Pill("Terkirim", Tone.Ok)
                else -> Pill("Menunggu", Tone.Warn)
            }
        }
        if (!e.text.isNullOrBlank()) Text(e.text, fontSize = 14.sp)
        Text("${formatTime(e.postedAt)} · ${e.packageName}", color = Palette.faint, fontSize = 12.sp)
    }
}
