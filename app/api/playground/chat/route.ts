import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { collection, addDoc, query, orderBy, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { WorkspaceContextLoader } from '@/lib/ai/WorkspaceContextLoader';
import { ConversationService } from '@/lib/ai/ConversationService';
import { checkUsageLimit, incrementConversationUsage, canUseFeature } from '@/lib/billing-entitlements-server';

function formatKnowledgeDoc(data: any): string {
  if (!data) return '';
  const lines: string[] = [];

  // Check custom business profile fields
  if (data.businessName?.trim()) lines.push(`Business Name: ${data.businessName.trim()}`);
  if (data.industry?.trim()) lines.push(`Industry: ${data.industry.trim()}`);
  
  const desc = data.businessDescription || data.description;
  if (desc?.trim()) lines.push(`Business Description: ${desc.trim()}`);
  
  if (data.productsServices?.trim()) lines.push(`Products & Services: ${data.productsServices.trim()}`);
  if (data.supportEmail?.trim()) lines.push(`Support Email: ${data.supportEmail.trim()}`);
  if (data.supportPhone?.trim()) lines.push(`Support Phone: ${data.supportPhone.trim()}`);
  if (data.website?.trim()) lines.push(`Website: ${data.website.trim()}`);

  // Check legacy fields
  if (data.businessDetails?.trim()) lines.push(`Business Details: ${data.businessDetails.trim()}`);
  if (data.commonQuestions?.trim()) lines.push(`Common Questions: ${data.commonQuestions.trim()}`);
  if (data.policies?.trim()) lines.push(`Policies: ${data.policies.trim()}`);

  // Check dynamic knowledge item fields
  if (data.type === 'faq') {
    const q = (data.question || data.title || '').trim();
    const a = (data.answer || data.source || '').trim();
    if (q && a) lines.push(`Q: ${q}\nA: ${a}`);
  } else if (data.type === 'text' || data.type === 'url') {
    if (data.title?.trim() && data.source?.trim()) {
      lines.push(`[${data.title.trim()}]\n${data.source.trim()}`);
    }
  } else if (['pdf', 'docx', 'txt', 'md'].includes(data.type)) {
    if (data.title?.trim()) {
      const content = data.source && data.source !== data.title
        ? `\nParsed Content:\n${data.source.trim()}`
        : '';
      lines.push(`${data.title.trim()}${content}`);
    }
  } else {
    // General fallback
    if (data.content?.trim()) {
      lines.push(data.content.trim());
    }
  }

  return lines.join('\n');
}

function parseLocalKnowledge(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseLocalKnowledge(parsed);
      } catch (e) {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(val)) {
    return val.map(item => formatKnowledgeDoc(item)).filter(Boolean).join('\n\n');
  }
  if (typeof val === 'object') {
    return formatKnowledgeDoc(val);
  }
  return '';
}



