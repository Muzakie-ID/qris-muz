/** Status transaksi sesuai PRD. Kode ini dipakai di API; label Indonesia hanya untuk UI. */
export type TransactionStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | "LATE_PAID";

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  PENDING: "Menunggu",
  PAID: "Lunas",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  LATE_PAID: "Bayar telat",
};

export interface Project {
  id: string;
  name: string;
  defaultReturnUrl: string;
}

export interface Transaction {
  id: string;
  projectId: string;
  projectName: string;
  merchantRef: string;
  baseAmount: number;
  uniqueCode: number;
  finalAmount: number;
  qrisPayload: string;
  status: TransactionStatus;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  returnUrl: string | null;
  merchantName: string;
  nmid: string;
}

export type Period = "day" | "week" | "month";

export interface SummaryCard {
  key: "income" | "paid" | "pending" | "rate";
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  hint: string;
}

export interface ListenerStatus {
  name: string;
  online: boolean;
  lastHeartbeat: string;
  battery: string;
  queued: number;
}

export interface RecentPayment {
  id: string;
  projectName: string;
  amount: number;
  note: string;
}

export interface MonthlyRevenue {
  month: string;
  label: string;
  amount: number;
}
