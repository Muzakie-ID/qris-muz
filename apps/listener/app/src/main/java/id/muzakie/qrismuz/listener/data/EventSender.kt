package id.muzakie.qrismuz.listener.data

import id.muzakie.qrismuz.listener.data.db.EventDao
import id.muzakie.qrismuz.listener.data.db.EventEntity
import id.muzakie.qrismuz.listener.net.ApiClient
import id.muzakie.qrismuz.listener.net.ApiException
import id.muzakie.qrismuz.listener.net.DeviceCredentials
import id.muzakie.qrismuz.listener.net.EventDto
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException

/** Mengirim antrian notifikasi ke server. Satu pengiriman pada satu waktu. */
class EventSender(
    private val prefs: Prefs,
    private val dao: EventDao,
    private val api: ApiClient,
) {
    private val mutex = Mutex()

    sealed interface Result {
        data class Sent(val count: Int) : Result
        data object NotPaired : Result
        data class Failed(val message: String, val retryable: Boolean) : Result
    }

    fun credentials(): DeviceCredentials? {
        val url = prefs.serverUrl ?: return null
        val id = prefs.deviceId ?: return null
        val secret = prefs.secret ?: return null
        return DeviceCredentials(url, id, secret)
    }

    /** Mengirim semua yang belum terkirim, batch 50. Event baru dihapus dari antrian hanya bila server menerimanya. */
    suspend fun flush(): Result = mutex.withLock {
        val creds = credentials() ?: return Result.NotPaired
        var total = 0
        while (true) {
            val batch = dao.unsent(BATCH)
            if (batch.isEmpty()) break
            try {
                val res = api.sendEvents(creds, batch.map { it.toDto() })
                dao.markSent(res.accepted, System.currentTimeMillis())
                prefs.markServerOk()
                total += res.accepted.size
                if (res.accepted.isEmpty()) break
            } catch (e: ApiException) {
                dao.bumpAttempts(batch.map { it.id })
                prefs.markServerError(e.message ?: "HTTP ${e.status}")
                return Result.Failed(e.message ?: "HTTP ${e.status}", e.retryable)
            } catch (e: IOException) {
                dao.bumpAttempts(batch.map { it.id })
                prefs.markServerError("Tidak bisa menghubungi server: ${e.message}")
                return Result.Failed(e.message ?: "IO", true)
            }
            if (batch.size < BATCH) break
        }
        Result.Sent(total)
    }

    companion object {
        const val BATCH = 50

        fun EventEntity.toDto() = EventDto(
            packageName = packageName,
            title = title,
            text = text,
            bigText = bigText,
            subText = subText,
            postedAt = postedAt,
            notificationKey = notificationKey,
            appVersion = appVersion,
            capturedAt = capturedAt,
            hash = hash,
            isTest = isTest,
        )
    }
}
