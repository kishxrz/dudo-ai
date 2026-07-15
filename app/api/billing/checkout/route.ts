/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { DodoPayments } from 'dodopayments';
import { getAdminDb, getAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { workspaceId, planId } = await req.json();

    if (!workspaceId || !planId) {
      return NextResponse.json({ error: 'Missing workspaceId or planId' }, { status: 400 });
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

    const userEmail = decodedToken.email || '';
    const userName = decodedToken.name || userEmail.split('@')[0] || 'User';

    // 2. Audit Environment Variables at Runtime
    const secretKey = process.env.DODO_SECRET_KEY;
    const monthlyId = process.env.DODO_MONTHLY_PRODUCT_ID;
    const sixMonthId = process.env.DODO_SIX_MONTH_PRODUCT_ID;

    const missingVars: string[] = [];
    if (!secretKey) missingVars.push('DODO_SECRET_KEY');
    if (!monthlyId) missingVars.push('DODO_MONTHLY_PRODUCT_ID');
    if (!sixMonthId) missingVars.push('DODO_SIX_MONTH_PRODUCT_ID');

    if (missingVars.length > 0) {
      console.error(`[Billing Configuration Error] Missing environment variables: ${missingVars.join(', ')}`);
      return NextResponse.json({
        error: `Configuration Error: Missing environment variables: ${missingVars.join(', ')}`
      }, { status: 500 });
    }

    // Resolve Product ID
    let productId = '';
    if (planId === 'monthly') {
      productId = monthlyId as string;
    } else if (planId === '6months') {
      productId = sixMonthId as string;
    } else {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dudo.site';

    const isSandbox = process.env.NEXT_PUBLIC_DODO_PUBLISHABLE_KEY?.startsWith('pk_snd_') || 
                      secretKey?.startsWith('s4k') ||
                      secretKey?.startsWith('sk_test');

    try {
      const dodo = new DodoPayments({
        bearerToken: secretKey as string,
        environment: isSandbox ? 'test_mode' : 'live_mode'
      });

      const session = await dodo.checkoutSessions.create({
        product_cart: [{
          product_id: productId,
          quantity: 1
        }],
        customer: {
          email: userEmail,
          name: userName
        },
        return_url: `${appUrl}/dashboard/billing?status=success&session_id={checkout_session_id}`,
        metadata: {
          workspaceId,
          planId
        }
      });

      console.log('Dodo checkout session response:', JSON.stringify(session, null, 2));

      return NextResponse.json({ checkoutUrl: session.checkout_url });
    } catch (dodoError: any) {
      console.error('Dodo checkout creation error:', dodoError);
      return NextResponse.json({
        error: dodoError.message || dodoError.error || 'Failed to create checkout session'
      }, { status: dodoError.status || 500 });
    }
  } catch (error: any) {
    console.error('Global checkout API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
