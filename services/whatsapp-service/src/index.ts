import express, { Request, Response, NextFunction } from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import QRCode from 'qrcode';

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
}

const registry = new Map<string, ClientState>();

// Secure endpoint middleware
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized: Missing bearer token');
    return;
  }
  const token = authHeader.substring(7);
  if (token !== WHATSAPP_SERVICE_SECRET || !WHATSAPP_SERVICE_SECRET) {
    res.status(401).send('Unauthorized: Invalid secret key');
    return;
  }
  next();
}

// Ensure sessions directory exists
if (!fs.existsSync(WHATSAPP_SESSION_PATH)) {
  fs.mkdirSync(WHATSAPP_SESSION_PATH, { recursive: true });
}

const MANIFEST_PATH = path.join(WHATSAPP_SESSION_PATH, 'workspaces-manifest.json');

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

// ─── UTILITIES & HELPER FUNCTIONS ──────────────────────────────────────

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
    startupTime: Math.floor(Date.now() / 1000)
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
    // Basic filter guards
    if (message.fromMe) return;
    if (message.from.includes('@g.us')) return; // ignore group chats
    if (message.type !== 'chat') return; // ignore media / voice notes for now
    
    // Ignore historical messages generated before this client started
    if (message.timestamp < state.startupTime) {
      console.log(`[Filter] Ignored historical message from ${message.from} timestamp ${message.timestamp}`);
      return;
    }

    try {
      console.log(`[Message] Received from ${message.from} in workspace ${workspaceId}: "${message.body}"`);
      
      const payload = {
        externalChatId: message.from,
        messageId: message.id.id,
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
        console.log(`[Message] No reply generated or empty response for message ${message.id.id}`);
      }
    } catch (err: any) {
      console.error(`[Message] Error processing message ${message.id.id} for workspace ${workspaceId}:`, err.message || err);
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
app.post('/v1/workspaces/:workspaceId/connect', authenticate, async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  
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
app.get('/v1/workspaces/:workspaceId/status', authenticate, (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const state = registry.get(workspaceId);
  if (!state) {
    res.json({ status: 'disconnected' });
    return;
  }
  res.json({ status: state.status, error: state.error });
});

// Get QR binary PNG
app.get('/v1/workspaces/:workspaceId/qr', authenticate, async (req: Request, res: Response) => {
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
app.post('/v1/workspaces/:workspaceId/disconnect', authenticate, async (req: Request, res: Response) => {
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
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Dudo WhatsApp Microservice running on port ${PORT}`);
  console.log(`Session path: ${WHATSAPP_SESSION_PATH}`);
  console.log(`Dudo URL: ${DUDO_BASE_URL}`);
  console.log(`==================================================`);

  restoreSessions();
});
