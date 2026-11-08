import type { Metadata } from "next";
import { Plus, QrCode } from "lucide-react";
import { createQrisAction, toggleQrisAction, updateQrisAction } from "@/app/admin-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EditDialog } from "@/components/admin/edit-dialog";
import { EmptyState, Pill } from "@/components/admin/list-controls";
import { Card, PageHeader } from "@/components/ui";
import { listDevices, listQrisSources, type QrisSource } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { btnPrimary, btnSecondary, hintCls, inputCls, labelCls, textareaCls } from "@/lib/styles";

export const metadata: Metadata = { title: "QRIS" };
export const dynamic = "force-dynamic";

export default async function QrisPage() {
  const [sources, devices] = await Promise.all([listQrisSources(), listDevices().catch(() => null)]);
  // Saran package dari aplikasi sumber yang dilaporkan HP listener.
  const packages = Array.from(
    new Set((devices?.devices ?? []).flatMap((d) => Object.keys(d.source_app_versions ?? {}))),
  ).sort();

  return (
    <>
      <PageHeader
        title="QRIS"
        description="QRIS statis yang diubah menjadi QR dinamis berisi nominal unik untuk setiap tagihan."
        action={null}
      />

      <datalist id="source-packages">
        {packages.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {sources.length === 0 ? (
        <Card>
          <EmptyState title="Belum ada QRIS.">Tambahkan QRIS statis dari DANA Bisnis atau GoPay Merchant di bawah.</EmptyState>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {sources.map((q) => (
            <QrisCard key={q.id} q={q} />
          ))}
        </div>
      )}

      <details className="group rounded-2xl border border-line" open={sources.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
          <Plus className="size-4 transition-transform group-open:rotate-45" strokeWidth={1.75} aria-hidden />
          Tambah QRIS
        </summary>
        <ActionForm action={createQrisAction} resetOnSuccess className="flex flex-col gap-4 border-t border-line-soft px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              Label
              <input name="label" required maxLength={100} placeholder="DANA Bisnis" className={inputCls} />
            </label>
            <PackageField />
          </div>
          <label className={labelCls}>
            Isi QRIS statis
            <textarea
              name="payload"
              required
              rows={4}
              maxLength={1024}
              placeholder="00020101021126…6304ABCD"
              className={textareaCls}
            />
            <span className={hintCls}>
              Pindai QRIS statis dengan aplikasi pemindai QR biasa (bukan aplikasi bank), lalu tempel teks yang muncul. Teks
              diawali 000201 dan diakhiri 6304 + 4 karakter. Nama merchant dan NMID dibaca otomatis.
            </span>
          </label>
          <div>
            <SubmitButton className={btnPrimary} pendingLabel="Memeriksa…">
              Tambah QRIS
            </SubmitButton>
          </div>
        </ActionForm>
      </details>
    </>
  );
}

function PackageField({ value }: { value?: string | null }) {
  return (
    <label className={labelCls}>
      Package aplikasi sumber
      <input
        name="source_package"
        list="source-packages"
        maxLength={200}
        defaultValue={value ?? ""}
        placeholder="mis. id.dana.bisnis"
        className={`${inputCls} font-mono text-xs`}
      />
      <span className={hintCls}>
        Notifikasi dari package ini yang dicocokkan dengan tagihan QRIS ini. Kosong berarti belum ada notifikasi yang dicocokkan.
      </span>
    </label>
  );
}

function QrisCard({ q }: { q: QrisSource }) {
  return (
    <Card className={q.is_active ? "flex flex-col" : "flex flex-col opacity-75"}>
      <div className="flex flex-wrap items-start gap-3 px-5 pb-4 pt-5">
        <span className="flex size-10 items-center justify-center rounded-xl border border-line">
          <QrCode className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{q.label}</span>
          <span className="text-[13px] text-muted">{q.merchant_name}</span>
        </div>
        {q.is_active ? <Pill tone="ok">Aktif</Pill> : <Pill tone="muted">Nonaktif</Pill>}
      </div>
      <dl className="flex flex-col border-t border-line-soft px-5 py-1 text-[13px]">
        {[
          ["NMID", q.nmid ?? "–"],
          ["Package sumber", q.source_package ?? "Belum diisi"],
          ["Ditambahkan", formatDateTime(q.created_at)],
          ["ID", q.id],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-line-soft py-2.5 last:border-b-0">
            <dt className="text-faint">{k}</dt>
            <dd className={k === "Package sumber" && !q.source_package ? "text-warn" : "break-all text-right font-mono text-xs"}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3">
        <EditDialog label="Ubah" title={`Ubah ${q.label}`} subtitle={q.id}>
          <ActionForm action={updateQrisAction} closeOnSuccess className="flex flex-col gap-4">
            <input type="hidden" name="qris_id" value={q.id} />
            <label className={labelCls}>
              Label
              <input name="label" required maxLength={100} defaultValue={q.label} className={inputCls} />
            </label>
            <PackageField value={q.source_package} />
            <div>
              <SubmitButton className={btnPrimary} pendingLabel="Menyimpan…">
                Simpan
              </SubmitButton>
            </div>
          </ActionForm>
        </EditDialog>
        <ActionForm
          action={toggleQrisAction}
          confirm={q.is_active ? `Nonaktifkan ${q.label}? Tagihan baru tidak bisa memakai QRIS ini.` : undefined}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="qris_id" value={q.id} />
          <input type="hidden" name="is_active" value={String(!q.is_active)} />
          <SubmitButton className={btnSecondary} pendingLabel="Menyimpan…">
            {q.is_active ? "Nonaktifkan" : "Aktifkan"}
          </SubmitButton>
        </ActionForm>
      </div>
    </Card>
  );
}
