import { base32Decode, base32Encode, hotp, verifyTotp } from './totp';

// Vektor uji RFC 6238 (SHA-1), secret ASCII "12345678901234567890".
const SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('base32 bolak-balik', () => {
    const b = Buffer.from('halo qrismuz');
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
    expect(SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('cocok dengan vektor RFC 6238 (6 digit terakhir)', () => {
    expect(hotp(SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(hotp(SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(hotp(SECRET, Math.floor(1234567890 / 30))).toBe('005924');
    expect(hotp(SECRET, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('menerima ±1 langkah, menolak kode lama dan kode yang sudah dipakai', () => {
    const now = 1234567890_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(SECRET, hotp(SECRET, step), null, now)).toBe(step);
    expect(verifyTotp(SECRET, hotp(SECRET, step - 1), null, now)).toBe(
      step - 1,
    );
    expect(verifyTotp(SECRET, hotp(SECRET, step - 2), null, now)).toBeNull();
    expect(verifyTotp(SECRET, hotp(SECRET, step), step, now)).toBeNull();
    expect(verifyTotp(SECRET, '12345', null, now)).toBeNull();
  });
});
