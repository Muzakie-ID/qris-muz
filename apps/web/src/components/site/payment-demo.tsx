"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { BellRing, Check } from "lucide-react";
import { crc16 } from "@/lib/qris-preview";
import { cn } from "@/lib/cn";

/** QRIS statis contoh (merchant fiktif); dijadikan dinamis persis seperti yang dilakukan server. */
const SAMPLE_STATIC =
  "00020101021126660014COM.CONTOH.WWW011893600000000000000102150000000000000010303UMI51440014ID.CO.QRIS.WWW0215ID10200000000010303UMI5204581253033605802ID5911TOKO CONTOH6007JAKARTA61051011062070703A016304A7CD";

function toDynamic(amount: number): string {
  const body = SAMPLE_STATIC.slice(0, -8).replace(/^000201010211/, "000201010212");
  const amt = String(amount);
  const withAmount = body.replace("5303360", `5303360` + `54${String(amt.length).padStart(2, "0")}${amt}`);
  const head = `${withAmount}6304`;
  return head + crc16(head);
}

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

export const DEMO_STEPS = [
  { title: "Tagihan dibuat", body: "Toko meminta tagihan lewat API." },
  { title: "Kode unik ditambahkan", body: "Nominal jadi unik, QR dinamis dibuat." },
  { title: "Pembeli memindai", body: "Bayar dari e-wallet atau m-banking apa pun." },
  { title: "Notifikasi masuk", body: "HP listener meneruskan notifikasi DANA Bisnis." },
  { title: "Lunas otomatis", body: "Halaman bayar berubah, toko menerima webhook." },
] as const;

const DURATION = [1600, 1800, 2200, 1700, 3400];
const BASES = [50_000, 125_000, 35_000, 75_000, 18_500, 240_000];

