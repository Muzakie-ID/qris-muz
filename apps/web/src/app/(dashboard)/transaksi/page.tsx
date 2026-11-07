import type { Metadata } from "next";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { PageHeader } from "@/components/ui";
import { formatRupiah } from "@/lib/format";
import { getTransactions } from "@/lib/mock-data";
import type { TransactionStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Transaksi" };

export default function TransactionsPage() {
  const transactions = getTransactions();
  const sum = (status: TransactionStatus) =>
    transactions.filter((t) => t.status === status).reduce((total, t) => total + t.finalAmount, 0);

  const stats = [
    { label: "Lunas", value: sum("PAID"), icon: CircleCheck, tone: "text-ok" },
    { label: "Menunggu bayar", value: sum("PENDING"), icon: Clock, tone: "text-ink" },
    { label: "Perlu keputusan (bayar telat)", value: sum("LATE_PAID"), icon: TriangleAlert, tone: "text-warn-icon" },
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

      <TransactionsTable transactions={transactions} />
    </>
  );
}
