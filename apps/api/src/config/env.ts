/**
 * Konfigurasi dari environment. Divalidasi saat aplikasi mulai agar salah
 * setel ketahuan sejak awal, bukan saat transaksi pertama.
 */
export interface Env {
  PORT: number;
  /** QRIS statis milik merchant, hasil scan (teks yang diawali 000201). */
  QRIS_STATIC_PAYLOAD: string | null;
  /** Batas nominal per transaksi dalam rupiah. */
  QRIS_MAX_AMOUNT: number;
  /** Mengaktifkan endpoint alat uji QRIS (/v1/qris/*). Matikan di produksi. */
  QRIS_TOOLS_ENABLED: boolean;
}

function text(raw: unknown): string {
  return typeof raw === 'string' ||
    typeof raw === 'number' ||
    typeof raw === 'boolean'
    ? String(raw)
    : '';
}

function toInt(name: string, raw: unknown, fallback: number): number {
  if (text(raw) === '') return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(
      `${name} harus bilangan bulat positif, sekarang "${text(raw)}".`,
    );
  }
  return n;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const payload =
    typeof config.QRIS_STATIC_PAYLOAD === 'string'
      ? config.QRIS_STATIC_PAYLOAD.trim()
      : '';
  return {
    PORT: toInt('PORT', config.PORT, 3001),
    QRIS_STATIC_PAYLOAD: payload || null,
    // Batas per transaksi QRIS yang umum berlaku saat ini; ubah lewat env bila aturan berubah.
    QRIS_MAX_AMOUNT: toInt(
      'QRIS_MAX_AMOUNT',
      config.QRIS_MAX_AMOUNT,
      10_000_000,
    ),
    QRIS_TOOLS_ENABLED:
      text(config.QRIS_TOOLS_ENABLED).toLowerCase() === 'true',
  };
}
