import { SiteFooter, SiteHeader } from "@/components/site/site-header";

/** Halaman publik memakai bingkai yang sama dengan dashboard: panel putih membulat di atas kanvas abu-abu. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col p-2 pt-3 text-sm sm:p-3">
      <div className="flex flex-1 flex-col rounded-[20px] border border-line bg-surface">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
      <SiteFooter />
    </div>
  );
}
