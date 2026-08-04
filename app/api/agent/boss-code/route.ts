import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import crypto from 'crypto';
import { 
  encryptBossCode, 
  decryptBossCode, 
  getLockoutStatus, 
  recordBossAccessFailure, 
  clearBossAccessFailures, 
  logBossAccessEvent,
  generateSalt,
  hashBossCode,
  generateBossLinkCode
} from '@/lib/security';
import { RateLimiter } from '@/lib/rate-limiter';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';

const assistantId = 'assistant-1';

/**
 * Server-side authorization helper.
 * Verifies that the bearer token UID matches the requested workspace ID.
 */
async function authorizeOwner(req: NextRequest, workspaceId: string): Promise<boolean> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    // In local development / mock mode without Admin SDK, bypass token verification
    return true;
  }
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken.uid === workspaceId;
  } catch (e) {
    console.error('[Auth Error] verifyIdToken failed:', e);
    return false;
  }
}

/**
 * Verifies recent session re-authentication.
 * Claims auth_time must be less than 5 minutes old.
 */
async function verifyRecentAuth(req: NextRequest, workspaceId: string): Promise<boolean> {
  const adminDb = getAdminDb();
  if (!adminDb) return true; // dev bypass
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    if (decodedToken.uid !== workspaceId) return false;
    const authTime = decodedToken.auth_time; // UTC seconds
    const now = Math.floor(Date.now() / 1000);
    return (now - authTime) < 300; // 5 minutes
  } catch (e) {
    return false;
  }
}

