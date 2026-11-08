import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, looksLikeSession } from "@/lib/session";

/**
 * Semua halaman dashboard wajib login. Di sini hanya dicek ada-tidaknya cookie sesi; keabsahannya
 * diperiksa backend di setiap request, dan sesi yang ditolak diarahkan ke /login.
 * Halaman bayar pembeli (/pay) tetap publik.
 */
export function middleware(req: NextRequest) {
  if (looksLikeSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = req.nextUrl.pathname === "/" ? "" : `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|pay/|_next/|favicon.ico).*)"],
};
