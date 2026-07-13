import { NextResponse } from 'next/server';
import { getStatus } from '@/lib/whatsapp-client';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const status = getStatus();
    return NextResponse.json({ status });
  } catch (err: any) {
    console.error('Error in WhatsApp status route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
