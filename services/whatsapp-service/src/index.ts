import express, { Request, Response, NextFunction } from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { getAdminDb, getAuth, Firestore } from './firebase-admin';
import { canUseWhatsapp } from './billing';

dotenv.config();

let eventSequence = 0;
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
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  error: string | null;
  startupTime: number;
  inFlightMessages: Set<string>;
  instanceId: string;
  watchdogInterval?: NodeJS.Timeout;
}

const registry = new Map<string, ClientState>();
const initializationPromises = new Map<string, Promise<void>>();
const restoringWorkspaces = new Set<string>();
const manualDisconnectWorkspaces = new Set<string>();
const healingWorkspaces = new Set<string>();
let isShuttingDown = false;

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

// Directory packing & unpacking helpers for Firestore session backup
function packDirectory(dirPath: string): Record<string, string> {
  const filesMap: Record<string, string> = {};
  function walk(currentDir: string, relativeDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (['SingletonLock', 'SingletonCookie', 'SingletonSocket'].includes(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        try {
          const content = fs.readFileSync(fullPath);
          filesMap[relPath] = content.toString('base64');
        } catch (e) {}
      }
    }
  }
  walk(dirPath, '');
  return filesMap;
}

function unpackDirectory(targetDir: string, filesMap: Record<string, string>) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  for (const [relPath, base64] of Object.entries(filesMap)) {
    const fullPath = path.join(targetDir, relPath);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
  }
}

async function backupSessionToFirestore(workspaceId: string): Promise<void> {
  console.log(`[Session Backup] Skipping Firestore backup because Railway durable volume is active.`);
  return;
}

async function restoreSessionFromFirestore(workspaceId: string): Promise<boolean> {
  console.log(`[Session Restore] Skipping Firestore restore since local Railway volume storage is active.`);
  return false;
}

async function deleteSessionFromFirestore(workspaceId: string): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) return;
  try {
    if (typeof adminDb.collection === 'function') {
      const chunksSnap = await adminDb.collection(`workspaces/${workspaceId}/channels/ch-wa-session/chunks`).get();
      const batch = adminDb.batch();
      chunksSnap.forEach(doc => batch.delete(doc.ref));
      batch.delete(adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa-session`));
      await batch.commit();
    } else if (typeof adminDb.doc === 'function') {
      await adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa-session`).delete().catch(() => {});
    }
    console.log(`[Session Backup] Deleted Firestore session backup for workspace ${workspaceId}.`);
  } catch (err: any) {
    console.error(`[Session Backup] Failed to delete Firestore session backup for ${workspaceId}:`, err.message || err);
  }
}

