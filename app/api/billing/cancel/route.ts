/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { DodoPayments } from 'dodopayments';
import { getAdminDb, getAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    // 1. Authenticate & Verify Workspace Ownership
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Internal Server Error: Database not initialized' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const wsRef = adminDb.doc(`workspaces/${workspaceId}`);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    const wsData = wsSnap.data();
    if (wsData?.ownerId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden: You do not own this workspace' }, { status: 403 });
    }

    // Retrieve Dodo subscriptionId from Firestore
    const subRef = adminDb.doc(`workspaces/${workspaceId}/billing/subscription`);
    const subSnap = await subRef.get();
    if (!subSnap.exists) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    const subData = subSnap.data();
    const subscriptionId = subData?.subscriptionId;

    // Helper function to update local state in Firestore
    const updateLocalState = async () => {
      await subRef.set({
        cancelAtPeriodEnd: true,
        autoRenew: false,
        status: 'cancelled',
        updatedAt: new Date()
      }, { merge: true });
    };

    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active Dodo Payments subscription found' }, { status: 400 });
    }

    // 2. Audit Environment Variables at Runtime
    const secretKey = process.env.DODO_SECRET_KEY;
    if (!secretKey) {
      console.error('[Billing Configuration Error] Missing environment variable: DODO_SECRET_KEY');
      return NextResponse.json({
        error: 'Configuration Error: Missing environment variable: DODO_SECRET_KEY'
      }, { status: 500 });
    }

    const isSandbox = process.env.NEXT_PUBLIC_DODO_PUBLISHABLE_KEY?.startsWith('pk_snd_') ||
                      (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_DODO_PUBLISHABLE_KEY?.startsWith('pk_lve_'));

    try {
      const dodo = new DodoPayments({
        bearerToken: secretKey,
        environment: isSandbox ? 'test_mode' : 'live_mode'
      });

      // Dodo Payments cancellation API uses PATCH /update to set cancel_at_next_billing_date to true
      await dodo.subscriptions.update(subscriptionId, {
        cancel_at_next_billing_date: true
      });

      await updateLocalState();

      return NextResponse.json({ success: true, message: 'Subscription successfully cancelled' });
    } catch (dodoError: any) {
      console.error('Dodo cancellation error:', dodoError);
      return NextResponse.json({
        error: dodoError.message || dodoError.error || 'Failed to cancel subscription on payment service'
      }, { status: dodoError.status || 500 });
    }
  } catch (error: any) {
    console.error('Global subscription cancel API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
