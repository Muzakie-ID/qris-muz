# Blueprint PRD — Payment Gateway QRIS Dinamis

Nov 7, 2026 · @muzakie

> Sumber: https://claude.ai/artifact/5ESzKh4SMAdQjUm2YBpQ2z (snapshot; saran review yang belum di-accept tidak termasuk)

## Ringkasan

Payment gateway pribadi yang mengubah QRIS statis milik merchant menjadi QRIS dinamis bernominal, lalu mengonfirmasi pembayaran secara otomatis lewat app Android pendengar notifikasi.

**Masalah:** QRIS statis tidak membawa nominal dan tidak punya webhook, jadi penjual harus cek mutasi manual dan mencocokkan sendiri siapa yang sudah bayar. Payment gateway resmi butuh proses pendaftaran dan biaya per transaksi.

**Tujuan:**

- Setiap order punya QR dengan nominal unik yang bisa langsung dipindai.
- Pembayaran terkonfirmasi otomatis dalam hitungan detik tanpa cek manual.
- Web milik sendiri (toko akun premium, opayai) cukup memanggil satu API dan menerima webhook saat order lunas.
- Tidak ada pembayaran yang hilang: setiap mutasi tercatat, termasuk yang gagal dibaca atau datang terlambat.

**Di luar lingkup (fase awal):** melayani merchant pihak ketiga, refund otomatis ke pembeli, dan integrasi resmi dengan PJP.

## Pengguna dan use case

Ada tiga jenis pengguna; owner adalah pengguna utama di fase awal.

| Pengguna | Kebutuhan utama | Titik sentuh |
| --- | --- | --- |
| Owner (admin) | Pantau uang masuk, kelola QRIS, device, dan project | Dashboard, notifikasi Telegram |
| Web klien (developer) | Buat transaksi dan tahu kapan lunas tanpa polling manual | REST API, webhook |
| Pembeli | Bayar cepat dengan nominal yang jelas | Halaman checkout |

**Use case utama:**

1. Pembeli checkout di toko akun premium, toko memanggil API, pembeli diarahkan ke halaman bayar berisi QR bernominal unik.
2. Pembeli scan dan bayar dari e-wallet atau m-banking apa pun.
3. HP listener menangkap notifikasi dana masuk, server mencocokkan nominal, status jadi PAID, webhook dikirim ke toko, toko mengirim produk.
4. Owner melihat transaksi masuk di dashboard dan menerima notifikasi Telegram.
5. Saat format notifikasi berubah, owner menerima alarm, memperbarui parser di dashboard, lalu memproses ulang event yang tertunda.

## Fitur dan prioritas

MVP berisi 19 fitur yang cukup untuk menerima pembayaran otomatis dari web sendiri; 6 fitur sisanya memperhalus pengalaman dan masuk Fase 2.

| Modul | Fitur | Prioritas |
| --- | --- | --- |
| Core QRIS | Upload dan decode QRIS statis, validasi CRC, format EMVCo, dan nama merchant | MVP |
| Core QRIS | Generate QRIS dinamis: tag 01 jadi 12, sisip tag 54 (nominal), hitung ulang CRC16 | MVP |
| Core QRIS | Kode unik nominal 1–999, dikunci selama transaksi masih aktif | MVP |
| Core QRIS | Beberapa QRIS per owner (lebih dari satu merchant) | Fase 2 |
| Listener Android | NotificationListenerService dengan filter package, kirim teks mentah ke server | MVP |
| Listener Android | Antrian offline (Room) dan retry otomatis (WorkManager) | MVP |
| Listener Android | Heartbeat: status listener, baterai, versi app sumber notifikasi | MVP |
| Listener Android | Rebind otomatis dan scan notifikasi aktif saat tersambung ulang | MVP |
| Listener Android | Pairing device via token dari dashboard, secret di Android Keystore | MVP |
| Parser dan matching | Parser di server: regex per package plus fallback generik | MVP |
| Parser dan matching | Status UNPARSED, alarm ke owner, proses ulang event setelah parser diperbarui | MVP |
| Parser dan matching | Matching nominal unik dalam jendela waktu, termasuk pembayaran telat | MVP |
| Parser dan matching | Editor dan penguji regex di dashboard | Fase 2 |
| Transaksi | Siklus status PENDING, PAID, EXPIRED, CANCELLED dengan expired otomatis | MVP |
| Transaksi | Idempotency key agar order tidak tercatat dobel | MVP |
| Transaksi | Konfirmasi manual oleh owner dengan catatan alasan | MVP |
| API dan webhook | REST API buat, cek, batalkan transaksi; API key per project | MVP |
| API dan webhook | Webhook bertanda tangan HMAC, retry dengan backoff, log pengiriman | MVP |
| API dan webhook | Mode sandbox dengan simulasi pembayaran | Fase 2 |
| API dan webhook | Dokumentasi API dan contoh kode | Fase 2 |
| Checkout | Halaman bayar: QR, nominal unik disorot, countdown, redirect otomatis saat lunas | MVP |
| Checkout | Tombol "Saya sudah bayar" dan unduh QR | Fase 2 |
| Dashboard | Daftar transaksi, filter, detail, dan log mutasi mentah | MVP |
| Dashboard | Statistik pendapatan, grafik, ekspor CSV | Fase 2 |
| Dashboard | Notifikasi Telegram untuk pembayaran masuk dan alarm sistem | MVP |

