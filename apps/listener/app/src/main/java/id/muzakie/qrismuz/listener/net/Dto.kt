package id.muzakie.qrismuz.listener.net

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class RegisterRequest(val token: String)

@Serializable
data class RegisterResponse(
    @SerialName("device_id") val deviceId: String,
    val secret: String,
    val name: String,
    @SerialName("server_time") val serverTime: Long,
)

@Serializable
data class EventDto(
    @SerialName("package") val packageName: String,
    val title: String? = null,
    val text: String? = null,
    @SerialName("big_text") val bigText: String? = null,
    @SerialName("sub_text") val subText: String? = null,
    @SerialName("posted_at") val postedAt: Long,
    @SerialName("notification_key") val notificationKey: String? = null,
    @SerialName("app_version") val appVersion: String? = null,
    @SerialName("captured_at") val capturedAt: Long? = null,
    val hash: String,
    @SerialName("is_test") val isTest: Boolean = false,
)

@Serializable
data class EventsRequest(val events: List<EventDto>)

@Serializable
data class EventsResponse(val accepted: List<String>, val duplicates: Int = 0)

@Serializable
data class HeartbeatRequest(
    @SerialName("listener_ok") val listenerOk: Boolean,
    val battery: Int? = null,
    val charging: Boolean? = null,
    val queued: Int? = null,
    @SerialName("source_app_versions") val sourceAppVersions: Map<String, String>? = null,
    @SerialName("app_version") val appVersion: String? = null,
    @SerialName("last_crash") val lastCrash: String? = null,
)

@Serializable
data class HeartbeatResponse(
    @SerialName("server_time") val serverTime: Long,
    @SerialName("next_heartbeat_sec") val nextHeartbeatSec: Int = 60,
    val commands: List<String> = emptyList(),
)

@Serializable
data class ConfigResponse(
    val packages: List<String>,
    @SerialName("heartbeat_interval_sec") val heartbeatIntervalSec: Int = 60,
    @SerialName("server_time") val serverTime: Long,
)

@Serializable
data class ErrorResponse(val message: kotlinx.serialization.json.JsonElement? = null)
