import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256Hex(
  secret: string,
  message: string | Buffer,
): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

/** Bandingkan dua string heksadesimal tanpa membocorkan posisi beda lewat waktu. */
export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Token acak aman URL. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** AES-256-GCM; hasil: iv.tag.ciphertext (base64url). */
export function encrypt(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString('base64url'))
    .join('.');
}

export function decrypt(key: Buffer, sealed: string): string {
  const [iv, tag, data] = sealed
    .split('.')
    .map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Data terenkripsi rusak.');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
