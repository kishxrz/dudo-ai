import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
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
}
loadEnv();

const baseUrl = 'http://localhost:3000';
const endpoints = [
  '/api/billing/checkout',
  '/api/billing/portal',
  '/api/billing/cancel',
  '/api/billing/resume',
  '/api/webhooks/dodo'
];

async function verifyRouting() {
  console.log('=== STARTING HTTP ROUTING CHECKS ===\n');
  let hasFailed = false;

  for (const ep of endpoints) {
    const url = `${baseUrl}${ep}`;
    console.log(`Checking GET request to ${url}...`);
    try {
      const res = await fetch(url, { method: 'GET' });
      console.log(`Response status: ${res.status}`);
      if (res.status === 404) {
        console.error(`❌ ERROR: Route ${ep} returned 404 (not registered)!`);
        hasFailed = true;
      } else if (res.status === 405) {
        console.log(`✅ SUCCESS: Route ${ep} correctly returned 405 Method Not Allowed.`);
      } else {
        console.warn(`⚠️ WARNING: Route ${ep} returned status ${res.status} (expected 405).`);
      }
    } catch (e: any) {
      console.error(`❌ FAILED to connect to local server: ${e.message}`);
      console.error('Make sure "npm run dev" is active on port 3000.');
      process.exit(1);
    }
    console.log('');
  }

  if (hasFailed) {
    console.error('❌ HTTP Routing verification failed!');
    process.exit(1);
  } else {
    console.log('✅ ALL routing checks passed successfully!');
  }
}

verifyRouting().catch(console.error);
