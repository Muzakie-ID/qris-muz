"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Check, Clock, Copy, ShieldCheck } from "lucide-react";
import type { CheckoutData } from "@/lib/api";
import { formatCountdown, formatRupiah, splitUniqueCode } from "@/lib/format";
import type { TransactionStatus } from "@/lib/types";

type View = "waiting" | "paid" | "expired";

const REDIRECT_SECONDS = 3;

function viewOf(status: TransactionStatus, payable: boolean): View {
  if (status === "PAID" || status === "LATE_PAID") return "paid";
  if (status === "PENDING" && payable) return "waiting";
  return "expired";
}

export function CheckoutView({ initial, apiUrl }: { initial: CheckoutData; apiUrl: string }) {
  // Selisih jam browser dan server, agar hitung mundur tidak terpengaruh jam HP pembeli.
  const [offset] = useState(() => new Date(initial.server_time).getTime() - Date.now());
  const expiresAt = useMemo(() => new Date(initial.expires_at).getTime(), [initial.expires_at]);
  const [status, setStatus] = useState<TransactionStatus>(initial.status);
  const [left, setLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const view = viewOf(status, initial.qris_payload !== null && (left === null || left > 0));

  // Hitung mundur.
  useEffect(() => {
    if (view !== "waiting") return;
    const tick = () => setLeft(Math.max(0, Math.round((expiresAt - (Date.now() + offset)) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [view, expiresAt, offset]);

  // Status realtime dari server (SSE); bila SSE gagal, cek berkala.
  useEffect(() => {
    if (initial.status !== "PENDING") return;
    let poll: ReturnType<typeof setInterval> | undefined;
    const source = new EventSource(`${apiUrl}/public/checkout/${initial.id}/events`);
    source.addEventListener("status", (e) => {
      try {
        setStatus((JSON.parse((e as MessageEvent<string>).data) as { status: TransactionStatus }).status);
      } catch {
        // abaikan pesan rusak
      }
    });
    source.onerror = () => {
      if (poll) return;
      poll = setInterval(async () => {
        try {
          const res = await fetch(`${apiUrl}/public/checkout/${initial.id}`, { cache: "no-store" });
          if (res.ok) setStatus(((await res.json()) as CheckoutData).status);
        } catch {
          // coba lagi di putaran berikutnya
        }
      }, 10_000);
    };
    return () => {
      source.close();
      if (poll) clearInterval(poll);
    };
  }, [apiUrl, initial.id, initial.status]);

  // Setelah lunas, kembali otomatis ke proyek.
  useEffect(() => {
    if (view !== "paid" || !initial.return_url) return;
    setRedirectIn(REDIRECT_SECONDS);
    const id = setInterval(() => {
      setRedirectIn((s) => {
        if (s === null) return s;
        if (s <= 1) {
          clearInterval(id);
          window.location.href = initial.return_url!;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [view, initial.return_url]);

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(initial.final_amount));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const { head, tail } = splitUniqueCode(initial.final_amount);
  const back = initial.return_url;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-3 p-4">
      <header className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-ink font-semibold text-white">
            {initial.project_name.charAt(0).toUpperCase()}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-medium">{initial.project_name}</span>
            <span className="text-xs text-faint">{initial.merchant_ref}</span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
          Pembayaran QRIS
        </span>
      </header>

      {view === "waiting" && initial.qris_payload && (
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
                  value={initial.qris_payload}
                  size={220}
                  marginSize={1}
                  level="M"
                  fgColor="#111111"
                  role="img"
                  aria-label={`Kode QR pembayaran ${formatRupiah(initial.final_amount)}`}
                />
              </div>
              <span className="text-center text-xs text-faint">
                Dibayar ke {initial.merchant_name}
                {initial.nmid ? ` · NMID ${initial.nmid}` : ""}
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
                Pastikan nominal <strong className="font-medium">{formatRupiah(initial.final_amount)}</strong>, lalu bayar.
              </li>
            </ol>
          </section>

          <div className="flex items-center gap-2.5 px-1.5 py-1 text-[13px] text-muted" role="status">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-warn-dot" aria-hidden />
            Menunggu pembayaran. Halaman ini pindah otomatis setelah lunas.
          </div>
        </>
      )}

      {view === "paid" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-line bg-surface px-[22px] py-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-ok-bg">
            <Check className="size-[30px] text-ok" strokeWidth={2} aria-hidden />
          </span>
          <h1 className="text-[22px] font-medium tracking-[-0.02em]">Pembayaran diterima</h1>
          <span className="text-[30px] font-medium tracking-[-0.03em] tabular-nums">{formatRupiah(initial.final_amount)}</span>
          <p className="leading-relaxed text-muted" role="status">
            {initial.merchant_ref} sudah lunas.
            {back && redirectIn !== null && (
              <>
                <br />
                Kembali ke {initial.project_name} dalam {redirectIn} detik.
              </>
            )}
          </p>
          {back && (
            <a href={back} className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white">
              Kembali ke {initial.project_name}
              <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
            </a>
          )}
        </section>
      )}

      {view === "expired" && (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[20px] border border-line bg-surface px-[22px] py-8 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-subtle">
            <Clock className="size-7 text-muted" strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="text-[22px] font-medium tracking-[-0.02em]">
            {status === "CANCELLED" ? "Tagihan dibatalkan" : "Tagihan kedaluwarsa"}
          </h1>
          <p className="leading-relaxed text-muted">
            {status === "CANCELLED" ? `Tagihan ${initial.merchant_ref} sudah dibatalkan` : `Batas waktu pembayaran ${initial.merchant_ref} sudah lewat`}
            , jadi QR tidak ditampilkan lagi. Buat pesanan baru di {initial.project_name} untuk mendapatkan tagihan baru.
          </p>
          {back && (
            <a href={back} className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-white">
              Kembali ke {initial.project_name}
            </a>
          )}
        </section>
      )}

      <footer className="mt-auto pb-1 text-center text-xs text-faint">Diproses oleh qrismuz · QRIS</footer>
    </div>
  );
}
