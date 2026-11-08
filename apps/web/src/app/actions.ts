"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ApiError, apiLogin, apiLoginTotp, apiLogout, createTestTransaction, type LoginResponse } from "@/lib/api";
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE_SEC, looksLikeSession } from "@/lib/session";

export interface FormState {
  error: string | null;
}

export interface LoginState extends FormState {
  /** Diisi setelah password benar dan akun memakai 2FA. */
  challenge?: string;
  email?: string;
}

/** Hanya jalur internal (mis. /transaksi?status=PAID) yang boleh jadi tujuan setelah login. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

async function startSession(r: Extract<LoginResponse, { status: "ok" }>) {
  (await cookies()).set(SESSION_COOKIE, r.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SEC,
  });
}

/** Langkah 1: email + password. Langkah 2 (bila 2FA aktif): kode dari aplikasi authenticator. */
export async function login(prev: LoginState, form: FormData): Promise<LoginState> {
  const challenge = String(form.get("challenge") ?? "");
  let r: LoginResponse;
  try {
    r = challenge
      ? await apiLoginTotp(challenge, String(form.get("code") ?? "").replace(/\s/g, ""))
      : await apiLogin(String(form.get("email") ?? "").trim(), String(form.get("password") ?? ""));
  } catch (e) {
    const message = e instanceof ApiError ? e.message : "Gagal masuk. Coba lagi.";
    // Tantangan 2FA kedaluwarsa: mulai lagi dari password.
    const restart = challenge && /kedaluwarsa/i.test(message);
    return {
      error: message,
      challenge: restart ? undefined : challenge || undefined,
      email: String(form.get("email") ?? "") || prev.email,
    };
  }
  if (r.status === "totp_required") {
    return { error: null, challenge: r.challenge, email: String(form.get("email") ?? "") };
  }
  await startSession(r);
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (looksLikeSession(token)) await apiLogout(token).catch(() => undefined);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

/** Backend memeriksa sesi di setiap panggilan; di sini cukup memastikan cookie ada. */
export async function requireSession() {
  if (!looksLikeSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
}

/** Tombol "Buat transaksi uji": tagihan Rp1.000 di proyek pertama, lalu buka halaman bayarnya. */
export async function createTestPayment(_: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const amount = Number(form.get("amount") ?? 1000);
  let id: string;
  try {
    id = (await createTestTransaction(Number.isSafeInteger(amount) && amount > 0 ? amount : 1000)).id;
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof ApiError ? e.message : "Gagal membuat transaksi uji." };
  }
  redirect(`/pay/${id}`);
}
