import fs from 'fs';
import path from 'path';

// 1. LOAD ENV DYNAMICALLY BEFORE OTHER IMPORTS
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

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

import {
  getOrInitSubscription,
  getPlanLimits,
  canUseFeature,
  checkUsageLimit,
  incrementConversationUsage,
  upgradeSubscription
} from '../lib/billing-entitlements-server';

async function runBillingTests() {
  console.log('=== STARTING BILLING & ENTITLEMENTS VERIFICATION ===\n');

  const testWorkspaceId = 'billing_test_workspace_id_999';
  const db = getFirestore();

  // Clean up any existing billing subcollections/docs for test workspace
  try {
    await db.doc(`workspaces/${testWorkspaceId}/billing/subscription`).delete();
    await db.doc(`workspaces/${testWorkspaceId}/billing/usage`).delete();
  } catch (e) {}

  console.log('1. Checking getOrInitSubscription (should initialize Free Trial)...');
  const sub = await getOrInitSubscription(testWorkspaceId);
  if (sub.planId !== 'trial') {
    throw new Error('Default plan should be "trial"');
  }
  console.log('  -> Default trial initialized successfully:', sub.planName);

  console.log('\n2. Testing getPlanLimits for Trial...');
  const trialLimits = await getPlanLimits(testWorkspaceId);
  if (!trialLimits.allowedChannels.includes('telegram') || trialLimits.allowedChannels.includes('whatsapp')) {
    throw new Error('Trial plan should only allow telegram, not whatsapp');
  }
  if (trialLimits.bookingAccess !== false) {
    throw new Error('Trial plan should not have booking/calendar access');
  }
  if (!trialLimits.apiProviders.includes('groq') && trialLimits.apiProviders.includes('openai')) {
    console.log('  -> Trial features are correctly restricted (groq is blocked, openai is allowed)');
  } else {
    throw new Error('Trial api providers configuration incorrect');
  }

  console.log('\n3. Testing canUseFeature...');
  const canUseTelegram = await canUseFeature(testWorkspaceId, 'channels.telegram');
  const canUseWhatsapp = await canUseFeature(testWorkspaceId, 'channels.whatsapp');
  const canUseBooking = await canUseFeature(testWorkspaceId, 'booking');

  console.log('  -> canUseTelegram:', canUseTelegram);
  console.log('  -> canUseWhatsapp:', canUseWhatsapp);
  console.log('  -> canUseBooking:', canUseBooking);

  if (!canUseTelegram || canUseWhatsapp || canUseBooking) {
    throw new Error('Entitlements validation failed for trial');
  }

  console.log('\n4. Testing conversation limits and incrementing usage...');
  let hasUsage = await checkUsageLimit(testWorkspaceId, 'conversations');
  console.log('  -> Initially can conversation count increase:', hasUsage);
  if (!hasUsage) throw new Error('Trial should initially have available usage');

  // Increment usage to exceed limits (limit is 5)
  for (let i = 0; i < 5; i++) {
    await incrementConversationUsage(testWorkspaceId);
  }

  hasUsage = await checkUsageLimit(testWorkspaceId, 'conversations');
  console.log('  -> After 5 conversations, can conversation count increase:', hasUsage);
  if (hasUsage) {
    throw new Error('Trial usage should be blocked after 5 messages');
  }
  console.log('  -> Success: Usage limits successfully blocked further messages.');

  console.log('\n5. Upgrading workspace to monthly plan...');
  await upgradeSubscription(testWorkspaceId, 'monthly');
  const upgradedSub = await getOrInitSubscription(testWorkspaceId);
  if (upgradedSub.planId !== 'monthly') {
    throw new Error('Plan upgrade to monthly failed');
  }
  console.log('  -> Upgraded successfully to:', upgradedSub.planName);

  const canUseWhatsappNow = await canUseFeature(testWorkspaceId, 'channels.whatsapp');
  const canUseBookingNow = await canUseFeature(testWorkspaceId, 'booking');
  console.log('  -> Post-upgrade canUseWhatsapp:', canUseWhatsappNow);
  console.log('  -> Post-upgrade canUseBooking:', canUseBookingNow);

  if (!canUseWhatsappNow || !canUseBookingNow) {
    throw new Error('Entitlements did not update after plan upgrade');
  }

  console.log('\n6. Checking usage limit check on monthly plan...');
  const monthlyUsageAllowed = await checkUsageLimit(testWorkspaceId, 'conversations');
  console.log('  -> Monthly plan usage allowed (used 5 out of 100):', monthlyUsageAllowed);
  if (!monthlyUsageAllowed) {
    throw new Error('Monthly plan should allow conversations as limit is 100');
  }

  console.log('\n7. Testing expired subscription status...');
  // Force expire subscription doc
  const expiredDate = new Date(Date.now() - 1000);
  await db.doc(`workspaces/${testWorkspaceId}/billing/subscription`).update({
    expiryDate: expiredDate,
    status: 'active' // trigger auto-expiry detection
  });

  const expiredSub = await getOrInitSubscription(testWorkspaceId);
  if (expiredSub.status !== 'expired') {
    throw new Error('Expiry date did not trigger automatic expired status updates');
  }
  console.log('  -> Successfully detected expiration automatically:', expiredSub.status);

  const expiredLimits = await getPlanLimits(testWorkspaceId);
  if (expiredLimits.maxEnabledSkills !== 0 || expiredLimits.allowedChannels.length !== 0) {
    throw new Error('Expired subscription should return zero/empty limits');
  }
  console.log('  -> Confirmed expired plan drops limits to zero');

  // Clean up
  await db.doc(`workspaces/${testWorkspaceId}/billing/subscription`).delete();
  await db.doc(`workspaces/${testWorkspaceId}/billing/usage`).delete();

  console.log('\n=== ALL BILLING ENTITLEMENT TESTS PASSED SUCCESSFULLY! ===');
}

runBillingTests().catch(err => {
  console.error('\nBilling verification failed:', err);
  process.exit(1);
});
