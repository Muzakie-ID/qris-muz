"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS } from "@/lib/docs-nav";
import { cn } from "@/lib/cn";

/** Menu samping dokumentasi; di layar kecil menjadi daftar yang bisa digeser. */
export function DocsNav() {
  const pathname = usePathname();
  const groups = Array.from(new Set(DOCS.map((d) => d.group)));
  return (
    <nav aria-label="Dokumentasi" className="flex flex-col gap-4 lg:sticky lg:top-6">
      {groups.map((g) => (
        <div key={g} className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1 text-xs text-faint">{g}</span>
          {DOCS.filter((d) => d.group === g).map((d) => {
            const on = pathname === d.href;
            return (
              <Link
                key={d.href}
                href={d.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[13px] hover:bg-subtle",
                  on ? "bg-subtle font-medium text-ink" : "text-muted",
                )}
              >
                {d.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Tautan halaman sebelumnya/berikutnya di bawah setiap halaman. */
export function DocsPager() {
  const pathname = usePathname();
  const i = DOCS.findIndex((d) => d.href === pathname);
  const prev = i > 0 ? DOCS[i - 1] : null;
  const next = i >= 0 && i < DOCS.length - 1 ? DOCS[i + 1] : null;
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line-soft pt-6 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className="rounded-xl border border-line px-4 py-3 hover:border-[#cfcfcb]">
          <span className="block text-xs text-faint">Sebelumnya</span>
          <span className="font-medium">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} className="rounded-xl border border-line px-4 py-3 text-right hover:border-[#cfcfcb]">
          <span className="block text-xs text-faint">Berikutnya</span>
          <span className="font-medium">{next.title}</span>
        </Link>
      )}
    </div>
  );
}
