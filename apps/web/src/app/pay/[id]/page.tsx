import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { getCheckout, publicApiUrl } from "@/lib/api";

export const metadata: Metadata = {
  title: "Bayar dengan QRIS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCheckout(id);
  if (!data) notFound();
  return <CheckoutView initial={data} apiUrl={publicApiUrl()} />;
}
