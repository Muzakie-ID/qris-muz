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
| `/mutasi`, `/proyek`, `/perangkat`, `/qris`, `/parser`, `/webhook`, `/pengaturan` | Login | Halaman sementara, menyusul |

Tombol **Buat transaksi uji** membuat tagihan Rp1.000 sungguhan di proyek pertama (lewat
`POST /admin/transactions/test`) lalu membuka halaman bayarnya.

## Cara kerja

- Halaman dashboard adalah server component yang memanggil endpoint admin backend
  (`src/lib/api.ts`) dengan `ADMIN_TOKEN` dari server.
- `src/middleware.ts` mewajibkan login untuk semua halaman kecuali `/login` dan `/pay/*`.
  Cookie sesi ditandatangani HMAC dengan `SESSION_SECRET` (`src/lib/session.ts`).
- Login ini sementara sampai login owner + 2FA dibuat di Tahap 3.
