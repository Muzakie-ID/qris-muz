# PRD Aplikasi Listener (Android)

Nov 7, 2026 · @muzakie

> Bagian dari [PRD utama](PRD.md). Implementasinya ada di [apps/listener](../apps/listener/README.md).

## Ringkasan

Aplikasi Android kecil yang dipasang di HP khusus (Redmi Note 7). Tugasnya satu: menangkap notifikasi dana masuk dari DANA Bisnis dan GoPay Merchant, lalu meneruskan teks mentahnya ke server secepat mungkin tanpa ada yang hilang.

Aplikasi ini **tidak** membaca nominal dan tidak mencocokkan transaksi. Semua itu dikerjakan parser di server, supaya perubahan format notifikasi cukup diatasi dari dashboard tanpa memasang ulang aplikasi.

**Tujuan:**

- Setiap notifikasi dari aplikasi yang diizinkan sampai ke server, walau HP sempat offline.
- Owner tahu dalam 5 menit kalau listener mati, offline, atau dimatikan MIUI.
- Pemasangan dan pairing selesai dalam sekali duduk, dipandu daftar cek di layar.

**Di luar lingkup:** membaca SMS, membaca notifikasi aplikasi lain, membuka DANA Bisnis atau GoPay Merchant secara otomatis, dan rilis di Play Store (APK dipasang langsung).

## Sumber notifikasi

Dua aplikasi merchant yang dipakai owner. Contoh diambil dari notifikasi asli.

| Aplikasi | Judul | Teks | Pola nominal |
| --- | --- | --- | --- |
| DANA Bisnis | Pembayaran Masuk | Rp200.000 diterima DANA Bisnis. | `Rp` langsung diikuti angka, titik sebagai pemisah ribuan |
| GoPay Merchant | Pembayaran QRIS statis diterima | Rp 1 di Muzakie ID, KUTOARJO. | `Rp`, spasi, lalu angka |

Pola awal parser di server (bisa diubah dari dashboard):

- DANA Bisnis: `Rp\s?([\d.]+)\s+diterima`
- GoPay Merchant: `Rp\s?([\d.]+)\s+di\s`

Catatan:

- Contoh di atas berasal dari iPhone. Teks di Android bisa sedikit berbeda, dan judul GoPay Merchant terpotong di layar, jadi teks lengkapnya dicek saat uji.
- Notifikasi DANA Bisnis tidak memuat nama merchant, dan keduanya tidak membawa ID transaksi atau nama pembayar. Pencocokan sepenuhnya mengandalkan nominal unik.
- Nama package kedua aplikasi belum diketahui pasti. Package dicatat lewat mode deteksi saat pemasangan (lihat Alur dan layar).

## Perangkat target

| Hal | Keputusan |
| --- | --- |
| HP listener | Redmi Note 7, khusus untuk listener |
| Sistem | Android 11 (sudah dicek owner) |
| minSdk | 26 (Android 8.0), supaya HP pengganti nanti punya banyak pilihan |
| targetSdk | Versi terbaru saat aplikasi dibuat |
| Teknologi | Kotlin, NotificationListenerService, Room, WorkManager, Android Keystore, tanpa Google Play Services |
| Izin khusus Android 11 | QUERY\_ALL\_PACKAGES, agar listener bisa membaca versi DANA Bisnis dan GoPay Merchant untuk heartbeat. Aman dipakai karena APK tidak lewat Play Store. |

**Syarat:** DANA Bisnis dan GoPay Merchant harus bisa dipasang dan login di Redmi Note 7. Kalau salah satunya sudah tidak mendukung Android 11, perlu HP lain.

## Alur dan layar

1. **Pasang APK**, lalu buka aplikasi.
2. **Daftar cek pemasangan**: satu layar, tiap baris berubah hijau bila sudah beres, dengan tombol langsung ke setelan terkait.
   - Izin akses notifikasi
   - Penghemat baterai: Tanpa batasan
   - Mulai otomatis (MIUI): aktif
   - Aplikasi dikunci di daftar aplikasi terbaru
   - DANA Bisnis dan GoPay Merchant terpasang, sudah login, dan notifikasinya aktif
