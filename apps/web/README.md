# qrismuz — web (dashboard + checkout)

Next.js (App Router) + Tailwind CSS. Ikon dari [Lucide](https://lucide.dev), font Geist.

## Menjalankan

```bash
cd apps/web
npm install
npm run dev      # http://localhost:3000
```

## Halaman

| Rute | Isi |
|---|---|
| `/` | Beranda: ringkasan, grafik pendapatan (Fase 2), status listener, pembayaran terbaru |
| `/transaksi` | Daftar transaksi dengan filter status dan pencarian |
| `/pay/[id]` | Halaman checkout pembeli, contoh: `/pay/01JC8Q4V7QF2` |
| `/mutasi`, `/proyek`, `/perangkat`, `/qris`, `/parser`, `/webhook`, `/pengaturan` | Halaman sementara, dibangun bersama backend |

## Data

Semua data masih **contoh** dari `src/lib/mock-data.ts`. Bentuk datanya ada di
`src/lib/types.ts` dan mengikuti PRD (`docs/PRD.md`). Saat backend NestJS siap,
fungsi di `mock-data.ts` diganti dengan panggilan API tanpa mengubah komponen.

QR di halaman checkout dibuat dari teks contoh, bukan payload QRIS asli, jadi
tidak bisa dibayar. Tombol "Simulasikan lunas" hanya muncul di mode demo.
