import type { Metadata } from "next";
import { A, C, Callout, DocTitle, H2, P, Steps, Table, Ul } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Alur pembayaran & status · Dokumentasi" };

export default function DocsPembayaran() {
  return (
    <>
      <DocTitle
        title="Alur pembayaran & status"
        lead="Apa yang dilihat pembeli, bagaimana status tagihan berubah, dan apa yang perlu dilakukan saat pembayaran tidak berjalan mulus."
      />

      <H2>Halaman bayar</H2>
      <P>
        <C>checkout_url</C> membuka halaman bayar yang ringan untuk HP: QR, nominal dengan 3 digit terakhir disorot, dan hitung
        mundur. Status diperbarui realtime; begitu lunas, halaman menampilkan &ldquo;Pembayaran diterima&rdquo; dan dalam 3 detik
        mengarahkan pembeli ke <C>return_url</C>. Setelah tagihan kedaluwarsa, QR disembunyikan.
      </P>

      <H2>Status tagihan</H2>
      <Table
        head={["Status", "Arti", "Webhook"]}
        rows={[
          [<C key="c">PENDING</C>, "Menunggu pembayaran.", "–"],
          [<C key="c">PAID</C>, "Lunas: otomatis dari notifikasi, atau ditandai lunas manual oleh owner.", <C key="c">transaction.paid</C>],
          [<C key="c">EXPIRED</C>, "Lewat batas waktu tanpa pembayaran.", <C key="c">transaction.expired</C>],
          [<C key="c">CANCELLED</C>, "Dibatalkan proyek lewat API.", "–"],
          [<C key="c">LATE_PAID</C>, "Uang masuk setelah EXPIRED atau CANCELLED. Keputusan di tangan proyek/owner.", <C key="c">transaction.late_paid</C>],
        ]}
      />
      <P>
        Alurnya: <C>PENDING</C> → <C>PAID</C>, atau <C>PENDING</C> → <C>EXPIRED</C>/<C>CANCELLED</C> → (bila tetap dibayar){" "}
        <C>LATE_PAID</C>. Status <C>PAID</C> dan <C>LATE_PAID</C> tidak berubah lagi.
      </P>

      <H2>Pembayaran yang perlu ditangani manual</H2>
      <Table
        head={["Kejadian", "Tanda di dashboard", "Yang dilakukan"]}
        rows={[
          [
            "Pembeli membayar nominal berbeda (mis. Rp50.000, bukan Rp50.087)",
            <>Mutasi masuk: <strong>Tidak cocok</strong> + alarm Telegram</>,
            <>Cari tagihannya di <A href="/transaksi">Transaksi</A>, tekan <strong>Tandai lunas</strong>, isi alasan (mis. &ldquo;bayar Rp50.000 via DANA 10.05&rdquo;).</>,
          ],
          [
            "Pembeli membayar setelah kedaluwarsa",
            <>Status <strong>Bayar telat</strong> + webhook <C key="c">transaction.late_paid</C></>,
            "Proyek memutuskan: proses pesanan, atau hubungi pembeli untuk refund.",
          ],
          [
            "Notifikasi tidak terbaca (format DANA/GoPay berubah)",
            <>Mutasi masuk: <strong>Tak terbaca</strong> + alarm</>,
            <>Perbaiki pola di <A href="/docs/parser">Parser</A>, lalu Proses ulang. Pembayaran yang cocok langsung lunas.</>,
          ],
          [
            "HP listener offline saat pembayaran",
            "Perangkat: Offline + alarm",
            "Nyalakan HP / internet. Notifikasi yang tertangkap terkirim otomatis.",
          ],
        ]}
      />
      <Callout tone="warn" title="Sebelum menandai lunas manual">
        Pastikan uangnya benar-benar masuk di aplikasi DANA Bisnis/GoPay Merchant. Tandai lunas mengirim webhook{" "}
        <C>transaction.paid</C> ke proyek dan tercatat di audit log beserta alasannya.
      </Callout>

      <H2>Uji coba pembayaran</H2>
      <Steps
        items={[
          { title: "Tekan Buat transaksi uji", body: <P>Ada di kanan atas Beranda/Transaksi. Membuat tagihan sungguhan Rp1.000 + kode unik di proyek pertama, lalu membuka halaman bayarnya.</P> },
          { title: "Bayar dari HP lain", body: <P>Pindai QR dengan e-wallet atau m-banking dan bayar nominal yang tertera.</P> },
          { title: "Lihat hasilnya", body: <P>Halaman bayar berubah menjadi &ldquo;Pembayaran diterima&rdquo; dalam beberapa detik. Notifikasinya tampil di <A href="/mutasi">Mutasi masuk</A> sebagai <strong>Cocok</strong>.</P> },
        ]}
      />
      <Ul>
        <li>Bila tidak berubah: cek <A href="/perangkat">Perangkat</A> (online?), lalu <A href="/mutasi">Mutasi masuk</A> (notifikasinya masuk? terbaca?).</li>
        <li>Notifikasi berstatus <strong>Diabaikan</strong> berarti package QRIS belum diisi atau salah.</li>
      </Ul>
    </>
  );
}
