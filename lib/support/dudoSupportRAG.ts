/**
 * Dudo Support RAG Retrieval Engine
 * Matches user query and route context to relevant Dudo Product Documentation chunks.
 */

import { DUDO_PRODUCT_DOCS, KnowledgeDoc } from './dudoKnowledgeBase';

export function retrieveRelevantSupportDocs(query: string, currentRoute?: string): KnowledgeDoc[] {
  const normalizedQuery = query.toLowerCase().trim();
  const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 1);

  const scoredDocs = DUDO_PRODUCT_DOCS.map(doc => {
    let score = 0;

    // 1. Route boost
    if (currentRoute && doc.route) {
      const cleanRoute = currentRoute.split('?')[0];
      const cleanDocRoute = doc.route.split('?')[0];
      if (cleanRoute === cleanDocRoute) {
        score += 15;
      }
      if (currentRoute.includes('tab=') && doc.route.includes('tab=')) {
        const routeTab = new URLSearchParams(currentRoute.split('?')[1] || '').get('tab');
        const docTab = new URLSearchParams(doc.route.split('?')[1] || '').get('tab');
        if (routeTab && docTab && routeTab === docTab) {
          score += 25;
        }
      }
    }

    // 2. Keyword matching
    for (const keyword of doc.keywords) {
      if (normalizedQuery.includes(keyword)) {
        score += 20;
      } else {
        const kwTokens = keyword.split(/\s+/);
        for (const kwToken of kwTokens) {
          if (queryTokens.includes(kwToken)) {
            score += 5;
          }
        }
      }
    }

    // 3. Title & Content matching
    const titleLower = doc.title.toLowerCase();
    for (const token of queryTokens) {
      if (titleLower.includes(token)) score += 8;
      if (doc.content.toLowerCase().includes(token)) score += 2;
    }

    return { doc, score };
  });

  // Sort descending by score
  scoredDocs.sort((a, b) => b.score - a.score);

  // Return top 3-4 highest scoring documents (score > 0) or fallback to top 2 if score is low
  const matched = scoredDocs.filter(item => item.score > 0).map(item => item.doc);

  if (matched.length === 0) {
    // Default fallback to getting started and troubleshooting docs
    return DUDO_PRODUCT_DOCS.filter(d => d.id === 'getting-started-overview' || d.id === 'troubleshooting-guide');
  }

  return matched.slice(0, 4);
}

export function buildSupportRAGContext(query: string, currentRoute?: string): string {
  const docs = retrieveRelevantSupportDocs(query, currentRoute);

  if (!docs || docs.length === 0) {
    return 'No specific Dudo documentation matches found.';
  }

  return docs.map(d => `--- SECTION: ${d.title} (Category: ${d.category}) ---\n${d.content}`).join('\n\n');
}
