import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { buildSupportRAGContext } from '@/lib/support/dudoSupportRAG';
import { buildDudoSupportSystemPrompt } from '@/lib/support/supportPrompt';
import { resolveActiveProvider } from '@/lib/ai/ServerProviderResolver';

interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user via Firebase Admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required to use Dudo Support Assistant.' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1]?.trim();
    let decodedToken;
    try {
      const adminAuth = getAuth();
      if (!adminAuth) {
        throw new Error('Firebase Admin Auth not initialized');
      }
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (authErr) {
      console.error('[DudoSupportAssistant] Auth error:', authErr);
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'Invalid authentication session.' },
        { status: 401 }
      );
    }

    // 2. Parse request payload
    const body = await req.json().catch(() => ({}));
    const { message, history, workspaceId } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Message content is required.' },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'MESSAGE_TOO_LONG', message: 'Message exceeds maximum length of 2000 characters.' },
        { status: 400 }
      );
    }

    const userDisplayName = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';
    const activeWorkspaceId = workspaceId || 'default';

    // 3. Resolve Groq API Key
    let groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
    let selectedModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!groqApiKey && activeWorkspaceId) {
      try {
        const resolved = await resolveActiveProvider(activeWorkspaceId, 'groq');
        if (resolved && resolved.apiKey) {
          groqApiKey = resolved.apiKey;
          if (resolved.model) selectedModel = resolved.model;
        }
      } catch (provErr) {
        console.warn('[DudoSupportAssistant] Could not resolve provider from Firestore:', provErr);
      }
    }

    if (!groqApiKey) {
      return NextResponse.json({
        success: true,
        reply: "Hey! Groq API Key is not configured yet bro. Please add your Groq API key under **Agent → API Keys** or set `GROQ_API_KEY` in environment variables to enable the AI Support Assistant."
      });
    }

    // 4. Retrieve Grounded Knowledge via RAG (intent-driven, query only)
    const ragContext = buildSupportRAGContext(message);

    // 5. Construct System Prompt
    const systemPrompt = buildDudoSupportSystemPrompt(ragContext, {
      userDisplayName,
      workspaceId: activeWorkspaceId
    });

    // 6. Format chat history (limit to last 8 messages)
    const formattedHistory: ChatMessageInput[] = Array.isArray(history)
      ? history
          .slice(-8)
          .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
          .map(m => ({ role: m.role, content: m.content }))
      : [];

    const messages = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: message }
    ];

    // 7. Execute Groq API Request
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: 0.4,
        max_tokens: 800
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '');
      console.error(`[DudoSupportAssistant] Groq API error (${groqRes.status}):`, errText);
      return NextResponse.json({
        success: true,
        reply: "Sorry bro! The AI model encountered a temporary issue responding right now. Please check your Groq API key in **Agent → API Keys** or try again in a moment."
      });
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that response.";

    return NextResponse.json({
      success: true,
      reply
    });

  } catch (error: unknown) {
    console.error('[DudoSupportAssistant] Route Error:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while communicating with the support assistant.'
      },
      { status: 500 }
    );
  }
}
