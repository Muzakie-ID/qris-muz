import type { Metadata } from "next";
import { QrCode } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  return (
    <div className="flex min-h-svh items-center justify-center p-4 text-sm">
      <div className="flex w-full max-w-[380px] flex-col gap-5 rounded-[20px] border border-line bg-surface p-6">
        <div className="flex items-center gap-2">
          <QrCode className="size-[22px]" strokeWidth={2} aria-hidden />
          <span className="text-lg font-semibold tracking-[-0.03em]">qrismuz</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-medium tracking-[-0.02em]">Masuk ke dashboard</h1>
          <p className="text-faint">Khusus owner gateway.</p>
        </div>
        {expired && <p className="rounded-xl bg-subtle p-3 text-muted">Sesi berakhir. Silakan masuk lagi.</p>}
        <LoginForm next={next ?? "/dashboard"} />
        <p className="text-xs text-faint">
          Belum punya akun owner? Buat di server: <code className="font-mono">node dist/scripts/owner-cli.js create email</code>
        </p>
      </div>
    </div>
  );
}
