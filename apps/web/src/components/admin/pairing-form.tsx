"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createPairingAction, type ActionResult } from "@/app/admin-actions";
import { SubmitButton } from "@/components/admin/action-form";
import { formatCountdown } from "@/lib/format";
import { btnPrimary, hintCls, inputCls, labelCls } from "@/lib/styles";

/** Membuat token pairing dan menampilkannya sebagai QR untuk dipindai aplikasi listener. */
export function PairingForm({ serverUrl }: { serverUrl: string }) {
  const [state, run] = useActionState<ActionResult, FormData>(createPairingAction, { error: null });
  const pairing = state.error ? undefined : state.pairing;
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!pairing) return;
    const end = new Date(pairing.expires_at).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pairing]);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => run(data));
        }}
      >
        <label className={`${labelCls} min-w-[220px] flex-1`}>
          Nama perangkat
          <input name="device_name" required maxLength={60} defaultValue="Redmi Note 7" className={inputCls} />
        </label>
        <SubmitButton className={btnPrimary} pendingLabel="Membuat…">
          Buat kode pairing
        </SubmitButton>
        {state.error && (
          <p role="alert" className="basis-full text-[13px] text-bad">
            {state.error}
          </p>
        )}
      </form>

      {pairing && (
        <div className="flex flex-wrap items-center gap-5 rounded-xl border border-line px-4 py-4">
          <div className={left === 0 ? "opacity-30" : undefined}>
            <QRCodeSVG value={pairing.pairing_uri} size={168} marginSize={2} title="QR pairing listener" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-medium">
              {left > 0 ? `Pindai dari aplikasi listener. Berlaku ${formatCountdown(left)} lagi.` : "Kode sudah kedaluwarsa. Buat lagi."}
            </p>
            <p className={hintCls}>
              Di aplikasi listener, tekan Scan QR pairing. Bila kamera bermasalah, isi alamat server dan token di bawah
              secara manual. Token hanya bisa dipakai sekali.
            </p>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-[13px]">
              <dt className="text-faint">Alamat server</dt>
              <dd className="break-all font-mono text-xs">{serverUrl}</dd>
              <dt className="text-faint">Token pairing</dt>
              <dd className="break-all rounded-lg bg-subtle px-2.5 py-1.5 font-mono text-xs">{pairing.token}</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
