-- Parser bawaan. package_name masih kosong karena nama package DANA Bisnis dan
-- GoPay Merchant baru diketahui lewat mode deteksi listener; owner bisa mengisinya nanti.
-- Pola mengikuti contoh notifikasi asli:
--   DANA Bisnis   : "Pembayaran Masuk" / "Rp200.000 diterima DANA Bisnis."
--   GoPay Merchant: "Pembayaran QRIS statis diterima" / "Rp 1 di Muzakie ID, KUTOARJO."
INSERT INTO "parsers" ("id", "package_name", "pattern", "priority", "auto_match") VALUES
  ('psr_default_dana', NULL, 'Rp\s?([\d.,]+)\s+diterima', 10, true),
  ('psr_default_gopay', NULL, 'QRIS[^\n]*diterima[\s\S]*?Rp\s?([\d.,]+)', 20, true),
  ('psr_default_generic', NULL, 'Rp\.?\s?([\d.,]+)', 1000, false)
ON CONFLICT ("id") DO NOTHING;
