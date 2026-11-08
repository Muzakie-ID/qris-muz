"use client";

import { useActionState } from "react";
import { FlaskConical } from "lucide-react";
import { createTestPayment, type FormState } from "@/app/actions";

/** Membuat tagihan uji Rp1.000 sungguhan lewat backend, lalu membuka halaman bayarnya. */
export function TestPaymentButton() {
  const [state, action, pending] = useActionState<FormState, FormData>(createTestPayment, { error: null });
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="amount" value="1000" />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-[18px] font-medium text-white hover:bg-black disabled:opacity-60"
      >
        <FlaskConical className="size-4" strokeWidth={1.75} aria-hidden />
        {pending ? "Membuat…" : "Buat transaksi uji"}
      </button>
      {state.error && (
        <p role="alert" className="max-w-[320px] text-right text-[13px] text-bad">
          {state.error}
        </p>
      )}
    </form>
  );
}
