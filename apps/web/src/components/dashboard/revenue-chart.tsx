"use client";

import { useState } from "react";
import { Card, SectionHeader } from "@/components/ui";
import { formatRupiah } from "@/lib/format";
import type { MonthlyRevenue } from "@/lib/types";

const W = 640;
const H = 224;
const LEFT = 52;
const RIGHT = 624;
const TOP = 30;
const BOTTOM = 190;

/** Label ringkas: 250 rb, 1,5 jt. */
function short(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (v >= 1_000) return `${(v / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`;
  return String(v);
}

/** Jarak garis bantu yang "bulat" (1, 2, atau 5 × 10ⁿ) agar ada ±4 garis. */
function niceStep(max: number) {
  const raw = Math.max(1, max / 4);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/** Grafik pendapatan per bulan: garis dengan arsiran vertikal, mengikuti gaya referensi. */
export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const [active, setActive] = useState(data.length - 1);

  const step = niceStep(Math.max(...data.map((d) => d.amount), 1000));
  const max = Math.max(step, Math.ceil(Math.max(...data.map((d) => d.amount)) / step) * step);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const x = (i: number) => LEFT + (i * (RIGHT - LEFT)) / Math.max(1, data.length - 1);
  const y = (v: number) => BOTTOM - (v / max) * (BOTTOM - TOP);

  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.amount).toFixed(1)}`);
  const area = `M${points.join(" L")} L${RIGHT},${BOTTOM} L${LEFT},${BOTTOM} Z`;
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const lastDiff = data.length > 1 ? data[data.length - 1].amount - data[data.length - 2].amount : 0;

  const cur = data[active];
  const cx = x(active);
  const cy = y(cur.amount);
  const tipW = 112;
  const tipX = Math.min(RIGHT - tipW, Math.max(LEFT, cx - tipW - 10 < LEFT ? cx + 10 : cx - tipW - 10));
  const tipY = Math.min(BOTTOM - 52, cy + 8);
  const best = data.reduce((a, b) => (b.amount > a.amount ? b : a));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - LEFT) / (RIGHT - LEFT)) * (data.length - 1));
    setActive(Math.min(data.length - 1, Math.max(0, i)));
  };

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHeader title="Pendapatan">
        <span className="text-[13px] text-faint">12 bulan terakhir</span>
      </SectionHeader>

      <Card className="flex flex-col gap-4 px-[22px] py-5">
        <div className="flex flex-col gap-1">
          <span className="text-muted">Total 12 bulan</span>
          <span className="text-[32px] font-medium tracking-[-0.03em] tabular-nums">{formatRupiah(total)}</span>
          <span className="text-[13px] text-faint">
            {lastDiff >= 0 ? "Naik" : "Turun"}{" "}
            <strong className="font-medium text-ink">{formatRupiah(Math.abs(lastDiff))}</strong> dibanding bulan sebelumnya
          </span>
        </div>

        {/* Di layar sempit grafik digeser ke samping agar label tetap terbaca. */}
        <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full min-w-[560px] touch-none"
          role="img"
          aria-label={`Grafik pendapatan per bulan. Tertinggi ${best.label}, ${formatRupiah(best.amount)}.`}
          onMouseMove={onMove}
          onMouseLeave={() => setActive(data.length - 1)}
        >
          <defs>
            <pattern id="arsir" width="5" height="5" patternUnits="userSpaceOnUse">
              <line x1="2" y1="0" x2="2" y2="5" stroke="#c9c9c5" strokeWidth="1" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={LEFT - 8} x2={RIGHT + 4} y1={y(t)} y2={y(t)} stroke="#ececea" />
              <text x={36} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#62625f">
                {t === 0 ? "0" : short(t)}
              </text>
            </g>
          ))}
          <path d={area} fill="url(#arsir)" />
          <polyline points={points.join(" ")} fill="none" stroke="#111111" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <line x1={cx} x2={cx} y1={cy} y2={BOTTOM} stroke="#111111" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="5" fill="#ffffff" stroke="#111111" strokeWidth="2" />
          <g aria-hidden>
            <rect x={tipX} y={tipY} width={tipW} height="48" rx="10" fill="#ffffff" stroke="#e3e3e0" />
            <text x={tipX + 12} y={tipY + 19} fontSize="11" fill="#62625f">
              {cur.label} {cur.month.slice(0, 4)}
            </text>
            <text x={tipX + 12} y={tipY + 38} fontSize="14" fontWeight="500" fill="#111111">
              {short(cur.amount)}
            </text>
          </g>
          {data.map((d, i) => (
            <text key={d.month} x={x(i)} y={212} textAnchor="middle" fontSize="11" fill="#62625f">
              {d.label}
            </text>
          ))}
        </svg>
        </div>
      </Card>
    </section>
  );
}
