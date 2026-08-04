import { NextRequest, NextResponse } from 'next/server';
import { processQueue } from '@/lib/email/queue';

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitVal = parseInt(searchParams.get('limit') || '10');
    
    // Trigger queue processing
    const stats = await processQueue(limitVal);
    
    return NextResponse.json({ 
      success: true, 
      processed: stats.processed,
      sent: stats.sent,
      failed: stats.failed
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
