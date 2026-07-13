import { NextResponse } from 'next/server';
import { destroyClient } from '@/lib/whatsapp-client';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await destroyClient();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in WhatsApp disconnect route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
