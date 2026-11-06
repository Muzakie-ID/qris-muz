package id.muzakie.qrismuz.listener.capture

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class DetectedNotification(
    val packageName: String,
    val appLabel: String,
    val title: String?,
    val text: String?,
    val at: Long,
)

/**
 * Mode deteksi: selama aktif (maks 10 menit), semua notifikasi ditampilkan di layar beserta
 * nama package-nya, agar owner tahu package DANA Bisnis / GoPay Merchant. Tidak disimpan
 * ke database dan tidak dikirim ke server.
 */
object Detection {
    const val DURATION_MS = 10 * 60_000L
    private const val MAX_ITEMS = 50

    private val _until = MutableStateFlow(0L)
    val until: StateFlow<Long> = _until.asStateFlow()

    private val _items = MutableStateFlow<List<DetectedNotification>>(emptyList())
    val items: StateFlow<List<DetectedNotification>> = _items.asStateFlow()

    val active: Boolean get() = System.currentTimeMillis() < _until.value

    fun start() {
        _items.value = emptyList()
        _until.value = System.currentTimeMillis() + DURATION_MS
    }

    fun stop() {
        _until.value = 0
    }

    fun add(item: DetectedNotification) {
        if (!active) return
        _items.value = (listOf(item) + _items.value).take(MAX_ITEMS)
    }
}
