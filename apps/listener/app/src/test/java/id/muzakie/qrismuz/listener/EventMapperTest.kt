package id.muzakie.qrismuz.listener

import id.muzakie.qrismuz.listener.capture.CapturedNotification
import id.muzakie.qrismuz.listener.capture.EventMapper
import id.muzakie.qrismuz.listener.capture.PairingLink
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EventMapperTest {
    private val dana = CapturedNotification(
        packageName = "id.dana.bisnis",
        title = "Pembayaran Masuk",
        text = "Rp200.000 diterima DANA Bisnis.",
        bigText = null,
        subText = null,
        postedAt = 1_700_000_000_000,
        notificationKey = "0|id.dana.bisnis|1|null|10001",
    )

    @Test
    fun sameNotificationSameHash() {
        assertEquals(EventMapper.hash(dana), EventMapper.hash(dana.copy()))
    }

    @Test
    fun twoPaymentsWithSameTextGetDifferentHashes() {
        val second = dana.copy(notificationKey = "0|id.dana.bisnis|2|null|10001", postedAt = dana.postedAt + 4000)
        assertNotEquals(EventMapper.hash(dana), EventMapper.hash(second))
    }

    @Test
    fun hashIsSha256Hex() {
        assertTrue(Regex("^[0-9a-f]{64}$").matches(EventMapper.hash(dana)))
    }

    @Test
    fun emptyNotificationsAreSkipped() {
        assertTrue(EventMapper.hasContent(dana))
        assertFalse(EventMapper.hasContent(dana.copy(title = null, text = " ", bigText = null, subText = null)))
    }
}

class PairingLinkTest {
    @Test
    fun parsesDashboardLink() {
        val link = PairingLink.parse("qrismuz://pair?server=https%3A%2F%2Fapi.contoh.id%2F&token=pair_abc-123")
        assertEquals(PairingLink("https://api.contoh.id", "pair_abc-123"), link)
    }

    @Test
    fun rejectsOtherLinks() {
        assertNull(PairingLink.parse("https://contoh.id/pair?server=x&token=y"))
        assertNull(PairingLink.parse("qrismuz://pair?token=pair_abc"))
        assertNull(PairingLink.parse("qrismuz://pair?server=ftp%3A%2F%2Fx&token=t"))
        assertNull(PairingLink.parse("qrismuz://pair?server=https%3A%2F%2Fx&token="))
        assertNull(PairingLink.parse("bukan link"))
    }
}
