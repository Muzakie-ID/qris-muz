import type { Metadata } from "next";
import { CodeBlock, CodeTabs } from "@/components/docs/code";
import { A, C, Callout, DocTitle, H2, P, Table, Ul } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Webhook · Dokumentasi" };

const NODE = `// Express. Penting: baca body mentah, jangan express.json() untuk rute ini.
import crypto from "node:crypto";
import express from "express";

const app = express();
app.post("/webhooks/qrismuz", express.raw({ type: "application/json" }), async (req, res) => {
  const ts = String(req.headers["x-timestamp"] ?? "");
  const given = String(req.headers["x-signature"] ?? "");
  const expected = crypto
    .createHmac("sha256", process.env.QRISMUZ_WEBHOOK_SECRET)
    .update(\`\${ts}.\${req.body}\`)
    .digest("hex");
  const valid =
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected)) &&
    Math.abs(Date.now() - Number(ts)) < 5 * 60_000;
  if (!valid) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString("utf8"));
  // Webhook bisa datang lebih dari sekali: abaikan event.id yang sudah diproses.
  if (await db.webhookSeen(event.id)) return res.sendStatus(200);

  const tx = event.data;
  if (event.type === "transaction.paid") await db.markOrderPaid(tx.merchant_ref, tx.final_amount);
  if (event.type === "transaction.expired") await db.markOrderExpired(tx.merchant_ref);
  if (event.type === "transaction.late_paid") await db.flagLatePayment(tx.merchant_ref);

  await db.rememberWebhook(event.id);
  res.sendStatus(200);
});`;

const PHP = `<?php
// Laravel: gunakan $request->getContent() sebagai $body dan kecualikan rute ini dari CSRF.
$body = file_get_contents('php://input');
$ts = $_SERVER['HTTP_X_TIMESTAMP'] ?? '';
$given = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
$expected = hash_hmac('sha256', $ts . '.' . $body, getenv('QRISMUZ_WEBHOOK_SECRET'));

if (!hash_equals($expected, $given) || abs(round(microtime(true) * 1000) - (int) $ts) > 300000) {
    http_response_code(401);
    exit;
}

$event = json_decode($body, true);
if (webhook_sudah_diproses($event['id'])) { http_response_code(200); exit; }

$tx = $event['data'];
switch ($event['type']) {
    case 'transaction.paid':      tandai_lunas($tx['merchant_ref'], $tx['final_amount']); break;
    case 'transaction.expired':   tandai_kedaluwarsa($tx['merchant_ref']); break;
    case 'transaction.late_paid': tandai_bayar_telat($tx['merchant_ref']); break;
}
simpan_webhook($event['id']);
http_response_code(200);`;

const PY = `# Flask
import hashlib, hmac, json, os, time
from flask import Flask, abort, request

app = Flask(__name__)
SECRET = os.environ["QRISMUZ_WEBHOOK_SECRET"].encode()

@app.post("/webhooks/qrismuz")
def qrismuz_webhook():
    body = request.get_data()  # bytes mentah
    ts = request.headers.get("X-Timestamp", "")
    given = request.headers.get("X-Signature", "")
    expected = hmac.new(SECRET, ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, given) or abs(time.time() * 1000 - int(ts or 0)) > 300_000:
        abort(401)

    event = json.loads(body)
    if sudah_diproses(event["id"]):
        return "", 200
    tx = event["data"]
    if event["type"] == "transaction.paid":
        tandai_lunas(tx["merchant_ref"], tx["final_amount"])
    elif event["type"] == "transaction.expired":
        tandai_kedaluwarsa(tx["merchant_ref"])
    elif event["type"] == "transaction.late_paid":
        tandai_bayar_telat(tx["merchant_ref"])
    simpan_event(event["id"])
    return "", 200`;

