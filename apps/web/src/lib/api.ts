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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", admin: true, body: body === undefined ? undefined : JSON.stringify(body) });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", admin: true, body: JSON.stringify(body) });
}

function query(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

const id = (v: string) => encodeURIComponent(v);

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

export interface Paged<T, C extends string = string> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  counts: Record<C, number>;
}

// --- Proyek & API key ---

export interface Project {
  id: string;
  name: string;
  webhook_url: string | null;
  default_return_url: string | null;
  default_qris_source_id: string | null;
  default_expiry_min: number;
  created_at: string;
}

export interface ApiKey {
  id: string;
  prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ProjectInput {
  name?: string;
  webhook_url?: string | null;
  default_return_url?: string | null;
  default_qris_source_id?: string | null;
  default_expiry_min?: number;
}

export const listProjects = () => request<Project[]>("/admin/projects", { admin: true });
export const listApiKeys = (projectId: string) =>
  request<ApiKey[]>(`/admin/projects/${id(projectId)}/api-keys`, { admin: true });
export const createProject = (input: ProjectInput) => post<Project & { webhook_secret: string }>("/admin/projects", input);
export const updateProject = (projectId: string, input: ProjectInput) =>
  patch<Project>(`/admin/projects/${id(projectId)}`, input);
export const createApiKey = (projectId: string) =>
  post<{ id: string; prefix: string; api_key: string }>(`/admin/projects/${id(projectId)}/api-keys`);
export const revokeApiKey = (keyId: string) => post<void>(`/admin/api-keys/${id(keyId)}/revoke`);

// --- Perangkat ---

export type DeviceCommand = "rescan" | "refresh_config" | "flush_queue";

export interface Device {
  id: string;
  name: string;
  last_heartbeat_at: string | null;
  listener_ok: boolean | null;
  battery: number | null;
  charging: boolean | null;
  queued: number | null;
  source_app_versions: Record<string, string> | null;
  clock_skew_ms: number | null;
  app_version: string | null;
  last_crash: string | null;
  last_crash_at: string | null;
  pending_commands: DeviceCommand[];
  revoked_at: string | null;
  created_at: string;
}

export interface DeviceList {
  status: { listener_online: boolean; devices: ListenerDevice[]; server_time: string };
  devices: Device[];
}

export interface PairingToken {
  token: string;
  expires_at: string;
  pairing_uri: string;
}

export const listDevices = () => request<DeviceList>("/admin/devices", { admin: true });
export const createPairingToken = (deviceName: string) =>
  post<PairingToken>("/admin/devices/pairing-tokens", { device_name: deviceName });
export const sendDeviceCommand = (deviceId: string, command: DeviceCommand) =>
  post<{ pending_commands: DeviceCommand[] }>(`/admin/devices/${id(deviceId)}/commands`, { command });
export const revokeDevice = (deviceId: string) => post<void>(`/admin/devices/${id(deviceId)}/revoke`);

// --- QRIS ---

export interface QrisSource {
  id: string;
  label: string;
  merchant_name: string;
  nmid: string | null;
  source_package: string | null;
  is_active: boolean;
  created_at: string;
}

export const listQrisSources = () => request<QrisSource[]>("/admin/qris-sources", { admin: true });
export const createQrisSource = (input: { label: string; payload: string; source_package?: string }) =>
  post<QrisSource>("/admin/qris-sources", input);
export const updateQrisSource = (
  qrisId: string,
  input: { label?: string; source_package?: string | null; is_active?: boolean },
) => patch<QrisSource>(`/admin/qris-sources/${id(qrisId)}`, input);

// --- Parser ---

export interface Parser {
  id: string;
  package_name: string | null;
  pattern: string;
  priority: number;
  auto_match: boolean;
  is_active: boolean;
  updated_at: string;
}

export interface ParserInput {
  package_name?: string | null;
  pattern?: string;
  priority?: number;
  auto_match?: boolean;
  is_active?: boolean;
}

export interface ParserTestResult {
  matched: boolean;
  amount: number | null;
  parser_id: string | null;
  auto_match: boolean | null;
}

export const listParsers = () => request<Parser[]>("/admin/parsers", { admin: true });
export const createParser = (input: ParserInput & { pattern: string }) => post<Parser>("/admin/parsers", input);
export const updateParser = (parserId: string, input: ParserInput) => patch<Parser>(`/admin/parsers/${id(parserId)}`, input);
export const testParser = (input: { package_name?: string; text: string; pattern?: string }) =>
  post<ParserTestResult>("/admin/parsers/test", input);

// --- Log webhook ---

export type DeliveryStatus = "PENDING" | "DELIVERED" | "FAILED";

export interface WebhookDelivery {
  id: string;
  event_id: string;
  event_type: string;
  project_name: string;
  webhook_url: string | null;
  transaction_id: string;
  merchant_ref: string;
  status: DeliveryStatus;
  attempt: number;
  last_status_code: number | null;
  last_error: string | null;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export const listWebhookDeliveries = (params: { status?: DeliveryStatus; page?: number }) =>
  request<Paged<WebhookDelivery, "ALL" | DeliveryStatus>>(`/admin/webhook-deliveries${query(params)}`, { admin: true });
export const retryWebhookDelivery = (deliveryId: string) => post<void>(`/admin/webhook-deliveries/${id(deliveryId)}/retry`);

// --- Mutasi masuk ---

export type MatchStatus = "PENDING" | "MATCHED" | "LATE_MATCHED" | "UNMATCHED" | "NOT_APPLICABLE";
export type ParseStatus = "PARSED" | "UNPARSED" | "IGNORED";

export interface PaymentEvent {
  id: string;
  package_name: string;
  title: string | null;
  text: string | null;
  device_name: string | null;
  is_test: boolean;
  parse_status: ParseStatus;
  parsed_amount: number | null;
  parser_id: string | null;
  qris_label: string | null;
  match_status: MatchStatus;
  transaction_id: string | null;
  merchant_ref: string | null;
  posted_at: string;
  created_at: string;
}

export const listPaymentEvents = (params: { parse_status?: ParseStatus; match_status?: MatchStatus; page?: number }) =>
  request<Paged<PaymentEvent>>(`/admin/payment-events${query(params)}`, { admin: true });
export const reprocessEvents = () => post<{ processed: number; matched: number }>("/admin/events/reprocess");
