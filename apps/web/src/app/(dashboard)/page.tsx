import Link from "next/link";
import { Radio } from "lucide-react";
import { ParserBanner } from "@/components/dashboard/parser-banner";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { StatusBadge } from "@/components/status-badge";
import { Card, PageHeader, SectionHeader } from "@/components/ui";
import { getDashboard } from "@/lib/api";
import { cn } from "@/lib/cn";
import { allSummaryCards, timeAgo } from "@/lib/dashboard";
import { formatRupiah } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const d = await getDashboard();
  const device = d.listener.devices.find((x) => x.online) ?? d.listener.devices[0];

  return (
    <>
      <PageHeader title="Halo, Muzakie!" description="Ringkasan pembayaran dari semua proyek." />
      <ParserBanner count={d.unparsed_events} />

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
          <SummaryCards data={allSummaryCards(d)} />
          <RevenueChart data={d.monthly_revenue} />
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SectionHeader title="Status listener" href="/perangkat" linkLabel="Lihat perangkat" />
            <Card className="flex flex-col gap-3.5 px-[18px] py-4">
              {device ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl border border-line">
                      <Radio className="size-[18px]" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="font-medium">{device.name}</span>
                      <span className={cn("inline-flex items-center gap-1.5 text-[13px]", device.online ? "text-ok" : "text-bad")}>
                        <span className={cn("size-2 rounded-full", device.online ? "bg-ok-dot" : "bg-bad")} aria-hidden />
                        {device.online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                  <dl className="flex flex-col border-t border-line-soft">
                    {[
                      ["Heartbeat terakhir", timeAgo(device.last_heartbeat_at, d.server_time)],
                      [
                        "Baterai",
                        device.battery === null ? "–" : `${device.battery}%${device.charging ? " · mengisi" : " · tidak mengisi"}`,
                      ],
                      ["Antrian belum terkirim", device.queued === null ? "–" : String(device.queued)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-line-soft py-2.5 last:border-b-0">
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className="py-2 text-faint">
                  Belum ada HP listener. Buat token pairing lalu pasangkan aplikasi listener di HP.
                </p>
              )}
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Status transaksi" href="/transaksi" />
            <Card className="px-[18px] py-1.5">
              <dl>
                {d.status_counts.map(({ status, count }) => (
                  <div key={status} className="flex items-center justify-between border-b border-line-soft py-3 last:border-b-0">
                    <dt>{STATUS_LABEL[status]}</dt>
                    <dd className={cn("text-xl font-medium tabular-nums", status === "LATE_PAID" && count > 0 && "text-warn-icon")}>
                      {count}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
            <p className="px-1 text-xs text-faint">Tagihan yang dibuat 7 hari terakhir.</p>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeader title="Pembayaran terbaru" href="/transaksi?status=PAID" />
            <Card className="px-[18px] py-1">
              {d.recent_payments.length === 0 ? (
                <p className="py-3.5 text-faint">Belum ada pembayaran yang masuk.</p>
              ) : (
                <ul>
                  {d.recent_payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-subtle text-[13px] font-semibold text-ink-2">
                        {p.project_name.charAt(0).toUpperCase()}
                      </span>
                      <Link href={`/transaksi?q=${p.id}`} className="flex min-w-0 flex-1 flex-col gap-0.5 hover:underline">
                        <span>
                          <strong className="font-medium">{formatRupiah(p.amount)}</strong> · {p.project_name}
                        </span>
                        <span className="text-xs text-faint">
                          {p.manual ? "Dikonfirmasi manual" : p.status === "LATE_PAID" ? "Bayar telat" : "Lunas otomatis"} ·{" "}
                          {timeAgo(p.paid_at, d.server_time)}
                        </span>
                      </Link>
                      {p.status === "LATE_PAID" && <StatusBadge status={p.status} />}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
