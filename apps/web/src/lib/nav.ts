import {
  Braces,
  Folder,
  House,
  Inbox,
  QrCode,
  ReceiptText,
  Settings,
  Smartphone,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Menu yang halamannya belum dibangun memakai halaman "segera hadir". */
  ready: boolean;
  description: string;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Beranda", icon: House, ready: true, description: "Ringkasan pembayaran dari semua proyek." },
  { href: "/transaksi", label: "Transaksi", icon: ReceiptText, ready: true, description: "Semua tagihan yang dibuat proyek lewat API." },
  { href: "/mutasi", label: "Mutasi masuk", icon: Inbox, ready: false, description: "Notifikasi dana masuk mentah dari HP listener, termasuk yang belum terbaca parser." },
  { href: "/proyek", label: "Proyek & API key", icon: Folder, ready: false, description: "Daftar proyek, API key, URL webhook, dan return URL default." },
];

export const SYSTEM_NAV: NavItem[] = [
  { href: "/perangkat", label: "Perangkat", icon: Smartphone, ready: false, description: "HP listener yang terhubung, heartbeat, dan pairing perangkat baru." },
  { href: "/qris", label: "QRIS", icon: QrCode, ready: false, description: "Upload dan kelola QRIS statis yang dipakai untuk membuat QR dinamis." },
  { href: "/parser", label: "Parser", icon: Braces, ready: false, description: "Pola pembaca notifikasi per aplikasi dan event yang gagal dibaca." },
  { href: "/webhook", label: "Log webhook", icon: Webhook, ready: false, description: "Riwayat pengiriman webhook ke proyek, termasuk retry yang gagal." },
];

export const PLACEHOLDER_SECTIONS = [...MAIN_NAV, ...SYSTEM_NAV, {
  href: "/pengaturan",
  label: "Pengaturan",
  icon: Settings,
  ready: false,
  description: "Akun owner, 2FA, notifikasi Telegram, dan backup.",
}].filter((item) => !item.ready);
