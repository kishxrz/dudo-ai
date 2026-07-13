import crypto from 'crypto';
import { db } from './firebase';
import { getAdminDb } from './firebase-admin';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

/**
 * Normalizes WhatsApp phone numbers to E.164 format.
 * Format: +<country_code><number> (no spaces, dashes, parentheses or leading zeros).
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `+91${cleaned}`; // Default to India country code
  }
  return `+${cleaned.replace(/^0+/, '')}`;
}

/**
 * Hashes a Boss Code using a secure salt and PBKDF2 (SHA-256).
 */
export function hashBossCode(code: string, salt: string): string {
  return crypto.pbkdf2Sync(code, salt, 1000, 32, 'sha256').toString('hex');
}

/**
 * Generates a random cryptographic salt.
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a secure, cryptographically random Boss Code.
 * Format: DUDO-XXXXXX (6 random digits)
 */
export function generateSecureCode(): string {
  const bytes = crypto.randomBytes(4);
  const num = (bytes.readUInt32BE(0) % 900000) + 100000;
  return `DUDO-${num}`;
}

/**
 * Verifies a submitted Boss Code against a stored hash in constant-time.
 */
export function verifyBossCode(submittedCode: string, salt: string, storedHash: string): boolean {
  if (!submittedCode || !salt || !storedHash) return false;
  const hash = hashBossCode(submittedCode, salt);
  const hashBuffer = Buffer.from(hash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (hashBuffer.length !== storedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(hashBuffer, storedBuffer);
}

/**
 * Captures and saves the admin's immutable Telegram ID.
 */
async function updateTelegramAdminId(workspaceId: string, adminId: string) {
  const adminDb = getAdminDb();
  if (adminDb) {
    await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).set({
      telegramAdminId: adminId
    }, { merge: true });
  } else if (db) {
    await setDoc(doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1'), {
      telegramAdminId: adminId
    }, { merge: true });
  }
  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
      localStorage.setItem('__dudo_dev_assistant', JSON.stringify({ ...existing, telegramAdminId: adminId }));
    } catch (e) {}
  }
}

/**
 * Verifies if the message sender matches the registered admin identities.
 */
export async function verifyAdminIdentity(
  workspaceId: string,
  channel: 'whatsapp' | 'telegram',
  senderId: string, // WhatsApp number or Telegram user ID
  senderUsername?: string
): Promise<boolean> {
  const adminDb = getAdminDb();
  let whatsappAdmins = '';
  let telegramAdmins = '';
  let telegramAdminId = '';

  if (adminDb) {
    try {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
      if (snap.exists) {
        const data = snap.data();
        whatsappAdmins = data?.whatsappAdmins || '';
        telegramAdmins = data?.telegramAdmins || '';
        telegramAdminId = data?.telegramAdminId || '';
      }
    } catch (e) {}
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1'));
      if (snap.exists()) {
        const data = snap.data();
        whatsappAdmins = data?.whatsappAdmins || '';
        telegramAdmins = data?.telegramAdmins || '';
        telegramAdminId = data?.telegramAdminId || '';
      }
    } catch (e) {}
  }

  if (!whatsappAdmins && !telegramAdmins && typeof window !== 'undefined') {
    // Mock/dev localStorage fallback
    try {
      const local = localStorage.getItem('__dudo_dev_assistant');
      if (local) {
        const parsed = JSON.parse(local);
        whatsappAdmins = parsed.whatsappAdmins || '';
        telegramAdmins = parsed.telegramAdmins || '';
        telegramAdminId = parsed.telegramAdminId || '';
      }
    } catch (e) {}
  }

  if (channel === 'whatsapp') {
    const normalizedSender = normalizePhone(senderId);
    const registeredNumbers = whatsappAdmins.split(',').map(n => normalizePhone(n.trim()));
    return registeredNumbers.includes(normalizedSender);
  } else if (channel === 'telegram') {
    if (telegramAdminId && telegramAdminId.trim()) {
      return telegramAdminId.trim() === senderId.toString();
    }
    if (senderUsername && telegramAdmins) {
      const registeredUsernames = telegramAdmins.split(',').map(u => u.trim().replace(/^@/, '').toLowerCase());
      const isUsernameMatch = registeredUsernames.includes(senderUsername.toLowerCase());
      if (isUsernameMatch) {
        await updateTelegramAdminId(workspaceId, senderId.toString());
        return true;
      }
    }
    const registeredIds = telegramAdmins.split(',').map(u => u.trim());
    return registeredIds.includes(senderId.toString());
  }

  return false;
}

