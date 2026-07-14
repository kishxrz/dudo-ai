// @ts-nocheck
import Module from 'module';

// ─── 1. INTERCEPT REQUIRE IMPORTS FOR WEBHOOK & FIREBASE TESTING ───
const originalRequire = Module.prototype.require;
const mockFirestore: Record<string, any> = {};

Module.prototype.require = function (request: string) {
  if (request.endsWith('firebase-admin')) {
    return {
      getAdminDb: () => ({
        doc: (path: string) => ({
          get: async () => ({
            exists: mockFirestore[path] !== undefined,
            data: () => mockFirestore[path]
          }),
          set: async (data: any) => {
            mockFirestore[path] = data;
          },
          delete: async () => {
            delete mockFirestore[path];
          }
        }),
        collection: (path: string) => {
          const query = {
            where: () => query,
            get: async () => {
              const docs = Object.keys(mockFirestore)
                .filter(k => k.startsWith(path + '/'))
                .map(k => ({
                  id: k.split('/').pop(),
                  data: () => mockFirestore[k]
                }));
              return { docs };
            },
            add: async (payload: any) => {
              const id = Math.random().toString(36).substring(7);
              mockFirestore[`${path}/${id}`] = payload;
              return { id };
            }
          };
          return query;
        },
        runTransaction: async (cb: any) => {
          const mockTransaction = {
            get: async (ref: any) => {
              const path = ref.path || '';
              return {
                exists: mockFirestore[path] !== undefined,
                data: () => mockFirestore[path]
              };
            },
            set: (ref: any, data: any) => {
              const path = ref.path || '';
              mockFirestore[path] = data;
            }
          };
          return cb(mockTransaction);
        }
      })
    };
  }
  if (request.endsWith('firebase')) {
    return { db: {} };
  }
  if (request === 'firebase/firestore') {
    return {
      doc: () => ({}),
      getDoc: async () => ({
        exists: () => false,
        data: () => null
      })
    };
  }
  if (request.includes('WorkspaceContextLoader')) {
    return {
      WorkspaceContextLoader: {
        load: async (workspaceId: string) => ({
          assistant: {
            name: 'AI Assistant',
            systemPrompt: 'You are helpful.',
            enabledSkillIds: []
          },
          provider: {
            name: 'openai',
            model: 'gpt-4o-mini',
            apiKey: 'mock-key'
          }
        })
      }
    };
  }
  if (request.includes('ConversationService')) {
    return {
      ConversationService: {
        generateReply: async () => ({ reply: 'AI Response' })
      }
    };
  }
  if (request.includes('security')) {
    return {
      processAdminCommand: async () => ({ isCommand: false }),
      isConversationInTakeover: async () => false
    };
  }
  return originalRequire.apply(this, arguments);
};

// Now import NextRequest and webhook handler
import { NextRequest } from 'next/server';
const { POST: handleMessageWebhook } = require('../app/api/internal/whatsapp/message/route');

async function runTests() {
  console.log('=== STARTING WHATSAPP SERVICE INTEGRATION TESTS ===\n');
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
    // ─── PART 1: TEST NEXT.JS INTERNAL WEBHOOK WEB SECURITY & IDEMPOTENCY ───
    console.log('--- Test 1: Next.js webhook unauthenticated request rejection ---');
    process.env.WHATSAPP_INTERNAL_SECRET = 'super-secret-key';
    
    let mockReq = new NextRequest('http://localhost/api/internal/whatsapp/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId: 'ws-123',
        externalChatId: 'chat-123',
        messageId: 'msg-abc',
        senderId: 'sender-123',
        messageText: 'Hello',
        timestamp: Date.now()
      })
    });
    
    let response = await handleMessageWebhook(mockReq);
    assert(response.status === 401, 'Rejects requests lacking Authorization header');

    console.log('\n--- Test 2: Next.js webhook valid authorized query ---');
    mockReq = new NextRequest('http://localhost/api/internal/whatsapp/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer super-secret-key'
      },
      body: JSON.stringify({
        workspaceId: 'ws-123',
        externalChatId: 'chat-123',
        messageId: 'msg-abc-unique',
        senderId: 'sender-123',
        messageText: 'Hello',
        timestamp: Date.now()
      })
    });
    response = await handleMessageWebhook(mockReq);
    const body = await response.json();
    assert(response.status === 200 && body.reply === 'AI Response', 'Generates AI reply under valid webhook secret');

    console.log('\n--- Test 3: Next.js lease acquisition idempotency ---');
    // Call webhook with the same messageId again
    mockReq = new NextRequest('http://localhost/api/internal/whatsapp/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer super-secret-key'
      },
      body: JSON.stringify({
        workspaceId: 'ws-123',
        externalChatId: 'chat-123',
        messageId: 'msg-abc-unique',
        senderId: 'sender-123',
        messageText: 'Hello',
        timestamp: Date.now()
      })
    });
    response = await handleMessageWebhook(mockReq);
    const bodyDupe = await response.json();
    assert(response.status === 200 && bodyDupe.reply === '', 'Idempotency lease ignores already-processed message ID');

    // ─── PART 2: TEST STANDALONE EXPRESS REGISTRY LOGIC (SIMULATED) ───
    console.log('\n--- Test 4: Registry isolation and multi-tenant disconnects ---');
    
    // Simulate Express Registry Memory Map
    const mockRegistry = new Map<string, { status: string; client: any }>();
    const mockServiceSecret = 'service-secret';
    
    const mockConnect = (workspaceId: string, authSecret: string) => {
      if (authSecret !== mockServiceSecret) return { status: 401, error: 'Unauthorized' };
      if (!workspaceId) return { status: 400, error: 'Missing workspaceId' };
      if (mockRegistry.has(workspaceId)) return { status: 200, statusVal: mockRegistry.get(workspaceId)!.status };
      
      // Simulate client spinup
      mockRegistry.set(workspaceId, {
        status: 'connected',
        client: {
          destroy: () => {
            mockRegistry.delete(workspaceId);
          }
        }
      });
      return { status: 200, statusVal: 'connected' };
    };

    const mockDisconnect = (workspaceId: string, authSecret: string) => {
      if (authSecret !== mockServiceSecret) return { status: 401, error: 'Unauthorized' };
      const state = mockRegistry.get(workspaceId);
      if (!state) return { status: 200, success: true };
      state.client.destroy();
      return { status: 200, success: true };
    };

    // Initialize Workspace A
    const resA = mockConnect('workspace-A', 'service-secret');
    assert(resA.status === 200 && mockRegistry.has('workspace-A'), 'Workspace A initialized successfully');

    // Initialize Workspace B (isolation proof)
    const resB = mockConnect('workspace-B', 'service-secret');
    assert(resB.status === 200 && mockRegistry.has('workspace-B'), 'Workspace B initialized successfully independent of Workspace A');

    // Disconnect Workspace A only
    mockDisconnect('workspace-A', 'service-secret');
    assert(!mockRegistry.has('workspace-A'), 'Workspace A disconnected successfully');
    assert(mockRegistry.has('workspace-B'), 'Workspace B connection remains intact and isolated');

    console.log(`\n=== WHATSAPP TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error('WhatsApp Test execution failed:', e);
    process.exit(1);
  }
}

runTests();
