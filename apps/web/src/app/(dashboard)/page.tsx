import Link from "next/link";
import { Radio } from "lucide-react";
import { ParserBanner } from "@/components/dashboard/parser-banner";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { Card, PageHeader, SectionHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRupiah } from "@/lib/format";
import {
  getListener,
  getMonthlyRevenue,
  getParserAlerts,
  getRecentPayments,
  getStatusCounts,
  getSummary,
} from "@/lib/mock-data";
import { STATUS_LABEL } from "@/lib/types";

export default function HomePage() {
  const listener = getListener();

  return (
    <>
      <PageHeader title="Halo, Muzakie!" description="Ringkasan pembayaran dari semua proyek." />
      <ParserBanner count={getParserAlerts()} />

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
          <SummaryCards data={getSummary()} />
          <RevenueChart data={getMonthlyRevenue()} />
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionHeader title="Status listener" href="/perangkat" linkLabel="Lihat perangkat" />
            <Card className="flex flex-col gap-3.5 px-[18px] py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-line">
                  <Radio className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium">{listener.name}</span>
                  <span className={cn("inline-flex items-center gap-1.5 text-[13px]", listener.online ? "text-ok" : "text-bad")}>
                    <span className={cn("size-2 rounded-full", listener.online ? "bg-ok-dot" : "bg-bad")} aria-hidden />
                    {listener.online ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
              <dl className="flex flex-col border-t border-line-soft">
                {[
                  ["Heartbeat terakhir", listener.lastHeartbeat],
                  ["Baterai", listener.battery],
                  ["Antrian belum terkirim", String(listener.queued)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-line-soft py-2.5 last:border-b-0">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Status transaksi" href="/transaksi" />
            <Card className="px-[18px] py-1.5">
              <dl>
                {getStatusCounts().map(({ status, count }) => (
                  <div key={status} className="flex items-center justify-between border-b border-line-soft py-3 last:border-b-0">
                    <dt>{STATUS_LABEL[status]}</dt>
                    <dd className={cn("text-xl font-medium tabular-nums", status === "LATE_PAID" && count > 0 && "text-warn-icon")}>
                      {count}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Pembayaran terbaru" href="/transaksi" />
            <Card className="px-[18px] py-1">
              <ul>
                {getRecentPayments().map((p) => (
                  <li key={p.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-subtle text-[13px] font-semibold text-ink-2">
                      {p.projectName.charAt(0)}
                    </span>
                    <Link href={`/pay/${p.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 hover:underline">
                      <span>
                        <strong className="font-medium">{formatRupiah(p.amount)}</strong> · {p.projectName}
                      </span>
                      <span className="text-xs text-faint">{p.note}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
