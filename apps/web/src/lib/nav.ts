import {
  Braces,
  Folder,
  House,
  Inbox,
  QrCode,
  ReceiptText,
  Smartphone,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Beranda", icon: House, description: "Ringkasan pembayaran dari semua proyek." },
  { href: "/transaksi", label: "Transaksi", icon: ReceiptText, description: "Semua tagihan yang dibuat proyek lewat API." },
  { href: "/mutasi", label: "Mutasi masuk", icon: Inbox, description: "Notifikasi dana masuk mentah dari HP listener, termasuk yang belum terbaca parser." },
  { href: "/proyek", label: "Proyek & API key", icon: Folder, description: "Daftar proyek, API key, URL webhook, dan return URL default." },
];

export const SYSTEM_NAV: NavItem[] = [
  { href: "/perangkat", label: "Perangkat", icon: Smartphone, description: "HP listener yang terhubung, heartbeat, dan pairing perangkat baru." },
  { href: "/qris", label: "QRIS", icon: QrCode, description: "Upload dan kelola QRIS statis yang dipakai untuk membuat QR dinamis." },
  { href: "/parser", label: "Parser", icon: Braces, description: "Pola pembaca notifikasi per aplikasi dan event yang gagal dibaca." },
  { href: "/webhook", label: "Log webhook", icon: Webhook, description: "Riwayat pengiriman webhook ke proyek, termasuk retry yang gagal." },
];
