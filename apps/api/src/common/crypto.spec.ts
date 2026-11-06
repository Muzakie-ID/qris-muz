import { decrypt, encrypt, hmacSha256Hex, safeEqualHex } from './crypto';

const KEY = Buffer.alloc(32, 3);

describe('crypto', () => {
  it('enkripsi bisa dibuka lagi dengan kunci yang sama', () => {
    const sealed = encrypt(KEY, 'rahasia-device');
    expect(sealed).not.toContain('rahasia');
    expect(decrypt(KEY, sealed)).toBe('rahasia-device');
  });

  it('setiap enkripsi menghasilkan teks berbeda (IV acak)', () => {
    expect(encrypt(KEY, 'x')).not.toBe(encrypt(KEY, 'x'));
  });

  it('gagal dibuka dengan kunci lain atau data yang diubah', () => {
    const sealed = encrypt(KEY, 'x');
    expect(() => decrypt(Buffer.alloc(32, 4), sealed)).toThrow();
    const [iv, tag, data] = sealed.split('.');
    expect(() => decrypt(KEY, [iv, tag, data + 'A'].join('.'))).toThrow();
  });

  it('HMAC cocok dengan vektor uji RFC 4231 kasus 2', () => {
    expect(hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('safeEqualHex', () => {
    expect(safeEqualHex('abc', 'abc')).toBe(true);
    expect(safeEqualHex('abc', 'abd')).toBe(false);
    expect(safeEqualHex('abc', 'abcd')).toBe(false);
  });
});
