# qrismuz — api (NestJS)

Backend payment gateway QRIS. **Tahap 1: Core QRIS**: membaca QRIS statis,
memvalidasi CRC, mengubahnya menjadi QRIS dinamis bernominal, dan membuat gambar QR.

## Menjalankan

```bash
cd apps/api
npm install
cp .env.example .env     # lalu isi QRIS_STATIC_PAYLOAD
npm run start:dev        # http://localhost:3001
```

`QRIS_STATIC_PAYLOAD` adalah teks hasil scan QRIS statis merchant (diawali `000201`).
Bisa didapat dengan men-scan QR merchant memakai aplikasi pembaca QR biasa (bukan e-wallet).

## Uji gerbang Tahap 1: QR terbaca di semua e-wallet

Cara cepat tanpa server:

```bash
npm run qris -- inspect "<qris statis>"
npm run qris -- dynamic "<qris statis>" 1000 qris-1000.png
```

Atau lewat server (butuh `QRIS_TOOLS_ENABLED=true`): buka
`http://localhost:3001/v1/qris/dynamic.png?amount=1000` di browser, lalu scan
dengan beberapa e-wallet/m-banking. Lolos bila setiap aplikasi menampilkan nama
merchant yang benar dan nominal Rp1.000 yang **tidak bisa diubah**.

## Endpoint (alat uji, aktif bila `QRIS_TOOLS_ENABLED=true`)

| Method | Rute | Isi |
|---|---|---|
| GET | `/health` | Cek server hidup (selalu aktif) |
| POST | `/v1/qris/inspect` | `{ payload }` → valid/tidak, nama merchant, NMID, dll. |
| POST | `/v1/qris/dynamic` | `{ amount, payload? }` → QRIS dinamis + gambar SVG |
| GET | `/v1/qris/dynamic.png?amount=` | Gambar PNG dari QRIS statis yang disetel |

Kesalahan QRIS dibalas `422` dengan `code` yang stabil, mis. `CRC_MISMATCH`,
`NOT_STATIC`, `INVALID_AMOUNT`. Saat alat uji dimatikan, rute `/v1/qris/*` membalas 404.

## Cara kerja konversi (`src/qris/core`)

1. Payload dibaca sebagai TLV EMVCo dan divalidasi: diawali `000201`, CRC tag 63 cocok,
   mata uang 360, ada nama/kota merchant dan akun merchant (tag 26–51).
2. Tag 01 diubah `11` → `12` (dinamis).
3. Tag 54 diisi nominal (bilangan bulat rupiah), ditempatkan sesuai urutan tag.
4. Tag 55–57 (tip/biaya yang bisa diubah pembeli) dibuang agar nominal terkunci.
5. CRC16-CCITT dihitung ulang.

Kode ini murni TypeScript tanpa ketergantungan Nest, jadi bisa dipakai ulang.

## Test

```bash
npm test          # unit test (CRC, TLV, parse, konversi, config)
npm run test:e2e  # endpoint HTTP
```
