import type { Metadata } from "next";
import Link from "next/link";
import { retryWebhookAction } from "@/app/admin-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EmptyState, FilterTabs, Pager, Pill, hrefWith } from "@/components/admin/list-controls";
import { PageHeader } from "@/components/ui";
import { listWebhookDeliveries, type DeliveryStatus, type WebhookDelivery } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { btnSecondary } from "@/lib/styles";

export const metadata: Metadata = { title: "Log webhook" };
export const dynamic = "force-dynamic";

const STATUSES: DeliveryStatus[] = ["PENDING", "DELIVERED", "FAILED"];
const LABEL: Record<"ALL" | DeliveryStatus, string> = {
  ALL: "Semua",
  PENDING: "Antri / mencoba ulang",
  DELIVERED: "Terkirim",
  FAILED: "Gagal",
};
const EVENT_LABEL: Record<string, string> = {
  "transaction.paid": "Lunas",
  "transaction.expired": "Kedaluwarsa",
  "transaction.late_paid": "Bayar telat",
};

export default async function WebhookPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as DeliveryStatus) ? (sp.status as DeliveryStatus) : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await listWebhookDeliveries({ status, page });
  const href = (s: string | undefined, p?: number) => hrefWith("/webhook", { status: s, page: p });

  return (
    <>
      <PageHeader
        title="Log webhook"
        description="Setiap perubahan status tagihan dikirim ke URL webhook proyek. Yang gagal dicoba ulang hingga 8 kali dalam ±24 jam."
        action={null}
      />

      <FilterTabs
        label="Filter status"
        current={status ?? "ALL"}
        items={(["ALL", ...STATUSES] as const).map((s) => ({
          value: s,
          label: LABEL[s],
          count: data.counts[s] ?? 0,
          href: href(s === "ALL" ? undefined : s),
        }))}
      />

      <div className="relative overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#fafaf9] text-left text-muted">
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Event</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Tagihan</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Status</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Coba</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Respons terakhir</th>
              <th scope="col" className="border-b border-line px-[18px] py-3"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((d) => (
              <Row key={d.id} d={d} />
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && (
          <EmptyState title={status ? "Tidak ada pengiriman dengan status ini." : "Belum ada webhook yang dikirim."}>
            {status ? "Coba pilih status lain." : "Webhook dibuat saat tagihan lunas, kedaluwarsa, atau dibayar telat."}
          </EmptyState>
        )}
      </div>

      <Pager page={data.page} perPage={data.per_page} total={data.total} noun="pengiriman" hrefFor={(p) => href(status, p)} />
    </>
  );
}

function Row({ d }: { d: WebhookDelivery }) {
  const cell = "border-b border-line-soft px-[18px] py-3 align-top";
  return (
    <tr className="hover:bg-[#fafaf9]">
      <td className={cell}>
        <span className="font-medium">{EVENT_LABEL[d.event_type] ?? d.event_type}</span>
        <span className="block whitespace-nowrap text-xs text-faint">{formatDateTime(d.created_at)}</span>
        <span className="block font-mono text-[11px] text-faint" title="X-Event-Id">
          {d.event_id}
        </span>
      </td>
      <td className={cell}>
        <Link href={`/transaksi?q=${encodeURIComponent(d.transaction_id)}`} className="whitespace-nowrap font-medium hover:underline">
          {d.merchant_ref}
        </Link>
        <span className="block text-xs text-muted">{d.project_name}</span>
        <span className="block max-w-[220px] truncate text-xs text-faint" title={d.webhook_url ?? undefined}>
          {d.webhook_url ?? "Tanpa URL webhook"}
        </span>
      </td>
      <td className={cell}>
        {d.status === "DELIVERED" ? (
          <Pill tone="ok">Terkirim</Pill>
        ) : d.status === "FAILED" ? (
          <Pill tone="bad">Gagal</Pill>
        ) : (
          <Pill tone="neutral">{d.attempt === 0 ? "Antri" : "Mencoba ulang"}</Pill>
        )}
        {d.status === "PENDING" && d.next_retry_at && (
          <span className="mt-1 block whitespace-nowrap text-xs text-faint">berikutnya {formatDateTime(d.next_retry_at)}</span>
        )}
        {d.status === "DELIVERED" && d.delivered_at && (
          <span className="mt-1 block whitespace-nowrap text-xs text-faint">{formatDateTime(d.delivered_at)}</span>
        )}
      </td>
      <td className={`${cell} whitespace-nowrap tabular-nums`}>{d.attempt} / 8</td>
      <td className={`${cell} min-w-[170px] max-w-[240px]`}>
        {d.last_status_code !== null && <span className="font-mono text-xs">HTTP {d.last_status_code}</span>}
        {d.last_error && <span className="block break-words text-xs text-bad">{d.last_error}</span>}
        {d.last_status_code === null && !d.last_error && <span className="text-faint">–</span>}
      </td>
      <td className={`${cell} text-right`}>
        <ActionForm action={retryWebhookAction} className="flex flex-col items-end gap-1">
          <input type="hidden" name="delivery_id" value={d.id} />
          <SubmitButton className={`${btnSecondary} whitespace-nowrap`} pendingLabel="Menjadwalkan…">
            Kirim ulang
          </SubmitButton>
        </ActionForm>
      </td>
    </tr>
  );
}
