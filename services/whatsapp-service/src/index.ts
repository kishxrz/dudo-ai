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
}

const registry = new Map<string, ClientState>();

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
async function startClient(workspaceId: string): Promise<void> {
  if (registry.has(workspaceId)) {
    console.log(`[Registry] Client already exists for workspace: ${workspaceId}`);
    return;
  }

  // Atomically track session connection intent
  addToManifest(workspaceId);

  console.log(`[Registry] Initializing WhatsApp Client for workspace: ${workspaceId}`);

  const clientId = `whatsapp-${workspaceId}`;
  
  // Puppeteer settings
  const puppeteerArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
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
    }
  });

  const state: ClientState = {
    client,
    qr: null,
    status: 'disconnected',
    error: null,
    startupTime: Math.floor(Date.now() / 1000),
    inFlightMessages: new Set<string>()
  };

  registry.set(workspaceId, state);

  // ─── Client Event Handlers ───

  client.on('qr', (qrCode) => {
    state.qr = qrCode;
    state.status = 'qr_ready';
    state.error = null;
    console.log(`[Event] QR Code generated for workspace: ${workspaceId}`);
  });

  client.on('ready', () => {
    state.status = 'connected';
    state.qr = null;
    state.error = null;
    console.log(`[Event] WhatsApp client ready for workspace: ${workspaceId}`);
  });

  client.on('auth_failure', (msg) => {
    state.status = 'disconnected';
    state.qr = null;
    state.error = `Authentication failure: ${msg}`;
    console.error(`[Event] Auth failure for workspace ${workspaceId}:`, msg);
  });

  client.on('disconnected', (reason) => {
    state.status = 'disconnected';
    state.qr = null;
    state.error = `Disconnected: ${reason}`;
    console.log(`[Event] Client disconnected for workspace: ${workspaceId}, reason: ${reason}`);
    
    // Cleanup registry
    try {
      client.destroy().catch(() => {});
    } catch {}
    registry.delete(workspaceId);
  });

  client.on('message', async (message) => {
    const messageId = message.id._serialized || message.id.id;

    // Basic filter guards
    if (message.fromMe) return;
    if (message.from.includes('@g.us')) return; // ignore group chats
    if (message.type !== 'chat') return; // ignore media / voice notes for now
    
    // Ignore historical messages generated before this client started
    if (message.timestamp < state.startupTime) {
      console.log(`[Filter] Ignored historical message from ${message.from} timestamp ${message.timestamp} (startupTime: ${state.startupTime})`);
      return;
    }

    // Deduplication check: check if this message is already in progress locally
    if (state.inFlightMessages.has(messageId)) {
      console.log(`[Deduplication] Message ${messageId} is already in-flight locally. Ignoring duplicate event.`);
      return;
    }

    try {
      state.inFlightMessages.add(messageId);
      console.log(`[Message] Received from ${message.from} in workspace ${workspaceId}: "${message.body}" (messageId: ${messageId})`);
      
      const payload = {
        externalChatId: message.from,
        messageId: messageId,
        senderId: message.author || message.from,
        messageText: message.body,
        timestamp: message.timestamp
      };

      // Call Next.js endpoint to process AI reply
      const reply = await callDudoWebhookWithRetry(workspaceId, payload);
      
      if (reply && reply.trim().length > 0) {
        console.log(`[Message] Sending reply to ${message.from} for workspace ${workspaceId}: "${reply}"`);
        await client.sendMessage(message.from, reply);
      } else {
        console.log(`[Message] No reply generated or empty response for message ${messageId}`);
      }
    } catch (err: any) {
      console.error(`[Message] Error processing message ${messageId} for workspace ${workspaceId}:`, err.message || err);
    } finally {
      state.inFlightMessages.delete(messageId);
      console.log(`[Message] Finished processing message ${messageId}. Lock released.`);
    }
  });

  try {
    await client.initialize();
  } catch (err: any) {
    console.error(`[Registry] Failed to initialize client for workspace: ${workspaceId}`, err);
    state.error = err.message || 'Initialization failed';
    registry.delete(workspaceId);
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
    res.json({ status: existing.status });
    return;
  }

  // Trigger connect asynchronously
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

// Get status
app.get('/v1/workspaces/:workspaceId/status', authenticate, authorizeWorkspace, (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const state = registry.get(workspaceId);
  if (!state) {
    res.json({ status: 'disconnected' });
    return;
  }
  res.json({ status: state.status, error: state.error });
});

// Get QR binary PNG
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
    try {
      await state.client.destroy();
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
