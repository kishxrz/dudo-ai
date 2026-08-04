import React from "react";
import { Metadata } from "next";
import HomePage from "@/components/landing/HomePage";
import JsonLd from "@/components/seo/JsonLd";
import { SEO_CONFIG } from "@/lib/seo/config";
import {
  getOrganizationSchema,
  getWebSiteSchema,
  getSoftwareApplicationSchema,
  getProductSchema,
  getFAQSchema,
} from "@/lib/seo/jsonld";
import { faqItems } from "@/data/faq";

export const metadata: Metadata = {
  title: SEO_CONFIG.defaultTitle,
  description: SEO_CONFIG.defaultDescription,
  keywords: SEO_CONFIG.defaultKeywords,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.defaultDescription,
    url: SEO_CONFIG.siteUrl,
    siteName: SEO_CONFIG.siteName,
    images: [
      {
        url: `${SEO_CONFIG.siteUrl}${SEO_CONFIG.defaultOgImage}`,
        width: 512,
        height: 512,
        alt: `${SEO_CONFIG.siteName} Logo`,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.defaultDescription,
    images: [`${SEO_CONFIG.siteUrl}${SEO_CONFIG.defaultOgImage}`],
    creator: SEO_CONFIG.twitterHandle,
  },
};

export default function Page() {
  const schemas = [
    getOrganizationSchema(),
    getWebSiteSchema(),
    getSoftwareApplicationSchema(),
    getProductSchema(),
    getFAQSchema(faqItems),
  ];

  return (
    <>
      <JsonLd schema={schemas} />
      <HomePage />
    </>
  );
}
