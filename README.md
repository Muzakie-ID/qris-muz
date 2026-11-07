# qrismuz

Payment gateway **QRIS dinamis** pribadi. QRIS statis milik merchant diubah menjadi QRIS bernominal
untuk setiap tagihan, lalu pembayaran dikonfirmasi otomatis oleh aplikasi Android yang membaca
notifikasi dana masuk dari DANA Bisnis dan GoPay Merchant.

Gateway ini dipakai bersama oleh semua proyek milik owner (web atau aplikasi). Setiap proyek cukup
memanggil satu API untuk membuat tagihan, lalu menerima webhook saat tagihan lunas.

> **Untuk pemakaian pribadi.** Ini bukan QRIS dinamis resmi dari PJP dan tidak ditujukan untuk
> melayani merchant pihak ketiga. Untuk itu, gunakan payment gateway resmi.

---

## Daftar isi

- [Cara kerja](#cara-kerja)
- [Arsitektur](#arsitektur)
- [Isi repo](#isi-repo)
- [Status pengerjaan](#status-pengerjaan)
- [Mulai cepat (lokal)](#mulai-cepat-lokal)
- [Menyiapkan gateway pertama kali](#menyiapkan-gateway-pertama-kali)
- [Memakai API dari proyek](#memakai-api-dari-proyek)
- [Memasang HP listener](#memasang-hp-listener)
- [Keamanan](#keamanan)
- [Pengujian](#pengujian)
- [Konfigurasi](#konfigurasi)
- [Keterbatasan dan risiko](#keterbatasan-dan-risiko)
- [Rencana berikutnya](#rencana-berikutnya)

---

## Cara kerja

```mermaid
sequenceDiagram
    autonumber
    participant P as Proyek (web/app)
    participant G as Gateway API
    participant B as Pembeli
    participant M as DANA Bisnis / GoPay Merchant
    participant L as HP listener

    P->>G: POST /v1/transactions (amount 50.000)
    G-->>P: final_amount 50.087, qris_payload, checkout_url
    P->>B: Arahkan ke halaman bayar
    B->>M: Scan QR, bayar Rp50.087
    M->>L: Notifikasi "Rp50.087 diterima"
    L->>G: POST /device/events (teks mentah, ditandatangani HMAC)
    G->>G: Baca nominal, cocokkan dengan tagihan QRIS yang sama
    G-->>B: Status PAID (SSE), halaman pindah otomatis
    G->>P: Webhook transaction.paid (ditandatangani HMAC)
```

1. **QRIS dinamis.** Gateway mengambil QRIS statis merchant, mengubah tag 01 menjadi `12`
   (dinamis), menyisipkan nominal di tag 54, membuang tag tip (55–57) agar nominal tidak bisa
   diubah pembeli, lalu menghitung ulang CRC16.
2. **Nominal unik.** Setiap tagihan mendapat kode unik 1–999 yang ditambahkan ke nominal, misalnya
   Rp50.000 menjadi Rp50.087. Kode unik dikunci per QRIS selama tagihan aktif dan 24 jam setelahnya,
   sehingga pembayaran yang telat tidak tercocokkan ke tagihan baru.
3. **Konfirmasi.** HP listener meneruskan teks notifikasi mentah ke server. Server membaca nominal
   dengan pola yang bisa diubah, lalu mencocokkannya hanya dengan tagihan dari QRIS aplikasi yang
   mengirim notifikasi. Rata-rata di bawah 1 detik sejak notifikasi diterima server.
4. **Webhook.** Status `PAID`, `EXPIRED`, dan `LATE_PAID` dikirim ke proyek dengan tanda tangan
   HMAC, dikirim ulang hingga 8 kali dalam ±24 jam bila gagal.

## Arsitektur

```mermaid
flowchart LR
    subgraph Klien
        P[Proyek owner<br/>web / app]
        B[Pembeli]
        O[Owner]
    end
    subgraph Server
        API[apps/api<br/>NestJS]
        DB[(PostgreSQL)]
        WEB[apps/web<br/>Next.js]
    end
    H[apps/listener<br/>HP Android]

    P -- API key --> API
    API -- webhook --> P
    B -- halaman bayar --> WEB
    O -- dashboard --> WEB
    WEB --> API
    H -- HMAC --> API
    API --> DB
```

| Komponen | Teknologi | Peran |
|---|---|---|
| `apps/api` | NestJS 11, TypeScript, Drizzle ORM, PostgreSQL 16 | API transaksi, API device, pembaca dan pencocok pembayaran, webhook, admin |
| `apps/web` | Next.js 15, Tailwind CSS 4, Lucide | Dashboard owner dan halaman checkout pembeli |
| `apps/listener` | Kotlin, Jetpack Compose, Room, WorkManager, OkHttp | Menangkap notifikasi dana masuk dan meneruskannya ke server |

Semua penguncian kode unik, antrian webhook, dan nonce device disimpan di PostgreSQL (advisory
lock dan tabel antrian), jadi tidak perlu Redis.

## Isi repo

```
qris-muz/
├── apps/
│   ├── api/          Backend NestJS        → apps/api/README.md
│   │   ├── src/qris/core/   Konversi QRIS statis → dinamis, CRC16 (tanpa ketergantungan)
│   │   ├── src/transactions/ Tagihan, kode unik, kedaluwarsa
│   │   ├── src/payments/    Parser nominal dan pencocokan
│   │   ├── src/devices/     Pairing, tanda tangan HMAC, heartbeat
│   │   ├── src/webhooks/    Antrian dan pengiriman webhook
│   │   ├── src/checkout/    Data halaman bayar + SSE
│   │   ├── src/admin/       Endpoint pengelolaan owner
│   │   └── drizzle/         Migrasi SQL
│   ├── web/          Dashboard + checkout  → apps/web/README.md
│   └── listener/     Aplikasi Android      → apps/listener/README.md
└── docs/
    ├── PRD.md            Dokumen kebutuhan produk (gateway)
    └── PRD-listener.md   Dokumen kebutuhan aplikasi listener
```

## Status pengerjaan

| Tahap | Isi | Status |
|---|---|---|
| 1. Core QRIS | Konversi statis → dinamis, CRC16, gambar QR, alat uji | Selesai. Gerbang uji scan di e-wallet menunggu QRIS asli |
| 2. MVP otomatis | API transaksi, multi-QRIS, API device, parser, pencocokan, webhook, checkout SSE, aplikasi listener | Selesai di kode, teruji otomatis. Uji pembayaran sungguhan menunggu deploy |
| 3. Produksi | Deploy VPS, login owner + 2FA, notifikasi Telegram, rate limiting, backup, web tersambung ke API | Belum |
| 4. Penyempurnaan | Fitur Fase 2: rekonsiliasi, sandbox, statistik, HP cadangan, pengumuman suara, dll. | Belum |

Catatan: dashboard dan halaman checkout di `apps/web` masih memakai **data contoh** dan belum
tersambung ke API.

## Mulai cepat (lokal)

### Prasyarat

- Node.js 22
- PostgreSQL 16
- Untuk aplikasi Android: JDK 17+ dan Android SDK (platform 35, build-tools 35)

### 1. Database

```bash
sudo -u postgres psql -c "CREATE USER qris WITH PASSWORD 'qris' CREATEDB;"
sudo -u postgres createdb -O qris qrismuz
sudo -u postgres createdb -O qris qrismuz_test   # untuk e2e test
```

### 2. Backend

```bash
cd apps/api
npm install
cp .env.example .env
# Isi .env: APP_ENCRYPTION_KEY dan ADMIN_TOKEN, masing-masing dari:
#   openssl rand -base64 32
npm run db:migrate
npm run start:dev          # http://localhost:3001
curl localhost:3001/health # {"status":"ok"}
```

### 3. Web (dashboard + checkout)

```bash
cd apps/web
npm install
npm run dev                # http://localhost:3000
```

Contoh halaman checkout: `http://localhost:3000/pay/01JC8Q4V7QF2`.

### 4. Aplikasi listener

```bash
cd apps/listener
echo "sdk.dir=/path/ke/android-sdk" > local.properties
./gradlew assembleRelease  # app/build/outputs/apk/release/app-release.apk
```

## Menyiapkan gateway pertama kali

Sampai login owner dibuat (Tahap 3), pengelolaan memakai `ADMIN_TOKEN`:

```bash
H="Authorization: Bearer $ADMIN_TOKEN"; J='Content-Type: application/json'

# 1. Daftarkan QRIS statis, satu per aplikasi merchant.
#    payload = teks hasil scan QR merchant (diawali 000201).
curl -X POST localhost:3001/admin/qris-sources -H "$H" -H "$J" \
  -d '{"label":"DANA Bisnis","payload":"000201...","source_package":"<package DANA Bisnis>"}'

# 2. Buat proyek. webhook_secret hanya ditampilkan sekali.
curl -X POST localhost:3001/admin/projects -H "$H" -H "$J" \
  -d '{"name":"KursusKu","webhook_url":"https://kursusku.id/webhook","default_qris_source_id":"qrs_...","default_return_url":"https://kursusku.id/selesai"}'

# 3. Buat API key untuk proyek. api_key hanya ditampilkan sekali.
curl -X POST localhost:3001/admin/projects/prj_.../api-keys -H "$H"

# 4. Token pairing HP listener (berlaku 10 menit). Jadikan pairing_uri sebagai QR.
curl -X POST localhost:3001/admin/devices/pairing-tokens -H "$H" -H "$J" \
  -d '{"device_name":"Redmi Note 7"}'
```

Nama package aplikasi merchant bisa dikosongkan dulu, lalu diisi setelah diketahui lewat **Mode
deteksi** di aplikasi listener (`PATCH /admin/qris-sources/:id`).

Daftar lengkap endpoint admin ada di [apps/api/README.md](apps/api/README.md#admin-header-authorization-bearer-admin_token).

## Memakai API dari proyek

### Membuat tagihan

```bash
curl -X POST https://api.contoh.id/v1/transactions \
  -H "Authorization: Bearer qm_live_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ORDER-123" \
  -d '{
    "amount": 50000,
    "merchant_ref": "ORDER-123",
    "expiry_min": 15,
    "return_url": "https://kursusku.id/order/123/selesai",
    "metadata": { "user_id": 88, "kelas": "python-dasar" }
  }'
```

```json
{
  "id": "01M6SGD18EMZHM2WPRZ4FT2ZHB",
  "merchant_ref": "ORDER-123",
  "status": "PENDING",
  "amount": 50000,
  "unique_code": 87,
  "final_amount": 50087,
  "qris_source_id": "qrs_...",
  "qris_payload": "00020101021226...6304A083",
  "qr_image_url": "https://api.contoh.id/public/checkout/01M6.../qr.png",
  "checkout_url": "https://pay.contoh.id/pay/01M6...",
  "return_url": "https://kursusku.id/order/123/selesai",
  "metadata": { "user_id": 88, "kelas": "python-dasar" },
  "expires_at": "2026-11-07T10:15:00.000Z",
  "paid_at": null,
  "created_at": "2026-11-07T10:00:00.000Z"
}
```

Arahkan pembeli ke `checkout_url`, atau tampilkan `qris_payload` / `qr_image_url` di halaman sendiri.
Pembeli wajib membayar tepat `final_amount`.

| Method | Rute | Isi |
|---|---|---|
| POST | `/v1/transactions` | Buat tagihan. `qris_source_id` opsional (bawaan: QRIS default proyek) |
| GET | `/v1/transactions/:id` | Cek status dan detail |
| POST | `/v1/transactions/:id/cancel` | Batalkan tagihan `PENDING` |
| GET | `/v1/status` | `listener_online` dan `confirmation: realtime \| delayed` |

Status tagihan: `PENDING`, `PAID`, `EXPIRED`, `CANCELLED`, `LATE_PAID` (dibayar setelah kedaluwarsa,
keputusan diserahkan ke owner).

### Menerima webhook

Header: `X-Event-Id`, `X-Event-Type`, `X-Timestamp` (milidetik), dan
`X-Signature = hex(HMAC-SHA256(webhook_secret, X-Timestamp + "." + body))`.

```js
import crypto from 'node:crypto';

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const ts = req.headers['x-timestamp'];
  const expected = crypto.createHmac('sha256', process.env.QRISMUZ_WEBHOOK_SECRET)
    .update(`${ts}.${req.body}`).digest('hex');
  const given = String(req.headers['x-signature'] ?? '');
  if (given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return res.sendStatus(401);
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return res.sendStatus(401);

  const event = JSON.parse(req.body);
  // Webhook bisa terkirim lebih dari sekali: abaikan X-Event-Id yang sudah diproses.
  if (event.type === 'transaction.paid') {
    // event.data.merchant_ref, event.data.metadata, event.data.final_amount
  }
  res.sendStatus(200);
});
```

Balas 2xx bila diterima. Selain itu webhook dikirim ulang dengan jeda 1 menit, 5 menit, 15 menit,
30 menit, 1 jam, 3 jam, 6 jam, dan 12 jam.

## Memasang HP listener

Ringkasnya (detail di [apps/listener/README.md](apps/listener/README.md)):

1. Pasang APK di HP khusus (diuji untuk Redmi Note 7, Android 11).
2. Buka aplikasi, scan QR dari `pairing_uri`, lalu **Pasangkan**.
3. Selesaikan **Daftar cek pemasangan**: akses notifikasi, penghemat baterai "Tanpa batasan",
   Mulai otomatis (MIUI), kunci di daftar aplikasi terbaru, dan matikan update otomatis
   DANA Bisnis / GoPay Merchant.
4. **Mode deteksi**: bayar Rp1 ke tiap QRIS, catat nama package yang muncul, daftarkan ke
   `source_package` QRIS yang sesuai.
5. **Kirim uji** untuk memastikan server menerima.

Aplikasi menyimpan notifikasi ke database lokal dulu dan baru menghapusnya setelah server
mengonfirmasi, mengirim heartbeat tiap 60 detik, menyala sendiri setelah HP dinyalakan ulang, dan
menerima perintah jarak jauh (`rescan`, `refresh_config`, `flush_queue`).

## Keamanan

- **API key** proyek disimpan sebagai hash SHA-256 dan hanya ditampilkan sekali.
- **Secret webhook dan secret device** disimpan terenkripsi AES-256-GCM (`APP_ENCRYPTION_KEY`).
  Di HP, secret device dienkripsi dengan kunci Android Keystore.
- **Request device** ditandatangani HMAC-SHA256 atas `timestamp.nonce.body`. Server menolak jam yang
  meleset lebih dari 5 menit, nonce yang sudah dipakai, dan body yang diubah.
- **Webhook** ditandatangani HMAC-SHA256 atas `timestamp.body`, dengan `X-Event-Id` untuk dedup.
- **ID transaksi acak** (ULID), dan setiap proyek hanya bisa melihat transaksinya sendiri.
- **Parser umum tidak melunasi otomatis**, agar notifikasi seperti penarikan dana tidak dianggap
  pembayaran. Pembayaran tanpa tagihan yang cocok dicatat `UNMATCHED` untuk ditinjau.
- **Audit log** untuk setiap aksi admin: konfirmasi manual, perubahan QRIS/proyek, pairing.
- Endpoint alat uji QRIS (`/v1/qris/*`) dan admin mati bila tidak dikonfigurasi.

## Pengujian

```bash
# Backend
cd apps/api
npm test            # unit test: QRIS, CRC16, parser, enkripsi, kode unik, config
npm run test:e2e    # alur lengkap dengan PostgreSQL (database qrismuz_test)
npm run lint

# Web
cd apps/web
npm run lint && npm run build

# Listener
cd apps/listener
./gradlew testDebugUnitTest lintDebug
```

Uji alat Tahap 1 tanpa server, untuk mencoba scan dengan QRIS asli:

```bash
cd apps/api
npm run qris -- inspect "<qris statis>"
npm run qris -- dynamic "<qris statis>" 1000 qris-1000.png
```

## Konfigurasi

Variabel lingkungan backend (lihat [apps/api/.env.example](apps/api/.env.example)):

| Variabel | Wajib | Bawaan | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | Ya | | `postgres://user:pass@host:5432/db` |
| `APP_ENCRYPTION_KEY` | Ya | | 32 byte base64/hex. Jangan diganti setelah ada data |
| `ADMIN_TOKEN` | Tidak | kosong | Minimal 24 karakter. Kosong = endpoint admin mati |
| `PORT` | Tidak | `3001` | |
| `PUBLIC_API_URL` | Tidak | `http://localhost:3001` | Untuk `qr_image_url` dan `pairing_uri` |
| `CHECKOUT_BASE_URL` | Tidak | `http://localhost:3000` | Untuk `checkout_url` dan CORS |
| `QRIS_MAX_AMOUNT` | Tidak | `10000000` | Batas nominal per transaksi |
| `UNIQUE_CODE_GRACE_HOURS` | Tidak | `24` | Masa tenggang kode unik setelah kedaluwarsa |
| `DEVICE_CLOCK_TOLERANCE_SEC` | Tidak | `300` | Selisih jam HP–server yang masih diterima |
| `LISTENER_OFFLINE_AFTER_SEC` | Tidak | `300` | Listener dianggap offline setelah ini |
| `JOBS_ENABLED` | Tidak | `true` | Tugas berkala (kedaluwarsa, webhook) |
| `QRIS_TOOLS_ENABLED` | Tidak | `false` | Alat uji QRIS Tahap 1 |
| `QRIS_STATIC_PAYLOAD` | Tidak | kosong | QRIS untuk alat uji |

## Keterbatasan dan risiko

- **Bergantung pada satu HP.** Bila HP mati atau offline, konfirmasi tertunda sampai HP kembali.
  Notifikasi yang tertangkap tetap terkirim dari antrian. `GET /v1/status` memberi tahu proyek saat
  konfirmasi sedang tertunda.
- **Format notifikasi bisa berubah** setelah DANA Bisnis atau GoPay Merchant diperbarui. Teks
  mentah selalu disimpan, sehingga pola parser bisa diperbaiki lalu event diproses ulang
  (`POST /admin/events/reprocess`).
- **QR tidak bisa kedaluwarsa di sisi bank/e-wallet.** Setelah tagihan kedaluwarsa, QR disembunyikan
  dari halaman bayar, tetapi pembeli yang sudah menyimpan QR masih bisa membayar. Pembayaran itu
  dicatat sebagai `LATE_PAID`.
- **Pembeli harus membayar tepat** `final_amount`, termasuk 3 digit terakhir.

## Rencana berikutnya

1. Deploy ke VPS (Docker Compose + Caddy untuk HTTPS) dan uji pembayaran sungguhan dari HP listener.
2. Login owner dengan 2FA, menggantikan `ADMIN_TOKEN`.
3. Sambungkan dashboard dan halaman checkout ke API.
4. Notifikasi Telegram (pembayaran masuk, listener offline, notifikasi tak terbaca), rate limiting,
   dan backup harian `pg_dump` ke Google Drive lewat rclone.
