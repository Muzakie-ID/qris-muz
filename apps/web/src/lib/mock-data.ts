/**
 * Data contoh untuk tampilan. Semua fungsi di sini nanti diganti dengan
 * panggilan ke backend NestJS, dengan bentuk data yang sama (lihat types.ts).
 */
import type {
  ListenerStatus,
  MonthlyRevenue,
  Period,
  RecentPayment,
  SummaryCard,
  Transaction,
  TransactionStatus,
} from "./types";

const MERCHANT = { merchantName: "[NAMA MERCHANT]", nmid: "[NMID]" };

function tx(
  id: string,
  merchantRef: string,
  projectId: string,
  projectName: string,
  baseAmount: number,
  uniqueCode: number,
  status: TransactionStatus,
  createdAt: string,
): Transaction {
  const created = new Date(createdAt);
  return {
    id,
    projectId,
    projectName,
    merchantRef,
    baseAmount,
    uniqueCode,
    finalAmount: baseAmount + uniqueCode,
    // QR contoh: sengaja bukan payload QRIS asli, jadi tidak bisa dibayar.
    qrisPayload: `QRISMUZ-MOCKUP-${id}-TIDAK-UNTUK-PEMBAYARAN`,
    status,
    createdAt,
    expiresAt: new Date(created.getTime() + 15 * 60_000).toISOString(),
    paidAt: status === "PAID" || status === "LATE_PAID" ? createdAt : null,
    returnUrl: null,
    ...MERCHANT,
  };
}

const TRANSACTIONS: Transaction[] = [
  tx("01JC8Q4V7QF2", "ORDER-1043", "kursusku", "KursusKu", 50_000, 87, "PENDING", "2026-11-06T14:48:00Z"),
  tx("01JC8P2K2M9X", "INV-2207", "toko-digital", "Toko Digital", 125_000, 412, "PAID", "2026-11-06T14:41:00Z"),
  tx("01JC8N7D8XAB", "ORDER-1042", "kursusku", "KursusKu", 75_000, 233, "PENDING", "2026-11-06T14:39:00Z"),
  tx("01JC8K9P1RWC", "ORDER-1037", "kursusku", "KursusKu", 35_000, 112, "LATE_PAID", "2026-11-06T13:02:00Z"),
  tx("01JC8H3Z6TBD", "SUB-0391", "applangganan", "AppLangganan", 99_000, 731, "PAID", "2026-11-06T12:55:00Z"),
  tx("01JC8F5M4QCE", "INV-2206", "toko-digital", "Toko Digital", 60_000, 519, "EXPIRED", "2026-11-06T11:30:00Z"),
  tx("01JC8D8H9VNF", "SUB-0390", "applangganan", "AppLangganan", 99_000, 44, "PENDING", "2026-11-06T11:12:00Z"),
  tx("01JC8B1W3LEG", "INV-2205", "toko-digital", "Toko Digital", 210_000, 968, "PAID", "2026-11-06T10:47:00Z"),
  tx("01JC89C6R2KH", "ORDER-1036", "kursusku", "KursusKu", 45_000, 305, "CANCELLED", "2026-11-06T09:20:00Z"),
];

export function getTransactions(): Transaction[] {
  return TRANSACTIONS;
}

export function getTransaction(id: string): Transaction | undefined {
  return TRANSACTIONS.find((t) => t.id === id);
}

const SUMMARY: Record<Period, SummaryCard[]> = {
  day: [
    { key: "income", label: "Uang masuk", value: "Rp1.204.650", delta: "+6%", trend: "up", hint: "Kemarin Rp1.136.400" },
    { key: "paid", label: "Transaksi lunas", value: "23", delta: "+4%", trend: "up", hint: "1 dikonfirmasi manual" },
    { key: "pending", label: "Menunggu bayar", value: "3", delta: "aktif", trend: "neutral", hint: "2 kedaluwarsa dalam 15 menit" },
    { key: "rate", label: "Tingkat lunas", value: "85%", delta: "-3%", trend: "down", hint: "Dari 27 transaksi hari ini" },
  ],
  week: [
    { key: "income", label: "Uang masuk", value: "Rp4.812.350", delta: "+12%", trend: "up", hint: "Minggu lalu Rp4.296.000" },
    { key: "paid", label: "Transaksi lunas", value: "96", delta: "+8%", trend: "up", hint: "3 dikonfirmasi manual" },
    { key: "pending", label: "Menunggu bayar", value: "3", delta: "aktif", trend: "neutral", hint: "2 kedaluwarsa dalam 15 menit" },
    { key: "rate", label: "Tingkat lunas", value: "87%", delta: "-2%", trend: "down", hint: "Dari 110 transaksi minggu ini" },
  ],
  month: [
    { key: "income", label: "Uang masuk", value: "Rp18.240.900", delta: "+9%", trend: "up", hint: "Bulan lalu Rp16.734.000" },
    { key: "paid", label: "Transaksi lunas", value: "371", delta: "+11%", trend: "up", hint: "9 dikonfirmasi manual" },
    { key: "pending", label: "Menunggu bayar", value: "3", delta: "aktif", trend: "neutral", hint: "2 kedaluwarsa dalam 15 menit" },
    { key: "rate", label: "Tingkat lunas", value: "88%", delta: "+1%", trend: "up", hint: "Dari 421 transaksi bulan ini" },
  ],
};

export function getSummary(): Record<Period, SummaryCard[]> {
  return SUMMARY;
}

export function getStatusCounts(): { status: TransactionStatus; count: number }[] {
  return [
    { status: "PENDING", count: 3 },
    { status: "PAID", count: 96 },
    { status: "EXPIRED", count: 11 },
    { status: "LATE_PAID", count: 1 },
  ];
}

export function getListener(): ListenerStatus {
  return { name: "HP Listener 1", online: true, lastHeartbeat: "12 detik lalu", battery: "100% · mengisi", queued: 0 };
}

export function getRecentPayments(): RecentPayment[] {
  return [
    { id: "01JC8P2K2M9X", projectName: "Toko Digital", amount: 125_412, note: "Lunas otomatis · 9 menit lalu" },
    { id: "01JC8K9P1RWC", projectName: "KursusKu", amount: 35_112, note: "Bayar telat · menunggu keputusan" },
    { id: "01JC8H3Z6TBD", projectName: "AppLangganan", amount: 99_731, note: "Lunas otomatis · 1 jam lalu" },
    { id: "01JC8B1W3LEG", projectName: "Toko Digital", amount: 210_968, note: "Dikonfirmasi manual · 3 jam lalu" },
  ];
}

export function getMonthlyRevenue(): MonthlyRevenue[] {
  const values = [9.0, 10.5, 12.0, 9.8, 10.0, 11.6, 11.2, 13.5, 12.4, 15.8, 14.1, 16.3];
  const labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return values.map((v, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    label: labels[i],
    amount: Math.round(v * 1_000_000),
  }));
}

export function getParserAlerts(): number {
  return 3;
}
