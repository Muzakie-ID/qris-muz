import { headers } from "next/headers";
import { publicApiUrl } from "./api";

/** Alamat dashboard/halaman bayar ini, dari header request (di balik Caddy: https + domain). */
export async function webOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export { publicApiUrl };
