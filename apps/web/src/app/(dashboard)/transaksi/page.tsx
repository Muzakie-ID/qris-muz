import type { Metadata } from "next";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { PageHeader } from "@/components/ui";
import { listTransactions } from "@/lib/api";
import { formatRupiah } from "@/lib/format";
import type { TransactionStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Transaksi" };
export const dynamic = "force-dynamic";

const STATUSES: TransactionStatus[] = ["PENDING", "PAID", "EXPIRED", "CANCELLED", "LATE_PAID"];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as TransactionStatus) ? (sp.status as TransactionStatus) : undefined;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await listTransactions({ status, q: q || undefined, page });

  const stats = [
    { label: "Lunas", value: data.sums.PAID, icon: CircleCheck, tone: "text-ok" },
    { label: "Menunggu bayar", value: data.sums.PENDING, icon: Clock, tone: "text-ink" },
    { label: "Perlu keputusan (bayar telat)", value: data.sums.LATE_PAID, icon: TriangleAlert, tone: "text-warn-icon" },
  ];

  return (
    <>
      <PageHeader title="Transaksi" description="Semua tagihan yang dibuat proyek lewat API." />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex min-w-0 flex-col gap-1.5 bg-surface px-5 py-4">
            <span className="inline-flex items-center gap-2 text-muted">
              <Icon className={`size-4 ${tone}`} strokeWidth={1.75} aria-hidden />
              {label}
            </span>
            <span className="text-[22px] font-medium tracking-[-0.02em] tabular-nums">{formatRupiah(value)}</span>
          </div>
        ))}
      </div>

      <TransactionsTable data={data} status={status ?? "ALL"} q={q} />
    </>
  );
}
