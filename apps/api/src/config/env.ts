/**
 * Konfigurasi dari environment. Divalidasi saat aplikasi mulai agar salah
 * setel ketahuan sejak awal, bukan saat transaksi pertama.
 */
export interface Env {
  PORT: number;
  /** postgres://user:pass@host:5432/db */
  DATABASE_URL: string;
  /** Kunci AES-256 (32 byte, base64 atau hex 64 karakter) untuk mengenkripsi secret di database. */
  APP_ENCRYPTION_KEY: Buffer;
  /** Alamat publik API ini, dipakai untuk qr_image_url. */
  PUBLIC_API_URL: string;
  /** Alamat web app (Next.js), dipakai untuk checkout_url. */
  CHECKOUT_BASE_URL: string;
  /** Token untuk otomasi/skrip ke endpoint admin (opsional). Dashboard memakai login owner. */
  ADMIN_TOKEN: string | null;
  /** QRIS statis untuk alat uji Tahap 1 (opsional). */
  QRIS_STATIC_PAYLOAD: string | null;
  /** Batas nominal per transaksi dalam rupiah. */
  QRIS_MAX_AMOUNT: number;
  /** Mengaktifkan endpoint alat uji QRIS (/v1/qris/*). Matikan di produksi. */
  QRIS_TOOLS_ENABLED: boolean;
  /** Berapa jam nominal unik tetap dikunci setelah transaksi kedaluwarsa. */
  UNIQUE_CODE_GRACE_HOURS: number;
  /** Selisih maksimal jam device dan server untuk request device, dalam detik. */
  DEVICE_CLOCK_TOLERANCE_SEC: number;
  /** Listener dianggap offline bila heartbeat terakhir lebih lama dari ini, dalam detik. */
  LISTENER_OFFLINE_AFTER_SEC: number;
  /** Menjalankan tugas berkala (kedaluwarsa, kirim webhook). Dimatikan di test. */
  JOBS_ENABLED: boolean;
  /**
   * Nilai `trust proxy` Express, agar IP pembeli/owner terbaca benar di balik Caddy dan server web.
   * Bawaan: alamat lokal dan jaringan privat (Docker).
   */
  TRUST_PROXY: string;
  RATE_LIMIT_ENABLED: boolean;
  /** Batas umum request per menit per IP untuk endpoint publik. */
  RATE_LIMIT_PER_MIN: number;
  /** Alamat Bot API Telegram; diganti hanya untuk pengujian. */
  TELEGRAM_API_URL: string;
  /** Alarm bila backup sukses terakhir lebih lama dari ini (jam). */
  BACKUP_MAX_AGE_HOURS: number;
}

function text(raw: unknown): string {
  return typeof raw === 'string' ||
    typeof raw === 'number' ||
    typeof raw === 'boolean'
    ? String(raw).trim()
    : '';
}

function toInt(name: string, raw: unknown, fallback: number): number {
  if (text(raw) === '') return fallback;
  const n = Number(text(raw));
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(
      `${name} harus bilangan bulat positif, sekarang "${text(raw)}".`,
    );
  }
  return n;
}

function toBool(raw: unknown, fallback: boolean): boolean {
  const v = text(raw).toLowerCase();
  return v === '' ? fallback : v === 'true';
}

function required(name: string, raw: unknown): string {
  const v = text(raw);
  if (!v) throw new Error(`${name} wajib diisi.`);
  return v;
}

function toUrl(name: string, raw: unknown, fallback: string): string {
  const v = text(raw) || fallback;
  try {
    new URL(v);
  } catch {
    throw new Error(`${name} bukan URL yang valid: "${v}".`);
  }
  return v.replace(/\/+$/, '');
}

export function parseEncryptionKey(raw: string): Buffer {
  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'APP_ENCRYPTION_KEY harus 32 byte (base64 atau hex 64 karakter). Buat dengan: openssl rand -base64 32',
    );
  }
  return key;
}

export function validateEnv(config: Record<string, unknown>): Env {
  const adminToken = text(config.ADMIN_TOKEN);
  if (adminToken && adminToken.length < 24) {
    throw new Error('ADMIN_TOKEN minimal 24 karakter.');
  }
  return {
    PORT: toInt('PORT', config.PORT, 3001),
    DATABASE_URL: required('DATABASE_URL', config.DATABASE_URL),
    APP_ENCRYPTION_KEY: parseEncryptionKey(
      required('APP_ENCRYPTION_KEY', config.APP_ENCRYPTION_KEY),
    ),
    PUBLIC_API_URL: toUrl(
      'PUBLIC_API_URL',
      config.PUBLIC_API_URL,
      'http://localhost:3001',
    ),
    CHECKOUT_BASE_URL: toUrl(
      'CHECKOUT_BASE_URL',
      config.CHECKOUT_BASE_URL,
      'http://localhost:3000',
    ),
    ADMIN_TOKEN: adminToken || null,
    QRIS_STATIC_PAYLOAD: text(config.QRIS_STATIC_PAYLOAD) || null,
    // Batas per transaksi QRIS yang umum berlaku saat ini; ubah lewat env bila aturan berubah.
    QRIS_MAX_AMOUNT: toInt(
      'QRIS_MAX_AMOUNT',
      config.QRIS_MAX_AMOUNT,
      10_000_000,
    ),
    QRIS_TOOLS_ENABLED: toBool(config.QRIS_TOOLS_ENABLED, false),
    UNIQUE_CODE_GRACE_HOURS: toInt(
      'UNIQUE_CODE_GRACE_HOURS',
      config.UNIQUE_CODE_GRACE_HOURS,
      24,
    ),
    DEVICE_CLOCK_TOLERANCE_SEC: toInt(
      'DEVICE_CLOCK_TOLERANCE_SEC',
      config.DEVICE_CLOCK_TOLERANCE_SEC,
      300,
    ),
    LISTENER_OFFLINE_AFTER_SEC: toInt(
      'LISTENER_OFFLINE_AFTER_SEC',
      config.LISTENER_OFFLINE_AFTER_SEC,
      300,
    ),
    JOBS_ENABLED: toBool(config.JOBS_ENABLED, true),
    TRUST_PROXY: text(config.TRUST_PROXY) || 'loopback, linklocal, uniquelocal',
    RATE_LIMIT_ENABLED: toBool(config.RATE_LIMIT_ENABLED, true),
    RATE_LIMIT_PER_MIN: toInt(
      'RATE_LIMIT_PER_MIN',
      config.RATE_LIMIT_PER_MIN,
      120,
    ),
    TELEGRAM_API_URL: toUrl(
      'TELEGRAM_API_URL',
      config.TELEGRAM_API_URL,
      'https://api.telegram.org',
    ),
    BACKUP_MAX_AGE_HOURS: toInt(
      'BACKUP_MAX_AGE_HOURS',
      config.BACKUP_MAX_AGE_HOURS,
      26,
    ),
  };
}
