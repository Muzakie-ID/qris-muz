import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Pil filter berbasis URL, sama dengan yang dipakai halaman Transaksi. */
export function FilterTabs({
  label,
  items,
  current,
}: {
  label: string;
  items: { value: string; label: string; count?: number; href: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-xl bg-subtle p-1">
      {items.map((f) => {
        const on = f.value === current;
        return (
          <Link
            key={f.value}
            href={f.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-[34px] items-center rounded-[9px] border px-3.5 text-[13px] transition-colors",
              on
                ? "border-line bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {f.label}
            {f.count !== undefined && <span className="ml-1 font-normal text-faint">{f.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Pager({
  page,
  perPage,
  total,
  noun,
  hrefFor,
}: {
  page: number;
  perPage: number;
  total: number;
  noun: string;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const arrow = "flex size-9 items-center justify-center rounded-full";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
      <span>{total === 0 ? `0 ${noun}` : `Menampilkan ${from}–${to} dari ${total} ${noun}`}</span>
      <nav aria-label="Halaman" className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} aria-label="Halaman sebelumnya" className={cn(arrow, "hover:bg-subtle")}>
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
        ) : (
          <span className={cn(arrow, "text-faint opacity-50")} aria-hidden>
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </span>
        )}
        <span aria-current="page" className="flex h-9 min-w-9 items-center justify-center rounded-full bg-ink px-3 font-medium text-white">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} aria-label="Halaman berikutnya" className={cn(arrow, "hover:bg-subtle")}>
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
        ) : (
          <span className={cn(arrow, "text-faint opacity-50")} aria-hidden>
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </span>
        )}
      </nav>
    </div>
  );
}

/** Kotak kosong untuk tabel/daftar tanpa isi. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-md text-faint">{children}</p>}
    </div>
  );
}

/** Pil kecil berwarna untuk status selain status transaksi. */
export function Pill({ tone, children }: { tone: "ok" | "bad" | "warn" | "neutral" | "muted"; children: React.ReactNode }) {
  const styles = {
    ok: "bg-ok-bg text-ok",
    bad: "bg-bad-bg text-bad",
    warn: "bg-warn-bg text-warn",
    neutral: "bg-subtle text-ink-2",
    muted: "border border-line bg-surface text-faint",
  } as const;
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", styles[tone])}>
      {children}
    </span>
  );
}

/** Pemisah halaman berbasis URL: buat href dengan parameter tertentu, buang yang kosong. */
export function hrefWith(base: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || (k === "page" && Number(v) <= 1)) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}
