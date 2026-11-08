/** Daftar halaman dokumentasi, urut seperti alur memakai gateway. */
export interface DocLink {
  href: string;
  title: string;
  group: "Mulai" | "Menyiapkan" | "Integrasi proyek" | "Sehari-hari";
}

export const DOCS: DocLink[] = [
  { href: "/docs", title: "Cara kerja & mulai cepat", group: "Mulai" },
  { href: "/docs/qris", title: "Menambah QRIS", group: "Menyiapkan" },
  { href: "/docs/listener", title: "Memasang HP listener", group: "Menyiapkan" },
  { href: "/docs/proyek", title: "Proyek & API key", group: "Menyiapkan" },
  { href: "/docs/api", title: "API transaksi", group: "Integrasi proyek" },
  { href: "/docs/webhook", title: "Webhook", group: "Integrasi proyek" },
  { href: "/docs/pembayaran", title: "Alur pembayaran & status", group: "Integrasi proyek" },
  { href: "/docs/parser", title: "Mutasi & parser", group: "Sehari-hari" },
  { href: "/docs/notifikasi", title: "Telegram & keamanan akun", group: "Sehari-hari" },
  { href: "/docs/operasional", title: "Server, backup & masalah umum", group: "Sehari-hari" },
];
