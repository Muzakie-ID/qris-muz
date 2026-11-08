import { Sidebar } from "@/components/sidebar";
import { getDashboard } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Sidebar tetap tampil walau backend sedang tidak bisa dihubungi; halaman yang menampilkan errornya.
  const status = await getDashboard()
    .then((d) => ({ unread: d.unparsed_events, online: d.listener.listener_online }))
    .catch(() => ({ unread: 0, online: false }));
  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 text-sm lg:flex-row lg:items-start">
      <Sidebar unreadEvents={status.unread} listenerOnline={status.online} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 rounded-[20px] border border-line bg-surface px-5 pb-8 pt-6 sm:px-8 sm:pt-7">
        {children}
      </main>
    </div>
  );
}
