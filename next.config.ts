import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