/**
 * Checks rate limits (max 5 failed attempts in the last 15 minutes).
 */
export async function checkRateLimit(workspaceId: string, adminIdentity: string): Promise<boolean> {
  const adminDb = getAdminDb();
  const timeLimit = new Date(Date.now() - 15 * 60 * 1000);

  if (adminDb) {
    try {
      const qSnap = await adminDb
        .collection(`workspaces/${workspaceId}/security_attempts`)
        .where('adminIdentity', '==', adminIdentity)
        .where('timestamp', '>=', timeLimit)
        .get();
      return qSnap.size < 5;
    } catch (e) {
      console.error('[Rate Limit] Firestore Admin check failed:', e);
      return true;
    }
  } else if (db) {
    try {
      const q = query(
        collection(db, 'workspaces', workspaceId, 'security_attempts'),
        where('adminIdentity', '==', adminIdentity),
        where('timestamp', '>=', Timestamp.fromDate(timeLimit))
      );
      const qSnap = await getDocs(q);
      return qSnap.size < 5;
    } catch (e) {
      console.error('[Rate Limit] Firestore Web check failed:', e);
      return true;
    }
  }

  // Local/mock fallback rate limit (in-memory dev cache)
  if (typeof window !== 'undefined') {
    try {
      const key = `__dudo_failed_${workspaceId}_${adminIdentity}`;
      const failed = JSON.parse(localStorage.getItem(key) || '[]');
      const activeFailed = failed.filter((ts: number) => ts >= Date.now() - 15 * 60 * 1000);
      localStorage.setItem(key, JSON.stringify(activeFailed));
      return activeFailed.length < 5;
    } catch (e) {}
  }

  return true;
}

/**
 * Records a failed verification attempt to database.
 */
export async function recordFailedAttempt(workspaceId: string, adminIdentity: string, reason: string): Promise<void> {
  const adminDb = getAdminDb();
  const payload = {
    adminIdentity,
    reason,
    timestamp: new Date(),
  };

  if (adminDb) {
    try {
      await adminDb.collection(`workspaces/${workspaceId}/security_attempts`).add(payload);
    } catch (e) {}
  } else if (db) {
    try {
      await addDoc(collection(db, 'workspaces', workspaceId, 'security_attempts'), payload);
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    try {
      const key = `__dudo_failed_${workspaceId}_${adminIdentity}`;
      const failed = JSON.parse(localStorage.getItem(key) || '[]');
      failed.push(Date.now());
      localStorage.setItem(key, JSON.stringify(failed));
    } catch (e) {}
  }

  // Log to audit log as a security breach event
  await logSecurityEvent(
    workspaceId,
    'global',
    'security',
    adminIdentity,
    'takeover_attempt_blocked',
    false,
    { reason }
  );
}

/**
 * Clears failed attempts upon successful login/verification.
 */
export async function clearFailedAttempts(workspaceId: string, adminIdentity: string): Promise<void> {
  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      const qSnap = await adminDb
        .collection(`workspaces/${workspaceId}/security_attempts`)
        .where('adminIdentity', '==', adminIdentity)
        .get();
      const batch = adminDb.batch();
      qSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    try {
      const key = `__dudo_failed_${workspaceId}_${adminIdentity}`;
      localStorage.removeItem(key);
    } catch (e) {}
  }
}

/**
 * Logs a security event.
 */
export async function logSecurityEvent(
  workspaceId: string,
  conversationId: string,
  channel: string,
  adminIdentity: string,
  action: string,
  success: boolean,
  metadata: any = {}
): Promise<void> {
  const adminDb = getAdminDb();
  const payload = {
    workspaceId,
    conversationId,
    channel,
    adminIdentity,
    action,
    success,
    timestamp: new Date(),
    metadata: {
      ...metadata,
      systemPlatform: 'dudo-security-guard',
    }
  };

  if (adminDb) {
    try {
      await adminDb.collection(`workspaces/${workspaceId}/takeover_audit_logs`).add(payload);
    } catch (e) {}
  } else if (db) {
    try {
      await addDoc(collection(db, 'workspaces', workspaceId, 'takeover_audit_logs'), payload);
    } catch (e) {}
  }
}

