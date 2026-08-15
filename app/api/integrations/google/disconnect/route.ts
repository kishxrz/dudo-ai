import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, scope } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const docNameMap: Record<string, string> = {
      identity: 'googleIdentity',
      gmail: 'gmailIntegration',
      calendar: 'calendarIntegration',
      drive: 'driveIntegration',
      docs: 'docsIntegration',
      sheets: 'sheetsIntegration'
    };

    const docName = docNameMap[scope || 'identity'] || 'googleIdentity';

    const disconnectPayload = {
      connected: false,
      accessToken: '',
      refreshToken: '',
      expiresAt: null,
      grantedScopes: [],
      disconnectedAt: new Date(),
    };

    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/integrations/${docName}`).set(disconnectPayload, { merge: true });
      await adminDb.collection(`workspaces/${workspaceId}/integrations/${docName}/logs`).add({
        action: 'disconnect',
        timestamp: new Date(),
      });
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'integrations', docName), disconnectPayload, { merge: true });
    }

    // Recalculate active scopes
    const allScopes = ['gmail', 'calendar', 'sheets', 'drive', 'docs'];
    const activeScopes: string[] = [];

    for (const sc of allScopes) {
      if (sc === scope) continue;
      const checkDocName = docNameMap[sc];
      let isConnected = false;
      if (adminDb) {
        const snap = await adminDb.doc(`workspaces/${workspaceId}/integrations/${checkDocName}`).get();
        if (snap.exists && snap.data()?.connected) isConnected = true;
      } else if (db) {
        const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'integrations', checkDocName));
        if (snap.exists() && snap.data()?.connected) isConnected = true;
      }
      if (isConnected) {
        activeScopes.push(sc);
      }
    }

    const legacyPayload = {
      scopes: activeScopes,
      status: activeScopes.length > 0 ? 'connected' : 'disconnected',
    };

    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).set(legacyPayload, { merge: true });
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'), legacyPayload, { merge: true });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in Google disconnect route:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
