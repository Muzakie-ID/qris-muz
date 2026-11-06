export type QrisErrorCode =
  | 'EMPTY'
  | 'MALFORMED_TLV'
  | 'INVALID_FORMAT_INDICATOR'
  | 'MISSING_CRC'
  | 'CRC_MISMATCH'
  | 'MISSING_TAG'
  | 'INVALID_VALUE'
  | 'NOT_STATIC'
  | 'INVALID_AMOUNT';

/** Kesalahan saat membaca atau mengubah payload QRIS. `code` stabil untuk dipakai klien. */
export class QrisError extends Error {
  constructor(
    public readonly code: QrisErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'QrisError';
  }
}
