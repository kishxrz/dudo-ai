/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Verify webhook signature timing-safely
function verifyWebhookSignature(
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
  secretKey: string
): boolean {
  if (!id || !timestamp || !body || !signatureHeader || !secretKey) {
    return false;
  }

  // Strip 'whsec_' prefix if present (standard Svix/Dodo format)
  let cleanSecret = secretKey;
  if (cleanSecret.startsWith('whsec_')) {
    cleanSecret = cleanSecret.substring(6);
  }

  let secretBuffer: Buffer;
  try {
    secretBuffer = Buffer.from(cleanSecret, 'base64');
  } catch (e) {
    secretBuffer = Buffer.from(cleanSecret, 'utf-8');
  }

  // Construct signed payload: id.timestamp.body
  const signedPayload = `${id}.${timestamp}.${body}`;

  // Verify HMAC-SHA256 signatures in timing-safe way
  const signatures = signatureHeader.split(' ');
  for (const sig of signatures) {
    const parts = sig.split(',');
    if (parts.length !== 2) continue;
    const [version, signatureHash] = parts;
    if (version !== 'v1') continue;

    const expectedHash = crypto
      .createHmac('sha256', secretBuffer)
      .update(signedPayload)
      .digest('base64');

    try {
      if (crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(signatureHash))) {
        return true;
      }
    } catch (e) {
      // Buffer length mismatch or comparison error
    }
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const id = req.headers.get('webhook-id') || '';
    const timestamp = req.headers.get('webhook-timestamp') || '';
    const signatureHeader = req.headers.get('webhook-signature') || '';

    // Retrieve Webhook Secret from environment
    const secretKey = process.env.DODO_WEBHOOK_SECRET;

    if (!secretKey) {
      console.error('[Billing Configuration Error] Missing environment variable: DODO_WEBHOOK_SECRET');
      return NextResponse.json({
        error: 'Configuration Error: Missing environment variable: DODO_WEBHOOK_SECRET'
      }, { status: 500 });
    }

    // Verify signature timing-safely
    const isValid = verifyWebhookSignature(id, timestamp, rawBody, signatureHeader, secretKey);
    if (!isValid) {
      console.error('Invalid Dodo webhook signature');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    console.info('Received webhook event:', payload.type, 'ID:', id);

    // Extract workspaceId from metadata
    const workspaceId = payload.data?.metadata?.workspaceId;
    if (!workspaceId) {
      console.error('Workspace ID not found in event metadata:', payload);
      return NextResponse.json({ error: 'Workspace ID not found in metadata' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    // Idempotency: Use transaction to ensure unique event processing
    const eventDocRef = adminDb.doc(`workspaces/${workspaceId}/webhookEvents/${id}`);
    const isDuplicate = await adminDb.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(eventDocRef);
      if (docSnap.exists) {
        return true;
      }
      transaction.set(eventDocRef, {
        processedAt: FieldValue.serverTimestamp(),
        eventType: payload.type,
      });
      return false;
    });

    if (isDuplicate) {
      console.info(`Duplicate webhook event ignored: ${id}`);
      return NextResponse.json({ success: true, message: 'Event already processed' });
    }

    const eventType = payload.type;
    const eventData = payload.data;
    const subRef = adminDb.doc(`workspaces/${workspaceId}/billing/subscription`);
    const subSnap = await subRef.get();
    const existingSub = subSnap.exists ? subSnap.data() : null;

    const parseDate = (val: any) => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    if (
      eventType === 'subscription.created' ||
      eventType === 'subscription.active' ||
      eventType === 'subscription.renewed' ||
      eventType === 'subscription.cancelled' ||
      eventType === 'subscription.paused' ||
      eventType === 'subscription.resumed'
    ) {
      // Sync subscription state to Firestore
      const planId = eventData.metadata?.planId || (eventData.product_id === process.env.DODO_SIX_MONTH_PRODUCT_ID ? '6months' : 'monthly');
      const planName = planId === '6months' ? '6-Month Pack' : 'Monthly Plan';
      const conversationLimit = planId === '6months' ? 1000 : 100;
      const price = planId === '6months' ? 2499 : 999;

      const currentPeriodStart = parseDate(eventData.previous_billing_date) || parseDate(eventData.created_at) || new Date();
      const currentPeriodEnd = parseDate(eventData.next_billing_date) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const statusMap: Record<string, string> = {
        active: 'active',
        cancelled: 'cancelled',
        paused: 'paused',
        expired: 'expired',
        on_hold: 'expired'
      };

      const syncPayload = {
        planId,
        planName,
        price,
        currency: '₹',
        billingCycle: planId,
        status: statusMap[eventData.status] || eventData.status,
        startDate: currentPeriodStart,
        expiryDate: currentPeriodEnd,
        nextBillingDate: currentPeriodEnd,
        autoRenew: !eventData.cancel_at_next_billing_date,
        conversationLimit,
        campaignLimit: 0,
        // Dodo fields
        customerId: eventData.customer?.customer_id || existingSub?.customerId || '',
        subscriptionId: eventData.subscription_id,
        plan: planId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: !!eventData.cancel_at_next_billing_date,
        renewalDate: currentPeriodEnd,
        trialExpiry: existingSub?.trialExpiry || null,
        paymentStatus: eventData.status === 'active' ? 'succeeded' : 'pending',
        updatedAt: FieldValue.serverTimestamp()
      };

      await subRef.set(syncPayload, { merge: true });
      console.info(`Synced subscription state for workspace ${workspaceId}: plan=${planId}, status=${syncPayload.status}`);
    } else if (eventType === 'payment.succeeded') {
      // Handle invoice / billing history records
      const amount = typeof eventData.amount === 'number' ? eventData.amount / 100 : (eventData.metadata?.planId === '6months' ? 2499 : 999);
      const planName = eventData.metadata?.planId === '6months' ? '6-Month Pack' : 'Monthly Plan';
      
      const randId = Math.random().toString(36).substring(2, 15);
      const invoiceRecord = {
        date: parseDate(eventData.created_at) || new Date(),
        planName,
        amount,
        currency: '₹',
        status: 'paid',
        invoiceUrl: eventData.invoice_url || eventData.receipt_url || '',
        paymentMethod: eventData.payment_method || null
      };

      await adminDb.doc(`workspaces/${workspaceId}/billing/history/records/${randId}`).set(invoiceRecord);
      
      // Update payment status on subscription doc
      await subRef.set({
        paymentStatus: 'succeeded',
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      console.info(`Recorded successful payment history for workspace ${workspaceId}: amount=${amount}`);
    } else if (eventType === 'payment.failed') {
      // Handle payment failure updates
      await subRef.set({
        paymentStatus: 'failed',
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      // Optional: Add failed billing history record
      const randId = Math.random().toString(36).substring(2, 15);
      await adminDb.doc(`workspaces/${workspaceId}/billing/history/records/${randId}`).set({
        date: new Date(),
        planName: eventData.metadata?.planId === '6months' ? '6-Month Pack' : 'Monthly Plan',
        amount: eventData.metadata?.planId === '6months' ? 2499 : 999,
        currency: '₹',
        status: 'failed',
        invoiceUrl: ''
      });

      console.warn(`Payment failed event processed for workspace ${workspaceId}`);
    } else if (eventType === 'refund.created') {
      // Record refund in history
      const amount = typeof eventData.amount === 'number' ? -(eventData.amount / 100) : -999;
      
      const randId = Math.random().toString(36).substring(2, 15);
      await adminDb.doc(`workspaces/${workspaceId}/billing/history/records/${randId}`).set({
        date: parseDate(eventData.created_at) || new Date(),
        planName: 'Refund',
        amount,
        currency: '₹',
        status: 'refunded',
        invoiceUrl: ''
      });

      console.info(`Refund event processed for workspace ${workspaceId}: amount=${amount}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook endpoint global error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