## Alur sistem

> _Diagram (alur pembayaran · 5 langkah, 1 percabangan) ada di dokumen asli._

Jalur normal selesai otomatis dari langkah 1 sampai 5; event yang gagal dibaca atau tidak cocok ditahan sampai owner menindaklanjuti. Transaksi yang tidak dibayar sampai batas waktu berubah jadi EXPIRED dan kode uniknya dilepas.

## Kebutuhan non-fungsional

Prinsip utamanya: tidak boleh ada pembayaran yang hilang, walau konfirmasinya boleh tertunda.

**Reliabilitas**

- Setiap notifikasi dari package yang diizinkan disimpan mentah di HP dan server sebelum diparsing.
- Event yang gagal dikirim tetap di antrian HP sampai server mengonfirmasi terima.
- Heartbeat hilang lebih dari 5 menit memicu alarm Telegram.
- Auto-update app sumber notifikasi dimatikan di HP listener; perubahan versi tercatat dan memicu peringatan.
- HP listener khusus, selalu terhubung charger dan internet, dikecualikan dari battery optimization.

**Keamanan**

- Login owner dengan password ber-hash (argon2 atau bcrypt) dan 2FA (TOTP).
- Semua request device dan webhook ditandatangani HMAC-SHA256, dengan timestamp dan nonce untuk menolak replay.
- API key dan secret disimpan terenkripsi; API key hanya ditampilkan sekali saat dibuat.
- Rate limiting di endpoint publik, HTTPS wajib, audit log untuk setiap aksi owner (konfirmasi manual, ubah parser, cabut device).

**Performa**

- Pembuatan transaksi dan QR selesai di bawah 500 ms.
- Dari notifikasi muncul sampai status PAID: target di bawah 10 detik saat HP online.
- Halaman checkout ringan dan nyaman dibuka dari HP.

Angka-angka di atas adalah target awal yang bisa disesuaikan setelah uji coba.

## Arsitektur dan tech stack

> _Diagram (arsitektur · 4 klien, 5 modul backend, 2 penyimpanan) ada di dokumen asli._

Semua klien masuk lewat satu backend; HP listener hanya mengirim teks mentah, sementara semua logika parsing dan pencocokan ada di server agar bisa diubah tanpa rilis ulang app.

| Komponen | Teknologi | Alasan |
| --- | --- | --- |
| Backend | Node.js + NestJS (TypeScript) | Modular, satu bahasa dengan frontend |
| Web app (checkout + dashboard) | Next.js + Tailwind | Satu codebase untuk halaman bayar dan dashboard |
| Database | PostgreSQL | Transaksi dan constraint unik yang kuat |
| Cache dan antrian | Redis + BullMQ | Kunci kode unik ber-TTL, retry webhook terjadwal |
| Generate QR | Fungsi CRC16-CCITT sendiri + library qrcode | Logika konversi QRIS tetap di tangan sendiri |
| App listener | Kotlin, NotificationListenerService, Room, WorkManager, Android Keystore | Native, andal di background, secret aman |
| Notifikasi owner | Telegram Bot API | Gratis dan instan |
| Deploy | VPS + Docker Compose + Caddy (HTTPS otomatis) | Murah, mudah dipindah |
| Monitoring | Uptime Kuma + log terstruktur | Tahu cepat kalau server atau webhook bermasalah |

## Skema database

Sepuluh tabel PostgreSQL; `transactions` dan `payment_events` adalah inti, dihubungkan lewat `matched_event_id`.

