import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    const planId = searchParams.get('planId');

    if (!workspaceId || !planId) {
      return NextResponse.json({ error: 'Missing workspaceId or planId' }, { status: 400 });
    }

    // Double check that mock mode is allowed
    const isDev = process.env.NODE_ENV === 'development';
    const isMockEnabled = process.env.ENABLE_DODO_MOCK === 'true';
    if (!isDev && !isMockEnabled) {
      return NextResponse.json({ error: 'Mock checkout not allowed in production' }, { status: 403 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const startDate = new Date();
    const expiryDate = new Date();
    let planName = '';
    let price = 0;
    let conversationLimit = 0;

    if (planId === 'monthly') {
      expiryDate.setDate(startDate.getDate() + 30);
      planName = 'Monthly Plan';
      price = 999;
      conversationLimit = 100;
    } else if (planId === '6months') {
      expiryDate.setMonth(startDate.getMonth() + 6);
      planName = '6-Month Pack';
      price = 2499;
      conversationLimit = 1000;
    } else {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
    }

    const mockSubId = `sub_mock_${Math.random().toString(36).substring(2, 10)}`;

    const payload = {
      planId,
      planName,
      price,
      currency: '₹',
      billingCycle: planId,
      status: 'active',
      startDate,
      expiryDate,
      nextBillingDate: expiryDate,
      autoRenew: true,
      conversationLimit,
      campaignLimit: 0,
      // Dodo Payments Sync fields
      customerId: 'cus_mock_user',
      subscriptionId: mockSubId,
      plan: planId,
      currentPeriodStart: startDate,
      currentPeriodEnd: expiryDate,
      cancelAtPeriodEnd: false,
      paymentStatus: 'succeeded',
      createdAt: startDate,
      updatedAt: startDate
    };

    await adminDb.doc(`workspaces/${workspaceId}/billing/subscription`).set(payload, { merge: true });

    // Add mock billing history record
    const randId = Math.random().toString(36).substring(2, 15);
    await adminDb.doc(`workspaces/${workspaceId}/billing/history/records/${randId}`).set({
      date: startDate,
      planName,
      amount: price,
      currency: '₹',
      status: 'paid',
      invoiceUrl: 'https://docs.dodopayments.com/mock-invoice.pdf'
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dudo.site';
    return NextResponse.redirect(`${appUrl}/dashboard/billing?status=success&session_id=${mockSubId}`);
  } catch (error: any) {
    console.error('Mock checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
