/**
 * Sesi login dashboard sementara (sampai login owner + 2FA di Tahap 3).
 * Cookie berisi `<kedaluwarsa>.<hmac>`; ditandatangani dengan SESSION_SECRET memakai Web Crypto,
 * jadi bisa dipakai di middleware (edge) maupun server action (Node).
 */
export const SESSION_COOKIE = "qm_session";
export const SESSION_TTL_SEC = 12 * 3600;

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 24 ? s : null;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authConfigured(): boolean {
  return secret() !== null && !!process.env.DASHBOARD_PASSWORD;
}

export async function createSessionValue(now = Date.now()): Promise<string> {
  const s = secret();
  if (!s) throw new Error("SESSION_SECRET belum disetel (minimal 24 karakter).");
  const exp = String(Math.floor(now / 1000) + SESSION_TTL_SEC);
  return `${exp}.${await hmacHex(s, `owner.${exp}`)}`;
}

export async function verifySessionValue(value: string | undefined, now = Date.now()): Promise<boolean> {
  const s = secret();
  if (!s || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;
  return safeEqual(sig, await hmacHex(s, `owner.${exp}`));
}

/** Membandingkan password tanpa membocorkan panjang/isi lewat waktu proses. */
export async function checkPassword(given: string): Promise<boolean> {
  const expected = process.env.DASHBOARD_PASSWORD;
  const s = secret();
  if (!expected || !s) return false;
  return safeEqual(await hmacHex(s, given), await hmacHex(s, expected));
}
