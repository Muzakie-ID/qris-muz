import type { DashboardData, PeriodSummary } from "./api";
import { formatRupiah } from "./format";
import type { Period, SummaryCard } from "./types";

const PREV_LABEL: Record<Period, string> = {
  day: "24 jam sebelumnya",
  week: "7 hari sebelumnya",
  month: "30 hari sebelumnya",
};
const SCOPE_LABEL: Record<Period, string> = {
  day: "24 jam terakhir",
  week: "7 hari terakhir",
  month: "30 hari terakhir",
};

function pctChange(cur: number, prev: number): Pick<SummaryCard, "delta" | "trend"> {
  if (prev === 0) return cur === 0 ? { delta: "0%", trend: "neutral" } : { delta: "baru", trend: "up" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { delta: `${pct > 0 ? "+" : ""}${pct}%`, trend: pct > 0 ? "up" : pct < 0 ? "down" : "neutral" };
}

function rate(paid: number, created: number): number | null {
  return created === 0 ? null : Math.round((paid / created) * 100);
}

/** Kartu ringkasan dari angka mentah backend. */
export function summaryCards(s: PeriodSummary, period: Period, pending: DashboardData["pending"]): SummaryCard[] {
  const cur = rate(s.created_paid, s.created);
  const prev = rate(s.created_paid_prev, s.created_prev);
  const rateDelta = cur === null || prev === null ? null : cur - prev;
  return [
    {
      key: "income",
      label: "Uang masuk",
      value: formatRupiah(s.income),
      ...pctChange(s.income, s.income_prev),
      hint: `${PREV_LABEL[period]}: ${formatRupiah(s.income_prev)}`,
    },
    {
      key: "paid",
      label: "Transaksi lunas",
      value: String(s.paid),
      ...pctChange(s.paid, s.paid_prev),
      hint: s.manual > 0 ? `${s.manual} dikonfirmasi manual` : "Semua terkonfirmasi otomatis",
    },
    {
      key: "pending",
      label: "Menunggu bayar",
      value: String(pending.total),
      delta: "saat ini",
      trend: "neutral",
      hint:
        pending.expiring_soon > 0
          ? `${pending.expiring_soon} kedaluwarsa dalam 15 menit`
          : "Tidak ada yang segera kedaluwarsa",
    },
    {
      key: "rate",
      label: "Tingkat lunas",
      value: cur === null ? "–" : `${cur}%`,
      delta: rateDelta === null ? "–" : `${rateDelta > 0 ? "+" : ""}${rateDelta} poin`,
      trend: rateDelta === null || rateDelta === 0 ? "neutral" : rateDelta > 0 ? "up" : "down",
      hint: `Dari ${s.created} tagihan, ${SCOPE_LABEL[period]}`,
    },
  ];
}

export function allSummaryCards(d: DashboardData): Record<Period, SummaryCard[]> {
  return {
    day: summaryCards(d.summary.day, "day", d.pending),
    week: summaryCards(d.summary.week, "week", d.pending),
    month: summaryCards(d.summary.month, "month", d.pending),
  };
}

/** "12 detik lalu", "3 menit lalu", ... */
export function timeAgo(iso: string | null, nowIso: string): string {
  if (!iso) return "belum pernah";
  const s = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} detik lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}
