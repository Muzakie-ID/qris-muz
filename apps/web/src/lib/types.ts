/** Status transaksi sesuai PRD. Kode ini dipakai di API; label Indonesia hanya untuk UI. */
export type TransactionStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "LATE_PAID";

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  PENDING: "Menunggu",
  PAID: "Lunas",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  LATE_PAID: "Bayar telat",
};

export type Period = "day" | "week" | "month";

export interface SummaryCard {
  key: "income" | "paid" | "pending" | "rate";
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  hint: string;
}

export interface MonthlyRevenue {
  month: string;
  label: string;
  amount: number;
}
