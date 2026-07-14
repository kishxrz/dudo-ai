import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { doc, getDoc, addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { handleIntent } from '@/lib/intent-handler';
import { processAdminCommand, isConversationInTakeover } from '@/lib/security';
import { WorkspaceContextLoader } from '@/lib/ai/WorkspaceContextLoader';
import { ConversationService } from '@/lib/ai/ConversationService';

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
 * Sends a chat action (like typing) to Telegram.
 */
async function sendTelegramAction(botToken: string, chatId: number, action: 'typing') {
  try {
    await fetch(`${TELEGRAM_API}${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
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

/**
 * POST — Telegram sends every update here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const startTotal = Date.now();

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle text messages
  const message = update?.message;
  if (!message?.text) {
    return NextResponse.json({ ok: true }); // Ignore non-text updates
  }

  const chatId: number = message.chat.id;
  const userText: string = message.text.trim();
  const senderName: string =
    [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') ||
    'Unknown';

  const updateId = update.update_id;
  if (!updateId) {
    return NextResponse.json({ error: 'Missing update_id' }, { status: 400 });
  }

  // 1. Acquire Lease / Check Idempotency using transaction
  const leaseResult = await acquireLease(workspaceId, updateId.toString());
  if (!leaseResult.success) {
    if (leaseResult.isCompleted) {
      console.log(`[Telegram Webhook] Update ${updateId} was already successfully processed. Returning 200.`);
    } else {
      console.log(`[Telegram Webhook] Update ${updateId} is currently being processed by another instance. Returning 200.`);
    }
    return NextResponse.json({ ok: true });
  }

  let token = '';
  let webhookSecretToken = '';

  try {
    const adminDb = getAdminDb();
    
    // 2. Load Telegram channel configuration
    const startConfig = Date.now();
    let channelSnap;
    if (adminDb) {
      channelSnap = await adminDb.doc(`workspaces/${workspaceId}/channels/ch-tg`).get();
    } else {
      channelSnap = await getDoc(doc(db!, 'workspaces', workspaceId, 'channels', 'ch-tg'));
    }
    const channelExists = typeof channelSnap.exists === 'function' ? channelSnap.exists() : channelSnap.exists;
    
    if (!channelExists || channelSnap.data()?.status !== 'connected') {
      console.warn(`No active Telegram config for workspace: ${workspaceId}`);
      await releaseLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }
    
    token = channelSnap.data()?.token || '';
    webhookSecretToken = channelSnap.data()?.webhookSecretToken || '';
    const durationConfig = Date.now() - startConfig;
    console.log(`[Timer] Firestore/config loading took ${durationConfig}ms`);

    // Verify secret token to secure the incoming update
    const incomingSecretToken = req.headers.get('x-telegram-bot-api-secret-token');
    if (webhookSecretToken && incomingSecretToken !== webhookSecretToken) {
      console.error(`[Telegram Webhook] Unauthorized request. Token mismatch.`);
      await releaseLease(workspaceId, updateId.toString());
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!token) {
      console.error('[Telegram Webhook] Bot token is missing.');
      await releaseLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }

    const conversationId = `tg-${chatId}`;

    // 3. Process administrative takeover/resume/status commands
    const commandResult = await processAdminCommand(
      workspaceId,
      'telegram',
      conversationId,
      message.from?.id,
      message.from?.username,
      userText
    );
    if (commandResult.isCommand) {
      await sendTelegramMessage(token, chatId, commandResult.replyMessage);
      await completeLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }

    // 4. Check if the conversation is locked in HUMAN_TAKEOVER mode
    const inTakeover = await isConversationInTakeover(workspaceId, conversationId);
    if (inTakeover) {
      console.log(`[Telegram Webhook] Conversation ${conversationId} is in Takeover. Skipping AI reply.`);
      await logConversation(workspaceId, chatId, senderName, userText, '[Human Operator Active]');
      await completeLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }

    // Handle /start command
    if (userText === '/start') {
      await sendTelegramMessage(
        token,
        chatId,
        `👋 Hi ${senderName}! I'm your AI assistant. How can I help you today?`,
      );
      await completeLease(workspaceId, updateId.toString());
      return NextResponse.json({ ok: true });
    }

    // Send typing action immediately (asynchronously, without delaying AI execution)
    sendTelegramAction(token, chatId, 'typing').catch((e) => console.error('[Telegram Webhook] Typing action error:', e));

    // 5. Execute intent before AI reply
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

    // 6. Load Workspace Context and History in Parallel
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
      // Bounded history retrieval: take the latest 15 messages (between 10 and 20)
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
    console.log(`[Timer] Conversation history loading took ${durationLoaderAndHistory}ms (found ${history.length} messages)`);

    // 7. Inject action result context and google integrations into system prompt
    let systemPromptOverride = context.assistant.systemPrompt || '';
    if (isGoogleConnected) {
      systemPromptOverride += "\n\nYou have access to Google Calendar, Gmail, Google Sheets, Google Drive and Google Docs for this business.\nWhen a user wants to book an appointment, confirm you are booking it and tell them the details.\nWhen asked to send an email, confirm you sent it.\nAlways be proactive - if someone asks to book, BOOK IT.";
    }
    if (actionResultContext) {
      systemPromptOverride += actionResultContext;
    }

    // 8. Generate AI reply using the shared execution pipeline
    const result = await ConversationService.generateReply(
      context,
      userText,
      history,
      {
        model: context.provider.model,
        temperature: 0.7,
        memoryEnabled: true,
        knowledgeEnabled: true,
        systemPrompt: systemPromptOverride,
      }
    );

    if (result.error) {
      throw new Error(result.error);
    }

    const reply = result.reply || "I couldn't generate a response. Please try again.";

    // 9. Send response to Telegram
    const startSend = Date.now();
    await sendTelegramMessage(token, chatId, reply);
    const durationSend = Date.now() - startSend;
    console.log(`[Timer] Telegram sendMessage took ${durationSend}ms`);

    // Log the successful exchange to Firestore
    await logConversation(workspaceId, chatId, senderName, userText, reply);

    // Complete the lease
    await completeLease(workspaceId, updateId.toString());

    const durationTotal = Date.now() - startTotal;
    console.log(`[Timer] Total request processing took ${durationTotal}ms`);

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('[Telegram Webhook] Error during webhook processing:', error);
    // Release the lease immediately to allow retry
    await releaseLease(workspaceId, updateId.toString());
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
