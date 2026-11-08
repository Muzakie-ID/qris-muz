import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code";
import { A, C, Callout, DocTitle, H2, P, Steps, Table, Ul } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Telegram & keamanan akun · Dokumentasi" };

export default function DocsNotifikasi() {
  return (
    <>
      <DocTitle
        title="Telegram & keamanan akun"
        lead="Alarm Telegram memberi tahu Anda saat ada uang masuk atau ada yang perlu dicek. Bagian kedua membahas login owner, 2FA, dan cara memulihkan akses."
      />

      <H2>Menghubungkan bot Telegram</H2>
      <Steps
        items={[
          { title: "Buat bot", body: <P>Di Telegram, chat <strong>@BotFather</strong>, kirim <C>/newbot</C>, beri nama, lalu salin token (bentuknya <C>123456789:AA…</C>).</P> },
          { title: "Mulai chat dengan bot", body: <P>Buka bot baru Anda dan tekan <strong>Start</strong>. Bot tidak bisa mengirim pesan ke Anda sebelum ini.</P> },
          { title: "Cari chat ID", body: <P>Chat <strong>@userinfobot</strong> dan salin angka Id. Untuk grup: tambahkan bot ke grup; ID grup diawali tanda minus.</P> },
          { title: "Isi di Pengaturan", body: <P>Buka <A href="/pengaturan#telegram">Pengaturan → Notifikasi Telegram</A>, isi token dan chat ID, centang <strong>Nyalakan notifikasi Telegram</strong>, Simpan, lalu tekan <strong>Kirim pesan uji</strong>.</P> },
        ]}
      />
      <P>Token disimpan terenkripsi dan tidak pernah ditampilkan lagi; untuk mengganti, cukup isi token baru.</P>

      <H2>Jenis notifikasi</H2>
      <Table
        head={["Kategori", "Dikirim saat"]}
        rows={[
          ["Pembayaran masuk", "Tagihan lunas (otomatis atau manual)."],
          ["Bayar telat", "Uang masuk untuk tagihan yang sudah kedaluwarsa/dibatalkan."],
          ["HP listener", "Offline lebih dari 5 menit atau akses notifikasi mati (sekali per kejadian), dan saat online lagi."],
          ["Notifikasi tak terbaca", "Notifikasi dari aplikasi sumber tidak bisa dibaca parser."],
          ["Dana masuk tidak cocok", "Nominal terbaca tetapi tidak cocok dengan tagihan mana pun."],
          ["Aplikasi sumber ter-update", "Versi DANA Bisnis/GoPay Merchant di HP listener berubah."],
          ["Webhook gagal permanen", "Webhook ke proyek gagal 8 kali."],
          ["Backup", "Backup atau uji restore gagal, atau backup sukses terakhir lebih dari 26 jam lalu."],
          ["Login dan akun terkunci", "Ada login ke dashboard, atau akun terkunci karena salah password/kode berkali-kali."],
        ]}
      />
      <P>Setiap kategori bisa dimatikan. Pesan yang gagal dikirim (mis. internet server putus) dicoba ulang sampai 5 kali; riwayatnya ada di bagian Notifikasi terakhir.</P>

      <H2>Login dan 2FA</H2>
      <Ul>
        <li>Login memakai email dan password owner. Setelah 5 kali salah, akun dikunci 15 menit.</li>
        <li>Sesi berakhir setelah 12 jam tidak dipakai, paling lama 30 hari. Daftar perangkat yang sedang login ada di <A href="/pengaturan">Pengaturan → Sesi aktif</A>; perangkat yang tidak dikenal bisa dikeluarkan.</li>
        <li>Mengganti password mengeluarkan semua sesi di perangkat lain.</li>
      </Ul>
      <Steps
        items={[
          { title: "Nyalakan 2FA", body: <P>Di <A href="/pengaturan#2fa">Pengaturan → 2FA</A> tekan <strong>Nyalakan 2FA</strong>.</P> },
          { title: "Pindai dengan aplikasi authenticator", body: <P>Pakai Google Authenticator, Authy, atau sejenisnya di HP pribadi (bukan HP listener). Simpan juga kunci teksnya di tempat aman.</P> },
          { title: "Masukkan kode 6 digit", body: <P>Setelah aktif, setiap login meminta kode dari aplikasi itu, dan sesi lain dikeluarkan.</P> },
        ]}
      />

      <H2>Memulihkan akses</H2>
      <P>Bila lupa password atau HP authenticator hilang, jalankan di server (VPS), dari folder <C>deploy</C>:</P>
      <CodeBlock
        title="VPS"
        code={`# Lupa password (juga membuka kunci akun)
docker compose exec api node dist/scripts/owner-cli.js reset-password anda@contoh.id

# HP authenticator hilang
docker compose exec api node dist/scripts/owner-cli.js disable-2fa anda@contoh.id`}
      />
      <Callout tone="warn">
        Kedua perintah mengeluarkan semua sesi. Setelah masuk lagi, nyalakan ulang 2FA dengan HP yang baru.
      </Callout>
    </>
  );
}
