// scripts/run-auth-tests.js
const { spawn } = require('child_process');

console.log('Running WhatsApp Auth Isolation Tests wrapper...');

const env = { ...process.env };
env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' });

const child = spawn('npx', ['ts-node', 'scripts/test-whatsapp-auth-isolation.ts'], {
  cwd: process.cwd(),
  env,
  shell: true
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  const str = data.toString();
  stdout += str;
  process.stdout.write(str);
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  stderr += str;
  process.stderr.write(str);
});

child.on('close', (code) => {
  console.log(`\nChild process closed with exit code: ${code}`);
  
  const passedString = '=== INTEGRATION TESTS COMPLETED: 18 PASSED, 0 FAILED ===';
  if (stdout.includes(passedString)) {
    console.log('✅ ALL WHATSAPP AUTH ISOLATION INTEGRATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TEST CASES FAILED OR COMPILATION ERROR OCCURRED!');
    process.exit(1);
  }
});
