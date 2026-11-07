package id.muzakie.qrismuz.listener.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Kegagalan dari server (HTTP bukan 2xx). [retryable] = layak dicoba lagi nanti. */
class ApiException(val status: Int, message: String) : IOException(message) {
    val retryable: Boolean get() = status >= 500 || status == 429 || status == 401
}

data class DeviceCredentials(val serverUrl: String, val deviceId: String, val secret: String)

/**
 * Klien HTTP ke backend. Semua request device ditandatangani HMAC atas body mentah
 * yang benar-benar dikirim, jadi body dibentuk dulu sebagai teks lalu ditandatangani.
 */
class ApiClient(
    private val http: OkHttpClient = defaultHttp(),
    private val clock: () -> Long = System::currentTimeMillis,
) {
    val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }
    private val jsonType = "application/json".toMediaType()

    suspend fun register(serverUrl: String, token: String): RegisterResponse {
        val body = json.encodeToString(RegisterRequest.serializer(), RegisterRequest(token))
        val text = execute(Request.Builder().url("$serverUrl/device/register").post(body.toRequestBody(jsonType)).build())
        return json.decodeFromString(RegisterResponse.serializer(), text)
    }

    suspend fun sendEvents(c: DeviceCredentials, events: List<EventDto>): EventsResponse {
        val body = json.encodeToString(EventsRequest.serializer(), EventsRequest(events))
        return json.decodeFromString(EventsResponse.serializer(), signed(c, "POST", "/device/events", body))
    }

    suspend fun heartbeat(c: DeviceCredentials, req: HeartbeatRequest): HeartbeatResponse {
        val body = json.encodeToString(HeartbeatRequest.serializer(), req)
        return json.decodeFromString(HeartbeatResponse.serializer(), signed(c, "POST", "/device/heartbeat", body))
    }

    suspend fun config(c: DeviceCredentials): ConfigResponse =
        json.decodeFromString(ConfigResponse.serializer(), signed(c, "GET", "/device/config", null))

    private suspend fun signed(c: DeviceCredentials, method: String, path: String, body: String?): String {
        val timestamp = clock().toString()
        val nonce = Signer.newNonce()
        val signature = Signer.sign(c.secret, timestamp, nonce, body.orEmpty())
        val builder = Request.Builder()
            .url(c.serverUrl + path)
            .header("X-Device-Id", c.deviceId)
            .header("X-Timestamp", timestamp)
            .header("X-Nonce", nonce)
            .header("X-Signature", signature)
        if (method == "POST") builder.post((body ?: "").toRequestBody(jsonType)) else builder.get()
        return execute(builder.build())
    }

    private suspend fun execute(request: Request): String = withContext(Dispatchers.IO) {
        http.newCall(request).execute().use { res ->
            val text = res.body?.string().orEmpty()
            if (!res.isSuccessful) throw ApiException(res.code, errorMessage(res.code, text))
            text
        }
    }

    /** Pesan error dari NestJS: { message: "..." } atau { message: ["...", "..."] }. */
    private fun errorMessage(code: Int, body: String): String {
        val msg = runCatching { json.decodeFromString(ErrorResponse.serializer(), body).message }.getOrNull()
        val text = when (msg) {
            is JsonPrimitive -> msg.content
            is JsonArray -> msg.joinToString("; ") { (it as? JsonPrimitive)?.content ?: it.toString() }
            else -> null
        }
        return "HTTP $code" + (text?.let { ": $it" } ?: "")
    }

    companion object {
        fun defaultHttp(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }
}
