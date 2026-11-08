"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { DOCS } from "@/lib/docs-nav";
import { cn } from "@/lib/cn";

function Groups({ pathname }: { pathname: string }) {
  const groups = Array.from(new Set(DOCS.map((d) => d.group)));
  return (
    <>
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
    </>
  );
}

/** Menu dokumentasi: daftar isi yang bisa dibuka-tutup di HP, menu samping tetap di desktop. */
export function DocsNav() {
  const pathname = usePathname();
  const current = DOCS.find((d) => d.href === pathname);
  return (
    <>
      <details key={pathname} className="group rounded-xl border border-line lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-col">
            <span className="text-xs text-faint">Daftar isi</span>
            <span className="font-medium">{current?.title ?? "Dokumentasi"}</span>
          </span>
          <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" strokeWidth={1.75} aria-hidden />
        </summary>
        <nav aria-label="Dokumentasi" className="flex flex-col gap-4 border-t border-line-soft px-2 py-3">
          <Groups pathname={pathname} />
        </nav>
      </details>
      <nav aria-label="Dokumentasi" className="hidden flex-col gap-4 lg:sticky lg:top-6 lg:flex">
        <Groups pathname={pathname} />
      </nav>
    </>
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
