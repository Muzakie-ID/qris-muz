import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { CodeTabs } from "@/components/docs/code";
import { PaymentDemo } from "@/components/site/payment-demo";
import { publicApiUrl } from "@/lib/api";
import { SESSION_COOKIE, looksLikeSession } from "@/lib/session";

export const metadata: Metadata = {
  title: { absolute: "qrismuz: QRIS dinamis, lunas otomatis" },
  description:
    "qrismuz mengubah QRIS statis DANA Bisnis dan GoPay Merchant menjadi tagihan bernominal unik yang lunas otomatis begitu notifikasi dana masuk muncul.",
  openGraph: {
    title: "qrismuz: QRIS dinamis, lunas otomatis",
    description: "Tagihan QRIS bernominal unik, konfirmasi otomatis dari notifikasi DANA Bisnis dan GoPay Merchant, webhook ke toko Anda.",
    type: "website",
    locale: "id_ID",
  },
};

const STEPS = [
  {
    title: "Toko membuat tagihan",
    body: "Server toko memanggil API dengan nominal pesanan. Pembeli diarahkan ke halaman bayar.",
    sample: "POST /v1/transactions",
  },
  {
    title: "Nominal dibuat unik",
    body: "Kode unik ditambahkan ke nominal dan dimasukkan ke QR dinamis, jadi pembeli tidak perlu mengetik apa pun.",
    sample: "Rp50.000 → Rp50.087",
  },
  {
    title: "HP listener menangkap notifikasi",
    body: "DANA Bisnis atau GoPay Merchant memunculkan notifikasi dana masuk; aplikasi listener meneruskannya ke server.",
    sample: "Rp50.087 diterima DANA Bisnis.",
  },
  {
    title: "Pesanan lunas sendiri",
    body: "Nominal dicocokkan, halaman bayar berubah, pembeli kembali ke toko, dan server toko menerima webhook.",
    sample: "transaction.paid → 200 OK",
  },
];

const FEATURES: { group: string; intro: string; items: { title: string; body: string }[] }[] = [
  {
    group: "Pembayaran",
    intro: "Yang dilihat pembeli dan yang diterima toko.",
    items: [
      { title: "Beberapa QRIS sekaligus", body: "DANA Bisnis dan GoPay Merchant berjalan bersamaan; notifikasi tiap aplikasi hanya dicocokkan dengan QRIS-nya sendiri." },
      { title: "Rentang kode unik bisa diatur", body: "Bawaan 1–999 per proyek, atau rentang lain seperti 500–1999 bila ingin tambahan yang lebih jelas." },
      { title: "Halaman bayar realtime", body: "QR, hitung mundur, dan status yang berubah dalam hitungan detik, lalu kembali otomatis ke toko." },
      { title: "Bayar telat tetap tercatat", body: "Pembayaran setelah tagihan kedaluwarsa dicatat terpisah, dan keputusan diserahkan ke toko." },
    ],
  },
  {
    group: "Keandalan",
    intro: "Konfirmasi boleh tertunda, pembayaran tidak boleh hilang.",
    items: [
      { title: "Teks notifikasi disimpan mentah", body: "Bila format notifikasi berubah, pola parser diperbaiki dari dashboard lalu notifikasi lama diproses ulang." },
      { title: "Antrian di HP", body: "Saat internet putus, notifikasi menunggu di HP dan terkirim begitu tersambung lagi." },
      { title: "Alarm Telegram", body: "Kabar saat HP listener offline, notifikasi tak terbaca, webhook gagal, atau backup terlambat." },
      { title: "Backup harian", body: "Database disalin ke Google Drive setiap malam dan diuji pemulihannya setiap minggu." },
    ],
  },
  {
    group: "Keamanan",
    intro: "Tidak ada yang bisa melunasi tagihan dengan request palsu.",
    items: [
      { title: "Tanda tangan HMAC", body: "Setiap request HP listener dan setiap webhook ditandatangani, lengkap dengan waktu dan nonce." },
      { title: "Login owner dengan 2FA", body: "Password argon2id, kode authenticator, dan sesi yang bisa dicabut dari dashboard." },
      { title: "Secret tidak pernah tampil dua kali", body: "API key disimpan sebagai hash; secret webhook dan HP dienkripsi." },
    ],
  },
];

