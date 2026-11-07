import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { getTransaction } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Bayar dengan QRIS",
  robots: { index: false, follow: false },
};

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tx = getTransaction(id);
  if (!tx) notFound();

  // Selama backend belum ada, semua data adalah contoh: tampilkan tombol simulasi.
  return <CheckoutView tx={tx} demo />;
}