/** Demo alur pembayaran yang berputar terus. Langkah bisa dipilih manual. */
export function PaymentDemo() {
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) setStep(4);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced || paused) return;
    const t = setTimeout(() => {
      if (step === DEMO_STEPS.length - 1) {
        setRound((r) => r + 1);
        setStep(0);
      } else setStep(step + 1);
    }, DURATION[step]);
    return () => clearTimeout(t);
  }, [step, reduced, paused]);

  const { base, code } = useMemo(() => {
    const base = BASES[round % BASES.length];
    // Kode unik yang "acak" tapi stabil per putaran agar render server dan browser sama.
    const code = ((round * 389 + 87) % 999) + 1;
    return { base, code };
  }, [round]);
  const final = base + code;
  const payload = useMemo(() => toDynamic(final), [final]);
  const full = rupiah(final);
  const tail = String(code).padStart(3, "0").slice(-3);
  const head = full.slice(0, full.length - 3);
  const paid = step >= 4;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_210px] md:items-center">
      {/* Panggung: halaman bayar di HP pembeli */}
      <div className="relative mx-auto w-full max-w-[340px] pt-12">
        <div
          className={cn(
            "relative overflow-hidden rounded-[34px] border bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(17,17,17,0.35)] transition-colors duration-500",
            paid ? "border-ok/40" : "border-line",
          )}
        >
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">Toko Contoh</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-500",
                paid ? "bg-ok-bg text-ok" : "bg-subtle text-ink-2",
              )}
            >
              <span className={cn("size-1.5 rounded-full", paid ? "bg-ok-dot" : "border-[1.5px] border-muted")} aria-hidden />
              {paid ? "Lunas" : "Menunggu"}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-1">
            <span className="text-xs text-faint">Total bayar</span>
            <span className="text-[34px] font-medium leading-none tracking-[-0.04em] tabular-nums" aria-live="polite">
              {step === 0 ? (
                rupiah(base)
              ) : (
                <>
                  {head}
                  <mark key={round} className="demo-mark motion-safe-only rounded-md bg-transparent px-0.5 text-ink">
                    {tail}
                  </mark>
                </>
              )}
            </span>
            <span className="text-xs text-faint">
              {step === 0 ? "Menyiapkan kode unik…" : `Termasuk kode unik ${code}. Bayar tepat sampai 3 digit terakhir.`}
            </span>
          </div>

          <div className="relative mt-5 aspect-square w-full overflow-hidden rounded-2xl border border-line-soft bg-white p-3">
            {paid ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <span key={round} className="motion-safe-only flex size-16 items-center justify-center rounded-full bg-ok text-white [animation:demo-pop_500ms_ease-out_both]">
                  <Check className="size-8" strokeWidth={2.5} aria-hidden />
                </span>
                <span className="text-lg font-medium tracking-[-0.02em]">Pembayaran diterima</span>
                <span className="text-xs text-faint">Kembali ke toko dalam 3 detik…</span>
              </div>
            ) : (
              <>
                <QRCodeSVG
                  value={payload}
                  size={512}
                  marginSize={0}
                  title="QR contoh"
                  className={cn("h-full w-full transition-[filter,opacity] duration-700", step === 0 && "opacity-20 blur-[6px]")}
                />
                {step === 2 && (
                  <span
                    key={round}
                    aria-hidden
                    className="motion-safe-only absolute inset-x-3 top-3 h-0.5 rounded-full bg-ok shadow-[0_0_18px_4px_rgba(31,157,85,0.45)] [--scan-distance:260px] [animation:demo-scan_1.6s_ease-in-out_infinite]"
                  />
                )}
              </>
            )}
          </div>
          <p className="mt-3 text-center text-[11px] text-faint">QR contoh dengan merchant fiktif, tidak bisa dibayar.</p>
        </div>

        {/* Notifikasi DANA Bisnis di HP listener */}
        {step >= 3 && (
          <div
            key={`n${round}`}
            className="motion-safe-only absolute -right-2 left-6 top-0 flex items-start gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-[0_18px_40px_-18px_rgba(17,17,17,0.45)] backdrop-blur [animation:demo-drop_480ms_cubic-bezier(0.2,0.8,0.2,1)_both] sm:-right-10"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#108ee9] text-white">
              <BellRing className="size-4" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 text-[13px] leading-snug">
              <p className="font-medium">DANA Bisnis · Pembayaran Masuk</p>
              <p className="text-muted">{full} diterima DANA Bisnis.</p>
            </div>
          </div>
        )}

        {/* Webhook ke server toko */}
        <div className="mt-4 overflow-hidden rounded-2xl bg-[#18181a] px-4 py-3 font-mono text-[11.5px] leading-relaxed text-[#d4d4cf]">
          <p className="text-[#8f8f8a]">POST tokocontoh.id/webhooks/qrismuz</p>
          {paid ? (
            <p key={round} className="motion-safe-only [animation:demo-line_700ms_steps(28)_both]">
              <span className="text-[#7ee2a2]">transaction.paid</span> {full.replace("Rp", "")} → 200 OK
            </p>
          ) : (
            <p className="text-[#8f8f8a]">menunggu pembayaran…</p>
          )}
        </div>
      </div>

      {/* Langkah-langkah, sinkron dengan panggung */}
      <ol className="flex flex-col gap-1" aria-label="Langkah demo">
        {DEMO_STEPS.map((s, i) => {
          const on = i === step;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => {
                  setStep(i);
                  setPaused(true);
                }}
                aria-current={on ? "step" : undefined}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                  on ? "bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "hover:bg-surface/60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                    i < step || (paid && i === step) ? "bg-ok text-white" : on ? "bg-ink text-white" : "bg-line text-muted",
                  )}
                >
                  {i < step || (paid && i === step) ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className="flex flex-col">
                  <span className={cn("text-[13px] font-medium", on ? "text-ink" : "text-muted")}>{s.title}</span>
                  <span className={cn("text-xs text-faint transition-[max-height,opacity] duration-300", on ? "max-h-10 opacity-100" : "max-h-0 overflow-hidden opacity-0 md:max-h-10 md:opacity-60")}>
                    {s.body}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {paused && !reduced && (
          <li>
            <button type="button" onClick={() => setPaused(false)} className="px-3 py-1 text-xs font-medium text-muted underline underline-offset-2 hover:text-ink">
              Putar lagi otomatis
            </button>
          </li>
        )}
      </ol>
    </div>
  );
}
