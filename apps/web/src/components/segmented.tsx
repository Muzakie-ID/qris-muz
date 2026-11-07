"use client";

import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}

/** Tombol pilihan berbentuk pil, seperti pemilih periode di referensi. */
export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-xl bg-subtle p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-[34px] rounded-[9px] border px-3.5 text-[13px] transition-colors",
              on
                ? "border-line bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1 font-normal text-faint">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
