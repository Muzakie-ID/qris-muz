"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, TriangleAlert, X } from "lucide-react";

/** Muncul hanya saat ada notifikasi yang gagal dibaca parser. */
export function ParserBanner({ count }: { count: number }) {
  const [open, setOpen] = useState(true);
  if (!open || count === 0) return null;

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[#ebebe8] bg-[#f6f6f4] py-3 pl-4 pr-3">
      <TriangleAlert className="size-[18px] shrink-0 text-warn-icon" strokeWidth={1.75} aria-hidden />
      <p className="min-w-[200px] flex-1">
        {count} notifikasi tidak terbaca parser. Perbarui parser agar pembayarannya bisa dicocokkan.
      </p>
      <Link
        href="/parser"
        className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-medium hover:border-[#cfcfcb]"
      >
        Buka parser
        <ArrowUpRight className="size-3.5" strokeWidth={1.75} aria-hidden />
      </Link>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Tutup pemberitahuan"
        className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-subtle"
      >
        <X className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
