const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Rp1.250.087 — tanpa spasi, titik sebagai pemisah ribuan. */
export function formatRupiah(amount: number): string {
  return `Rp${rupiah.format(amount)}`;
}

/** Memisahkan 3 digit terakhir (kode unik) agar bisa disorot di UI. */
export function splitUniqueCode(amount: number): { head: string; tail: string } {
  const full = formatRupiah(amount);
  return { head: full.slice(0, -2), tail: full.slice(-2) };
}

/** 6 Nov, 21.48 — jam memakai titik sesuai kebiasaan Indonesia. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
  const time = d
    .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })
    .replace(":", ".");
  return `${date}, ${time}`;
}

/** 14.52 — sisa waktu dalam menit.detik. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}.${String(s % 60).padStart(2, "0")}`;
}
