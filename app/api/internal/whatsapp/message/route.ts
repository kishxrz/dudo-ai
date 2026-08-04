/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../../lib/firebase-admin';
import { db } from '../../../../../lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { processAdminCommand, isConversationInTakeover } from '../../../../../lib/security';
import { handleIntent } from '../../../../../lib/intent-handler';
import { WorkspaceContextLoader } from '../../../../../lib/ai/WorkspaceContextLoader';
import { ConversationService } from '../../../../../lib/ai/ConversationService';
import { TextExtractionService } from '../../../../../lib/ai/TextExtractionService';

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
async function logConversation(
  workspaceId: string,
  chatId: string,
  senderId: string,
  senderName: string,
  senderPhone: string,
  userMessage: string,
  botReply: string
) {
  const adminDb = getAdminDb();
  
  let displayName = senderName.trim();
  if (!displayName) {
    if (senderPhone) {
      displayName = senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`;
    } else {
      displayName = senderId;
    }
  }

  const payload = {
    channel: 'whatsapp',
    chatId,
    customer: { 
      name: displayName,
      phone: senderPhone || ''
    },
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
  const senderName = body?.senderName || '';
  const senderPhone = body?.senderPhone || '';
  const messageText = body?.messageText || '';

  console.log(`[WA_WEBHOOK_TRACE] stage=REQUEST_RECEIVED workspaceId=${workspaceId} messageId=${messageId} externalChatId=${externalChatId}`);

  // 1. Authenticate server-to-server webhook request
  const authHeader = req.headers.get('Authorization');
  const secret = process.env.WHATSAPP_INTERNAL_SECRET;
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || !secret) {
    console.log(`[WA_WEBHOOK_TRACE] stage=AUTH_RESULT status=REJECT reason="missing/invalid Authorization header or secret" messageId=${messageId}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  if (token !== secret) {
    console.log(`[WA_WEBHOOK_TRACE] stage=AUTH_RESULT status=REJECT reason="invalid secret token verification" messageId=${messageId}`);
    return NextResponse.json({ error: 'Unauthorized: Invalid credentials' }, { status: 401 });
  }

  console.log(`[WA_WEBHOOK_TRACE] stage=AUTH_RESULT status=PASS messageId=${messageId}`);

  const hasText = !!messageText;
  const hasAttachment = !!body?.attachedFile;

  if (!body || !workspaceId || !externalChatId || !messageId || (!hasText && !hasAttachment)) {
    console.log(`[WA_WEBHOOK_TRACE] stage=REQUEST_RECEIVED status=REJECT reason="missing required payload parameters" messageId=${messageId}`);
    return NextResponse.json({ error: 'Missing required payload parameters' }, { status: 400 });
  }

  let leaseAcquired = false;

  try {
    // 2. Perform lease-based idempotency checks
    console.log(`[WA_WEBHOOK_TRACE] stage=WORKSPACE_LOOKUP status=START workspaceId=${workspaceId} messageId=${messageId}`);
    const lease = await acquireLease(workspaceId, messageId);
    if (!lease.success) {
      console.log(`[WA_WEBHOOK_TRACE] stage=WORKSPACE_LOOKUP status=REJECT reason="lease acquisition failed (duplicate message)" messageId=${messageId}`);
      return NextResponse.json({ reply: '' });
    }
    leaseAcquired = true;
    console.log(`[WA_WEBHOOK_TRACE] stage=WORKSPACE_LOOKUP status=ACQUIRED messageId=${messageId}`);

    // 3. Process administrative commands
    const commandResult = await processAdminCommand(
      workspaceId,
      'whatsapp',
      externalChatId,
      senderId,
      undefined,
      messageText,
      {
        chatId: externalChatId,
        displayName: senderName
      }
    );
    if (commandResult.isCommand) {
      console.log(`[WA_WEBHOOK_TRACE] stage=AGENT_LOOKUP status=SHORT_CIRCUIT reason="admin command processed" messageId=${messageId}`);
      await logConversation(workspaceId, externalChatId, senderId, senderName, senderPhone, messageText, commandResult.replyMessage);
      await completeLease(workspaceId, messageId);
      leaseAcquired = false;
      console.log(`[WA_WEBHOOK_TRACE] stage=HTTP_RESPONSE status=SUCCESS hasReply=true messageId=${messageId}`);
      return NextResponse.json({ reply: commandResult.replyMessage });
    }

    // 4. Check human takeover state
    const inTakeover = await isConversationInTakeover(workspaceId, externalChatId);
    if (inTakeover) {
      console.log(`[WA_WEBHOOK_TRACE] stage=AGENT_LOOKUP status=SHORT_CIRCUIT reason="human takeover active" messageId=${messageId}`);
      await logConversation(workspaceId, externalChatId, senderId, senderName, senderPhone, messageText, '[Human Operator Active]');
      await completeLease(workspaceId, messageId);
      leaseAcquired = false;
      console.log(`[WA_WEBHOOK_TRACE] stage=HTTP_RESPONSE status=SUCCESS hasReply=false messageId=${messageId}`);
      return NextResponse.json({ reply: '' });
    }

    console.log(`[WA_WEBHOOK_TRACE] stage=AGENT_LOOKUP status=START workspaceId=${workspaceId} messageId=${messageId}`);

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
    console.log(`[WA_WEBHOOK_TRACE] stage=AGENT_LOOKUP status=PASS agentName=${context.assistant?.name || 'unknown'} messageId=${messageId}`);

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

    let attachedContent: any = null;
    let finalMessageText = messageText || '';
    let recordedMessageText = messageText || '';
    const attachedFile = body?.attachedFile;

    if (attachedFile) {
      if (attachedFile.type.startsWith('image/')) {
        attachedContent = {
          type: 'image_url',
          image_url: {
            url: `data:${attachedFile.type};base64,${attachedFile.base64}`
          }
        };
      } else if (attachedFile.type.startsWith('audio/')) {
        try {
          console.log(`[WA_VOICE_TRACE] Transcribing audio message of type: ${attachedFile.type}`);
          let sttProvider = 'openai';
          let apiKey = '';
          const adminDb = getAdminDb();
          if (adminDb) {
            try {
              const assSnap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
              if (assSnap.exists) {
                const assData = assSnap.data();
                if (assData?.sttProvider) {
                  sttProvider = assData.sttProvider;
                }
              }
              const provSnap = await adminDb.doc(`workspaces/${workspaceId}/providers/${sttProvider}`).get();
              const provData = provSnap.data();
              if (provSnap.exists && provData?.apiKey) {
                apiKey = provData.apiKey;
              }
            } catch (dbErr) {
              console.warn('[WA Voice STT] Firestore lookup failed:', dbErr);
            }
          }

          if (!apiKey) {
            const keyName = sttProvider.toLowerCase();
            if (keyName === 'openai') {
              apiKey = process.env.OPENAI_API_KEY || '';
            } else if (keyName === 'google' || keyName === 'googlecloud') {
              apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
            } else if (keyName === 'deepgram') {
              apiKey = process.env.DEEPGRAM_API_KEY || '';
            } else if (keyName === 'azure') {
              apiKey = process.env.AZURE_SPEECH_KEY || '';
            } else if (keyName === 'assemblyai') {
              apiKey = process.env.ASSEMBLYAI_API_KEY || '';
            }
          }

          if (apiKey) {
            const { SpeechProviderRegistry } = require('../../../../../lib/ai/providers/SpeechProviderRegistry');
            const audioBuffer = Buffer.from(attachedFile.base64, 'base64');
            const provider = SpeechProviderRegistry.getProvider(sttProvider, apiKey);
            const transcriptionResult = await provider.transcribe(audioBuffer, attachedFile.type);
            if (transcriptionResult?.transcript) {
              const transcriptText = transcriptionResult.transcript.trim();
              console.log(`[WA_VOICE_TRACE] Transcribed text: "${transcriptText}"`);
              finalMessageText = transcriptText;
              recordedMessageText = `🎙️ [Voice Message]: ${transcriptText}`;
            }
          } else {
            console.warn('[WA Voice STT] Speech-to-text API key is not configured.');
            recordedMessageText = '🎙️ [Voice Message] (Transcription not configured)';
          }
        } catch (sttErr: any) {
          console.error('[WA Voice STT] Failed to transcribe voice message:', sttErr.message || sttErr);
          recordedMessageText = '🎙️ [Voice Message] (Transcription failed)';
        }
      } else {
        const ext = attachedFile.name.split('.').pop()?.toLowerCase() || '';
        try {
          const parsedText = TextExtractionService.extractText(attachedFile.base64, ext as any);
          if (parsedText.trim()) {
            finalMessageText = `[Document Content: ${attachedFile.name}]\n${parsedText.trim()}\n\n[User Message]: ${messageText || ''}`;
          }
        } catch (e) {
          console.error('[WhatsApp Webhook] Document AI extraction failed:', e);
        }
      }
    }

    console.log(`[WA_WEBHOOK_TRACE] stage=AI_PROVIDER_START provider=${context.provider?.name || 'unknown'} model=${context.provider?.model || 'unknown'} messageId=${messageId}`);

    // 7. Call shared ConversationService
    const result = await ConversationService.generateReply(
      context,
      finalMessageText,
      history,
      {
        model: context.provider.model,
        temperature: 0.7,
        memoryEnabled: true,
        knowledgeEnabled: true,
        systemPrompt: systemPromptOverride,
        attachedContent: attachedContent
      }
    );

    if (result.error) {
      console.log(`[WA_WEBHOOK_TRACE] stage=AI_PROVIDER_RESPONSE status=ERROR reason="${result.error}" messageId=${messageId}`);
      throw new Error(result.error);
    }

    const reply = result.reply || '';
    const hasReply = reply.trim().length > 0;
    console.log(`[WA_WEBHOOK_TRACE] stage=AI_PROVIDER_RESPONSE status=PASS replyLength=${reply.length} messageId=${messageId}`);
    
    // 8. Log the dialogue and complete the lease
    await logConversation(workspaceId, externalChatId, senderId, senderName, senderPhone, recordedMessageText, reply);
    await completeLease(workspaceId, messageId);
    leaseAcquired = false;

    console.log(`[WA_WEBHOOK_TRACE] stage=HTTP_RESPONSE status=SUCCESS hasReply=${hasReply} messageId=${messageId}`);
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.log(`[WA_WEBHOOK_TRACE] stage=HTTP_RESPONSE status=ERROR errorName=${err.name || 'Error'} errorMessage=${err.message || String(err)} messageId=${messageId}`);
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
