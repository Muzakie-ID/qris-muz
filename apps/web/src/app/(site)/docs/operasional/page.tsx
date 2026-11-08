import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code";
import { A, C, Callout, DocTitle, H2, P, Table, Ul } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Server, backup & masalah umum · Dokumentasi" };

export default function DocsOperasional() {
  return (
    <>
      <DocTitle
        title="Server, backup & masalah umum"
        lead="Perawatan rutin di VPS dan daftar masalah yang paling sering terjadi beserta penyelesaiannya. Panduan pemasangan server dari nol ada di deploy/README.md di repo."
      />

      <H2>Perintah sehari-hari di VPS</H2>
      <P>Jalankan dari folder <C>qris-muz/deploy</C>.</P>
      <CodeBlock
        title="VPS"
        code={`# Update ke versi terbaru (migrasi database otomatis)
git pull && docker compose up -d --build

# Status dan log
docker compose ps
docker compose logs -f api        # atau web, caddy, backup

# Backup sekarang dan uji restore
docker compose exec backup backup.sh
docker compose exec backup restore-test.sh`}
      />

      <H2>Backup</H2>
      <Ul>
        <li>Database dibackup otomatis setiap hari pukul 02.30 WIB ke Google Drive (rclone), dan diuji restore setiap Minggu 04.15.</li>
        <li>Salinan disimpan 30 hari di Drive dan 7 hari di VPS.</li>
        <li>Hasil setiap backup tampil di <A href="/pengaturan#backup">Pengaturan → Backup database</A>. Status <strong>Perlu dicek</strong> atau alarm Telegram berarti backup gagal/terlambat: lihat <C>docker compose logs backup</C>.</li>
        <li>Simpan isi file <C>deploy/.env</C> (terutama <C>APP_ENCRYPTION_KEY</C>) di password manager. Tanpa kunci itu, secret webhook dan HP listener di backup tidak bisa dibuka.</li>
      </Ul>
      <Callout title="Token Google Drive kedaluwarsa">
        Bila log backup menyebut token/oauth, jalankan <C>docker compose run --rm backup rclone config reconnect gdrive:</C> lalu
        ikuti langkah authorize di laptop seperti saat pemasangan.
      </Callout>

      <H2>Masalah umum</H2>
      <Table
        head={["Gejala", "Penyebab yang mungkin", "Penyelesaian"]}
        rows={[
          [
            "Sudah bayar, halaman bayar tidak berubah",
            "HP listener offline; package QRIS belum diisi; nominal yang dibayar berbeda; notifikasi tak terbaca",
            <>Cek <A href="/perangkat">Perangkat</A> lalu <A href="/mutasi">Mutasi masuk</A>. Lihat <A href="/docs/pembayaran#pembayaran-yang-perlu-ditangani-manual">penanganan manual</A>.</>,
          ],
          [
            "Mutasi masuk kosong padahal ada notifikasi di HP",
            "Akses notifikasi listener mati, aplikasi dimatikan MIUI, atau package belum dipantau",
            "Buka aplikasi listener, selesaikan Daftar cek pemasangan, tekan Pindai ulang notifikasi di Perangkat.",
          ],
          [
            "Perangkat sering Offline",
            "Penghemat baterai/Mulai otomatis MIUI, Wi-Fi tidur, HP tidak mengisi",
            "Atur baterai Tanpa batasan, nyalakan Mulai otomatis, kunci aplikasi di daftar terbaru, gunakan charger.",
          ],
          [
            "HP listener: request ditolak / jam tidak sinkron",
            "Jam HP meleset lebih dari 5 menit",
            "Nyalakan tanggal & waktu otomatis di HP.",
          ],
          [
            "Membuat tagihan: 422 lebih dari satu QRIS aktif",
            "Proyek belum punya QRIS default",
            <>Setel QRIS default di <A href="/proyek">Proyek & API key</A>.</>,
          ],
          [
            "Membuat tagihan: 401",
            "API key salah, terpotong, atau sudah dicabut",
            "Buat API key baru dan pasang di server proyek.",
          ],
          [
            "Webhook Gagal di Log webhook",
            "Server proyek mati, URL salah, verifikasi tanda tangan salah (mis. body sudah di-parse JSON), firewall",
            <>Lihat kolom Respons terakhir, perbaiki, lalu Kirim ulang. Panduan verifikasi di <A href="/docs/webhook">Webhook</A>.</>,
          ],
          [
            "Login: Terlalu banyak percobaan",
            "5 kali salah password atau kode 2FA",
            <>Tunggu 15 menit, atau <C key="c">owner-cli reset-password</C> di server.</>,
          ],
          [
            "Kode 2FA selalu salah",
            "Jam HP authenticator meleset",
            "Nyalakan tanggal & waktu otomatis di HP authenticator, lalu coba kode berikutnya.",
          ],
          [
            "Foto QRIS tidak terbaca",
            "Foto buram, silau, terpotong, atau format HEIC",
            "Pakai screenshot dari aplikasi merchant atau foto lurus dan terang dalam JPG/PNG.",
          ],
        ]}
      />
    </>
  );
}
