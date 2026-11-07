package id.muzakie.qrismuz.listener.capture

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import id.muzakie.qrismuz.listener.Graph
import id.muzakie.qrismuz.listener.data.db.EventEntity
import id.muzakie.qrismuz.listener.work.Work
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Penangkap notifikasi. Hanya notifikasi dari package yang diizinkan server yang disimpan
 * dan dikirim; sisanya diabaikan (kecuali ditampilkan sementara di mode deteksi).
 */
class CaptureService : NotificationListenerService() {

    override fun onListenerConnected() {
        instance = this
        _connected.value = true
        Log.i(TAG, "Listener tersambung")
        rescan()
    }

    override fun onListenerDisconnected() {
        instance = null
        _connected.value = false
        Log.w(TAG, "Listener terputus, minta sambung ulang")
        requestRebind(ComponentName(this, CaptureService::class.java))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        handle(sbn)
    }

    /** Pindai notifikasi yang masih tampil, mis. setelah tersambung ulang atau perintah "rescan". */
    fun rescan() {
        val active = runCatching { activeNotifications }.getOrNull() ?: return
        active.forEach { handle(it) }
    }

    private fun handle(sbn: StatusBarNotification) {
        if (sbn.packageName == packageName) return
        val n = sbn.notification ?: return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val extras = n.extras
        val captured = CapturedNotification(
            packageName = sbn.packageName,
            title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
            text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
            bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
            subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString(),
            postedAt = sbn.postTime,
            notificationKey = sbn.key,
        )
        if (!EventMapper.hasContent(captured)) return

        if (Detection.active) {
            Detection.add(
                DetectedNotification(captured.packageName, appLabel(this, captured.packageName), captured.title, captured.text, captured.postedAt),
            )
        }
        if (captured.packageName !in Graph.prefs.packages) return

        val entity = EventEntity(
            hash = EventMapper.hash(captured),
            packageName = captured.packageName,
            title = captured.title,
            text = captured.text,
            bigText = captured.bigText,
            subText = captured.subText,
            postedAt = captured.postedAt,
            notificationKey = captured.notificationKey,
            appVersion = appVersion(this, captured.packageName),
            capturedAt = System.currentTimeMillis(),
        )
        Graph.appScope.launch {
            // Simpan dulu, baru kirim: bila gagal kirim, event tetap di antrian.
            if (Graph.db.events().insert(entity) == -1L) return@launch
            Log.i(TAG, "Notifikasi baru dari ${entity.packageName}, mengirim")
            when (Graph.sender.flush()) {
                is id.muzakie.qrismuz.listener.data.EventSender.Result.Sent -> Unit
                else -> Work.scheduleSend(this@CaptureService)
            }
        }
    }

    companion object {
        private const val TAG = "CaptureService"

        @Volatile
        var instance: CaptureService? = null
            private set

        private val _connected = MutableStateFlow(false)
        val connected: StateFlow<Boolean> = _connected.asStateFlow()

        fun appLabel(context: Context, pkg: String): String = runCatching {
            val pm = context.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        }.getOrDefault(pkg)

        fun appVersion(context: Context, pkg: String): String? = runCatching {
            context.packageManager.getPackageInfo(pkg, 0).versionName
        }.getOrNull()

        fun isInstalled(context: Context, pkg: String): Boolean = runCatching {
            context.packageManager.getPackageInfo(pkg, 0); true
        }.getOrElse { e -> if (e is PackageManager.NameNotFoundException) false else false }
    }
}
