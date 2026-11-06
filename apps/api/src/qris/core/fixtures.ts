import { withCrc } from './qris';
import { tlv } from './tlv';

/**
 * QRIS statis buatan untuk test. Merchant, PAN dan NMID-nya fiktif:
 * strukturnya mengikuti QRIS asli, tapi tidak bisa dipakai membayar.
 */
export function buildStaticQris(
  opts: { withTip?: boolean; withAmount?: string } = {},
): string {
  const parts = [
    tlv('00', '01'),
    tlv('01', '11'),
    tlv(
      '26',
      tlv('00', 'COM.CONTOH.WWW') +
        tlv('01', '936000000000000001') +
        tlv('02', '000000000000001') +
        tlv('03', 'UMI'),
    ),
    tlv(
      '51',
      tlv('00', 'ID.CO.QRIS.WWW') +
        tlv('02', 'ID1020000000001') +
        tlv('03', 'UMI'),
    ),
    tlv('52', '5812'),
    tlv('53', '360'),
    opts.withAmount !== undefined ? tlv('54', opts.withAmount) : '',
    opts.withTip ? tlv('55', '01') : '',
    tlv('58', 'ID'),
    tlv('59', 'TOKO CONTOH'),
    tlv('60', 'JAKARTA'),
    tlv('61', '10110'),
    tlv('62', tlv('07', 'A01')),
  ];
  return withCrc(parts.join(''));
}
