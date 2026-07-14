import express, { Request, Response, NextFunction } from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { getAdminDb, getAuth } from './firebase-admin';
import { canUseWhatsapp } from './billing';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const WHATSAPP_SERVICE_SECRET = process.env.WHATSAPP_SERVICE_SECRET || '';
const WHATSAPP_SESSION_PATH = process.env.WHATSAPP_SESSION_PATH || path.join(__dirname, '../sessions');
const DUDO_BASE_URL = process.env.DUDO_BASE_URL || 'http://localhost:3000';
const WHATSAPP_INTERNAL_SECRET = process.env.WHATSAPP_INTERNAL_SECRET || '';

// Multi-tenant client registry
interface ClientState {
  client: Client;
  qr: string | null;
  status: 'disconnected' | 'qr_ready' | 'connected';
  error: string | null;
  startupTime: number;
  inFlightMessages: Set<string>;
  instanceId: string;
  watchdogInterval?: NodeJS.Timeout;
}

const registry = new Map<string, ClientState>();
const initializationPromises = new Map<string, Promise<void>>();

// Secure endpoint middleware validating BOTH internal secret and Firebase token
async function authenticate(req: Request, res: Response, next: NextFunction) {
  // 1. Service-to-service internal secret check
  const internalSecret = req.headers['x-whatsapp-internal-secret'] || req.headers['x-internal-secret'];
  if (!internalSecret || (internalSecret !== WHATSAPP_INTERNAL_SECRET && internalSecret !== WHATSAPP_SERVICE_SECRET)) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing internal service secret' });
    return;
  }

  // Log Firebase Admin Project ID
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'unknown';
  console.log(`[Diagnostic] Railway Firebase Admin project_id: ${projectId}`);

  // 2. User Firebase ID token check
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error('[Diagnostic] Missing Authorization header');
    res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.error('[Diagnostic] Malformed Bearer header');
    res.status(401).json({ error: 'Unauthorized: Malformed Bearer header' });
    return;
  }

  const token = authHeader.substring(7);
  console.log(`[Diagnostic] Received token length: ${token.length}`);

  let authInstance;
  try {
    authInstance = getAuth();
    if (!authInstance) {
      throw new Error('getAuth() returned null/undefined (Initialization failure)');
    }
  } catch (initErr: any) {
    console.error('[Diagnostic] Firebase Admin initialization failure:', initErr.message || initErr);
    res.status(500).json({ error: 'Internal Server Error: Firebase Admin initialization failure' });
    return;
  }

  try {
    const decodedToken = await authInstance.verifyIdToken(token);
    console.log(`[Diagnostic] Decoded token uid after successful verification: ${decodedToken.uid}`);
    (req as any).user = decodedToken;
    next();
  } catch (err: any) {
    const errorCode = err.code || 'unknown';
    const errorMessage = err.message || String(err);
    console.error(`[Diagnostic] verifyIdToken error code: ${errorCode}`);
    console.error(`[Diagnostic] verifyIdToken error message: ${errorMessage}`);

    // Differentiate between known firebase error codes
    let responseError = 'Unauthorized: Invalid Firebase ID token';
    if (errorCode === 'auth/id-token-expired') {
      responseError = 'Unauthorized: Firebase ID token is expired';
    } else if (errorCode === 'auth/id-token-revoked') {
      responseError = 'Unauthorized: Firebase ID token has been revoked';
    } else if (errorCode === 'auth/argument-error') {
      responseError = 'Unauthorized: Malformed or empty Firebase ID token';
    } else if (errorMessage.includes('must be a string')) {
      responseError = 'Unauthorized: Firebase ID token must be a string';
    } else if (errorMessage.includes('does not match the Firebase project')) {
      responseError = `Unauthorized: Firebase ID token audience mismatch. Expected project ${projectId}`;
    }

    res.status(401).json({ error: responseError });
  }
}