export interface CommandResult {
  isCommand: boolean;
  success: boolean;
  replyMessage: string;
}

/**
 * Processes administrative takeover/resume/status commands from messaging channels.
 */
export async function processAdminCommand(
  workspaceId: string,
  channel: 'whatsapp' | 'telegram',
  conversationId: string,
  senderId: string,
  senderUsername: string | undefined,
  messageText: string
): Promise<CommandResult> {
  const parts = messageText.trim().split(/\s+/);
  if (parts.length === 0) {
    return { isCommand: false, success: false, replyMessage: '' };
  }

  const cmd = parts[0].toLowerCase();
  if (cmd !== '/takeover' && cmd !== '/resume' && cmd !== '/status') {
    return { isCommand: false, success: false, replyMessage: '' };
  }

  const submittedCode = parts.slice(1).join(' ').trim();
  const adminIdentity = `${channel}_${senderId}`;

  // 1. Check Rate Limit
  const isAllowed = await checkRateLimit(workspaceId, adminIdentity);
  if (!isAllowed) {
    return {
      isCommand: true,
      success: false,
      replyMessage: '🚫 Access Blocked: Too many failed attempts. Please try again in 15 minutes.'
    };
  }

  // 2. Verify Admin Identity
  const isAdmin = await verifyAdminIdentity(workspaceId, channel, senderId, senderUsername);
  if (!isAdmin) {
    await recordFailedAttempt(workspaceId, adminIdentity, 'Unauthorized admin identity');
    return {
      isCommand: true,
      success: false,
      replyMessage: '🚫 Access Denied: You are not a registered administrator for this workspace.'
    };
  }

  // 3. Retrieve Stored Hash
  let storedHash = '';
  let storedSalt = '';
  let takeoverTimeout = 30;

  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
      if (snap.exists) {
        const data = snap.data();
        storedHash = data?.bossCodeHash || '';
        storedSalt = data?.bossCodeSalt || '';
        takeoverTimeout = data?.takeoverTimeout || 30;
      }
    } catch (e) {}
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1'));
      if (snap.exists()) {
        const data = snap.data();
        storedHash = data?.bossCodeHash || '';
        storedSalt = data?.bossCodeSalt || '';
        takeoverTimeout = data?.takeoverTimeout || 30;
      }
    } catch (e) {}
  }

  if (!storedHash || !storedSalt) {
    let localCodeFound = false;
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
        storedHash = local.bossCodeHash || '';
        storedSalt = local.bossCodeSalt || '';
        takeoverTimeout = local.takeoverTimeout || 30;
        if (storedHash) localCodeFound = true;
      } catch (e) {}
    }
    if (!localCodeFound) {
      return {
        isCommand: true,
        success: false,
        replyMessage: '⚠️ Setup Required: No Boss Code configured. Please set it in the Personality tab.'
      };
    }
  }

  // 4. Verify Boss Code
  const isCodeValid = verifyBossCode(submittedCode, storedSalt, storedHash);
  if (!isCodeValid) {
    await recordFailedAttempt(workspaceId, adminIdentity, 'Invalid Boss Code submitted');
    return {
      isCommand: true,
      success: false,
      replyMessage: '🚫 Access Denied: Invalid Boss Code.'
    };
  }

  // Clear failed attempts upon success
  await clearFailedAttempts(workspaceId, adminIdentity);

  // 5. Execute command using atomic updates
  const docPath = `workspaces/${workspaceId}/conversations/${conversationId}`;
  let replyMessage = '';

  if (cmd === '/takeover') {
    const expiry = new Date(Date.now() + takeoverTimeout * 60 * 1000);
    if (adminDb) {
      const ref = adminDb.doc(docPath);
      await adminDb.runTransaction(async (transaction) => {
        transaction.set(ref, {
          mode: 'HUMAN_TAKEOVER',
          takeoverExpiry: expiry
        }, { merge: true });
      });
    } else if (db) {
      await setDoc(doc(db, docPath), {
        mode: 'HUMAN_TAKEOVER',
        takeoverExpiry: expiry
      }, { merge: true });
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(`__dudo_takeover_${workspaceId}_${conversationId}`, JSON.stringify({
        mode: 'HUMAN_TAKEOVER',
        takeoverExpiry: expiry.getTime()
      }));
    }
    await logSecurityEvent(workspaceId, conversationId, channel, senderId, 'takeover_activated', true);
    replyMessage = `🟢 Takeover Activated: AI replies paused for this conversation for the next ${takeoverTimeout} minutes. Human mode active.`;
  } else if (cmd === '/resume') {
    if (adminDb) {
      const ref = adminDb.doc(docPath);
      await adminDb.runTransaction(async (transaction) => {
        transaction.set(ref, {
          mode: 'AI',
          takeoverExpiry: null
        }, { merge: true });
      });
    } else if (db) {
      await setDoc(doc(db, docPath), {
        mode: 'AI',
        takeoverExpiry: null
      }, { merge: true });
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`__dudo_takeover_${workspaceId}_${conversationId}`);
    }
    await logSecurityEvent(workspaceId, conversationId, channel, senderId, 'takeover_deactivated', true);
    replyMessage = '🔵 AI Resumed: AI auto-replies are now active for this conversation.';
  } else if (cmd === '/status') {
    let mode = 'AI';
    let expiryTime = 0;
    if (adminDb) {
      const snap = await adminDb.doc(docPath).get();
      if (snap.exists) {
        mode = snap.data()?.mode || 'AI';
        const te = snap.data()?.takeoverExpiry;
        expiryTime = te?.toDate ? te.toDate().getTime() : (te || 0);
      }
    } else if (db) {
      const snap = await getDoc(doc(db, docPath));
      if (snap.exists()) {
        mode = snap.data()?.mode || 'AI';
        const te = snap.data()?.takeoverExpiry;
        expiryTime = te?.toDate ? te.toDate().getTime() : (te || 0);
      }
    }
    
    if (typeof window !== 'undefined' && mode === 'AI') {
      try {
        const local = JSON.parse(localStorage.getItem(`__dudo_takeover_${workspaceId}_${conversationId}`) || '{}');
        if (local.mode) {
          mode = local.mode;
          expiryTime = local.takeoverExpiry;
        }
      } catch (e) {}
    }

    if (mode === 'HUMAN_TAKEOVER' && expiryTime > Date.now()) {
      const remainingMins = Math.ceil((expiryTime - Date.now()) / (60 * 1000));
      replyMessage = `ℹ️ Status: HUMAN_TAKEOVER active. AI replies paused. Auto-resume in ${remainingMins} minutes.`;
    } else {
      replyMessage = 'ℹ️ Status: AI auto-reply mode active.';
    }
  }

  return { isCommand: true, success: true, replyMessage };
}

