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

export function generateBossLinkCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return `BOSS-${code}`;
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
  messageText: string,
  extraData?: { chatId?: string | number; displayName?: string }
): Promise<CommandResult> {
  const assistantId = 'assistant-1';
  const cleanText = messageText.trim();
  const parts = cleanText.split(/\s+/);
  if (parts.length === 0) {
    return { isCommand: false, success: false, replyMessage: '' };
  }

  const cmd = parts[0].toLowerCase();
  const isBossPattern = /^BOSS-[A-Z0-9]{6}$/i.test(cleanText);
  const isEmergencyCode = cleanText.toLowerCase() === 'emergency code';
  const isCommand = isBossPattern || isEmergencyCode || [
    '/boss', '/unlink', '/whoami', '/takeover', '/resume', '/status', '/emergency', '/emergency-code'
  ].includes(cmd);

  if (!isCommand) {
    return { isCommand: false, success: false, replyMessage: '' };
  }

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

  const adminDb = getAdminDb();
  let assistantDoc: any = null;

  if (adminDb) {
    try {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/${assistantId}`).get();
      if (snap.exists) assistantDoc = snap.data();
    } catch (e) {
      console.error('[processAdminCommand] doc load error:', e);
    }
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', assistantId));
      if (snap.exists()) assistantDoc = snap.data();
    } catch (e) {
      console.error('[processAdminCommand] doc load error:', e);
    }
  }

  if (!assistantDoc && typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
      assistantDoc = local;
    } catch (e) {}
  }

  if (!assistantDoc) {
    assistantDoc = {
      bossAccessEnabled: true,
      bossOwnerLinked: false,
      whatsappAdmins: '',
      telegramAdmins: ''
    };
  }

  const bossAccessEnabled = assistantDoc?.bossAccessEnabled !== false;
  if (!bossAccessEnabled && cmd !== '/whoami' && !isEmergencyCode && cmd !== '/emergency' && cmd !== '/emergency-code') {
    return {
      isCommand: true,
      success: false,
      replyMessage: '🚫 Boss Access is currently disabled for this AI Employee.'
    };
  }

  const bossOwnerLinked = !!assistantDoc?.bossOwnerLinked;

  // 2. Handle Link Code Verification
  if (isBossPattern) {
    if (bossOwnerLinked) {
      await logBossAccessEvent(workspaceId, 'bot', 'Duplicate owner attempt', false, null, {
        platform: channel,
        senderId,
        reason: 'Workspace already has a verified owner.'
      });
      return {
        isCommand: true,
        success: false,
        replyMessage: '⚠ This AI Employee already has a verified owner. Only the current owner can revoke Boss Access.'
      };
    }

    const storedHash = assistantDoc?.bossCodeHash;
    const storedSalt = assistantDoc?.bossCodeSalt;
    const codeStatus = assistantDoc?.bossCodeStatus;
    const expiresAtVal = assistantDoc?.bossCodeExpiresAt;

    if (!storedHash || !storedSalt || codeStatus === 'not_generated') {
      await recordBossAccessFailure(workspaceId);
      await logBossAccessEvent(workspaceId, 'bot', 'Invalid code', false, null, {
        platform: channel,
        senderId,
        reason: 'No Boss Link Code configured'
      });
      return {
        isCommand: true,
        success: false,
        replyMessage: '❌ Invalid Boss Link Code. Please verify the code and try again.'
      };
    }

    if (codeStatus === 'revoked') {
      await recordBossAccessFailure(workspaceId);
      await logBossAccessEvent(workspaceId, 'bot', 'Revoked code used', false, null, {
        platform: channel,
        senderId,
        reason: 'Code is revoked'
      });
      return {
        isCommand: true,
        success: false,
        replyMessage: '❌ This Boss Link Code has been revoked.'
      };
    }

    if (codeStatus === 'consumed') {
      await recordBossAccessFailure(workspaceId);
      await logBossAccessEvent(workspaceId, 'bot', 'Invalid code', false, null, {
        platform: channel,
        senderId,
        reason: 'Code already consumed'
      });
      return {
        isCommand: true,
        success: false,
        replyMessage: '❌ This Boss Link Code has already been used.'
      };
    }

    const expiryTime = expiresAtVal?.toDate ? expiresAtVal.toDate().getTime() : new Date(expiresAtVal).getTime();
    if (Date.now() > expiryTime || codeStatus === 'expired') {
      await recordBossAccessFailure(workspaceId);
      await logBossAccessEvent(workspaceId, 'bot', 'Expired code used', false, null, {
        platform: channel,
        senderId,
        reason: 'Code expired'
      });
      return {
        isCommand: true,
        success: false,
        replyMessage: '❌ This Boss Link Code has expired. Generate a new code from the Dudo dashboard.'
      };
    }

    const isCodeValid = verifyBossCode(cleanText.toUpperCase(), storedSalt, storedHash);
    if (!isCodeValid) {
      await recordBossAccessFailure(workspaceId);
      await logBossAccessEvent(workspaceId, 'bot', 'Invalid code', false, null, {
        platform: channel,
        senderId,
        reason: 'Code hash mismatch'
      });
      return {
        isCommand: true,
        success: false,
        replyMessage: '❌ Invalid Boss Link Code. Please verify the code and try again.'
      };
    }

    // Clear failed attempts upon success
    await clearBossAccessFailures(workspaceId);

    // Save linked owner state
    let bossOwnerNumber = '';
    let bossOwnerTelegramId = '';
    let whatsappAdmins = assistantDoc.whatsappAdmins || '';
    let telegramAdmins = assistantDoc.telegramAdmins || '';

    if (channel === 'whatsapp') {
      bossOwnerNumber = normalizePhone(senderId);
      const list = whatsappAdmins.split(',').map((n: string) => n.trim()).filter(Boolean);
      if (!list.includes(bossOwnerNumber)) {
        list.push(bossOwnerNumber);
      }
      whatsappAdmins = list.join(', ');
    } else {
      bossOwnerNumber = senderId.toString();
      bossOwnerTelegramId = senderId.toString();
      const list = telegramAdmins.split(',').map((u: string) => u.trim()).filter(Boolean);
      if (!list.includes(bossOwnerTelegramId)) {
        list.push(bossOwnerTelegramId);
      }
      telegramAdmins = list.join(', ');
    }

    const updateFields = {
      bossOwnerLinked: true,
      bossOwnerPlatform: channel,
      bossOwnerNumber,
      bossOwnerTelegramId,
      bossOwnerTelegramUsername: senderUsername || null,
      bossOwnerTelegramChatId: extraData?.chatId?.toString() || null,
      bossOwnerTelegramDisplayName: extraData?.displayName || null,
      bossOwnerLinkedAt: new Date(),
      bossCodeStatus: 'consumed',
      whatsappAdmins,
      telegramAdmins
    };

    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/assistants/${assistantId}`).set(updateFields, { merge: true });
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'assistants', assistantId), updateFields, { merge: true });
    }

    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
        localStorage.setItem('__dudo_dev_assistant', JSON.stringify({ ...local, ...updateFields }));
      } catch (e) {}
    }

    await logBossAccessEvent(workspaceId, 'bot', 'Boss linked', true, null, { platform: channel, senderId });
    await logBossAccessEvent(workspaceId, 'bot', channel === 'whatsapp' ? 'WhatsApp verification' : 'Telegram verification', true, null, { platform: channel, senderId });

    return {
      isCommand: true,
      success: true,
      replyMessage: '✅ Boss linked successfully.\n\nYou are now the verified owner of this AI Employee.\n\nFuture management commands will only be accepted from this account.'
    };
  }

  // 2.5 Verify Boss Link Code for /takeover command if owner not linked or code provided
  if (cmd === '/takeover') {
    if (!bossOwnerLinked || parts.length > 1) {
      const submittedCode = parts[1];
      if (!submittedCode) {
        await recordFailedAttempt(workspaceId, adminIdentity, 'Boss Link Code is required');
        return {
          isCommand: true,
          success: false,
          replyMessage: '❌ Boss Link Code is required to activate takeover.'
        };
      }
      const storedHash = assistantDoc?.bossCodeHash;
      const storedSalt = assistantDoc?.bossCodeSalt;
      const codeStatus = assistantDoc?.bossCodeStatus;
      const expiresAtVal = assistantDoc?.bossCodeExpiresAt;

      if (!storedHash || !storedSalt || codeStatus === 'not_generated') {
        await recordFailedAttempt(workspaceId, adminIdentity, 'No Boss Link Code configured');
        return {
          isCommand: true,
          success: false,
          replyMessage: '❌ No Boss Link Code configured.'
        };
      }

      if (codeStatus === 'revoked') {
        await recordFailedAttempt(workspaceId, adminIdentity, 'Code is revoked');
        return {
          isCommand: true,
          success: false,
          replyMessage: '❌ This Boss Link Code has been revoked.'
        };
      }

      if (codeStatus === 'consumed') {
        await recordFailedAttempt(workspaceId, adminIdentity, 'Code already consumed');
        return {
          isCommand: true,
          success: false,
          replyMessage: '❌ This Boss Link Code has already been used.'
        };
      }

      if (expiresAtVal) {
        const expiryTime = expiresAtVal.toDate ? expiresAtVal.toDate().getTime() : new Date(expiresAtVal).getTime();
        if (Date.now() > expiryTime || codeStatus === 'expired') {
          await recordFailedAttempt(workspaceId, adminIdentity, 'Code expired');
          return {
            isCommand: true,
            success: false,
            replyMessage: '❌ This Boss Link Code has expired.'
          };
        }
      }

      const isCodeValid = verifyBossCode(submittedCode.toUpperCase(), storedSalt, storedHash);
      if (!isCodeValid) {
        await recordFailedAttempt(workspaceId, adminIdentity, 'Invalid Boss Link Code');
        return {
          isCommand: true,
          success: false,
          replyMessage: '❌ Invalid Boss Link Code. Please verify the code and try again.'
        };
      }
    }
  }

  // 3. Verify owner commands if owner is linked
  let isSenderOwner = false;
  if (bossOwnerLinked) {
    const bossOwnerPlatform = assistantDoc?.bossOwnerPlatform;
    const bossOwnerNumber = assistantDoc?.bossOwnerNumber;
    const bossOwnerTelegramId = assistantDoc?.bossOwnerTelegramId;

    if (channel === bossOwnerPlatform) {
      if (channel === 'whatsapp') {
        isSenderOwner = normalizePhone(senderId) === normalizePhone(bossOwnerNumber || '');
      } else {
        isSenderOwner = senderId.toString() === (bossOwnerTelegramId || bossOwnerNumber || '').toString();
      }
    }

    if (!isSenderOwner) {
      await logBossAccessEvent(workspaceId, 'bot', 'Failed link attempt', false, null, {
        platform: channel,
        senderId,
        reason: 'Unauthorized command execution from non-owner account while owner is linked.'
      });
      return {
        isCommand: true,
        success: false,
        replyMessage: '🚫 Access Denied: This AI Employee already has a verified owner.'
      };
    }
  }

  // 4. Verify admin fallback if no owner linked yet
  if (!bossOwnerLinked) {
    const isAdmin = await verifyAdminIdentity(workspaceId, channel, senderId, senderUsername);
    if (!isAdmin) {
      await recordFailedAttempt(workspaceId, adminIdentity, 'Unauthorized admin identity');
      return {
        isCommand: true,
        success: false,
        replyMessage: '🚫 Access Denied: You are not a registered administrator for this workspace.'
      };
    }
  }

  // Clear failed attempts upon success
  await clearFailedAttempts(workspaceId, adminIdentity);

  // 5. Execute commands
  let replyMessage = '';

  if (cmd === '/whoami') {
    return {
      isCommand: true,
      success: true,
      replyMessage: `ℹ️ Your ${channel === 'telegram' ? 'Telegram User ID' : 'WhatsApp Sender ID'} is: ${senderId}`
    };
  }

  if (isEmergencyCode || cmd === '/emergency' || cmd === '/emergency-code') {
    const statusStr = bossOwnerLinked ? 'Linked' : 'Not Linked';
    const platformStr = assistantDoc?.bossOwnerPlatform || 'None';
    const numberStr = assistantDoc?.bossOwnerNumber || 'None';
    const enabledStr = bossAccessEnabled ? 'Yes' : 'No';
    const codeStatus = assistantDoc?.bossCodeStatus || 'not_generated';

    replyMessage = `🚨 Emergency Verification State:
Boss Linked: ${statusStr}
Platform: ${platformStr}
Owner Number/ID: ${numberStr}
Access Enabled: ${enabledStr}
Current Code Status: ${codeStatus}`;

    return { isCommand: true, success: true, replyMessage };
  }

  if (cmd === '/boss') {
    if (bossOwnerLinked) {
      const platformStr = assistantDoc?.bossOwnerPlatform === 'whatsapp' ? 'WhatsApp' : 'Telegram';
      const numberStr = assistantDoc?.bossOwnerNumber || 'None';
      let linkedAtStr = 'Never';
      if (assistantDoc?.bossOwnerLinkedAt) {
        const d = assistantDoc.bossOwnerLinkedAt.toDate ? assistantDoc.bossOwnerLinkedAt.toDate() : new Date(assistantDoc.bossOwnerLinkedAt);
        linkedAtStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
                      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST';
      }
      replyMessage = `👤 Boss Access Status:
Platform: ${platformStr}
Account: ${numberStr}
Linked Since: ${linkedAtStr}`;
    } else {
      replyMessage = '👤 Boss Access Status: Not Linked. Please link using your Boss Link Code.';
    }
    return { isCommand: true, success: true, replyMessage };
  }

  if (cmd === '/unlink') {
    if (!bossOwnerLinked) {
      return {
        isCommand: true,
        success: false,
        replyMessage: '⚠ Boss Access is not currently linked.'
      };
    }

    const updateFields = {
      bossOwnerLinked: false,
      bossOwnerPlatform: null,
      bossOwnerNumber: null,
      bossOwnerTelegramId: null,
      bossOwnerLinkedAt: null,
      bossCodeStatus: 'not_generated',
      bossCodeHash: null,
      bossCodeSalt: null,
      bossCodeEncrypted: null,
      bossCodeIv: null,
      bossCodeCreatedAt: null,
      bossCodeExpiresAt: null
    };

    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/assistants/${assistantId}`).set(updateFields, { merge: true });
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'assistants', assistantId), updateFields, { merge: true });
    }

    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
        localStorage.setItem('__dudo_dev_assistant', JSON.stringify({ ...local, ...updateFields }));
      } catch (e) {}
    }

    await logBossAccessEvent(workspaceId, 'bot', 'Boss unlinked', true, null, { platform: channel, senderId });

    return {
      isCommand: true,
      success: true,
      replyMessage: '🔓 Boss unlinked successfully. You are no longer recognized as the owner of this AI Employee.'
    };
  }

  const docPath = `workspaces/${workspaceId}/conversations/${conversationId}`;
  const takeoverTimeout = assistantDoc?.takeoverTimeout || 30;

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

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dudo-enterprise-master-sec-key-32'; // 32 characters key

export function encryptBossCode(code: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(code, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encrypted,
    iv: iv.toString('hex')
  };
}

export function decryptBossCode(encrypted: string, iv: string): string {
  const ivBuffer = Buffer.from(iv, 'hex');
  const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuffer);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function getLockoutStatus(workspaceId: string): Promise<{ isLocked: boolean; remainingMs: number }> {
  let docData: any = null;
  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
      if (snap.exists) docData = snap.data();
    } catch (e) {}
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1'));
      if (snap.exists()) docData = snap.data();
    } catch (e) {}
  }
  
  if (!docData) {
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
        docData = local;
      } catch (e) {}
    }
  }

  if (docData && docData.bossAccessLockedUntil) {
    const lockedUntil = docData.bossAccessLockedUntil.toDate ? docData.bossAccessLockedUntil.toDate().getTime() : new Date(docData.bossAccessLockedUntil).getTime();
    if (lockedUntil > Date.now()) {
      return { isLocked: true, remainingMs: lockedUntil - Date.now() };
    }
  }

  return { isLocked: false, remainingMs: 0 };
}

export async function recordBossAccessFailure(workspaceId: string): Promise<{ isLocked: boolean; remainingMs: number }> {
  let docData: any = { bossAccessFailedAttempts: 0 };
  const adminDb = getAdminDb();
  
  if (adminDb) {
    try {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
      if (snap.exists) docData = snap.data() || { bossAccessFailedAttempts: 0 };
    } catch (e) {}
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1'));
      if (snap.exists()) docData = snap.data() || { bossAccessFailedAttempts: 0 };
    } catch (e) {}
  }
  
  const attempts = (docData.bossAccessFailedAttempts || 0) + 1;
  let lockedUntil: Date | null = null;
  
  if (attempts >= 3) {
    lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
  }

  const updateFields: any = {
    bossAccessFailedAttempts: attempts,
    bossAccessLastAttempt: new Date(),
  };
  if (lockedUntil) {
    updateFields.bossAccessLockedUntil = lockedUntil;
  }

  if (adminDb) {
    try {
      await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).set(updateFields, { merge: true });
    } catch (e) {}
  } else if (db) {
    try {
      await setDoc(doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1'), updateFields, { merge: true });
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
      localStorage.setItem('__dudo_dev_assistant', JSON.stringify({ ...existing, ...updateFields }));
    } catch (e) {}
  }

  return {
    isLocked: !!lockedUntil,
    remainingMs: lockedUntil ? 15 * 60 * 1000 : 0
  };
}

export async function clearBossAccessFailures(workspaceId: string) {
  const updateFields = {
    bossAccessFailedAttempts: 0,
    bossAccessLockedUntil: null,
  };
  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).set(updateFields, { merge: true });
    } catch (e) {}
  } else if (db) {
    try {
      await setDoc(doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1'), updateFields, { merge: true });
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
      localStorage.setItem('__dudo_dev_assistant', JSON.stringify({ ...existing, ...updateFields }));
    } catch (e) {}
  }
}

export async function logBossAccessEvent(
  workspaceId: string,
  userId: string,
  action: string,
  success: boolean,
  req: Request | null,
  metadata: any = {}
): Promise<void> {
  // Simple check for Client IP
  let ip = '127.0.0.1';
  let userAgent = 'Unknown';
  if (req) {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
      ip = xff.split(',')[0].trim();
    } else {
      ip = req.headers.get('x-real-ip') || '127.0.0.1';
    }
    userAgent = req.headers.get('user-agent') || 'Unknown';
  }

  const payload = {
    workspaceId,
    userId,
    action,
    success,
    ip,
    userAgent,
    timestamp: new Date(),
    metadata,
  };

  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      await adminDb.collection(`workspaces/${workspaceId}/takeover_audit_logs`).add(payload);
    } catch (e) {
      console.error(e);
    }
  } else if (db) {
    try {
      await addDoc(collection(db, 'workspaces', workspaceId, 'takeover_audit_logs'), payload);
    } catch (e) {
      console.error(e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const logs = JSON.parse(localStorage.getItem(`__dudo_audit_logs_${workspaceId}`) || '[]');
      logs.unshift({ ...payload, timestamp: Date.now() });
      localStorage.setItem(`__dudo_audit_logs_${workspaceId}`, JSON.stringify(logs.slice(0, 100)));
    } catch (e) {}
  }
}

