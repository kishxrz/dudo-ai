/**
 * Dudo Support RAG Retrieval Engine
 * Matches user query intent to relevant Dudo Product Documentation.
 * Ignores page-specific assumptions and skips doc retrieval for casual greetings.
 */

import { DUDO_PRODUCT_DOCS, KnowledgeDoc } from './dudoKnowledgeBase';

// List of simple greeting phrases that shouldn't trigger doc retrieval
const GREETING_REGEX = /^(dei|hi|hello|hey|vanakkam|vanakam|namaste|sup|yo|bro|good morning|good evening|good afternoon|how are you|hlo|hii|helo)(\s+(bro|dudo|there|buddy|paji))?[!\?\. ]*$/i;

export function retrieveRelevantSupportDocs(query: string): KnowledgeDoc[] {
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Skip doc retrieval for simple greetings or casual chatter
  if (GREETING_REGEX.test(normalizedQuery) || normalizedQuery.length < 3) {
    return [];
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 1);

  // Intent detection rules
  const isKnowledgeQuery = /knowledge|upload|pdf|docx|txt|document|faq|url|link|file|ingest|source/i.test(normalizedQuery);
  const isWhatsAppQuery = /whatsapp|qr|code|scan|pair|phone|railway|session/i.test(normalizedQuery);
  const isTelegramQuery = /telegram|botfather|token|bot token|@botfather/i.test(normalizedQuery);
  const isBillingQuery = /price|pricing|cost|plan|billing|subscription|999|2499|trial|pay|upgrade|renew|how much/i.test(normalizedQuery);
  const isAgentCreateQuery = /create agent|new agent|setup agent|make agent|build agent|start agent/i.test(normalizedQuery);
  const isApiKeyQuery = /api key|groq|openai|gemini|anthropic|deepseek|mistral|openrouter|model|byok/i.test(normalizedQuery);
  const isPersonalityQuery = /personality|assistant name|system prompt|instructions|timezone|boss access|speaking style/i.test(normalizedQuery);
  const isTestingQuery = /testing|playground|live|pause|status|draft/i.test(normalizedQuery);
  const isSkillsQuery = /skill|skills|skill store|capability|template/i.test(normalizedQuery);
  const isAppointmentsQuery = /appointment|calendar|google calendar|booking|schedule/i.test(normalizedQuery);
  const isTroubleshootQuery = /not working|not responding|error|failed|expired|problem|issue|bug|fix|help/i.test(normalizedQuery);

  const scoredDocs = DUDO_PRODUCT_DOCS.map(doc => {
    let score = 0;

    // Intent boosts
    if (isKnowledgeQuery && doc.category === 'Knowledge') score += 40;
    if (isWhatsAppQuery && doc.id === 'agent-channels-whatsapp') score += 50;
    if (isTelegramQuery && doc.id === 'agent-channels-telegram') score += 50;
    if (isBillingQuery && doc.category === 'Account & Workspace') score += 40;
    if (isAgentCreateQuery && (doc.id === 'getting-started-overview' || doc.category === 'Getting Started')) score += 40;
    if (isApiKeyQuery && doc.id === 'agent-api-keys') score += 50;
    if (isPersonalityQuery && doc.id === 'agent-personality') score += 50;
    if (isTestingQuery && doc.id === 'agent-testing-playground') score += 50;
    if (isSkillsQuery && doc.id === 'agent-skills') score += 50;
    if (isAppointmentsQuery && doc.id === 'appointments-calendar') score += 50;
    if (isTroubleshootQuery && doc.id === 'troubleshooting-guide') score += 30;

    // Keyword matching
    for (const keyword of doc.keywords) {
      if (normalizedQuery.includes(keyword)) {
        score += 25;
      } else {
        const kwTokens = keyword.split(/\s+/);
        for (const kwToken of kwTokens) {
          if (queryTokens.includes(kwToken)) {
            score += 6;
          }
        }
      }
    }

    // Title & Content matching
    const titleLower = doc.title.toLowerCase();
    for (const token of queryTokens) {
      if (titleLower.includes(token)) score += 10;
      if (doc.content.toLowerCase().includes(token)) score += 3;
    }

    return { doc, score };
  });

  // Sort descending by score
  scoredDocs.sort((a, b) => b.score - a.score);

  // Filter out irrelevant docs (score <= 15)
  const matched = scoredDocs.filter(item => item.score > 15).map(item => item.doc);

  return matched.slice(0, 3);
}

export function buildSupportRAGContext(query: string): string {
  const docs = retrieveRelevantSupportDocs(query);

  if (!docs || docs.length === 0) {
    return 'No specific Dudo documentation required for this message.';
  }

  return docs.map(d => `--- SECTION: ${d.title} (Category: ${d.category}) ---\n${d.content}`).join('\n\n');
}
