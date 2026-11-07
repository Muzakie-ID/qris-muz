# qrismuz — listener (Android)

Aplikasi Android yang menangkap notifikasi dana masuk dari DANA Bisnis dan GoPay Merchant, lalu
meneruskan teks mentahnya ke backend (`apps/api`). Nominal tidak dibaca di HP; semua pembacaan dan
pencocokan ada di server. Spesifikasi lengkap ada di tab "Aplikasi listener" pada doc PRD.

Kotlin, Jetpack Compose, Room, WorkManager, OkHttp, Android Keystore. minSdk 26 (Android 8),
target Android 15. Tanpa Google Play Services.

## Membangun APK

Butuh JDK 17+ dan Android SDK (platform 35, build-tools 35).

```bash
cd apps/listener
echo "sdk.dir=/path/ke/android-sdk" > local.properties
./gradlew assembleRelease          # app/build/outputs/apk/release/app-release.apk
./gradlew testDebugUnitTest        # unit test
```

APK release ditandatangani dengan kunci debug agar langsung bisa dipasang di HP sendiri. Ganti
dengan kunci sendiri bila akan dibagikan.

## Memasang di HP listener

1. Pasang APK (izinkan "Instal aplikasi tidak dikenal").
2. Di backend, buat token pairing: `POST /admin/devices/pairing-tokens` → `pairing_uri`.
   Buat QR dari `pairing_uri` (atau isi alamat server dan token manual di aplikasi).
3. Buka aplikasi → **Scan QR pairing** → **Pasangkan**.
4. Ikuti **Daftar cek pemasangan** sampai semuanya hijau:
   akses notifikasi, penghemat baterai "Tanpa batasan", Mulai otomatis (MIUI), aplikasi dikunci di
   daftar aplikasi terbaru, dan update otomatis DANA Bisnis/GoPay Merchant dimatikan.
5. Buka **Mode deteksi**, bayar Rp1 ke tiap QRIS, salin nama package yang muncul, lalu daftarkan:
   `PATCH /admin/qris-sources/:id` dengan `{"source_package": "<package>"}`. Dalam ±10 menit
   listener memuat daftar package baru (atau kirim perintah `refresh_config`).
6. Tekan **Kirim uji**: harus muncul "Notifikasi uji diterima server".

## Cara kerja

- `CaptureService` (NotificationListenerService) menyimpan notifikasi dari package yang diizinkan
  ke database lokal dulu, lalu langsung mengirimnya. Bila gagal, `SendEventsWorker` mencoba lagi
  saat ada jaringan. Event baru dihapus dari antrian setelah server menyatakan diterima.
- `KeepAliveService` (foreground service) menjaga proses tetap hidup di MIUI, mengirim heartbeat
  tiap 60 detik, memuat ulang daftar package tiap 10 menit, dan menjalankan perintah dari server
  (`rescan`, `refresh_config`, `flush_queue`).
- `WatchdogWorker` tiap 15 menit dan `BootReceiver` menyalakan semuanya lagi bila mati.
- Setiap request ditandatangani HMAC-SHA256 atas `timestamp.nonce.body`; secret device disimpan
  terenkripsi dengan kunci di Android Keystore.
- Crash terakhir disimpan dan dikirim bersama heartbeat berikutnya.

## Uji terhadap backend sungguhan

```bash
QRISMUZ_SERVER=http://localhost:3001 QRISMUZ_TOKEN=pair_... QRISMUZ_PACKAGE=<package> \
QRISMUZ_TX=<id transaksi PENDING> QRISMUZ_AMOUNT=<final_amount> \
./gradlew testDebugUnitTest --tests '*LiveServerTest*'
```
