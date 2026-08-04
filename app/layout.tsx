import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import JsonLd from "@/components/seo/JsonLd";
import { getOrganizationSchema, getWebSiteSchema, getSoftwareApplicationSchema } from "@/lib/seo/jsonld";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Dudo - AI Employee for WhatsApp & Telegram",
    template: "%s | Dudo",
  },
  description: "Launch your AI employee in 60 seconds. Dudo is the AI employee that answers every customer in your voice - 24/7, in Tamil, Hindi or English.",
  metadataBase: new URL("https://dudo.site"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Dudo - AI Employee for WhatsApp & Telegram",
    description: "Launch your AI employee in 60 seconds. Dudo is the AI employee that answers every customer in your voice - 24/7, in Tamil, Hindi or English.",
    url: "https://dudo.site",
    siteName: "Dudo",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "Dudo Logo" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Dudo - AI Employee for WhatsApp & Telegram",
    description: "Launch your AI employee in 60 seconds. Dudo is the AI employee that answers every customer in your voice - 24/7.",
    images: ["/icon.png"],
  },
};

import { connection } from "next/server";
import { AuthProvider } from "@/contexts/AuthContext";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  
  const globalSchemas = [
    getOrganizationSchema(),
    getWebSiteSchema(),
    getSoftwareApplicationSchema()
  ];

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth overflow-x-hidden`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <JsonLd schema={globalSchemas} />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
