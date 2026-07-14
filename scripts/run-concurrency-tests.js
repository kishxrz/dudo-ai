// scripts/run-concurrency-tests.js
const { spawn } = require('child_process');

console.log('Running WhatsApp Concurrency & Reliability Tests wrapper...');

const env = { ...process.env };
env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' });

const child = spawn('npx', ['ts-node', 'scripts/test-whatsapp-concurrency.ts'], {
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
  
  const passedString = '=== ALL CONCURRENCY TESTS COMPLETED: 22 PASSED, 0 FAILED ===';
  if (stdout.includes(passedString)) {
    console.log('✅ ALL WHATSAPP CONCURRENCY & RELIABILITY TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME CONCURRENCY TEST CASES FAILED OR COMPILATION ERROR OCCURRED!');
    process.exit(1);
  }
});
