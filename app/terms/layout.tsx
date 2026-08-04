import React from "react";
import { Metadata } from "next";
import { SEO_CONFIG } from "@/lib/seo/config";
import JsonLd from "@/components/seo/JsonLd";
import { getBreadcrumbSchema } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: `Terms of Service | ${SEO_CONFIG.siteName}`,
  description: `Read Dudo's Terms of Service. Review user obligations, platform rules, billing conditions, and BYOK token usage guidelines.`,
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: `Terms of Service | ${SEO_CONFIG.siteName}`,
    description: `Read Dudo's Terms of Service. Review user obligations, platform rules, billing conditions, and BYOK token usage guidelines.`,
    url: `${SEO_CONFIG.siteUrl}/terms`,
    type: "website",
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  const breadcrumbs = getBreadcrumbSchema([
    { name: "Home", item: "/" },
    { name: "Terms of Service", item: "/terms" },
  ]);

  return (
    <>
      <JsonLd schema={breadcrumbs} />
      {children}
    </>
  );
}
