import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-medium tracking-[-0.03em]">{title}</h1>
        <p className="text-faint">{description}</p>
      </div>
      <Link
        href="/pay/01JC8Q4V7QF2"
        className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-[18px] font-medium text-white hover:bg-black"
      >
        <FlaskConical className="size-4" strokeWidth={1.75} aria-hidden />
        Buat transaksi uji
      </Link>
    </header>
  );
}

export function SectionHeader({
  title,
  href,
  linkLabel = "Lihat semua",
  badge,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-lg font-medium tracking-[-0.02em]">{title}</h2>
        {badge}
      </div>
      {children}
      {href && (
        <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-[13px] font-medium hover:underline">
          {linkLabel}
          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-line bg-surface", className)}>{children}</div>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-[#dcdcd9] px-2 py-0.5 text-[11px] font-medium text-muted">{children}</span>
  );
}
