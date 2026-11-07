/**
 * Alat baris perintah untuk uji gerbang Tahap 1 tanpa menjalankan server.
 *
 *   npm run qris -- inspect "<qris statis>"
 *   npm run qris -- dynamic "<qris statis>" 50087 [qris-50087.png]
 *
 * Bila "<qris statis>" diisi "-", dipakai QRIS_STATIC_PAYLOAD dari environment.
 */
import { writeFileSync } from 'node:fs';
import * as QRCode from 'qrcode';
import { QrisError, parseQris, toDynamicQris } from '../qris/core';

const MAX = Number(process.env.QRIS_MAX_AMOUNT ?? 10_000_000);

function source(arg: string | undefined): string {
  const value =
    arg === '-' || arg === undefined ? process.env.QRIS_STATIC_PAYLOAD : arg;
  if (!value)
    throw new Error(
      'QRIS statis belum diberikan (argumen atau QRIS_STATIC_PAYLOAD).',
    );
  return value;
}

async function main(): Promise<void> {
  const [command, payloadArg, amountArg, outArg] = process.argv.slice(2);

  if (command === 'inspect') {
    console.log(JSON.stringify(parseQris(source(payloadArg)).info, null, 2));
    return;
  }

  if (command === 'dynamic') {
    const amount = Number(amountArg);
    const payload = toDynamicQris(source(payloadArg), amount, {
      maxAmount: MAX,
    });
    const info = parseQris(payload).info;
    const out = outArg ?? `qris-${amount}.png`;
    writeFileSync(
      out,
      await QRCode.toBuffer(payload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 512,
      }),
    );
    console.log(`Merchant : ${info.merchantName} (NMID ${info.nmid ?? '-'})`);
    console.log(`Nominal  : Rp${amount.toLocaleString('id-ID')}`);
    console.log(`Payload  : ${payload}`);
    console.log(`Gambar   : ${out}`);
    return;
  }

  console.log(
    'Pemakaian:\n  npm run qris -- inspect "<qris>"\n  npm run qris -- dynamic "<qris>" <nominal> [file.png]',
  );
  process.exitCode = 1;
}

main().catch((e: unknown) => {
  if (e instanceof QrisError) console.error(`Gagal (${e.code}): ${e.message}`);
  else console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
