import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { canUseFeature } from '@/lib/billing-entitlements-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, scope } = await req.json();

    if (!workspaceId || !scope) {
      return NextResponse.json({ error: 'Missing workspaceId or scope' }, { status: 400 });
    }

    const allowed = await canUseFeature(workspaceId, 'booking');
    if (!allowed) {
      return NextResponse.json({ error: 'Upgrade required: Google Calendar/Booking integrations are not allowed on your current plan.' }, { status: 403 });
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

    if (!currentData || currentData.status !== 'connected') {
      return NextResponse.json({ error: 'Google integration is not authenticated. Please run OAuth first.' }, { status: 400 });
    }

    const currentScopes: string[] = currentData.scopes || [];
    const updatedScopes = Array.from(new Set([...currentScopes, scope]));

    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/integrations/google`).update({
        scopes: updatedScopes,
      });
      await adminDb.collection(`workspaces/${workspaceId}/integrations/google/logs`).add({
        action: `connect_${scope}`,
        timestamp: new Date(),
      });
    } else if (db) {
      await updateDoc(doc(db, 'workspaces', workspaceId, 'integrations', 'google'), {
        scopes: updatedScopes,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in Google connect route:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
