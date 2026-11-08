import type { MetadataRoute } from "next";

/** Hanya landing page dan dokumentasi yang boleh diindeks; dashboard dan halaman bayar tidak. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/$", "/docs"], disallow: ["/dashboard", "/login", "/pay/", "/transaksi", "/mutasi", "/proyek", "/perangkat", "/qris", "/parser", "/webhook", "/pengaturan"] },
  };
}
