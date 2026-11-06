package id.muzakie.qrismuz.listener.net

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Tanda tangan request ke server, sama persis dengan DeviceSignatureGuard di backend:
 * X-Signature = hex(HMAC-SHA256(secret, "$timestamp.$nonce.$body"))
 */
object Signer {
    private val random = SecureRandom()

    fun hmacSha256Hex(secret: String, message: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return mac.doFinal(message.toByteArray(Charsets.UTF_8)).toHex()
    }

    fun sign(secret: String, timestamp: String, nonce: String, body: String): String =
        hmacSha256Hex(secret, "$timestamp.$nonce.$body")

    /** 16 byte acak, base64url tanpa padding (22 karakter, cocok dengan aturan server). */
    fun newNonce(): String {
        val bytes = ByteArray(16).also { random.nextBytes(it) }
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun sha256Hex(input: String): String =
        MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8)).toHex()

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
}
