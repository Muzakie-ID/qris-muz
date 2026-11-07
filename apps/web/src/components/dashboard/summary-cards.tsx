"use client";

import { useState } from "react";
import { Segmented } from "@/components/segmented";
import { SectionHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Period, SummaryCard } from "@/lib/types";

const PERIODS: { value: Period; label: string }[] = [
  { value: "day", label: "Hari" },
  { value: "week", label: "Minggu" },
  { value: "month", label: "Bulan" },
];

const TREND_STYLE: Record<SummaryCard["trend"], string> = {
  up: "bg-ok-bg text-ok",
  down: "bg-bad-bg text-bad",
  neutral: "bg-subtle text-muted",
};

export function SummaryCards({ data }: { data: Record<Period, SummaryCard[]> }) {
  const [period, setPeriod] = useState<Period>("week");

  return (
    <section className="flex flex-col gap-3.5" aria-labelledby="ringkasan">
      <SectionHeader title="Ringkasan">
        <Segmented label="Periode" options={PERIODS} value={period} onChange={setPeriod} />
      </SectionHeader>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
        {data[period].map((c) => (
          <div key={c.key} className="flex min-w-0 flex-col gap-2.5 bg-surface px-[22px] py-5">
            <span className="text-muted">{c.label}</span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[28px] font-medium tracking-[-0.03em] tabular-nums">{c.value}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", TREND_STYLE[c.trend])}>{c.delta}</span>
            </div>
            <span className="text-[13px] text-faint">{c.hint}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
