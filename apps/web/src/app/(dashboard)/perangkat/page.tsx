import type { Metadata } from "next";
import { BatteryCharging, BatteryMedium, Radio, TriangleAlert } from "lucide-react";
import { deviceCommandAction, revokeDeviceAction } from "@/app/admin-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EmptyState, Pill } from "@/components/admin/list-controls";
import { PairingForm } from "@/components/admin/pairing-form";
import { Card, PageHeader, SectionHeader } from "@/components/ui";
import { listDevices, publicApiUrl, type Device, type DeviceCommand } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { btnDanger, btnSecondary } from "@/lib/styles";

export const metadata: Metadata = { title: "Perangkat" };
export const dynamic = "force-dynamic";

const COMMANDS: { value: DeviceCommand; label: string }[] = [
  { value: "flush_queue", label: "Kirim antrian" },
  { value: "rescan", label: "Pindai ulang notifikasi" },
  { value: "refresh_config", label: "Muat ulang konfigurasi" },
];

export default async function DevicesPage() {
  const { status, devices } = await listDevices();
  const online = new Map(status.devices.map((d) => [d.id, d.online]));
  const active = devices.filter((d) => !d.revoked_at);
  const revoked = devices.filter((d) => d.revoked_at);

  return (
    <>
      <PageHeader
        title="Perangkat"
        description="HP listener yang meneruskan notifikasi dana masuk ke server."
        action={
          <Pill tone={status.listener_online ? "ok" : "bad"}>
            {status.listener_online ? "Konfirmasi realtime" : "Tidak ada listener online"}
          </Pill>
        }
      />

      <section className="flex flex-col gap-3">
        <SectionHeader title="Perangkat aktif" />
        {active.length === 0 ? (
          <Card>
            <EmptyState title="Belum ada HP listener.">
              Pasangkan HP lewat Tambah perangkat di bawah. Tanpa listener, pembayaran hanya bisa dikonfirmasi manual.
            </EmptyState>
          </Card>
        ) : (
          active.map((d) => <DeviceCard key={d.id} device={d} online={online.get(d.id) ?? false} now={status.server_time} />)
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Tambah perangkat" />
        <Card className="px-5 py-5">
          <PairingForm serverUrl={publicApiUrl()} />
        </Card>
      </section>

      {revoked.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Sudah dicabut" />
          <Card className="px-5 py-1">
            <ul>
              {revoked.map((d) => (
                <li key={d.id} className="flex flex-wrap justify-between gap-2 border-b border-line-soft py-3 text-faint last:border-b-0">
                  <span>
                    {d.name} <span className="font-mono text-xs">{d.id}</span>
                  </span>
                  <span>Dicabut {formatDateTime(d.revoked_at!)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  );
}

function DeviceCard({ device: d, online, now }: { device: Device; online: boolean; now: string }) {
  const skewSec = d.clock_skew_ms === null ? null : Math.round(d.clock_skew_ms / 1000);
  const sources = Object.entries(d.source_app_versions ?? {});
  const facts: [string, React.ReactNode][] = [
    ["Heartbeat terakhir", timeAgo(d.last_heartbeat_at, now)],
    [
      "Baterai",
      d.battery === null ? (
        "–"
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {d.charging ? (
            <BatteryCharging className="size-4 text-ok" strokeWidth={1.75} aria-hidden />
          ) : (
            <BatteryMedium className={cn("size-4", d.battery < 20 && "text-bad")} strokeWidth={1.75} aria-hidden />
          )}
          {d.battery}%{d.charging ? " · mengisi" : ""}
        </span>
      ),
    ],
    ["Antrian belum terkirim", d.queued === null ? "–" : String(d.queued)],
    ["Akses notifikasi", d.listener_ok === null ? "–" : d.listener_ok ? "Aktif" : "Mati, buka aplikasi di HP"],
    ["Versi listener", d.app_version ?? "–"],
    ["Selisih jam HP", skewSec === null ? "–" : Math.abs(skewSec) < 2 ? "Sinkron" : `${skewSec > 0 ? "+" : ""}${skewSec} detik`],
  ];

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-5">
        <span className="flex size-10 items-center justify-center rounded-xl border border-line">
          <Radio className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{d.name}</span>
          <span className="font-mono text-xs text-faint">{d.id}</span>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", online ? "text-ok" : "text-bad")}>
          <span className={cn("size-2 rounded-full", online ? "bg-ok-dot" : "bg-bad")} aria-hidden />
          {online ? "Online" : "Offline"}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 border-t border-line-soft px-5 py-2 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 py-2">
            <dt className="text-xs text-faint">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-0.5 py-2 sm:col-span-2 lg:col-span-3">
          <dt className="text-xs text-faint">Aplikasi sumber yang terpasang</dt>
          <dd className="flex flex-wrap gap-1.5">
            {sources.length === 0
              ? "–"
              : sources.map(([pkg, ver]) => (
                  <span key={pkg} className="rounded-full bg-subtle px-2.5 py-0.5 font-mono text-xs">
                    {pkg} {ver}
                  </span>
                ))}
          </dd>
        </div>
      </dl>

      {d.last_crash && (
        <details className="border-t border-line-soft px-5 py-3">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-warn">
            <TriangleAlert className="size-4" strokeWidth={1.75} aria-hidden />
            Crash terakhir{d.last_crash_at ? `, ${formatDateTime(d.last_crash_at)}` : ""}
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-subtle p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {d.last_crash}
          </pre>
        </details>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line-soft px-5 py-4">
        <ActionForm action={deviceCommandAction} className="flex max-w-xl flex-wrap items-center gap-2">
          <input type="hidden" name="device_id" value={d.id} />
          {COMMANDS.map((c) => (
            <SubmitButton key={c.value} name="command" value={c.value} className={btnSecondary}>
              {c.label}
            </SubmitButton>
          ))}
          {d.pending_commands.length > 0 && (
            <span className="basis-full text-xs text-faint">
              Menunggu heartbeat: {d.pending_commands.map((c) => COMMANDS.find((x) => x.value === c)?.label ?? c).join(", ")}
            </span>
          )}
        </ActionForm>
        <ActionForm
          action={revokeDeviceAction}
          confirm={`Cabut ${d.name}? HP ini tidak bisa mengirim notifikasi lagi sampai dipasangkan ulang.`}
          className="flex flex-col items-end gap-1"
        >
          <input type="hidden" name="device_id" value={d.id} />
          <SubmitButton className={btnDanger} pendingLabel="Mencabut…">
            Cabut perangkat
          </SubmitButton>
        </ActionForm>
      </div>
    </Card>
  );
}
