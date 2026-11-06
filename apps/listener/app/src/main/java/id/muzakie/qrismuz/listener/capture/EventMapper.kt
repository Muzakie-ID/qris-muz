package id.muzakie.qrismuz.listener.capture

import id.muzakie.qrismuz.listener.net.Signer

/** Isi notifikasi yang dibutuhkan server, tanpa ketergantungan Android agar mudah diuji. */
data class CapturedNotification(
    val packageName: String,
    val title: String?,
    val text: String?,
    val bigText: String?,
    val subText: String?,
    val postedAt: Long,
    val notificationKey: String?,
)

object EventMapper {
    private const val SEP = '\u001f'

    /**
     * Kunci dedup: notifikasi yang sama (ditangkap ulang saat rescan atau diperbarui Android)
     * menghasilkan hash yang sama; dua pembayaran berbeda punya key/waktu berbeda.
     */
    fun hash(n: CapturedNotification): String = Signer.sha256Hex(
        listOf(
            n.packageName,
            n.notificationKey.orEmpty(),
            n.postedAt.toString(),
            n.title.orEmpty(),
            n.text.orEmpty(),
            n.bigText.orEmpty(),
        ).joinToString(SEP.toString()),
    )

    /** Notifikasi tanpa teks sama sekali tidak berguna untuk parser. */
    fun hasContent(n: CapturedNotification): Boolean =
        listOf(n.title, n.text, n.bigText, n.subText).any { !it.isNullOrBlank() }
}

/** Isi QR pairing dari dashboard: qrismuz://pair?server=<url>&token=<token> */
data class PairingLink(val server: String, val token: String) {
    companion object {
        fun parse(raw: String): PairingLink? {
            val uri = runCatching { java.net.URI(raw.trim()) }.getOrNull() ?: return null
            if (uri.scheme != "qrismuz" || uri.host != "pair") return null
            val params = (uri.rawQuery ?: return null).split('&').mapNotNull { part ->
                val i = part.indexOf('=')
                if (i <= 0) null else part.substring(0, i) to java.net.URLDecoder.decode(part.substring(i + 1), "UTF-8")
            }.toMap()
            val server = params["server"]?.trimEnd('/') ?: return null
            val token = params["token"] ?: return null
            if (!server.startsWith("http://") && !server.startsWith("https://")) return null
            if (token.isBlank()) return null
            return PairingLink(server, token)
        }
    }
}