// Call Dudo Next.js webhook with retry
async function callDudoWebhookWithRetry(
  workspaceId: string,
  instanceId: string,
  payload: any,
  retries = 3,
  delay = 1000
): Promise<string | null> {
  const url = `${DUDO_BASE_URL}/api/internal/whatsapp/message`;
  console.log(`[WA_PIPELINE_TRACE] stage=WEBHOOK_START workspaceId=${workspaceId} instanceId=${instanceId} messageId=${payload.messageId} targetUrl=${url}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Webhook] Attempting webhook call to Dudo (Attempt ${attempt}/${retries}) for workspace: ${workspaceId}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout limit

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

      const contentType = response.headers.get('Content-Type') || 'unknown';
      let bodyPreview = '';
      try {
        const text = await response.clone().text();
        bodyPreview = text.substring(0, 300);
      } catch {}

      console.log(`[WA_PIPELINE_TRACE] stage=WEBHOOK_RESPONSE workspaceId=${workspaceId} instanceId=${instanceId} messageId=${payload.messageId} status=${response.status} contentType="${contentType}" bodyPreview="${bodyPreview}"`);

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
      console.log(`[WA_PIPELINE_TRACE] stage=WEBHOOK_ERROR workspaceId=${workspaceId} instanceId=${instanceId} messageId=${payload.messageId} errorName="${err?.name || 'Error'}" errorMessage="${err?.message || String(err)}" errorCause="${err?.cause || 'none'}" errorStack="${err?.stack || 'none'}"`);
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

function cleanChromiumLocks(workspaceId: string) {
  const sessionDir = path.join(WHATSAPP_SESSION_PATH, `session-whatsapp-${workspaceId}`);
  if (!fs.existsSync(sessionDir)) return;

  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const file of lockFiles) {
    const filePath = path.join(sessionDir, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`[Startup] Cleaned stale Chromium lock: ${filePath}`);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error(`[Startup] Failed to delete lock file ${filePath}:`, err.message || err);
      }
    }
  }
}

// Actual client creator, registration, and initialization logic
async function initializeNewClient(workspaceId: string): Promise<void> {
  manualDisconnectWorkspaces.delete(workspaceId);
  const instanceId = require('crypto').randomUUID();
  console.log(`[WA_TRACE] client_created workspaceId=${workspaceId} instanceId=${instanceId}`);

  const clientId = `whatsapp-${workspaceId}`;
  
  // Clean up any stale Chromium profile locks
  cleanChromiumLocks(workspaceId);
  
  const puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--js-flags="--max-old-space-size=384 --expose-gc"',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--mute-audio',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-ipc-flooding-protection',
    '--disable-client-side-phishing-detection',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--password-store=basic',
    '--use-mock-keychain',
    '--memory-pressure-thresholds=1'
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
      args: puppeteerArgs,
      protocolTimeout: 60000
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wwebjs/web-whatsapp-html/main/html/2.3000.1014111620-v2.html'
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });

  const state: ClientState = {
    client,
    qr: null,
    status: 'connecting',
    error: null,
    startupTime: Math.floor(Date.now() / 1000) - 60, // 60s clock skew buffer
    inFlightMessages: new Set<string>(),
    instanceId
  };

  registry.set(workspaceId, state);

  // Helper for async status logging
  const logDiagnostics = async (event: string) => {
    const stateStr = state.status;
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

    // Update channel status in Firestore
    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa`).set({
        status: 'connected',
        platform: 'whatsapp',
        connectedAt: new Date()
      }, { merge: true }).catch(dbErr => {
        console.error(`[Firestore Error] Failed to update status to connected for ${workspaceId}:`, dbErr);
      });
    }

    addToManifest(workspaceId); // Save to manifest ONLY when ready/connected!

    backupSessionToFirestore(workspaceId).catch(err => {
      console.error(`[Session Backup Error] ${workspaceId}:`, err);
    });
    
    if (restoringWorkspaces.has(workspaceId)) {
      console.log(`[WA_RESTORE_SUCCESS] workspaceId=${workspaceId}`);
      restoringWorkspaces.delete(workspaceId);
    }
    
    console.log(`[WA_CLIENT_READY] workspaceId=${workspaceId}`);
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

      const selfHeal = (reason: string) => {
        if (healingWorkspaces.has(workspaceId)) {
          console.log(`[WA_TRACE] selfHeal already in progress for workspaceId=${workspaceId}, skipping reason="${reason}"`);
          return;
        }
        healingWorkspaces.add(workspaceId);

        console.log(`[WA_TRACE] page_crash_detected workspaceId=${workspaceId} instanceId=${instanceId} reason="${reason}"`);
        if (state.watchdogInterval) {
          clearInterval(state.watchdogInterval);
        }
        try {
          client.destroy().catch(() => {});
        } catch {}
        registry.delete(workspaceId);

        if (!manualDisconnectWorkspaces.has(workspaceId) && !isShuttingDown) {
          console.log(`[AutoReconnect] Auto-reconnecting workspace ${workspaceId} after page crash (${reason})...`);
          state.status = 'connecting';
          setTimeout(() => {
            if (!manualDisconnectWorkspaces.has(workspaceId) && !isShuttingDown) {
              startClient(workspaceId)
                .catch(err => {
                  console.error(`[AutoReconnect] Failed after page crash for ${workspaceId}:`, err);
                })
                .finally(() => {
                  healingWorkspaces.delete(workspaceId);
                });
            } else {
              healingWorkspaces.delete(workspaceId);
            }
          }, 5000);
        } else {
          state.status = 'disconnected';
          state.error = `Page crashed/closed: ${reason}`;
          healingWorkspaces.delete(workspaceId);
        }
      };

      page.on('error', (err: any) => {
        const msg = err?.message || String(err);
        console.log(`[WA_PAGE_TRACE] page_error workspaceId=${workspaceId} error="${msg}"`);
        selfHeal(`error: ${msg}`);
      });
      page.on('pageerror', (err: any) => {
        const msg = err?.message || String(err);
        console.log(`[WA_PAGE_TRACE] page_error workspaceId=${workspaceId} pageerror="${msg}"`);
      });
      page.on('close', () => {
        console.log(`[WA_PAGE_TRACE] page_closed workspaceId=${workspaceId}`);
        selfHeal('page_closed');
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

  });

  client.on('auth_failure', (msg) => {
    if (isShuttingDown) {
      console.log(`[Event] Ignoring auth_failure for workspace ${workspaceId} during server shutdown`);
      return;
    }

    state.status = 'disconnected';
    state.qr = null;
    state.error = `Authentication failure: ${msg}`;
    console.log(`[WA_TRACE] auth_failure workspaceId=${workspaceId} instanceId=${instanceId} error=${msg}`);
    console.error(`[Event] Auth failure for workspace ${workspaceId}:`, msg);
    
    const adminDb = getAdminDb();
    if (adminDb) {
      adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa`).set({
        status: 'disconnected',
        disconnectedAt: new Date(),
        platform: 'whatsapp',
        error: `Authentication failure: ${msg}`
      }, { merge: true }).catch(dbErr => {
        console.error(`[Firestore Error] Failed to update status to disconnected for ${workspaceId}:`, dbErr);
      });
    }

    removeFromManifest(workspaceId);
    
    if (restoringWorkspaces.has(workspaceId)) {
      console.log(`[WA_RESTORE_FAILED] workspaceId=${workspaceId} reason=auth_failure_${msg}`);
      restoringWorkspaces.delete(workspaceId);
    }

    console.log(`[WA_CLIENT_DISCONNECTED] workspaceId=${workspaceId}`);

    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }
    try {
      client.destroy().catch(() => {});
    } catch {}
    registry.delete(workspaceId);
  });

  client.on('disconnected', async (reason) => {
    if (isShuttingDown) {
      console.log(`[Event] Ignoring disconnect for workspace ${workspaceId} during server shutdown (reason: ${reason})`);
      return;
    }

    const isManualDisconnect = manualDisconnectWorkspaces.has(workspaceId) || String(reason).toUpperCase() === 'LOGOUT';

    console.log(`[WA_TRACE] disconnected workspaceId=${workspaceId} instanceId=${instanceId} reason=${reason} isManualDisconnect=${isManualDisconnect}`);

    if (isManualDisconnect) {
      state.status = 'disconnected';
      state.qr = null;
      state.error = `Disconnected: ${reason}`;
      console.log(`[Event] Client disconnected for workspace: ${workspaceId}, reason: ${reason}`);
      
      const adminDb = getAdminDb();
      if (adminDb) {
        adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa`).set({
          status: 'disconnected',
          disconnectedAt: new Date(),
          platform: 'whatsapp',
          error: `Disconnected: ${reason}`
        }, { merge: true }).catch(dbErr => {
          console.error(`[Firestore Error] Failed to update status to disconnected for ${workspaceId}:`, dbErr);
        });
      }

      removeFromManifest(workspaceId);
      
      if (restoringWorkspaces.has(workspaceId)) {
        console.log(`[WA_RESTORE_FAILED] workspaceId=${workspaceId} reason=disconnected_${reason}`);
        restoringWorkspaces.delete(workspaceId);
      }

      console.log(`[WA_CLIENT_DISCONNECTED] workspaceId=${workspaceId}`);
      
      if (state.watchdogInterval) {
        clearInterval(state.watchdogInterval);
      }
      try {
        client.destroy().catch(() => {});
      } catch {}
      registry.delete(workspaceId);
    } else {
      if (healingWorkspaces.has(workspaceId)) {
        console.log(`[Event] Skip transient disconnect reconnect since selfHeal is active for ${workspaceId}`);
        return;
      }
      healingWorkspaces.add(workspaceId);

      console.log(`[Event] Transient disconnect detected for workspace ${workspaceId} (reason: ${reason}). Scheduling automatic re-connection...`);
      state.status = 'connecting';
      state.error = null;

      if (state.watchdogInterval) {
        clearInterval(state.watchdogInterval);
      }
      try {
        await client.destroy().catch(() => {});
      } catch {}
      registry.delete(workspaceId);

      setTimeout(() => {
        if (!manualDisconnectWorkspaces.has(workspaceId) && !isShuttingDown) {
          console.log(`[AutoReconnect] Attempting automatic reconnection for workspace: ${workspaceId}`);
          startClient(workspaceId)
            .catch(err => {
              console.error(`[AutoReconnect] Failed to reconnect workspace ${workspaceId}:`, err);
            })
            .finally(() => {
              healingWorkspaces.delete(workspaceId);
            });
        } else {
          healingWorkspaces.delete(workspaceId);
        }
      }, 5000);
    }
  });

  console.log(`[WA_TRACE] registering_message_listener workspaceId=${workspaceId} instanceId=${instanceId}`);

  client.on('message', async (message) => {
    const seq = ++eventSequence;
    const messageId = message.id._serialized || message.id.id;
    const clientState = state.status;
    
    console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=EVENT_RECEIVED event=message workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId} from=${message.from} to=${message.to} fromMe=${message.fromMe} type=${message.type} timestamp=${message.timestamp} clientState=${clientState}`);

    // Basic filter guards
    if (message.fromMe) {
      console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=FILTERED reason=fromMe workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId}`);
      return;
    }
    
    if (message.from.includes('@g.us')) {
      console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=FILTERED reason=group_message workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId}`);
      return;
    }

    const isSupported = message.type === 'chat' || message.hasMedia;
    if (!isSupported) {
      console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=FILTERED reason=unsupported_type type=${message.type} workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId}`);
      return;
    }
    
    // Ignore historical messages generated before this client started
    if (message.timestamp < state.startupTime) {
      console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=FILTERED reason=historical workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId}`);
      return;
    }

    // Deduplication check: check if this message is already in progress locally
    const inFlight = state.inFlightMessages.has(messageId);
    if (inFlight) {
      console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=FILTERED reason=duplicate_in_flight workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId}`);
      return;
    }

    let removedFromInFlight = false;
    try {
      state.inFlightMessages.add(messageId);

      let attachedFile = null;
      if (message.hasMedia) {
        try {
          console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=MEDIA_DOWNLOAD_START workspaceId=${workspaceId} messageId=${messageId}`);
          const media = await message.downloadMedia();
          if (media) {
            attachedFile = {
              name: media.filename || (message.type === 'image' ? 'image.jpg' : 'document.pdf'),
              type: media.mimetype,
              base64: media.data
            };
            console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=MEDIA_DOWNLOAD_SUCCESS filename=${attachedFile.name} mime=${attachedFile.type} size=${attachedFile.base64?.length || 0} messageId=${messageId}`);
          }
        } catch (mediaErr: any) {
          console.error(`[WA_PIPELINE_TRACE] seq=${seq} stage=MEDIA_DOWNLOAD_ERROR error=${mediaErr.message} messageId=${messageId}`);
        }
      }
      
      let senderName = '';
      let senderPhone = '';
      try {
        console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=CONTACT_FETCH_START messageId=${messageId}`);
        const contact = await message.getContact();
        if (contact) {
          senderName = contact.pushname || contact.name || '';
          senderPhone = contact.number || '';
          console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=CONTACT_FETCH_SUCCESS name="${senderName}" phone="${senderPhone}" messageId=${messageId}`);
        }
      } catch (contactErr: any) {
        console.error(`[WA_PIPELINE_TRACE] seq=${seq} stage=CONTACT_FETCH_ERROR error=${contactErr.message} messageId=${messageId}`);
      }

      const payload = {
        externalChatId: message.from,
        messageId: messageId,
        senderId: message.author || message.from,
        senderName,
        senderPhone,
        messageText: message.body || '',
        timestamp: message.timestamp,
        attachedFile
      };

      // Call Next.js endpoint to process AI reply
      const reply = await callDudoWebhookWithRetry(workspaceId, instanceId, payload);
      const hasReply = reply !== null && reply.trim().length > 0;

      if (hasReply) {
        console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=SEND_START workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId}`);
        await client.sendMessage(message.from, reply!);
        console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=SEND_SUCCESS workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId}`);
      } else {
        console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=FILTERED reason=empty_reply_or_no_ai_response workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId}`);
      }
    } catch (err: any) {
      const errorName = err.name || 'Error';
      const errorMessage = err.message || String(err);
      console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=SEND_ERROR workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId} errorName=${errorName} errorMessage=${errorMessage}`);
      console.error(`[Message] Error processing message ${messageId} for workspace ${workspaceId}:`, err.message || err);
    } finally {
      state.inFlightMessages.delete(messageId);
      removedFromInFlight = !state.inFlightMessages.has(messageId);
      console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=FINALLY_CLEANUP workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId} removedFromInFlight=${removedFromInFlight}`);
    }
  });

  // Diagnostic message_create listener
  client.on('message_create', async (message) => {
    const seq = ++eventSequence;
    const messageId = message.id._serialized || message.id.id;
    const clientState = state.status;
    
    console.log(`[WA_PIPELINE_TRACE] seq=${seq} stage=EVENT_RECEIVED event=message_create workspaceId=${workspaceId} instanceId=${instanceId} messageId=${messageId} from=${message.from} to=${message.to} fromMe=${message.fromMe} type=${message.type} timestamp=${message.timestamp} clientState=${clientState}`);
  });

  const messageListenersCount = client.listenerCount('message');
  const messageCreateCount = client.listenerCount('message_create');
  console.log(`[WA_TRACE] message_listener_count workspaceId=${workspaceId} instanceId=${instanceId} count=${messageListenersCount} messageCreateCount=${messageCreateCount}`);

  // Start the watchdog interval before calling initialize() so it can recover from hangs
  state.watchdogInterval = setInterval(async () => {
    const stateStr = state.status;
    const msgCount = client.listenerCount('message');
    const msgCreateCount = client.listenerCount('message_create');
    console.log(`[WA_TRACE] watchdog workspaceId=${workspaceId} instanceId=${instanceId} clientState=${stateStr} msgCount=${msgCount} msgCreateCount=${msgCreateCount}`);

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - state.startupTime;

    // 1. Stuck in connecting/initialize recovery (more than 45 seconds)
    if (state.status === 'connecting' && elapsed > 45) {
      console.log(`[Watchdog] Client stuck in connecting/initialize for ${elapsed}s. Destroying and restarting...`);
      if (state.watchdogInterval) clearInterval(state.watchdogInterval);
      
      try {
        await client.destroy().catch(() => {});
      } catch {}
      
      // Clean up session directory to get rid of corrupted session data
      const sessionDir = path.join(WHATSAPP_SESSION_PATH, `session-whatsapp-${workspaceId}`);
      if (fs.existsSync(sessionDir)) {
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          console.log(`[Watchdog] Cleared corrupted session directory: ${sessionDir}`);
        } catch (rmErr) {
          console.error(`[Watchdog] Failed to clear session directory:`, rmErr);
        }
      }
      
      registry.delete(workspaceId);
      
      // Auto-reconnect if not manual disconnect
      if (!manualDisconnectWorkspaces.has(workspaceId) && !isShuttingDown) {
        console.log(`[Watchdog] Triggering fresh client restart for workspace ${workspaceId}...`);
        startClient(workspaceId).catch(err => {
          console.error(`[Watchdog] Failed to restart client:`, err);
        });
      }
      return;
    }

    // 2. Trial / Subscription Entitlement Check
    try {
      const allowed = await canUseWhatsapp(workspaceId);
      if (!allowed) {
        console.log(`[Entitlement] Workspace ${workspaceId} is no longer entitled to WhatsApp (trial/plan expired). Auto-disconnecting...`);
        // Mark as manual disconnect so no auto-reconnect triggers
        manualDisconnectWorkspaces.add(workspaceId);
        if (state.watchdogInterval) clearInterval(state.watchdogInterval);

        // Update Firestore status
        const adminDb = getAdminDb();
        if (adminDb) {
          adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa`).set({
            status: 'disconnected',
            disconnectedAt: new Date(),
            platform: 'whatsapp',
            disconnectReason: 'trial_expired'
          }, { merge: true }).catch(() => {});
        }

        removeFromManifest(workspaceId);
        deleteSessionFromFirestore(workspaceId).catch(() => {});
        try { client.destroy().catch(() => {}); } catch {}
        registry.delete(workspaceId);
        console.log(`[Entitlement] WhatsApp client for workspace ${workspaceId} auto-disconnected due to trial/plan expiry.`);
      }
    } catch (entitlementErr: any) {
      console.error(`[Entitlement] Failed to check subscription for ${workspaceId}:`, entitlementErr?.message || entitlementErr);
    }
  }, 20000); // Check every 20 seconds

  console.log(`[WA_TRACE] before_initialize workspaceId=${workspaceId} instanceId=${instanceId}`);
  try {
    await client.initialize();
    console.log(`[WA_TRACE] after_initialize workspaceId=${workspaceId} instanceId=${instanceId}`);
  } catch (err: any) {
    console.error(`[Registry] Failed to initialize client for workspace: ${workspaceId}`, err);
    state.error = err.message || 'Initialization failed';

    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa`).set({
        status: 'disconnected',
        disconnectedAt: new Date(),
        platform: 'whatsapp',
        error: err.message || 'Initialization failed'
      }, { merge: true }).catch(dbErr => {
        console.error(`[Firestore Error] Failed to update status to disconnected for ${workspaceId}:`, dbErr);
      });
    }

    if (restoringWorkspaces.has(workspaceId)) {
      console.log(`[WA_RESTORE_FAILED] workspaceId=${workspaceId} reason=initialize_failed_${err.message || err}`);
      restoringWorkspaces.delete(workspaceId);
    }
    
    console.log(`[WA_CLIENT_DISCONNECTED] workspaceId=${workspaceId}`);

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
    const stateStr = state.status;
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
  
  console.log(`[Disconnect] Initiating manual disconnect for workspace: ${workspaceId}`);
  manualDisconnectWorkspaces.add(workspaceId);
  await deleteSessionFromFirestore(workspaceId);

  // Remove from manifest
  removeFromManifest(workspaceId);

  // Update Firestore status to disconnected
  const adminDb = getAdminDb();
  if (adminDb) {
    await adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa`).set({
      status: 'disconnected',
      disconnectedAt: new Date(),
      platform: 'whatsapp'
    }, { merge: true }).catch(err => {
      console.error(`[Firestore Error] Failed to update status to disconnected for ${workspaceId}:`, err);
    });
  }

  if (state) {
    console.log(`[WA_TRACE] before_destroy workspaceId=${workspaceId} instanceId=${state.instanceId}`);
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }

    // Log out from WhatsApp if connected, with a strict 2.5s timeout to prevent blocking when Chromium hangs
    try {
      if (state.status === 'connected') {
        console.log(`[Disconnect] Logging out client for workspace: ${workspaceId} (2.5s timeout limit)`);
        await Promise.race([
          state.client.logout(),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Logout timed out')), 2500))
        ]);
        console.log(`[Disconnect] Clean logout completed for workspace: ${workspaceId}`);
      }
    } catch (logoutErr: any) {
      console.warn(`[Disconnect] Logout failed or timed out for ${workspaceId} (proceeding to hard destroy):`, logoutErr?.message || logoutErr);
    }

    try {
      await state.client.destroy();
      console.log(`[WA_TRACE] after_destroy workspaceId=${workspaceId} instanceId=${state.instanceId}`);
    } catch (err) {
      console.error(`[Disconnect] Error destroying client for ${workspaceId}:`, err);
    }
    
    registry.delete(workspaceId);
  }

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

  console.log(`[WA_CLIENT_DISCONNECTED] workspaceId=${workspaceId}`);
  res.json({ success: true });
});

