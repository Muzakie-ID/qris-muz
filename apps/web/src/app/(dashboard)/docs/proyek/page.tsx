import type { Metadata } from "next";
import { A, C, Callout, DocTitle, H2, P, Steps, Table } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Proyek & API key · Dokumentasi" };

export default function DocsProyek() {
  return (
    <>
      <DocTitle
        title="Proyek & API key"
        lead="Setiap aplikasi atau website yang memakai gateway dibuat sebagai proyek. Proyek punya API key untuk membuat tagihan, webhook secret untuk memverifikasi kabar dari qrismuz, dan pengaturan bawaan tagihan."
      />

      <H2>Membuat proyek</H2>
      <Steps
        items={[
          { title: "Buka Proyek & API key → Proyek baru", body: <P>Isi nama dan pengaturan di bawah, lalu Buat proyek.</P> },
          {
            title: "Simpan webhook secret",
            body: (
              <P>
                Secret (diawali <C>whsec_</C>) hanya ditampilkan <strong>sekali</strong>. Salin ke konfigurasi server proyek Anda,
                mis. variabel lingkungan <C>QRISMUZ_WEBHOOK_SECRET</C>.
              </P>
            ),
          },
          {
            title: "Buat API key",
            body: (
              <P>
                Tekan <strong>API key baru</strong> di kartu proyek. Key (diawali <C>qm_live_</C>) juga hanya tampil sekali; simpan
                sebagai <C>QRISMUZ_API_KEY</C> di server proyek.
              </P>
            ),
          },
        ]}
      />
      <Callout tone="warn" title="Jangan taruh API key di aplikasi Android atau JavaScript browser">
        API key hanya untuk server proyek. Siapa pun yang memegang key bisa membuat dan membatalkan tagihan proyek itu.
      </Callout>

      <H2>Pengaturan proyek</H2>
      <Table
        head={["Pengaturan", "Fungsi"]}
        rows={[
          ["URL webhook", <>Alamat server proyek yang menerima kabar <C>transaction.paid</C>, <C>transaction.expired</C>, dan <C>transaction.late_paid</C>. Kosong = webhook tidak dikirim. Lihat <A href="/docs/webhook">Webhook</A>.</>],
          ["Return URL default", <>Tujuan pembeli setelah lunas, bila tagihan tidak membawa <C>return_url</C> sendiri.</>],
          ["QRIS default", "QRIS yang dipakai tagihan proyek ini bila tidak menyebut qris_source_id. Wajib diisi bila ada lebih dari satu QRIS aktif."],
          ["Masa berlaku tagihan", <>Bawaan 15 menit (1–1440). Bisa diganti per tagihan dengan <C>expiry_min</C>.</>],
        ]}
      />
      <P>Semua pengaturan bisa diubah kapan saja lewat <strong>Ubah pengaturan proyek</strong>; perubahan berlaku untuk tagihan berikutnya.</P>

      <H2>Mengganti atau mencabut API key</H2>
      <Steps
        items={[
          { title: "Buat API key baru", body: <P>Satu proyek boleh punya beberapa key aktif sekaligus.</P> },
          { title: "Pasang key baru di server proyek", body: <P>Deploy, lalu pastikan tagihan baru masih bisa dibuat. Kolom &ldquo;Terakhir dipakai&rdquo; menunjukkan key mana yang masih dipakai.</P> },
          { title: "Cabut key lama", body: <P>Request dengan key yang dicabut langsung ditolak (401).</P> },
        ]}
      />
      <P>
        Bila key bocor, cabut segera lalu buat yang baru. Webhook secret tidak bisa diganti dari dashboard; bila secret bocor, buat
        proyek baru dan pindahkan integrasi ke proyek itu.
      </P>
    </>
  );
}
