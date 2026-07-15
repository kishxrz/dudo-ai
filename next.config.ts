import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer', 'firebase-admin'],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