// ─── SESSION RESTORATION ON STARTUP ────────────────────────────────────

async function discoverConnectedWorkspaces(adminDb: Firestore): Promise<string[]> {
  const workspaceIds: string[] = [];
  try {
    console.log('[Startup] Attempting Collection Group query for connected WhatsApp channels...');
    const snap = await adminDb.collectionGroup('channels')
      .where('platform', '==', 'whatsapp')
      .where('status', '==', 'connected')
      .get();
    snap.forEach(doc => {
      const wsId = doc.ref.parent.parent?.id;
      if (wsId) {
        workspaceIds.push(wsId);
      }
    });
    console.log(`[Startup] Collection Group query succeeded. Found ${workspaceIds.length} connected workspaces.`);
    return workspaceIds;
  } catch (err: any) {
    console.warn('[Startup] Collection Group query failed or index required, falling back to workspace collection scan:', err.message || err);
    try {
      const workspacesSnap = await adminDb.collection('workspaces').get();
      const promises = workspacesSnap.docs.map(async (wsDoc) => {
        const wsId = wsDoc.id;
        const channelSnap = await adminDb.doc(`workspaces/${wsId}/channels/ch-wa`).get();
        if (channelSnap.exists && channelSnap.data()?.status === 'connected') {
          return wsId;
        }
        return null;
      });
      const results = await Promise.all(promises);
      const filtered = results.filter((id): id is string => id !== null);
      console.log(`[Startup] Workspace collection scan succeeded. Found ${filtered.length} connected workspaces.`);
      return filtered;
    } catch (fallbackErr: any) {
      console.error('[Startup] Fallback workspace scan also failed:', fallbackErr.message || fallbackErr);
      return [];
    }
  }
}

