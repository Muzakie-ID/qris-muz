# Deploy ke VPS

Satu VPS menjalankan semuanya lewat Docker Compose:

| Service | Isi |
|---|---|
| `db` | PostgreSQL 16 (volume `pgdata`) |
| `api` | Backend NestJS. Migrasi database jalan otomatis setiap start |
| `web` | Dashboard owner dan halaman bayar pembeli |
| `caddy` | HTTPS otomatis (Let's Encrypt) untuk dua domain |
| `backup` | `pg_dump` harian ke Google Drive (rclone) dan uji restore mingguan |

```
Internet ──443──> Caddy ─┬─ API_DOMAIN ──> api:3001   (/v1, /device, /public; /admin dan /auth ditutup)
                         └─ WEB_DOMAIN ──> web:3000 ──(jaringan internal)──> api:3001 (/admin, /auth)
```

Login owner dan endpoint admin hanya bisa dipanggil server web lewat jaringan internal Docker.
Dari internet, `https://API_DOMAIN/admin/...` dan `/auth/...` menjawab 404.

## 1. Siapkan VPS

- VPS 1 vCPU, RAM 1–2 GB, Ubuntu 22.04/24.04.
- Dua subdomain, misalnya `api.contoh.id` dan `bayar.contoh.id`. Arahkan record **A** keduanya ke
  IP VPS. Tunggu sampai `ping api.contoh.id` menunjukkan IP VPS.

```bash
# Docker + Compose
curl -fsSL https://get.docker.com | sh

# Firewall: hanya SSH, HTTP, HTTPS
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
```

## 2. Konfigurasi

```bash
git clone https://github.com/Muzakie-ID/qris-muz.git
cd qris-muz/deploy
cp .env.example .env
openssl rand -hex 24      # → POSTGRES_PASSWORD
openssl rand -base64 32   # → APP_ENCRYPTION_KEY
nano .env                 # isi domain, email, dua nilai di atas
chmod 600 .env
```

**Simpan isi `.env` (terutama `APP_ENCRYPTION_KEY`) di password manager**, terpisah dari VPS.
Secret webhook proyek dan secret HP listener dienkripsi dengan kunci ini. Tanpa kunci ini, backup
database tetap bisa dipulihkan, tetapi secret itu harus dibuat ulang.

## 3. Jalankan

```bash
docker compose up -d --build
docker compose ps                 # api, web, db harus "healthy"
docker compose logs -f caddy      # tunggu "certificate obtained successfully"
```

Buat akun owner (password ditanyakan tanpa ditampilkan, minimal 10 karakter):

```bash
docker compose exec api node dist/scripts/owner-cli.js create anda@contoh.id
```

Lalu buka `https://WEB_DOMAIN`, masuk, dan berurutan:

1. **Pengaturan → 2FA**: nyalakan dengan Google Authenticator/Authy di HP pribadi.
2. **Pengaturan → Telegram**: isi token bot dan chat ID, tekan **Kirim pesan uji**.
3. **QRIS**: tambahkan QRIS statis DANA Bisnis dan GoPay Merchant.
4. **Proyek & API key**: buat proyek, simpan webhook secret dan API key.
5. **Perangkat → Tambah perangkat**: pindai QR pairing dari aplikasi listener. Alamat server yang
   terbaca adalah `https://API_DOMAIN`.
6. Tekan **Buat transaksi uji**, bayar sungguhan, pastikan status berubah jadi Lunas.

## 4. Backup ke Google Drive

Backup memakai [rclone](https://rclone.org/drive/). VPS tidak punya browser, jadi izin Google
Drive dibuat di laptop.

1. Pasang rclone di laptop (rclone.org/install), sebab login Google butuh browser.
2. Di VPS:
   ```bash
   mkdir -p rclone
   docker compose run --rm backup rclone config
   ```
   Pilih `n` (remote baru), nama `gdrive`, storage `drive`, client_id dan secret dikosongkan,
   scope `drive.file` (rclone hanya bisa melihat file yang dibuatnya sendiri, bukan seluruh isi
   Drive). Saat ditanya **"Use web browser to automatically authenticate?"** jawab `n`. rclone
   menampilkan perintah `rclone authorize "drive" "…"`: jalankan perintah itu di laptop, login
   Google, lalu tempel token yang muncul ke terminal VPS. Sisanya pakai jawaban bawaan.
3. Di `.env`, isi `RCLONE_REMOTE=gdrive:qrismuz-backup`, lalu:
   ```bash
   chmod 600 rclone/rclone.conf
   docker compose up -d backup
   docker compose exec backup backup.sh         # backup pertama
   docker compose exec backup restore-test.sh   # pastikan bisa dipulihkan
   ```
4. Cek **Pengaturan → Backup database** di dashboard: dua baris Sukses.

Jadwal bawaan (WIB): backup setiap hari 02.30, uji restore setiap Minggu 04.15. Backup di Drive
disimpan 30 hari, di VPS 7 hari. Sejak backup pertama tercatat, backup yang gagal atau lebih tua
dari 26 jam memicu alarm Telegram. Backup tanpa `RCLONE_REMOTE` sengaja dicatat **gagal**, karena
salinan yang hanya ada di VPS ikut hilang bila VPS rusak.

### Memulihkan dari backup (VPS rusak)

```bash
# VPS baru: langkah 1–2 dengan .env lama (APP_ENCRYPTION_KEY yang sama) dan rclone.conf lama.
docker compose up -d db backup
docker compose exec backup sh -c 'rclone lsf gdrive:qrismuz-backup | sort | tail -3'
docker compose exec backup sh -c 'rclone copy gdrive:qrismuz-backup/<file>.dump /backups'
docker compose exec backup sh -c 'pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" /backups/<file>.dump'
docker compose up -d --build
```

## Operasional

| Kebutuhan | Perintah |
|---|---|
| Update ke versi terbaru | `git pull && docker compose up -d --build` (migrasi otomatis) |
| Log | `docker compose logs -f api` (atau `web`, `caddy`, `backup`) |
| Lupa password owner | `docker compose exec api node dist/scripts/owner-cli.js reset-password anda@contoh.id` |
| HP authenticator hilang | `docker compose exec api node dist/scripts/owner-cli.js disable-2fa anda@contoh.id` |
| Backup sekarang | `docker compose exec backup backup.sh` |
| Masuk ke database | `docker compose exec db psql -U qrismuz qrismuz` |

Kedua perintah `owner-cli` di atas juga mengeluarkan semua sesi yang sedang login.

`ADMIN_TOKEN` (opsional) untuk skrip otomasi dari dalam VPS:

```bash
docker compose exec api sh -c 'wget -qO- --header "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3001/admin/dashboard'
```

## Keamanan yang sudah diterapkan

- HTTPS wajib (Caddy, HSTS), header keamanan, dashboard tidak bisa dibingkai situs lain.
- Login owner: password argon2id, 2FA TOTP, akun dikunci 15 menit setelah 5 kali salah, sesi
  berakhir setelah 12 jam tidak dipakai (maksimal 30 hari), sesi bisa dicabut dari dashboard.
- Rate limiting per IP: 10/menit untuk login, 120/menit untuk endpoint publik, 600/menit untuk
  API proyek. IP asli diteruskan Caddy dan server web.
- Endpoint admin, login, dan alat uji QRIS tidak terbuka ke internet.
- Audit log mencatat email owner untuk setiap perubahan.

## Gerbang Tahap 3

Sebelum dipakai proyek sungguhan, pastikan:

- [ ] Pembayaran sungguhan dari e-wallet lunas otomatis di bawah 10 detik.
- [ ] Alarm Telegram datang saat Wi-Fi HP listener dimatikan lebih dari 5 menit, dan saat kembali online.
- [ ] Backup dan uji restore tercatat Sukses di dashboard.
- [ ] Seminggu berjalan tanpa pembayaran hilang (bandingkan riwayat DANA Bisnis/GoPay Merchant
  dengan Mutasi masuk).
