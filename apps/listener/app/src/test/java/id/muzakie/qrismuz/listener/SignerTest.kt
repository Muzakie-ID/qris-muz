package id.muzakie.qrismuz.listener

import id.muzakie.qrismuz.listener.net.Signer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SignerTest {
    @Test
    fun hmacMatchesRfc4231Case2() {
        assertEquals(
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
            Signer.hmacSha256Hex("Jefe", "what do ya want for nothing?"),
        )
    }

    @Test
    fun signatureCoversTimestampNonceAndBody() {
        val base = Signer.sign("s3cret", "1700000000000", "abcdefgh12", """{"a":1}""")
        assertEquals(Signer.hmacSha256Hex("s3cret", """1700000000000.abcdefgh12.{"a":1}"""), base)
        assertNotEquals(base, Signer.sign("s3cret", "1700000000001", "abcdefgh12", """{"a":1}"""))
        assertNotEquals(base, Signer.sign("s3cret", "1700000000000", "abcdefgh13", """{"a":1}"""))
        assertNotEquals(base, Signer.sign("s3cret", "1700000000000", "abcdefgh12", """{"a":2}"""))
    }

    @Test
    fun nonceFitsServerRules() {
        repeat(100) {
            val n = Signer.newNonce()
            assertTrue(n, Regex("^[A-Za-z0-9_-]{8,64}$").matches(n))
        }
        assertNotEquals(Signer.newNonce(), Signer.newNonce())
    }
}
