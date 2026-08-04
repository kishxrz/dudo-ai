import { NextResponse } from "next/server";
import { ContentRepository } from "@/lib/resources/ContentRepository";
import { SEO_CONFIG } from "@/lib/seo/config";

export async function GET() {
  const articles = ContentRepository.getArticles({ sort: "newest" });

  const itemsXml = articles
    .map((article) => {
      const link = `${SEO_CONFIG.siteUrl}/resources/blog/${article.slug}`;
      const pubDate = new Date(article.publishDate).toUTCString();
      const description = article.seoDescription || article.description;

      return `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
    </item>`;
    })
    .join("");

  const rssFeedXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SEO_CONFIG.siteName} Blog & Resources</title>
    <link>${SEO_CONFIG.siteUrl}/resources</link>
    <description>Blueprints, tutorials, and strategy guides for business AI employees and automation.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SEO_CONFIG.siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssFeedXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1200, stale-while-revalidate=600",
    },
  });
}
