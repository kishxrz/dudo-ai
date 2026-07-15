import { NextRequest, NextResponse } from 'next/server';
import { initTrialSubscription } from '@/lib/subscription/SubscriptionService';

/**
 * POST /api/billing/init-trial
 * Called by ensureWorkspace() immediately after new workspace creation.
 * Idempotent — safe to call multiple times (will not overwrite existing subscription).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId } = body;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    await initTrialSubscription(workspaceId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[init-trial] Error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
