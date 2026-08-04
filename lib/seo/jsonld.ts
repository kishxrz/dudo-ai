import { SEO_CONFIG } from "./config";

export interface BreadcrumbItem {
  name: string;
  item: string;
}

export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SEO_CONFIG.siteUrl}/#organization`,
    "name": SEO_CONFIG.siteName,
    "url": SEO_CONFIG.siteUrl,
    "logo": {
      "@type": "ImageObject",
      "@id": `${SEO_CONFIG.siteUrl}/#logo`,
      "url": `${SEO_CONFIG.siteUrl}/icon.png`,
      "caption": SEO_CONFIG.siteName
    },
    "image": {
      "@id": `${SEO_CONFIG.siteUrl}/#logo`
    },
    "sameAs": [
      // Add Twitter/LinkedIn/etc profiles here if available
    ]
  };
}

export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SEO_CONFIG.siteUrl}/#website`,
    "name": SEO_CONFIG.siteName,
    "url": SEO_CONFIG.siteUrl,
    "publisher": {
      "@id": `${SEO_CONFIG.siteUrl}/#organization`
    },
    "potentialAction": [
      {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${SEO_CONFIG.siteUrl}/resources?q={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      }
    ]
  };
}

export function getSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SEO_CONFIG.siteUrl}/#software`,
    "name": SEO_CONFIG.siteName,
    "url": SEO_CONFIG.siteUrl,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0.00",
      "priceCurrency": "USD"
    }
  };
}

export function getProductSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Dudo AI Business Agent",
    "image": `${SEO_CONFIG.siteUrl}/icon.png`,
    "description": "Enterprise-grade AI employee for WhatsApp & Telegram. Connect in 60 seconds to automate support and drive conversions.",
    "brand": {
      "@type": "Brand",
      "name": SEO_CONFIG.siteName
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": "11.99",
      "highPrice": "23.99",
      "offerCount": "2"
    }
  };
}

export function getFAQSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };
}

export function getBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.item.startsWith("http") ? item.item : `${SEO_CONFIG.siteUrl}${item.item}`
    }))
  };
}

export function getArticleSchema(article: {
  title: string;
  description: string;
  slug: string;
  publishDate: string;
  image?: string;
  authorName: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${SEO_CONFIG.siteUrl}/resources/blog/${article.slug}`
    },
    "headline": article.title,
    "description": article.description,
    "image": article.image ? (article.image.startsWith("http") ? article.image : `${SEO_CONFIG.siteUrl}${article.image}`) : `${SEO_CONFIG.siteUrl}/icon.png`,
    "datePublished": article.publishDate,
    "author": {
      "@type": "Person",
      "name": article.authorName
    },
    "publisher": {
      "@id": `${SEO_CONFIG.siteUrl}/#organization`
    }
  };
}
