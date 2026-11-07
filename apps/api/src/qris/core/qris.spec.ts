import { crc16Ccitt } from './crc16';
import { QrisError } from './errors';
import { buildStaticQris } from './fixtures';
import { parseQris, toDynamicQris, withCrc } from './qris';
import { parseTlv, serializeTlv } from './tlv';

const MAX = 10_000_000;

function expectQrisError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(QrisError);
    expect((e as QrisError).code).toBe(code);
    return;
  }
  throw new Error(`Diharapkan QrisError ${code}, tapi tidak ada error.`);
}

describe('crc16Ccitt', () => {
  it('cocok dengan nilai cek standar CRC-16/CCITT-FALSE', () => {
    expect(crc16Ccitt('123456789')).toBe('29B1');
  });

  it('selalu 4 digit heksadesimal huruf besar', () => {
    expect(crc16Ccitt('')).toBe('FFFF');
    expect(crc16Ccitt('A')).toMatch(/^[0-9A-F]{4}$/);
  });
});

describe('parseTlv / serializeTlv', () => {
  it('membaca dan menyusun ulang tanpa perubahan', () => {
    const text = '000201010211' + '5303360';
    expect(serializeTlv(parseTlv(text))).toBe(text);
  });

  it('menolak struktur terpotong', () => {
    expectQrisError(() => parseTlv('0002010102'), 'MALFORMED_TLV');
  });

  it('menolak panjang yang bukan angka', () => {
    expectQrisError(() => parseTlv('00AB01'), 'MALFORMED_TLV');
  });
});

describe('parseQris', () => {
  it('membaca QRIS statis beserta NMID dan nama merchant', () => {
    const { info } = parseQris(buildStaticQris());
    expect(info).toMatchObject({
      pointOfInitiation: 'static',
      merchantName: 'TOKO CONTOH',
      merchantCity: 'JAKARTA',
      postalCode: '10110',
      mcc: '5812',
      currency: '360',
      countryCode: 'ID',
      nmid: 'ID1020000000001',
      amount: null,
      hasTipPrompt: false,
    });
    expect(info.merchantAccounts.map((m) => m.tag)).toEqual(['26', '51']);
  });

  it('mengabaikan spasi atau baris baru di ujung hasil salin', () => {
    expect(parseQris(`  ${buildStaticQris()}\n`).info.merchantName).toBe(
      'TOKO CONTOH',
    );
  });

  it('menerima CRC huruf kecil', () => {
    const p = buildStaticQris();
    expect(() =>
      parseQris(p.slice(0, -4) + p.slice(-4).toLowerCase()),
    ).not.toThrow();
  });

  it('menolak CRC yang salah', () => {
    const p = buildStaticQris();
    const wrong = p.slice(0, -4) + (p.endsWith('0000') ? '0001' : '0000');
    expectQrisError(() => parseQris(wrong), 'CRC_MISMATCH');
  });

  it('menolak payload yang diubah tanpa menghitung ulang CRC', () => {
    const tampered = buildStaticQris().replace('TOKO CONTOH', 'TOKO PALSU!');
    expectQrisError(() => parseQris(tampered), 'CRC_MISMATCH');
  });

  it('menolak payload kosong', () => {
    expectQrisError(() => parseQris('   '), 'EMPTY');
  });

  it('menolak teks yang bukan QRIS', () => {
    expectQrisError(() => parseQris('https://contoh.com'), 'MALFORMED_TLV');
    expectQrisError(
      () => parseQris(withCrc('000202')),
      'INVALID_FORMAT_INDICATOR',
    );
  });

  it('menolak QRIS tanpa nama merchant', () => {
    const p = withCrc(
      '000201010211' +
        '26180014COM.CONTOH.WWW' +
        '520458125303360' +
        '5802ID' +
        '6007JAKARTA',
    );
    expectQrisError(() => parseQris(p), 'MISSING_TAG');
  });

  it('menolak mata uang selain Rupiah', () => {
    const p = withCrc(
      '000201010211' +
        '26180014COM.CONTOH.WWW' +
        '520458125303840' +
        '5802ID' +
        '5904TOKO' +
        '6007JAKARTA',
    );
    expectQrisError(() => parseQris(p), 'INVALID_VALUE');
  });
});

describe('toDynamicQris', () => {
  const source = buildStaticQris({ withTip: true });

  it('mengubah tag 01 jadi 12 dan menyisipkan nominal di tag 54', () => {
    const dynamic = toDynamicQris(source, 50_087, { maxAmount: MAX });
    const { info, elements } = parseQris(dynamic);
    expect(info.pointOfInitiation).toBe('dynamic');
    expect(info.amount).toBe(50_087);
    expect(elements.find((e) => e.id === '54')?.value).toBe('50087');
  });

  it('menghasilkan CRC yang valid', () => {
    const dynamic = toDynamicQris(source, 125_412, { maxAmount: MAX });
    expect(dynamic.slice(-4)).toBe(crc16Ccitt(dynamic.slice(0, -4)));
  });

  it('menempatkan tag 54 setelah 53 dan sebelum 58', () => {
    const ids = parseQris(
      toDynamicQris(source, 1000, { maxAmount: MAX }),
    ).elements.map((e) => e.id);
    expect(ids.indexOf('54')).toBe(ids.indexOf('53') + 1);
    expect(ids.indexOf('54')).toBeLessThan(ids.indexOf('58'));
    expect(ids[0]).toBe('00');
    expect(ids[ids.length - 1]).toBe('63');
  });

  it('membuang tag tip (55–57) agar pembeli tidak bisa mengubah nominal', () => {
    const { info, elements } = parseQris(
      toDynamicQris(source, 1000, { maxAmount: MAX }),
    );
    expect(info.hasTipPrompt).toBe(false);
    expect(elements.some((e) => ['55', '56', '57'].includes(e.id))).toBe(false);
  });

  it('tidak mengubah data merchant', () => {
    const before = parseQris(source).info;
    const after = parseQris(
      toDynamicQris(source, 1000, { maxAmount: MAX }),
    ).info;
    expect(after.merchantName).toBe(before.merchantName);
    expect(after.nmid).toBe(before.nmid);
    expect(after.merchantAccounts).toEqual(before.merchantAccounts);
  });

  it('mengganti nominal lama bila QRIS statis kebetulan sudah membawa tag 54', () => {
    const withOld = buildStaticQris({ withAmount: '999' });
    const { elements } = parseQris(
      toDynamicQris(withOld, 2000, { maxAmount: MAX }),
    );
    expect(elements.filter((e) => e.id === '54').map((e) => e.value)).toEqual([
      '2000',
    ]);
  });

  it('menolak sumber yang sudah dinamis', () => {
    const dynamic = toDynamicQris(source, 1000, { maxAmount: MAX });
    expectQrisError(
      () => toDynamicQris(dynamic, 2000, { maxAmount: MAX }),
      'NOT_STATIC',
    );
  });

  it.each([0, -5, 10.5, Number.NaN])(
    'menolak nominal tidak valid: %p',
    (amount) => {
      expectQrisError(
        () => toDynamicQris(source, amount, { maxAmount: MAX }),
        'INVALID_AMOUNT',
      );
    },
  );

  it('menolak nominal di atas batas', () => {
    expectQrisError(
      () => toDynamicQris(source, MAX + 1, { maxAmount: MAX }),
      'INVALID_AMOUNT',
    );
    expect(() => toDynamicQris(source, MAX, { maxAmount: MAX })).not.toThrow();
  });
});