async function getConnectedWorkspaces(): Promise<string[]> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    console.log('[Startup] Firestore Admin DB not available. Falling back to local manifest.');
    return readManifest();
  }
  return discoverConnectedWorkspaces(adminDb);
}

async function restoreSessions() {
  console.log('[Startup] Restoring connected sessions from durable storage...');
  const list = await getConnectedWorkspaces();
  console.log(`[Startup] Found ${list.length} sessions to restore:`, list);
  
  for (const workspaceId of list) {
    let sessionDir = path.join(WHATSAPP_SESSION_PATH, `session-whatsapp-${workspaceId}`);
    let exists = fs.existsSync(sessionDir);

    if (!exists) {
      console.log(`[Startup] Session directory not found on disk for ${workspaceId}. Attempting restore from Firestore backup...`);
      const restored = await restoreSessionFromFirestore(workspaceId);
      if (restored) {
        exists = fs.existsSync(sessionDir);
      }
    }

    if (exists) {
      console.log(`[WA_RESTORE_START] workspaceId=${workspaceId}`);
      restoringWorkspaces.add(workspaceId);
      
      startClient(workspaceId).catch((err) => {
        console.error(`[WA_RESTORE_FAILED] workspaceId=${workspaceId} reason=${err.message || err}`);
        restoringWorkspaces.delete(workspaceId);
      });
    } else {
      console.log(`[Startup] Session directory and backup not found for ${workspaceId}, skipping auto-restore and removing from manifest.`);
      restoringWorkspaces.delete(workspaceId);
      
      // Update status to disconnected in Firestore
      const adminDb = getAdminDb();
      if (adminDb) {
        await adminDb.doc(`workspaces/${workspaceId}/channels/ch-wa`).set({
          status: 'disconnected',
          disconnectedAt: new Date()
        }, { merge: true }).catch(dbErr => {
          console.error(`[Firestore Error] Failed to update status to disconnected for ${workspaceId}:`, dbErr);
        });
      }
      
      removeFromManifest(workspaceId);
    }
  }
}

