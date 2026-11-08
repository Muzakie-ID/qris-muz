"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(text).then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      })}
      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#c9c9c4] hover:bg-white/10 hover:text-white"
      aria-label="Salin kode"
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />}
      {done ? "Tersalin" : "Salin"}
    </button>
  );
}

/** Blok kode gelap dengan tombol salin. */
export function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-xl bg-[#18181a] text-[#ececea]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-xs text-[#a3a39e]">{title ?? ""}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Contoh kode yang sama dalam beberapa bahasa. */
export function CodeTabs({ tabs }: { tabs: { label: string; code: string }[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];
  return (
    <div className="overflow-hidden rounded-xl bg-[#18181a] text-[#ececea]">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1">
        <div role="tablist" className="flex flex-wrap gap-0.5">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs",
                i === active ? "bg-white/15 font-medium text-white" : "text-[#a3a39e] hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyButton text={tab.code} />
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed">
        <code>{tab.code}</code>
      </pre>
    </div>
  );
}
