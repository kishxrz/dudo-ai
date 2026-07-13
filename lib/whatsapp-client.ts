import { Client, LocalAuth } from 'whatsapp-web.js';
import os from 'os';
import path from 'path';
import { getAdminDb } from './firebase-admin';
import { db } from './firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { handleIntent } from './intent-handler';
import { processAdminCommand, isConversationInTakeover } from './security';

export type WhatsappStatus = 'disconnected' | 'qr_ready' | 'connected';

const g = global as any;

export function getClient(): Client | null {
  return g.whatsappClient || null;
}

export function getQR(): string | null {
  return g.whatsappQrCode || null;
}

export function getStatus(): WhatsappStatus {
  return g.whatsappStatus || 'disconnected';
}

export async function initClient(workspaceId: string): Promise<void> {
  if (getClient()) {
    console.log('WhatsApp client already exists/initialized.');
    return;
  }

  g.whatsappStatus = 'disconnected';
  g.whatsappQrCode = null;

  try {
    const authDataPath = path.join(os.tmpdir(), `dudo-whatsapp-${workspaceId}`);
    const newClient = new Client({
      authStrategy: new LocalAuth({ clientId: `whatsapp-${workspaceId}`, dataPath: authDataPath }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });
    g.whatsappClient = newClient;

    const botStartTime = Math.floor(Date.now() / 1000);
    let isReady = false;

    newClient.on('qr', (qr: string) => {
      g.whatsappQrCode = qr;
      g.whatsappStatus = 'qr_ready';
      console.log('WhatsApp QR Code generated.');
    });

    newClient.on('ready', () => {
      g.whatsappStatus = 'connected';
      g.whatsappQrCode = null;
      console.log('WhatsApp client is ready!');
      console.log('Bot ready at', botStartTime);
      setTimeout(() => {
        isReady = true;
        console.log('Grace period ended. Bot is ready to process messages.');
      }, 15000);
    });

    newClient.on('auth_failure', (msg: string) => {
      console.error('WhatsApp Authentication failure:', msg);
      g.whatsappStatus = 'disconnected';
      g.whatsappQrCode = null;
    });

    newClient.on('disconnected', (reason: string) => {
      console.log('WhatsApp client was disconnected:', reason);
      g.whatsappStatus = 'disconnected';
      g.whatsappQrCode = null;
      g.whatsappClient = null;
    });

    await newClient.initialize();

    newClient.on('message', async (message: any) => {
      if (message.timestamp < botStartTime) {
        console.log('Ignoring old message from', message.timestamp);
        return;
      }

      if (!isReady) {
        console.log('Ignoring message during grace period:', message.timestamp);
        return;
      }

      if (message.fromMe) return;
      if (message.from.includes('@g.us')) return; // ignore groups

      if (process.env.BOT_ENABLED === 'false') {
        console.log('Bot is disabled (BOT_ENABLED is false). Skipping auto-reply.');
        return;
      }

      try {
        const from = message.from;
        const body = message.body;
        const customerName = message._data?.notifyName || from;
        console.log('WhatsApp message received:', message.body);
        console.log('message.from format:', message.from);

        const senderPhone = from.split('@')[0];

        // 1. Process administrative takeover/resume/status commands
        const commandResult = await processAdminCommand(
          workspaceId,
          'whatsapp',
          from,
          senderPhone,
          undefined,
          body
        );
        if (commandResult.isCommand) {
          if (g.whatsappClient) {
            await g.whatsappClient.sendMessage(from, commandResult.replyMessage);
          }
          return;
        }

        // 2. Check if the conversation is locked in HUMAN_TAKEOVER mode
        const inTakeover = await isConversationInTakeover(workspaceId, from);
        if (inTakeover) {
          console.log(`[WhatsApp Client] Conversation ${from} is in Human Takeover. Skipping AI reply.`);
          const payload = {
            channel: 'whatsapp',
            chatId: from,
            customer: { name: customerName },
            userMessage: body,
            botReply: '[Human Operator Active]',
            timestamp: new Date(),
            status: 'bot',
          };
          const adminDb = getAdminDb();
          if (adminDb) {
            await adminDb.collection(`workspaces/${workspaceId}/conversations`).add(payload);
          } else if (db) {
            await addDoc(collection(db, 'workspaces', workspaceId, 'conversations'), payload);
          }
          return;
        }

        // 3. Fetch systemPrompt and enabled skills from Firestore
        let systemPrompt = 'You are a helpful customer support assistant. Be concise and friendly.';
        let enabledSkillIds: string[] = [];
        const adminDb = getAdminDb();
        if (adminDb) {
          const assistantSnap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
          if (assistantSnap.exists) {
            systemPrompt = assistantSnap.data()?.systemPrompt || systemPrompt;
            enabledSkillIds = assistantSnap.data()?.enabledSkillIds || [];
          }
        } else if (db) {
          const docRef = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
          const assistantSnap = await getDoc(docRef);
          if (assistantSnap.exists()) {
            systemPrompt = assistantSnap.data()?.systemPrompt || systemPrompt;
            enabledSkillIds = assistantSnap.data()?.enabledSkillIds || [];
          }
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
          console.error('[WhatsApp Client] Failed to check Google connection:', e);
        }

        if (isGoogleConnected) {
          systemPrompt += "\n\nYou have access to Google Calendar, Gmail, Google Sheets, Google Drive and Google Docs for this business.\nWhen a user wants to book an appointment, confirm you are booking it and tell them the details.\nWhen asked to send an email, confirm you sent it.\nAlways be proactive - if someone asks to book, BOOK IT.";
        }

        // Execute intent before AI reply
        let actionResultContext = '';
        try {
          let permittedTools: string[] | undefined;
          if (enabledSkillIds.length > 0) {
            try {
              const { getSkillsByIds } = await import('@/data/skills/index');
              const { SkillRouter } = await import('@/lib/ai/SkillRouter');
              const skills = await getSkillsByIds(enabledSkillIds);
              const activeSkills = SkillRouter.selectActiveSkills(body, skills);
              const connectedIntegrations = [];
              if (isGoogleConnected) {
                connectedIntegrations.push('google');
              }
              permittedTools = SkillRouter.getPermittedTools(activeSkills, connectedIntegrations);
              console.log('[WhatsApp Client] Calculated permitted tools:', permittedTools);
            } catch (err) {
              console.error('[WhatsApp Client] Failed to calculate permitted tools:', err);
            }
          }

          const intentResult = await handleIntent(workspaceId, body, 'whatsapp', customerName, permittedTools);
          if (intentResult && intentResult.actionTaken) {
            if (intentResult.actionResult.startsWith('[BACKGROUND:')) {
              actionResultContext = `\n\nACTION COMPLETED: ${intentResult.actionResult}`;
            } else {
              actionResultContext = `\n\nACTION COMPLETED: ${intentResult.actionResult}\nTell the user this action was completed successfully.`;
            }
          }
        } catch (e) {
          console.error('[WhatsApp Client] Error executing handleIntent:', e);
        }

        if (actionResultContext) {
          systemPrompt += actionResultContext;
        }

        console.log('Fetching AI reply...');

        // 2. Call playground chat API
        const baseUrl = process.env.INTERNAL_API_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const chatRes = await fetch(`${baseUrl}/api/playground/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: body,
            history: [],
            workspaceId,
            systemPrompt,
          }),
        });

        let aiReply = '';
        if (chatRes.ok) {
          const data = await chatRes.json();
          aiReply = data.reply || '';
        } else {
          console.error('AI chat endpoint failed:', await chatRes.text());
        }

        if (!aiReply) {
          console.error('AI call failed or returned empty reply. Not messaging user.');
          return;
        }

        console.log('AI reply:', aiReply);

        // 3. Send reply back to WhatsApp
        if (g.whatsappClient) {
          console.log(`About to reply to: ${message.from}, message: "${message.body}", timestamp: ${message.timestamp}`);
          await g.whatsappClient.sendMessage(from, aiReply);
        }

        // 4. Save to Firestore workspaces/{workspaceId}/conversations
        const payload = {
          channel: 'whatsapp',
          chatId: from,
          customer: { name: customerName },
          userMessage: body,
          botReply: aiReply,
          timestamp: new Date(),
          status: 'bot',
        };

        if (adminDb) {
          await adminDb.collection(`workspaces/${workspaceId}/conversations`).add(payload);
        } else if (db) {
          await addDoc(collection(db, 'workspaces', workspaceId, 'conversations'), payload);
        }
        console.log(`WhatsApp conversation logged to Firestore for: ${from}`);
      } catch (error) {
        console.error('Error handling incoming WhatsApp message:', error);
      }
    });
  } catch (err) {
    console.error('Failed to initialize WhatsApp Client:', err);
    g.whatsappClient = null;
    g.whatsappStatus = 'disconnected';
    g.whatsappQrCode = null;
  }
}

export async function destroyClient(): Promise<void> {
  const currentClient = getClient();
  if (currentClient) {
    try {
      await currentClient.destroy();
    } catch (e) {
      console.error('Error destroying WhatsApp Client session:', e);
    }
  }
  g.whatsappClient = null;
  g.whatsappStatus = 'disconnected';
  g.whatsappQrCode = null;
}
