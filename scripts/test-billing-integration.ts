import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 1. Load env dynamically
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error(`Env file not found at: ${envPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  });
}
loadEnv();

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { POST as handleWebhook } from '../app/api/webhooks/dodo/route';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

function generateSignature(id: string, timestamp: string, body: string, secretKey: string): string {
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
  const signedPayload = `${id}.${timestamp}.${body}`;
  const signatureHash = crypto
    .createHmac('sha256', secretBuffer)
    .update(signedPayload)
    .digest('base64');
  return `v1,${signatureHash}`;
}

async function runIntegrationTests() {
  console.log('=== STARTING DODO PAYMENTS BILLING INTEGRATION TESTS ===\n');

  const db = getFirestore();
  const testWorkspaceId = 'billing_integration_test_ws';
  const testSecretKey = process.env.DODO_WEBHOOK_SECRET || process.env.DODO_SECRET_KEY || 'whsec_d0d0t3stK3yB4s364St1llW0rk1ng==';

  // 1. Cleanup
  console.log('Cleaning up existing documents...');
  try {
    await db.doc(`workspaces/${testWorkspaceId}/billing/subscription`).delete();
    const histSnap = await db.collection(`workspaces/${testWorkspaceId}/billing/history/records`).get();
    for (const d of histSnap.docs) {
      await d.ref.delete();
    }
    const eventsSnap = await db.collection(`workspaces/${testWorkspaceId}/webhookEvents`).get();
    for (const d of eventsSnap.docs) {
      await d.ref.delete();
    }
    console.log('Cleanup completed.\n');
  } catch (e) {
    console.warn('Cleanup warning:', e);
  }

  // 2. Test: Subscription Created Webhook Event
  console.log('TEST 1: Simulating "subscription.created" webhook event...');
  const eventId1 = `evt_test_${Math.random().toString(36).substring(2, 10)}`;
  const timestamp1 = `${Math.floor(Date.now() / 1000)}`;
  const payload1 = {
    type: 'subscription.created',
    data: {
      subscription_id: 'sub_dodo_12345',
      customer_id: 'cus_dodo_99999',
      status: 'active',
      cancel_at_next_billing_date: false,
      product_id: process.env.DODO_MONTHLY_PRODUCT_ID || 'pdt_monthly_default',
      created_at: new Date().toISOString(),
      previous_billing_date: null,
      next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        workspaceId: testWorkspaceId,
        planId: 'monthly'
      },
      customer: {
        customer_id: 'cus_dodo_99999'
      }
    }
  };

  const body1 = JSON.stringify(payload1);
  const signature1 = generateSignature(eventId1, timestamp1, body1, testSecretKey);

  const req1 = new Request('https://dudo.site/api/webhooks/dodo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': eventId1,
      'webhook-timestamp': timestamp1,
      'webhook-signature': signature1
    },
    body: body1
  });

  const res1 = await handleWebhook(req1);
  const data1 = await res1.json();
  console.log('Webhook Response status:', res1.status, 'Body:', data1);

  if (res1.status !== 200 || !data1.success) {
    throw new Error('Subscription creation webhook failed');
  }

  // Verify Firestore Subscription State
  const subSnap1 = await db.doc(`workspaces/${testWorkspaceId}/billing/subscription`).get();
  if (!subSnap1.exists) {
    throw new Error('Subscription document was not created in Firestore');
  }
  const subData1 = subSnap1.data()!;
  console.log('Firestore Subscription Data:', subData1);
  if (
    subData1.planId !== 'monthly' ||
    subData1.status !== 'active' ||
    subData1.subscriptionId !== 'sub_dodo_12345' ||
    subData1.customerId !== 'cus_dodo_99999'
  ) {
    throw new Error('Firestore subscription synchronization field mismatch');
  }
  console.log('-> TEST 1 PASSED: Subscription synchronized successfully.\n');

  // 3. Test: Webhook Idempotency (processing duplicate event ID)
  console.log('TEST 2: Testing Webhook Idempotency (repeating Event 1)...');
  const req2 = new Request('https://dudo.site/api/webhooks/dodo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': eventId1,
      'webhook-timestamp': timestamp1,
      'webhook-signature': signature1
    },
    body: body1
  });

  const res2 = await handleWebhook(req2);
  const data2 = await res2.json();
  console.log('Webhook Response:', data2);
  if (res2.status !== 200 || data2.message !== 'Event already processed') {
    throw new Error('Idempotency check failed: duplicate webhook was not ignored');
  }
  console.log('-> TEST 2 PASSED: Duplicate webhook event correctly ignored.\n');

  // 4. Test: Payment Succeeded Webhook Event (Creating Invoice record)
  console.log('TEST 3: Simulating "payment.succeeded" webhook event...');
  const eventId3 = `evt_test_${Math.random().toString(36).substring(2, 10)}`;
  const timestamp3 = `${Math.floor(Date.now() / 1000)}`;
  const payload3 = {
    type: 'payment.succeeded',
    data: {
      amount: 99900, // INR cents representation
      invoice_url: 'https://test.dodopayments.com/invoices/inv_abc123.pdf',
      created_at: new Date().toISOString(),
      payment_method: {
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242'
        }
      },
      metadata: {
        workspaceId: testWorkspaceId,
        planId: 'monthly'
      }
    }
  };

  const body3 = JSON.stringify(payload3);
  const signature3 = generateSignature(eventId3, timestamp3, body3, testSecretKey);

  const req3 = new Request('https://dudo.site/api/webhooks/dodo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': eventId3,
      'webhook-timestamp': timestamp3,
      'webhook-signature': signature3
    },
    body: body3
  });

  const res3 = await handleWebhook(req3);
  const data3 = await res3.json();
  console.log('Webhook Response:', data3);
  if (res3.status !== 200 || !data3.success) {
    throw new Error('Payment succeeded webhook failed');
  }

  // Verify Invoice Record in Firestore Billing History
  const historySnap = await db.collection(`workspaces/${testWorkspaceId}/billing/history/records`).get();
  if (historySnap.empty) {
    throw new Error('No invoice records created in billing/history/records');
  }
  const invoice = historySnap.docs[0].data();
  console.log('Firestore Invoice Record:', invoice);
  if (
    invoice.amount !== 999 ||
    invoice.planName !== 'Monthly Plan' ||
    invoice.status !== 'paid' ||
    invoice.invoiceUrl !== 'https://test.dodopayments.com/invoices/inv_abc123.pdf' ||
    invoice.paymentMethod.card.last4 !== '4242'
  ) {
    throw new Error('Invoice billing history details mismatch');
  }
  console.log('-> TEST 3 PASSED: Payment succeeded synced and invoice record created.\n');

  // 5. Test: Webhook Signature Verification Rejection (Incorrect Signature)
  console.log('TEST 4: Simulating webhook event with invalid signature...');
  const eventId4 = `evt_test_${Math.random().toString(36).substring(2, 10)}`;
  const timestamp4 = `${Math.floor(Date.now() / 1000)}`;
  const req4 = new Request('https://dudo.site/api/webhooks/dodo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': eventId4,
      'webhook-timestamp': timestamp4,
      'webhook-signature': 'v1,invalidhashhere'
    },
    body: body3
  });

  const res4 = await handleWebhook(req4);
  console.log('Webhook Response status (expected 401):', res4.status);
  if (res4.status !== 401) {
    throw new Error('Security flaw: Webhook endpoint accepted an invalid signature');
  }
  console.log('-> TEST 4 PASSED: Invalid signature successfully rejected.\n');

  console.log('=== ALL DODO PAYMENTS BILLING INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
}

runIntegrationTests().catch(err => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
