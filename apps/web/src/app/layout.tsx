import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "qrismuz",
    template: "%s · qrismuz",
  },
  description: "Payment gateway QRIS dinamis untuk proyek milik sendiri.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Bilah alamat Chrome memakai warna kanvas, jadi tepi atas halaman tidak lagi
  // melebur dengan antarmuka browser.
  themeColor: "#f3f3f2",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-svh antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
