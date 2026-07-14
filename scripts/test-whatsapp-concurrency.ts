import * as fs from 'fs';
import * as path from 'path';
import * as Module from 'module';
import { EventEmitter } from 'events';

console.log('=== STARTING WHATSAPP CONCURRENCY & RELIABILITY TESTS ===\n');

// ─── 1. INTERCEPT REQUIRE IMPORTS FOR FIREBASE ADMIN MOCKING ───
const originalRequire = Module.prototype.require;
const mockDbState: Record<string, any> = {
  'workspaces/ws-concurrency': { ownerId: 'user-valid' },
  'workspaces/ws-concurrency/billing/subscription': { planId: 'monthly', status: 'active' }
};

// Next.js webhook mock status
let nextWebhookStatus = 200;
let nextWebhookResponseBody: any = { reply: 'AI Success Response' };

// Firestore lease acquire/release success mocks
let firestoreAquireFails = false;

Module.prototype.require = function (request: string) {
  if (request.endsWith('firebase-admin') || request.includes('firebase-admin')) {
    return {
      getAdminDb: () => ({
        doc: (path: string) => ({
          get: async () => ({
            exists: mockDbState[path] !== undefined,
            data: () => mockDbState[path]
          }),
          set: async (data: any) => {
            mockDbState[path] = { ...mockDbState[path], ...data };
          },
          delete: async () => {
            delete mockDbState[path];
          }
        }),
        runTransaction: async (cb: any) => {
          if (firestoreAquireFails) {
            throw new Error('Firestore Transaction Timeout');
          }
          const mockTransaction = {
            get: async (ref: any) => {
              const p = ref.path || '';
              return {
                exists: mockDbState[p] !== undefined,
                data: () => mockDbState[p]
              };
            },
            set: (ref: any, data: any) => {
              const p = ref.path || '';
              mockDbState[p] = data;
            }
          };
          return cb(mockTransaction);
        }
      }),
      getAuth: () => ({
        verifyIdToken: async (token: string) => {
          return { uid: 'user-valid' };
        }
      })
    };
  }
  return originalRequire.call(this, request);
};

// Set environment variables for Express service
process.env.PORT = '4007';
process.env.WHATSAPP_SERVICE_SECRET = 'test-service-secret';
process.env.WHATSAPP_INTERNAL_SECRET = 'test-internal-secret';
process.env.WHATSAPP_SESSION_PATH = path.join(__dirname, '../temp-sessions-concurrency');

// Mock whatsapp-web.js Client before requiring the index file
class MockClient extends EventEmitter {
  public authStrategy: any;
  public puppeteer: any;
  public isDestroyed = false;

  constructor(options: any) {
    super();
    this.authStrategy = options.authStrategy;
    this.puppeteer = options.puppeteer;
    capturedClients.push(this);
  }

  async initialize() {
    this.emit('ready');
  }

  async sendMessage(to: string, message: string) {
    if (sendMessageFails) {
      throw new Error('WhatsApp network transmission failed');
    }
    sentMessages.push({ to, message });
  }

  async destroy() {
    this.isDestroyed = true;
  }
}

// Hook original whatsapp-web.js module to return MockClient
jestMockModule('whatsapp-web.js', {
  Client: MockClient,
  LocalAuth: class {
    constructor(opts: any) {}
  }
});

function jestMockModule(moduleName: string, exports: any) {
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (request: string) {
    if (request === moduleName) {
      return exports;
    }
    return originalRequire.call(this, request);
  };
}

const capturedClients: MockClient[] = [];
const sentMessages: { to: string; message: string }[] = [];
let sendMessageFails = false;

// Webhook mock server definition
const express = require('express');
const mockNextApp = express();
mockNextApp.use(express.json());

mockNextApp.post('/api/internal/whatsapp/message', (req: any, res: any) => {
  if (nextWebhookStatus !== 200 || firestoreAquireFails) {
    res.status(500).send('Webhook/Firestore server error');
  } else {
    res.json(nextWebhookResponseBody);
  }
});

