import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { getAccount, getDashboard } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Sidebar tetap tampil walau backend sedang tidak bisa dihubungi; halaman yang menampilkan errornya.
  // Pengalihan ke /login (sesi berakhir) tetap diteruskan.
  const [status, account] = await Promise.all([
    getDashboard()
      .then((d) => ({ unread: d.unparsed_events, online: d.listener.listener_online }))
      .catch((e: unknown) => {
        unstable_rethrow(e);
        return { unread: 0, online: false };
      }),
    getAccount().catch((e: unknown) => {
      unstable_rethrow(e);
      return null;
    }),
  ]);
  return (
    <div className="flex min-h-svh flex-col gap-3 p-3 text-sm lg:flex-row lg:items-start">
      <Sidebar
        unreadEvents={status.unread}
        listenerOnline={status.online}
        ownerEmail={account?.email ?? null}
        totpEnabled={account?.totp_enabled ?? false}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-6 rounded-[20px] border border-line bg-surface px-5 pb-8 pt-6 sm:px-8 sm:pt-7">
        {account && !account.totp_enabled && (
          <Link
            href="/pengaturan#2fa"
            className="flex items-center gap-2.5 rounded-xl border border-warn-dot/40 bg-warn-bg px-4 py-3 text-warn hover:underline"
          >
            <ShieldAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            2FA belum aktif. Siapa pun yang tahu password Anda bisa masuk. Nyalakan di Pengaturan.
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
