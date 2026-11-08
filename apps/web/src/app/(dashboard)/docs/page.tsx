import type { Metadata } from "next";
import { A, C, Callout, DocTitle, H2, P, Steps, Table, Ul } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Dokumentasi" };

export default function DocsHome() {
  return (
    <>
      <DocTitle
        title="Cara kerja & mulai cepat"
        lead="qrismuz mengubah QRIS statis milik Anda menjadi QR dinamis dengan nominal unik untuk setiap tagihan, lalu mengonfirmasi pembayaran otomatis dari notifikasi DANA Bisnis dan GoPay Merchant di HP listener."
      />

      <H2>Cara kerja dalam satu tagihan</H2>
      <Steps
        items={[
          {
            title: "Proyek membuat tagihan lewat API",
            body: (
              <P>
                Misalnya toko Anda memanggil <C>POST /v1/transactions</C> dengan nominal Rp50.000. qrismuz menambah kode unik
                1–999, misalnya menjadi <strong>Rp50.087</strong>, dan membuat QR dinamis berisi nominal itu.
              </P>
            ),
          },
          {
            title: "Pembeli membayar di halaman bayar",
            body: (
              <P>
                Pembeli diarahkan ke <C>checkout_url</C>, memindai QR dengan e-wallet atau m-banking apa pun, dan membayar tepat
                Rp50.087. Nominal sudah terisi di QR, jadi pembeli tidak perlu mengetik.
              </P>
            ),
          },
          {
            title: "HP listener menangkap notifikasi",
            body: (
              <P>
                DANA Bisnis atau GoPay Merchant di HP listener memunculkan notifikasi &ldquo;Rp50.087 diterima&rdquo;. Aplikasi
                listener meneruskan teksnya ke server dalam hitungan detik.
              </P>
            ),
          },
          {
            title: "Server mencocokkan nominal dan melunasi tagihan",
            body: (
              <P>
                Parser membaca nominal, lalu server mencari tagihan dengan nominal akhir yang sama di QRIS yang sama. Tagihan
                menjadi <C>PAID</C>, halaman bayar langsung berubah, pembeli dikembalikan ke <C>return_url</C>, dan proyek
                menerima webhook <C>transaction.paid</C>.
              </P>
            ),
          },
        ]}
      />
      <Callout title="Kenapa nominal unik?">
        Notifikasi dana masuk hanya berisi nominal, tanpa nomor pesanan. Kode unik membuat setiap tagihan yang masih berjalan
        punya nominal berbeda, jadi pembayaran bisa dicocokkan tanpa salah orang. Kode unik dikunci sampai 24 jam setelah
        tagihan kedaluwarsa, supaya pembayaran telat tidak masuk ke tagihan lain.
      </Callout>

      <H2>Mulai cepat</H2>
      <P>Urutan menyiapkan gateway dari nol. Setiap langkah punya halaman panduan sendiri.</P>
      <Table
        head={["Langkah", "Di mana", "Panduan"]}
        rows={[
          ["1. Nyalakan 2FA dan hubungkan bot Telegram", "Pengaturan", <A key="a" href="/docs/notifikasi">Telegram & keamanan</A>],
          ["2. Tambah QRIS statis (cukup foto/screenshot)", "QRIS", <A key="a" href="/docs/qris">Menambah QRIS</A>],
          ["3. Pasangkan HP listener dan cari nama package", "Perangkat", <A key="a" href="/docs/listener">Memasang HP listener</A>],
          ["4. Isi package sumber di QRIS", "QRIS → Ubah", <A key="a" href="/docs/qris#package-aplikasi-sumber">Package sumber</A>],
          ["5. Buat proyek, simpan webhook secret dan API key", "Proyek & API key", <A key="a" href="/docs/proyek">Proyek & API key</A>],
          ["6. Uji: Buat transaksi uji, bayar sungguhan", "Beranda", <A key="a" href="/docs/pembayaran#uji-coba-pembayaran">Uji coba</A>],
          ["7. Sambungkan aplikasi Anda ke API dan webhook", "Kode proyek Anda", <A key="a" href="/docs/api">API transaksi</A>],
        ]}
      />

      <H2>Istilah</H2>
      <Table
        head={["Istilah", "Arti"]}
        rows={[
          ["QRIS statis", "QR merchant dari DANA Bisnis/GoPay Merchant tanpa nominal. Dipakai sebagai bahan, tidak ditunjukkan langsung ke pembeli."],
          ["QR dinamis", "QR yang dibuat qrismuz dari QRIS statis, sudah berisi nominal akhir tagihan."],
          ["Kode unik", "Tambahan Rp1–Rp999 di belakang nominal agar setiap tagihan aktif berbeda."],
          ["Nominal akhir (final_amount)", "Nominal yang harus dibayar pembeli: nominal + kode unik."],
          ["Proyek", "Aplikasi/website Anda yang memakai gateway. Punya API key dan URL webhook sendiri."],
          ["HP listener", "HP Android khusus yang login DANA Bisnis/GoPay Merchant dan menjalankan aplikasi qrismuz Listener."],
          ["Mutasi masuk", "Notifikasi dana masuk mentah yang diterima dari HP listener."],
          ["Parser", "Pola regex yang membaca nominal dari teks notifikasi."],
          ["Webhook", "Kabar dari qrismuz ke server proyek saat status tagihan berubah."],
        ]}
      />

      <H2>Yang perlu diingat</H2>
      <Ul>
        <li>Pembeli harus membayar <strong>tepat</strong> nominal akhir, termasuk 3 digit terakhir. Bila nominalnya beda, pembayaran tidak cocok otomatis dan perlu dikonfirmasi manual.</li>
        <li>QR di e-wallet tidak bisa &ldquo;kedaluwarsa&rdquo;. Pembeli yang menyimpan QR masih bisa membayar setelah batas waktu; pembayaran itu dicatat sebagai <C>LATE_PAID</C>.</li>
        <li>Konfirmasi otomatis bergantung pada satu HP listener. Bila HP offline, pembayaran tetap aman dan tercatat begitu HP online lagi, tetapi konfirmasinya tertunda.</li>
        <li>Gateway ini untuk pemakaian pribadi dengan QRIS Anda sendiri, bukan pengganti payment gateway resmi untuk melayani merchant lain.</li>
      </Ul>
    </>
  );
}
