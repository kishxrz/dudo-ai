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
    return decodedToken.uid === workspaceId;
  } catch (e) {
    console.error('[Auth Error] verifyIdToken failed for status proxy:', e);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
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

    const response = await fetch(`${serviceUrl}/v1/workspaces/${workspaceId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceSecret}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: errText || 'Failed to get status' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error in WhatsApp status proxy route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
