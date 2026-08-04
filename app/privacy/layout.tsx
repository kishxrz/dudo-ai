import React from "react";
import { Metadata } from "next";
import { SEO_CONFIG } from "@/lib/seo/config";
import JsonLd from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: `Privacy Policy | ${SEO_CONFIG.siteName}`,
  description: `Read Dudo's Privacy Policy. Learn how we store, process, and protect your business credentials, conversations, and workspace information.`,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: `Privacy Policy | ${SEO_CONFIG.siteName}`,
    description: `Read Dudo's Privacy Policy. Learn how we store, process, and protect your business credentials, conversations, and workspace information.`,
    url: `${SEO_CONFIG.siteUrl}/privacy`,
    type: "website",
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbs = getBreadcrumbSchema([
    { name: "Home", item: "/" },
    { name: "Privacy Policy", item: "/privacy" },
  ]);

  return (
    <>
      <JsonLd schema={breadcrumbs} />
      {children}
    </>
  );
}
