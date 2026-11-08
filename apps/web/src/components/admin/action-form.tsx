"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, KeyRound } from "lucide-react";
import type { ActionResult } from "@/app/admin-actions";
import { cn } from "@/lib/cn";

const INITIAL: ActionResult = { error: null };

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/**
 * Form untuk server action halaman pengelolaan. Menampilkan error, pesan sukses, dan secret
 * sekali-tampil. Isian tidak dihapus saat gagal, agar owner cukup memperbaiki yang salah.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  resetOnSuccess = false,
  closeOnSuccess = false,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  /** Pertanyaan konfirmasi sebelum mengirim, untuk aksi yang tidak bisa dibatalkan. */
  confirm?: string;
  resetOnSuccess?: boolean;
  /** Menutup <details> atau <dialog> pembungkus setelah berhasil (form ubah). */
  closeOnSuccess?: boolean;
}) {
  const [state, run] = useActionState(action, INITIAL);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.at || state.error) return;
    if (resetOnSuccess) ref.current?.reset();
    if (closeOnSuccess) {
      ref.current?.closest("details")?.removeAttribute("open");
      ref.current?.closest("dialog")?.close();
    }
  }, [state, resetOnSuccess, closeOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        // Ikutkan tombol yang ditekan (name/value), mis. pilihan perintah device.
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => run(data));
      }}
    >
      {children}
      <ActionFeedback state={state} />
    </form>
  );
}

export function ActionFeedback({ state }: { state: ActionResult }) {
  return (
    <>
      {state.error && (
        <p role="alert" className="basis-full text-[13px] text-bad">
          {state.error}
        </p>
      )}
      {state.message && !state.error && (
        <p role="status" className="basis-full text-[13px] text-ok">
          {state.message}
        </p>
      )}
      {state.secret && !state.error && <SecretReveal key={state.at} label={state.secret.label} value={state.secret.value} />}
    </>
  );
}

/** Tombol kirim yang ikut nonaktif selama action berjalan. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Secret yang hanya ditampilkan sekali (API key, webhook secret). */
export function SecretReveal({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div role="status" className="flex basis-full flex-col gap-2 rounded-xl border border-warn-dot/40 bg-warn-bg px-3.5 py-3">
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-warn">
        <KeyRound className="size-4" strokeWidth={1.75} aria-hidden />
        {label}: salin sekarang, tidak akan ditampilkan lagi.
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-2.5 py-2 font-mono text-xs">{value}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => setCopied(true));
          }}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-medium",
            copied && "text-ok",
          )}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" strokeWidth={1.75} aria-hidden />}
          {copied ? "Tersalin" : "Salin"}
        </button>
        <button type="button" onClick={() => setHidden(true)} className="h-9 px-2 text-[13px] text-muted hover:text-ink">
          Sudah disimpan
        </button>
      </div>
    </div>
  );
}
