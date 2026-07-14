import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../../lib/firebase-admin';
import { db } from '../../../../../lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { processAdminCommand, isConversationInTakeover } from '../../../../../lib/security';
import { handleIntent } from '../../../../../lib/intent-handler';
import { WorkspaceContextLoader } from '../../../../../lib/ai/WorkspaceContextLoader';
import { ConversationService } from '../../../../../lib/ai/ConversationService';

export const runtime = 'nodejs';

const LEASE_DURATION_MS = 60000; // 60 seconds lease duration

/**
 * Acquires a lease in Firestore for idempotency checks.
 */
async function acquireLease(workspaceId: string, messageId: string): Promise<{ success: boolean; isCompleted: boolean }> {
  const adminDb = getAdminDb();
  const leaseDocPath = `workspaces/${workspaceId}/processed_updates/whatsapp-${messageId}`;
  
  try {
    if (adminDb) {
      const ref = adminDb.doc(leaseDocPath);
      const result = await adminDb.runTransaction(async (transaction: any) => {
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
    } else if (db) {
      const { runTransaction, doc: firestoreDoc } = require('firebase/firestore');
      const ref = firestoreDoc(db, 'workspaces', workspaceId, 'processed_updates', `whatsapp-${messageId}`);
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
    console.error('[WhatsApp Internal Webhook] Error acquiring lease:', e);
  }
  return { success: false, isCompleted: false };
}

/**
 * Marks a lease as completed in Firestore.
 */
async function completeLease(workspaceId: string, messageId: string) {
  const adminDb = getAdminDb();
  const leaseDocPath = `workspaces/${workspaceId}/processed_updates/whatsapp-${messageId}`;
  try {
    if (adminDb) {
      await adminDb.doc(leaseDocPath).set({
        status: 'completed',
        completedAt: new Date()
      });
    } else if (db) {
      const { setDoc, doc: firestoreDoc } = require('firebase/firestore');
      const ref = firestoreDoc(db, 'workspaces', workspaceId, 'processed_updates', `whatsapp-${messageId}`);
      await setDoc(ref, {
        status: 'completed',
        completedAt: new Date()
      });
    }
  } catch (e) {
    console.error('[WhatsApp Internal Webhook] Error completing lease:', e);
  }
}

/**
 * Releases a lease back to unacquired in Firestore (on failure).
 */
async function releaseLease(workspaceId: string, messageId: string) {
  const adminDb = getAdminDb();
  const leaseDocPath = `workspaces/${workspaceId}/processed_updates/whatsapp-${messageId}`;
  try {
    if (adminDb) {
      await adminDb.doc(leaseDocPath).delete();
    } else if (db) {
      const { deleteDoc, doc: firestoreDoc } = require('firebase/firestore');
      const ref = firestoreDoc(db, 'workspaces', workspaceId, 'processed_updates', `whatsapp-${messageId}`);
      await deleteDoc(ref);
    }
  } catch (e) {
    console.error('[WhatsApp Internal Webhook] Error releasing lease:', e);
  }
}

/**
 * Logs a conversation details in Firestore.
 */
async function logConversation(workspaceId: string, chatId: string, senderId: string, userMessage: string, botReply: string) {
  const adminDb = getAdminDb();
  const payload = {
    channel: 'whatsapp',
    chatId,
    customer: { name: senderId },
    userMessage,
    botReply,
    timestamp: new Date(),
    status: 'bot'
  };

  try {
    if (adminDb) {
      await adminDb.collection(`workspaces/${workspaceId}/conversations`).add(payload);
    } else if (db) {
      await addDoc(collection(db, 'workspaces', workspaceId, 'conversations'), payload);
    }
  } catch (e) {
    console.error('[WhatsApp Internal Webhook] Error logging conversation:', e);
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.clone().json();
  } catch (err: any) {
    console.error('[WA_WEBHOOK_TRACE] Failed to parse raw body JSON', err);
  }

  const workspaceId = body?.workspaceId || 'unknown';
  const messageId = body?.messageId || 'unknown';
  const externalChatId = body?.externalChatId || 'unknown';
  const senderId = body?.senderId || 'unknown';
  const messageText = body?.messageText || '';

  console.log(`[WA_WEBHOOK_TRACE] request_received workspaceId=${workspaceId} messageId=${messageId}`);

  // 1. Authenticate server-to-server webhook request
  const authHeader = req.headers.get('Authorization');
  const secret = process.env.WHATSAPP_INTERNAL_SECRET;
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || !secret) {
    console.log(`[WA_WEBHOOK_TRACE] auth_result messageId=${messageId} result=REJECT (missing/invalid header)`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  if (token !== secret) {
    console.log(`[WA_WEBHOOK_TRACE] auth_result messageId=${messageId} result=REJECT (invalid credentials)`);
    return NextResponse.json({ error: 'Unauthorized: Invalid credentials' }, { status: 401 });
  }

  console.log(`[WA_WEBHOOK_TRACE] auth_result messageId=${messageId} result=PASS`);

  if (!body || !workspaceId || !externalChatId || !messageId || !messageText) {
    return NextResponse.json({ error: 'Missing required payload parameters' }, { status: 400 });
  }

  let leaseAcquired = false;

  try {
    // 2. Perform lease-based idempotency checks
    const lease = await acquireLease(workspaceId, messageId);
    if (!lease.success) {
      console.log(`[WA_WEBHOOK_TRACE] lease_result messageId=${messageId} result=REJECTED`);
      return NextResponse.json({ reply: '' });
    }
    leaseAcquired = true;
    console.log(`[WA_WEBHOOK_TRACE] lease_result messageId=${messageId} result=ACQUIRED`);

    // 3. Process administrative commands
    const commandResult = await processAdminCommand(
      workspaceId,
      'whatsapp',
      externalChatId,
      senderId,
      undefined,
      messageText
    );
    if (commandResult.isCommand) {
      console.log(`[WA_WEBHOOK_TRACE] conversation_result messageId=${messageId} result=admin_command`);
      await logConversation(workspaceId, externalChatId, senderId, messageText, commandResult.replyMessage);
      await completeLease(workspaceId, messageId);
      console.log(`[WA_WEBHOOK_TRACE] lease_complete messageId=${messageId}`);
      leaseAcquired = false;
      console.log(`[WA_WEBHOOK_TRACE] response_sent messageId=${messageId} hasReply=true`);
      return NextResponse.json({ reply: commandResult.replyMessage });
    }

    // 4. Check human takeover state
    const inTakeover = await isConversationInTakeover(workspaceId, externalChatId);
    if (inTakeover) {
      console.log(`[WA_WEBHOOK_TRACE] conversation_result messageId=${messageId} result=human_takeover`);
      await logConversation(workspaceId, externalChatId, senderId, messageText, '[Human Operator Active]');
      await completeLease(workspaceId, messageId);
      console.log(`[WA_WEBHOOK_TRACE] lease_complete messageId=${messageId}`);
      leaseAcquired = false;
      console.log(`[WA_WEBHOOK_TRACE] response_sent messageId=${messageId} hasReply=false`);
      return NextResponse.json({ reply: '' });
    }

    console.log(`[WA_WEBHOOK_TRACE] conversation_result messageId=${messageId} result=ai_conversation`);

    // 5. Load workspace contexts and Google status in parallel
    const adminDb = getAdminDb();
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
      console.error('[WhatsApp Internal Webhook] Failed to check Google connection:', e);
    }

    const contextPromise = WorkspaceContextLoader.load(workspaceId);
    
    // Load chronological conversation history
    const historyPromise = (async () => {
      const history: { sender: string; text: string }[] = [];
      let querySnap;
      if (adminDb) {
        querySnap = await adminDb
          .collection(`workspaces/${workspaceId}/conversations`)
          .where('chatId', '==', externalChatId)
          .get();
      } else {
        const { query, where, getDocs } = require('firebase/firestore');
        const q = query(
          collection(db!, 'workspaces', workspaceId, 'conversations'),
          where('chatId', '==', externalChatId)
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

    // 6. Execute skills and intents
    let actionResultContext = '';
    const enabledSkillIds = context.assistant.enabledSkillIds || [];
    if (enabledSkillIds.length > 0) {
      try {
        const { getSkillsByIds } = await import('@/data/skills/index');
        const { SkillRouter } = await import('@/lib/ai/SkillRouter');
        const skills = await getSkillsByIds(enabledSkillIds);
        const activeSkills = SkillRouter.selectActiveSkills(messageText, skills);
        const connectedIntegrations = [];
        if (isGoogleConnected) {
          connectedIntegrations.push('google');
        }
        const permittedTools = SkillRouter.getPermittedTools(activeSkills, connectedIntegrations);
        
        const intentResult = await handleIntent(workspaceId, messageText, 'whatsapp', senderId, permittedTools);
        if (intentResult && intentResult.actionTaken) {
          if (intentResult.actionResult.startsWith('[BACKGROUND:')) {
            actionResultContext = `\n\nACTION COMPLETED: ${intentResult.actionResult}`;
          } else {
            actionResultContext = `\n\nACTION COMPLETED: ${intentResult.actionResult}\nTell the user this action was completed successfully.`;
          }
        }
      } catch (err) {
        console.error('[WhatsApp Internal Webhook] Error calculating skills/intents:', err);
      }
    }

    let systemPromptOverride = context.assistant.systemPrompt || '';
    if (isGoogleConnected) {
      systemPromptOverride += "\n\nYou have access to Google Calendar, Gmail, Google Sheets, Google Drive and Google Docs for this business.\nWhen a user wants to book an appointment, confirm you are booking it and tell them the details.\nWhen asked to send an email, confirm you sent it.\nAlways be proactive - if someone asks to book, BOOK IT.";
    }
    if (actionResultContext) {
      systemPromptOverride += actionResultContext;
    }

    console.log(`[WA_WEBHOOK_TRACE] ai_generation_start messageId=${messageId}`);

    // 7. Call shared ConversationService
    const result = await ConversationService.generateReply(
      context,
      messageText,
      history,
      {
        model: context.provider.model,
        temperature: 0.7,
        memoryEnabled: true,
        knowledgeEnabled: true,
        systemPrompt: systemPromptOverride
      }
    );

    if (result.error) {
      throw new Error(result.error);
    }

    const reply = result.reply || '';
    const hasReply = reply.trim().length > 0;
    console.log(`[WA_WEBHOOK_TRACE] ai_generation_result messageId=${messageId} hasReply=${hasReply}`);
    
    // 8. Log the dialogue and complete the lease
    await logConversation(workspaceId, externalChatId, senderId, messageText, reply);
    await completeLease(workspaceId, messageId);
    console.log(`[WA_WEBHOOK_TRACE] lease_complete messageId=${messageId}`);
    leaseAcquired = false;

    console.log(`[WA_WEBHOOK_TRACE] response_sent messageId=${messageId} hasReply=${hasReply}`);
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.log(`[WA_WEBHOOK_TRACE] processing_error messageId=${messageId} errorName=${err.name || 'Error'} errorMessage=${err.message || String(err)}`);
    if (leaseAcquired && workspaceId && messageId) {
      try {
        await releaseLease(workspaceId, messageId);
        console.log(`[WA_WEBHOOK_TRACE] lease_release_result messageId=${messageId} result=RELEASED`);
      } catch (releaseErr: any) {
        console.log(`[WA_WEBHOOK_TRACE] lease_release_result messageId=${messageId} result=RELEASE_FAILED error=${releaseErr.message}`);
      }
    }
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
