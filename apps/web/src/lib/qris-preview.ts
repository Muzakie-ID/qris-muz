/**
 * Pembaca QRIS ringan untuk pratinjau di browser sebelum disimpan. Validasi lengkap tetap di backend.
 */

export interface QrisPreview {
  merchantName: string | null;
  city: string | null;
  nmid: string | null;
  /** Domain penyelenggara di tag 26–51, mis. ID.DANA.WWW. */
  issuers: string[];
  /** Tag 01 = 12: QR dinamis (sudah berisi nominal), bukan QRIS statis. */
  dynamic: boolean;
  amount: string | null;
  crcOk: boolean;
  /** Label yang disarankan dari penyelenggara, mis. "DANA Bisnis". */
  suggestedLabel: string | null;
}

function parseTlv(input: string): Map<string, string> | null {
  const out = new Map<string, string>();
  let i = 0;
  while (i < input.length) {
    const id = input.slice(i, i + 2);
    const len = input.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(len)) return null;
    const end = i + 4 + Number(len);
    if (end > input.length) return null;
    out.set(id, input.slice(i + 4, end));
    i = end;
  }
  return out;
}

/** CRC16-CCITT (poly 0x1021, awal 0xFFFF), sama dengan backend. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const LABELS: [RegExp, string][] = [
  [/DANA/i, "DANA Bisnis"],
  [/GO-?JEK|GOPAY/i, "GoPay Merchant"],
  [/SHOPEE/i, "ShopeePay"],
  [/OVO/i, "OVO"],
  [/LINKAJA/i, "LinkAja"],
];

/** null bila teks bukan QRIS sama sekali. */
export function previewQris(raw: string): QrisPreview | null {
  const payload = raw.trim();
  if (!payload.startsWith("000201")) return null;
  const tags = parseTlv(payload);
  if (!tags) return null;
  const issuers: string[] = [];
  let nmid: string | null = null;
  for (let t = 26; t <= 51; t++) {
    const v = tags.get(String(t));
    if (!v) continue;
    const sub = parseTlv(v);
    const domain = sub?.get("00");
    if (domain) issuers.push(domain);
    if (t === 51 && sub?.get("02")) nmid = sub.get("02")!;
  }
  const crc = tags.get("63");
  const crcOk = !!crc && payload.endsWith(crc) && crc16(payload.slice(0, -4)).toUpperCase() === crc.toUpperCase();
  const all = issuers.join(" ");
  return {
    merchantName: tags.get("59") ?? null,
    city: tags.get("60") ?? null,
    nmid,
    issuers,
    dynamic: tags.get("01") === "12",
    amount: tags.get("54") ?? null,
    crcOk,
    suggestedLabel: LABELS.find(([re]) => re.test(all))?.[1] ?? null,
  };
}
