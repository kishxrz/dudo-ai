import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { VectorStore } from '@/lib/ai/VectorStore';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';

async function authorizeOwner(req: NextRequest, workspaceId: string): Promise<boolean> {
  const adminDb = getAdminDb();
  if (!adminDb) return true; // bypass in local dev mock mode

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken.uid === workspaceId;
  } catch (e) {
    console.error('[Auth Error] verifyIdToken failed for Deletion:', e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId, itemId } = body;
  if (!workspaceId || !itemId) {
    return NextResponse.json({ error: 'workspaceId and itemId are required' }, { status: 400 });
  }

  const authorized = await authorizeOwner(req, workspaceId);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized workspace access' }, { status: 401 });
  }

  const denied = await requireSubscription(req, workspaceId, 'knowledge');
  if (denied) return denied;

  console.log(`[Deletion API] Deleting vector records for item: ${itemId} in workspace: ${workspaceId}`);
  await VectorStore.deleteResource(workspaceId, itemId);
  
  return NextResponse.json({ success: true });
}
