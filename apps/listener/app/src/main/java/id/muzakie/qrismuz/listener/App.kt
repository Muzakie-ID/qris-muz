package id.muzakie.qrismuz.listener

import android.app.Application
import android.util.Log
import id.muzakie.qrismuz.listener.service.KeepAliveService
import id.muzakie.qrismuz.listener.work.Work

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Graph.init(this)
        installCrashReporter()
        KeepAliveService.createChannel(this)
        if (Graph.prefs.isPaired) {
            Work.scheduleWatchdog(this)
            runCatching { KeepAliveService.start(this) }
        }
    }

    /** Simpan stack trace crash; dikirim bersama heartbeat berikutnya. */
    private fun installCrashReporter() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, e ->
            runCatching {
                Graph.prefs.lastCrash = Log.getStackTraceString(e).take(4000)
            }
            previous?.uncaughtException(thread, e)
        }
    }
}
