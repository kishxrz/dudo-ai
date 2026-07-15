import { NextRequest, NextResponse } from 'next/server';
import { resolveActiveProvider } from '@/lib/ai/ServerProviderResolver';
import { ProviderRegistry } from '@/lib/ai/ProviderRegistry';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';

export interface PersonaAnswers {
  businessName: string;
  productsServices: string;
  typicalCustomers: string;
  communicationStyle: string;
  languages: string;
  specialRules: string;
}

/**
 * POST /api/agent/generate-persona
 *
 * Body: { workspaceId: string, answers: PersonaAnswers }
 *
 * Uses Firebase Admin to resolve the active provider & API key server-side.
 * NEVER returns the API key. NEVER falls back to client-side Firestore.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { workspaceId, answers } = body as {
      workspaceId: string;
      answers: PersonaAnswers;
    };

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspaceId is required.' }, { status: 400 });
    }

    if (
      !answers?.businessName?.trim() ||
      !answers?.productsServices?.trim() ||
      !answers?.typicalCustomers?.trim()
    ) {
      return NextResponse.json(
        { error: 'Incomplete answers — at least businessName, productsServices, and typicalCustomers are required.' },
        { status: 400 }
      );
    }

    const denied = await requireSubscription(req, workspaceId);
    if (denied) return denied;

    // 1. Resolve active provider via Admin SDK — no client credentials
    let provider;
    try {
      provider = await resolveActiveProvider(workspaceId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Distinguish Admin SDK configuration error from "no provider configured"
      if (msg.includes('Admin SDK') || msg.includes('initialised')) {
        return NextResponse.json(
          { error: 'SERVER_CONFIG_ERROR', message: msg },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    if (!provider) {
      return NextResponse.json(
        {
          error: 'NO_PROVIDER',
          message:
            'No valid AI provider is configured. Add and validate an API key before generating a persona.',
        },
        { status: 200 }
      );
    }

    // 2. Build the generation prompt
    const userPrompt = buildPersonaPrompt(answers);

    // 3. Call the provider
    let reply = '';
    try {
      const response = await ProviderRegistry.generate(provider.name, provider.apiKey, {
        systemPrompt: PERSONA_DESIGNER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        model: provider.model,
        temperature: 0.65,
      });
      reply = response.reply?.trim() || '';
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'AI generation failed.';
      // Do not log API key. Log provider name and error message only.
      console.error(`[generate-persona] Provider "${provider.name}" error:`, msg);
      return NextResponse.json(
        { error: 'GENERATION_ERROR', message: msg },
        { status: 200 }
      );
    }

    if (!reply) {
      return NextResponse.json(
        { error: 'GENERATION_ERROR', message: 'The AI returned an empty response. Please try again.' },
        { status: 200 }
      );
    }

    // 4. Return ONLY the generated prompt — no keys, no provider metadata
    return NextResponse.json({ prompt: reply });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[generate-persona] Unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const PERSONA_DESIGNER_SYSTEM_PROMPT = `You are an expert AI agent configurator. Your job is to write a concise, production-ready system prompt for a customer-facing AI agent.

Output rules:
- Use exactly these section headers in order: # Identity, # Business Context, # Customers, # Communication Style, # Core Responsibilities, # Business Rules, # Accuracy & Safety Rules, # Example Behaviors
- Each section: 2–5 bullet points or 1–2 short sentences. Never write walls of text.
- Total output: 500–900 words. Do not exceed this.
- Written in second person: the AI is addressed as "You".
- No filler phrases like "As an AI...", "I am designed to...", "It is important to..."
- No marketing language. No repetition across sections.
- # Example Behaviors: exactly 3 short Q&A examples (User: / You:) showing the style.
- Return ONLY the system prompt. No preamble, no explanation, no markdown code blocks.`;

function buildPersonaPrompt(answers: PersonaAnswers): string {
  const parts = [
    `Business: ${answers.businessName}`,
    `Products/Services: ${answers.productsServices}`,
    `Customers: ${answers.typicalCustomers}`,
    `Tone: ${answers.communicationStyle || 'professional and friendly'}`,
    `Languages: ${answers.languages || 'English'}`,
  ];

  if (answers.specialRules?.trim()) {
    parts.push(`Special instructions: ${answers.specialRules}`);
  }

  return `Write a system prompt for an AI customer support agent using the business details below.\n\n${parts.join('\n')}`;
}
