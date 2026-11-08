import type { Metadata } from "next";
import { A, C, Callout, DocTitle, H2, P, Steps, Table, Ul } from "@/components/docs/prose";

export const metadata: Metadata = { title: "Menambah QRIS · Dokumentasi" };

export default function DocsQris() {
  return (
    <>
      <DocTitle
        title="Menambah QRIS"
        lead="QRIS statis dari DANA Bisnis dan GoPay Merchant menjadi bahan QR dinamis. Satu gateway bisa memakai beberapa QRIS sekaligus; setiap QRIS dipasangkan dengan aplikasi yang mengirim notifikasinya."
      />

      <H2>Mengambil QRIS statis</H2>
      <Ul>
        <li><strong>DANA Bisnis</strong>: buka menu QRIS/Terima pembayaran, lalu screenshot QR-nya atau unduh gambar QRIS.</li>
        <li><strong>GoPay Merchant</strong>: buka menu QRIS, lalu screenshot atau unduh/bagikan QR.</li>
        <li>Foto QRIS cetak (standee di meja kasir) juga bisa, asal QR terlihat utuh, tidak silau, dan cukup tajam.</li>
      </Ul>
      <Callout tone="warn" title="Gunakan QRIS statis">
        Jangan memakai QR yang sudah berisi nominal (QR dinamis dari aplikasi). Dashboard akan menandai QR seperti itu sebelum
        disimpan.
      </Callout>

      <H2>Menambah lewat dashboard</H2>
      <Steps
        items={[
          { title: "Buka QRIS → Tambah QRIS", body: <P>Bila belum ada QRIS sama sekali, form langsung terbuka.</P> },
          {
            title: "Unggah foto atau screenshot",
            body: (
              <P>
                Tekan <strong>Pilih foto</strong>, seret gambar ke kotak unggah, atau tempel screenshot dengan Ctrl+V. QR dibaca
                langsung di browser; foto tidak dikirim ke server. Bila tidak terbaca, coba screenshot dari aplikasi merchant atau
                foto yang lebih lurus.
              </P>
            ),
          },
          {
            title: "Periksa pratinjau",
            body: (
              <P>
                Pastikan nama merchant, kota, dan NMID sesuai dengan akun Anda, dan kotak bertuliskan <strong>QRIS statis
                valid</strong>. Peringatan merah berarti QR rusak/terpotong atau QR dinamis.
              </P>
            ),
          },
          {
            title: "Isi label dan package, lalu Tambah QRIS",
            body: (
              <P>
                Label hanya untuk Anda (mis. &ldquo;DANA Bisnis&rdquo;) dan sering terisi otomatis. Package boleh dikosongkan
                dulu; isi setelah diketahui dari HP listener (lihat di bawah).
              </P>
            ),
          },
        ]}
      />
      <P>
        Tanpa foto pun bisa: buka <strong>Atau tempel teks QRIS secara manual</strong> dan tempel teks hasil aplikasi pemindai QR
        (diawali <C>000201</C>).
      </P>

      <H2>Package aplikasi sumber</H2>
      <P>
        Setiap QRIS harus dipasangkan dengan nama package Android aplikasi yang mengirim notifikasinya, misalnya package DANA
        Bisnis untuk QRIS DANA. Server hanya mencocokkan notifikasi dari package itu dengan tagihan QRIS itu, sehingga dua QRIS
        tidak saling tertukar.
      </P>
      <Steps
        items={[
          {
            title: "Cari nama package di HP listener",
            body: (
              <P>
                Di aplikasi listener buka <strong>Mode deteksi</strong>, lalu bayar Rp1 ke QRIS tersebut dari HP lain. Nama
                package aplikasi yang memunculkan notifikasi akan tampil.
              </P>
            ),
          },
          {
            title: "Isi di dashboard",
            body: (
              <P>
                Di halaman QRIS tekan <strong>Ubah</strong> pada kartu QRIS, isi package, lalu Simpan. Kolom package menyarankan
                nama-nama yang sudah dilaporkan HP listener.
              </P>
            ),
          },
          {
            title: "Muat ulang daftar di HP",
            body: (
              <P>
                HP listener memuat daftar package baru dalam ±10 menit. Agar langsung, buka <strong>Perangkat</strong> dan tekan{" "}
                <strong>Muat ulang konfigurasi</strong>.
              </P>
            ),
          },
        ]}
      />
      <Callout title="Notifikasi sebelum package diisi tidak hilang">
        Notifikasi dari package yang belum terdaftar tetap disimpan sebagai &ldquo;Diabaikan&rdquo; di Mutasi masuk. Setelah
        package diisi, tekan <strong>Proses ulang</strong> di Mutasi masuk agar ikut dicocokkan.
      </Callout>

      <H2>Beberapa QRIS sekaligus</H2>
      <Table
        head={["Situasi", "QRIS yang dipakai tagihan"]}
        rows={[
          [<>Tagihan menyertakan <C>qris_source_id</C></>, "QRIS itu."],
          ["Proyek punya QRIS default", <>QRIS default proyek (atur di <A href="/docs/proyek">Proyek & API key</A>).</>],
          ["Hanya ada satu QRIS aktif", "QRIS itu."],
          ["Lebih dari satu QRIS aktif tanpa default", <>Ditolak dengan error 422. Setel QRIS default proyek.</>],
        ]}
      />

      <H2>Menonaktifkan QRIS</H2>
      <P>
        Tekan <strong>Nonaktifkan</strong> pada kartu QRIS bila akun merchant bermasalah. Tagihan baru tidak memakai QRIS itu,
        tetapi tagihan lama dan pembayarannya tetap diproses. QRIS tidak dihapus agar riwayat transaksi tetap utuh.
      </P>
    </>
  );
}
