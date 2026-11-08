import type { Metadata } from "next";
import { DocsNav, DocsPager } from "@/components/docs/docs-nav";

export const metadata: Metadata = {
  title: { default: "Dokumentasi", template: "%s · qrismuz" },
  description: "Tata cara memakai qrismuz: menambah QRIS, memasang HP listener, API transaksi, dan webhook.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 pb-12 pt-4 sm:px-8 lg:flex-row lg:items-start lg:gap-12">
      <aside className="shrink-0 lg:w-[230px]">
        <DocsNav />
      </aside>
      <article className="flex min-w-0 flex-1 flex-col gap-4 text-sm">
        {children}
        <DocsPager />
      </article>
    </div>
  );
}
