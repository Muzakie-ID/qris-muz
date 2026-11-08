import Link from "next/link";
import { CircleAlert, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/cn";

/** Komponen teks dokumentasi. */

export function DocTitle({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="flex flex-col gap-2 border-b border-line-soft pb-5">
      <h1 className="text-[28px] font-medium tracking-[-0.03em]">{title}</h1>
      <p className="max-w-[68ch] text-[15px] leading-relaxed text-muted">{lead}</p>
    </header>
  );
}

function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function H2({ children }: { children: string }) {
  const id = slug(children);
  return (
    <h2 id={id} className="group mt-4 scroll-mt-6 text-lg font-medium tracking-[-0.02em]">
      <a href={`#${id}`} className="hover:underline">
        {children}
      </a>
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-2 font-medium">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[72ch] leading-relaxed text-ink-2">{children}</p>;
}

export function C({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[12.5px] text-ink">{children}</code>;
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium underline decoration-line underline-offset-2 hover:decoration-ink">
      {children}
    </Link>
  );
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="flex max-w-[72ch] list-disc flex-col gap-1.5 pl-5 leading-relaxed text-ink-2">{children}</ul>;
}

/** Langkah bernomor dengan judul tebal. */
export function Steps({ items }: { items: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="flex max-w-[76ch] flex-col gap-4">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <span className="font-medium">{s.title}</span>
            <div className="flex flex-col gap-2 leading-relaxed text-ink-2">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "tip"; title?: string; children: React.ReactNode }) {
  const style = {
    info: { box: "border-line bg-subtle", icon: Info, color: "text-ink-2" },
    warn: { box: "border-warn-dot/40 bg-warn-bg", icon: CircleAlert, color: "text-warn" },
    tip: { box: "border-ok/30 bg-ok-bg", icon: Lightbulb, color: "text-ok" },
  }[tone];
  const Icon = style.icon;
  return (
    <div className={cn("flex max-w-[76ch] gap-2.5 rounded-xl border px-4 py-3", style.box)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.color)} strokeWidth={1.75} aria-hidden />
      <div className="flex flex-col gap-1 leading-relaxed text-ink-2">
        {title && <span className={cn("font-medium", style.color)}>{title}</span>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Tabel sederhana untuk field API, status, dsb. */
export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#fafaf9] text-left text-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-line px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="border-b border-line-soft px-4 py-2.5 align-top leading-relaxed last:border-b-0 [tr:last-child_&]:border-b-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
