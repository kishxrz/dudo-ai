import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, scope } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    let currentData: any = null;

    if (adminDb) {
      const snap = await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).get();
      if (snap.exists) {
        currentData = snap.data();
      }
    } else if (db) {
      const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'));
      if (snap.exists()) {
        currentData = snap.data();
      }
    }

    const currentScopes: string[] = currentData?.scopes || [];
    const updatedScopes = scope ? currentScopes.filter((s: string) => s !== scope) : [];

    const shouldFullDisconnect = !scope || updatedScopes.length === 0;

    if (shouldFullDisconnect) {
      const updatePayload = {
        status: 'disconnected',
        accessToken: '',
        refreshToken: '',
        expiryDate: null,
        scopes: [],
      };

      if (adminDb) {
        await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).update(updatePayload);
        await adminDb.collection(`workspaces/${workspaceId}/integrations/google/logs`).add({
          action: 'disconnect_all',
          timestamp: new Date(),
        });
      } else if (db) {
        await updateDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'), updatePayload);
        await addDoc(collection(db, 'workspaces', workspaceId, 'integrations', 'google', 'logs'), {
          action: 'disconnect_all',
          timestamp: serverTimestamp(),
        });
      }
    } else {
      if (adminDb) {
        await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).update({
          scopes: updatedScopes,
        });
        await adminDb.collection(`workspaces/${workspaceId}/integrations/google/logs`).add({
          action: `disconnect_${scope}`,
          timestamp: new Date(),
        });
      } else if (db) {
        await updateDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'), {
          scopes: updatedScopes,
        });
        await addDoc(collection(db, 'workspaces', workspaceId, 'integrations', 'google', 'logs'), {
          action: `disconnect_${scope}`,
          timestamp: serverTimestamp(),
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in Google disconnect route:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
