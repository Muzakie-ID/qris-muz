# qrismuz — web (dashboard + checkout)

Next.js 15 (App Router) + Tailwind CSS 4. Ikon dari [Lucide](https://lucide.dev), font Geist.
Semua data diambil dari backend `apps/api`; tidak ada data contoh lagi.

## Menjalankan

```bash
cd apps/web
npm install
cp .env.example .env.local   # isi ADMIN_TOKEN, DASHBOARD_PASSWORD, SESSION_SECRET
npm run dev                  # http://localhost:3000
```

Backend harus sudah berjalan (lihat `apps/api/README.md`).

| Variabel | Keterangan |
|---|---|
| `API_URL` | Alamat backend dari server Next.js, mis. `http://localhost:3001` |
| `NEXT_PUBLIC_API_URL` | Alamat backend yang dibuka browser pembeli (status realtime di halaman bayar) |
| `ADMIN_TOKEN` | Sama dengan `ADMIN_TOKEN` backend. Hanya dipakai di server, tidak pernah dikirim ke browser |
| `DASHBOARD_PASSWORD` | Password login dashboard |
| `SESSION_SECRET` | Kunci tanda tangan cookie sesi, minimal 24 karakter (`openssl rand -base64 32`) |

Di backend, `CHECKOUT_BASE_URL` harus berisi alamat web ini agar `checkout_url` benar dan browser
pembeli boleh membaca status (CORS).

## Halaman

| Rute | Akses | Isi |
|---|---|---|
| `/login` | Publik | Masuk dengan `DASHBOARD_PASSWORD` (sesi 12 jam) |
| `/` | Login | Ringkasan per hari/minggu/bulan, pendapatan 12 bulan, status listener, status transaksi 7 hari, pembayaran terbaru, peringatan notifikasi tak terbaca |
| `/transaksi` | Login | Daftar transaksi semua proyek: filter status, cari ref order / nominal / ID, halaman (`?status=&q=&page=`) |
| `/pay/[id]` | Publik | Halaman bayar pembeli: QR, nominal unik, hitung mundur, status realtime (SSE, cadangan cek berkala), kembali otomatis ke `return_url` setelah lunas |
| `/mutasi` | Login | Notifikasi dana masuk mentah dari HP listener: nominal terbaca, QRIS, hasil cocok (cocok, bayar telat, tidak cocok, tak terbaca, diabaikan), tombol **Proses ulang** (`?filter=&page=`) |
| `/proyek` | Login | Buat dan ubah proyek (URL webhook, return URL, QRIS default, masa berlaku). Webhook secret dan API key ditampilkan sekali saat dibuat; daftar API key dengan prefix, terakhir dipakai, dan tombol cabut |
| `/perangkat` | Login | Kartu HP listener: online, heartbeat, baterai, antrian, akses notifikasi, versi, selisih jam, aplikasi sumber, crash terakhir. Kirim perintah (kirim antrian, pindai ulang, muat ulang konfigurasi), cabut, dan pairing baru dengan QR + token |
| `/qris` | Login | Daftar QRIS (merchant, NMID, package sumber), tambah dari teks QRIS statis, ubah label/package, aktif/nonaktif |
| `/parser` | Login | Daftar pola regex, tambah/ubah (package, prioritas, cocok otomatis, aktif), alat uji teks notifikasi, peringatan notifikasi tak terbaca |
| `/webhook` | Login | Log pengiriman webhook semua proyek: status, percobaan, respons/error terakhir, jadwal coba berikutnya, tombol **Kirim ulang** (`?status=&page=`) |
| `/pengaturan` | Login | Halaman sementara, menyusul |

Tombol **Buat transaksi uji** membuat tagihan Rp1.000 sungguhan di proyek pertama (lewat
`POST /admin/transactions/test`) lalu membuka halaman bayarnya.

## Cara kerja

- Halaman dashboard adalah server component yang memanggil endpoint admin backend
  (`src/lib/api.ts`) dengan `ADMIN_TOKEN` dari server.
- Perubahan data memakai server action (`src/app/admin-actions.ts`) yang memeriksa sesi, memanggil
  backend, lalu memperbarui halaman (`revalidatePath`). Isian form tidak hilang bila backend menolak.
- `src/middleware.ts` mewajibkan login untuk semua halaman kecuali `/login` dan `/pay/*`.
  Cookie sesi ditandatangani HMAC dengan `SESSION_SECRET` (`src/lib/session.ts`).
- Login ini sementara sampai login owner + 2FA dibuat di Tahap 3.