// Workspace ownership validation middleware
async function authorizeWorkspace(req: Request, res: Response, next: NextFunction) {
  const { workspaceId } = req.params;
  if (!workspaceId) {
    res.status(400).json({ error: 'Missing workspaceId' });
    return;
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    // Mock/dev bypass
    console.log('[Auth] Mock mode database bypass in workspace authorization');
    return next();
  }

  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Authenticated user details missing' });
    return;
  }

  const uid = user.uid;
  if (uid === workspaceId) {
    return next();
  }

  try {
    const wsSnap = await adminDb.doc(`workspaces/${workspaceId}`).get();
    if (wsSnap.exists && wsSnap.data()?.ownerId === uid) {
      return next();
    }
    res.status(403).json({ error: 'Forbidden: User does not own this workspace' });
  } catch (err: any) {
    console.error('[Auth Error] Workspace ownership check failed:', err);
    res.status(500).json({ error: 'Internal database verification error' });
  }
}

// Ensure sessions directory exists
if (!fs.existsSync(WHATSAPP_SESSION_PATH)) {
  fs.mkdirSync(WHATSAPP_SESSION_PATH, { recursive: true });
}

const MANIFEST_PATH = path.join(WHATSAPP_SESSION_PATH, 'workspaces-manifest.json');

// Read manifest helper
function readManifest(): string[] {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const data = fs.readFileSync(MANIFEST_PATH, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed?.activeWorkspaces)) {
        return parsed.activeWorkspaces;
      }
    }
  } catch (err) {
    console.error('[Manifest] Error reading manifest:', err);
  }
  return [];
}

// Add workspace to manifest helper
function addToManifest(workspaceId: string) {
  try {
    const list = readManifest();
    if (!list.includes(workspaceId)) {
      list.push(workspaceId);
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ activeWorkspaces: list }, null, 2), 'utf8');
      console.log(`[Manifest] Added workspace ${workspaceId} to manifest.`);
    }
  } catch (err) {
    console.error('[Manifest] Error adding to manifest:', err);
  }
}

// Remove workspace from manifest helper
function removeFromManifest(workspaceId: string) {
  try {
    const list = readManifest();
    const filtered = list.filter(id => id !== workspaceId);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ activeWorkspaces: filtered }, null, 2), 'utf8');
    console.log(`[Manifest] Removed workspace ${workspaceId} from manifest.`);
  } catch (err) {
    console.error('[Manifest] Error removing from manifest:', err);
  }
}

// Call Dudo Next.js webhook with retry
async function callDudoWebhookWithRetry(
  workspaceId: string,
  payload: any,
  retries = 3,
  delay = 1000
): Promise<string | null> {
  const url = `${DUDO_BASE_URL}/api/internal/whatsapp/message`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Webhook] Attempting webhook call to Dudo (Attempt ${attempt}/${retries}) for workspace: ${workspaceId}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout limit

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WHATSAPP_INTERNAL_SECRET}`
        },
        body: JSON.stringify({ ...payload, workspaceId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any;
        return data.reply || '';
      }

      console.error(`[Webhook] Webhook response failure: Status ${response.status} on attempt ${attempt}`);
      
      // Don't retry client errors (400-499)
      if (response.status >= 400 && response.status < 500) {
        break;
      }
    } catch (err: any) {
      console.error(`[Webhook] Error calling Dudo webhook on attempt ${attempt}:`, err.message || err);
    }

    if (attempt < retries) {
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`[Webhook] Waiting ${waitTime}ms before retrying webhook...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  return null;
}

// Initialize a workspace-scoped client
// Initialize a workspace-scoped client (idempotent wrapper)
async function startClient(workspaceId: string): Promise<void> {
  let initPromise = initializationPromises.get(workspaceId);
  if (initPromise) {
    console.log(`[Registry] Initialization already in progress for workspace: ${workspaceId}. Awaiting...`);
    return initPromise;
  }

  const existing = registry.get(workspaceId);
  if (existing && existing.status !== 'disconnected') {
    console.log(`[Registry] Active client already exists for workspace: ${workspaceId} with status: ${existing.status}`);
    return;
  }

  const promise = (async () => {
    try {
      if (existing) {
        console.log(`[Registry] Cleaning up existing disconnected client for workspace: ${workspaceId}`);
        if (existing.watchdogInterval) {
          clearInterval(existing.watchdogInterval);
        }
        try {
          await existing.client.destroy();
        } catch (destroyErr) {
          console.error(`[Registry] Error destroying old client:`, destroyErr);
        }
        registry.delete(workspaceId);
      }

      await initializeNewClient(workspaceId);
    } finally {
      initializationPromises.delete(workspaceId);
    }
  })();

  initializationPromises.set(workspaceId, promise);
  return promise;
}