/**
 * GET — Check if a boss code has already been configured for the assistant.
 * Note: Never returns the plaintext code or the stored hash.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const authorized = await authorizeOwner(req, workspaceId);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const denied = await requireSubscription(req, workspaceId);
  if (denied) return denied;

  let docData: any = {};
  const adminDb = getAdminDb();

  if (adminDb) {
    try {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/${assistantId}`).get();
      if (snap.exists) {
        docData = snap.data() || {};
      }
    } catch (e) {
      console.error(e);
    }
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', assistantId));
      if (snap.exists()) {
        docData = snap.data() || {};
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Fallback to local storage if running in browser
  if (!docData?.bossCodeStatus && typeof window !== 'undefined') {
    try {
      const local = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
      docData = local;
    } catch (e) {}
  }

  const hasBossCode = !!docData.bossCodeHash;

  return NextResponse.json({
    hasBossCode,
    bossCodeStatus: docData.bossCodeStatus || 'not_generated',
    bossCodeExpiresAt: docData.bossCodeExpiresAt?.toDate ? docData.bossCodeExpiresAt.toDate().getTime() : (docData.bossCodeExpiresAt ? new Date(docData.bossCodeExpiresAt).getTime() : null),
    bossOwnerLinked: !!docData.bossOwnerLinked,
    bossOwnerPlatform: docData.bossOwnerPlatform || null,
    bossOwnerNumber: docData.bossOwnerNumber || null,
    bossOwnerTelegramId: docData.bossOwnerTelegramId || null,
    bossOwnerLinkedAt: docData.bossOwnerLinkedAt?.toDate ? docData.bossOwnerLinkedAt.toDate().getTime() : (docData.bossOwnerLinkedAt ? new Date(docData.bossOwnerLinkedAt).getTime() : null),
    bossAccessEnabled: docData.bossAccessEnabled !== false,
    whatsappAdmins: docData.whatsappAdmins || '',
    telegramAdmins: docData.telegramAdmins || '',
    takeoverTimeout: docData.takeoverTimeout || 30
  });
}

/**
 * POST — Generate, reveal, unlink, and revoke secure Boss Codes.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId, action } = body;
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  // 1. Rate limiting check (5 requests per 1 minute)
  const ip = RateLimiter.getClientIp(req);
  const isLimited = RateLimiter.isRateLimited(ip, 5, 60000, 'boss-access-api');
  if (isLimited) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  // 2. Authenticated owner check
  const authorized = await authorizeOwner(req, workspaceId);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 3. Lockout check
  const { isLocked, remainingMs } = await getLockoutStatus(workspaceId);
  if (isLocked) {
    const mins = Math.ceil(remainingMs / 60000);
    return NextResponse.json({ error: 'LOCKED', message: `Boss Access is locked. Try again in ${mins} minutes.` }, { status: 423 });
  }

  // 4. Subscription check
  const denied = await requireSubscription(req, workspaceId);
  if (denied) return denied;



  const adminDb = getAdminDb();

  // Load assistant configuration
  let assistantDoc: any = null;
  if (adminDb) {
    const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/${assistantId}`).get();
    if (snap.exists) assistantDoc = snap.data();
  } else if (db) {
    const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', assistantId));
    if (snap.exists()) assistantDoc = snap.data();
  }

  // Extract user ID from token header for audit log
  let userId = 'unknown';
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      if (adminDb) {
        const decoded = await getAuth().verifyIdToken(token);
        userId = decoded.uid;
      }
    } catch {}
  }

  if (action === 'generate') {
    // Generate secure boss link code
    const secureCode = generateBossLinkCode();
    const salt = generateSalt();
    const hash = hashBossCode(secureCode, salt);
    const { encrypted, iv } = encryptBossCode(secureCode);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins expiry

    const updateFields = {
      bossCodeHash: hash,
      bossCodeSalt: salt,
      bossCodeEncrypted: encrypted,
      bossCodeIv: iv,
      bossCodeCreatedAt: now,
      bossCodeExpiresAt: expiresAt,
      bossCodeStatus: 'active',
      bossAccessEnabled: true // Auto-enable access on generate
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

    await logBossAccessEvent(workspaceId, userId, 'Code regenerated', true, req);
    return NextResponse.json({ code: secureCode, expiresAt: expiresAt.getTime() });

  } else if (action === 'reveal') {
    const encrypted = assistantDoc?.bossCodeEncrypted;
    const iv = assistantDoc?.bossCodeIv;
    const expiresAtVal = assistantDoc?.bossCodeExpiresAt;

    if (!encrypted || !iv) {
      return NextResponse.json({ error: 'Not Generated', message: 'No Boss Link Code configured.' }, { status: 404 });
    }

    const expiryTime = expiresAtVal?.toDate ? expiresAtVal.toDate().getTime() : new Date(expiresAtVal).getTime();
    if (Date.now() > expiryTime) {
      return NextResponse.json({ error: 'Expired', message: 'This Boss Link Code has expired.' }, { status: 410 });
    }

    try {
      const decrypted = decryptBossCode(encrypted, iv);
      return NextResponse.json({ code: decrypted });
    } catch (err) {
      await recordBossAccessFailure(workspaceId);
      await logBossAccessEvent(workspaceId, userId, 'Invalid code', false, req, { reason: 'Decryption failed' });
      return NextResponse.json({ error: 'Failed', message: 'Unable to decrypt Boss Link Code.' }, { status: 500 });
    }

  } else if (action === 'unlink') {
    const updateFields = {
      bossOwnerLinked: false,
      bossOwnerPlatform: null,
      bossOwnerNumber: null,
      bossOwnerTelegramId: null,
      bossOwnerLinkedAt: null,
      bossCodeHash: null,
      bossCodeSalt: null,
      bossCodeEncrypted: null,
      bossCodeIv: null,
      bossCodeCreatedAt: null,
      bossCodeExpiresAt: null,
      bossCodeStatus: 'not_generated'
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

    await logBossAccessEvent(workspaceId, userId, 'Boss unlinked', true, req);
    return NextResponse.json({ success: true });

  } else if (action === 'regenerate-all') {
    const updateFields = {
      bossCodeHash: null,
      bossCodeSalt: null,
      bossCodeEncrypted: null,
      bossCodeIv: null,
      bossCodeCreatedAt: null,
      bossCodeExpiresAt: null,
      bossCodeStatus: 'not_generated'
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

    await logBossAccessEvent(workspaceId, userId, 'Code regenerated', true, req);
    return NextResponse.json({ success: true });

  } else if (action === 'disable') {
    const updateFields = {
      bossAccessEnabled: false,
      bossOwnerLinked: false,
      bossOwnerPlatform: null,
      bossOwnerNumber: null,
      bossOwnerTelegramId: null,
      bossOwnerLinkedAt: null,
      bossCodeHash: null,
      bossCodeSalt: null,
      bossCodeEncrypted: null,
      bossCodeIv: null,
      bossCodeCreatedAt: null,
      bossCodeExpiresAt: null,
      bossCodeStatus: 'not_generated'
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

    await logBossAccessEvent(workspaceId, userId, 'Boss Access disabled', true, req);
    return NextResponse.json({ success: true });

  } else if (action === 'enable') {
    const updateFields = {
      bossAccessEnabled: true
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

    await logBossAccessEvent(workspaceId, userId, 'Boss Access enabled', true, req);
    return NextResponse.json({ success: true });

  } else if (action === 'save-admins') {
    const { whatsappAdmins, telegramAdmins } = body;
    
    // Validate WhatsApp numbers (must match +E.164, no duplicates)
    const validWaList: string[] = [];
    if (typeof whatsappAdmins === 'string') {
      const inputList = whatsappAdmins.split(',').map(s => s.trim()).filter(Boolean);
      for (const raw of inputList) {
        if (/^\+[1-9]\d{1,14}$/.test(raw) && !validWaList.includes(raw)) {
          validWaList.push(raw);
        }
      }
    }
    const finalWa = validWaList.join(', ');

    // Validate Telegram numeric IDs (numeric only, no duplicates)
    const validTgList: string[] = [];
    if (typeof telegramAdmins === 'string') {
      const inputList = telegramAdmins.split(',').map(s => s.trim()).filter(Boolean);
      for (const raw of inputList) {
        if (/^\d+$/.test(raw) && !validTgList.includes(raw)) {
          validTgList.push(raw);
        }
      }
    }
    const finalTg = validTgList.join(', ');

    const updateFields = {
      whatsappAdmins: finalWa,
      telegramAdmins: finalTg
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

    // Audit logs for admin verifications
    if (finalWa) {
      await logBossAccessEvent(workspaceId, userId, 'WhatsApp verification', true, req);
    }
    if (finalTg) {
      await logBossAccessEvent(workspaceId, userId, 'Telegram verification', true, req);
    }

    return NextResponse.json({ success: true, whatsappAdmins: finalWa, telegramAdmins: finalTg });

  } else if (action === 'clear-lockout') {
    await clearBossAccessFailures(workspaceId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
