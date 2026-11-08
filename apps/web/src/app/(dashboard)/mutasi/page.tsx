import type { Metadata } from "next";
import Link from "next/link";
import { reprocessEventsAction } from "@/app/admin-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EmptyState, FilterTabs, Pager, Pill, hrefWith } from "@/components/admin/list-controls";
import { PageHeader } from "@/components/ui";
import { listPaymentEvents, type MatchStatus, type PaymentEvent } from "@/lib/api";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { btnPrimary } from "@/lib/styles";

export const metadata: Metadata = { title: "Mutasi masuk" };
export const dynamic = "force-dynamic";

/** Filter di URL; UNPARSED memakai parse_status, sisanya match_status. */
const FILTERS = [
  { value: "ALL", label: "Semua" },
  { value: "MATCHED", label: "Cocok" },
  { value: "LATE_MATCHED", label: "Bayar telat" },
  { value: "UNMATCHED", label: "Tidak cocok" },
  { value: "UNPARSED", label: "Tak terbaca" },
  { value: "NOT_APPLICABLE", label: "Diabaikan" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

export default async function MutationsPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.value === sp.filter) ? (sp.filter as Filter) : "ALL";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const data = await listPaymentEvents({
    page,
    ...(filter === "UNPARSED"
      ? { parse_status: "UNPARSED" as const }
      : filter !== "ALL"
        ? { match_status: filter as MatchStatus }
        : {}),
  });
  const href = (f: Filter, p?: number) => hrefWith("/mutasi", { filter: f === "ALL" ? undefined : f, page: p });

  return (
    <>
      <PageHeader
        title="Mutasi masuk"
        description="Notifikasi dana masuk mentah dari HP listener, beserta hasil baca nominal dan pencocokannya."
        action={
          <ActionForm action={reprocessEventsAction} className="flex max-w-[320px] flex-col items-end gap-1 text-right">
            <SubmitButton className={btnPrimary} pendingLabel="Memproses…">
              Proses ulang
            </SubmitButton>
          </ActionForm>
        }
      />

      <FilterTabs
        label="Filter mutasi"
        current={filter}
        items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: data.counts[f.value] ?? 0, href: href(f.value) }))}
      />

      <div className="relative overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[960px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#fafaf9] text-left text-muted">
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Diterima</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Notifikasi</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 text-right font-medium">Nominal</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">QRIS</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Hasil</th>
              <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Transaksi</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((e) => (
              <Row key={e.id} e={e} />
            ))}
          </tbody>
        </table>
        {data.items.length === 0 && (
          <EmptyState title={filter === "ALL" ? "Belum ada mutasi masuk." : "Tidak ada mutasi dengan status ini."}>
            {filter === "ALL"
              ? "Notifikasi dana masuk dari HP listener akan muncul di sini."
              : "Coba pilih filter lain."}
          </EmptyState>
        )}
      </div>

      <Pager page={data.page} perPage={data.per_page} total={data.total} noun="mutasi" hrefFor={(p) => href(filter, p)} />
      <p className="px-1 text-xs text-faint">
        Proses ulang membaca lagi mutasi yang tak terbaca, diabaikan, atau tidak cocok, mis. setelah parser atau package QRIS
        diperbaiki. Mutasi yang ternyata cocok langsung melunasi tagihannya.
      </p>
    </>
  );
}

function Result({ e }: { e: PaymentEvent }) {
  if (e.parse_status === "UNPARSED") return <Pill tone="warn">Tak terbaca</Pill>;
  if (e.parse_status === "IGNORED" || e.match_status === "NOT_APPLICABLE")
    return <Pill tone="muted">{e.is_test ? "Uji" : "Diabaikan"}</Pill>;
  switch (e.match_status) {
    case "MATCHED":
      return <Pill tone="ok">Cocok</Pill>;
    case "LATE_MATCHED":
      return <Pill tone="warn">Bayar telat</Pill>;
    case "UNMATCHED":
      return <Pill tone="bad">Tidak cocok</Pill>;
    default:
      return <Pill tone="neutral">Diproses</Pill>;
  }
}

function Row({ e }: { e: PaymentEvent }) {
  const cell = "border-b border-line-soft px-[18px] py-3 align-top";
  return (
    <tr className="hover:bg-[#fafaf9]">
      <td className={`${cell} whitespace-nowrap text-muted`}>
        {formatDateTime(e.posted_at)}
        {e.device_name && <span className="block text-xs text-faint">{e.device_name}</span>}
      </td>
      <td className={`${cell} max-w-[380px]`}>
        {e.title && <span className="block font-medium">{e.title}</span>}
        {e.text && <span className="block break-words">{e.text}</span>}
        <span className="block font-mono text-xs text-faint">{e.package_name}</span>
      </td>
      <td className={`${cell} text-right font-medium tabular-nums`}>
        {e.parsed_amount === null ? <span className="font-normal text-faint">–</span> : formatRupiah(e.parsed_amount)}
      </td>
      <td className={`${cell} text-muted`}>{e.qris_label ?? "–"}</td>
      <td className={cell}>
        <Result e={e} />
      </td>
      <td className={cell}>
        {e.transaction_id ? (
          <Link href={`/transaksi?q=${encodeURIComponent(e.transaction_id)}`} className="hover:underline">
            {e.merchant_ref}
          </Link>
        ) : (
          <span className="text-faint">–</span>
        )}
      </td>
    </tr>
  );
}
