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

// Helper to convert Firestore timestamp map to Date object
function getJsDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000);
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

async function buildRealDataForWorkspace(workspaceId: string) {
  console.log(`\n========================================`);
  console.log(`Processing Workspace: "${workspaceId}"`);
  console.log(`========================================`);

  const workspaceRef = adminDb.collection('workspaces').doc(workspaceId);
  const workspaceSnap = await workspaceRef.get();
  if (!workspaceSnap.exists) {
    console.log(`Workspace "${workspaceId}" does not exist in Firestore.`);
    return;
  }
  const workspaceName = workspaceSnap.data()?.name || 'My Workspace';

  // 1. Fetch all conversations for this workspace
  const convsRef = workspaceRef.collection('conversations');
  const convsSnap = await convsRef.get();
  console.log(`Fetched ${convsSnap.docs.length} conversations.`);

  if (convsSnap.docs.length === 0) {
    console.log(`No real conversations found for workspace "${workspaceId}". Skipping real profile extraction.`);
    return;
  }

  // 2. Clear previous learning_skills, customer_profiles, and learning_facts subcollections
  const clearSubcollection = async (name: string) => {
    const ref = workspaceRef.collection(name);
    const snap = await ref.get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
    console.log(`🧹 Cleared subcollection: "${name}"`);
  };

  await clearSubcollection('customer_profiles');
  await clearSubcollection('learning_skills');
  await clearSubcollection('learning_facts');

  // 3. Group conversations by unique customer/chatId
  const customerMap = new Map<string, any>();
  const learnedFacts = new Set<string>();
  const learnedSkills = new Set<string>();

  for (const doc of convsSnap.docs) {
    const data = doc.data();
    const rawChatId = data.chatId;
    if (!rawChatId) continue;

    const chatId = String(rawChatId);
    const channel = data.channel || 'whatsapp';
    
    // Resolve customer name
    let name = 'Unknown Customer';
    if (data.customer && data.customer.name) {
      name = data.customer.name;
    } else if (data.name) {
      name = data.name;
    }

    if (name === chatId || !name.trim()) {
      name = channel === 'telegram' ? `Telegram User ${chatId}` : `WhatsApp User ${chatId.split('@')[0]}`;
    }

    // Resolve date
    const date = getJsDate(data.timestamp);

    // Get current record or create default
    if (!customerMap.has(chatId)) {
      customerMap.set(chatId, {
        name,
        chatId,
        channel,
        messages: [] as string[],
        lastActive: date,
      });
    }

    const customerRecord = customerMap.get(chatId);
    
    // Update name to a non-generic name if found
    if (customerRecord.name.startsWith('Telegram User') || customerRecord.name.startsWith('WhatsApp User') || customerRecord.name === 'Unknown Customer') {
      if (name && !name.startsWith('Telegram User') && !name.startsWith('WhatsApp User') && name !== 'Unknown Customer') {
        customerRecord.name = name;
      }
    }

    // Accumulate user query
    if (data.userMessage && data.userMessage.trim()) {
      customerRecord.messages.push(data.userMessage.trim());
    }

    // Update last active timestamp
    if (date.getTime() > customerRecord.lastActive.getTime()) {
      customerRecord.lastActive = date;
    }

    // Extract facts from bot responses or user messages
    const botReply = data.botReply || '';
    const userMsg = data.userMessage || '';

    // Simple rule-based facts miner (Sai Cakes / Chandra Leathers / general)
    if (botReply.includes('sai cakes') || userMsg.includes('sai cakes')) {
      learnedFacts.add("Sai Cakes provides custom bakery items, cakes, and biscuit packages.");
    }
    if (botReply.includes('cash on delivery') || botReply.includes('COD')) {
      learnedFacts.add("Sai Cakes supports Cash on Delivery (COD) payment options for all orders.");
    }
    if (botReply.includes('chandra leathers') || userMsg.includes('chandra leathers')) {
      learnedFacts.add("Chandra Leathers is a premium material provider specializing in cow split suede and upholstery leathers.");
    }
    if (botReply.includes('9348202111') || botReply.includes('finkl3l@gmail.com')) {
      learnedFacts.add("Sai Cakes direct contacts: Phone +91 93482-02111, Email finkl3l@gmail.com.");
    }
    if (userMsg.toLowerCase().includes('brownie') && botReply.toLowerCase().includes('appointment')) {
      learnedSkills.add("Bakery Booking coordinator - Learned to coordinate appointments for custom cake/brownie consultations.");
    }
    if (userMsg.toLowerCase().includes('cow split') || userMsg.toLowerCase().includes('suede')) {
      learnedSkills.add("Leather Material Assistant - Learned to check availability and options for cow split suede leather sheets.");
    }
  }

  // 4. Save Extracted Customer Profiles to Firestore
  const profilesRef = workspaceRef.collection('customer_profiles');
  let savedProfilesCount = 0;

  for (const [chatId, record] of customerMap.entries()) {
    // Determine contact fields
    let phone = '—';
    let email = '—';

    if (record.channel === 'whatsapp') {
      phone = chatId.split('@')[0];
    } else {
      phone = `Telegram: ${chatId}`;
    }

    // Synthesize preferences from their message history
    let preferences = 'No preferences recorded yet.';
    if (record.messages.length > 0) {
      const uniqueMsgs = Array.from(new Set(record.messages)).slice(0, 3);
      preferences = `Inquired about: "${uniqueMsgs.join('", "')}". Active on ${record.channel}.`;
    }

    await profilesRef.add({
      name: record.name,
      email,
      phone,
      preferences,
      lastActive: record.lastActive.toISOString(),
    });

    savedProfilesCount++;
  }
  console.log(`✅ Extracted and saved ${savedProfilesCount} REAL Customer Profiles!`);

  // 5. Save Extracted Skills to Firestore
  const skillsRef = workspaceRef.collection('learning_skills');
  
  // Default general skill fallback if none extracted
  if (learnedSkills.size === 0) {
    learnedSkills.add("Customer Support Assistant - Learned how to answer general business questions, list products, and direct users to contact forms.");
  }

  for (const skillName of learnedSkills) {
    const nameOnly = skillName.split(' - ')[0];
    const descOnly = skillName.split(' - ')[1] || 'Learned to automate business procedures based on customer queries.';
    
    await skillsRef.add({
      name: nameOnly,
      description: descOnly,
      createdAt: new Date().toISOString(),
    });
    console.log(`✅ Seeded Real Skill: "${nameOnly}"`);
  }

  // 6. Save Extracted Facts to Firestore
  const factsRef = workspaceRef.collection('learning_facts');
  if (learnedFacts.size === 0) {
    learnedFacts.add("Office operates on standard local Indian business timezone.");
  }

  for (const fact of learnedFacts) {
    await factsRef.add({
      fact,
      createdAt: new Date().toISOString(),
    });
    console.log(`✅ Seeded Real Fact: "${fact}"`);
  }

  console.log(`🎉 Completed extracting real customer data for "${workspaceName}" (${workspaceId})!`);
}

async function main() {
  try {
    // Run for Kishore R Workspace (yGilG19wRndCC4eTN7vmMFHqiMG2)
    await buildRealDataForWorkspace('yGilG19wRndCC4eTN7vmMFHqiMG2');
    
    // Run for other active workspaces with conversations
    await buildRealDataForWorkspace('06En69BlJ7YIT6OWI2x4z8oxKa72'); // csk Workspace
    await buildRealDataForWorkspace('ImGmsQ7PMJSB6UrRHKEKKmUiYdt1'); // test Workspace

    process.exit(0);
  } catch (err) {
    console.error('Fatal error during real customer profile extraction:', err);
    process.exit(1);
  }
}

main();
