/**
 * CRC16-CCITT (polinom 0x1021, nilai awal 0xFFFF, tanpa refleksi, tanpa XOR akhir).
 * Dipakai EMVCo/QRIS untuk tag 63. Dihitung atas seluruh payload sampai dan
 * termasuk "6304", hasilnya 4 digit heksadesimal huruf besar.
 */
export function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  const bytes = Buffer.from(input, 'utf8');
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
