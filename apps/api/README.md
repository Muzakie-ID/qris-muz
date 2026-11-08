# qrismuz — api (NestJS)

Backend payment gateway QRIS dinamis. PostgreSQL saja, tanpa Redis.

- **Tahap 1, Core QRIS** (`src/qris/core`): baca dan validasi QRIS, ubah statis → dinamis, CRC16.
- **Tahap 2, MVP otomatis**: API transaksi dengan kode unik per QRIS, API device untuk HP listener,
  parser dan pencocokan, webhook bertanda tangan dengan retry, kedaluwarsa otomatis, halaman checkout
  realtime (SSE), dan endpoint admin.

## Menjalankan

```bash
cd apps/api
npm install
cp .env.example .env        # isi DATABASE_URL, APP_ENCRYPTION_KEY, ADMIN_TOKEN
npm run db:migrate
npm run start:dev           # http://localhost:3001
```

## Menyiapkan pertama kali (pakai ADMIN_TOKEN)

```bash
H='Authorization: Bearer <ADMIN_TOKEN>'; J='Content-Type: application/json'

# 1. Daftarkan QRIS statis, satu per aplikasi merchant.
curl -X POST localhost:3001/admin/qris-sources -H "$H" -H "$J" \
  -d '{"label":"DANA Bisnis","payload":"000201...","source_package":"<package DANA Bisnis>"}'

# 2. Buat proyek. webhook_secret hanya muncul sekali: simpan.
curl -X POST localhost:3001/admin/projects -H "$H" -H "$J" \
  -d '{"name":"KursusKu","webhook_url":"https://kursusku.id/webhook","default_qris_source_id":"qrs_..."}'

# 3. Buat API key untuk proyek itu. api_key hanya muncul sekali.
curl -X POST localhost:3001/admin/projects/prj_.../api-keys -H "$H"

# 4. Token pairing untuk HP listener (berlaku 10 menit).
curl -X POST localhost:3001/admin/devices/pairing-tokens -H "$H" -H "$J" -d '{"device_name":"Redmi Note 7"}'
```

`source_package` boleh dikosongkan dulu dan diisi nanti, setelah nama package diketahui lewat mode
deteksi listener. Notifikasi dari package yang belum terdaftar tetap disimpan, lalu bisa diproses ulang
lewat `POST /admin/events/reprocess`.

## API untuk proyek (header `Authorization: Bearer <api_key>`)

| Method | Rute | Isi |
|---|---|---|
| POST | `/v1/transactions` | `{ amount, merchant_ref, expiry_min?, return_url?, metadata?, qris_source_id? }`, header `Idempotency-Key` disarankan |
| GET | `/v1/transactions/:id` | Status dan detail |
| POST | `/v1/transactions/:id/cancel` | Batalkan yang masih `PENDING` |
| GET | `/v1/status` | `listener_online`, `confirmation: realtime | delayed` |

Respons transaksi berisi `final_amount` (nominal yang harus dibayar), `qris_payload`, `qr_image_url`,
dan `checkout_url` untuk mengarahkan pembeli.

### Webhook ke proyek

Event: `transaction.paid`, `transaction.expired`, `transaction.late_paid`. Header:
`X-Event-Id` (tetap sama di setiap percobaan ulang), `X-Event-Type`, `X-Timestamp` (ms), dan
`X-Signature = hex(HMAC-SHA256(webhook_secret, X-Timestamp + "." + body))`.
Balas 2xx bila diterima; selain itu dikirim ulang 8 kali dalam ±24 jam.

Contoh verifikasi di Node.js:

```js
const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
  .update(`${req.headers['x-timestamp']}.${rawBody}`).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-signature']))) return res.sendStatus(401);
if (Math.abs(Date.now() - Number(req.headers['x-timestamp'])) > 5 * 60_000) return res.sendStatus(401);
// Simpan X-Event-Id yang sudah diproses agar kiriman ganda diabaikan.
```

## API device (untuk aplikasi listener)

| Method | Rute | Isi |
|---|---|---|
| POST | `/device/register` | `{ token }` → `device_id`, `secret` (sekali saja) |
| POST | `/device/events` | `{ events: [{ package, title, text, big_text?, sub_text?, posted_at, notification_key, app_version?, captured_at?, hash, is_test? }] }` (maks 50) |
| POST | `/device/heartbeat` | `{ listener_ok, battery?, charging?, queued?, source_app_versions? }` |
| GET | `/device/config` | Daftar package yang perlu dikirim |

Semua kecuali register wajib header `X-Device-Id`, `X-Timestamp` (ms), `X-Nonce` (8–64 karakter
`A-Za-z0-9_-`, sekali pakai), dan `X-Signature = hex(HMAC-SHA256(secret, timestamp + "." + nonce + "." + body mentah))`.

