'use client';

import { useAuth } from '@/contexts/AuthContext';
import { getWorkspaceId } from '@/lib/workspace';

/**
 * Drop-in hook to replace every hardcoded 'workspace-1'.
 *
 * Usage:
 *   const { workspaceId } = useWorkspace();
 *   const docRef = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
 */
export function useWorkspace() {
  const { currentUser } = useAuth();
  // Falls back to 'dev-user-id' when Firebase is not configured (mock mode)
  const workspaceId = currentUser ? getWorkspaceId(currentUser.uid) : 'dev-user-id';
  return { workspaceId };
}
