import type { Metadata } from "next";
import { CircleCheck, CircleX, DatabaseBackup, KeyRound, MonitorSmartphone, Send, ShieldCheck } from "lucide-react";
import {
  changePasswordAction,
  revokeSessionAction,
  testTelegramAction,
  totpDisableAction,
  updateTelegramAction,
} from "@/app/admin-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Pill } from "@/components/admin/list-controls";
import { TotpSetup } from "@/components/admin/totp-setup";
import { Card, PageHeader } from "@/components/ui";
import {
  NOTIFY_CATEGORIES,
  getAccount,
  getBackups,
  getTelegram,
  listNotifications,
  type NotifyCategory,
} from "@/lib/api";
import { timeAgo } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { btnDanger, btnPrimary, btnSecondary, hintCls, inputCls, labelCls } from "@/lib/styles";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<NotifyCategory, string> = {
  payment: "Pembayaran masuk",
  late_payment: "Bayar telat",
  listener: "HP listener offline / online lagi",
  unparsed: "Notifikasi tak terbaca parser",
  unmatched: "Dana masuk tidak cocok tagihan",
  app_version: "Aplikasi sumber ter-update",
  webhook_failed: "Webhook gagal permanen",
  backup: "Backup gagal atau terlambat",
  security: "Login dan akun terkunci",
};

