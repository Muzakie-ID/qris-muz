package id.muzakie.qrismuz.listener

import id.muzakie.qrismuz.listener.net.ApiClient
import id.muzakie.qrismuz.listener.net.ApiException
import id.muzakie.qrismuz.listener.net.DeviceCredentials
import id.muzakie.qrismuz.listener.net.EventDto
import id.muzakie.qrismuz.listener.net.HeartbeatRequest
import id.muzakie.qrismuz.listener.net.Signer
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class ApiClientTest {
    private lateinit var server: MockWebServer
    private val api = ApiClient(clock = { 1_700_000_000_123 })
    private lateinit var creds: DeviceCredentials

    @Before
    fun setUp() {
        server = MockWebServer().apply { start() }
        creds = DeviceCredentials(server.url("/").toString().trimEnd('/'), "dev_123", "rahasia")
    }

    @After
    fun tearDown() = server.shutdown()

    @Test
    fun eventsAreSignedOverTheExactBody() = runTest {
        server.enqueue(MockResponse().setBody("""{"accepted":["h1"],"duplicates":0}"""))
        val res = api.sendEvents(
            creds,
            listOf(EventDto(packageName = "id.dana.bisnis", title = "Pembayaran Masuk", text = "Rp1 diterima", postedAt = 1, hash = "h1")),
        )
        assertEquals(listOf("h1"), res.accepted)

        val req = server.takeRequest()
        val body = req.body.readUtf8()
        assertEquals("/device/events", req.path)
        assertEquals("dev_123", req.getHeader("X-Device-Id"))
        assertEquals("1700000000123", req.getHeader("X-Timestamp"))
        val nonce = req.getHeader("X-Nonce")!!
        assertEquals(Signer.sign("rahasia", "1700000000123", nonce, body), req.getHeader("X-Signature"))
        // Nama field sesuai DTO server; null tidak dikirim.
        assertTrue(body, body.contains("\"package\":\"id.dana.bisnis\"") && body.contains("\"posted_at\":1"))
        assertFalse(body, body.contains("big_text"))
    }

    @Test
    fun getRequestsSignAnEmptyBody() = runTest {
        server.enqueue(MockResponse().setBody("""{"packages":["a","b"],"heartbeat_interval_sec":60,"server_time":1}"""))
        assertEquals(listOf("a", "b"), api.config(creds).packages)
        val req = server.takeRequest()
        assertEquals("GET", req.method)
        assertEquals(Signer.sign("rahasia", "1700000000123", req.getHeader("X-Nonce")!!, ""), req.getHeader("X-Signature"))
    }

    @Test
    fun heartbeatReturnsCommands() = runTest {
        server.enqueue(MockResponse().setBody("""{"server_time":1,"next_heartbeat_sec":60,"commands":["rescan"],"extra":"diabaikan"}"""))
        val res = api.heartbeat(creds, HeartbeatRequest(listenerOk = true, battery = 90))
        assertEquals(listOf("rescan"), res.commands)
        assertTrue(server.takeRequest().body.readUtf8().contains("\"listener_ok\":true"))
    }

    @Test
    fun serverErrorsCarryTheMessage() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"message":"Tanda tangan tidak valid.","statusCode":401}"""))
        try {
            api.config(creds)
            fail("seharusnya gagal")
        } catch (e: ApiException) {
            assertEquals(401, e.status)
            assertEquals("HTTP 401: Tanda tangan tidak valid.", e.message)
        }
    }

    @Test
    fun registerSendsToken() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody("""{"device_id":"dev_9","secret":"s","name":"Redmi","server_time":1}"""))
        val res = api.register(creds.serverUrl, "pair_x")
        assertEquals("dev_9", res.deviceId)
        val req = server.takeRequest()
        assertEquals("/device/register", req.path)
        assertEquals("""{"token":"pair_x"}""", req.body.readUtf8())
    }
}
