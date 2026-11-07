import { crc16Ccitt } from './crc16';
import { QrisError } from './errors';
import { parseTlv, serializeTlv, type TlvElement } from './tlv';

/** Tag EMV MPM yang dipakai di QRIS. */
export const TAG = {
  PAYLOAD_FORMAT: '00',
  POINT_OF_INITIATION: '01',
  MCC: '52',
  CURRENCY: '53',
  AMOUNT: '54',
  TIP_INDICATOR: '55',
  TIP_FIXED: '56',
  TIP_PERCENT: '57',
  COUNTRY: '58',
  MERCHANT_NAME: '59',
  MERCHANT_CITY: '60',
  POSTAL_CODE: '61',
  ADDITIONAL_DATA: '62',
  CRC: '63',
} as const;

export const POI_STATIC = '11';
export const POI_DYNAMIC = '12';
const QRIS_GLOBAL_ID = 'ID.CO.QRIS.WWW';

/** Tag yang isinya berupa template (berisi TLV lagi). */
function isTemplate(id: string): boolean {
  const n = Number(id);
  return (n >= 26 && n <= 51) || n === 62 || n === 64 || (n >= 80 && n <= 99);
}

export interface MerchantAccount {
  tag: string;
  globalId: string | null;
  /** Subtag 01: nomor PAN merchant di penyelenggara. */
  merchantPan: string | null;
  /** Subtag 02: ID merchant (untuk tag 51 nasional, ini NMID). */
  merchantId: string | null;
  /** Subtag 03: kriteria merchant, mis. UMI/UKE/UME/UBE/URE. */
  criteria: string | null;
}

export interface QrisInfo {
  pointOfInitiation: 'static' | 'dynamic';
  merchantName: string;
  merchantCity: string;
  postalCode: string | null;
  mcc: string;
  currency: string;
  countryCode: string;
  nmid: string | null;
  amount: number | null;
  hasTipPrompt: boolean;
  merchantAccounts: MerchantAccount[];
  crc: string;
}

export interface ParsedQris {
  elements: TlvElement[];
  info: QrisInfo;
}

function get(elements: TlvElement[], id: string): string | undefined {
  return elements.find((e) => e.id === id)?.value;
}

function requireTag(elements: TlvElement[], id: string, name: string): string {
  const value = get(elements, id);
  if (value === undefined || value === '') {
    throw new QrisError(
      'MISSING_TAG',
      `Tag ${id} (${name}) tidak ada di QRIS.`,
    );
  }
  return value;
}

function readMerchantAccount(tag: string, value: string): MerchantAccount {
  let sub: TlvElement[];
  try {
    sub = parseTlv(value);
  } catch {
    throw new QrisError(
      'MALFORMED_TLV',
      `Isi template merchant di tag ${tag} rusak.`,
    );
  }
  return {
    tag,
    globalId: get(sub, '00') ?? null,
    merchantPan: get(sub, '01') ?? null,
    merchantId: get(sub, '02') ?? null,
    criteria: get(sub, '03') ?? null,
  };
}

/**
 * Membaca dan memvalidasi payload QRIS (statis atau dinamis).
 * Melempar QrisError dengan kode yang jelas bila ada yang tidak sesuai.
 */
