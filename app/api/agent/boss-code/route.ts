import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { generateSalt, generateSecureCode, hashBossCode } from '@/lib/security';

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

  let hasBossCode = false;
  const adminDb = getAdminDb();

  if (adminDb) {
    try {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/assistants/${assistantId}`).get();
      if (snap.exists) {
        hasBossCode = !!snap.data()?.bossCodeHash;
      }
    } catch (e) {
      console.error(e);
    }
  } else if (db) {
    try {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'assistants', assistantId));
      if (snap.exists()) {
        hasBossCode = !!snap.data()?.bossCodeHash;
      }
    } catch (e) {
      console.error(e);
    }
  }

  return NextResponse.json({ hasBossCode });
}

/**
 * POST — Generate and rotate a new secure Boss Code.
 * Computes salted PBKDF2 hash, saves it, and returns the plaintext once.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId } = body;
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  }

  const authorized = await authorizeOwner(req, workspaceId);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secureCode = generateSecureCode();
  const salt = generateSalt();
  const hash = hashBossCode(secureCode, salt);

  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      await adminDb.doc(`workspaces/${workspaceId}/assistants/${assistantId}`).set({
        bossCodeHash: hash,
        bossCodeSalt: salt,
        // Invalidate old code immediately on rotation/generation
        bossCodePlaintext: null
      }, { merge: true });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
  } else if (db) {
    try {
      await setDoc(doc(db, 'workspaces', workspaceId, 'assistants', assistantId), {
        bossCodeHash: hash,
        bossCodeSalt: salt,
        bossCodePlaintext: null
      }, { merge: true });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
  }

  // Also clear old localstorage code reference if we rotate
  if (typeof window !== 'undefined') {
    localStorage.removeItem('__dudo_boss_code_plaintext');
  }

  // Return the plaintext code exactly once immediately after generation
  return NextResponse.json({ code: secureCode });
}