3. **Pairing**: di dashboard owner menekan "Tambah perangkat" dan muncul QR berisi token sekali pakai (berlaku 10 menit). Listener men-scan QR itu, menukar token dengan device\_id dan secret, lalu menyimpan secret di Android Keystore.
4. **Mode deteksi** (sekali saat pemasangan, maksimal 10 menit): listener menampilkan semua notifikasi yang masuk beserta nama package-nya, hanya di layar HP dan tidak dikirim ke server. Owner membayar Rp1 ke QRIS masing-masing aplikasi, lalu menandai package yang benar. Daftar package disimpan di server dan diambil listener lewat `GET /device/config`.
5. **Layar status** (layar utama): listener aktif atau mati, koneksi ke server, heartbeat terakhir, jumlah antrian belum terkirim, dan 5 notifikasi terakhir yang terkirim.
6. **Log**: notifikasi yang ditangkap 7 hari terakhir beserta statusnya (terkirim atau menunggu).
7. **Pengaturan**: alamat server, kirim notifikasi uji, kirim ulang antrian, dan cabut pairing.

## Fitur dan prioritas

| Fitur | Prioritas |
| --- | --- |
| NotificationListenerService dengan daftar package dari server | MVP |
| Simpan ke database lokal (Room) dulu, baru dikirim | MVP |
| Antrian offline dan kirim ulang otomatis (WorkManager), batch maksimal 50 | MVP |
| Heartbeat tiap 60 detik: status listener, baterai, sedang mengisi atau tidak, versi aplikasi sumber, jumlah antrian | MVP |
| Foreground service dengan notifikasi tetap "Listener aktif" | MVP |
| Sambung ulang otomatis dan pindai notifikasi aktif saat tersambung kembali | MVP |
| Pairing lewat QR dari dashboard, secret di Keystore | MVP |
| Daftar cek pemasangan khusus MIUI | MVP |
| Mode deteksi package | MVP |
| Notifikasi uji (event bertanda test) | MVP |
| Log 7 hari | MVP |
| HP listener cadangan (dua device aktif) | Fase 2 |
| Pembaruan aplikasi otomatis dari server | Fase 2 |
| PIN untuk membuka pengaturan dan mencabut pairing, supaya orang lain yang memegang HP tidak bisa mengubahnya | MVP |
| Perintah jarak jauh dari dashboard lewat balasan heartbeat: pindai ulang notifikasi, kirim log, muat ulang daftar package | MVP |
| Peringatan dini lewat heartbeat: charger terlepas, baterai di bawah 30%, jam HP tidak sinkron dengan server (bikin tanda tangan ditolak) | MVP |
| Laporan crash otomatis ke server, lalu listener hidup lagi sendiri | MVP |
| Pengumuman suara lewat speaker HP (tanpa alat soundbox): membacakan "Pembayaran masuk lima puluh ribu delapan puluh tujuh rupiah" setelah server mengonfirmasi lunas. Volume suara diatur di aplikasi, terpisah dari volume HP; ada juga tombol nyala/mati, jam tenang, dan tombol uji suara | Fase 2 |
| Mode layar besar: pembayaran terakhir dan statusnya tampil penuh di layar, cocok bila HP diletakkan di meja | Fase 2 |
| Alarm suara di HP saat server tidak bisa dihubungi lebih dari 10 menit | Fase 2 |

## Data yang dikirim

Setiap notifikasi dari package yang diizinkan dikirim apa adanya ke `POST /device/events`, dalam batch.

| Field | Isi |
| --- | --- |
| package | Nama package aplikasi sumber |
| title | Judul notifikasi |
| text | Teks notifikasi |
| big\_text | Teks panjang, bila ada |
| sub\_text | Teks tambahan, bila ada |
| posted\_at | Waktu notifikasi muncul (milidetik) |
| notification\_key | ID notifikasi dari Android |
| app\_version | Versi aplikasi sumber |
| captured\_at | Waktu listener menangkapnya |
| hash | SHA-256 dari package + notification\_key + posted\_at + teks; kunci dedup |

Aturan:

- Event ditulis ke database lokal dulu, baru dikirim. Event dihapus dari antrian hanya setelah server membalas sukses dan menyebut hash yang diterima.
- Notifikasi yang sama bisa tertangkap lagi (diperbarui Android atau dipindai ulang). Server membuang yang hash-nya sudah ada.
- Notifikasi ringkasan grup diabaikan; yang dikirim notifikasi di dalamnya.
- Notifikasi dari package lain tidak disimpan dan tidak dikirim.

## Keandalan di MIUI

MIUI dikenal agresif mematikan aplikasi yang berjalan di latar belakang. Setelan wajib di Redmi Note 7:

