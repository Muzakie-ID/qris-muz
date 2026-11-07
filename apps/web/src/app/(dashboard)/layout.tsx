import { Sidebar } from "@/components/sidebar";
import { getListener, getParserAlerts } from "@/lib/mock-data";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 text-sm lg:flex-row lg:items-start">
      <Sidebar unreadEvents={getParserAlerts()} listenerOnline={getListener().online} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 rounded-[20px] border border-line bg-surface px-5 pb-8 pt-6 sm:px-8 sm:pt-7">
        {children}
      </main>
    </div>
  );
}
