import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

async function authorizeOwner(req: NextRequest, workspaceId: string): Promise<boolean> {
  const adminDb = getAdminDb();
  if (!adminDb) return true; // mock mode bypass in local dev
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;
    if (uid === workspaceId) return true;
    const wsSnap = await adminDb.doc(`workspaces/${workspaceId}`).get();
    if (wsSnap.exists && wsSnap.data()?.ownerId === uid) {
      return true;
    }
    return false;
  } catch (e) {
    console.error('[Auth Error] verifyIdToken failed for disconnect proxy:', e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const isAuthorized = await authorizeOwner(req, workspaceId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
    const serviceSecret = process.env.WHATSAPP_SERVICE_SECRET;
    if (!serviceUrl || !serviceSecret) {
      return NextResponse.json({ error: 'WhatsApp service is not configured' }, { status: 500 });
    }

    const response = await fetch(`${serviceUrl}/v1/workspaces/${workspaceId}/disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceSecret}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: errText || 'Failed to disconnect WhatsApp' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error in WhatsApp disconnect proxy route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
