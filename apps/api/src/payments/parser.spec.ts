import { normalizeAmount, parseNotification, type ParserRule } from './parser';

// Sama dengan seed di drizzle/0001_seed_parsers.sql.
const DEFAULTS: ParserRule[] = [
  {
    id: 'psr_default_dana',
    packageName: null,
    pattern: 'Rp\\s?([\\d.,]+)\\s+diterima',
    priority: 10,
    autoMatch: true,
  },
  {
    id: 'psr_default_gopay',
    packageName: null,
    pattern: 'QRIS[^\\n]*diterima[\\s\\S]*?Rp\\s?([\\d.,]+)',
    priority: 20,
    autoMatch: true,
  },
  {
    id: 'psr_default_generic',
    packageName: null,
    pattern: 'Rp\\.?\\s?([\\d.,]+)',
    priority: 1000,
    autoMatch: false,
  },
];

describe('normalizeAmount', () => {
  it.each([
    ['200.000', 200000],
    ['1', 1],
    ['50.087', 50087],
    ['50.087,00', 50087],
    ['1,250,000', 1250000],
    ['1.250.000.', 1250000],
    ['12,50', null],
    ['abc', null],
    ['0', null],
  ])('%s → %p', (raw, expected) => {
    expect(normalizeAmount(raw)).toBe(expected);
  });
});

describe('parseNotification dengan parser bawaan', () => {
  it('membaca notifikasi DANA Bisnis asli', () => {
    expect(
      parseNotification(
        {
          packageName: 'dana.bisnis',
          title: 'Pembayaran Masuk',
          text: 'Rp200.000 diterima DANA Bisnis.',
        },
        DEFAULTS,
      ),
    ).toEqual({
      amount: 200000,
      parserId: 'psr_default_dana',
      autoMatch: true,
    });
  });

  it('membaca notifikasi GoPay Merchant asli', () => {
    expect(
      parseNotification(
        {
          packageName: 'gopay.merchant',
          title: 'Pembayaran QRIS statis diterima',
          text: 'Rp 1 di Muzakie ID, KUTOARJO.',
        },
        DEFAULTS,
      ),
    ).toEqual({ amount: 1, parserId: 'psr_default_gopay', autoMatch: true });
  });

  it('pola umum hanya mencatat, tidak dicocokkan otomatis', () => {
    expect(
      parseNotification(
        {
          packageName: 'x',
          title: 'Penarikan dana',
          text: 'Rp50.087 dikirim ke rekening',
        },
        DEFAULTS,
      ),
    ).toEqual({
      amount: 50087,
      parserId: 'psr_default_generic',
      autoMatch: false,
    });
  });

  it('mendahulukan parser khusus package', () => {
    const rules: ParserRule[] = [
      ...DEFAULTS,
      {
        id: 'khusus',
        packageName: 'dana.bisnis',
        pattern: 'masuk (\\d+)',
        priority: 500,
        autoMatch: true,
      },
    ];
    expect(
      parseNotification(
        { packageName: 'dana.bisnis', text: 'Rp9 diterima. masuk 123' },
        rules,
      )?.parserId,
    ).toBe('khusus');
  });

  it('melewati pola yang rusak', () => {
    const rules: ParserRule[] = [
      {
        id: 'rusak',
        packageName: null,
        pattern: '([',
        priority: 1,
        autoMatch: true,
      },
      ...DEFAULTS,
    ];
    expect(
      parseNotification({ packageName: 'x', text: 'Rp5.000 diterima' }, rules)
        ?.parserId,
    ).toBe('psr_default_dana');
  });

  it('null bila tidak ada nominal', () => {
    expect(
      parseNotification(
        { packageName: 'x', title: 'Promo', text: 'Diskon hari ini' },
        DEFAULTS,
      ),
    ).toBeNull();
  });
});
