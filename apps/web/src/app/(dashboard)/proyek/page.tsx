import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { createApiKeyAction, createProjectAction, revokeApiKeyAction, updateProjectAction } from "@/app/admin-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EmptyState, Pill } from "@/components/admin/list-controls";
import { Card, PageHeader } from "@/components/ui";
import { listApiKeys, listProjects, listQrisSources, publicApiUrl, type Project, type QrisSource } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { btnDanger, btnPrimary, btnSecondary, hintCls, inputCls, labelCls } from "@/lib/styles";

export const metadata: Metadata = { title: "Proyek & API key" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, qris] = await Promise.all([listProjects(), listQrisSources()]);
  const keys = await Promise.all(projects.map((p) => listApiKeys(p.id)));

  return (
    <>
      <PageHeader
        title="Proyek & API key"
        description="Setiap proyek punya API key, URL webhook, dan return URL default sendiri."
        action={null}
      />

      <details className="group rounded-2xl border border-line" open={projects.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
          <Plus className="size-4 transition-transform group-open:rotate-45" strokeWidth={1.75} aria-hidden />
          Proyek baru
        </summary>
        <ActionForm action={createProjectAction} resetOnSuccess className="flex flex-col gap-4 border-t border-line-soft px-5 py-5">
          <ProjectFields qris={qris} />
          <div>
            <SubmitButton className={btnPrimary} pendingLabel="Membuat…">
              Buat proyek
            </SubmitButton>
          </div>
        </ActionForm>
      </details>

      {projects.length === 0 ? (
        <Card>
          <EmptyState title="Belum ada proyek.">Buat proyek pertama, lalu buat API key-nya untuk dipakai aplikasi Anda.</EmptyState>
        </Card>
      ) : (
        projects.map((p, i) => (
          <Card key={p.id} className="flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-5">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-lg font-medium tracking-[-0.02em]">{p.name}</h2>
                <span className="font-mono text-xs text-faint">{p.id}</span>
              </div>
              <ActionForm action={createApiKeyAction} className="flex flex-wrap justify-end gap-2">
                <input type="hidden" name="project_id" value={p.id} />
                <SubmitButton className={btnSecondary} pendingLabel="Membuat…">
                  <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                  API key baru
                </SubmitButton>
              </ActionForm>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 border-t border-line-soft px-5 py-3 sm:grid-cols-2">
              {[
                ["URL webhook", p.webhook_url ?? "Belum diisi; webhook tidak dikirim"],
                ["Return URL default", p.default_return_url ?? "–"],
                ["QRIS default", qrisName(qris, p.default_qris_source_id)],
                ["Masa berlaku tagihan", `${p.default_expiry_min} menit`],
                ["Kode unik", `${p.unique_code_min.toLocaleString("id-ID")}–${p.unique_code_max.toLocaleString("id-ID")} (${(p.unique_code_max - p.unique_code_min + 1).toLocaleString("id-ID")} kode)`],
              ].map(([k, v]) => (
                <div key={k} className="flex min-w-0 flex-col gap-0.5 py-2">
                  <dt className="text-xs text-faint">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="relative overflow-x-auto border-t border-line-soft">
              <table className="w-full min-w-[560px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col" className="px-5 py-2.5 font-medium">API key</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Dibuat</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Terakhir dipakai</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-5 py-2.5"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {keys[i].length === 0 && (
                    <tr>
                      <td colSpan={5} className="border-t border-line-soft px-5 py-3.5 text-faint">
                        Belum ada API key.
                      </td>
                    </tr>
                  )}
                  {keys[i].map((k) => (
                    <tr key={k.id} className={k.revoked_at ? "text-faint" : undefined}>
                      <td className="border-t border-line-soft px-5 py-3 font-mono text-xs">{k.prefix}…</td>
                      <td className="whitespace-nowrap border-t border-line-soft px-5 py-3">{formatDateTime(k.created_at)}</td>
                      <td className="whitespace-nowrap border-t border-line-soft px-5 py-3">
                        {k.last_used_at ? formatDateTime(k.last_used_at) : "Belum pernah"}
                      </td>
                      <td className="border-t border-line-soft px-5 py-3">
                        {k.revoked_at ? <Pill tone="muted">Dicabut</Pill> : <Pill tone="ok">Aktif</Pill>}
                      </td>
                      <td className="border-t border-line-soft px-5 py-2 text-right">
                        {!k.revoked_at && (
                          <ActionForm
                            action={revokeApiKeyAction}
                            confirm={`Cabut API key ${k.prefix}…? Aplikasi yang memakainya akan langsung ditolak.`}
                            className="flex flex-col items-end gap-1"
                          >
                            <input type="hidden" name="key_id" value={k.id} />
                            <SubmitButton className={btnDanger} pendingLabel="Mencabut…">
                              Cabut
                            </SubmitButton>
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="border-t border-line-soft">
              <summary className="cursor-pointer px-5 py-3 text-[13px] font-medium text-muted hover:text-ink">Ubah pengaturan proyek</summary>
              <ActionForm action={updateProjectAction} closeOnSuccess className="flex flex-col gap-4 px-5 pb-5 pt-1">
                <input type="hidden" name="project_id" value={p.id} />
                <ProjectFields qris={qris} project={p} />
                <div>
                  <SubmitButton className={btnPrimary} pendingLabel="Menyimpan…">
                    Simpan
                  </SubmitButton>
                </div>
              </ActionForm>
            </details>
          </Card>
        ))
      )}

      <p className="px-1 text-xs text-faint">
        Aplikasi Anda memanggil <code className="font-mono">{publicApiUrl()}/v1/transactions</code> dengan header{" "}
        <code className="font-mono">Authorization: Bearer &lt;API key&gt;</code>. Webhook ditandatangani dengan webhook secret proyek
        (header <code className="font-mono">X-Signature</code>).
      </p>
    </>
  );
}

function qrisName(qris: QrisSource[], id: string | null) {
  if (!id) return "Otomatis, bila hanya ada satu QRIS aktif";
  const q = qris.find((x) => x.id === id);
  return q ? `${q.label} (${q.merchant_name})` : id;
}

function ProjectFields({ qris, project }: { qris: QrisSource[]; project?: Project }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className={labelCls}>
        Nama proyek
        <input name="name" required maxLength={100} defaultValue={project?.name} placeholder="Toko online" className={inputCls} />
      </label>
      <label className={labelCls}>
        Masa berlaku tagihan (menit)
        <input
          name="default_expiry_min"
          type="number"
          min={1}
          max={1440}
          defaultValue={project?.default_expiry_min ?? 15}
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        URL webhook
        <input
          name="webhook_url"
          type="url"
          defaultValue={project?.webhook_url ?? ""}
          placeholder="https://contoh.com/webhooks/qrismuz"
          className={inputCls}
        />
        <span className={hintCls}>Dikirimi event transaction.paid, transaction.expired, dan transaction.late_paid.</span>
      </label>
      <label className={labelCls}>
        Return URL default
        <input
          name="default_return_url"
          type="url"
          defaultValue={project?.default_return_url ?? ""}
          placeholder="https://contoh.com/pesanan/selesai"
          className={inputCls}
        />
        <span className={hintCls}>Tujuan pembeli setelah bayar, bila tagihan tidak menyertakan return_url.</span>
      </label>
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-medium">Rentang kode unik</legend>
        <div className="flex items-center gap-2">
          <input
            name="unique_code_min"
            type="number"
            min={1}
            max={99999}
            required
            aria-label="Kode unik terkecil"
            defaultValue={project?.unique_code_min ?? 1}
            className={inputCls}
          />
          <span className="text-faint">sampai</span>
          <input
            name="unique_code_max"
            type="number"
            min={1}
            max={99999}
            required
            aria-label="Kode unik terbesar"
            defaultValue={project?.unique_code_max ?? 999}
            className={inputCls}
          />
        </div>
        <span className={hintCls}>
          Ditambahkan ke nominal agar setiap tagihan berbeda, mis. 500–1999 membuat Rp50.000 menjadi Rp50.500–Rp51.999. Pembeli
          membayar tambahan ini. Bawaan 1–999; minimal 10 kode.
        </span>
      </fieldset>
      <label className={labelCls}>
        QRIS default
        <select name="default_qris_source_id" defaultValue={project?.default_qris_source_id ?? ""} className={inputCls}>
          <option value="">Otomatis (bila hanya satu QRIS aktif)</option>
          {qris.map((q) => (
            <option key={q.id} value={q.id} disabled={!q.is_active}>
              {q.label} · {q.merchant_name}
              {q.is_active ? "" : " (nonaktif)"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
