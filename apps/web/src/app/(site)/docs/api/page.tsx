import type { Metadata } from "next";
import { CodeBlock, CodeTabs } from "@/components/docs/code";
import { A, C, Callout, DocTitle, H2, H3, P, Table, Ul } from "@/components/docs/prose";
import { publicApiUrl, webOrigin } from "@/lib/urls";

export const metadata: Metadata = { title: "API transaksi · Dokumentasi" };

export default async function DocsApi() {
  const api = publicApiUrl();
  const web = await webOrigin();

  const create = {
    curl: `curl -X POST ${api}/v1/transactions \\
  -H "Authorization: Bearer $QRISMUZ_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ORDER-123" \\
  -d '{
    "amount": 50000,
    "merchant_ref": "ORDER-123",
    "expiry_min": 15,
    "return_url": "https://tokoanda.id/pesanan/123",
    "metadata": { "user_id": 88 }
  }'`,
    node: `// Node.js 18+ (fetch bawaan)
const res = await fetch("${api}/v1/transactions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.QRISMUZ_API_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": order.id, // aman diulang bila koneksi putus
  },
  body: JSON.stringify({
    amount: order.total,            // rupiah, bilangan bulat
    merchant_ref: order.id,
    return_url: \`https://tokoanda.id/pesanan/\${order.id}\`,
    metadata: { user_id: order.userId },
  }),
});
if (!res.ok) throw new Error((await res.json()).message);
const tx = await res.json();
// Simpan tx.id di pesanan, lalu arahkan pembeli:
// res.redirect(tx.checkout_url)`,
    php: `<?php
$ch = curl_init('${api}/v1/transactions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . getenv('QRISMUZ_API_KEY'),
        'Content-Type: application/json',
        'Idempotency-Key: ' . $order['id'],
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'amount' => (int) $order['total'],
        'merchant_ref' => $order['id'],
        'return_url' => 'https://tokoanda.id/pesanan/' . $order['id'],
        'metadata' => ['user_id' => $order['user_id']],
    ]),
]);
$tx = json_decode(curl_exec($ch), true);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($status >= 400) throw new Exception(is_array($tx['message']) ? implode('; ', $tx['message']) : $tx['message']);
header('Location: ' . $tx['checkout_url']);`,
    python: `import os, requests

res = requests.post(
    "${api}/v1/transactions",
    headers={
        "Authorization": f"Bearer {os.environ['QRISMUZ_API_KEY']}",
        "Idempotency-Key": order.id,
    },
    json={
        "amount": order.total,
        "merchant_ref": order.id,
        "return_url": f"https://tokoanda.id/pesanan/{order.id}",
        "metadata": {"user_id": order.user_id},
    },
    timeout=15,
)
res.raise_for_status()
tx = res.json()
# redirect(tx["checkout_url"])`,
  };

  return (
    <>
      <DocTitle
        title="API transaksi"
        lead="Server proyek Anda membuat tagihan, mengecek status, dan membatalkan tagihan lewat REST API ini. Semua nominal dalam rupiah bilangan bulat; semua waktu dalam UTC (ISO 8601)."
      />

      <H2>Dasar</H2>
      <Table
        head={["", ""]}
        rows={[
          ["Alamat dasar", <C key="c">{api}</C>],
          ["Autentikasi", <>Header <C>Authorization: Bearer &lt;API key&gt;</C> (buat di <A href="/proyek">Proyek & API key</A>)</>],
          ["Format", <>JSON, header <C>Content-Type: application/json</C></>],
          ["Batas request", "600 request/menit per IP server proyek. Melebihi batas → 429."],
        ]}
      />

      <H2>Membuat tagihan</H2>
      <P><C>POST /v1/transactions</C></P>
      <Table
        head={["Field", "Wajib", "Keterangan"]}
        rows={[
          [<C key="c">amount</C>, "Ya", "Nominal pesanan dalam rupiah (bilangan bulat ≥ 1). Kode unik ditambahkan otomatis sesuai rentang kode unik proyek."],
          [<C key="c">merchant_ref</C>, "Ya", "Nomor pesanan di sistem Anda, maks. 100 karakter. Dikembalikan di respons dan webhook."],
          [<C key="c">expiry_min</C>, "Tidak", "Masa berlaku dalam menit (1–1440). Bawaan: pengaturan proyek (15)."],
          [<C key="c">return_url</C>, "Tidak", "Ke mana pembeli diarahkan setelah lunas. Bawaan: Return URL default proyek."],
          [<C key="c">metadata</C>, "Tidak", "Objek JSON bebas (maks. 4 KB), dikembalikan apa adanya di respons dan webhook."],
          [<C key="c">qris_source_id</C>, "Tidak", "QRIS tertentu. Bawaan: QRIS default proyek."],
        ]}
      />
      <H3>Header Idempotency-Key</H3>
      <P>
        Kirim <C>Idempotency-Key</C> (1–100 karakter, mis. nomor pesanan). Bila request diulang dengan key yang sama — misalnya
        karena koneksi putus — yang dikembalikan adalah tagihan yang sama (HTTP 200 dan header <C>Idempotent-Replayed: true</C>),
        bukan tagihan baru dengan kode unik berbeda.
      </P>
      <CodeTabs
        tabs={[
          { label: "curl", code: create.curl },
          { label: "Node.js", code: create.node },
          { label: "PHP", code: create.php },
          { label: "Python", code: create.python },
        ]}
      />
      <H3>Respons (201)</H3>
      <CodeBlock
        title="JSON"
        code={`{
  "id": "01M6SGD18EMZHM2WPRZ4FT2ZHB",
  "merchant_ref": "ORDER-123",
  "status": "PENDING",
  "amount": 50000,
  "unique_code": 87,
  "final_amount": 50087,
  "qris_source_id": "qrs_01M6...",
  "qris_payload": "00020101021226...6304A083",
  "qr_image_url": "${api}/public/checkout/01M6SGD18EMZHM2WPRZ4FT2ZHB/qr.png",
  "checkout_url": "${web}/pay/01M6SGD18EMZHM2WPRZ4FT2ZHB",
  "return_url": "https://tokoanda.id/pesanan/123",
  "metadata": { "user_id": 88 },
  "expires_at": "2026-11-07T10:15:00.000Z",
  "paid_at": null,
  "created_at": "2026-11-07T10:00:00.000Z"
}`}
      />
      <Table
        head={["Field", "Keterangan"]}
        rows={[
          [<C key="c">id</C>, "ID tagihan. Simpan di pesanan Anda."],
          [<C key="c">final_amount</C>, "Nominal yang harus dibayar pembeli (amount + unique_code)."],
          [<C key="c">checkout_url</C>, "Halaman bayar siap pakai. Cara paling mudah: arahkan pembeli ke sini."],
          [<C key="c">qris_payload</C>, <>Isi QR dinamis, bila ingin menampilkan QR di halaman sendiri. <C>null</C> setelah tidak PENDING.</>],
          [<C key="c">qr_image_url</C>, <>Gambar PNG QR. <C>null</C> setelah tidak PENDING.</>],
          [<C key="c">status</C>, <>Lihat <A href="/docs/pembayaran">Alur pembayaran & status</A>.</>],
        ]}
      />
      <Callout title="Tampilkan nominal lengkap">
        Bila menampilkan QR di halaman sendiri, tulis <C>final_amount</C> dengan jelas (mis. Rp50.087) dan minta pembeli tidak
        mengubah nominal di aplikasinya.
      </Callout>

      <H2>Mengecek status</H2>
      <P>
        <C>GET /v1/transactions/:id</C> mengembalikan bentuk yang sama dengan respons di atas. Hanya tagihan milik proyek pemilik
        API key yang bisa dibaca. Utamakan webhook; cek status cocok untuk tombol &ldquo;cek pembayaran&rdquo; atau rekonsiliasi.
      </P>
      <CodeBlock title="curl" code={`curl ${api}/v1/transactions/01M6SGD18EMZHM2WPRZ4FT2ZHB \\
  -H "Authorization: Bearer $QRISMUZ_API_KEY"`} />

      <H2>Membatalkan tagihan</H2>
      <P>
        <C>POST /v1/transactions/:id/cancel</C>, mis. saat pembeli membatalkan pesanan. Hanya tagihan <C>PENDING</C> yang bisa
        dibatalkan (selain itu 409). Pembatalan tidak mengirim webhook. Bila pembeli ternyata tetap membayar, pembayaran dicatat{" "}
        <C>LATE_PAID</C>.
      </P>
      <CodeBlock title="curl" code={`curl -X POST ${api}/v1/transactions/01M6SGD18EMZHM2WPRZ4FT2ZHB/cancel \\
  -H "Authorization: Bearer $QRISMUZ_API_KEY"`} />

      <H2>Status sistem</H2>
      <P>
        <C>GET /v1/status</C> memberi tahu apakah konfirmasi otomatis sedang berjalan. Bila <C>confirmation</C> bernilai{" "}
        <C>delayed</C> (HP listener offline), tampilkan pesan seperti &ldquo;Konfirmasi pembayaran sedang lebih lambat dari
        biasanya&rdquo;.
      </P>
      <CodeBlock title="JSON" code={`{
  "listener_online": true,
  "confirmation": "realtime",
  "last_heartbeat_at": "2026-11-07T10:01:12.000Z",
  "server_time": "2026-11-07T10:01:40.120Z"
}`} />

      <H2>Error</H2>
      <P>
        Error berbentuk <C>{`{ "statusCode": 400, "message": "...", "error": "Bad Request" }`}</C>. Untuk error validasi,{" "}
        <C>message</C> bisa berupa daftar teks.
      </P>
      <Table
        head={["Kode", "Penyebab umum", "Yang dilakukan"]}
        rows={[
          ["400", "Field salah/kurang, amount bukan bilangan bulat, metadata > 4 KB, amount melebihi batas", "Perbaiki request."],
          ["401", "Header Authorization tidak ada, API key salah atau sudah dicabut", "Periksa API key di Proyek & API key."],
          ["404", "Tagihan tidak ada atau milik proyek lain", "Periksa ID."],
          ["409", "Membatalkan tagihan yang tidak PENDING; semua kode unik di rentang proyek untuk nominal itu sedang terpakai", "Cek status; untuk kode unik, coba lagi sebentar, ubah nominal, atau perlebar rentang kode unik proyek."],
          ["422", "Belum ada QRIS aktif, QRIS tidak aktif, atau lebih dari satu QRIS aktif tanpa QRIS default proyek", "Atur di halaman QRIS / Proyek."],
          ["429", "Terlalu banyak request", "Tunggu lalu ulangi."],
          ["5xx", "Gangguan server", <>Ulangi dengan <C key="c">Idempotency-Key</C> yang sama.</>],
        ]}
      />

      <H2>Saran integrasi</H2>
      <Ul>
        <li>Simpan <C>id</C> dan <C>final_amount</C> di pesanan; jangan mengandalkan <C>return_url</C> sebagai bukti bayar. Bukti bayar adalah webhook atau status <C>PAID</C>.</li>
        <li>Selalu kirim <C>Idempotency-Key</C>.</li>
        <li>Batas nominal per tagihan mengikuti batas QRIS (bawaan Rp10.000.000) dikurangi kode unik terbesar proyek.</li>
      </Ul>
    </>
  );
}