/** "Chrome · Android" dari user agent, cukup untuk mengenali perangkat sendiri. */
function deviceLabel(ua: string | null): string {
  if (!ua) return "Perangkat tidak dikenal";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

function formatBytes(n: number | null): string {
  if (n === null) return "–";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function Section({ id, icon: Icon, title, description, children }: {
  id?: string;
  icon: typeof KeyRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <div id={id} className="flex scroll-mt-6 items-start gap-3 border-b border-line-soft px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line">
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-medium tracking-[-0.01em]">{title}</h2>
          <p className="text-[13px] text-faint">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </Card>
  );
}

export default async function SettingsPage() {
  const [account, telegram, notifications, backups] = await Promise.all([
    getAccount(),
    getTelegram(),
    listNotifications(1, 8),
    getBackups(),
  ]);
  const now = new Date().toISOString();
  const lastOkAge = backups.last_ok_at ? (Date.now() - new Date(backups.last_ok_at).getTime()) / 3600_000 : null;
  const backupHealthy = lastOkAge !== null && lastOkAge <= backups.max_age_hours;

  return (
    <>
      <PageHeader title="Pengaturan" description="Akun owner, keamanan login, notifikasi Telegram, dan backup." action={null} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section icon={KeyRound} title="Akun" description={`Masuk sebagai ${account.email}.`}>
          <ActionForm action={changePasswordAction} resetOnSuccess className="flex flex-col gap-3">
            <input type="email" name="username" autoComplete="username" defaultValue={account.email} hidden readOnly />
            <label className={labelCls}>
              Password saat ini
              <input type="password" name="current_password" required autoComplete="current-password" className={inputCls} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Password baru
                <input type="password" name="new_password" required minLength={10} autoComplete="new-password" className={inputCls} />
              </label>
              <label className={labelCls}>
                Ulangi password baru
                <input type="password" name="confirm_password" required minLength={10} autoComplete="new-password" className={inputCls} />
              </label>
            </div>
            <span className={hintCls}>Minimal 10 karakter. Sesi di perangkat lain akan dikeluarkan.</span>
            <div>
              <SubmitButton className={btnPrimary} pendingLabel="Menyimpan…">
                Ganti password
              </SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section
          id="2fa"
          icon={ShieldCheck}
          title="Verifikasi dua langkah (2FA)"
          description="Selain password, login meminta kode 6 digit dari aplikasi authenticator di HP Anda."
        >
          {account.totp_enabled ? (
            <>
              <p className="inline-flex items-center gap-2">
                <Pill tone="ok">Aktif</Pill>
                {account.totp_enabled_at && <span className="text-faint">sejak {formatDateTime(account.totp_enabled_at)}</span>}
              </p>
              <details className="rounded-xl border border-line-soft">
                <summary className="cursor-pointer px-3.5 py-2.5 text-[13px] font-medium text-muted hover:text-ink">
                  Matikan 2FA atau ganti HP authenticator
                </summary>
                <ActionForm action={totpDisableAction} className="flex flex-wrap items-end gap-3 px-3.5 pb-3.5 pt-1">
                  <label className={`${labelCls} min-w-[200px] flex-1`}>
                    Password
                    <input type="password" name="password" required autoComplete="current-password" className={inputCls} />
                  </label>
                  <label className={`${labelCls} w-36`}>
                    Kode 2FA
                    <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} className={`${inputCls} font-mono`} />
                  </label>
                  <SubmitButton className={btnDanger} pendingLabel="Mematikan…">
                    Matikan 2FA
                  </SubmitButton>
                </ActionForm>
              </details>
            </>
          ) : (
            <>
              <p className="inline-flex items-center gap-2 text-warn">
                <Pill tone="warn">Belum aktif</Pill>
                Siapa pun yang tahu password Anda bisa masuk.
              </p>
              <TotpSetup />
            </>
          )}
        </Section>
      </div>

      <Section icon={MonitorSmartphone} title="Sesi aktif" description="Perangkat yang sedang login. Sesi berakhir bila 12 jam tidak dipakai.">
        <ul className="-my-2 flex flex-col">
          {account.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft py-3 last:border-b-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">
                  {deviceLabel(s.user_agent)} {s.current && <Pill tone="neutral">Perangkat ini</Pill>}
                </span>
                <span className="text-xs text-faint">
                  IP {s.ip ?? "–"} · masuk {formatDateTime(s.created_at)} · aktif {timeAgo(s.last_seen_at, now)}
                </span>
              </div>
              {!s.current && (
                <ActionForm action={revokeSessionAction} confirm="Keluarkan sesi ini?" className="flex flex-col items-end gap-1">
                  <input type="hidden" name="session_id" value={s.id} />
                  <SubmitButton className={btnDanger} pendingLabel="Mengeluarkan…">
                    Keluarkan
                  </SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="telegram"
        icon={Send}
        title="Notifikasi Telegram"
        description="Alarm dan kabar pembayaran dikirim bot Telegram ke chat Anda."
      >
        <details className="rounded-xl bg-subtle px-3.5 py-2.5 text-[13px]" open={!telegram.configured}>
          <summary className="cursor-pointer font-medium">Cara menyiapkan bot</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted">
            <li>
              Di Telegram, chat <strong className="font-medium text-ink">@BotFather</strong>, kirim <code className="font-mono">/newbot</code>,
              lalu salin token yang diberikan.
            </li>
            <li>Buka bot baru Anda dan tekan Start (bot tidak bisa memulai chat sendiri).</li>
            <li>
              Cari chat ID Anda lewat <strong className="font-medium text-ink">@userinfobot</strong> (angka &ldquo;Id&rdquo;). Untuk grup, tambahkan
              bot ke grup; ID grup diawali tanda minus.
            </li>
            <li>Isi keduanya di bawah, simpan, lalu tekan Kirim pesan uji.</li>
          </ol>
        </details>

        <ActionForm action={updateTelegramAction} resetOnSuccess className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              Token bot
              <input
                name="bot_token"
                type="password"
                autoComplete="off"
                placeholder={telegram.bot_token_hint ? `Tersimpan (${telegram.bot_token_hint}); kosongkan bila tidak diganti` : "123456789:AA…"}
                className={`${inputCls} font-mono text-xs`}
              />
            </label>
            <label className={labelCls}>
              Chat ID
              <input name="chat_id" defaultValue={telegram.chat_id ?? ""} placeholder="123456789" className={`${inputCls} font-mono text-xs`} />
            </label>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium">Kirim notifikasi untuk</legend>
            <div className="grid grid-cols-1 gap-x-5 gap-y-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
              {NOTIFY_CATEGORIES.map((c) => (
                <label key={c} className="inline-flex items-center gap-2">
                  <input type="checkbox" name={`cat_${c}`} defaultChecked={telegram.categories[c]} className="size-4 accent-ink" />
                  {CATEGORY_LABEL[c]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="inline-flex items-center gap-2 text-[13px] font-medium">
            <input type="checkbox" name="enabled" defaultChecked={telegram.enabled} className="size-4 accent-ink" />
            Nyalakan notifikasi Telegram
          </label>
          <div>
            <SubmitButton className={btnPrimary} pendingLabel="Menyimpan…">
              Simpan
            </SubmitButton>
          </div>
        </ActionForm>

        {telegram.configured && (
          <ActionForm action={testTelegramAction} className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
            <SubmitButton className={btnSecondary} pendingLabel="Mengirim…">
              <Send className="size-4" strokeWidth={1.75} aria-hidden />
              Kirim pesan uji
            </SubmitButton>
          </ActionForm>
        )}

        {notifications.items.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
            <p className="text-[13px] font-medium">Notifikasi terakhir</p>
            <ul className="flex flex-col">
              {notifications.items.map((n) => (
                <li key={n.id} className="flex items-start gap-3 border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
                  {n.status === "SENT" ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={1.75} aria-label="Terkirim" />
                  ) : n.status === "FAILED" ? (
                    <CircleX className="mt-0.5 size-4 shrink-0 text-bad" strokeWidth={1.75} aria-label="Gagal" />
                  ) : (
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full border-[1.5px] border-muted" aria-label="Antri" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {/* Teks berformat HTML Telegram; tampilkan tanpa tag. */}
                    <span className="whitespace-pre-line break-words">{n.text.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")}</span>
                    <span className="text-xs text-faint">
                      {CATEGORY_LABEL[n.category] ?? n.category} · {formatDateTime(n.created_at)}
                      {n.last_error && n.status !== "SENT" && <span className="text-bad"> · {n.last_error}</span>}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section
        id="backup"
        icon={DatabaseBackup}
        title="Backup database"
        description="Container backup di VPS menjalankan pg_dump setiap hari ke Google Drive (rclone) dan menguji restore tiap minggu."
      >
        {backups.runs.length === 0 ? (
          <p className="text-faint">
            Belum ada catatan backup. Setelah deploy, jalankan backup pertama sesuai panduan di <code className="font-mono">deploy/README.md</code>; sejak
            itu backup yang gagal atau terlambat lebih dari {backups.max_age_hours} jam memicu alarm.
          </p>
        ) : (
          <>
            <p className="inline-flex flex-wrap items-center gap-2">
              {backupHealthy ? <Pill tone="ok">Sehat</Pill> : <Pill tone="bad">Perlu dicek</Pill>}
              <span className="text-muted">
                {backups.last_ok_at
                  ? `Backup sukses terakhir ${timeAgo(backups.last_ok_at, now)} (${formatDateTime(backups.last_ok_at)}).`
                  : "Belum ada backup yang sukses."}
              </span>
            </p>
            <div className="relative overflow-x-auto rounded-xl border border-line-soft">
              <table className="w-full min-w-[560px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col" className="px-4 py-2.5 font-medium">Waktu</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Jenis</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Hasil</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Ukuran</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.runs.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap border-t border-line-soft px-4 py-2.5">{formatDateTime(r.finished_at)}</td>
                      <td className="border-t border-line-soft px-4 py-2.5">{r.kind === "restore_test" ? "Uji restore" : "Backup"}</td>
                      <td className="border-t border-line-soft px-4 py-2.5">{r.ok ? <Pill tone="ok">Sukses</Pill> : <Pill tone="bad">Gagal</Pill>}</td>
                      <td className="border-t border-line-soft px-4 py-2.5 text-right tabular-nums">{formatBytes(r.size_bytes)}</td>
                      <td className="max-w-[320px] break-words border-t border-line-soft px-4 py-2.5 text-muted">{r.detail ?? r.file ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>
    </>
  );
}
