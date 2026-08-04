import { NextRequest, NextResponse } from 'next/server';
import { generateHtmlEmail } from '@/lib/email/templates';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const templateType = searchParams.get('template') || 'onboarding-welcome';
  const name = searchParams.get('name') || 'John Doe';

  const unsubscribeUrl = '#';
  const preferencesUrl = '#';

  // Dummy extra data matching templates configs
  const extraData = {
    whatsappConnected: true,
    telegramConnected: false,
    docsCount: 3,
    convCount: 42,
    articleTitle: 'Advanced Dynamic Context Matching Guidelines',
    articleBody: 'Grounding conversational workflows using direct matching heuristics keeps response speeds low and limits token overheads.',
    actionableTip: 'Demarcate plain text facts using standard guidelines labels.',
    featureSpotlight: 'Instant Knowledge Ingestion Engine',
    featureSpotlightDesc: 'Train agents on PDFs in under 5 seconds.',
    featureTitle: 'Multimodal Chatroom Automation Support',
    featureSub: 'Upload and parse voice recordings.',
    featureDesc: 'Let clients speak instructions directly over WhatsApp messages.',
    title: 'Dudo Newsletter - July Release Spotlight',
    newFeatures: '- WhatsApp Webhook Auto Recovery\n- Custom prompt validation constraints',
    improvements: '- Dynamic summary contexts pruning\n- 10x faster vector searches',
    bugFixes: '- Fixed settings inputs sync loops\n- Resolved dashboard responsive layout gaps',
    promptOfTheWeek: 'Set agent context rules:\n- Treat all inbound messages as direct customer queries.\n- Speak like an enterprise support engineer.',
    communityHighlight: '@freshcart just processed their 5,000th automated query!'
  };

  const { html } = generateHtmlEmail(templateType, name, unsubscribeUrl, preferencesUrl, extraData);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}
export const dynamic = 'force-dynamic';
