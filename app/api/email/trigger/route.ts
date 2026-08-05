import { NextRequest, NextResponse } from 'next/server';
import { triggerLifecycleEvent } from '@/lib/email/queue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, eventName, payload } = body;

    if (!userId || !eventName || !payload) {
      return NextResponse.json({ error: 'Missing required parameters: userId, eventName, payload' }, { status: 400 });
    }

    await triggerLifecycleEvent(userId, eventName, payload);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API Trigger Email] Error:', err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
