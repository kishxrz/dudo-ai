import { NextRequest, NextResponse } from 'next/server';
import { initClient, getQR } from '@/lib/whatsapp-client';
import QRCode from 'qrcode';
import { canUseFeature } from '@/lib/billing-entitlements-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = await req.json();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    if (process.env.VERCEL) {
      return NextResponse.json({ 
        error: "Vercel Deployment: WhatsApp Web client (whatsapp-web.js) requires a persistent server to run Puppeteer/Chromium, and cannot run inside Vercel's Serverless Functions. Please host Dudo on a VM/container, or use Telegram which is fully supported." 
      }, { status: 400 });
    }

    const allowed = await canUseFeature(workspaceId, 'channels.whatsapp');
    if (!allowed) {
      return NextResponse.json({ error: 'Upgrade required: WhatsApp channel is not supported on your current plan.' }, { status: 403 });
    }

    // Call initClient to start connection asynchronously
    initClient(workspaceId).catch((err) => {
      console.error('Async initClient error:', err);
    });

    // Wait 5 seconds for QR code to be generated
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const qr = getQR();
    if (!qr) {
      return NextResponse.json({ status: "initializing" });
    }

    // Convert string QR code to base64 image URL
    const qrBase64 = await QRCode.toDataURL(qr);
    return NextResponse.json({ qr: qrBase64 });
  } catch (err: any) {
    console.error('Error in WhatsApp connect route:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
