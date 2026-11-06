package id.muzakie.qrismuz.listener

import id.muzakie.qrismuz.listener.net.ApiClient
import id.muzakie.qrismuz.listener.net.DeviceCredentials
import id.muzakie.qrismuz.listener.net.EventDto
import id.muzakie.qrismuz.listener.net.HeartbeatRequest
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

/**
 * Uji terhadap backend sungguhan. Dilewati kecuali env berikut disetel:
 *   QRISMUZ_SERVER   alamat API, mis. http://localhost:3001
 *   QRISMUZ_TOKEN    token pairing baru dari /admin/devices/pairing-tokens
 *   QRISMUZ_PACKAGE  package QRIS yang terdaftar
 *   QRISMUZ_TX       ID transaksi PENDING, QRISMUZ_AMOUNT nominal akhirnya
 */
class LiveServerTest {
    private fun env(name: String): String = requireNotNull(System.getenv(name)) { "$name belum disetel" }

    @Test
    fun fullFlowAgainstRealBackend() = runTest {
        assumeTrue("QRISMUZ_SERVER tidak disetel", System.getenv("QRISMUZ_SERVER") != null)
        val server = env("QRISMUZ_SERVER")
        val api = ApiClient()

        val reg = api.register(server, env("QRISMUZ_TOKEN"))
        val creds = DeviceCredentials(server, reg.deviceId, reg.secret)

        val config = api.config(creds)
        assertTrue(config.packages.contains(env("QRISMUZ_PACKAGE")))

        val hb = api.heartbeat(creds, HeartbeatRequest(listenerOk = true, battery = 88, charging = true, queued = 0, appVersion = "test"))
        assertEquals(emptyList<String>(), hb.commands)

        val amount = env("QRISMUZ_AMOUNT").toLong()
        val text = "Rp" + "%,d".format(amount).replace(',', '.') + " diterima DANA Bisnis."
        val event = EventDto(
            packageName = env("QRISMUZ_PACKAGE"),
            title = "Pembayaran Masuk",
            text = text,
            postedAt = System.currentTimeMillis(),
            notificationKey = "live-test",
            capturedAt = System.currentTimeMillis(),
            hash = "live-hash",
        )
        assertEquals(listOf("live-hash"), api.sendEvents(creds, listOf(event)).accepted)

        val checkout = OkHttpClient().newCall(Request.Builder().url("$server/public/checkout/${env("QRISMUZ_TX")}").build())
            .execute().use { it.body!!.string() }
        assertTrue(checkout, checkout.contains("\"status\":\"PAID\""))
    }
}
