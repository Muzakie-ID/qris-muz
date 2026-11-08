"use client";

import { startTransition, useActionState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { totpEnableAction, totpSetupAction, type ActionResult } from "@/app/admin-actions";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { btnPrimary, hintCls, inputCls, labelCls } from "@/lib/styles";

/** Pendaftaran 2FA: tampilkan QR otpauth, lalu minta satu kode untuk memastikan HP sudah benar. */
export function TotpSetup() {
  const [state, run, pending] = useActionState<ActionResult, void>(() => totpSetupAction(), { error: null });
  const totp = state.error ? undefined : state.totp;

  if (!totp) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" disabled={pending} onClick={() => startTransition(() => run())} className={btnPrimary}>
          {pending ? "Menyiapkan…" : "Nyalakan 2FA"}
        </button>
        {state.error && (
          <p role="alert" className="text-[13px] text-bad">
            {state.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="rounded-xl border border-line p-2">
        <QRCodeSVG value={totp.otpauth_uri} size={168} marginSize={1} title="QR 2FA" />
      </div>
      <div className="flex min-w-0 flex-1 basis-[260px] flex-col gap-3">
        <ol className="list-decimal space-y-1 pl-4 text-[13px] text-muted">
          <li>Buka Google Authenticator, Authy, atau aplikasi serupa di HP pribadi (bukan HP listener).</li>
          <li>Pindai QR ini. Bila tidak bisa, ketik kunci di bawah secara manual.</li>
          <li>Masukkan kode 6 digit yang muncul.</li>
        </ol>
        <code className="break-all rounded-lg bg-subtle px-2.5 py-2 font-mono text-xs tracking-wider">
          {totp.secret.match(/.{1,4}/g)?.join(" ")}
        </code>
        <ActionForm action={totpEnableAction} className="flex flex-wrap items-end gap-2">
          <label className={`${labelCls} w-40`}>
            Kode 6 digit
            <input
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              className={`${inputCls} font-mono tracking-[0.25em]`}
            />
          </label>
          <SubmitButton className={btnPrimary} pendingLabel="Memeriksa…">
            Aktifkan
          </SubmitButton>
        </ActionForm>
        <p className={hintCls}>
          Bila HP authenticator hilang, 2FA hanya bisa dimatikan dari server: <code className="font-mono">owner-cli.js disable-2fa</code>.
        </p>
      </div>
    </div>
  );
}
