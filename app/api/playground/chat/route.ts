import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { collection, addDoc, query, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { WorkspaceContextLoader } from '@/lib/ai/WorkspaceContextLoader';
import { ConversationService } from '@/lib/ai/ConversationService';
import { KnowledgeService } from '@/lib/ai/KnowledgeService';
import { requireSubscription, checkSubscription, incrementConversationCount } from '@/lib/subscription/SubscriptionService';
import { TextExtractionService } from '@/lib/ai/TextExtractionService';

function formatKnowledgeDoc(data: any): string {
  if (!data) return '';
  const lines: string[] = [];

  if (data.businessName?.trim()) lines.push(`Business Name: ${data.businessName.trim()}`);
  if (data.industry?.trim()) lines.push(`Industry: ${data.industry.trim()}`);
  
  const desc = data.businessDescription || data.description;
  if (desc?.trim()) lines.push(`Business Description: ${desc.trim()}`);
  
  if (data.productsServices?.trim()) lines.push(`Products & Services: ${data.productsServices.trim()}`);
  if (data.supportEmail?.trim()) lines.push(`Support Email: ${data.supportEmail.trim()}`);
  if (data.supportPhone?.trim()) lines.push(`Support Phone: ${data.supportPhone.trim()}`);
  if (data.website?.trim()) lines.push(`Website: ${data.website.trim()}`);

  if (data.businessDetails?.trim()) lines.push(`Business Details: ${data.businessDetails.trim()}`);
  if (data.commonQuestions?.trim()) lines.push(`Common Questions: ${data.commonQuestions.trim()}`);
  if (data.policies?.trim()) lines.push(`Policies: ${data.policies.trim()}`);

  if (data.type === 'faq') {
    const q = (data.question || data.title || '').trim();
    const a = (data.answer || data.source || '').trim();
    if (q && a) lines.push(`Q: ${q}\nA: ${a}`);
  } else if (data.type === 'text' || data.type === 'url') {
    if (data.title?.trim() && data.source?.trim()) {
      lines.push(`[${data.title.trim()}]\n${data.source.trim()}`);
    }
  } else if (['pdf', 'docx', 'txt', 'md', 'csv', 'xlsx', 'xls', 'pptx', 'ppt'].includes(data.type)) {
    if (data.title?.trim()) {
      const content = data.source && data.source !== data.title
        ? `\nParsed Content:\n${data.source.trim()}`
        : '';
      lines.push(`${data.title.trim()}${content}`);
    }
  } else {
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
      attachedFile,
      history = [],
      provider,
      model,
      temperature = 0.7,
      memoryEnabled = true,
      knowledgeEnabled = true,
      systemPrompt,
      workspaceId = 'workspace-1',
      apiKey = '',
      stream = false,
      voiceSettings,
    } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace context is missing.' }, { status: 400 });
    }

    // Save voice preferences to Firestore if provided
    if (adminDb && voiceSettings) {
      try {
        await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).set({
          sttProvider: voiceSettings.sttProvider,
          ttsProvider: voiceSettings.ttsProvider,
          ttsVoice: voiceSettings.ttsVoice,
        }, { merge: true });
      } catch (saveErr) {
        console.warn('[Playground Chat] Failed to save assistant voice preferences:', saveErr);
      }
    }

    // Enforce active subscription + conversation limit
    const subDenied = await requireSubscription(req, workspaceId, 'conversations');
    if (subDenied) return subDenied;

    // Enforce AI provider entitlement
    const activeProv = provider || 'openai';
    const providerCheck = await checkSubscription(workspaceId, `api-providers.${activeProv.toLowerCase()}`);
    if (!providerCheck.allowed) {
      return NextResponse.json({ error: providerCheck.reason ?? `The provider '${activeProv}' is not available on your plan.`, code: providerCheck.code }, { status: 403 });
    }

    if ((!message || !message.trim()) && !attachedFile) {
      return NextResponse.json({ error: 'Message content or file is required.' }, { status: 400 });
    }

    // Process attachment / parsing on the fly
    let messageText = message || '';
    let attachedContent: any = null;

    if (attachedFile) {
      const { name, type, base64 } = attachedFile;
      if (type.startsWith('image/')) {
        attachedContent = {
          type: 'image_url',
          image_url: {
            url: `data:${type};base64,${base64}`,
          },
        };
      } else {
        const ext = name.split('.').pop()?.toLowerCase() || '';
        try {
          const parsedText = TextExtractionService.extractText(base64, ext as any);
          if (parsedText.trim()) {
            messageText = `[Document Content: ${name}]\n${parsedText.trim()}\n\n[User Message]: ${message || ''}`;
          }
        } catch (e) {
          console.error('[Playground Chat] Document extraction failed:', e);
        }
      }
    }

    const firstWord = messageText.trim().split(/\s+/)[0]?.toLowerCase();
    if (['/takeover', '/resume', '/status'].includes(firstWord)) {
      return NextResponse.json({
        reply: "🚫 System Commands are only supported and executed on WhatsApp or Telegram channels, not within the testing playground."
      });
    }

    const startTime = Date.now();
    let context;
    try {
      context = await WorkspaceContextLoader.load(workspaceId, provider, apiKey);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load workspace context.';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const activeProvider = provider || context.provider.name;
    const activeModel    = model    || context.provider.model;
    let activeSystemPrompt = systemPrompt || context.assistant.systemPrompt || '';

    if (knowledgeEnabled) {
      let dbKnowledge = context.knowledge || '';
      if (!dbKnowledge) {
        dbKnowledge = await KnowledgeService.getFormattedKnowledge(workspaceId);
      }
      context.knowledge = dbKnowledge;
    }

    const boundedHistory = (history || []).slice(-15);
    const generateOptions = {
      model: activeModel,
      temperature,
      memoryEnabled,
      knowledgeEnabled,
      systemPrompt: activeSystemPrompt,
      attachedContent,
    };

    // If streaming requested
    if (stream) {
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            const streamGen = ConversationService.generateReplyStream(
              {
                ...context,
                provider: {
                  name: activeProvider,
                  model: activeModel,
                  apiKey: context.provider.apiKey,
                },
              },
              messageText,
              boundedHistory,
              generateOptions
            );

            let replyText = '';
            for await (const chunk of streamGen) {
              replyText += chunk.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.text })}\n`));
            }

            const diagnostics = {
              provider: activeProvider,
              model: activeModel,
              latency: Date.now() - startTime,
              status: 'Success',
              time: new Date().toLocaleTimeString(),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ diagnostics })}\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n'));

            try {
              if (adminDb) {
                const sessionPayload = {
                  provider: activeProvider,
                  model: activeModel,
                  temperature,
                  memoryEnabled,
                  knowledgeEnabled,
                  message: messageText,
                  reply: replyText,
                  latency: Date.now() - startTime,
                  tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                  statusCode: 200,
                  createdAt: new Date(),
                };
                await adminDb.collection(`workspaces/${workspaceId}/playground_sessions`).add(sessionPayload);
              }
              await incrementConversationCount(workspaceId);
            } catch (err) {
              console.warn('Logging session after stream failed:', err);
            }
          } catch (e: any) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `⚠️ Error: ${e.message}` })}\n`));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(customStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Otherwise standard JSON response
    const result = await ConversationService.generateReply(
      {
        ...context,
        provider: {
          name:   activeProvider,
          model:  activeModel,
          apiKey: context.provider.apiKey,
        },
      },
      messageText,
      boundedHistory,
      generateOptions
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

    if (adminDb || db) {
      try {
        const sessionPayload = {
          provider: activeProvider,
          model:    activeModel,
          temperature,
          memoryEnabled,
          knowledgeEnabled,
          message: messageText,
          reply:   result.reply,
          latency: llmLatency,
          tokenUsage: { inputTokens, outputTokens, totalTokens },
          statusCode: 200,
          createdAt:  new Date(),
        };

        if (adminDb) {
          const sessionsRef = adminDb.collection(`workspaces/${workspaceId}/playground_sessions`);
          await sessionsRef.add(sessionPayload);
        }
      } catch (logError) {
        console.error('Failed to log playground session:', logError);
      }
    }

    await incrementConversationCount(workspaceId);

    return NextResponse.json({
      reply: result.reply,
      diagnostics: {
        provider:     activeProvider,
        model:        activeModel,
        latency:      llmLatency,
        totalLatency: Date.now() - startSetup,
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
