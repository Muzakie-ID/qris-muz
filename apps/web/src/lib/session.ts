/**
 * Sesi owner. Cookie berisi token sesi dari backend (`qms_…`); backend yang memeriksa keabsahan,
 * masa berlaku, dan pencabutannya. Web hanya menyimpan dan meneruskannya.
 */
export const SESSION_COOKIE = "qm_session";
/** Batas umur cookie; sesi di backend berakhir lebih cepat bila 12 jam tidak dipakai. */
export const SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 3600;

export function looksLikeSession(value: string | undefined): value is string {
  return !!value && /^qms_[A-Za-z0-9_-]{20,}$/.test(value);
}
