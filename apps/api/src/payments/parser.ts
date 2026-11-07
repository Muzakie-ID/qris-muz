/** Pola pembaca nominal; murni fungsi agar mudah diuji. */
export interface ParserRule {
  id: string;
  packageName: string | null;
  pattern: string;
  priority: number;
  autoMatch: boolean;
}

export interface NotificationText {
  packageName: string;
  title?: string | null;
  text?: string | null;
  bigText?: string | null;
  subText?: string | null;
}

export interface ParseResult {
  amount: number;
  parserId: string;
  autoMatch: boolean;
}

/**
 * "200.000" → 200000, "1" → 1, "50.087,00" → 50087, "1,250,000" → 1250000.
 * Desimal (",00" atau ".00" di akhir) dibuang; hasil null bila bukan bilangan bulat positif.
 */
export function normalizeAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, '');
  s = s.replace(/[.,]+$/, ''); // titik akhir kalimat, mis. "Rp50.087."
  s = s.replace(/[.,]\d{1,2}$/, (m) => (/^[.,]0{1,2}$/.test(m) ? '' : m));
  if (/[.,]\d{1,2}$/.test(s)) return null; // ada sen bukan nol: bukan nominal QRIS yang valid
  const digits = s.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Gabungan semua teks notifikasi, baris per baris. */
export function fullText(n: NotificationText): string {
  return [n.title, n.text, n.bigText, n.subText]
    .filter((p): p is string => !!p)
    .join('\n');
}

/**
 * Mencoba parser khusus package dulu, lalu parser umum, masing-masing urut prioritas.
 * Pola yang tidak valid dilewati agar satu parser rusak tidak menghentikan yang lain.
 */
export function parseNotification(
  n: NotificationText,
  rules: ParserRule[],
): ParseResult | null {
  const body = fullText(n);
  const ordered = [
    ...rules
      .filter((r) => r.packageName === n.packageName)
      .sort((a, b) => a.priority - b.priority),
    ...rules
      .filter((r) => r.packageName === null)
      .sort((a, b) => a.priority - b.priority),
  ];
  for (const rule of ordered) {
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, 'i');
    } catch {
      continue;
    }
    const m = re.exec(body);
    const amount = m?.[1] ? normalizeAmount(m[1]) : null;
    if (amount !== null)
      return { amount, parserId: rule.id, autoMatch: rule.autoMatch };
  }
  return null;
}
