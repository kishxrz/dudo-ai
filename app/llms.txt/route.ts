import { NextResponse } from "next/server";
import { SEO_CONFIG } from "@/lib/seo/config";
import { faqItems } from "@/data/faq";

export async function GET() {
  const llmsText = `# ${SEO_CONFIG.siteName} - AI Employee Platform

## Description
Dudo is your 24/7 AI employee designed specifically for small businesses. It connects directly to your WhatsApp Business and Telegram channels to handle customer inquiries, book appointments, qualify leads, and send product catalogs—all in your business's custom brand voice.

- Website: ${SEO_CONFIG.siteUrl}
- Core Stack: Next.js, Firebase, Framer Motion, Tailwind CSS
- Integration Support: WhatsApp, Telegram
- AI Model Integration: OpenAI, Anthropic (Claude), Gemini, Groq, DeepSeek (BYOK - Bring Your Own Key)

## Features
- **Instant Setup**: Zero code setup in under 60 seconds using industry templates.
- **Multilingual Support**: Natively understands and replies in English, Hindi, Tamil, Telugu, Kannada, Tanglish, Hinglish, etc.
- **Human Takeover**: 1-click human handoff allows takeover of any chat from the simple dashboard.
- **BYOK (Bring Your Own Key)**: Zero AI token markup. You pay the model provider directly.
- **Knowledge Base Syncing**: Upload files, link text pages, or type instructions to build a customized workspace knowledge graph.
- **Automated Bookings**: Direct integration with schedules and appointments.

## Sitemap
- Homepage: ${SEO_CONFIG.siteUrl}/
- Contact Sales: ${SEO_CONFIG.siteUrl}/contact
- Resources Hub: ${SEO_CONFIG.siteUrl}/resources
- Blog: ${SEO_CONFIG.siteUrl}/resources/blog
- Guides: ${SEO_CONFIG.siteUrl}/resources/guides
- Templates: ${SEO_CONFIG.siteUrl}/resources/templates
- Pricing: ${SEO_CONFIG.siteUrl}/#pricing

## Frequently Asked Questions
${faqItems.map((faq) => `- **Q**: ${faq.q}\n  **A**: ${faq.a}`).join("\n")}
`;

  return new NextResponse(llmsText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1200",
    },
  });
}
