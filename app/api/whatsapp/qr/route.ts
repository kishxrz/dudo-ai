import { NextResponse } from 'next/server';
import { getQR } from '@/lib/whatsapp-client';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const qr = getQR();
    if (!qr) {
      // No QR currently available
      return new NextResponse(null, { status: 204 });
    }

    // Return PNG binary to avoid sending large data URLs in JSON
    const buffer = await QRCode.toBuffer(qr);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Error in WhatsApp QR route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