## Halaman checkout (publik, untuk web app)

`GET /public/checkout/:id`, `GET /public/checkout/:id/qr.png` (hanya saat masih bisa dibayar),
dan `GET /public/checkout/:id/events` (Server-Sent Events; status dikirim begitu berubah).

## Admin (header `Authorization: Bearer <ADMIN_TOKEN>`)

QRIS (`/admin/qris-sources`), proyek dan API key (`/admin/projects`, `/admin/api-keys/:id/revoke`),
perangkat (`/admin/devices`, pairing, cabut), konfirmasi manual (`POST /admin/transactions/:id/confirm`
dengan `{ reason }`), log webhook dan kirim ulang, daftar event (`/admin/events?parse_status=UNPARSED`),
dan proses ulang event (`POST /admin/events/reprocess`). Semua aksi tercatat di `audit_logs`.

Untuk dashboard web:

| Method | Rute | Isi |
|---|---|---|
| GET | `/admin/dashboard` | Ringkasan 24 jam / 7 hari / 30 hari (dan periode sebelumnya), tagihan menunggu, status 7 hari, 5 pembayaran terbaru, pendapatan 12 bulan (WIB), status listener, jumlah notifikasi tak terbaca/tak cocok |
| GET | `/admin/transactions` | `?status=&q=&project_id=&page=&per_page=` (maks 100). `q` mencari ref order, nominal akhir, atau ID. Berisi `counts` dan `sums` per status |
| POST | `/admin/transactions/test` | `{ amount, project_id? }` → tagihan uji (`merchant_ref` `TEST-…`) di proyek pertama bila tidak disebut |
| GET | `/admin/projects/:id/api-keys` | Daftar API key proyek: `prefix`, `last_used_at`, `revoked_at` (key asli tidak pernah ditampilkan lagi) |
| GET | `/admin/devices` | `{ status, devices }`; tiap device berisi heartbeat, baterai, antrian, versi, aplikasi sumber, selisih jam, crash terakhir, perintah tertunda (tanpa secret) |
| GET | `/admin/parsers` | Semua parser, urut prioritas |
| POST | `/admin/parsers` | `{ pattern, package_name?, priority?, auto_match?, is_active? }`. Pola harus regex valid dengan minimal satu grup tangkap (400 bila tidak) |
| PATCH | `/admin/parsers/:id` | Ubah sebagian kolom di atas |
| POST | `/admin/parsers/test` | `{ text, package_name?, title?, pattern? }` → `{ matched, amount, parser_id, auto_match }`. Tanpa `pattern`, semua parser aktif dipakai seperti di produksi |
| GET | `/admin/webhook-deliveries` | `?status=PENDING\|DELIVERED\|FAILED&page=&per_page=`, dengan nama proyek, URL webhook, ref order, dan `counts` per status |
| POST | `/admin/webhook-deliveries/:id/retry` | Kirim ulang segera (404 bila tidak ada) |
| GET | `/admin/payment-events` | Mutasi masuk berhalaman: `?parse_status=&match_status=&page=&per_page=`, dengan nama device, label QRIS, ref order, dan `counts` per status cocok plus `UNPARSED` |

## Cara kerja penting

- **Kode unik**: 1–999 dipilih acak per QRIS, dengan kunci per QRIS di PostgreSQL (advisory lock) agar
  tidak bentrok. Nominal akhir tetap dikunci selama masa tenggang (`UNIQUE_CODE_GRACE_HOURS`) setelah
  kedaluwarsa, supaya pembayaran telat tidak masuk ke tagihan baru.
- **Pencocokan**: notifikasi dari package QRIS X hanya dicocokkan dengan tagihan QRIS X. Lunas
  sebelum kedaluwarsa = `PAID`; sesudahnya (masih masa tenggang) = `LATE_PAID`, keputusan di owner.
  Pembayaran tanpa tagihan yang cocok dicatat `UNMATCHED` untuk ditinjau.
- **Parser**: pola regex di tabel `parsers`. Pola umum (`auto_match = false`) hanya mencatat nominal
  tanpa melunasi otomatis, agar notifikasi seperti penarikan dana tidak salah dianggap pembayaran.
- **Webhook**: dicatat di transaksi database yang sama dengan perubahan status (outbox), lalu dikirim
  tugas berkala tiap 5 detik.

## Test

```bash
npm test          # unit test
npm run test:e2e  # alur lengkap dengan PostgreSQL (TEST_DATABASE_URL, bawaan: database qrismuz_test lokal)
```
