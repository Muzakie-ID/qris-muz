import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server mandiri yang kecil untuk image Docker (lihat Dockerfile).
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