export function parseQris(raw: string): ParsedQris {
  const payload = raw.trim();
  if (!payload) throw new QrisError('EMPTY', 'Payload QRIS kosong.');

  const elements = parseTlv(payload);

  if (elements[0]?.id !== TAG.PAYLOAD_FORMAT || elements[0].value !== '01') {
    throw new QrisError(
      'INVALID_FORMAT_INDICATOR',
      'Payload harus diawali tag 00 bernilai "01" (000201). Pastikan yang di-scan adalah QRIS.',
    );
  }

  const last = elements[elements.length - 1];
  if (last.id !== TAG.CRC || last.value.length !== 4) {
    throw new QrisError(
      'MISSING_CRC',
      'Tag 63 (CRC) harus ada di akhir payload dengan panjang 4.',
    );
  }
  const expected = crc16Ccitt(payload.slice(0, -4));
  if (last.value.toUpperCase() !== expected) {
    throw new QrisError(
      'CRC_MISMATCH',
      `CRC tidak cocok: tertulis ${last.value}, seharusnya ${expected}. Payload mungkin salah salin.`,
    );
  }
  for (const e of elements) {
    if (isTemplate(e.id)) {
      try {
        parseTlv(e.value);
      } catch {
        throw new QrisError(
          'MALFORMED_TLV',
          `Isi template di tag ${e.id} rusak.`,
        );
      }
    }
  }

  const poi = requireTag(
    elements,
    TAG.POINT_OF_INITIATION,
    'point of initiation',
  );
  if (poi !== POI_STATIC && poi !== POI_DYNAMIC) {
    throw new QrisError(
      'INVALID_VALUE',
      `Tag 01 harus "11" (statis) atau "12" (dinamis), bukan "${poi}".`,
    );
  }
  const currency = requireTag(elements, TAG.CURRENCY, 'mata uang');
  if (currency !== '360') {
    throw new QrisError(
      'INVALID_VALUE',
      `Mata uang harus 360 (Rupiah), bukan ${currency}.`,
    );
  }
  const countryCode = requireTag(elements, TAG.COUNTRY, 'kode negara');
  const mcc = requireTag(elements, TAG.MCC, 'kategori merchant');
  const merchantName = requireTag(elements, TAG.MERCHANT_NAME, 'nama merchant');
  const merchantCity = requireTag(elements, TAG.MERCHANT_CITY, 'kota merchant');

  const merchantAccounts = elements
    .filter((e) => Number(e.id) >= 26 && Number(e.id) <= 51)
    .map((e) => readMerchantAccount(e.id, e.value));
  if (merchantAccounts.length === 0) {
    throw new QrisError(
      'MISSING_TAG',
      'Tidak ada informasi akun merchant (tag 26–51).',
    );
  }

  const amountText = get(elements, TAG.AMOUNT);
  const amount = amountText !== undefined ? Number(amountText) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    throw new QrisError(
      'INVALID_VALUE',
      `Nominal di tag 54 tidak valid: "${amountText}".`,
    );
  }

  const national = merchantAccounts.find((m) => m.globalId === QRIS_GLOBAL_ID);

  return {
    elements,
    info: {
      pointOfInitiation: poi === POI_STATIC ? 'static' : 'dynamic',
      merchantName,
      merchantCity,
      postalCode: get(elements, TAG.POSTAL_CODE) ?? null,
      mcc,
      currency,
      countryCode,
      nmid: national?.merchantId ?? null,
      amount,
      hasTipPrompt: get(elements, TAG.TIP_INDICATOR) !== undefined,
      merchantAccounts,
      crc: last.value.toUpperCase(),
    },
  };
}

/** Menambahkan CRC ke payload tanpa tag 63. */
export function withCrc(payloadWithoutCrc: string): string {
  const base = `${payloadWithoutCrc}${TAG.CRC}04`;
  return `${base}${crc16Ccitt(base)}`;
}

export interface ToDynamicOptions {
  /** Batas nominal per transaksi, dalam rupiah. */
  maxAmount: number;
}

export function assertValidAmount(amount: number, maxAmount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new QrisError(
      'INVALID_AMOUNT',
      'Nominal harus bilangan bulat rupiah, minimal 1.',
    );
  }
  if (amount > maxAmount) {
    throw new QrisError(
      'INVALID_AMOUNT',
      `Nominal ${amount} melebihi batas ${maxAmount} per transaksi.`,
    );
  }
}

/**
 * Mengubah QRIS statis menjadi QRIS dinamis bernominal:
 * - tag 01 diubah dari 11 menjadi 12,
 * - tag 54 diisi nominal (bilangan bulat, tanpa desimal),
 * - tag 55–57 (tip/biaya yang bisa diubah pembeli) dibuang agar nominal tidak berubah,
 * - CRC (tag 63) dihitung ulang.
 * Urutan tag lain dipertahankan; tag 54 ditempatkan sesuai urutan ID.
 */
export function toDynamicQris(
  staticPayload: string,
  amount: number,
  options: ToDynamicOptions,
): string {
  assertValidAmount(amount, options.maxAmount);
  const { elements, info } = parseQris(staticPayload);
  if (info.pointOfInitiation !== 'static') {
    throw new QrisError(
      'NOT_STATIC',
      'Payload ini sudah QRIS dinamis. Gunakan QRIS statis asli dari merchant sebagai sumber.',
    );
  }

  const removed = new Set<string>([
    TAG.CRC,
    TAG.AMOUNT,
    TAG.TIP_INDICATOR,
    TAG.TIP_FIXED,
    TAG.TIP_PERCENT,
  ]);
  const kept = elements
    .filter((e) => !removed.has(e.id))
    .map((e) =>
      e.id === TAG.POINT_OF_INITIATION ? { ...e, value: POI_DYNAMIC } : e,
    );

  const amountElement: TlvElement = { id: TAG.AMOUNT, value: String(amount) };
  const insertAt = kept.findIndex((e) => Number(e.id) > Number(TAG.AMOUNT));
  const next =
    insertAt === -1
      ? [...kept, amountElement]
      : [...kept.slice(0, insertAt), amountElement, ...kept.slice(insertAt)];

  return withCrc(serializeTlv(next));
}
