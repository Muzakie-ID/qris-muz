import type { Metadata } from "next";
import { A, C, Callout, DocTitle, H2, P, Steps, Table, Ul } from "@/components/docs/prose";
import { publicApiUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Memasang HP listener · Dokumentasi" };

export default function DocsListener() {
  const api = publicApiUrl();
  return (
    <>
      <DocTitle
        title="Memasang HP listener"
        lead="HP listener adalah HP Android khusus yang login DANA Bisnis dan GoPay Merchant, lalu meneruskan setiap notifikasi dana masuk ke server. Konfirmasi otomatis bergantung pada HP ini, jadi pemasangannya perlu benar."
      />

      <H2>Kebutuhan</H2>
      <Ul>
        <li>HP Android 8 ke atas (diuji di Redmi Note 7, Android 11), selalu terhubung charger dan internet (Wi-Fi lebih stabil).</li>
        <li>Aplikasi DANA Bisnis dan/atau GoPay Merchant yang sudah login, dengan notifikasi pembayaran menyala.</li>
        <li>APK qrismuz Listener (dibangun dari <C>apps/listener</C>).</li>
        <li>Sebaiknya HP ini hanya untuk listener: tidak dipakai harian, tidak login di HP lain dengan akun merchant yang sama.</li>
      </Ul>

      <H2>Pemasangan</H2>
      <Steps
        items={[
          {
            title: "Pasang APK",
            body: <P>Salin APK ke HP, buka, dan izinkan &ldquo;Instal aplikasi tidak dikenal&rdquo; untuk file manager/browser yang dipakai.</P>,
          },
          {
            title: "Buat kode pairing di dashboard",
            body: (
              <P>
                Buka <A href="/perangkat">Perangkat</A> → <strong>Tambah perangkat</strong>, isi nama HP, tekan <strong>Buat kode
                pairing</strong>. QR berlaku 10 menit dan hanya bisa dipakai sekali.
              </P>
            ),
          },
          {
            title: "Pasangkan HP",
            body: (
              <P>
                Di aplikasi listener tekan <strong>Scan QR pairing</strong> dan arahkan kamera ke QR di dashboard. Bila kamera
                bermasalah, isi alamat server <C>{api}</C> dan token secara manual, lalu <strong>Pasangkan</strong>. Alamat server
                wajib diawali <C>https://</C>.
              </P>
            ),
          },
          {
            title: "Selesaikan Daftar cek pemasangan",
            body: (
              <>
                <P>Ikuti setiap baris sampai semuanya hijau. Di HP Xiaomi (MIUI) ini menentukan apakah listener tetap hidup:</P>
                <Ul>
                  <li><strong>Akses notifikasi</strong>: izinkan qrismuz Listener.</li>
                  <li><strong>Penghemat baterai</strong>: pilih &ldquo;Tanpa batasan&rdquo;.</li>
                  <li><strong>Mulai otomatis</strong> (MIUI): nyalakan.</li>
                  <li><strong>Kunci di aplikasi terbaru</strong>: buka daftar aplikasi terbaru, tahan kartu qrismuz, pilih ikon gembok.</li>
                  <li><strong>Update otomatis</strong> DANA Bisnis/GoPay Merchant di Play Store: matikan, agar format notifikasi tidak berubah tiba-tiba.</li>
                </Ul>
              </>
            ),
          },
          {
            title: "Cari nama package (Mode deteksi)",
            body: (
              <P>
                Buka <strong>Mode deteksi</strong>, bayar Rp1 ke tiap QRIS dari HP lain, lalu isi nama package yang muncul di
                halaman QRIS. Panduannya di <A href="/docs/qris#package-aplikasi-sumber">Menambah QRIS</A>.
              </P>
            ),
          },
          {
            title: "Kirim uji",
            body: (
              <P>
                Tekan <strong>Kirim uji</strong> di aplikasi; harus muncul &ldquo;Notifikasi uji diterima server&rdquo;. Notifikasi
                uji tidak pernah melunasi tagihan.
              </P>
            ),
          },
        ]}
      />

      <H2>Memantau dari dashboard</H2>
      <P>Halaman <A href="/perangkat">Perangkat</A> menampilkan kondisi setiap HP:</P>
      <Table
        head={["Data", "Yang normal", "Bila tidak normal"]}
        rows={[
          ["Status", "Online", "Offline: heartbeat terakhir lebih dari 5 menit lalu, atau akses notifikasi mati."],
          ["Heartbeat terakhir", "Kurang dari 1–2 menit lalu", "HP mati, tanpa internet, atau aplikasi dimatikan sistem."],
          ["Baterai", "Mengisi", "Tidak mengisi: periksa charger."],
          ["Antrian belum terkirim", "0", "Lebih dari 0: notifikasi tersimpan di HP dan menunggu internet. Tidak hilang."],
          ["Akses notifikasi", "Aktif", "Mati: buka aplikasi listener di HP dan izinkan lagi."],
          ["Selisih jam HP", "Sinkron / beberapa detik", "Lebih dari 5 menit: request HP ditolak. Nyalakan waktu otomatis di HP."],
          ["Aplikasi sumber", "Versi DANA/GoPay yang terpasang", "Versi berubah memicu alarm: kirim pembayaran uji untuk memastikan masih terbaca."],
        ]}
      />
      <P>Tombol perintah dikirim ke HP pada heartbeat berikutnya (≤ 1 menit):</P>
      <Table
        head={["Tombol", "Fungsi"]}
        rows={[
          ["Kirim antrian", "Mengirim sekarang notifikasi yang masih tertahan di HP."],
          ["Pindai ulang notifikasi", "Membaca ulang notifikasi yang masih tampil di HP, untuk menangkap yang mungkin terlewat."],
          ["Muat ulang konfigurasi", "Memuat ulang daftar package dari server, mis. setelah mengubah package QRIS."],
          ["Cabut perangkat", "HP tidak bisa mengirim apa pun lagi. Pakai bila HP hilang/diganti; pasangkan ulang untuk memakai lagi."],
        ]}
      />
      <Callout tone="tip" title="Saat HP offline">
        Pembayaran tidak hilang: DANA/GoPay tetap menerima uangnya, dan notifikasi yang sudah tertangkap terkirim begitu HP online.
        Selama offline, proyek bisa memeriksa <C>GET /v1/status</C> untuk memberi tahu pembeli bahwa konfirmasi tertunda. Alarm
        Telegram dikirim saat HP offline lebih dari 5 menit dan saat kembali online.
      </Callout>
    </>
  );
}
