/**
 * Klien backend untuk kode yang berjalan di server Next.js (server component, server action).
 * ADMIN_TOKEN hanya dibaca di sini dan tidak pernah dikirim ke browser.
 */
import { cache } from "react";
import type { TransactionStatus } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function apiUrl(): string {
  return (process.env.API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}

/** Alamat API yang dibuka langsung oleh browser (SSE, gambar QR). */
export function publicApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}

async function request<T>(path: string, init: RequestInit & { admin?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.admin) {
    const token = process.env.ADMIN_TOKEN;
    if (!token) throw new ApiError(500, "ADMIN_TOKEN belum disetel di web.");
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(apiUrl() + path, { ...init, headers, cache: "no-store" });
  } catch (e) {
    throw new ApiError(503, `Backend tidak bisa dihubungi (${(e as Error).message}).`);
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join("; ") : body.message;
    } catch {
      // badan respons bukan JSON
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

// --- Checkout (publik) ---

export interface CheckoutData {
  id: string;
  project_name: string;
  merchant_ref: string;
  merchant_name: string;
  nmid: string | null;
  final_amount: number;
  unique_code: number;
  status: TransactionStatus;
  qris_payload: string | null;
  expires_at: string;
  paid_at: string | null;
  return_url: string | null;
  server_time: string;
}

/** null bila tagihan tidak ada. */
export async function getCheckout(id: string): Promise<CheckoutData | null> {
  try {
    return await request<CheckoutData>(`/public/checkout/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// --- Admin (dashboard) ---

export interface PeriodSummary {
  income: number;
  income_prev: number;
  paid: number;
  paid_prev: number;
  manual: number;
  created: number;
  created_paid: number;
  created_prev: number;
  created_paid_prev: number;
}

export interface ListenerDevice {
  id: string;
  name: string;
  online: boolean;
  last_heartbeat_at: string | null;
  battery: number | null;
  charging: boolean | null;
  queued: number | null;
  app_version: string | null;
}

export interface DashboardData {
  summary: Record<"day" | "week" | "month", PeriodSummary>;
  pending: { total: number; expiring_soon: number };
  status_counts: { status: TransactionStatus; count: number }[];
  recent_payments: { id: string; project_name: string; amount: number; status: TransactionStatus; paid_at: string; manual: boolean }[];
  monthly_revenue: { month: string; label: string; amount: number }[];
  listener: { listener_online: boolean; devices: ListenerDevice[] };
  unparsed_events: number;
  unmatched_events: number;
  server_time: string;
}

/** Satu kali per request walau dipanggil layout dan halaman sekaligus. */
export const getDashboard = cache(
  (): Promise<DashboardData> => request<DashboardData>("/admin/dashboard", { admin: true }),
);

export interface AdminTransaction {
  id: string;
  project_id: string;
  project_name: string;
  merchant_ref: string;
  amount: number;
  unique_code: number;
  final_amount: number;
  status: TransactionStatus;
  qris_label: string;
  created_at: string;
  paid_at: string | null;
  manual_note: string | null;
}

export interface TransactionList {
  items: AdminTransaction[];
  total: number;
  page: number;
  per_page: number;
  counts: Record<"ALL" | TransactionStatus, number>;
  sums: Record<TransactionStatus, number>;
}

export function listTransactions(params: { status?: string; q?: string; page?: number }): Promise<TransactionList> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  return request<TransactionList>(`/admin/transactions?${qs.toString()}`, { admin: true });
}

export function createTestTransaction(amount: number): Promise<{ id: string }> {
  return request<{ id: string }>("/admin/transactions/test", {
    method: "POST",
    admin: true,
    body: JSON.stringify({ amount }),
  });
}
