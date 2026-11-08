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

describe('pickFreeCode dengan rentang proyek', () => {
  it('hanya memilih kode di dalam rentang', () => {
    for (let i = 0; i < 300; i++) {
      const c = pickFreeCode(new Set([500, 501]), 1999, 500)!;
      expect(c).toBeGreaterThanOrEqual(502);
      expect(c).toBeLessThanOrEqual(1999);
    }
  });

  it('null bila seluruh rentang terpakai', () => {
    const used = new Set(Array.from({ length: 10 }, (_, i) => 500 + i));
    expect(pickFreeCode(used, 509, 500)).toBeNull();
  });
});
