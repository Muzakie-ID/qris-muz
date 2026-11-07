"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Funnel, Search } from "lucide-react";
import { Segmented } from "@/components/segmented";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatRupiah } from "@/lib/format";
import type { Transaction, TransactionStatus } from "@/lib/types";

type Filter = "ALL" | TransactionStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "PENDING", label: "Menunggu" },
  { value: "PAID", label: "Lunas" },
  { value: "LATE_PAID", label: "Bayar telat" },
  { value: "EXPIRED", label: "Kedaluwarsa" },
];

function shortId(id: string) {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[.\s]/g, "");
    return transactions.filter((t) => {
      if (filter !== "ALL" && t.status !== filter) return false;
      if (!q) return true;
      return t.merchantRef.toLowerCase().includes(q) || String(t.finalAmount).includes(q.replace(/^rp/, ""));
    });
  }, [transactions, filter, query]);

  const options = FILTERS.map((f) => ({
    ...f,
    count: f.value === "ALL" ? transactions.length : transactions.filter((t) => t.status === f.value).length,
  }));

  return (
    <section className="flex flex-col gap-3.5" aria-label="Daftar transaksi">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filter status" options={options} value={filter} onChange={setFilter} />
        <div className="flex flex-wrap gap-2">
          <label className="flex h-10 min-w-[240px] items-center gap-2 rounded-xl border border-line px-3 text-faint">
            <Search className="size-4" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari ref order atau nominal"
              aria-label="Cari ref order atau nominal"
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
            />
          </label>
          <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-[13px]">
            <Funnel className="size-[15px]" strokeWidth={1.75} aria-hidden />
            Proyek: semua
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#fafaf9] text-left text-muted">
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">ID</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Ref order</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Proyek</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 text-right font-medium">Nominal</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 text-right font-medium">Kode unik</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Status</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-[#fafaf9]">
                <td className="border-b border-line-soft px-[18px] py-3.5 font-mono text-xs text-muted">
                  <Link href={`/pay/${t.id}`} className="hover:underline" title={t.id}>
                    {shortId(t.id)}
                  </Link>
                </td>
                <td className="border-b border-line-soft px-[18px] py-3.5 font-medium">{t.merchantRef}</td>
                <td className="border-b border-line-soft px-[18px] py-3.5">{t.projectName}</td>
                <td className="border-b border-line-soft px-[18px] py-3.5 text-right font-medium tabular-nums">{formatRupiah(t.finalAmount)}</td>
                <td className="border-b border-line-soft px-[18px] py-3.5 text-right font-mono text-xs">{String(t.uniqueCode).padStart(3, "0")}</td>
                <td className="border-b border-line-soft px-[18px] py-3.5"><StatusBadge status={t.status} /></td>
                <td className="whitespace-nowrap border-b border-line-soft px-[18px] py-3.5 text-muted">{formatDateTime(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <p className="font-medium">Tidak ada transaksi yang cocok.</p>
            <p className="text-faint">Coba pilih status lain atau ubah kata kunci pencarian.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <span>
          Menampilkan {rows.length} dari {transactions.length} transaksi
        </span>
        <nav aria-label="Halaman" className="flex items-center gap-1">
          <button type="button" disabled aria-label="Halaman sebelumnya" className="flex size-9 items-center justify-center rounded-full text-faint disabled:opacity-50">
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
          <span aria-current="page" className="flex size-9 items-center justify-center rounded-full bg-ink font-medium text-white">1</span>
          <button type="button" disabled aria-label="Halaman berikutnya" className="flex size-9 items-center justify-center rounded-full text-faint disabled:opacity-50">
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </nav>
      </div>
    </section>
  );
}
