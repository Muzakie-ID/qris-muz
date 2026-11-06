package id.muzakie.qrismuz.listener.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import id.muzakie.qrismuz.listener.Graph
import id.muzakie.qrismuz.listener.data.EventSender
import id.muzakie.qrismuz.listener.service.KeepAliveService
import java.util.concurrent.TimeUnit

/** Kirim ulang antrian saat jaringan tersedia, dengan jeda bertahap bila gagal. */
class SendEventsWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = when (val r = Graph.sender.flush()) {
        is EventSender.Result.Sent, EventSender.Result.NotPaired -> Result.success()
        is EventSender.Result.Failed -> if (r.retryable) Result.retry() else Result.failure()
    }
}

/**
 * Penjaga tiap 15 menit: memastikan layanan latar depan hidup, mengirim sisa antrian,
 * dan membersihkan log lebih dari 7 hari.
 */
class WatchdogWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        if (!Graph.prefs.isPaired) return Result.success()
        runCatching { KeepAliveService.start(applicationContext) }
        Graph.db.events().pruneSent(System.currentTimeMillis() - 7 * 24 * 3600_000L)
        if (Graph.db.events().unsentCountNow() > 0) Work.scheduleSend(applicationContext)
        return Result.success()
    }
}

object Work {
    fun scheduleSend(context: Context) {
        val req = OneTimeWorkRequestBuilder<SendEventsWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("send-events", ExistingWorkPolicy.APPEND_OR_REPLACE, req)
    }

    fun scheduleWatchdog(context: Context) {
        val req = PeriodicWorkRequestBuilder<WatchdogWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("watchdog", ExistingPeriodicWorkPolicy.KEEP, req)
    }

    fun cancelAll(context: Context) {
        WorkManager.getInstance(context).cancelAllWork()
    }
}
