package id.muzakie.qrismuz.listener.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import id.muzakie.qrismuz.listener.Graph
import id.muzakie.qrismuz.listener.work.Work

/** Menyalakan listener lagi setelah HP dinyalakan ulang atau aplikasi diperbarui. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in ACTIONS) return
        if (!Graph.prefs.isPaired) return
        runCatching { KeepAliveService.start(context) }
        Work.scheduleWatchdog(context)
        Work.scheduleSend(context)
    }

    private companion object {
        val ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.intent.action.QUICKBOOT_POWERON",
        )
    }
}
