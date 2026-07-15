/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { normalizePlanId, PLAN_META, PLAN_LIMITS } from '@/lib/subscription/config';

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
      eventType === 'subscription.resumed' ||
      eventType === 'subscription.expired'
    ) {
      // Sync subscription state to Firestore
      const rawPlanId = eventData.metadata?.planId || (eventData.product_id === process.env.DODO_SIX_MONTH_PRODUCT_ID ? 'six_month' : 'monthly');
      const plan = normalizePlanId(rawPlanId);
      const meta = PLAN_META[plan];
      const limits = PLAN_LIMITS[plan];

      const currentPeriodStart = parseDate(eventData.previous_billing_date) || parseDate(eventData.created_at) || new Date();
      const currentPeriodEnd = parseDate(eventData.next_billing_date) || new Date(Date.now() + limits.durationMs);

      const statusMap: Record<string, string> = {
        active: 'active',
        cancelled: 'cancelled',
        paused: 'paused',
        expired: 'expired',
        on_hold: 'expired'
      };

      const status = statusMap[eventData.status] || eventData.status || 'active';

      const syncPayload = {
        plan,
        planId: plan,
        planName: meta.name,
        status,
        startedAt: currentPeriodStart,
        expiresAt: currentPeriodEnd,
        provider: 'dodo',
        subscriptionId: eventData.subscription_id || '',
        checkoutId: eventData.checkout_id || existingSub?.checkoutId || '',
        productId: eventData.product_id || '',
        paymentId: eventData.payment_id || existingSub?.paymentId || '',
        customerId: eventData.customer?.customer_id || existingSub?.customerId || '',
        renewalDate: currentPeriodEnd,
        cancelAtPeriodEnd: !!eventData.cancel_at_next_billing_date,
        conversationCount: existingSub?.conversationCount || 0,
        updatedAt: FieldValue.serverTimestamp(),
        // Legacy compat fields
        billingCycle: meta.billingCycle,
        price: meta.price,
        currency: meta.currency,
        conversationLimit: limits.conversationLimit,
        // Keep these for billing page compat
        startDate: currentPeriodStart,
        expiryDate: currentPeriodEnd,
        nextBillingDate: currentPeriodEnd,
        autoRenew: !eventData.cancel_at_next_billing_date
      };

      // Set completely (no merge) to prevent partial subscription updates
      await subRef.set(syncPayload);
      console.info(`Synced subscription state for workspace ${workspaceId}: plan=${plan}, status=${status}`);
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
      
      // Update payment status on subscription doc without partial updates
      if (existingSub) {
        await subRef.set({
          ...existingSub,
          paymentStatus: 'succeeded',
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        await subRef.set({
          paymentStatus: 'succeeded',
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      console.info(`Recorded successful payment history for workspace ${workspaceId}: amount=${amount}`);
    } else if (eventType === 'payment.failed') {
      // Handle payment failure updates without partial updates
      if (existingSub) {
        await subRef.set({
          ...existingSub,
          paymentStatus: 'failed',
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        await subRef.set({
          paymentStatus: 'failed',
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

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
