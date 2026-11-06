import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
