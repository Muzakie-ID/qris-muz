import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { TransactionList } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { TransactionStatus } from "@/lib/types";

type Filter = "ALL" | TransactionStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "PENDING", label: "Menunggu" },
  { value: "PAID", label: "Lunas" },
  { value: "LATE_PAID", label: "Bayar telat" },
  { value: "EXPIRED", label: "Kedaluwarsa" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

function shortId(id: string) {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function href(params: { status?: string; q?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params.status && params.status !== "ALL") qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const s = qs.toString();
  return s ? `/transaksi?${s}` : "/transaksi";
}

/** Tabel transaksi; filter, pencarian, dan halaman dikerjakan backend lewat URL. */
export function TransactionsTable({ data, status, q }: { data: TransactionList; status: Filter; q: string }) {
  const pages = Math.max(1, Math.ceil(data.total / data.per_page));
  const from = data.total === 0 ? 0 : (data.page - 1) * data.per_page + 1;
  const to = Math.min(data.total, data.page * data.per_page);

  return (
    <section className="flex flex-col gap-3.5" aria-label="Daftar transaksi">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter status" className="inline-flex flex-wrap gap-0.5 rounded-xl bg-subtle p-1">
          {FILTERS.map((f) => {
            const on = f.value === status;
            return (
              <Link
                key={f.value}
                href={href({ status: f.value, q })}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-[34px] items-center rounded-[9px] border px-3.5 text-[13px] transition-colors",
                  on
                    ? "border-line bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {f.label}
                <span className="ml-1 font-normal text-faint">{data.counts[f.value] ?? 0}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/transaksi" className="flex flex-wrap gap-2" role="search">
          {status !== "ALL" && <input type="hidden" name="status" value={status} />}
          <label className="flex h-10 min-w-[260px] items-center gap-2 rounded-xl border border-line px-3 text-faint">
            <Search className="size-4" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Cari ref order, nominal, atau ID"
              aria-label="Cari ref order, nominal, atau ID"
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
            />
          </label>
          <button type="submit" className="h-10 rounded-xl border border-line bg-surface px-3.5 text-[13px] hover:border-[#cfcfcb]">
            Cari
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[920px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#fafaf9] text-left text-muted">
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">ID</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Ref order</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Proyek</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">QRIS</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 text-right font-medium">Nominal</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 text-right font-medium">Kode unik</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Status</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id} className="hover:bg-[#fafaf9]">
                <td className="border-b border-line-soft px-[18px] py-3.5 font-mono text-xs text-muted">
                  <Link href={`/pay/${t.id}`} className="hover:underline" title={`${t.id} (buka halaman bayar)`}>
                    {shortId(t.id)}
                  </Link>
                </td>
                <td className="border-b border-line-soft px-[18px] py-3.5 font-medium">
                  {t.merchant_ref}
                  {t.manual_note && <span className="block text-xs font-normal text-faint">Manual: {t.manual_note}</span>}
                </td>
                <td className="border-b border-line-soft px-[18px] py-3.5">{t.project_name}</td>
                <td className="border-b border-line-soft px-[18px] py-3.5 text-muted">{t.qris_label}</td>
                <td className="border-b border-line-soft px-[18px] py-3.5 text-right font-medium tabular-nums">{formatRupiah(t.final_amount)}</td>
                <td className="border-b border-line-soft px-[18px] py-3.5 text-right font-mono text-xs">{String(t.unique_code).padStart(3, "0")}</td>
                <td className="border-b border-line-soft px-[18px] py-3.5"><StatusBadge status={t.status} /></td>
                <td className="whitespace-nowrap border-b border-line-soft px-[18px] py-3.5 text-muted">{formatDateTime(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <p className="font-medium">{q || status !== "ALL" ? "Tidak ada transaksi yang cocok." : "Belum ada transaksi."}</p>
            <p className="text-faint">
              {q || status !== "ALL"
                ? "Coba pilih status lain atau ubah kata kunci pencarian."
                : "Tagihan yang dibuat proyek lewat API akan muncul di sini."}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>
          {data.total === 0 ? "0 transaksi" : `Menampilkan ${from}–${to} dari ${data.total} transaksi`}
        </span>
        <nav aria-label="Halaman" className="flex items-center gap-1">
          {data.page > 1 ? (
            <Link href={href({ status, q, page: data.page - 1 })} aria-label="Halaman sebelumnya" className="flex size-9 items-center justify-center rounded-full hover:bg-subtle">
              <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full text-faint opacity-50" aria-hidden>
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </span>
          )}
          <span aria-current="page" className="flex h-9 min-w-9 items-center justify-center rounded-full bg-ink px-3 font-medium text-white">
            {data.page} / {pages}
          </span>
          {data.page < pages ? (
            <Link href={href({ status, q, page: data.page + 1 })} aria-label="Halaman berikutnya" className="flex size-9 items-center justify-center rounded-full hover:bg-subtle">
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full text-faint opacity-50" aria-hidden>
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </span>
          )}
        </nav>
      </div>
    </section>
  );
}
