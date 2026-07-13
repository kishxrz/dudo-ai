import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { doc, getDoc, addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { handleIntent } from '@/lib/intent-handler';
import { processAdminCommand, isConversationInTakeover } from '@/lib/security';

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
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatKnowledgeDoc(parsed);
      } catch (e) {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof val === 'object') {
    return formatKnowledgeDoc(val);
  }
  return '';
}


const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Sends a text message back to a Telegram chat.
 */
async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

/**
 * Calls your LLM proxy route (reuses the playground/chat handler).
 */
async function getAIReply(
  workspaceId: string,
  userMessage: string,
  systemPrompt: string,
  provider: string,
  model: string,
): Promise<string> {
  const baseUrl = process.env.INTERNAL_API_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const res = await fetch(`${baseUrl}/api/playground/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      history: [],
      provider,
      model,
      temperature: 0.7,
      systemPrompt,
      workspaceId,
    }),
  });

  if (!res.ok) {
    console.error('AI proxy error:', await res.text());
    return "Sorry, I'm having trouble right now. Please try again shortly.";
  }

  const data = await res.json();
  return data.reply || "I couldn't generate a response. Please try again.";
}

/**
 * Loads the workspace's active Telegram bot token.
 * Checks Firestore first, then env fallback.
 */
async function loadBotConfig(workspaceId: string): Promise<{
  token: string;
  systemPrompt: string;
  provider: string;
  model: string;
} | null> {
  let token = '';
  let systemPrompt = 'You are a helpful customer support assistant. Be concise and friendly.';
  let provider = 'openai';
  let model = 'gpt-4o-mini';
  const adminDb = getAdminDb();

  if (!adminDb && !db) return null;

  try {
    // Load Telegram channel config
    const channelSnap = adminDb
      ? await adminDb.doc(`workspaces/${workspaceId}/channels/ch-tg`).get()
      : await getDoc(doc(db!, 'workspaces', workspaceId, 'channels', 'ch-tg'));
    const channelExists = typeof channelSnap.exists === 'function' ? channelSnap.exists() : channelSnap.exists;
    if (!channelExists || channelSnap.data()?.status !== 'connected') {
      return null; // Channel not connected for this workspace
    }
    token = channelSnap.data()?.token || '';

    // Load assistant system prompt
    const assistantSnap = adminDb
      ? await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get()
      : await getDoc(doc(db!, 'workspaces', workspaceId, 'assistants', 'assistant-1'));
    const assistantExists = typeof assistantSnap.exists === 'function' ? assistantSnap.exists() : assistantSnap.exists;
    if (assistantExists) {
      systemPrompt = assistantSnap.data()?.systemPrompt || systemPrompt;
    }

    // Load active provider
    const providersList = ['openai', 'gemini', 'anthropic', 'groq', 'deepseek', 'mistral', 'openrouter'];
    let activeProviderData: { name: string; model: string } | null = null;
    let fallbackProviderData: { name: string; model: string } | null = null;

    for (const p of providersList) {
      const provSnap = adminDb
        ? await adminDb.doc(`workspaces/${workspaceId}/providers/${p}`).get()
        : await getDoc(doc(db!, 'workspaces', workspaceId, 'providers', p));
      const providerExists = typeof provSnap.exists === 'function' ? provSnap.exists() : provSnap.exists;
      
      if (providerExists) {
        const data = provSnap.data();
        if (data?.apiKey) {
          if (data.active === true) {
            activeProviderData = {
              name: p,
              model: data.model || model
            };
            break; // Active provider found, stop loop immediately
          }
          if (!fallbackProviderData) {
            fallbackProviderData = {
              name: p,
              model: data.model || model
            };
          }
        }
      }
    }

    const resolved = activeProviderData || fallbackProviderData;
    if (resolved) {
      provider = resolved.name;
      model = resolved.model;
    }

    // Knowledge is injected centrally by WorkspaceContextLoader -> KnowledgeService
    // -> PromptBuilder in /api/playground/chat. Avoid manual legacy prompt assembly here.
  } catch (e) {
    console.error('loadBotConfig error:', e);
    return null;
  }

  if (!token) return null;
  return { token, systemPrompt, provider, model };
}

/**
 * Logs the conversation to Firestore.
 */
async function logConversation(
  workspaceId: string,
  chatId: number,
  senderName: string,
  userText: string,
  botReply: string,
) {
  const adminDb = getAdminDb();
  if (!adminDb && !db) return;
  try {
    const payload = {
      channel: 'telegram',
      chatId,
      customer: { name: senderName },
      userMessage: userText,
      botReply,
      status: 'bot',
      timestamp: adminDb ? new Date() : serverTimestamp(),
    };

    if (adminDb) {
      await adminDb.collection(`workspaces/${workspaceId}/conversations`).add(payload);
    } else if (db) {
      await addDoc(collection(db, 'workspaces', workspaceId, 'conversations'), payload);
    }
  } catch (e) {
    console.error('logConversation error:', e);
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * GET — Telegram sends a GET to verify the webhook URL.
 * Just return 200.
 */
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Dudo Telegram webhook is active.' });
}

/**
 * POST — Telegram sends every update here.
 * URL: /api/webhooks/telegram/[workspaceId]
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle text messages
  const message = update?.message;
  if (!message?.text) {
    return NextResponse.json({ ok: true }); // Ignore non-text updates (photos, stickers, etc.)
  }

  const chatId: number = message.chat.id;
  const userText: string = message.text.trim();
  const senderName: string =
    [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') ||
    'Unknown';

  // Load bot config for this workspace
  const config = await loadBotConfig(workspaceId);
  if (!config) {
    console.warn(`No active Telegram config for workspace: ${workspaceId}`);
    return NextResponse.json({ ok: true });
  }

  const conversationId = `tg-${chatId}`;

  // 1. Process administrative takeover/resume/status commands
  const commandResult = await processAdminCommand(
    workspaceId,
    'telegram',
    conversationId,
    message.from?.id,
    message.from?.username,
    userText
  );
  if (commandResult.isCommand) {
    await sendTelegramMessage(config.token, chatId, commandResult.replyMessage);
    return NextResponse.json({ ok: true });
  }

  // 2. Check if the conversation is locked in HUMAN_TAKEOVER mode
  const inTakeover = await isConversationInTakeover(workspaceId, conversationId);
  if (inTakeover) {
    console.log(`[Telegram Webhook] Conversation ${conversationId} is in Takeover. Skipping AI reply.`);
    await logConversation(workspaceId, chatId, senderName, userText, '[Human Operator Active]');
    return NextResponse.json({ ok: true });
  }

  // Handle /start command
  if (userText === '/start') {
    await sendTelegramMessage(
      config.token,
      chatId,
      `👋 Hi ${senderName}! I'm your AI assistant. How can I help you today?`,
    );
    return NextResponse.json({ ok: true });
  }

  // Execute intent before AI reply
  let actionResultContext = '';
  try {
    const intentResult = await handleIntent(workspaceId, userText, 'telegram', senderName);
    if (intentResult && intentResult.actionTaken) {
      if (intentResult.actionResult.startsWith('[BACKGROUND:')) {
        actionResultContext = `\n\nACTION COMPLETED: ${intentResult.actionResult}`;
      } else {
        actionResultContext = `\n\nACTION COMPLETED: ${intentResult.actionResult}\nTell the user this action was completed successfully.`;
      }
    }
  } catch (e) {
    console.error('[Telegram Webhook] Error executing handleIntent:', e);
  }

  const adminDb = getAdminDb();

  // Check if Google is connected for this workspace
  let isGoogleConnected = false;
  try {
    const docRef = adminDb
      ? adminDb.doc(`workspaces/${workspaceId}/integrations/google`)
      : db
        ? doc(db, 'workspaces', workspaceId, 'integrations', 'google')
        : null;
    if (docRef) {
      const snap = await (adminDb ? (docRef as any).get() : getDoc(docRef as any));
      const snapExists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
      if (snapExists && snap.data()?.status === 'connected') {
        isGoogleConnected = true;
      }
    }
  } catch (e) {
    console.error('[Telegram Webhook] Failed to check Google connection:', e);
  }

  // Load knowledge base from Firestore & localStorage
  let activeSystemPrompt = config.systemPrompt;

  if (isGoogleConnected) {
    activeSystemPrompt += "\n\nYou have access to Google Calendar, Gmail, Google Sheets, Google Drive and Google Docs for this business.\nWhen a user wants to book an appointment, confirm you are booking it and tell them the details.\nWhen asked to send an email, confirm you sent it.\nAlways be proactive - if someone asks to book, BOOK IT.";
  }

  const knowledgeTexts: string[] = [];

  // - Try path: workspaces/{workspaceId}/knowledge/knowledge-base
  try {
    const legacySnap = adminDb
      ? await adminDb.doc(`workspaces/${workspaceId}/knowledge/knowledge-base`).get()
      : db
        ? await getDoc(doc(db, 'workspaces', workspaceId, 'knowledge', 'knowledge-base'))
        : null;
    const legacyExists = legacySnap ? (typeof legacySnap.exists === 'function' ? legacySnap.exists() : legacySnap.exists) : false;
    if (legacyExists && legacySnap) {
      const formatted = formatKnowledgeDoc(legacySnap.data());
      if (formatted) knowledgeTexts.push(formatted);
    }
  } catch (e) {
    console.error('[Telegram Webhook] Failed to load legacy knowledge-base:', e);
  }

  // - Also try: workspaces/{workspaceId}/knowledge (as collection)
  try {
    const collectionDocs = adminDb
      ? (await adminDb.collection(`workspaces/${workspaceId}/knowledge`).get()).docs
      : db
        ? (await getDocs(collection(db, 'workspaces', workspaceId, 'knowledge'))).docs
        : [];
    for (const d of collectionDocs) {
      if (d.id === 'knowledge-base') continue; // Avoid duplicating
      const formatted = formatKnowledgeDoc(d.data());
      if (formatted) knowledgeTexts.push(formatted);
    }
  } catch (e) {
    console.error('[Telegram Webhook] Failed to load knowledge collection:', e);
  }

  // - Also check localStorage key: __dudo_dev_knowledge_base
  let localRaw: string | null = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localRaw = localStorage.getItem('__dudo_dev_knowledge_base');
    }
  } catch (e) {}
  if (localRaw) {
    const formattedLocal = parseLocalKnowledge(localRaw);
    if (formattedLocal) {
      knowledgeTexts.push(formattedLocal);
    }
  }

  const knowledgeText = Array.from(new Set(knowledgeTexts.filter(t => t.trim().length > 0))).join('\n\n');
  if (knowledgeText) {
    activeSystemPrompt += "\n\n--- Business Knowledge ---\n" + knowledgeText;
  }

  // Append action results context if actions were completed
  if (actionResultContext) {
    activeSystemPrompt += actionResultContext;
  }

  // Get AI reply
  const reply = await getAIReply(
    workspaceId,
    userText,
    activeSystemPrompt,
    config.provider,
    config.model,
  );


  // Send reply
  await sendTelegramMessage(config.token, chatId, reply);

  // Log to Firestore
  await logConversation(workspaceId, chatId, senderName, userText, reply);

  return NextResponse.json({ ok: true });
}
