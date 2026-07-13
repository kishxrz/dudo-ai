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
 * Safe to call multiple times (uses setDoc with merge: false check).
 */
export async function ensureWorkspace(uid: string, displayName?: string | null) {
  if (!db) return;

  const wsRef = doc(db, 'workspaces', uid);
  const wsSnap = await getDoc(wsRef);

  if (!wsSnap.exists()) {
    // Create workspace
    await setDoc(wsRef, {
      id: uid,
      ownerId: uid,
      name: `${displayName ?? 'My'} Workspace`,
      plan: 'starter',
      timezone: 'Asia/Kolkata',
      createdAt: serverTimestamp(),
    });

    // Create default assistant
    const assistantRef = doc(db, 'workspaces', uid, 'assistants', 'assistant-1');
    await setDoc(assistantRef, {
      id: 'assistant-1',
      workspaceId: uid,
      name: `${displayName ? `${displayName}'s` : 'My'} AI Assistant`,
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
  }
}