// Global error handlers to prevent unhandled Puppeteer/Chromium rejections from crashing the process
process.on('unhandledRejection', (reason: any, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err: any) => {
  console.error('[Process] Uncaught Exception thrown:', err);
});

// Graceful shutdown handling to protect active sessions during redeployment
async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Shutdown] Received ${signal}. Gracefully shutting down active clients...`);

  // Close the server to stop accepting new requests
  server.close(() => {
    console.log('[Shutdown] HTTP server closed.');
  });

  const destroyPromises: Promise<void>[] = [];
  for (const [workspaceId, state] of registry.entries()) {
    console.log(`[Shutdown] Destroying client for workspace: ${workspaceId}`);
    if (state.watchdogInterval) {
      clearInterval(state.watchdogInterval);
    }
    // We do NOT update Firestore status here, leaving it as 'connected' so it can restore on restart!
    destroyPromises.push(
      state.client.destroy().catch((err) => {
        console.error(`[Shutdown] Error destroying client for ${workspaceId}:`, err.message || err);
      })
    );
  }

  await Promise.all(destroyPromises);
  console.log('[Shutdown] All active clients destroyed. Exiting process.');
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Start Server
export const server = app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Dudo WhatsApp Microservice running on port ${PORT}`);
  console.log(`Session path: ${WHATSAPP_SESSION_PATH}`);
  console.log(`Dudo URL: ${DUDO_BASE_URL}`);
  console.log(`==================================================`);

  restoreSessions();
});