export default function DocsWebhook() {
  return (
    <>
      <DocTitle
        title="Webhook"
        lead="Saat status tagihan berubah, qrismuz mengirim POST ke URL webhook proyek. Ini cara paling cepat dan andal untuk menandai pesanan lunas di sistem Anda."
      />

      <H2>Jenis event</H2>
      <Table
        head={["Event", "Kapan", "Yang sebaiknya dilakukan"]}
        rows={[
          [<C key="c">transaction.paid</C>, "Pembayaran cocok otomatis, atau owner menandai lunas manual", "Tandai pesanan lunas dan proses pesanan."],
          [<C key="c">transaction.expired</C>, "Tagihan lewat batas waktu tanpa pembayaran", "Batalkan pesanan atau tawarkan bayar ulang."],
          [<C key="c">transaction.late_paid</C>, "Uang masuk setelah tagihan kedaluwarsa atau dibatalkan", "Putuskan: tetap proses pesanan, atau refund di luar sistem."],
        ]}
      />
      <P>Pembatalan lewat API tidak mengirim webhook, karena perubahan itu datang dari proyek sendiri.</P>

      <H2>Isi request</H2>
      <Table
        head={["Header", "Isi"]}
        rows={[
          [<C key="c">X-Event-Id</C>, "ID event, sama di setiap percobaan ulang. Pakai untuk mengabaikan kiriman ganda."],
          [<C key="c">X-Event-Type</C>, "Jenis event."],
          [<C key="c">X-Timestamp</C>, "Waktu kirim dalam milidetik (Unix)."],
          [<C key="c">X-Signature</C>, <>hex(HMAC-SHA256(webhook secret, <C key="d">X-Timestamp + &quot;.&quot; + body mentah</C>))</>],
        ]}
      />
      <CodeBlock
        title="Body JSON"
        code={`{
  "id": "whe_01M6SH3K2Q7W8N0J4V5B6C7D8E",
  "type": "transaction.paid",
  "created_at": "2026-11-07T10:03:21.400Z",
  "data": {
    "id": "01M6SGD18EMZHM2WPRZ4FT2ZHB",
    "merchant_ref": "ORDER-123",
    "status": "PAID",
    "amount": 50000,
    "unique_code": 87,
    "final_amount": 50087,
    "metadata": { "user_id": 88 },
    "paid_at": "2026-11-07T10:03:20.000Z",
    "...": "field lain sama dengan respons API transaksi"
  }
}`}
      />

      <H2>Memverifikasi tanda tangan</H2>
      <P>
        Selalu verifikasi <C>X-Signature</C> dengan <strong>body mentah</strong> (sebelum di-parse JSON) dan tolak timestamp yang
        lebih tua dari 5 menit. Tanpa ini, siapa pun bisa mengirim &ldquo;pembayaran lunas&rdquo; palsu ke server Anda.
      </P>
      <CodeTabs tabs={[{ label: "Node.js", code: NODE }, { label: "PHP", code: PHP }, { label: "Python", code: PY }]} />

      <H2>Membalas dan percobaan ulang</H2>
      <Ul>
        <li>Balas HTTP 2xx dalam 10 detik bila sudah diterima. Kerjakan proses berat (kirim email, dsb.) setelah membalas atau di antrian.</li>
        <li>Selain 2xx, timeout, atau server tidak bisa dihubungi, webhook dikirim ulang setelah 1 menit, 5 menit, 15 menit, 30 menit, 1 jam, 3 jam, 6 jam, dan 12 jam (8 kali, ±24 jam).</li>
        <li>Setelah 8 kali gagal, status menjadi Gagal dan alarm Telegram dikirim. Perbaiki server proyek, lalu tekan <strong>Kirim ulang</strong> di <A href="/webhook">Log webhook</A>.</li>
        <li>Webhook bisa datang lebih dari sekali dan tidak dijamin berurutan. Simpan <C>X-Event-Id</C> yang sudah diproses, dan jangan menurunkan status pesanan yang sudah lunas.</li>
      </Ul>
      <Callout tone="tip" title="Menguji webhook">
        Isi URL webhook proyek, tekan <strong>Buat transaksi uji</strong> di Beranda, lalu bayar atau biarkan kedaluwarsa. Hasil
        setiap pengiriman, termasuk kode HTTP dan error dari server Anda, tampil di <A href="/webhook">Log webhook</A>.
      </Callout>
    </>
  );
}
