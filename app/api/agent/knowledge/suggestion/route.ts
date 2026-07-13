import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { ProfileSuggestionService } from '@/lib/ai/ProfileSuggestionService';

async function authorizeOwner(req: NextRequest, workspaceId: string): Promise<boolean> {
  const adminDb = getAdminDb();
  if (!adminDb) return true; // bypass in local dev mock mode

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.substring(7);
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken.uid === workspaceId;
  } catch (e) {
    console.error('[Auth Error] verifyIdToken failed for Suggestions:', e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workspaceId, suggestionId, action, fieldName, newValue } = body;
  if (!workspaceId || !action || (action !== 'rollback' && !suggestionId)) {
    return NextResponse.json({ error: 'workspaceId, action and suggestionId (except for rollback) are required' }, { status: 400 });
  }

  const authorized = await authorizeOwner(req, workspaceId);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized workspace access' }, { status: 401 });
  }

  try {
    if (action === 'approve') {
      if (!fieldName || newValue === undefined) {
        return NextResponse.json({ error: 'fieldName and newValue are required for approval' }, { status: 400 });
      }
      await ProfileSuggestionService.approveSuggestion(workspaceId, suggestionId, fieldName, newValue);
      console.log(`[Suggestions API] Approved and applied suggestion ${suggestionId} in workspace: ${workspaceId}`);
    } else if (action === 'reject') {
      await ProfileSuggestionService.rejectSuggestion(workspaceId, suggestionId);
      console.log(`[Suggestions API] Rejected suggestion ${suggestionId} in workspace: ${workspaceId}`);
    } else if (action === 'replace') {
      await ProfileSuggestionService.replaceProfile(workspaceId, suggestionId);
      console.log(`[Suggestions API] Replaced Business Profile using suggestion ${suggestionId} in workspace: ${workspaceId}`);
    } else if (action === 'keep_as_knowledge') {
      await ProfileSuggestionService.keepAsKnowledge(workspaceId, suggestionId);
      console.log(`[Suggestions API] Set RAG-only using suggestion ${suggestionId} in workspace: ${workspaceId}`);
    } else if (action === 'rollback') {
      const { snapshotId } = body;
      await ProfileSuggestionService.rollbackProfile(workspaceId, snapshotId);
      console.log(`[Suggestions API] Rolled back Business Profile in workspace: ${workspaceId}`);
    } else {
      return NextResponse.json({ error: 'Invalid action. Must be approve, reject, replace, keep_as_knowledge, or rollback' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Suggestions API] Execution error:', err);
    return NextResponse.json({ error: err.message || 'Suggestions execution error' }, { status: 500 });
  }
}