| Tabel | Kolom penting | Catatan |
| --- | --- | --- |
| users | id, email, password\_hash, totp\_secret, created\_at | Owner/admin |
| projects | id, user\_id, name, webhook\_url, webhook\_secret, default\_expiry\_min | Satu per web klien (toko, opayai) |
| api\_keys | id, project\_id, key\_hash, prefix, mode (live/sandbox), last\_used\_at, revoked\_at | Simpan hash saja |
| qris\_sources | id, user\_id, raw\_payload, merchant\_name, nmid, is\_active | QRIS statis hasil upload |
| devices | id, user\_id, name, secret\_enc, last\_heartbeat\_at, listener\_ok, battery, source\_app\_versions | HP listener |
| transactions | id, project\_id, qris\_source\_id, merchant\_ref, base\_amount, unique\_code, final\_amount, qris\_payload, status, idempotency\_key, expires\_at, paid\_at, matched\_event\_id | Index unik: final\_amount + status aktif |
| payment\_events | id, device\_id, package\_name, raw\_text, posted\_at, hash, parsed\_amount, parse\_status, parser\_id | Mentah dari HP, hash untuk dedup |
| parsers | id, package\_name, pattern, priority, is\_active, updated\_at | Regex yang bisa diubah dari dashboard |
| webhook\_deliveries | id, transaction\_id, attempt, status\_code, response\_body, next\_retry\_at | Log dan jadwal retry |
| audit\_logs | id, user\_id, action, target, detail, created\_at | Jejak aksi owner |

Redis menyimpan kunci kode unik yang sedang dipakai (TTL sama dengan masa berlaku transaksi) dan antrian webhook.

## API dan kontrak device

Dua kelompok endpoint: API publik untuk web klien (autentikasi API key) dan API device untuk HP listener (autentikasi HMAC).

**API publik** (header `Authorization: Bearer <api_key>`)

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | /v1/transactions | Buat transaksi: amount, merchant\_ref, expiry\_min opsional; header Idempotency-Key |
| GET | /v1/transactions/{id} | Cek status dan detail transaksi |
| POST | /v1/transactions/{id}/cancel | Batalkan transaksi yang masih PENDING |
| GET | /pay/{id} | Halaman checkout untuk pembeli (publik) |

Respons buat transaksi berisi id, final\_amount, unique\_code, qris\_payload, qr\_image\_url, checkout\_url, dan expires\_at.

**Webhook ke web klien**

- Event: `transaction.paid`, `transaction.expired`, `transaction.late_paid`.
- Header `X-Signature` = HMAC-SHA256 dari body dengan webhook\_secret project, plus `X-Timestamp`.
- Dianggap terkirim jika klien membalas 2xx; selain itu retry dengan backoff bertahap sampai beberapa kali, lalu ditandai gagal di dashboard.

**API device** (header `X-Device-Id`, `X-Timestamp`, `X-Nonce`, `X-Signature`)

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | /device/register | Tukar token pairing dengan device\_id dan secret |
| POST | /device/events | Kirim batch notifikasi mentah: package, text, posted\_at, hash |
| POST | /device/heartbeat | Status listener, baterai, versi app sumber |
| GET | /device/config | Daftar package yang diizinkan |

Server menolak request yang timestamp-nya terlalu jauh dari waktu server atau nonce-nya sudah pernah dipakai.

## Risiko dan mitigasi

Risiko terbesar ada di HP listener sebagai satu-satunya sumber konfirmasi; sebagian besar mitigasi menjaga agar kegagalannya cepat ketahuan dan bisa dipulihkan.

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Format notifikasi berubah setelah update app | Pembayaran tidak terbaca | Simpan teks mentah, parser di server, alarm UNPARSED, matikan auto-update, pantau versi app |
| HP mati, offline, atau listener dimatikan Android | Konfirmasi tertunda | Heartbeat + alarm, foreground service, rebind otomatis, scan notifikasi aktif |
| Dua transaksi dengan nominal akhir sama | Salah cocok | Kode unik dikunci di Redis, index unik di database, jendela waktu matching |
| Pembeli mengubah nominal sebelum bayar | Nominal tidak cocok | Tampilkan nominal unik dengan jelas, tombol "Saya sudah bayar", konfirmasi manual |
| Pembeli membayar setelah expired | Uang masuk tanpa order aktif | Status late\_paid, webhook khusus, keputusan di tangan owner |
| Request palsu ke endpoint device | Order palsu dianggap lunas | HMAC + timestamp + nonce, secret di Keystore, cabut device dari dashboard |
| Bukan QRIS dinamis resmi dari PJP | Tidak cocok untuk melayani merchant lain | Batasi untuk pemakaian pribadi; pindah ke PJP resmi jika ingin melayani pihak ketiga |

## Roadmap dan metrik sukses

> _Diagram (roadmap · 4 tahap, 3 gerbang) ada di dokumen asli._

Tahap 1 sampai 3 menghasilkan semua fitur berlabel MVP; tahap 4 mengerjakan fitur berlabel Fase 2. Tanggal belum ditetapkan.

| Metrik | Target |
| --- | --- |
| Pembayaran hilang (mutasi tidak tercatat) | 0 |
| Salah cocok transaksi | 0 |
| Pembayaran terkonfirmasi otomatis tanpa campur tangan owner | ≥ 99% |
| Waktu dari notifikasi masuk sampai PAID (HP online) | < 10 detik |
| Webhook sukses terkirim setelah retry | ≥ 99% |
