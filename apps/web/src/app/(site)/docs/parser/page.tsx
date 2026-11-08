import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code";
import { A, C, Callout, DocTitle, H2, P, Steps, Table, Ul } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Mutasi & parser · Dokumentasi" };

export default function DocsParser() {
  return (
    <>
      <DocTitle
        title="Mutasi & parser"
        lead="Setiap notifikasi dana masuk disimpan mentah sebagai mutasi, lalu dibaca nominalnya oleh parser dan dicocokkan dengan tagihan. Karena teks mentah selalu disimpan, tidak ada pembayaran yang hilang walau format notifikasi berubah."
      />

      <H2>Hasil di Mutasi masuk</H2>
      <Table
        head={["Hasil", "Arti", "Yang dilakukan"]}
        rows={[
          ["Cocok", "Nominal terbaca dan cocok dengan tagihan aktif. Tagihan lunas.", "Tidak ada."],
          ["Bayar telat", "Cocok dengan tagihan yang sudah kedaluwarsa/dibatalkan.", <>Lihat <A href="/docs/pembayaran">Alur pembayaran</A>.</>],
          ["Tidak cocok", "Nominal terbaca, tetapi tidak ada tagihan dengan nominal itu (atau dari parser umum yang tidak dicocokkan otomatis).", "Cek dana masuknya; tandai lunas manual bila memang untuk pesanan tertentu."],
          ["Tak terbaca", "Tidak ada pola parser yang bisa membaca nominal.", "Perbaiki/tambah parser lalu Proses ulang."],
          ["Diabaikan", "Notifikasi uji, atau dari package yang belum terdaftar di QRIS mana pun.", "Bila seharusnya dana masuk: isi package di QRIS lalu Proses ulang."],
        ]}
      />

      <H2>Cara parser bekerja</H2>
      <Ul>
        <li>Judul dan isi notifikasi digabung, lalu dicoba dengan setiap pola aktif.</li>
        <li>Parser khusus package dicoba lebih dulu, lalu parser umum (package kosong); masing-masing urut prioritas, angka kecil dulu.</li>
        <li>Grup tangkap pertama <C>( )</C> harus berisi nominal. <C>Rp50.087</C>, <C>50.087,00</C>, dan <C>1,250,000</C> dibaca benar.</li>
        <li>Parser dengan <strong>Cocok otomatis</strong> mati hanya mencatat nominal untuk ditinjau, tidak melunasi tagihan. Bawaannya dipakai untuk pola umum yang bisa salah tangkap, misalnya notifikasi penarikan dana.</li>
      </Ul>
      <P>Contoh pola untuk notifikasi &ldquo;Rp50.087 diterima DANA Bisnis.&rdquo;:</P>
      <CodeBlock title="regex" code={String.raw`Rp\s?([\d.,]+)\s+diterima`} />

      <H2>Saat notifikasi tak terbaca</H2>
      <Steps
        items={[
          { title: "Salin teksnya", body: <P>Di <A href="/mutasi?filter=UNPARSED">Mutasi masuk → Tak terbaca</A>, salin judul dan isi notifikasi.</P> },
          {
            title: "Uji di halaman Parser",
            body: (
              <P>
                Tempel di <strong>Uji notifikasi</strong>, isi package, kosongkan pola, lalu Uji untuk melihat apakah parser yang ada
                bisa membacanya. Bila tidak, tulis pola baru di kolom pola dan uji sampai nominal terbaca benar.
              </P>
            ),
          },
          { title: "Simpan sebagai parser", body: <P>Tambahkan di <strong>Parser baru</strong> dengan package yang sama dan prioritas kecil (mis. 5).</P> },
          { title: "Proses ulang", body: <P>Tekan <strong>Proses ulang mutasi</strong>. Mutasi lama yang kini terbaca dan cocok langsung melunasi tagihannya (atau tercatat bayar telat).</P> },
        ]}
      />
      <Callout tone="tip" title="Mencegah format berubah tiba-tiba">
        Matikan update otomatis DANA Bisnis dan GoPay Merchant di HP listener. Bila versinya tetap berubah, alarm Telegram dikirim:
        kirim pembayaran uji untuk memastikan notifikasinya masih terbaca.
      </Callout>
    </>
  );
}