export default async function LandingPage() {
  const loggedIn = looksLikeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const api = publicApiUrl();

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 pb-16 pt-6 sm:px-8 sm:pt-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)] xl:items-center xl:gap-14 xl:pb-24">
        <div className="flex max-w-[600px] flex-col gap-6">
          <h1 className="text-[40px] font-medium leading-[1.02] tracking-[-0.045em] sm:text-[56px] lg:text-[66px]">
            Bayar pakai QRIS, lunas tanpa cek mutasi.
          </h1>
          <p className="max-w-[52ch] text-[16px] leading-relaxed text-muted sm:text-[17px]">
            qrismuz mengubah QRIS statis DANA Bisnis dan GoPay Merchant menjadi tagihan bernominal unik. Begitu notifikasi dana
            masuk muncul di HP, pesanan ditandai lunas dan toko Anda langsung diberi tahu.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/docs" className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-white hover:bg-black">
              Baca dokumentasi
            </Link>
            <Link
              href={loggedIn ? "/dashboard" : "/login"}
              className="inline-flex h-12 items-center rounded-full border border-line px-6 text-[15px] font-medium hover:border-[#cfcfcb]"
            >
              {loggedIn ? "Buka dashboard" : "Masuk dashboard"}
            </Link>
          </div>
          <p className="text-[13px] text-faint">Memakai akun QRIS merchant sendiri. Uang masuk langsung ke DANA Bisnis atau GoPay Merchant Anda.</p>
        </div>
        <div className="rounded-[28px] bg-canvas p-5 sm:p-8">
          <PaymentDemo />
        </div>
      </section>

      {/* Cara kerja */}
      <section id="cara-kerja" className="scroll-mt-4 border-t border-line-soft">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-16 sm:px-8 xl:py-20">
          <div className="flex max-w-[640px] flex-col gap-3">
            <h2 className="text-[30px] font-medium leading-tight tracking-[-0.035em] sm:text-[40px]">Dari tagihan sampai lunas</h2>
            <p className="text-[15px] leading-relaxed text-muted">
              Notifikasi dana masuk hanya berisi nominal. Karena setiap tagihan aktif punya nominal berbeda, nominal itulah yang
              menunjuk ke pesanan yang benar.
            </p>
          </div>
          <ol className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3 border-t border-ink pt-5">
                <span className="text-[13px] font-medium text-faint tabular-nums">{i + 1}</span>
                <h3 className="text-lg font-medium tracking-[-0.02em]">{s.title}</h3>
                <p className="leading-relaxed text-muted">{s.body}</p>
                <code className="mt-auto self-start rounded-lg bg-subtle px-2.5 py-1.5 font-mono text-[12px] text-ink-2">{s.sample}</code>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="scroll-mt-4 bg-canvas">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-16 sm:px-8 xl:py-20">
          <h2 className="max-w-[640px] text-[30px] font-medium leading-tight tracking-[-0.035em] sm:text-[40px]">
            Yang sudah ditangani, supaya toko cukup memanggil satu API
          </h2>
          <div className="mt-10 flex flex-col">
            {FEATURES.map((f) => (
              <div key={f.group} className="grid gap-6 border-t border-line py-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xl font-medium tracking-[-0.025em]">{f.group}</h3>
                  <p className="text-muted">{f.intro}</p>
                </div>
                <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                  {f.items.map((it) => (
                    <div key={it.title} className="flex flex-col gap-1.5">
                      <dt className="font-medium">{it.title}</dt>
                      <dd className="leading-relaxed text-muted">{it.body}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Untuk developer */}
      <section className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)] lg:items-center xl:py-20">
        <div className="flex max-w-[520px] flex-col gap-5">
          <h2 className="text-[30px] font-medium leading-tight tracking-[-0.035em] sm:text-[40px]">Satu request untuk membuat tagihan</h2>
          <p className="text-[15px] leading-relaxed text-muted">
            Kirim nominal dan nomor pesanan, arahkan pembeli ke <code className="font-mono text-[13px]">checkout_url</code>, lalu
            tunggu webhook. Request yang terulang karena koneksi putus tetap menghasilkan tagihan yang sama.
          </p>
          <ul className="flex flex-col gap-2.5 text-[15px]">
            <li className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" aria-hidden />Contoh kode Node.js, PHP, dan Python</li>
            <li className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" aria-hidden />Webhook bertanda tangan, dicoba ulang 8 kali dalam 24 jam</li>
            <li className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" aria-hidden />Status sistem untuk memberi tahu pembeli saat konfirmasi tertunda</li>
          </ul>
          <Link href="/docs/api" className="self-start font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
            Lihat referensi API
          </Link>
        </div>
        <CodeTabs
          tabs={[
            {
              label: "Buat tagihan",
              code: `curl -X POST ${api}/v1/transactions \\
  -H "Authorization: Bearer $QRISMUZ_API_KEY" \\
  -H "Idempotency-Key: ORDER-123" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 50000, "merchant_ref": "ORDER-123",
        "return_url": "https://tokoanda.id/pesanan/123" }'`,
            },
            {
              label: "Respons",
              code: `{
  "id": "01M6SGD18EMZHM2WPRZ4FT2ZHB",
  "status": "PENDING",
  "amount": 50000,
  "unique_code": 87,
  "final_amount": 50087,
  "checkout_url": "…/pay/01M6SGD18EMZHM2WPRZ4FT2ZHB",
  "expires_at": "2026-11-07T10:15:00.000Z"
}`,
            },
            {
              label: "Webhook",
              code: `POST https://tokoanda.id/webhooks/qrismuz
X-Event-Type: transaction.paid
X-Signature: 9f2c…  (HMAC-SHA256 dari timestamp + body)

{ "type": "transaction.paid",
  "data": { "merchant_ref": "ORDER-123", "final_amount": 50087,
            "status": "PAID", "paid_at": "2026-11-07T10:03:20.000Z" } }`,
            },
          ]}
        />
      </section>

      {/* Penutup */}
      <section className="px-2 pb-2 sm:px-3 sm:pb-3">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-start gap-6 rounded-[24px] bg-ink px-6 py-12 text-white sm:px-10 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-[560px] flex-col gap-3">
            <h2 className="text-[28px] font-medium leading-tight tracking-[-0.035em] sm:text-[36px]">Siapkan gateway dari nol</h2>
            <p className="leading-relaxed text-[#c9c9c4]">
              Panduannya berurutan: tambah QRIS dari foto, pasangkan HP listener, buat proyek, lalu uji pembayaran pertama.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/docs" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-medium text-ink hover:bg-[#ececea]">
              Mulai dari dokumentasi
            </Link>
            <Link href="/docs/listener" className="inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-[15px] font-medium hover:border-white/60">
              Pasang HP listener
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