- Setelan › Aplikasi › Listener › Penghemat baterai: **Tanpa batasan**
- Setelan › Aplikasi › Listener › **Mulai otomatis**: aktif
- Kartu Listener di daftar aplikasi terbaru dikunci (ikon gembok)
- Akses notifikasi untuk Listener: aktif
- Mode hemat daya dan ultra hemat daya: mati
- Pembaruan otomatis Play Store untuk DANA Bisnis dan GoPay Merchant: mati
- Wi-Fi tetap tersambung saat layar mati, data seluler sebagai cadangan
- HP selalu tersambung ke charger

Dari sisi aplikasi:

- Foreground service dengan notifikasi tetap, supaya tidak dianggap aplikasi menganggur.
- Tugas berkala WorkManager tiap 15 menit yang memeriksa listener dan meminta Android menyambungkannya ulang bila terputus.
- Mulai otomatis setelah HP dinyalakan ulang.
- Heartbeat terakhir yang dikirim memuat alasan bila listener terputus, agar alarm di dashboard menjelaskan penyebabnya.

## Keamanan

- Token pairing sekali pakai, berlaku 10 menit, dibuat dari dashboard.
- Secret per device disimpan di Android Keystore dan tidak pernah ditampilkan.
- Setiap request ditandatangani HMAC-SHA256 atas timestamp, nonce, dan body, dengan header `X-Device-Id`, `X-Timestamp`, `X-Nonce`, `X-Signature`. Server menolak timestamp yang selisihnya lebih dari 5 menit dan nonce yang sudah pernah dipakai.
- Hanya HTTPS; alamat `http://` ditolak kecuali di build debug.
- Owner bisa mencabut device dari dashboard. Listener yang dicabut berhenti mengirim dan kembali ke layar pairing.
- Teks notifikasi hanya disimpan di HP selama 7 hari.

## Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| MIUI mematikan listener | Konfirmasi tertunda | Setelan wajib, foreground service, sambung ulang berkala, alarm heartbeat |
| Aplikasi merchant hanya boleh login di satu HP | Notifikasi pindah ke HP listener; iPhone owner tidak menerimanya lagi | Dicek saat pemasangan; owner memakai notifikasi Telegram dari gateway sebagai gantinya |
| DANA Bisnis atau GoPay Merchant berhenti mendukung Android 11 | Listener tidak bisa dipakai | Siapkan HP pengganti dengan Android lebih baru |
| Format notifikasi berubah setelah update | Pembayaran tidak terbaca | Teks mentah tetap terkirim, alarm UNPARSED, parser diubah dari dashboard |
| Aplikasi merchant menunda atau tidak mengirim notifikasi | Tidak ada event untuk dicocokkan | Rekonsiliasi harian (Fase 2) dan konfirmasi manual |
| HP hilang atau dicuri | Secret device bocor | Cabut device dari dashboard, pairing ulang di HP baru |

## Rencana uji dan gerbang

Listener baru dipakai untuk uang sungguhan setelah semua uji ini lolos di Redmi Note 7:

1. Bayar Rp1 ke QRIS DANA Bisnis dan ke QRIS GoPay Merchant: kedua event sampai di server dengan package, judul, dan teks lengkap.
2. Matikan Wi-Fi dan data, bayar 3 kali, lalu nyalakan lagi: ketiga event terkirim tanpa duplikat.
3. Nyalakan ulang HP: listener aktif lagi tanpa dibuka manual.
4. Biarkan semalam dengan layar mati: heartbeat tidak pernah putus lebih dari 5 menit.
5. Paksa hentikan aplikasi dari setelan: alarm Telegram muncul dalam 5 menit.
6. Dua pembayaran bernominal sama berurutan: tercatat sebagai dua event terpisah.
7. Notifikasi dari aplikasi lain (misalnya WhatsApp) tidak pernah tersimpan atau terkirim.

## Keputusan

1. **Multi-QRIS masuk MVP.** QRIS DANA Bisnis dan GoPay Merchant aktif bersamaan. Kode unik dikunci per QRIS, dan event dari satu aplikasi hanya dicocokkan dengan transaksi yang memakai QRIS aplikasi itu. Hubungan package dan QRIS disimpan di kolom `source_package` pada tabel `qris_sources`.
2. **Aplikasi merchant login hanya di HP listener.** Owner memantau pembayaran lewat dashboard dan notifikasi Telegram dari gateway.
3. **Redmi Note 7 memakai Android 11.**
