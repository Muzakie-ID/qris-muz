import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { createParserAction, reprocessEventsAction, updateParserAction } from "@/app/admin-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EditDialog } from "@/components/admin/edit-dialog";
import { EmptyState, Pill } from "@/components/admin/list-controls";
import { ParserTester } from "@/components/admin/parser-tester";
import { Card, PageHeader, SectionHeader } from "@/components/ui";
import { listParsers, listPaymentEvents, listQrisSources, type Parser } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { btnPrimary, hintCls, inputCls, labelCls } from "@/lib/styles";

export const metadata: Metadata = { title: "Parser" };
export const dynamic = "force-dynamic";

export default async function ParsersPage() {
  const [parsers, qris, unparsed] = await Promise.all([
    listParsers(),
    listQrisSources(),
    listPaymentEvents({ parse_status: "UNPARSED" }),
  ]);
  const packages = Array.from(
    new Set([...parsers.map((p) => p.package_name), ...qris.map((q) => q.source_package)].filter((p): p is string => !!p)),
  ).sort();

  return (
    <>
      <PageHeader
        title="Parser"
        description="Pola regex yang membaca nominal dari teks notifikasi. Parser khusus package dicoba dulu, lalu parser umum."
        action={
          <ActionForm action={reprocessEventsAction} className="flex max-w-[320px] flex-col items-end gap-1 text-right">
            <SubmitButton className={btnPrimary} pendingLabel="Memproses…">
              Proses ulang mutasi
            </SubmitButton>
          </ActionForm>
        }
      />

      <datalist id="parser-packages">
        {packages.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {unparsed.total > 0 && (
        <Link
          href="/mutasi?filter=UNPARSED"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn-dot/40 bg-warn-bg px-5 py-3.5 text-warn hover:underline"
        >
          <span>
            <strong className="font-semibold">{unparsed.total} notifikasi</strong> belum terbaca parser. Uji teksnya di bawah,
            perbaiki pola, lalu proses ulang.
          </span>
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
        </Link>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeader title="Daftar parser" />
        <Card className="relative overflow-x-auto">
          {parsers.length === 0 ? (
            <EmptyState title="Belum ada parser.">Tanpa parser, nominal notifikasi tidak bisa dibaca.</EmptyState>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#fafaf9] text-left text-muted">
                  <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Package</th>
                  <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Pola</th>
                  <th scope="col" className="border-b border-line px-[18px] py-3 text-right font-medium">Prioritas</th>
                  <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Cocok otomatis</th>
                  <th scope="col" className="border-b border-line px-[18px] py-3 font-medium">Status</th>
                  <th scope="col" className="border-b border-line px-[18px] py-3"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {parsers.map((p) => (
                  <ParserRow key={p.id} p={p} />
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <p className="px-1 text-xs text-faint">
          Grup tangkap pertama harus berisi nominal. Parser dengan cocok otomatis mati hanya mencatat nominal untuk ditinjau,
          tidak melunasi tagihan.
        </p>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
          <SectionHeader title="Uji notifikasi" />
          <Card className="px-5 py-5">
            <ParserTester />
          </Card>
        </section>
        <section className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
          <SectionHeader title="Parser baru" />
          <Card className="px-5 py-5">
            <ActionForm action={createParserAction} resetOnSuccess className="flex flex-col gap-4">
              <ParserFields />
              <div>
                <SubmitButton className={btnPrimary} pendingLabel="Menyimpan…">
                  <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                  Tambah parser
                </SubmitButton>
              </div>
            </ActionForm>
          </Card>
        </section>
      </div>
    </>
  );
}

function ParserFields({ p }: { p?: Parser }) {
  return (
    <>
      <label className={labelCls}>
        Pola regex
        <input
          name="pattern"
          required
          maxLength={500}
          defaultValue={p?.pattern}
          placeholder="Rp\s?([\d.]+)\s+diterima"
          className={`${inputCls} font-mono text-xs`}
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
        <label className={labelCls}>
          Package
          <input
            name="package_name"
            list="parser-packages"
            maxLength={200}
            defaultValue={p?.package_name ?? ""}
            placeholder="Kosong: parser umum"
            className={`${inputCls} font-mono text-xs`}
          />
        </label>
        <label className={labelCls}>
          Prioritas
          <input name="priority" type="number" min={0} max={10000} defaultValue={p?.priority ?? 100} className={inputCls} />
        </label>
      </div>
      <span className={hintCls}>Angka prioritas lebih kecil dicoba lebih dulu.</span>
      <div className="flex flex-wrap gap-5 text-[13px]">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="auto_match" defaultChecked={p?.auto_match ?? true} className="size-4 accent-ink" />
          Cocokkan otomatis
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="is_active" defaultChecked={p?.is_active ?? true} className="size-4 accent-ink" />
          Aktif
        </label>
      </div>
    </>
  );
}

function ParserRow({ p }: { p: Parser }) {
  return (
    <tr className={p.is_active ? undefined : "text-faint"}>
        <td className="border-b border-line-soft px-[18px] py-3 font-mono text-xs">{p.package_name ?? <span className="font-sans">Umum</span>}</td>
        <td className="max-w-[360px] border-b border-line-soft px-[18px] py-3">
          <code className="break-all font-mono text-xs">{p.pattern}</code>
        </td>
        <td className="border-b border-line-soft px-[18px] py-3 text-right tabular-nums">{p.priority}</td>
        <td className="border-b border-line-soft px-[18px] py-3">
          {p.auto_match ? <Pill tone="ok">Ya</Pill> : <Pill tone="warn">Tinjau manual</Pill>}
        </td>
        <td className="border-b border-line-soft px-[18px] py-3">
          {p.is_active ? <Pill tone="neutral">Aktif</Pill> : <Pill tone="muted">Nonaktif</Pill>}
        </td>
        <td className="border-b border-line-soft px-[18px] py-2 text-right">
          <EditDialog label="Ubah" title="Ubah parser" subtitle={`${p.id} · diubah ${formatDateTime(p.updated_at)}`}>
            <ActionForm action={updateParserAction} closeOnSuccess className="flex flex-col gap-4">
              <input type="hidden" name="parser_id" value={p.id} />
              <ParserFields p={p} />
              <div>
                <SubmitButton className={btnPrimary} pendingLabel="Menyimpan…">
                  Simpan
                </SubmitButton>
              </div>
            </ActionForm>
          </EditDialog>
        </td>
    </tr>
  );
}

