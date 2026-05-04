import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  turbopack: {
    root: __dirname,
  },
  devIndicators: false,
};

export default nextConfig;
