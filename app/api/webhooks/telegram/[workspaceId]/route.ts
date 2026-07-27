/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { handleIntent } from '@/lib/intent-handler';
import { processAdminCommand, isConversationInTakeover } from '@/lib/security';
import { WorkspaceContextLoader } from '@/lib/ai/WorkspaceContextLoader';
import { ConversationService } from '@/lib/ai/ConversationService';
import { TextExtractionService } from '@/lib/ai/TextExtractionService';
import { readWorkspaceMemory } from '@/lib/ai/EnterpriseOrchestrationEngine';

const TELEGRAM_API = 'https://api.telegram.org/bot';

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;
  console.log(`[Telegram API] sendTelegramMessage START — URL: ${url} chat_id: ${chatId}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    signal: AbortSignal.timeout(15000)
  });
  
  const headersObj: Record<string, string> = {};
  res.headers.forEach((v, k) => { headersObj[k] = v; });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[Telegram API] sendTelegramMessage FAILED: status=${res.status} body=${errorBody}`);
    console.error(`[Telegram API] Response Headers:`, JSON.stringify(headersObj));
    throw new Error(`Telegram sendMessage failed: status=${res.status} body=${errorBody}`);
  }

  const responseJson = await res.json();
  const messageId = responseJson.result?.message_id;
  console.log(`[Telegram API] sendTelegramMessage DONE — status=${res.status} message_id=${messageId}`);
}

/**
 * Sends a chat action (like typing) to Telegram.
 */
