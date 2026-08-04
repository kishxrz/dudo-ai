import React from "react";
import { Metadata } from "next";
import { SEO_CONFIG } from "@/lib/seo/config";
import ResourcesLayoutClient from "@/components/resources/ResourcesLayoutClient";

export const metadata: Metadata = {
  title: {
    default: `Resources & Guides | ${SEO_CONFIG.siteName}`,
    template: `%s | ${SEO_CONFIG.siteName} Resources`,
  },
  description: "Browse Dudo's customer success guides, marketing automation templates, integrations blueprints, and product updates.",
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: `Resources & Guides | ${SEO_CONFIG.siteName}`,
    description: "Browse Dudo's customer success guides, marketing automation templates, integrations blueprints, and product updates.",
    url: `${SEO_CONFIG.siteUrl}/resources`,
    type: "website",
  },
};

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return <ResourcesLayoutClient>{children}</ResourcesLayoutClient>;
}
