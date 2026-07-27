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
 * Also provisions the 30-minute free trial subscription via the server API.
 * Safe to call multiple times (idempotent).
 */
export async function ensureWorkspace(uid: string, displayName?: string | null, businessName?: string | null) {
  if (!db) return;

  const wsRef = doc(db, 'workspaces', uid);
  const wsSnap = await getDoc(wsRef);

  const finalBizName = businessName?.trim() || displayName || 'My';

  if (!wsSnap.exists()) {
    // Create workspace
    await setDoc(wsRef, {
      id: uid,
      ownerId: uid,
      name: businessName?.trim() ? `${businessName.trim()} Workspace` : `${displayName ?? 'My'} Workspace`,
      plan: 'trial',
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

    // Provision free trial subscription via server-side API
    // (client SDK can't import 'server-only' modules directly)
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
      // Non-fatal: SubscriptionService also auto-inits on first subscription check
      console.warn('[ensureWorkspace] Trial init API call failed (non-fatal):', e);
    }
  }
}
