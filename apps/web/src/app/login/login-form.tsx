"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions";

const input = "h-11 rounded-xl border border-line px-3 outline-none focus:border-ink";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  const totp = !!state.challenge;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      {totp ? (
        <>
          <input type="hidden" name="challenge" value={state.challenge} />
          <p className="text-muted">
            Masukkan kode 6 digit dari aplikasi authenticator untuk <strong className="font-medium">{state.email}</strong>.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium">Kode 2FA</span>
            <input
              key="code"
              name="code"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              placeholder="123456"
              className={`${input} font-mono text-base tracking-[0.3em]`}
            />
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium">Email</span>
            <input
              key="email"
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="username"
              defaultValue={state.email}
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium">Password</span>
            <input type="password" name="password" required autoComplete="current-password" className={input} />
          </label>
        </>
      )}
      {state.error && (
        <p role="alert" className="text-bad">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-ink font-medium text-white hover:bg-black disabled:opacity-60"
      >
        {pending ? "Memeriksa…" : totp ? "Verifikasi" : "Masuk"}
      </button>
    </form>
  );
}