const nextAppServer = mockNextApp.listen(4008, () => {
  console.log('Mock Next.js webhook listener online on port 4008');
});

// Configure Express WhatsApp service environment DUDO_BASE_URL to point to our mock Next.js server
process.env.DUDO_BASE_URL = 'http://localhost:4008';

// Now require the WhatsApp service to initialize it
const expressService = require('../services/whatsapp-service/src/index');

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
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Simulate Connect to registry
    const fetch = require('node-fetch');
    const headers = {
      'Authorization': 'Bearer token-valid',
      'X-WhatsApp-Internal-Secret': 'test-internal-secret',
    };
    
    await fetch('http://localhost:4007/v1/workspaces/ws-concurrency/connect', {
      method: 'POST',
      headers,
    });

    const activeClient = capturedClients[0];
    assert(activeClient !== undefined, 'WhatsApp client instance captured successfully');

    // Retrieve the registered 'message' listener
    const messageListener = activeClient.listeners('message')[0] as any;
    assert(messageListener !== undefined, 'Message event listener is registered successfully on Client');

    // Helper to simulate incoming message
    const simulateMessage = async (text: string, msgId: string, from = 'user-1') => {
      const mockMsg = {
        from,
        body: text,
        type: 'chat',
        timestamp: Math.floor(Date.now() / 1000) + 10,
        author: from,
        id: {
          id: msgId,
          _serialized: `false_${from}_${msgId}`,
          fromMe: false,
          remote: from,
        },
        sendMessage: async (m: string) => {
          await activeClient.sendMessage(from, m);
        }
      };
      await messageListener(mockMsg);
    };

    // ─── TEST 1: 5 SEQUENTIAL INCOMING MESSAGES ───
    console.log('\n--- Test 1: 5 Sequential Incoming Messages ---');
    sentMessages.length = 0;
    
    for (let i = 1; i <= 5; i++) {
      await simulateMessage(`Message ${i}`, `msg-seq-${i}`);
    }
    assert(sentMessages.length === 5, 'Processes all 5 sequential messages successfully');

    // ─── TEST 2: AI FAILURE FOLLOWED BY VALID MESSAGE ───
    console.log('\n--- Test 2: AI failure followed by valid message ---');
    sentMessages.length = 0;
    nextWebhookStatus = 500; // Trigger webhook failure
    
    await simulateMessage('Fail AI Message', 'msg-fail-ai');
    assert(sentMessages.length === 0, 'No message sent on AI response failure');

    nextWebhookStatus = 200; // Restore AI success
    await simulateMessage('Recovered Message', 'msg-recover-ai');
    assert(sentMessages.length === 1 && sentMessages[0].message === 'AI Success Response', 'Valid message processed after an AI failure');

    // ─── TEST 3: FIRESTORE LEASE FAILURE FOLLOWED BY VALID MESSAGE ───
    console.log('\n--- Test 3: Firestore persistence failure followed by valid message ---');
    sentMessages.length = 0;
    firestoreAquireFails = true; // Make lease acquisition fail (throw)
    
    await simulateMessage('Fail Firestore Message', 'msg-fail-db');
    assert(sentMessages.length === 0, 'No message sent on Firestore transaction timeout');

    firestoreAquireFails = false; // Restore Firestore
    await simulateMessage('Recovered DB Message', 'msg-recover-db');
    assert(sentMessages.length === 1, 'Valid message processed after a Firestore persistence failure');

    // ─── TEST 4: WHATSAPP SEND REPLIES FAILURE FOLLOWED BY VALID MESSAGE ───
    console.log('\n--- Test 4: WhatsApp send failure followed by valid message ---');
    sentMessages.length = 0;
    sendMessageFails = true; // Make client.sendMessage throw
    
    await simulateMessage('Fail WhatsApp Message', 'msg-fail-wa');
    // It should throw internally but not block the event loop
    
    sendMessageFails = false; // Restore WhatsApp sending
    await simulateMessage('Recovered WA Message', 'msg-recover-wa');
    assert(sentMessages.length === 1, 'Valid message processed after a WhatsApp send failure');

    // ─── TEST 5: DUPLICATE DELIVERY OF SAME MESSAGE ID ───
    console.log('\n--- Test 5: Duplicate delivery of same message ID ---');
    sentMessages.length = 0;
    
    // Simulate duplicate delivery
    const promise1 = simulateMessage('Duplicate Msg', 'msg-dupe');
    const promise2 = simulateMessage('Duplicate Msg', 'msg-dupe');
    await Promise.all([promise1, promise2]);
    
    assert(sentMessages.length === 1, 'Deduplication blocks duplicate message delivery');

    // ─── TEST 6: RAPID CONSECUTIVE MESSAGES ───
    console.log('\n--- Test 6: Rapid consecutive messages ---');
    sentMessages.length = 0;
    
    // Different message IDs sent rapidly
    await Promise.all([
      simulateMessage('Rapid 1', 'msg-rapid-1'),
      simulateMessage('Rapid 2', 'msg-rapid-2'),
      simulateMessage('Rapid 3', 'msg-rapid-3'),
    ]);
    assert(sentMessages.length === 3, 'Processes rapid consecutive messages independently');

    // ─── TEST 7: CLIENT RECONNECT WITHOUT DUPLICATE LISTENER REGISTRATION ───
    console.log('\n--- Test 7: Client reconnect without duplicate listener registration ---');
    
    // Fetch connect again for same workspace
    await fetch('http://localhost:4007/v1/workspaces/ws-concurrency/connect', {
      method: 'POST',
      headers,
    });
    
    assert(capturedClients.length === 1, 'Reconnecting an active client does not spawn a new Client');
    const numListeners = activeClient.listenerCount('message');
    assert(numListeners === 1, 'Reconnecting does not duplicate the message event listener');

    // ─── TEST 8: 20 CONCURRENT STATUS REQUESTS DURING INITIALIZATION ───
    console.log('\n--- Test 8: 20 concurrent status requests during initialization ---');
    mockDbState['workspaces/ws-concurrent-status'] = { ownerId: 'user-valid' };
    mockDbState['workspaces/ws-concurrent-status/billing/subscription'] = { planId: 'monthly', status: 'active' };
    
    fetch('http://localhost:4007/v1/workspaces/ws-concurrent-status/connect', { method: 'POST', headers });

    const statusPromises = [];
    for (let i = 0; i < 20; i++) {
      statusPromises.push(
        fetch('http://localhost:4007/v1/workspaces/ws-concurrent-status/status', { method: 'GET', headers })
          .then((res: any) => res.json())
      );
    }
    const results = await Promise.all(statusPromises);
    const concurrentClientsCount = capturedClients.filter(c => c.authStrategy.clientId === 'whatsapp-ws-concurrent-status').length;
    assert(concurrentClientsCount <= 1, 'Only one client is created under concurrent status requests');
    assert(results.every(r => r.status === 'initializing' || r.status === 'connected' || r.status === 'qr_ready' || r.status === 'disconnected'), 'Status requests return valid state codes');

    // ─── TEST 9: REPEATED STATUS POLLING AFTER READY ───
    console.log('\n--- Test 9: Repeated status polling after READY ---');
    const pollPromises = [];
    for (let i = 0; i < 10; i++) {
      pollPromises.push(
        fetch('http://localhost:4007/v1/workspaces/ws-concurrency/status', { method: 'GET', headers })
          .then((res: any) => res.json())
      );
    }
    const pollResults = await Promise.all(pollPromises);
    assert(pollResults.every(r => r.status === 'connected'), 'Status polling after READY does not mutate connection state');

    // ─── TEST 10: DUPLICATE INITIALIZE / CONNECT REQUESTS ───
    console.log('\n--- Test 10: Duplicate initialize/connect requests ---');
    const oldClientCount = capturedClients.length;
    
    const connectPromises = [];
    for (let i = 0; i < 5; i++) {
      connectPromises.push(
        fetch('http://localhost:4007/v1/workspaces/ws-concurrency/connect', { method: 'POST', headers })
          .then((res: any) => res.json())
      );
    }
    await Promise.all(connectPromises);
    assert(capturedClients.length === oldClientCount, 'Duplicate connect requests do not spawn new Client instances');

    // ─── TEST 11: CLIENT MAP OVERWRITE ATTEMPTS ───
    console.log('\n--- Test 11: Client Map overwrite attempts ---');
    const firstClient = capturedClients.find(c => c.authStrategy.clientId === 'whatsapp-ws-concurrency');
    
    await fetch('http://localhost:4007/v1/workspaces/ws-concurrency/connect', { method: 'POST', headers });
    const currentClient = capturedClients.find(c => c.authStrategy.clientId === 'whatsapp-ws-concurrency');
    assert(firstClient === currentClient, 'Idempotent lock prevents registry Map client overwrite');

    // ─── TEST 12: STALE CLIENT INSTANCE LISTENER SCENARIO ───
    console.log('\n--- Test 12: Stale client instance listener scenario ---');
    await fetch('http://localhost:4007/v1/workspaces/ws-concurrency/disconnect', { method: 'POST', headers });
    
    await fetch('http://localhost:4007/v1/workspaces/ws-concurrency/connect', { method: 'POST', headers });
    const newActiveClient = capturedClients[capturedClients.length - 1];
    
    assert(newActiveClient !== activeClient, 'A new Client instance is created after disconnection');
    const newMsgListener = newActiveClient.listeners('message')[0] as any;
    assert(newMsgListener !== undefined, 'Message listener remains attached to the new client instance');

    // ─── TEST 13: MESSAGE EVENT AFTER REPEATED STATUS POLLING ───
    console.log('\n--- Test 13: Message event after repeated status polling ---');
    sentMessages.length = 0;
    
    const mockMsgNew = {
      from: 'user-2',
      body: 'Hello after poll',
      type: 'chat',
      timestamp: Math.floor(Date.now() / 1000) + 10,
      author: 'user-2',
      id: {
        id: 'msg-post-poll',
        _serialized: 'false_user-2_msg-post-poll',
        fromMe: false,
        remote: 'user-2',
      },
      sendMessage: async (m: string) => {
        await newActiveClient.sendMessage('user-2', m);
      }
    };
    await newMsgListener(mockMsgNew);
    assert(sentMessages.length === 1 && sentMessages[0].message === 'AI Success Response', 'Message event is handled successfully after repeated status polling');

    // ─── TEST 14: MESSAGE_CREATE EVENT AFTER REPEATED STATUS POLLING ───
    console.log('\n--- Test 14: Message_create event after repeated status polling ---');
    const msgCreateListener = newActiveClient.listeners('message_create')[0] as any;
    assert(msgCreateListener !== undefined, 'message_create listener is registered successfully on the new client');
    
    let messageCreateLogged: boolean = false;
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      const logStr = args.join(' ');
      if (logStr.includes('[WA_TRACE] message_create')) {
        messageCreateLogged = true;
      }
      originalConsoleLog.apply(console, args);
    };

    await msgCreateListener(mockMsgNew);
    console.log = originalConsoleLog;
    assert(!!messageCreateLogged, 'message_create event logs diagnostic output successfully after status polling');

    console.log(`\n=== ALL CONCURRENCY TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
    
    // Clean up temporary sessions directory
    try {
      if (fs.existsSync(process.env.WHATSAPP_SESSION_PATH!)) {
        fs.rmSync(process.env.WHATSAPP_SESSION_PATH!, { recursive: true, force: true });
      }
    } catch {}

    nextAppServer.close();
    if (expressService && expressService.server) {
      expressService.server.close();
    }
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error('Test execution failed with error:', e);
    nextAppServer.close();
    if (expressService && expressService.server) {
      expressService.server.close();
    }
    process.exit(1);
  }
}

runTests();
