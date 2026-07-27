import { ProviderRegistry } from './ProviderRegistry';
import { WorkspaceContextLoader } from './WorkspaceContextLoader';
import { ProviderModelRegistry } from './providers/ProviderModelRegistry';
import { ApiProvider } from '@/types';

export interface ExtractedFacts {
  businessName?: string | null;
  industry?: string | null;
  businessDescription?: string | null;
  products?: string[] | null;
  services?: string[] | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  website?: string | null;
  address?: string | null;
  operatingHours?: string | null;
  paymentTerms?: string | null;
  deliveryInformation?: string | null;
  returnPolicy?: string | null;
  refundPolicy?: string | null;
  FAQs?: { question: string; answer: string }[] | null;
  otherUsefulFacts?: { factName: string; description: string }[] | null;
}

export class BusinessFactExtractionService {
  /**
   * Calls the configured workspace LLM to extract structured facts.
   * Uses regex/mock fallbacks if LLM keys are unconfigured.
   */
  static async extractFacts(workspaceId: string, text: string): Promise<ExtractedFacts> {
    if (!text || text.trim() === '') return {};

    try {
      const context = await WorkspaceContextLoader.load(workspaceId);
      const provider = context.provider?.name;
      const apiKey = context.provider?.apiKey;
      const model = context.provider?.model;

      if (provider && apiKey && apiKey.trim()) {
        const prompt = `You are a business facts extraction assistant. Analyze this text and extract key business facts.
Respond ONLY with a valid JSON object matching this schema. If a fact is not mentioned, use null:
{
  "businessName": string | null,
  "industry": string | null,
  "businessDescription": string | null,
  "products": string[] | null,
  "services": string[] | null,
  "supportEmail": string | null,
  "supportPhone": string | null,
  "website": string | null,
  "address": string | null,
  "operatingHours": string | null,
  "paymentTerms": string | null,
  "deliveryInformation": string | null,
  "returnPolicy": string | null,
  "refundPolicy": string | null,
  "FAQs": [{"question": string, "answer": string}] | null,
  "otherUsefulFacts": [{"factName": string, "description": string}] | null
}
Do not include any explanation or markdown formatting like \`\`\`json. Output ONLY raw valid JSON.

Text:
${text}`;

        const res = await ProviderRegistry.generate(provider, apiKey, {
          systemPrompt: 'You are a precise data extraction system. Output JSON only.',
          messages: [{ role: 'user', content: prompt }],
          model: model || ProviderModelRegistry.getDefaultModel(provider as ApiProvider).modelId,
          temperature: 0.1
        });

        if (res?.reply) {
          const parsed = this.parseJSON(res.reply);
          if (parsed) return parsed;
        }
      }
    } catch (e) {
      console.warn('[BusinessFactExtractionService] LLM extraction failed. Falling back to local parser:', e);
    }

    return this.fallbackExtraction(text);
  }

  private static parseJSON(text: string): Record<string, unknown> | null {
    let clean = text.trim();
    if (clean.includes('```')) {
      const parts = clean.split('```');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.startsWith('json')) {
          clean = trimmed.substring(4).trim();
          break;
        } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          clean = trimmed;
          break;
        }
      }
    }
    try {
      return JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }
      return null;
    }
  }

  /**
   * Deterministic local text scanner matching emails, websites, phones, and policies.
   */
  private static fallbackExtraction(text: string): ExtractedFacts {
    const facts: ExtractedFacts = {
      businessName: null,
      industry: null,
      businessDescription: null,
      products: [],
      services: [],
      supportEmail: null,
      supportPhone: null,
      website: null,
      address: null,
      operatingHours: null,
      paymentTerms: null,
      deliveryInformation: null,
      returnPolicy: null,
      refundPolicy: null,
      FAQs: [],
      otherUsefulFacts: []
    };

    // Extract support email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) facts.supportEmail = emailMatch[0];

    // Extract website
    const webMatch = text.match(/(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/);
    if (webMatch) facts.website = webMatch[0];

    // Extract phone
    const phoneMatch = text.match(/(\+?\d{1,4}[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/);
    if (phoneMatch) facts.supportPhone = phoneMatch[0];

    // Extract Name heuristic (e.g., "Company Name is X" or "Welcome to Y")
    const companyMatch = text.match(/(?:company|business|name|called)\s+(?:is|of)\s+([A-Za-z0-9\s]{2,20})(?:\.|\n|,)/i);
    if (companyMatch) facts.businessName = companyMatch[1].trim();

    return facts;
  }
}
