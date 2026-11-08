"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-warn-bg">
        <TriangleAlert className="size-5 text-warn-icon" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="font-medium">Data dashboard tidak bisa dimuat.</p>
      <p className="max-w-md text-faint">
        {error.message || "Backend tidak menjawab."} Pastikan API berjalan dan API_URL serta ADMIN_TOKEN di web sudah benar.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white"
      >
        <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
        Coba lagi
      </button>
    </div>
  );
}
