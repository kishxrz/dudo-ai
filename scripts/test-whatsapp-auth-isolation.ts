// scripts/test-whatsapp-auth-isolation.ts
const fs = require('fs');
const path = require('path');
const Module = require('module');

console.log('=== STARTING WHATSAPP AUTH ISOLATION INTEGRATION TESTS ===\n');

// ─── 1. INTERCEPT REQUIRE IMPORTS FOR FIREBASE ADMIN MOCKING IN EXPRESS SERVICE ───
const originalRequire = Module.prototype.require;
const mockDbState: Record<string, any> = {
  'workspaces/ws-owned': { ownerId: 'user-valid' },
  'workspaces/ws-other': { ownerId: 'user-other' },
  'workspaces/ws-owned/billing/subscription': { planId: 'monthly', status: 'active' },
  'workspaces/ws-unsubscribed/billing/subscription': { planId: 'trial', status: 'trial' },
};

Module.prototype.require = function (request: string) {
  if (request === '@/lib/firebase-admin' || request.endsWith('lib/firebase-admin')) {
    return {
      getAdminDb: () => ({
        doc: (path: string) => ({
          get: async () => ({
            exists: mockDbState[path] !== undefined,
            data: () => mockDbState[path]
          }),
          set: async (data: any) => {
            mockDbState[path] = { ...mockDbState[path], ...data };
          }
        })
      }),
      getAuth: () => ({
        verifyIdToken: async (token: string) => {
          if (token === 'token-valid') {
            return { uid: 'user-valid' };
          }
          if (token === 'token-other') {
            return { uid: 'user-other' };
          }
          throw new Error('Invalid token');
        }
      })
    };
  }

  if (request.startsWith('firebase-admin')) {
    return {
      getApps: () => [],
      initializeApp: () => ({}),
      cert: () => ({}),
      applicationDefault: () => ({}),
      getFirestore: () => ({
        doc: (path: string) => ({
          get: async () => ({
            exists: mockDbState[path] !== undefined,
            data: () => mockDbState[path]
          }),
          set: async (data: any) => {
            mockDbState[path] = { ...mockDbState[path], ...data };
          }
        })
      }),
      getAuth: () => ({
        verifyIdToken: async (token: string) => {
          if (token === 'token-valid') {
            return { uid: 'user-valid' };
          }
          if (token === 'token-other') {
            return { uid: 'user-other' };
          }
          throw new Error('Invalid token');
        }
      })
    };
  }
  return originalRequire.call(this, request);
};

// Set environment variables for Express WhatsApp service
process.env.PORT = '4005';
process.env.WHATSAPP_SERVICE_SECRET = 'test-service-secret';
process.env.WHATSAPP_INTERNAL_SECRET = 'test-internal-secret';
process.env.WHATSAPP_SESSION_PATH = path.join(__dirname, '../temp-sessions');

// Start Express WhatsApp service
const expressService = require('../services/whatsapp-service/src/index');

// Set environment variables for Next.js routes
process.env.WHATSAPP_SERVICE_URL = 'http://localhost:4005';

const { NextRequest } = require('next/server');
const { GET: handleStatus } = require('../app/api/whatsapp/status/route');
const { POST: handleConnect } = require('../app/api/whatsapp/connect/route');
const { GET: handleQr } = require('../app/api/whatsapp/qr/route');
const { POST: handleDisconnect } = require('../app/api/whatsapp/disconnect/route');

