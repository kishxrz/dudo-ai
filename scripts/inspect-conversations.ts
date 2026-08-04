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
    const workspacesSnap = await adminDb.collection('workspaces').get();
    console.log(`Found ${workspacesSnap.docs.length} workspaces.`);

    for (const wsDoc of workspacesSnap.docs) {
      const workspaceId = wsDoc.id;
      const wsData = wsDoc.data();
      console.log(`\nWorkspace ID: "${workspaceId}" (Name: "${wsData.name ?? 'Unnamed'}")`);

      // Check conversations subcollection
      const convsRef = adminDb.collection('workspaces').doc(workspaceId).collection('conversations');
      const convsSnap = await convsRef.get();
      console.log(`  - Conversations count: ${convsSnap.docs.length}`);

      if (convsSnap.docs.length > 0) {
        console.log('  - Sample conversations:');
        convsSnap.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          console.log(`    * Doc ID: ${doc.id}`);
          console.log(`      Customer Name: ${data.customerName || data.name || 'Unknown'}`);
          console.log(`      Phone/Contact: ${data.customerPhone || data.phone || 'Unknown'}`);
          console.log(`      Messages count: ${data.messages?.length || 0}`);
        });
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Error querying Firestore:', err);
    process.exit(1);
  }
}

main();
