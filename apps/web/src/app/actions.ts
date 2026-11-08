"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, createTestTransaction } from "@/lib/api";
import { SESSION_COOKIE, SESSION_TTL_SEC, checkPassword, createSessionValue, verifySessionValue } from "@/lib/session";

export interface FormState {
  error: string | null;
}

/** Hanya jalur internal (mis. /transaksi?status=PAID) yang boleh jadi tujuan setelah login. */
function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (!(await checkPassword(password))) {
    // Jeda kecil memperlambat tebak-tebakan password.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Password salah." };
  }
  (await cookies()).set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function requireSession() {
  if (!(await verifySessionValue((await cookies()).get(SESSION_COOKIE)?.value))) redirect("/login");
}

/** Tombol "Buat transaksi uji": tagihan Rp1.000 di proyek pertama, lalu buka halaman bayarnya. */
export async function createTestPayment(_: FormState, form: FormData): Promise<FormState> {
  await requireSession();
  const amount = Number(form.get("amount") ?? 1000);
  let id: string;
  try {
    id = (await createTestTransaction(Number.isSafeInteger(amount) && amount > 0 ? amount : 1000)).id;
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Gagal membuat transaksi uji." };
  }
  redirect(`/pay/${id}`);
}
