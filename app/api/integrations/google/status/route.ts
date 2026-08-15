import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const denied = await requireSubscription(req, workspaceId, 'google');
    if (denied) return denied;

    const adminDb = getAdminDb();
    const docNameMap: Record<string, string> = {
      identity: 'googleIdentity',
      gmail: 'gmailIntegration',
      calendar: 'calendarIntegration',
      drive: 'driveIntegration',
      docs: 'docsIntegration',
      sheets: 'sheetsIntegration'
    };

    const keys = ['identity', 'gmail', 'calendar', 'drive', 'docs', 'sheets'];
    const results = await Promise.all(
      keys.map(async (key) => {
        const docName = docNameMap[key];
        if (adminDb) {
          const snap = await adminDb.doc(`workspaces/${workspaceId}/integrations/${docName}`).get();
          return snap.exists ? snap.data() : null;
        } else if (db) {
          const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'integrations', docName));
          return snap.exists() ? snap.data() : null;
        }
        return null;
      })
    );

    const activeScopes: string[] = [];
    let googleEmail = '';

    keys.forEach((key, idx) => {
      const data = results[idx];
      if (data && data.connected) {
        activeScopes.push(key);
        if (data.email && !googleEmail) {
          googleEmail = data.email;
        }
      }
    });

    // Check legacy google doc as fallback
    let legacyData: any = null;
    if (adminDb) {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).get();
      if (snap.exists) legacyData = snap.data();
    } else if (db) {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'));
      if (snap.exists()) legacyData = snap.data();
    }

    if (legacyData?.connected !== false && legacyData?.status === 'connected') {
      if (legacyData.scopes && Array.isArray(legacyData.scopes)) {
        legacyData.scopes.forEach((sc: string) => {
          if (!activeScopes.includes(sc)) activeScopes.push(sc);
        });
      }
      if (legacyData.email && !googleEmail) {
        googleEmail = legacyData.email;
      }
    }

    const isConnected = activeScopes.length > 0 || (legacyData?.status === 'connected');

    return NextResponse.json({
      connected: isConnected,
      email: googleEmail,
      scopes: activeScopes,
    });
  } catch (err: any) {
    console.error('Error in Google status route:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
