import { DocsNav, DocsPager } from "@/components/docs/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <aside className="shrink-0 lg:w-[220px]">
        <DocsNav />
      </aside>
      <article className="flex min-w-0 flex-1 flex-col gap-4 text-sm">
        {children}
        <DocsPager />
      </article>
    </div>
  );
}
