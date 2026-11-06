import type { transactions } from '../db/schema';

export type TransactionRow = typeof transactions.$inferSelect;

export interface Urls {
  publicApiUrl: string;
  checkoutBaseUrl: string;
}

/** Bentuk transaksi yang dikirim ke proyek (respons API dan isi webhook). */
export function toApiView(t: TransactionRow, urls: Urls) {
  const pending = t.status === 'PENDING';
  return {
    id: t.id,
    merchant_ref: t.merchantRef,
    status: t.status,
    amount: t.baseAmount,
    unique_code: t.uniqueCode,
    final_amount: t.finalAmount,
    qris_source_id: t.qrisSourceId,
    qris_payload: pending ? t.qrisPayload : null,
    qr_image_url: pending
      ? `${urls.publicApiUrl}/public/checkout/${t.id}/qr.png`
      : null,
    checkout_url: `${urls.checkoutBaseUrl}/pay/${t.id}`,
    return_url: t.returnUrl,
    metadata: t.metadata ?? {},
    expires_at: t.expiresAt.toISOString(),
    paid_at: t.paidAt?.toISOString() ?? null,
    created_at: t.createdAt.toISOString(),
  };
}

export type TransactionApiView = ReturnType<typeof toApiView>;
