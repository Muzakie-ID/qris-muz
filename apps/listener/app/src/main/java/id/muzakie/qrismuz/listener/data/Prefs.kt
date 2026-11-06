package id.muzakie.qrismuz.listener.data

import android.content.Context
import id.muzakie.qrismuz.listener.net.Signer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Status koneksi terakhir ke server, ditampilkan di layar utama. */
data class ServerStatus(
    val lastOkAt: Long = 0,
    val lastError: String? = null,
    val lastErrorAt: Long = 0,
)

/** Pengaturan dan identitas device, disimpan di SharedPreferences. Secret disimpan terenkripsi. */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("listener", Context.MODE_PRIVATE)

    private val _server = MutableStateFlow(ServerStatus(sp.getLong("last_ok_at", 0), sp.getString("last_error", null), sp.getLong("last_error_at", 0)))
    val server: StateFlow<ServerStatus> = _server.asStateFlow()

    private val _packages = MutableStateFlow(packages)
    val packagesFlow: StateFlow<Set<String>> = _packages.asStateFlow()

    var serverUrl: String?
        get() = sp.getString("server_url", null)
        set(v) = sp.edit().putString("server_url", v).apply()

    var deviceId: String?
        get() = sp.getString("device_id", null)
        set(v) = sp.edit().putString("device_id", v).apply()

    var deviceName: String?
        get() = sp.getString("device_name", null)
        set(v) = sp.edit().putString("device_name", v).apply()

    var secret: String?
        get() = sp.getString("secret_sealed", null)?.let { SecretBox.open(it) }
        set(v) {
            sp.edit().putString("secret_sealed", v?.let { SecretBox.seal(it) }).apply()
        }

    val isPaired: Boolean get() = serverUrl != null && deviceId != null && sp.contains("secret_sealed")

    /** Package aplikasi merchant yang notifikasinya dikirim (dari /device/config). */
    var packages: Set<String>
        get() = sp.getStringSet("packages", emptySet())!!.toSet()
        set(v) {
            sp.edit().putStringSet("packages", v).apply()
            _packages.value = v
        }

    /** Centang manual untuk setelan MIUI yang tidak bisa dicek dari aplikasi. */
    fun manualCheck(key: String): Boolean = sp.getBoolean("check_$key", false)
    fun setManualCheck(key: String, done: Boolean) = sp.edit().putBoolean("check_$key", done).apply()

    var lastCrash: String?
        get() = sp.getString("last_crash", null)
        set(v) = sp.edit().putString("last_crash", v).apply()

    // --- PIN ---
    val hasPin: Boolean get() = sp.contains("pin_hash")

    fun setPin(pin: String?) {
        if (pin == null) {
            sp.edit().remove("pin_hash").remove("pin_salt").apply()
            return
        }
        val salt = Signer.newNonce()
        sp.edit().putString("pin_salt", salt).putString("pin_hash", Signer.sha256Hex("$salt:$pin")).apply()
    }

    fun checkPin(pin: String): Boolean {
        val salt = sp.getString("pin_salt", null) ?: return true
        return sp.getString("pin_hash", null) == Signer.sha256Hex("$salt:$pin")
    }

    fun markServerOk() {
        val now = System.currentTimeMillis()
        sp.edit().putLong("last_ok_at", now).remove("last_error").apply()
        _server.value = ServerStatus(lastOkAt = now)
    }

    fun markServerError(message: String) {
        val now = System.currentTimeMillis()
        sp.edit().putString("last_error", message).putLong("last_error_at", now).apply()
        _server.value = _server.value.copy(lastError = message, lastErrorAt = now)
    }

    /** Menghapus pairing: device harus dipasangkan ulang dari dashboard. */
    fun unpair() {
        sp.edit().remove("server_url").remove("device_id").remove("device_name").remove("secret_sealed").remove("packages").apply()
        _packages.value = emptySet()
        SecretBox.deleteKey()
    }
}