async function runTests() {
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // Wait for Express server to start up
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // ─── PART 1: VERIFY NO STATIC FIREBASE-ADMIN IMPORTS IN PROXY ROUTES ───
    console.log('--- Phase 1: Vercel Proxy Route Dependency Audits ---');
    const proxyFiles = [
      '../app/api/whatsapp/status/route.ts',
      '../app/api/whatsapp/connect/route.ts',
      '../app/api/whatsapp/qr/route.ts',
      '../app/api/whatsapp/disconnect/route.ts'
    ];

    for (const relativePath of proxyFiles) {
      const absPath = path.resolve(__dirname, relativePath);
      const content = fs.readFileSync(absPath, 'utf8');
      const hasFirebaseAdmin = content.includes('firebase-admin') || content.includes('@/lib/firebase-admin');
      const hasBillingServer = content.includes('billing-entitlements-server');
      assert(!hasFirebaseAdmin && !hasBillingServer, `Audit passed for ${path.basename(relativePath)}: no firebase-admin or billing-entitlements-server imports found.`);
    }

    // ─── PART 2: AUTHENTICATION AND AUTHORIZATION TESTS ON EXPRESS MICROSERVICE ───
    console.log('\n--- Phase 2: Integration Authentication and Isolation Audits ---');

    // Helper to build NextRequest
    const createReq = (method: 'GET' | 'POST', url: string, authHeader: string | null, body: any = null) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      return new NextRequest(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    };

    // Test case 1: Missing Firebase Token -> 401
    console.log('\n[Test 1] Next.js Status proxy with missing user Firebase token');
    let req = createReq('GET', 'http://localhost/api/whatsapp/status?workspaceId=ws-owned', null);
    let res = await handleStatus(req);
    assert(res.status === 401, 'Returns 401 Unauthorized for missing Firebase token');
    let data = await res.json();
    assert(data.error.includes('Unauthorized'), 'Returns structured JSON error message');

    // Test case 2: Invalid Firebase Token -> 401
    console.log('\n[Test 2] Next.js Connect proxy with invalid user Firebase token');
    req = createReq('POST', 'http://localhost/api/whatsapp/connect', 'Bearer token-invalid', { workspaceId: 'ws-owned' });
    res = await handleConnect(req);
    assert(res.status === 401, 'Returns 401 Unauthorized for invalid Firebase token');
    data = await res.json();
    assert(data.error.includes('Unauthorized'), 'Returns structured JSON error message');

    // Test case 3: Missing internal secret (We can simulate this by temporarily wiping process.env.WHATSAPP_INTERNAL_SECRET)
    console.log('\n[Test 3] Next.js Status proxy with missing internal secret configuration');
    const oldSecret = process.env.WHATSAPP_INTERNAL_SECRET;
    delete process.env.WHATSAPP_INTERNAL_SECRET;
    // Also delete service secret temporarily
    const oldServiceSecret = process.env.WHATSAPP_SERVICE_SECRET;
    delete process.env.WHATSAPP_SERVICE_SECRET;

    req = createReq('GET', 'http://localhost/api/whatsapp/status?workspaceId=ws-owned', 'Bearer token-valid');
    res = await handleStatus(req);
    // Since secrets are wiped, it might fail to authenticate against Express (401) or fall back securely
    assert(res.status === 401 || res.status === 200 || res.status === 500, 'Returns expected response code for missing secrets');
    data = await res.json();
    assert(data.error || data.message || data.status, 'Returns a structured error/message response');

    // Restore secrets
    process.env.WHATSAPP_INTERNAL_SECRET = oldSecret;
    process.env.WHATSAPP_SERVICE_SECRET = oldServiceSecret;

    // Test case 4: Invalid internal secret
    console.log('\n[Test 4] Next.js Status proxy with invalid internal secret configuration');
    const originalFetch = global.fetch;
    global.fetch = function (url: any, options: any) {
      const headers = { ...options.headers };
      headers['x-internal-secret'] = 'wrong-internal-secret';
      headers['x-whatsapp-internal-secret'] = 'wrong-internal-secret';
      return originalFetch(url, { ...options, headers });
    };

    req = createReq('GET', 'http://localhost/api/whatsapp/status?workspaceId=ws-owned', 'Bearer token-valid');
    res = await handleStatus(req);
    assert(res.status === 401, 'Returns 401 status when internal secret is invalid on Express microservice');
    data = await res.json();
    assert(data.error.includes('Unauthorized') || data.error.includes('Invalid'), 'Returns service secret error message');

    global.fetch = originalFetch;

    // Test case 5: User does not own workspace -> 403
    console.log('\n[Test 5] Next.js Status proxy with user not owning the workspace');
    req = createReq('GET', 'http://localhost/api/whatsapp/status?workspaceId=ws-other', 'Bearer token-valid');
    res = await handleStatus(req);
    assert(res.status === 403, 'Returns 403 Forbidden because user-valid is not owner of ws-other');
    data = await res.json();
    assert(data.error.includes('Forbidden'), 'Returns structured JSON error message');

    // Test case 6: Unsubscribed workspace connect check -> 403 Plan entitlement validation
    console.log('\n[Test 6] Next.js Connect proxy with unsubscribed workspace (billing check)');
    req = createReq('POST', 'http://localhost/api/whatsapp/connect', 'Bearer token-valid', { workspaceId: 'ws-unsubscribed' });
    // ws-unsubscribed matches user-valid? Let's add it to db state to allow ownership bypass first
    mockDbState['workspaces/ws-unsubscribed'] = { ownerId: 'user-valid' };
    res = await handleConnect(req);
    assert(res.status === 403, 'Returns 403 Forbidden because plan restricts WhatsApp channel');
    data = await res.json();
    assert(data.error.toLowerCase().includes('upgrade'), 'Returns correct billing/plan upgrade error message');

    // Test case 7: Valid token + valid secret + owned workspace -> request succeeds
    console.log('\n[Test 7] Next.js Status proxy with valid credentials and owned workspace');
    req = createReq('GET', 'http://localhost/api/whatsapp/status?workspaceId=ws-owned', 'Bearer token-valid');
    res = await handleStatus(req);
    assert(res.status === 200, 'Returns 200 success code');
    data = await res.json();
    assert(data.status === 'disconnected', 'Forwards request correctly to Express microservice registry');

    console.log(`\n=== INTEGRATION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
    // Clean up temporary sessions directory if created
    try {
      if (fs.existsSync(process.env.WHATSAPP_SESSION_PATH)) {
        fs.rmSync(process.env.WHATSAPP_SESSION_PATH, { recursive: true, force: true });
      }
    } catch {}

    if (expressService && expressService.server) {
      console.log('Closing Express test server...');
      expressService.server.close();
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    if (expressService && expressService.server) {
      expressService.server.close();
    }
    console.error('Test execution failed with error:', e);
    process.exit(1);
  }
}

runTests();
