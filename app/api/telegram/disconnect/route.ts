import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    // Note: Disconnection is always allowed regardless of subscription/plan status.

    // 1. Load token from Firestore
    const adminDb = getAdminDb();
    let token = '';

    if (adminDb) {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/channels/ch-tg`).get();
      if (snap.exists) {
        token = snap.data()?.token || '';
      }
    } else if (db) {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'channels', 'ch-tg'));
      if (snap.exists()) {
        token = snap.data()?.token || '';
      }
    }

    // 2. Call deleteWebhook
    if (token) {
      try {
        const deleteWebhookRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
        if (!deleteWebhookRes.ok) {
          console.error('[Telegram Disconnect] deleteWebhook failed:', await deleteWebhookRes.text());
        }
      } catch (e) {
        console.error('[Telegram Disconnect] Failed to call deleteWebhook API:', e);
      }
    }

    // 3. Remove/revoke stored credentials
    const payload = {
      status: 'disconnected',
      token: '',
      botUsername: '',
      webhookSecretToken: '',
    };

    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/channels/ch-tg`).set(payload, { merge: true });
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'channels', 'ch-tg'), payload, { merge: true });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error in Telegram disconnect route:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
