import { QrisError } from './errors';

/** Satu elemen data EMV: ID 2 digit, panjang 2 digit, lalu nilainya. */
export interface TlvElement {
  id: string;
  value: string;
}

/**
 * Membaca rangkaian TLV EMVCo. Panjang dihitung dalam karakter, sesuai
 * spesifikasi EMV MPM. Melempar MALFORMED_TLV bila struktur tidak utuh.
 */
export function parseTlv(input: string): TlvElement[] {
  const out: TlvElement[] = [];
  let i = 0;
  while (i < input.length) {
    const id = input.slice(i, i + 2);
    const lenText = input.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenText)) {
      throw new QrisError(
        'MALFORMED_TLV',
        `Struktur QRIS rusak di posisi ${i}: ID atau panjang bukan 2 digit angka.`,
      );
    }
    const len = Number(lenText);
    const value = input.slice(i + 4, i + 4 + len);
    if (value.length !== len) {
      throw new QrisError(
        'MALFORMED_TLV',
        `Struktur QRIS terpotong di tag ${id}: panjang tertulis ${len}, tersedia ${value.length}.`,
      );
    }
    out.push({ id, value });
    i += 4 + len;
  }
  return out;
}

/** Menyusun kembali elemen TLV menjadi teks. */
export function serializeTlv(elements: TlvElement[]): string {
  return elements
    .map(({ id, value }) => {
      if (value.length > 99) {
        throw new QrisError(
          'INVALID_VALUE',
          `Nilai tag ${id} terlalu panjang (${value.length} karakter, maksimal 99).`,
        );
      }
      return `${id}${String(value.length).padStart(2, '0')}${value}`;
    })
    .join('');
}

export function tlv(id: string, value: string): string {
  return serializeTlv([{ id, value }]);
}