export async function POST(req: NextRequest) {
  try {
    const startSetup = Date.now();
    const adminDb = getAdminDb();
    const body = await req.json();
    const {
      message,
      history = [],
      provider,
      model,
      temperature = 0.7,
      memoryEnabled = true,
      knowledgeEnabled = true,
      systemPrompt,
      workspaceId = 'workspace-1',
      // apiKey is sent by the client (authenticated browser read) so the server
      // doesn't need to re-read Firestore without an auth token.
      apiKey = '',
    } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace context is missing.' }, { status: 400 });
    }

    const usageAllowed = await checkUsageLimit(workspaceId, 'conversations');
    if (!usageAllowed) {
      return NextResponse.json({ error: 'Upgrade required: Conversation limit reached for your plan.' }, { status: 403 });
    }

    const activeProv = provider || 'openai';
    const providerAllowed = await canUseFeature(workspaceId, `api-providers.${activeProv.toLowerCase()}`);
    if (!providerAllowed) {
      return NextResponse.json({ error: `Upgrade required: The provider '${activeProv}' is not allowed on your current plan.` }, { status: 403 });
    }

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }

    const firstWord = message.trim().split(/\s+/)[0]?.toLowerCase();
    if (['/takeover', '/resume', '/status'].includes(firstWord)) {
      return NextResponse.json({
        reply: "🚫 System Commands (such as /takeover, /resume, /status) are only supported and executed on connected WhatsApp or Telegram channels, not within the testing playground or website chat."
      });
    }

    const durationSetup = Date.now() - startSetup;
    console.log(`[Timer] Playground setup/auth checks took ${durationSetup}ms`);

    const startTime = Date.now();

    // 1. Load workspace context ONCE — the clientApiKey is injected so no
    //    unauthenticated Firestore re-read is needed anywhere downstream.
    const startContext = Date.now();
    let context;
    try {
      context = await WorkspaceContextLoader.load(workspaceId, provider, apiKey);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load workspace context.';
      console.error('[Chat Route] WorkspaceContextLoader failed:', e);
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    const durationContext = Date.now() - startContext;
    console.log(`[Timer] Playground WorkspaceContextLoader.load took ${durationContext}ms`);

    const activeProvider = provider || context.provider.name;
    const activeModel    = model    || context.provider.model;

    // 2. Generate AI reply — context (with apiKey) passed directly.
    //    ConversationService no longer calls WorkspaceContextLoader internally.
    let activeSystemPrompt = systemPrompt || context.assistant.systemPrompt || '';

    // FIX 4 - Overriding context knowledge with custom local draft values if provided,
    // avoiding manual loading/injection here to prevent duplication.
    if (knowledgeEnabled && body?.knowledgeData) {
      const kData = body.knowledgeData;
      const localKnowledgeTexts: string[] = [];
      if (kData.knowledgeBase) {
        const formatted = parseLocalKnowledge(kData.knowledgeBase);
        if (formatted) localKnowledgeTexts.push(formatted);
      }
      if (kData.businessProfile) {
        const formatted = parseLocalKnowledge(kData.businessProfile);
        if (formatted) localKnowledgeTexts.push(formatted);
      }
      const customKnowledgeText = Array.from(new Set(localKnowledgeTexts.filter(t => t.trim().length > 0))).join('\n\n');
      context.knowledge = customKnowledgeText;
    }

    // Bound Playground conversation history to the latest 15 messages (between 10 and 20) in chronological order
    const boundedHistory = (history || []).slice(-15);

    const result = await ConversationService.generateReply(
      // Merge the selected provider/model overrides into the context so the
      // service always uses whatever the UI has selected.
      {
        ...context,
        provider: {
          name:   activeProvider,
          model:  activeModel,
          apiKey: context.provider.apiKey,
        },
      },
      message,
      boundedHistory,
      {
        model,
        temperature,
        memoryEnabled,
        knowledgeEnabled,
        systemPrompt: activeSystemPrompt,
      }
    );

    const endTime = Date.now();
    const latency = endTime - startTime;
    const llmLatency = result.diagnostics?.llmLatency ?? latency;

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const inputTokens  = result.inputTokens  || 0;
    const outputTokens = result.outputTokens || 0;
    const totalTokens  = inputTokens + outputTokens;

    // 3. Log playground session (capped at 50 entries)
    if (adminDb || db) {
      try {
        const startPersistence = Date.now();
        const sessionPayload = {
          provider: activeProvider,
          model:    activeModel,
          temperature,
          memoryEnabled,
          knowledgeEnabled,
          message,
          reply:   result.reply,
          latency: llmLatency,
          tokenUsage: { inputTokens, outputTokens, totalTokens },
          statusCode: 200,
          createdAt:  new Date(),
        };

        if (adminDb) {
          const sessionsRef = adminDb.collection(`workspaces/${workspaceId}/playground_sessions`);
          await sessionsRef.add(sessionPayload);
          const qSnap = await sessionsRef.orderBy('createdAt', 'desc').get();
          if (qSnap.size > 50) {
            for (const sessionDoc of qSnap.docs.slice(50)) {
              await sessionDoc.ref.delete();
            }
          }
        } else if (db) {
          const sessionsRef = collection(db, 'workspaces', workspaceId, 'playground_sessions');
          await addDoc(sessionsRef, sessionPayload);

          const qSnap = await getDocs(query(sessionsRef, orderBy('createdAt', 'desc')));
          if (qSnap.size > 50) {
            for (const d of qSnap.docs.slice(50)) {
              await deleteDoc(d.ref);
            }
          }
        }
        const durationPersistence = Date.now() - startPersistence;
        console.log(`[Timer] Playground session logging took ${durationPersistence}ms`);
      } catch (logError) {
        console.error('Failed to log playground session to Firestore:', logError);
      }
    }

    await incrementConversationUsage(workspaceId);

    const durationTotal = Date.now() - startSetup;
    console.log(`[Timer] Playground total API route duration took ${durationTotal}ms`);

    // 4. Return response
    return NextResponse.json({
      reply: result.reply,
      diagnostics: {
        provider:     activeProvider,
        model:        activeModel,
        latency:      llmLatency,
        totalLatency: durationTotal,
        inputTokens,
        outputTokens,
        totalTokens,
        status: 'Success',
        time:   new Date().toLocaleTimeString(),
        ...result.diagnostics,
      },
    });

  } catch (err: unknown) {
    console.error('Playground chat route error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
