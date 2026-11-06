import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center text-sm">
      <h1 className="text-[22px] font-medium tracking-[-0.02em]">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-faint">Tagihan atau halaman yang kamu cari tidak ada, atau tautannya salah.</p>
      <Link href="/" className="mt-2 inline-flex h-11 items-center rounded-full bg-ink px-5 font-medium text-white">
        Ke beranda
      </Link>
    </div>
  );
}
