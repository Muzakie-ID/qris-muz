"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Check, Clock, Copy, ShieldCheck } from "lucide-react";
import { formatCountdown, formatRupiah, splitUniqueCode } from "@/lib/format";
import type { Transaction } from "@/lib/types";

type View = "waiting" | "paid" | "expired";

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function CheckoutView({ tx, demo }: { tx: Transaction; demo: boolean }) {
  // Mode demo: hitung mundur 15 menit dari saat halaman dibuka, karena data contohnya statis.
  const [deadline] = useState(() =>
    demo ? new Date(Date.now() + 15 * 60_000).toISOString() : tx.expiresAt,
  );
  const initial: View = tx.status === "PAID" || tx.status === "LATE_PAID" ? "paid" : tx.status === "PENDING" ? "waiting" : "expired";
  const [view, setView] = useState<View>(initial);
  const [left, setLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (view !== "waiting") return;
    const tick = () => {
      const s = secondsLeft(deadline);
      setLeft(s);
      if (s === 0) setView("expired");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [view, deadline]);

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(tx.finalAmount));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const { head, tail } = splitUniqueCode(tx.finalAmount);
  const back = tx.returnUrl ?? "#";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-3 p-4">
      <header className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-ink font-semibold text-white">
            {tx.projectName.charAt(0)}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-medium">{tx.projectName}</span>
            <span className="text-xs text-faint">{tx.merchantRef}</span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
          Pembayaran QRIS
        </span>
      </header>

      {view === "waiting" && (
        <>
          <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-[18px]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-muted">Total bayar</span>
                <span className="text-[30px] font-medium tracking-[-0.03em] tabular-nums">
                  {head}
                  <mark className="rounded-md bg-warn-bg px-0.5 text-ink">{tail}</mark>
                </span>
              </div>
              <button
                type="button"
                onClick={copyAmount}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px]"
              >
                {copied ? <Check className="size-[15px]" strokeWidth={1.75} aria-hidden /> : <Copy className="size-[15px]" strokeWidth={1.75} aria-hidden />}
                <span aria-live="polite">{copied ? "Tersalin" : "Salin"}</span>
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              Bayar persis sampai 3 digit terakhir agar pembayaranmu terkonfirmasi otomatis.
            </p>

            <div className="flex flex-col items-center gap-2.5 border-t border-line-soft pb-1 pt-3.5">
              <div className="rounded-2xl border border-line bg-surface p-2.5">
                <QRCodeSVG
                  value={tx.qrisPayload}
                  size={196}
                  marginSize={1}
                  level="M"
                  fgColor="#111111"
                  role="img"
                  aria-label={`Kode QR pembayaran ${formatRupiah(tx.finalAmount)}`}
                />
              </div>
              <span className="text-center text-xs text-faint">
                Dibayar ke {tx.merchantName} · NMID {tx.nmid}
              </span>
              <span className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-subtle px-3 text-[13px]">
                <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
                Selesaikan dalam{" "}
                <strong className="font-medium tabular-nums">{left === null ? "…" : formatCountdown(left)}</strong>
              </span>
            </div>
          </section>

          <section className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface px-[18px] py-4">
            <h2 className="font-medium">Cara bayar</h2>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 leading-snug text-ink-2">
              <li>Buka aplikasi e-wallet atau m-banking apa pun.</li>
              <li>Scan QR di atas.</li>
              <li>
                Pastikan nominal <strong className="font-medium">{formatRupiah(tx.finalAmount)}</strong>, lalu bayar.
              </li>
            </ol>
          </section>

          <div className="flex items-center gap-2.5 px-1.5 py-1 text-[13px] text-muted" role="status">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-warn-dot" aria-hidden />
            Menunggu pembayaran. Halaman ini pindah otomatis setelah lunas.
          </div>

          {demo && (
            <button
              type="button"
              onClick={() => setView("paid")}
              className="h-11 rounded-full border border-dashed border-[#bdbdb9] text-[13px] text-muted hover:text-ink"
            >
              Simulasikan lunas (khusus demo)
            </button>
          )}
        </>
      )}

      {view === "paid" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-line bg-surface px-[22px] py-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-ok-bg">
            <Check className="size-[30px] text-ok" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="text-[22px] font-medium tracking-[-0.02em]">Pembayaran diterima</h1>
          <span className="text-[30px] font-medium tracking-[-0.03em] tabular-nums">{formatRupiah(tx.finalAmount)}</span>
          <p className="leading-relaxed text-muted">
            {tx.merchantRef} sudah lunas.
            <br />
            Kamu bisa kembali ke {tx.projectName} sekarang.
          </p>
          <a href={back} className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white">
            Kembali ke {tx.projectName}
            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
          </a>
          {demo && (
            <button type="button" onClick={() => setView("waiting")} className="h-10 px-3.5 text-[13px] text-faint underline">
              Ulangi simulasi
            </button>
          )}
        </section>
      )}

      {view === "expired" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[20px] border border-line bg-surface px-[22px] py-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-subtle">
            <Clock className="size-7 text-muted" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="text-[22px] font-medium tracking-[-0.02em]">Tagihan kedaluwarsa</h1>
          <p className="leading-relaxed text-muted">
            Batas waktu pembayaran {tx.merchantRef} sudah lewat, jadi QR tidak ditampilkan lagi. Buat pesanan baru di {tx.projectName}{" "}
            untuk mendapatkan tagihan baru.
          </p>
          <a href={back} className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white">
            Kembali ke {tx.projectName}
          </a>
        </section>
      )}

      <footer className="mt-auto pb-1 text-center text-xs text-faint">Diproses oleh qrismuz · QRIS</footer>
    </div>
  );
}
