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

    // Retrieve Dodo customerId from Firestore
    const subRef = adminDb.doc(`workspaces/${workspaceId}/billing/subscription`);
    const subSnap = await subRef.get();
    const subData = subSnap.exists ? subSnap.data() : null;
    const customerId = subData?.customerId;

    if (!customerId) {
      return NextResponse.json({ error: 'No active customer ID found for this workspace' }, { status: 400 });
    }

    // 2. Audit Environment Variables at Runtime
    const secretKey = process.env.DODO_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dudo.site';

    if (!secretKey) {
      console.error('[Billing Configuration Error] Missing environment variable: DODO_SECRET_KEY');
      return NextResponse.json({
        error: 'Configuration Error: Missing environment variable: DODO_SECRET_KEY'
      }, { status: 500 });
    }

    try {
      const dodo = new DodoPayments({
        bearerToken: secretKey,
        environment: process.env.NODE_ENV === 'production' ? 'live_mode' : 'test_mode'
      });

      const session = await dodo.customers.customerPortal.create(customerId, {
        return_url: `${appUrl}/dashboard/billing`
      });

      return NextResponse.json({ portalUrl: session.link });
    } catch (dodoError: any) {
      console.error('Dodo portal session creation error:', dodoError);
      return NextResponse.json({
        error: dodoError.message || dodoError.error || 'Failed to create customer portal session'
      }, { status: dodoError.status || 500 });
    }
  } catch (error: any) {
    console.error('Global customer portal API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
