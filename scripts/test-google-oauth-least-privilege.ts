import { getGoogleClient } from '../lib/google-client';
import { GET as handleAuth } from '../app/api/integrations/google/auth/route';
import { GET as handleCallback } from '../app/api/integrations/google/callback/route';
import { POST as handleDisconnect } from '../app/api/integrations/google/disconnect/route';
import { GET as handleStatus } from '../app/api/integrations/google/status/route';
import { NextRequest } from 'next/server';
import assert from 'assert';
import { getAdminDb } from '../lib/firebase-admin';

console.log('=== STARTING GOOGLE OAUTH LEAST PRIVILEGE INTEGRATION TESTS ===');

// Mock next/server response/redirect behaviors
function mockNextRequest(url: string, init?: any): NextRequest {
  return new NextRequest(url, init);
}

const testWorkspaceId = 'test-workspace-least-privilege-1';

// Seed active premium plan in test database
async function seedTestSubscription() {
  const adminDb = getAdminDb();
  if (adminDb) {
    // Create workspace first
    await adminDb.doc(`workspaces/${testWorkspaceId}`).set({
      id: testWorkspaceId,
      ownerId: testWorkspaceId,
      name: 'Least Privilege Test Workspace',
      plan: 'monthly',
      status: 'active'
    });
    
    // Create subscription
    await adminDb.doc(`workspaces/${testWorkspaceId}/billing/subscription`).set({
      plan: 'monthly',
      planId: 'monthly',
      planName: 'Monthly Plan',
      status: 'active',
      expiresAt: new Date(Date.now() + 1000 * 3600 * 24 * 30),
      currency: '₹',
      price: 999
    });
    console.log('🌱 Seeded active premium plan for test workspace');
  }
}

async function cleanupTestSubscription() {
  const adminDb = getAdminDb();
  if (adminDb) {
    await adminDb.doc(`workspaces/${testWorkspaceId}/billing/subscription`).delete();
    await adminDb.doc(`workspaces/${testWorkspaceId}`).delete();
    console.log('🧹 Cleaned up test database records');
  }
}

// ─── Test 1: Scope Parsing and Filtering in Auth Route ────────────────
async function testAuthScopes() {
  console.log('Test 1: Verifying dynamic scopes in Auth URL generation...');
  
  // Test with 'gmail' scope
  const reqGmail = mockNextRequest(`https://dudo.site/api/integrations/google/auth?workspaceId=${testWorkspaceId}&scope=gmail`);
  const resGmail = await handleAuth(reqGmail);
  assert(resGmail.status === 307 || resGmail.status === 302, 'Redirects to Google');
  const redirectUrlGmail = resGmail.headers.get('location') || '';
  
  // Verify it contains gmail but NOT calendar
  const decodedGmail = decodeURIComponent(redirectUrlGmail);
  console.log('decodedGmail:', decodedGmail);
  assert(decodedGmail.includes('gmail.modify'), 'Must contain gmail modify scope');
  assert(!decodedGmail.includes('googleapis.com/auth/calendar'), 'Must NOT contain calendar scope');
  assert(decodedGmail.includes('include_granted_scopes=true'), 'Must include include_granted_scopes parameter');
  
  // Test with 'calendar' scope
  const reqCalendar = mockNextRequest(`https://dudo.site/api/integrations/google/auth?workspaceId=${testWorkspaceId}&scope=calendar`);
  const resCalendar = await handleAuth(reqCalendar);
  const redirectUrlCalendar = resCalendar.headers.get('location') || '';
  const decodedCalendar = decodeURIComponent(redirectUrlCalendar);
  console.log('decodedCalendar:', decodedCalendar);
  
  assert(decodedCalendar.includes('googleapis.com/auth/calendar'), 'Must contain calendar scope');
  assert(!decodedCalendar.includes('gmail.modify'), 'Must NOT contain gmail scope');
  
  console.log('✅ PASS: Dynamic scopes generated correctly for individual integrations');
}

// Run tests
async function runAllTests() {
  try {
    await seedTestSubscription();
    await testAuthScopes();
    await cleanupTestSubscription();
    console.log('=== ALL GOOGLE OAUTH LEAST PRIVILEGE TESTS COMPLETED SUCCESSFULLY ===');
  } catch (err: any) {
    await cleanupTestSubscription();
    console.error('❌ FAIL: Google OAuth least privilege tests failed:', err.message || err);
    process.exit(1);
  }
}

runAllTests();
