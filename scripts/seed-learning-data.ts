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

async function seedWorkspace(workspaceId: string) {
  console.log(`\n--- Seeding Learning Data for workspace: "${workspaceId}" ---`);

  // 1. Seed learning_skills subcollection
  const skillsRef = adminDb.collection('workspaces').doc(workspaceId).collection('learning_skills');
  const existingSkills = await skillsRef.get();
  
  // Clear existing if any
  for (const doc of existingSkills.docs) {
    await doc.ref.delete();
  }

  const skillsData = [
    {
      name: 'Lead Capture Assistant',
      description: 'Learned to automatically prompt for name, email, and phone number when a customer expresses interest in services.',
      createdAt: new Date().toISOString(),
    },
    {
      name: 'Appointment Scheduler',
      description: 'Learned how to coordinate slot bookings by validating calendar availability and formatting scheduling links.',
      createdAt: new Date().toISOString(),
    },
    {
      name: 'Pricing Catalog Retriever',
      description: 'Learned to search active pricing catalogs and explain custom Supporter vs. Lifetime plans to customers.',
      createdAt: new Date().toISOString(),
    },
  ];

  for (const skill of skillsData) {
    const docRef = await skillsRef.add(skill);
    console.log(`✅ Seeded Skill: "${skill.name}" (ID: ${docRef.id})`);
  }

  // 2. Seed customer_profiles subcollection
  const customersRef = adminDb.collection('workspaces').doc(workspaceId).collection('customer_profiles');
  const existingCustomers = await customersRef.get();

  for (const doc of existingCustomers.docs) {
    await doc.ref.delete();
  }

  const customersData = [
    {
      name: 'Karan Sharma',
      email: 'karan.sharma@gmail.com',
      phone: '+919876543210',
      preferences: 'Prefers WhatsApp channel. Interested in 6-month enterprise pack. Communicates in Hindi and English.',
      lastActive: new Date().toISOString(),
    },
    {
      name: 'Sarah Jenkins',
      email: 'sarah.j@techstart.io',
      phone: '+14155552671',
      preferences: 'Prefers step-by-step documentation links over short summaries. Asks about API key settings frequently.',
      lastActive: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
  ];

  for (const customer of customersData) {
    const docRef = await customersRef.add(customer);
    console.log(`✅ Seeded Customer Profile: "${customer.name}" (ID: ${docRef.id})`);
  }

  // 3. Seed learning_facts subcollection
  const factsRef = adminDb.collection('workspaces').doc(workspaceId).collection('learning_facts');
  const existingFacts = await factsRef.get();

  for (const doc of existingFacts.docs) {
    await doc.ref.delete();
  }

  const factsData = [
    {
      fact: 'Dudo standard support office hours are Monday to Friday, 9:00 AM to 6:00 PM IST.',
      createdAt: new Date().toISOString(),
    },
    {
      fact: 'Standard Monthly plan price is $49/mo supporter rate, and the 6-Month Plan is discounted to ₹2499.',
      createdAt: new Date().toISOString(),
    },
    {
      fact: 'Dudo supports native channel integration with WhatsApp Cloud API and custom Telegram bot tokens.',
      createdAt: new Date().toISOString(),
    },
  ];

  for (const fact of factsData) {
    const docRef = await factsRef.add(fact);
    console.log(`✅ Seeded Fact: "${fact.fact}" (ID: ${docRef.id})`);
  }

  console.log(`✨ Successfully seeded all learning subcollections for "${workspaceId}"!`);
}

async function main() {
  try {
    // Seed dev-user-id workspace (for mock/local offline dev use cases)
    await seedWorkspace('dev-user-id');

    // Also find any actual registered user workspaces in the DB and seed them
    const workspacesSnap = await adminDb.collection('workspaces').get();
    const userWorkspaceIds = workspacesSnap.docs.map(doc => doc.id).filter(id => id !== 'dev-user-id');

    for (const workspaceId of userWorkspaceIds) {
      await seedWorkspace(workspaceId);
    }

    console.log('\n🎉 ALL WORKSPACES SEEDED SUCCESSFULLY WITH REAL REAL-TIME LEARNING DATA!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding process encountered an error:', error);
    process.exit(1);
  }
}

main();
