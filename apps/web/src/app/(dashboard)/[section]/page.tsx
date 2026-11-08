import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PLACEHOLDER_SECTIONS } from "@/lib/nav";

/** Halaman sementara untuk menu yang belum dibangun. */

export function generateStaticParams() {
  return PLACEHOLDER_SECTIONS.map((s) => ({ section: s.href.slice(1) }));
}

export const dynamicParams = false;

function find(section: string) {
  return PLACEHOLDER_SECTIONS.find((s) => s.href === `/${section}`);
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const item = find((await params).section);
  return { title: item?.label ?? "Tidak ditemukan" };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const item = find((await params).section);
  if (!item) notFound();
  const Icon = item.icon;

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-[28px] font-medium tracking-[-0.03em]">{item.label}</h1>
        <p className="text-faint">{item.description}</p>
      </header>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-line">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="font-medium">Halaman ini belum dibangun.</p>
        <p className="max-w-md text-faint">
          Halaman ini menyusul. Untuk sekarang, kelola proyek, perangkat, QRIS, dan parser dari menu lainnya.
        </p>
        <Link href="/transaksi" className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white">
          Buka Transaksi
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </>
  );
}
