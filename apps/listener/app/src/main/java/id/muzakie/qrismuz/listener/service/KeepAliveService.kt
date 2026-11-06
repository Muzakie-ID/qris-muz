package id.muzakie.qrismuz.listener.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.service.notification.NotificationListenerService
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import id.muzakie.qrismuz.listener.BuildConfig
import id.muzakie.qrismuz.listener.Graph
import id.muzakie.qrismuz.listener.R
import id.muzakie.qrismuz.listener.capture.CaptureService
import id.muzakie.qrismuz.listener.net.ApiException
import id.muzakie.qrismuz.listener.net.HeartbeatRequest
import id.muzakie.qrismuz.listener.system.DeviceInfo
import id.muzakie.qrismuz.listener.ui.MainActivity
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.IOException

/**
 * Layanan latar depan yang menjaga proses tetap hidup di MIUI, mengirim heartbeat tiap
 * 60 detik, memperbarui daftar package, dan menjalankan perintah dari dashboard.
 */
class KeepAliveService : LifecycleService() {
    private var loop: Job? = null

    override fun onCreate() {
        super.onCreate()
        createChannel(this)
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(), type)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        if (loop?.isActive != true) loop = lifecycleScope.launch { runLoop() }
        return START_STICKY
    }

    private suspend fun runLoop() {
        var lastConfigAt = 0L
        var intervalSec = 60
        while (lifecycleScope.isActive) {
            if (!Graph.prefs.isPaired) {
                delay(30_000)
                continue
            }
            ensureListenerBound()
            val now = System.currentTimeMillis()
            if (now - lastConfigAt > CONFIG_EVERY_MS) {
                if (refreshConfig()) lastConfigAt = now
            }
            intervalSec = heartbeat() ?: intervalSec
            if (Graph.db.events().unsentCountNow() > 0) Graph.sender.flush()
            delay(intervalSec.coerceIn(15, 300) * 1000L)
        }
    }

    /** Kirim heartbeat; mengembalikan jeda berikutnya, atau null bila gagal. */
    private suspend fun heartbeat(): Int? {
        val creds = Graph.sender.credentials() ?: return null
        val battery = DeviceInfo.battery(this)
        val versions = Graph.prefs.packages.mapNotNull { pkg ->
            CaptureService.appVersion(this, pkg)?.let { pkg to it }
        }.toMap()
        val crash = Graph.prefs.lastCrash
        val req = HeartbeatRequest(
            listenerOk = DeviceInfo.hasNotificationAccess(this) && CaptureService.connected.value,
            battery = battery.percent,
            charging = battery.charging,
            queued = Graph.db.events().unsentCountNow(),
            sourceAppVersions = versions,
            appVersion = BuildConfig.VERSION_NAME,
            lastCrash = crash,
        )
        return try {
            val res = Graph.api.heartbeat(creds, req)
            Graph.prefs.markServerOk()
            if (crash != null) Graph.prefs.lastCrash = null
            res.commands.forEach { handleCommand(it) }
            res.nextHeartbeatSec
        } catch (e: ApiException) {
            Graph.prefs.markServerError(e.message ?: "HTTP ${e.status}")
            null
        } catch (e: IOException) {
            Graph.prefs.markServerError("Tidak bisa menghubungi server: ${e.message}")
            null
        }
    }

    private suspend fun refreshConfig(): Boolean {
        val creds = Graph.sender.credentials() ?: return false
        return try {
            Graph.prefs.packages = Graph.api.config(creds).packages.toSet()
            true
        } catch (e: IOException) {
            Log.w(TAG, "Gagal memuat config: ${e.message}")
            false
        }
    }

    private suspend fun handleCommand(command: String) {
        Log.i(TAG, "Perintah dari server: $command")
        when (command) {
            "rescan" -> CaptureService.instance?.rescan()
            "refresh_config" -> refreshConfig()
            "flush_queue" -> Graph.sender.flush()
        }
    }

    /** Bila Android memutus listener (sering di MIUI), minta disambungkan lagi. */
    private fun ensureListenerBound() {
        if (DeviceInfo.hasNotificationAccess(this) && !CaptureService.connected.value) {
            NotificationListenerService.requestRebind(ComponentName(this, CaptureService::class.java))
        }
    }

    private fun buildNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_listener)
        .setContentTitle(getString(R.string.fgs_title))
        .setContentText(getString(R.string.fgs_text))
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setContentIntent(
            PendingIntent.getActivity(
                this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        .build()

    companion object {
        private const val TAG = "KeepAliveService"
        private const val CHANNEL_ID = "status"
        private const val NOTIF_ID = 1
        private const val CONFIG_EVERY_MS = 10 * 60_000L

        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, KeepAliveService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, KeepAliveService::class.java))
        }

        fun createChannel(context: Context) {
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, context.getString(R.string.channel_status), NotificationManager.IMPORTANCE_LOW),
            )
        }
    }
}
