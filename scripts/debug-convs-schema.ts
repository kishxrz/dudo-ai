import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Missing Firebase Admin environment variables in .env.local!');
  process.exit(1);
}

// Initialize Firebase Admin
const app = getApps().length === 0
  ? initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  : getApp();

const adminDb = getFirestore(app);

async function main() {
  try {
    const workspaceId = 'yGilG19wRndCC4eTN7vmMFHqiMG2'; // Kishore R Workspace
    const convsRef = adminDb.collection('workspaces').doc(workspaceId).collection('conversations');
    const snap = await convsRef.limit(5).get();

    console.log(`Printing fields for first ${snap.docs.length} conversations in "${workspaceId}":`);
    snap.docs.forEach((doc, idx) => {
      console.log(`\n--- Doc Index ${idx} (ID: ${doc.id}) ---`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
    process.exit(0);
  } catch (err) {
    console.error('Error querying Firestore:', err);
    process.exit(1);
  }
}

main();
