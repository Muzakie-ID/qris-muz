"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { btnSecondary } from "@/lib/styles";

/** Dialog modal native untuk form ubah. ActionForm dengan closeOnSuccess menutupnya setelah tersimpan. */
export function EditDialog({
  label,
  title,
  subtitle,
  children,
}: {
  label: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={btnSecondary} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-left text-sm text-ink shadow-xl backdrop:bg-black/25"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-base font-medium">{title}</p>
              {subtitle && <p className="break-all font-mono text-xs text-faint">{subtitle}</p>}
            </div>
            <button
              type="button"
              aria-label="Tutup"
              onClick={() => ref.current?.close()}
              className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-subtle"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