// Actual client creator, registration, and initialization logic
async function initializeNewClient(workspaceId: string): Promise<void> {
  const instanceId = require('crypto').randomUUID();
  console.log(`[WA_TRACE] client_created workspaceId=${workspaceId} instanceId=${instanceId}`);

  addToManifest(workspaceId);

  const clientId = `whatsapp-${workspaceId}`;
  
  const puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled'
  ];
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log(`[Puppeteer] Using executable path: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath: WHATSAPP_SESSION_PATH
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: puppeteerArgs
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });

  const state: ClientState = {
    client,
    qr: null,
    status: 'disconnected',
    error: null,
    startupTime: Math.floor(Date.now() / 1000) - 60, // 60s clock skew buffer
    inFlightMessages: new Set<string>(),
    instanceId
  };

  registry.set(workspaceId, state);

  // Helper for async status logging
  const logDiagnostics = async (event: string) => {
    let stateStr = 'unknown';
    try {
      const s = await client.getState();
      stateStr = String(s);
    } catch (e: any) {
      stateStr = `error_${e.message}`;
    }
    const msgCount = client.listenerCount('message');
    const msgCreateCount = client.listenerCount('message_create');
    const wid = client.info?.wid?._serialized || client.info?.wid || 'undefined';
    console.log(`[WA_TRACE] event=${event} workspaceId=${workspaceId} instanceId=${instanceId} msgCount=${msgCount} msgCreateCount=${msgCreateCount} wid=${wid} clientState=${stateStr}`);
  };

  // ─── Client Event Handlers ───

  client.on('authenticated', () => {
    console.log(`[WA_TRACE] authenticated workspaceId=${workspaceId} instanceId=${instanceId}`);
    logDiagnostics('authenticated_details').catch(() => {});
  });

  client.on('qr', (qrCode) => {
    state.qr = qrCode;
    state.status = 'qr_ready';
    state.error = null;
    console.log(`[WA_TRACE] qr_ready workspaceId=${workspaceId} instanceId=${instanceId}`);
    console.log(`[Event] QR Code generated for workspace: ${workspaceId}`);
  });

  client.on('ready', async () => {
    state.status = 'connected';
    state.qr = null;
    state.error = null;
    console.log(`[WA_TRACE] ready workspaceId=${workspaceId} instanceId=${instanceId}`);
    logDiagnostics('ready_details').catch(() => {});

    // Perform page diagnostics and hook observers
    const page = client.pupPage;
    if (page) {
      console.log(`[WA_PAGE_TRACE] page_url workspaceId=${workspaceId} url=${page.url()}`);
      console.log(`[WA_PAGE_TRACE] browser_connected workspaceId=${workspaceId} connected=${client.pupBrowser?.isConnected()}`);
      console.log(`[WA_PAGE_TRACE] main_frame_url workspaceId=${workspaceId} url=${page.mainFrame().url()}`);
      
      console.log(`[WA_PAGE_TRACE] node_version workspaceId=${workspaceId} version=${process.version}`);
      try {
        const wwebjsPkg = require('whatsapp-web.js/package.json');
        console.log(`[WA_PAGE_TRACE] wwebjs_version workspaceId=${workspaceId} version=${wwebjsPkg.version}`);
      } catch {}
      try {
        const puppeteerPkg = require('puppeteer/package.json');
        console.log(`[WA_PAGE_TRACE] puppeteer_version workspaceId=${workspaceId} version=${puppeteerPkg.version}`);
      } catch {}
      
      if (client.pupBrowser) {
        try {
          const version = await client.pupBrowser.version();
          console.log(`[WA_PAGE_TRACE] chromium_version workspaceId=${workspaceId} version=${version}`);
        } catch {}
        
        client.pupBrowser.on('disconnected', () => {
          console.log(`[WA_PAGE_TRACE] browser_disconnected workspaceId=${workspaceId}`);
        });
      }

      try {
        const waVersion = await page.evaluate(() => {
          const g = globalThis as any;
          return g.Debug?.VERSION || g.mR?.sections?.VERSION || 'unknown';
        });
        console.log(`[WA_PAGE_TRACE] whatsapp_web_version workspaceId=${workspaceId} version=${waVersion}`);
      } catch {}

      // Track console/errors
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[WA_OBSERVER_MSG]')) {
          console.log(`[WA_PAGE_TRACE] observer_msg workspaceId=${workspaceId} info=${text}`);
        } else if (msg.type() === 'error') {
          console.log(`[WA_PAGE_TRACE] page_console_error workspaceId=${workspaceId} text="${text}"`);
        }
      });

      page.on('error', (err: any) => {
        console.log(`[WA_PAGE_TRACE] page_error workspaceId=${workspaceId} error="${err?.message || err}"`);
      });
      page.on('pageerror', (err: any) => {
        console.log(`[WA_PAGE_TRACE] page_error workspaceId=${workspaceId} pageerror="${err?.message || err}"`);
      });
      page.on('close', () => {
        console.log(`[WA_PAGE_TRACE] page_closed workspaceId=${workspaceId}`);
      });
      page.on('framenavigated', (frame) => {
        console.log(`[WA_PAGE_TRACE] frame_navigated workspaceId=${workspaceId} url=${frame.url()}`);
      });

      // Msg store checking and observer injection
      try {
        const storeDiagnostics = await page.evaluate(() => {
          const g = globalThis as any;
          const storeAvailable = typeof g.Store !== 'undefined';
          const msgAvailable = storeAvailable && typeof g.Store.Msg !== 'undefined';
          const msgCount = msgAvailable ? g.Store.Msg.length : -1;
          const exposedCallbacks = [
            'onAddMessageEvent',
            'onAddMessageCiphertextEvent',
            'onChangeMessageTypeEvent'
          ].reduce((acc, name) => {
            acc[name] = typeof g[name] === 'function';
            return acc;
          }, {} as Record<string, boolean>);

          return { storeAvailable, msgAvailable, msgCount, exposedCallbacks };
        });
        
        console.log(`[WA_PAGE_TRACE] store_msg_available workspaceId=${workspaceId} storeAvailable=${storeDiagnostics.storeAvailable} msgAvailable=${storeDiagnostics.msgAvailable}`);
        console.log(`[WA_PAGE_TRACE] store_msg_count workspaceId=${workspaceId} count=${storeDiagnostics.msgCount}`);
        console.log(`[WA_PAGE_TRACE] exposed_callbacks_available workspaceId=${workspaceId} callbacks=${JSON.stringify(storeDiagnostics.exposedCallbacks)}`);
        
        await page.evaluate(() => {
          const g = globalThis as any;
          if (typeof g.Store !== 'undefined' && typeof g.Store.Msg !== 'undefined') {
            console.log('[WA_OBSERVER_MSG] Msg collection found, registering observer...');
            g.Store.Msg.on('add', (msg: any) => {
              const msgId = msg.id?._serialized || msg.id?.id || 'unknown';
              const timestamp = msg.t || msg.timestamp || Math.floor(Date.now() / 1000);
              const bodyLen = msg.body ? msg.body.length : 0;
              console.log(`[WA_OBSERVER_MSG] observed_new_msg msgId=${msgId} timestamp=${timestamp} bodyLength=${bodyLen}`);
            });
            console.log('[WA_OBSERVER_MSG] Msg observer registered successfully.');
          } else {
            console.log('[WA_OBSERVER_MSG] Msg collection not available for observer.');
          }
        });
      } catch (err: any) {
        console.error(`[WA_PAGE_TRACE] failed to evaluate page Msg store diagnostics/observer:`, err);
      }
    }

    // Start 30-second watchdog
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }
    state.watchdogInterval = setInterval(async () => {
      let stateStr = 'unknown';
      try {
        const s = await client.getState();
        stateStr = String(s);
      } catch (e: any) {
        stateStr = `error_${e.message}`;
      }
      const msgCount = client.listenerCount('message');
      const msgCreateCount = client.listenerCount('message_create');
      console.log(`[WA_TRACE] watchdog workspaceId=${workspaceId} instanceId=${instanceId} clientState=${stateStr} msgCount=${msgCount} msgCreateCount=${msgCreateCount}`);
    }, 30000);
  });

  client.on('auth_failure', (msg) => {
    state.status = 'disconnected';
    state.qr = null;
    state.error = `Authentication failure: ${msg}`;
    console.log(`[WA_TRACE] auth_failure workspaceId=${workspaceId} instanceId=${instanceId} error=${msg}`);
    console.error(`[Event] Auth failure for workspace ${workspaceId}:`, msg);
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }
  });

  client.on('disconnected', (reason) => {
    state.status = 'disconnected';
    state.qr = null;
    state.error = `Disconnected: ${reason}`;
    console.log(`[WA_TRACE] disconnected workspaceId=${workspaceId} instanceId=${instanceId} reason=${reason}`);
    console.log(`[Event] Client disconnected for workspace: ${workspaceId}, reason: ${reason}`);
    
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }
    try {
      client.destroy().catch(() => {});
    } catch {}
    registry.delete(workspaceId);
  });

  console.log(`[WA_TRACE] registering_message_listener workspaceId=${workspaceId} instanceId=${instanceId}`);

  client.on('message', async (message) => {
    const messageId = message.id._serialized || message.id.id;
    console.log(`[WA_TRACE] raw_message_event workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId} fromMe=${message.fromMe} type=${message.type}`);

    // Basic filter guards
    if (message.fromMe) {
      console.log(`[WA_TRACE] filter_check messageId=${messageId} instanceId=${instanceId} filter=fromMe result=REJECT`);
      return;
    }
    console.log(`[WA_TRACE] filter_check messageId=${messageId} instanceId=${instanceId} filter=fromMe result=PASS`);

    if (message.from.includes('@g.us')) {
      console.log(`[WA_TRACE] filter_check messageId=${messageId} instanceId=${instanceId} filter=groupChat result=REJECT`);
      return;
    }
    console.log(`[WA_TRACE] filter_check messageId=${messageId} instanceId=${instanceId} filter=groupChat result=PASS`);

    if (message.type !== 'chat') {
      console.log(`[WA_TRACE] filter_check messageId=${messageId} instanceId=${instanceId} filter=messageType result=REJECT`);
      return;
    }
    console.log(`[WA_TRACE] filter_check messageId=${messageId} instanceId=${instanceId} filter=messageType result=PASS`);
    
    // Ignore historical messages generated before this client started
    if (message.timestamp < state.startupTime) {
      console.log(`[WA_TRACE] filter_check messageId=${messageId} instanceId=${instanceId} filter=historical result=REJECT`);
      console.log(`[Filter] Ignored historical message from ${message.from} timestamp ${message.timestamp} (startupTime: ${state.startupTime})`);
      return;
    }
    console.log(`[WA_TRACE] filter_check messageId=${messageId} instanceId=${instanceId} filter=historical result=PASS`);

    // Deduplication check: check if this message is already in progress locally
    const inFlight = state.inFlightMessages.has(messageId);
    console.log(`[WA_TRACE] local_dedup_check messageId=${messageId} instanceId=${instanceId} inFlight=${inFlight}`);
    if (inFlight) {
      console.log(`[Deduplication] Message ${messageId} is already in-flight locally. Ignoring duplicate event.`);
      return;
    }

    let removedFromInFlight = false;
    try {
      state.inFlightMessages.add(messageId);
      console.log(`[WA_TRACE] webhook_start messageId=${messageId} instanceId=${instanceId}`);
      
      const payload = {
        externalChatId: message.from,
        messageId: messageId,
        senderId: message.author || message.from,
        messageText: message.body,
        timestamp: message.timestamp
      };

      // Call Next.js endpoint to process AI reply
      const reply = await callDudoWebhookWithRetry(workspaceId, payload);
      console.log(`[WA_TRACE] webhook_result messageId=${messageId} instanceId=${instanceId} status=${reply !== null ? '200_OR_SUCCESS' : 'FAILURE'}`);

      const hasReply = reply !== null && reply.trim().length > 0;
      console.log(`[WA_TRACE] webhook_reply_state messageId=${messageId} instanceId=${instanceId} hasReply=${hasReply}`);

      if (hasReply) {
        console.log(`[WA_TRACE] send_start messageId=${messageId} instanceId=${instanceId}`);
        await client.sendMessage(message.from, reply!);
        console.log(`[WA_TRACE] send_success messageId=${messageId} instanceId=${instanceId}`);
      } else {
        console.log(`[Message] No reply generated or empty response for message ${messageId}`);
      }
    } catch (err: any) {
      const errorName = err.name || 'Error';
      const errorMessage = err.message || String(err);
      console.log(`[WA_TRACE] send_failure messageId=${messageId} instanceId=${instanceId} errorName=${errorName} errorMessage=${errorMessage}`);
      console.error(`[Message] Error processing message ${messageId} for workspace ${workspaceId}:`, err.message || err);
    } finally {
      state.inFlightMessages.delete(messageId);
      removedFromInFlight = !state.inFlightMessages.has(messageId);
      console.log(`[WA_TRACE] finally_cleanup messageId=${messageId} instanceId=${instanceId} removedFromInFlight=${removedFromInFlight}`);
    }
  });

  // Diagnostic message_create listener
  client.on('message_create', (message) => {
    const messageId = message.id._serialized || message.id.id;
    const bodyLength = message.body ? message.body.length : 0;
    console.log(`[WA_TRACE] message_create workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId} from=${message.from} to=${message.to} fromMe=${message.fromMe} type=${message.type} bodyLength=${bodyLength}`);
  });

  const messageListenersCount = client.listenerCount('message');
  const messageCreateCount = client.listenerCount('message_create');
  console.log(`[WA_TRACE] message_listener_count workspaceId=${workspaceId} instanceId=${instanceId} count=${messageListenersCount} messageCreateCount=${messageCreateCount}`);

  console.log(`[WA_TRACE] before_initialize workspaceId=${workspaceId} instanceId=${instanceId}`);
  try {
    await client.initialize();
    console.log(`[WA_TRACE] after_initialize workspaceId=${workspaceId} instanceId=${instanceId}`);
  } catch (err: any) {
    console.error(`[Registry] Failed to initialize client for workspace: ${workspaceId}`, err);
    state.error = err.message || 'Initialization failed';
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }
    registry.delete(workspaceId);
    throw err;
  }
}

// ─── ENDPOINTS ─────────────────────────────────────────────────────────

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', activeClientsCount: registry.size });
});

// Connect Workspace WhatsApp Client
app.post('/v1/workspaces/:workspaceId/connect', authenticate, authorizeWorkspace, async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  
  // Enforce plan/entitlement checks
  const allowed = await canUseWhatsapp(workspaceId);
  if (!allowed) {
    res.status(403).json({ error: 'Upgrade required: WhatsApp channel is not supported on your current plan.' });
    return;
  }

  const existing = registry.get(workspaceId);
  if (existing) {
    if (existing.status === 'connected') {
      res.json({ status: 'connected' });
      return;
    }
    if (existing.status === 'qr_ready' && existing.qr) {
      try {
        const qrBase64 = await QRCode.toDataURL(existing.qr);
        res.json({ status: 'qr_ready', qr: qrBase64 });
        return;
      } catch (err) {
        res.status(500).send('Failed to format existing QR');
        return;
      }
    }
    // If client is disconnected, allow Retry/Re-initialize by falling through!
    if (existing.status !== 'disconnected') {
      res.json({ status: existing.status });
      return;
    }
  }

  // Trigger connect asynchronously (idempotent startClient handles promise locking)
  startClient(workspaceId).catch((err) => {
    console.error(`[Async connect error] for workspace ${workspaceId}:`, err);
  });

  // Wait briefly (3s) to see if QR is ready immediately
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const updated = registry.get(workspaceId);
  if (updated && updated.status === 'qr_ready' && updated.qr) {
    try {
      const qrBase64 = await QRCode.toDataURL(updated.qr);
      res.json({ status: 'qr_ready', qr: qrBase64 });
      return;
    } catch (err) {
      res.status(500).send('Failed to format QR');
      return;
    }
  }

  res.json({ status: updated ? updated.status : 'initializing' });
});

// Get status (Read-only status route, safely logging diagnostics)
app.get('/v1/workspaces/:workspaceId/status', authenticate, authorizeWorkspace, async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const state = registry.get(workspaceId);
  
  if (state) {
    let stateStr = 'unknown';
    try {
      const s = await state.client.getState();
      stateStr = String(s);
    } catch (e: any) {
      stateStr = `error_${e.message}`;
    }
    const msgCount = state.client.listenerCount('message');
    const msgCreateCount = state.client.listenerCount('message_create');
    const wid = state.client.info?.wid?._serialized || state.client.info?.wid || 'undefined';
    console.log(`[WA_TRACE] status_request workspaceId=${workspaceId} instanceId=${state.instanceId} msgCount=${msgCount} msgCreateCount=${msgCreateCount} wid=${wid} clientState=${stateStr}`);
  } else {
    console.log(`[WA_TRACE] status_request workspaceId=${workspaceId} instanceId=none clientState=disconnected`);
  }

  if (!state) {
    res.json({ status: 'disconnected' });
    return;
  }
  res.json({ status: state.status, error: state.error });
});

// Get QR binary PNG (Read-only)
app.get('/v1/workspaces/:workspaceId/qr', authenticate, authorizeWorkspace, async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const state = registry.get(workspaceId);
  if (!state || !state.qr) {
    res.sendStatus(204);
    return;
  }

  try {
    const buffer = await QRCode.toBuffer(state.qr);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buffer);
  } catch (err) {
    console.error('[Endpoints] Failed to generate QR PNG buffer:', err);
    res.status(500).send('Error rendering QR image');
  }
});

// Disconnect Workspace Client
app.post('/v1/workspaces/:workspaceId/disconnect', authenticate, authorizeWorkspace, async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const state = registry.get(workspaceId);
  
  // Remove from manifest
  removeFromManifest(workspaceId);

  // Delete LocalAuth session directory
  const sessionDir = path.join(WHATSAPP_SESSION_PATH, `session-whatsapp-${workspaceId}`);
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`[Disconnect] Deleted session directory for workspace: ${workspaceId}`);
    }
  } catch (err) {
    console.error(`[Disconnect] Error deleting session directory for ${workspaceId}:`, err);
  }

  if (state) {
    console.log(`[WA_TRACE] before_destroy workspaceId=${workspaceId} instanceId=${state.instanceId}`);
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }
    try {
      await state.client.destroy();
      console.log(`[WA_TRACE] after_destroy workspaceId=${workspaceId} instanceId=${state.instanceId}`);
    } catch (err) {
      console.error(`[Disconnect] Error destroying client for ${workspaceId}:`, err);
    }
    registry.delete(workspaceId);
  }

  res.json({ success: true });
});

// ─── SESSION RESTORATION ON STARTUP ────────────────────────────────────

function restoreSessions() {
  console.log('[Startup] Restoring sessions from workspaces-manifest.json...');
  const list = readManifest();
  console.log(`[Startup] Found ${list.length} sessions to restore:`, list);
  for (const workspaceId of list) {
    console.log(`[Startup] Auto-restoring session for workspace: ${workspaceId}`);
    startClient(workspaceId).catch((err) => {
      console.error(`[Startup] Failed to restore workspace ${workspaceId}:`, err);
    });
  }
}

// Start Server
export const server = app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Dudo WhatsApp Microservice running on port ${PORT}`);
  console.log(`Session path: ${WHATSAPP_SESSION_PATH}`);
  console.log(`Dudo URL: ${DUDO_BASE_URL}`);
  console.log(`==================================================`);

  restoreSessions();
});
