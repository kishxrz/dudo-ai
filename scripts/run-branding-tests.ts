// @ts-nocheck
import Module from 'module';

// ─── 1. INTERCEPT REQUIRE IMPORTS FOR FIREBASE & SERVICE MOCKING ───
const originalRequire = Module.prototype.require;
let mockAssistantDoc: any = null;

Module.prototype.require = function (request: string) {
  if (request === '@/lib/firebase-admin' || request === '../firebase-admin') {
    return {
      getAdminDb: () => ({
        doc: (path: string) => ({
          get: async () => ({
            exists: mockAssistantDoc !== null,
            data: () => mockAssistantDoc
          })
        }),
        collection: (path: string) => ({
          get: async () => ({ docs: [] })
        })
      })
    };
  }
  if (request === '@/lib/firebase' || request === '../firebase') {
    return { db: {} };
  }
  if (request === 'firebase/firestore') {
    return {
      doc: () => ({}),
      getDoc: async () => ({
        exists: () => mockAssistantDoc !== null,
        data: () => mockAssistantDoc
      }),
      collection: () => ({}),
      getDocs: async () => ({ docs: [] })
    };
  }
  if (request.includes('SkillService')) {
    return {
      SkillService: {
        resolveEnabledSkills: async () => []
      }
    };
  }
  if (request.includes('KnowledgeService')) {
    return {
      KnowledgeService: {
        getStaticKnowledge: async () => ''
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Import context loader after mocks are established
import { WorkspaceContextLoader } from '../lib/ai/WorkspaceContextLoader';

async function runTests() {
  console.log('=== STARTING BRANDING & FALLBACK TESTS ===\n');
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
    // 1. assistant name "Dodo Pet Store Assistant" remains unchanged
    mockAssistantDoc = {
      name: 'Dodo Pet Store Assistant',
      systemPrompt: 'Keep responses simple.',
      timezone: 'Asia/Kolkata',
      status: 'active'
    };
    let context = await WorkspaceContextLoader.load('test-ws');
    assert(
      context.assistant.name === 'Dodo Pet Store Assistant',
      'Assistant name "Dodo Pet Store Assistant" remains unchanged'
    );

    // 2. system prompt containing "Dodo" remains unchanged
    mockAssistantDoc = {
      name: 'Neutral Assistant',
      systemPrompt: 'You love Dodo birds and dodo pets.',
      timezone: 'Asia/Kolkata',
      status: 'active'
    };
    context = await WorkspaceContextLoader.load('test-ws');
    assert(
      context.assistant.systemPrompt === 'You love Dodo birds and dodo pets.',
      'System prompt containing "Dodo" remains unchanged'
    );

    // 3. missing assistant name falls back to "AI Assistant"
    mockAssistantDoc = {
      systemPrompt: 'You are a helper.',
      timezone: 'Asia/Kolkata',
      status: 'active'
    };
    context = await WorkspaceContextLoader.load('test-ws');
    assert(
      context.assistant.name === 'AI Assistant',
      'Missing assistant name falls back to "AI Assistant"'
    );

    // 4. whitespace-only assistant name falls back to "AI Assistant"
    mockAssistantDoc = {
      name: '    ',
      systemPrompt: 'You are a helper.',
      timezone: 'Asia/Kolkata',
      status: 'active'
    };
    context = await WorkspaceContextLoader.load('test-ws');
    assert(
      context.assistant.name === 'AI Assistant',
      'Whitespace-only assistant name falls back to "AI Assistant"'
    );

    // 5. valid configured assistant names remain unchanged
    mockAssistantDoc = {
      name: 'Super Agent X',
      systemPrompt: 'Standard instructions.',
      timezone: 'Asia/Kolkata',
      status: 'active'
    };
    context = await WorkspaceContextLoader.load('test-ws');
    assert(
      context.assistant.name === 'Super Agent X',
      'Valid configured assistant name remains unchanged'
    );

    console.log(`\n=== BRANDING TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error('Test execution failed:', e);
    process.exit(1);
  }
}

runTests();
