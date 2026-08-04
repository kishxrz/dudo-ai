import React from "react";
import { Metadata } from "next";
import { SEO_CONFIG } from "@/lib/seo/config";
import JsonLd from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: `Contact Us | ${SEO_CONFIG.siteName}`,
  description: "Have questions about enterprise setup, custom APIs, regional languages, or regional setups? Get in touch with Dudo sales and support.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: `Contact Us | ${SEO_CONFIG.siteName}`,
    description: "Have questions about enterprise setup, custom APIs, regional languages, or regional setups? Get in touch with Dudo sales and support.",
    url: `${SEO_CONFIG.siteUrl}/contact`,
    type: "website",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbs = getBreadcrumbSchema([
    { name: "Home", item: "/" },
    { name: "Contact", item: "/contact" },
  ]);

  return (
    <>
      <JsonLd schema={breadcrumbs} />
      {children}
    </>
  );
}
