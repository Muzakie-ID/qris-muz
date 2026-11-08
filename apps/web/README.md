# qrismuz — web (dashboard + checkout)

Next.js 15 (App Router) + Tailwind CSS 4. Ikon dari [Lucide](https://lucide.dev), font Geist.
Semua data diambil dari backend `apps/api`; tidak ada data contoh lagi.

## Menjalankan

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:3000
```

Backend harus sudah berjalan dan akun owner sudah dibuat (`npm run owner -- create email` di
`apps/api`).

| Variabel | Keterangan |
|---|---|
| `API_URL` | Alamat backend dari server Next.js, mis. `http://localhost:3001` |
| `PUBLIC_API_URL` | Alamat publik backend yang dibuka browser pembeli (status realtime di halaman bayar). Dibaca saat runtime, jadi satu image Docker bisa dipakai di domain mana pun |

Di backend, `CHECKOUT_BASE_URL` harus berisi alamat web ini agar `checkout_url` benar dan browser
pembeli boleh membaca status (CORS).

## Halaman

| Rute | Akses | Isi |
|---|---|---|
| `/login` | Publik | Email + password owner, lalu kode 2FA bila aktif |
| `/` | Login | Ringkasan per hari/minggu/bulan, pendapatan 12 bulan, status listener, status transaksi 7 hari, pembayaran terbaru, peringatan notifikasi tak terbaca |
| `/transaksi` | Login | Daftar transaksi semua proyek: filter status, cari ref order / nominal / ID, halaman (`?status=&q=&page=`). Tombol **Tandai lunas** (konfirmasi manual dengan alasan) untuk tagihan menunggu/kedaluwarsa/dibatalkan |
| `/pay/[id]` | Publik | Halaman bayar pembeli: QR, nominal unik, hitung mundur, status realtime (SSE, cadangan cek berkala), kembali otomatis ke `return_url` setelah lunas |
| `/mutasi` | Login | Notifikasi dana masuk mentah dari HP listener: nominal terbaca, QRIS, hasil cocok (cocok, bayar telat, tidak cocok, tak terbaca, diabaikan), tombol **Proses ulang** (`?filter=&page=`) |
| `/proyek` | Login | Buat dan ubah proyek (URL webhook, return URL, QRIS default, masa berlaku). Webhook secret dan API key ditampilkan sekali saat dibuat; daftar API key dengan prefix, terakhir dipakai, dan tombol cabut |
| `/perangkat` | Login | Kartu HP listener: online, heartbeat, baterai, antrian, akses notifikasi, versi, selisih jam, aplikasi sumber, crash terakhir. Kirim perintah (kirim antrian, pindai ulang, muat ulang konfigurasi), cabut, dan pairing baru dengan QR + token |
| `/qris` | Login | Daftar QRIS (merchant, NMID, package sumber). Tambah QRIS dengan unggah foto/screenshot (pilih file, seret, atau Ctrl+V; dibaca di browser dengan BarcodeDetector atau jsQR, foto tidak dikirim ke server) atau tempel teks, dengan pratinjau merchant, NMID, penyelenggara, dan cek CRC sebelum disimpan. Ubah label/package, aktif/nonaktif |
| `/parser` | Login | Daftar pola regex, tambah/ubah (package, prioritas, cocok otomatis, aktif), alat uji teks notifikasi, peringatan notifikasi tak terbaca |
| `/webhook` | Login | Log pengiriman webhook semua proyek: status, percobaan, respons/error terakhir, jadwal coba berikutnya, tombol **Kirim ulang** (`?status=&page=`) |
| `/docs` | Login | Dokumentasi tata cara: cara kerja, QRIS, HP listener, proyek & API key, API transaksi (contoh curl/Node.js/PHP/Python dengan alamat API asli), webhook dan verifikasi tanda tangan, alur pembayaran, parser, Telegram & keamanan, server dan masalah umum |
| `/pengaturan` | Login | Ganti password, nyalakan/matikan 2FA (QR authenticator), daftar sesi aktif dan cabut, notifikasi Telegram (token, chat ID, kategori, pesan uji, log), status backup dan uji restore |

Tombol **Buat transaksi uji** membuat tagihan Rp1.000 sungguhan di proyek pertama (lewat
`POST /admin/transactions/test`) lalu membuka halaman bayarnya.

## Cara kerja

- Halaman dashboard adalah server component yang memanggil endpoint admin backend
  (`src/lib/api.ts`) dengan token sesi owner dari cookie httpOnly. Backend memeriksa sesi di setiap
  request; sesi yang berakhir atau dicabut diarahkan ke `/login`.
- IP pengunjung (dari Caddy) dan user agent diteruskan ke backend, agar rate limit, log login, dan
  daftar sesi memakai data pengunjung, bukan server web.
- Perubahan data memakai server action (`src/app/admin-actions.ts`) yang memeriksa sesi, memanggil
  backend, lalu memperbarui halaman (`revalidatePath`). Isian form tidak hilang bila backend menolak.
- `src/middleware.ts` mewajibkan cookie sesi untuk semua halaman kecuali `/login` dan `/pay/*`.
- `Dockerfile` membangun server mandiri Next.js (`output: "standalone"`); lihat `deploy/`.
