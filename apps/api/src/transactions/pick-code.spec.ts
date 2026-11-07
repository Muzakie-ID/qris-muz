import { MAX_UNIQUE_CODE, pickFreeCode } from './transactions.service';

describe('pickFreeCode', () => {
  it('memilih kode 1–999 yang belum dipakai', () => {
    const used = new Set([1, 2, 3]);
    for (let i = 0; i < 200; i++) {
      const c = pickFreeCode(used)!;
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(MAX_UNIQUE_CODE);
      expect(used.has(c)).toBe(false);
    }
  });

  it('mengembalikan satu-satunya kode yang tersisa', () => {
    const used = new Set(Array.from({ length: 998 }, (_, i) => i + 1));
    expect(pickFreeCode(used)).toBe(999);
  });

  it('null bila semua kode terpakai', () => {
    expect(
      pickFreeCode(new Set(Array.from({ length: 999 }, (_, i) => i + 1))),
    ).toBeNull();
  });
});
