// @ts-nocheck
import { 
  normalizePhone, 
  generateSecureCode, 
  generateSalt, 
  hashBossCode, 
  verifyBossCode, 
  processAdminCommand, 
  isConversationInTakeover 
} from '../lib/security';

// Setup mock window/localStorage for Node.js environment
if (typeof global.window === 'undefined') {
  global.window = {} as any;
}
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
} as any;

async function runTests() {
  console.log('=== STARTING SECURITY & HUMAN TAKEOVER TESTS ===\n');

  const workspaceId = 'test-ws-123';
  const adminWa = '+917200127721';
  const adminTgId = '123456789';
  const adminTgUsername = 'kishore_admin';

  // Helper to initialize assistant config in mock localStorage
  const initAssistant = (salt: string, hash: string, timeout = 30) => {
    localStorage.setItem('__dudo_dev_assistant', JSON.stringify({
      whatsappAdmins: adminWa,
      telegramAdmins: adminTgUsername,
      bossCodeSalt: salt,
      bossCodeHash: hash,
      takeoverTimeout: timeout,
    }));
  };

  // Generate a valid boss code
  const code = generateSecureCode();
  const salt = generateSalt();
  const hash = hashBossCode(code, salt);
  initAssistant(salt, hash);

  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean) => {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  };

  // 1. Phone Normalization
  assert(
    'normalizePhone trims and adds +91 for 10 digits',
    normalizePhone('7200127721') === '+917200127721'
  );
  assert(
    'normalizePhone preserves existing + country code',
    normalizePhone('+1 (555) 123-4567') === '+15551234567'
  );

  // 2. Correct Code + Correct Admin -> Success
  const res1 = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-1',
    '7200127721', // will be normalized to +917200127721
    undefined,
    `/takeover ${code}`
  );
  assert('Correct code + Correct WhatsApp Admin activates takeover', res1.success && res1.isCommand);

  const active1 = await isConversationInTakeover(workspaceId, 'wa-chat-1');
  assert('Takeover is active for correct conversation', active1);

  // 3. Takeover affects ONLY one conversation (Scoped)
  const activeScoped = await isConversationInTakeover(workspaceId, 'wa-chat-2');
  assert('Takeover is scoped (does not affect other conversations)', !activeScoped);

  // 4. Correct Code + Customer Sender -> Rejected
  const res2 = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-2',
    '9999999999', // customer
    undefined,
    `/takeover ${code}`
  );
  assert('Correct code + Customer WhatsApp sender gets rejected', !res2.success && res2.isCommand);

  // 5. Correct Code + Wrong Admin -> Rejected
  const res3 = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-2',
    '8888888888', // unregistered admin
    undefined,
    `/takeover ${code}`
  );
  assert('Correct code + Unregistered WhatsApp admin gets rejected', !res3.success);

  // 6. Wrong Code + Correct Admin -> Rejected
  const res4 = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-2',
    '7200127721',
    undefined,
    '/takeover DUDO-999999'
  );
  assert('Wrong code + Registered WhatsApp admin gets rejected', !res4.success);

  // 7. Telegram Username Spoofing and Immutable ID Binding
  // First time Telegram login: verify username & bind ID
  const resTg1 = await processAdminCommand(
    workspaceId,
    'telegram',
    'tg-chat-1',
    adminTgId,
    adminTgUsername,
    `/takeover ${code}`
  );
  assert('Telegram first-time username match binds immutable ID', resTg1.success);

  // Spoofing attempt using the same username but different user ID
  const resTgSpoof = await processAdminCommand(
    workspaceId,
    'telegram',
    'tg-chat-2',
    '999999999', // spoofed ID
    adminTgUsername,
    `/takeover ${code}`
  );
  assert('Spoofed Telegram ID is rejected after ID binding', !resTgSpoof.success);

  // 8. Rate Limiting & Brute-Force Protection
  // Simulate 5 failures
  const identity = `whatsapp_7200127721`;
  localStorage.removeItem(`__dudo_failed_${workspaceId}_${identity}`); // clear
  for (let i = 0; i < 5; i++) {
    await processAdminCommand(workspaceId, 'whatsapp', 'wa-chat-2', '7200127721', undefined, '/takeover WRONG');
  }

  // 6th attempt with correct code should be blocked
  const resBlocked = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-2',
    '7200127721',
    undefined,
    `/takeover ${code}`
  );
  assert('Rate limiting blocks 6th attempt after 5 failures', !resBlocked.success && resBlocked.replyMessage.includes('Access Blocked'));

  // Reset rate limits for further testing
  localStorage.removeItem(`__dudo_failed_${workspaceId}_${identity}`);

  // 9. Code Rotation Invalidates Old Code
  const newCode = generateSecureCode();
  const newSalt = generateSalt();
  const newHash = hashBossCode(newCode, newSalt);
  initAssistant(newSalt, newHash); // Rotate

  const resOld = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-1',
    '7200127721',
    undefined,
    `/takeover ${code}` // old code
  );
  assert('Code rotation invalidates the old code immediately', !resOld.success);

  const resNew = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-1',
    '7200127721',
    undefined,
    `/takeover ${newCode}` // new code
  );
  assert('Code rotation allows the new code to take over', resNew.success);

  // 10. Customer cannot resume AI
  const resResumeCust = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-1',
    '9999999999', // customer
    undefined,
    `/resume ${newCode}`
  );
  assert('Customer attempt to resume AI is rejected', !resResumeCust.success);

  // 11. Admin can resume AI with valid verification
  const resResumeAdmin = await processAdminCommand(
    workspaceId,
    'whatsapp',
    'wa-chat-1',
    '7200127721', // admin
    undefined,
    `/resume ${newCode}`
  );
  assert('Admin with valid code resumes AI mode successfully', resResumeAdmin.success);

  // 12. Automatic Timeout Resumes AI Mode
  // Set timeout to 1 minute, activate takeover
  initAssistant(newSalt, newHash, 1);
  await processAdminCommand(workspaceId, 'whatsapp', 'wa-chat-1', '7200127721', undefined, `/takeover ${newCode}`);
  
  // Set takeoverExpiry to 1 minute ago to simulate timeout passing
  const takeoverKey = `__dudo_takeover_${workspaceId}_wa-chat-1`;
  const localTakeover = JSON.parse(localStorage.getItem(takeoverKey));
  localTakeover.takeoverExpiry = Date.now() - 5000; // expired
  localStorage.setItem(takeoverKey, JSON.stringify(localTakeover));

  const activeTimeout = await isConversationInTakeover(workspaceId, 'wa-chat-1');
  assert('Automatic timeout resumes AI mode successfully when checked', !activeTimeout);

  console.log(`\n=== TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