/**
 * Checks if a specific conversation is in HUMAN_TAKEOVER mode and not expired.
 * Automatically switches back to AI if expired.
 */
export async function isConversationInTakeover(
  workspaceId: string,
  conversationId: string
): Promise<boolean> {
  const docPath = `workspaces/${workspaceId}/conversations/${conversationId}`;
  let mode = 'AI';
  let expiryTime = 0;

  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      const snap = await adminDb.doc(docPath).get();
      if (snap.exists) {
        mode = snap.data()?.mode || 'AI';
        const te = snap.data()?.takeoverExpiry;
        expiryTime = te?.toDate ? te.toDate().getTime() : (te || 0);
      }
    } catch (e) {}
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, docPath));
      if (snap.exists()) {
        mode = snap.data()?.mode || 'AI';
        const te = snap.data()?.takeoverExpiry;
        expiryTime = te?.toDate ? te.toDate().getTime() : (te || 0);
      }
    } catch (e) {}
  }

  if (typeof window !== 'undefined' && mode === 'AI') {
    try {
      const local = JSON.parse(localStorage.getItem(`__dudo_takeover_${workspaceId}_${conversationId}`) || '{}');
      if (local.mode) {
        mode = local.mode;
        expiryTime = local.takeoverExpiry;
      }
    } catch (e) {}
  }

  if (mode === 'HUMAN_TAKEOVER') {
    if (expiryTime > Date.now()) {
      return true;
    }
    // Expired! Reset to AI mode.
    if (adminDb) {
      try {
        const ref = adminDb.doc(docPath);
        await adminDb.runTransaction(async (transaction) => {
          transaction.set(ref, { mode: 'AI', takeoverExpiry: null }, { merge: true });
        });
      } catch (e) {}
    } else if (db) {
      try {
        await setDoc(doc(db, docPath), { mode: 'AI', takeoverExpiry: null }, { merge: true });
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`__dudo_takeover_${workspaceId}_${conversationId}`);
    }
  }

  return false;
}