async function sendTelegramAction(botToken: string, chatId: number, action: 'typing') {
  try {
    await fetch(`${TELEGRAM_API}${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (e) {
    console.error('[Telegram Webhook] Failed to send chat action:', e);
  }
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

/**
 * Acquires a lease lock for Telegram idempotency using a Firestore transaction.
 */
async function acquireLease(workspaceId: string, updateId: string): Promise<{ success: boolean; isCompleted: boolean }> {
  const adminDb = getAdminDb();
  const leaseDocPath = `workspaces/${workspaceId}/processed_updates/${updateId}`;
  const LEASE_DURATION_MS = 30000; // 30 seconds

  try {
    if (adminDb) {
      const ref = adminDb.doc(leaseDocPath);
      const result = await adminDb.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(ref);
        const now = Date.now();
        if (docSnap.exists) {
          const data = docSnap.data();
          if (data?.status === 'completed') {
            return { success: false, isCompleted: true };
          }
          if (data?.status === 'processing') {
            const leaseExpiry = data.leaseExpiry?.toDate ? data.leaseExpiry.toDate().getTime() : new Date(data.leaseExpiry).getTime();
            if (leaseExpiry > now) {
              // Lease is active and not expired
              return { success: false, isCompleted: false };
            }
          }
        }
        // Acquire lease
        transaction.set(ref, {
          status: 'processing',
          leaseExpiry: new Date(now + LEASE_DURATION_MS)
        });
        return { success: true, isCompleted: false };
      });
      return result;
    } else if (db) {
      const { runTransaction, doc: firestoreDoc } = require('firebase/firestore');
      const ref = firestoreDoc(db, 'workspaces', workspaceId, 'processed_updates', updateId);
      const result = await runTransaction(db, async (transaction: any) => {
        const docSnap = await transaction.get(ref);
        const now = Date.now();
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data?.status === 'completed') {
            return { success: false, isCompleted: true };
          }
          if (data?.status === 'processing') {
            const leaseExpiry = data.leaseExpiry?.toDate ? data.leaseExpiry.toDate().getTime() : new Date(data.leaseExpiry).getTime();
            if (leaseExpiry > now) {
              return { success: false, isCompleted: false };
            }
          }
        }
        transaction.set(ref, {
          status: 'processing',
          leaseExpiry: new Date(now + LEASE_DURATION_MS)
        });
        return { success: true, isCompleted: false };
      });
      return result;
    }
  } catch (e) {
    console.error('[Telegram Webhook] Error acquiring lease:', e);
  }
  return { success: false, isCompleted: false };
}

/**
 * Marks a lease as completed in Firestore.
 */
async function completeLease(workspaceId: string, updateId: string) {
  const adminDb = getAdminDb();
  const leaseDocPath = `workspaces/${workspaceId}/processed_updates/${updateId}`;
  try {
    if (adminDb) {
      const ref = adminDb.doc(leaseDocPath);
      await ref.set({
        status: 'completed',
        processedAt: new Date()
      });
    } else if (db) {
      const { doc: firestoreDoc, setDoc } = require('firebase/firestore');
      const ref = firestoreDoc(db, 'workspaces', workspaceId, 'processed_updates', updateId);
      await setDoc(ref, {
        status: 'completed',
        processedAt: new Date()
      });
    }
    console.log(`[Telegram Webhook] Leased update marked as completed: ${updateId}`);
  } catch (e) {
    console.error('[Telegram Webhook] Error completing lease:', e);
  }
}

/**
 * Releases a lease immediately in case of a processing failure.
 */
async function releaseLease(workspaceId: string, updateId: string) {
  const adminDb = getAdminDb();
  const leaseDocPath = `workspaces/${workspaceId}/processed_updates/${updateId}`;
  try {
    if (adminDb) {
      const ref = adminDb.doc(leaseDocPath);
      await ref.delete();
    } else if (db) {
      const { doc: firestoreDoc, deleteDoc } = require('firebase/firestore');
      const ref = firestoreDoc(db, 'workspaces', workspaceId, 'processed_updates', updateId);
      await deleteDoc(ref);
    }
    console.log(`[Telegram Webhook] Leased update released due to failure: ${updateId}`);
  } catch (e) {
    console.error('[Telegram Webhook] Error releasing lease:', e);
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * GET — Telegram sends a GET to verify the webhook URL.
 */
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Dudo Telegram webhook is active.' });
}

async function getTelegramFileBase64(token: string, fileId: string): Promise<{ base64: string; mimeType: string; name: string }> {
  console.log(`[Telegram API] getFile request for fileId: ${fileId}`);
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`, {
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Telegram getFile failed: ${res.statusText}`);
  const data = await res.json();
  const filePath = data.result?.file_path;
  if (!filePath) throw new Error('No file_path returned by Telegram.');

  const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  console.log(`[Telegram API] Downloading file from path: ${filePath} (URL: ${downloadUrl})`);
  const downloadRes = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(15000)
  });
  if (!downloadRes.ok) throw new Error(`Telegram file download failed: ${downloadRes.statusText}`);
  
  const buffer = Buffer.from(await downloadRes.arrayBuffer());
  const base64 = buffer.toString('base64');
  
  const name = filePath.split('/').pop() || 'file';
  let mimeType = 'application/octet-stream';
  if (filePath.endsWith('.pdf')) mimeType = 'application/pdf';
  else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) mimeType = 'image/jpeg';
  else if (filePath.endsWith('.png')) mimeType = 'image/png';

  console.log(`[VERIFICATION] Telegram download API result: file_id=${fileId} downloadUrl=${downloadUrl} mime=${mimeType} size=${buffer.length} base64 size=${base64.length}`);
  
  return { base64, mimeType, name };
}

/**
 * POST — Telegram sends every update here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const startTotal = Date.now();
  let lastSuccessfulFunction = 'None';
  let nextFunction = 'POST request initialization';

  const { workspaceId } = await params;
  console.log(`\n============================\n[Telegram Webhook] ▶ REQUEST RECEIVED at ${new Date().toISOString()} workspaceId=${workspaceId}\n============================`);

  let update: any;
  try {
    console.log(`[Telegram Webhook] [BEFORE] Parse Update`);
    update = await req.json();
    console.log(`[Telegram Webhook] [AFTER] Parse Update successfully completed.`);
    lastSuccessfulFunction = 'Parse Update';
    nextFunction = 'Acquire Lease';
  } catch (err: any) {
    console.error(`LAST SUCCESSFUL FUNCTION: ${lastSuccessfulFunction}`);
    console.error(`NEXT FUNCTION: ${nextFunction}`);
    console.error(`STATUS: Failed`);
    console.error(`ERROR: ${err.message}`);
    console.error(`STACK TRACE:`, err.stack);
    console.error(`TIME SPENT: ${Date.now() - startTotal}ms`);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = update?.message;
  const hasText = !!message?.text;
  const hasPhoto = !!message?.photo && message.photo.length > 0;
  const hasDocument = !!message?.document;

  if (!message || (!hasText && !hasPhoto && !hasDocument)) {
    console.log(`[Telegram Webhook] Ignore non-message/non-media updates.`);
    return NextResponse.json({ ok: true });
  }

  const chatId: number = message.chat.id;
  const userText: string = (message.text || message.caption || '').trim();
  const senderName: string =
    [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') ||
    'Unknown';

  const updateId = update.update_id;
  if (!updateId) {
    return NextResponse.json({ error: 'Missing update_id' }, { status: 400 });
  }

  let token = '';
  let webhookSecretToken = '';

  try {
    // 1. Acquire Lease / Check Idempotency using transaction
    console.log(`[Telegram Webhook] [BEFORE] Acquire Lease for updateId=${updateId}`);
    const leaseResult = await acquireLease(workspaceId, updateId.toString());
    console.log(`[Telegram Webhook] [AFTER] Acquire Lease completed. Success: ${leaseResult.success}, completed: ${leaseResult.isCompleted}`);
    lastSuccessfulFunction = 'Acquire Lease';
    nextFunction = 'Load Telegram config (getChannelConfig)';

    if (!leaseResult.success) {
      if (leaseResult.isCompleted) {
        console.log(`[Telegram Webhook] Update ${updateId} was already successfully processed. Returning 200.`);
      } else {
        console.log(`[Telegram Webhook] Update ${updateId} is currently being processed by another instance. Returning 200.`);
      }
      return NextResponse.json({ ok: true });
    }

    const adminDb = getAdminDb();

    // 2. Load Telegram channel configuration
    console.log(`[Telegram Webhook] [BEFORE] Load Telegram config`);
    let channelSnap;
    if (adminDb) {
      channelSnap = await adminDb.doc(`workspaces/${workspaceId}/channels/ch-tg`).get();
    } else {
      channelSnap = await getDoc(doc(db!, 'workspaces', workspaceId, 'channels', 'ch-tg'));
    }
    const channelExists = typeof channelSnap.exists === 'function' ? channelSnap.exists() : channelSnap.exists;
    console.log(`[Telegram Webhook] [AFTER] Load Telegram config completed. Exists: ${channelExists}`);
    lastSuccessfulFunction = 'Load Telegram config';
    nextFunction = 'Verify Webhook Secret Token';

    if (!channelExists || channelSnap.data()?.status !== 'connected') {
      console.warn(`No active Telegram config for workspace: ${workspaceId}`);
      await releaseLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }

    token = channelSnap.data()?.token || '';
    webhookSecretToken = channelSnap.data()?.webhookSecretToken || '';

    // Verify secret token to secure the incoming update
    console.log(`[Telegram Webhook] [BEFORE] Verify Webhook Secret Token`);
    const incomingSecretToken = req.headers.get('x-telegram-bot-api-secret-token');
    if (webhookSecretToken && incomingSecretToken !== webhookSecretToken) {
      console.error(`[Telegram Webhook] Unauthorized request. Token mismatch.`);
      await releaseLease(workspaceId, updateId.toString());
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[Telegram Webhook] [AFTER] Verify Webhook Secret Token successfully completed.`);
    lastSuccessfulFunction = 'Verify Webhook Secret Token';
    nextFunction = 'Process Admin Command';

    if (!token) {
      console.error('[Telegram Webhook] Bot token is missing.');
      await releaseLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }

    const conversationId = `tg-${chatId}`;

    // 3. Process administrative takeover/resume/status commands
    console.log(`[Telegram Webhook] [BEFORE] Process Admin Command`);
    const commandResult = await processAdminCommand(
      workspaceId,
      'telegram',
      conversationId,
      message.from?.id,
      message.from?.username,
      userText
    );
    console.log(`[Telegram Webhook] [AFTER] Process Admin Command completed. isCommand: ${commandResult.isCommand}`);
    lastSuccessfulFunction = 'Process Admin Command';
    nextFunction = 'Check Human Takeover';

    if (commandResult.isCommand) {
      console.log(`[Telegram Webhook] Administrative command detected. Sending command reply...`);
      await sendTelegramMessage(token, chatId, commandResult.replyMessage);
      await completeLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }

    // 4. Check if the conversation is locked in HUMAN_TAKEOVER mode
    console.log(`[Telegram Webhook] [BEFORE] Check Human Takeover`);
    const inTakeover = await isConversationInTakeover(workspaceId, conversationId);
    console.log(`[Telegram Webhook] [AFTER] Check Human Takeover completed. inTakeover: ${inTakeover}`);
    lastSuccessfulFunction = 'Check Human Takeover';
    nextFunction = 'Handle /start command';

    if (inTakeover) {
      console.log(`[Telegram Webhook] Conversation ${conversationId} is in Takeover. Skipping AI reply.`);
      await logConversation(workspaceId, chatId, senderName, userText, '[Human Operator Active]');
      await completeLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }

    // Handle /start command
    console.log(`[Telegram Webhook] [BEFORE] Handle /start Command`);
    if (userText === '/start') {
      const reply = `👋 Hi ${senderName}! I'm your AI assistant. How can I help you today?`;
      await sendTelegramMessage(token, chatId, reply);
      console.log(`[Telegram Webhook] [AFTER] Handle /start Command: sent welcome message.`);
      console.log(`[Telegram Webhook] [BEFORE] logConversation for /start welcome message`);
      await logConversation(workspaceId, chatId, senderName, userText, reply);
      console.log(`[Telegram Webhook] [AFTER] logConversation for /start welcome message completed.`);
      lastSuccessfulFunction = 'Handle /start welcome message';
      nextFunction = 'completeLease';
      await completeLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }
    console.log(`[Telegram Webhook] [AFTER] Handle /start Command check completed (not a start command).`);
    lastSuccessfulFunction = 'Handle /start Command check';
    nextFunction = 'Send Typing Action';

    // Send typing action immediately (asynchronously, without delaying AI execution)
    console.log(`[Telegram Webhook] [BEFORE] Send Typing Action`);
    sendTelegramAction(token, chatId, 'typing').catch((e) => console.error('[Telegram Webhook] Typing action error:', e));
    console.log(`[Telegram Webhook] [AFTER] Send Typing Action triggered.`);
    lastSuccessfulFunction = 'Send Typing Action';
    nextFunction = 'Execute Intent (handleIntent)';

    // 5. Execute intent before AI reply
    console.log(`[Telegram Webhook] [BEFORE] Execute Intent (handleIntent)`);
    let actionResultContext = '';
    try {
      const intentResult = await handleIntent(workspaceId, userText, 'telegram', senderName);
      if (intentResult && intentResult.actionTaken) {
        console.log(`[Telegram] ✔ Tool executed: ${intentResult.actionResult.slice(0, 80)}`);
        if (intentResult.actionResult.startsWith('[BACKGROUND:')) {
          actionResultContext = `\n\nACTION COMPLETED: ${intentResult.actionResult}`;
        } else {
          actionResultContext = `\n\nACTION COMPLETED: ${intentResult.actionResult}\nTell the user this action was completed successfully.`;
        }
      }
    } catch (e) {
      console.error('[Telegram Webhook] Error executing handleIntent:', e);
    }
    console.log(`[Telegram Webhook] [AFTER] Execute Intent (handleIntent) completed.`);
    lastSuccessfulFunction = 'Execute Intent';
    nextFunction = 'Check Google Connection';

    // Check if Google is connected for this workspace
    console.log(`[Telegram Webhook] [BEFORE] Check Google Connection`);
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
    console.log(`[Telegram Webhook] [AFTER] Check Google Connection completed. isGoogleConnected: ${isGoogleConnected}`);
    lastSuccessfulFunction = 'Check Google Connection';
    nextFunction = 'Load Workspace Context and History';

    // 6. Load Workspace Context and History in Parallel
    console.log(`[Telegram Webhook] [BEFORE] Load Workspace Context and History`);
    const startLoaderAndHistory = Date.now();
    const contextPromise = WorkspaceContextLoader.load(workspaceId);
    
    const historyPromise = (async () => {
      const history: { sender: string; text: string }[] = [];
      let querySnap;
      if (adminDb) {
        querySnap = await adminDb
          .collection(`workspaces/${workspaceId}/conversations`)
          .where('chatId', '==', chatId)
          .get();
      } else {
        const { query, where, getDocs } = require('firebase/firestore');
        const q = query(
          collection(db!, 'workspaces', workspaceId, 'conversations'),
          where('chatId', '==', chatId)
        );
        querySnap = await getDocs(q);
      }
      const docs = querySnap.docs || [];
      const allMsgs = docs.map((doc: any) => {
        const data = doc.data();
        const t = data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp ? new Date(data.timestamp).getTime() : 0);
        return { data, timestamp: t };
      });
      allMsgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
      // Bounded history retrieval: take the latest 15 messages
      const latestMsgs = allMsgs.slice(-15);
      for (const item of latestMsgs) {
        const data = item.data;
        if (data.userMessage) {
          history.push({ sender: 'user', text: data.userMessage });
        }
        if (data.botReply) {
          history.push({ sender: 'assistant', text: data.botReply });
        }
      }
      return history;
    })();

    const [context, history] = await Promise.all([contextPromise, historyPromise]);
    const durationLoaderAndHistory = Date.now() - startLoaderAndHistory;
    console.log(`[Telegram Webhook] [AFTER] Load Workspace Context and History completed in ${durationLoaderAndHistory}ms (found ${history.length} history messages).`);
    lastSuccessfulFunction = 'Load Workspace Context and History';
    nextFunction = 'Process Media Attachments';

    // 7. Inject action result context and google integrations into system prompt
    let systemPromptOverride = context.assistant.systemPrompt || '';
    if (isGoogleConnected) {
      systemPromptOverride += "\n\nYou have access to Google Calendar, Gmail, Google Sheets, Google Drive and Google Docs for this business.\nWhen a user wants to book an appointment, confirm you are booking it and tell them the details.\nWhen asked to send an email, confirm you sent it.\nAlways be proactive - if someone asks to book, BOOK IT.";
    }
    if (actionResultContext) {
      systemPromptOverride += actionResultContext;
    }

    let attachedContent: any = null;
    let attachedFile: { name: string; type: string; size: number } | null = null;
    let extractedText: string | null = null;
    let documentText: string | null = null;
    let finalUserText = userText;

    console.log(`[Telegram Webhook] [BEFORE] Process Media Attachments`);
    if (hasPhoto) {
      try {
        console.log('[Telegram Webhook] Photo detected. Downloading photo...');
        const fileId = message.photo[message.photo.length - 1].file_id;
        const fileData = await getTelegramFileBase64(token, fileId);
        
        const fileBuffer = Buffer.from(fileData.base64, 'base64');
        attachedFile = {
          name: fileData.name,
          type: fileData.mimeType,
          size: fileBuffer.length,
        };
        
        attachedContent = {
          type: 'image_url',
          image_url: {
            url: `data:${fileData.mimeType};base64,${fileData.base64}`
          }
        };
        if (!finalUserText) finalUserText = 'Describe this image in detail.';
        console.log(`[Telegram Webhook] Photo download successful. size=${fileBuffer.length} base64_size=${fileData.base64.length}`);
      } catch (err: any) {
        console.error('[Telegram Webhook] Failed to download photo:', err);
        finalUserText = finalUserText || 'I sent you an image but it could not be downloaded.';
      }
    } else if (hasDocument) {
      try {
        const fileId = message.document.file_id;
        const fileName = message.document.file_name || 'document.pdf';
        const ext = (fileName.split('.').pop()?.toLowerCase() || 'pdf') as 'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'xlsx' | 'xls' | 'pptx' | 'ppt';
        console.log(`[Telegram Webhook] Document detected: ${fileName} (ext=${ext}). Downloading...`);
        const fileData = await getTelegramFileBase64(token, fileId);
        
        const fileBuffer = Buffer.from(fileData.base64, 'base64');
        attachedFile = {
          name: fileName,
          type: message.document.mime_type || 'application/pdf',
          size: fileBuffer.length,
        };

        console.log(`[Telegram Webhook] Document downloaded. size=${fileBuffer.length}. Extracting text...`);
        try {
          const parsedText = TextExtractionService.extractText(fileData.base64, ext);
          extractedText = parsedText;
          documentText = parsedText;
          
          const streamCount = (fileData.base64.match(/stream/g) || []).length;
          console.log(`[VERIFICATION] OCR/TextExtraction result: pages ~ ${Math.max(1, streamCount)} characters=${parsedText.length} preview="${parsedText.slice(0, 150)}..."`);

          if (parsedText.trim()) {
            finalUserText = `[Document: ${fileName}]\n${parsedText.trim()}\n\n[User Request]: ${userText || 'Please summarise this document.'}`;
            console.log(`[Telegram Webhook] Extracted text successfully injected.`);
          } else {
            console.warn(`[Telegram Webhook] Text extraction returned empty content.`);
            finalUserText = `[Document Received: ${fileName}]\nNote: The automatic text extraction could not read the content of this file (it may be encrypted, image-only, or use an unsupported encoding).\n\n[User Request]: ${userText || 'Please help me with this document.'}`;
          }
        } catch (e: any) {
          console.error('[Telegram Webhook] Document extraction threw error:', e);
          finalUserText = `[Document Received: ${fileName}]\n[Extraction Error: ${e.message}]\n\n[User Request]: ${userText || ''}`;
        }
      } catch (err: any) {
        console.error('[Telegram Webhook] Failed to download document:', err);
        finalUserText = finalUserText || 'The user tried to send a document but the download failed.';
      }
    }
    console.log(`[Telegram Webhook] [AFTER] Process Media Attachments completed.`);
    lastSuccessfulFunction = 'Process Media Attachments';
    nextFunction = 'Verify Critical Objects & Capabilities';

    // Verify selected model supports vision
    console.log(`[Telegram Webhook] [BEFORE] Verify Critical Objects & Capabilities`);
    const { ProviderModelRegistry } = require('@/lib/ai/providers/ProviderModelRegistry');
    const modelDef = ProviderModelRegistry.getModel(context.provider.name as any, context.provider.model);
    const supportsVision = modelDef?.supportsVision ?? false;
    
    const visionInput = attachedContent ? 'present' : 'null';
    console.log(`[VERIFICATION] Vision support check: model=${context.provider.model} supportsVision=${supportsVision}`);
    if (attachedContent && !supportsVision) {
      console.warn(`[VERIFICATION] WARNING: Model ${context.provider.model} does NOT support vision, but an image was sent!`);
    }

    let preferredStyle = 'null';
    try {
      const memory = await readWorkspaceMemory(workspaceId);
      preferredStyle = memory.preferredStyle || 'null';
    } catch {}

    console.log(`[VERIFICATION] CRITICAL OBJECTS STATE:
- attachedContent: ${attachedContent ? JSON.stringify(attachedContent).slice(0, 150) + '...' : 'null'}
- attachedFile: ${attachedFile ? JSON.stringify(attachedFile) : 'null'}
- visionInput: ${visionInput}
- documentText: ${documentText ? documentText.slice(0, 150) + '...' : 'null'}
- extractedText: ${extractedText ? extractedText.slice(0, 150) + '...' : 'null'}
- finalUserText: ${finalUserText ? finalUserText.slice(0, 150) + '...' : 'null'}
- conversationContext: ${context ? 'WorkspaceContext Loaded (' + context.workspaceId + ')' : 'null'}
- provider: ${context?.provider ? JSON.stringify(context.provider) : 'null'}
- selectedModel: ${context?.provider?.model || 'null'}
- preferredStyle: ${preferredStyle}
`);

    console.log(`[Telegram Webhook] [AFTER] Verify Critical Objects & Capabilities completed.`);
    lastSuccessfulFunction = 'Verify Critical Objects & Capabilities';
    nextFunction = 'ConversationService.generateReply';

    // 8. Generate AI reply
    console.log(`[Telegram Webhook] [BEFORE] ConversationService.generateReply`);
    let reply = '';
    const startGenerate = Date.now();
    try {
      const result = await ConversationService.generateReply(
        context,
        finalUserText,
        history,
        {
          model: context.provider.model,
          temperature: 0.7,
          memoryEnabled: true,
          knowledgeEnabled: true,
          systemPrompt: systemPromptOverride,
          attachedContent: attachedContent,
        }
      );
      console.log(`[Telegram Webhook] [AFTER] ConversationService.generateReply completed in ${Date.now() - startGenerate}ms.`);
      lastSuccessfulFunction = 'ConversationService.generateReply';
      nextFunction = 'sendTelegramMessage';

      if (result.error) {
        console.error(`[Telegram] generateReply returned result error: ${result.error}`);
        reply = "I'm having trouble right now. Please try again in a moment.";
      } else {
        reply = result.reply || "I couldn't generate a response. Please try again.";
      }
    } catch (genErr: any) {
      console.error(`[Telegram Webhook] generateReply threw error after ${Date.now() - startGenerate}ms:`, genErr);
      console.error(`LAST SUCCESSFUL FUNCTION: ${lastSuccessfulFunction}`);
      console.error(`NEXT FUNCTION: ${nextFunction}`);
      console.error(`STATUS: Failed`);
      console.error(`ERROR: ${genErr.message}`);
      console.error(`STACK TRACE:`, genErr.stack);
      console.error(`TIME SPENT: ${Date.now() - startGenerate}ms`);
      reply = "Sorry, I couldn't process your message right now. Please try again.";
    }

    // 9. Send response to Telegram
    console.log(`[Telegram Webhook] [BEFORE] sendTelegramMessage`);
    const startSend = Date.now();
    try {
      await sendTelegramMessage(token, chatId, reply);
      console.log(`[Telegram Webhook] [AFTER] sendTelegramMessage completed in ${Date.now() - startSend}ms.`);
      lastSuccessfulFunction = 'sendTelegramMessage';
      nextFunction = 'logConversation';
    } catch (sendErr: any) {
      console.error(`[Telegram Webhook] sendTelegramMessage threw error:`, sendErr);
      console.error(`LAST SUCCESSFUL FUNCTION: ${lastSuccessfulFunction}`);
      console.error(`NEXT FUNCTION: ${nextFunction}`);
      console.error(`STATUS: Failed`);
      console.error(`ERROR: ${sendErr.message}`);
      console.error(`STACK TRACE:`, sendErr.stack);
      console.error(`TIME SPENT: ${Date.now() - startSend}ms`);
    }

    // 10. Log conversation
    console.log(`[Telegram Webhook] [BEFORE] logConversation`);
    try {
      await logConversation(workspaceId, chatId, senderName, userText, reply);
      console.log(`[Telegram Webhook] [AFTER] logConversation completed.`);
      lastSuccessfulFunction = 'logConversation';
      nextFunction = 'completeLease';
    } catch (logErr: any) {
      console.error(`[Telegram] logConversation failed — ${logErr.message}`);
    }

    // 11. Complete lease
    console.log(`[Telegram Webhook] [BEFORE] completeLease`);
    try {
      await completeLease(workspaceId, updateId.toString());
      console.log(`[Telegram Webhook] [AFTER] completeLease completed.`);
      lastSuccessfulFunction = 'completeLease';
      nextFunction = 'None (Request Finished)';
    } catch (leaseErr: any) {
      console.error(`[Telegram] completeLease failed — ${leaseErr.message}`);
    }

    const durationTotal = Date.now() - startTotal;
    console.log(`[Telegram] ✔ COMPLETE — total=${durationTotal}ms\n============================`);
    return NextResponse.json({ ok: true });

  } catch (error: any) {
    const totalMs = Date.now() - startTotal;
    console.error(`[Telegram Webhook] ✖ UNHANDLED ERROR in outer try-catch after ${totalMs}ms:`, error);
    console.error(`========================
LAST SUCCESSFUL FUNCTION: ${lastSuccessfulFunction}
NEXT FUNCTION: ${nextFunction}
STATUS: Failed Exception
ERROR: ${error.message}
STACK TRACE: ${error.stack}
TIME SPENT: ${totalMs}ms
========================`);

    try {
      if (token && chatId) {
        await sendTelegramMessage(token, chatId, "Sorry, I encountered an issue. Please try again.");
      }
    } catch {}

    try {
      await releaseLease(workspaceId, updateId?.toString());
    } catch {}

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
