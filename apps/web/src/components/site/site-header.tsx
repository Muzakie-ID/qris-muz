import Link from "next/link";
import { cookies } from "next/headers";
import { QrCode } from "lucide-react";
import { SESSION_COOKIE, looksLikeSession } from "@/lib/session";

/** Header publik (landing page dan dokumentasi). Owner yang sudah login langsung diarahkan ke dashboard. */
export async function SiteHeader() {
  const loggedIn = looksLikeSession((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <Link href="/" className="flex items-center gap-2" aria-label="qrismuz, halaman utama">
        <QrCode className="size-[22px]" strokeWidth={2} aria-hidden />
        <span className="text-lg font-semibold tracking-[-0.03em]">qrismuz</span>
      </Link>
      <nav aria-label="Utama" className="flex items-center gap-1 text-[13px] sm:gap-2">
        <Link href="/#cara-kerja" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:inline-flex">
          Cara kerja
        </Link>
        <Link href="/#fitur" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:inline-flex">
          Fitur
        </Link>
        <Link href="/docs" className="rounded-full px-3 py-2 text-muted hover:text-ink">
          Dokumentasi
        </Link>
        <Link
          href={loggedIn ? "/dashboard" : "/login"}
          className="inline-flex h-9 items-center rounded-full bg-ink px-4 font-medium text-white hover:bg-black"
        >
          {loggedIn ? "Buka dashboard" : "Masuk"}
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-3 px-5 py-8 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <p>qrismuz, gateway QRIS pribadi untuk proyek-proyek Muzakie.</p>
      <nav aria-label="Kaki halaman" className="flex gap-4">
        <Link href="/docs" className="hover:text-ink">Dokumentasi</Link>
        <Link href="/docs/api" className="hover:text-ink">API</Link>
        <Link href="/login" className="hover:text-ink">Masuk owner</Link>
      </nav>
    </footer>
  );
}
