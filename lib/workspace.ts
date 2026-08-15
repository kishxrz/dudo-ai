import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Each user owns exactly one workspace.
 * Workspace ID = user's Firebase UID (simple, no extra lookup needed).
 */
export function getWorkspaceId(uid: string): string {
  return uid;
}

/**
 * Call this once after sign-up / first sign-in.
 * Creates the workspace + default assistant doc if they don't exist yet.
 * Provisions 6-Month Pack (₹2,499) for kishx.rzz@gmail.com or 30-minute free trial subscription for others.
 * Safe to call multiple times (idempotent).
 */
export async function ensureWorkspace(
  uid: string,
  displayName?: string | null,
  businessName?: string | null,
  email?: string | null
): Promise<boolean> {
  if (!db) return false;

  const wsRef = doc(db, 'workspaces', uid);
  const wsSnap = await getDoc(wsRef);

  const finalBizName = businessName?.trim() || displayName || 'My';
  const userEmail = email?.toLowerCase().trim();
  const isKishxVIP = userEmail === 'kishx.rzz@gmail.com';

  let createdNew = false;

  if (!wsSnap.exists()) {
    // Create workspace
    await setDoc(wsRef, {
      id: uid,
      ownerId: uid,
      ownerEmail: userEmail || '',
      name: businessName?.trim() ? `${businessName.trim()} Workspace` : `${displayName ?? 'My'} Workspace`,
      plan: isKishxVIP ? 'six_month' : 'trial',
      timezone: 'Asia/Kolkata',
      createdAt: serverTimestamp(),
    });

    // Create default assistant
    const assistantRef = doc(db, 'workspaces', uid, 'assistants', 'assistant-1');
    await setDoc(assistantRef, {
      id: 'assistant-1',
      workspaceId: uid,
      name: `${finalBizName}'s AI Assistant`,
      description: 'A helpful AI assistant for customer support',
      systemPrompt: 'You are a helpful assistant. Answer questions clearly and concisely.',
      personality: 'friendly',
      temperature: 0.7,
      language: 'auto',
      memoryEnabled: true,
      welcomeMessage: 'Hi! How can I help you today?',
      fallbackMessage: "I'm not sure about that. Let me connect you with a team member.",
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    createdNew = true;
  }

  // VIP testing grant for kishx.rzz@gmail.com
  if (isKishxVIP) {
    try {
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year active
      const subRef = doc(db, 'workspaces', uid, 'billing', 'subscription');
      await setDoc(subRef, {
        planId: '6months',
        plan: 'six_month',
        planName: '6-Month Pack',
        price: 2499,
        currency: '₹',
        billingCycle: '6months',
        status: 'active',
        startDate: serverTimestamp(),
        expiryDate: expiresAt,
        nextBillingDate: expiresAt,
        autoRenew: true,
        conversationLimit: 9999,
        campaignLimit: 0,
        subscriptionId: 'vip_kishx_2499_live',
        customerId: 'kishx.rzz@gmail.com'
      }, { merge: true });
    } catch (err) {
      console.warn('[ensureWorkspace] Failed to set VIP subscription for kishx.rzz@gmail.com:', err);
    }
  } else if (createdNew) {
    // Provision free trial subscription via server-side API for standard users
    try {
      const baseUrl =
        typeof window !== 'undefined'
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
      await fetch(`${baseUrl}/api/billing/init-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: uid }),
      });
    } catch (e) {
      console.warn('[ensureWorkspace] Trial init API call failed (non-fatal):', e);
    }
  }

  return createdNew;
}
