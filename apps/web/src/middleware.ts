import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, looksLikeSession } from "@/lib/session";

/** Halaman yang bisa dibuka tanpa login: landing page dan dokumentasi. */
function isPublic(pathname: string) {
  return pathname === "/" || pathname === "/docs" || pathname.startsWith("/docs/") || pathname === "/robots.txt";
}

/**
 * Dashboard wajib login. Di sini hanya dicek ada-tidaknya cookie sesi; keabsahannya diperiksa
 * backend di setiap request, dan sesi yang ditolak diarahkan ke /login.
 * Halaman bayar pembeli (/pay), landing page, dan dokumentasi tetap publik.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname) || looksLikeSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/dashboard" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|pay/|_next/|favicon.ico|icon|opengraph-image).*)"],
};
