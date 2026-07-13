import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { canUseFeature } from '@/lib/billing-entitlements-server';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, token } = await req.json();

    if (!workspaceId || !token) {
      return NextResponse.json({ error: 'Missing workspaceId or token' }, { status: 400 });
    }

    // 1. Verify entitlements
    const allowed = await canUseFeature(workspaceId, 'channels.telegram');
    if (!allowed) {
      return NextResponse.json({ error: 'Upgrade required: Telegram channel is not supported on your current plan.' }, { status: 403 });
    }

    // 2. Validate token against Telegram API
    const botToken = token.trim();
    const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    if (!getMeRes.ok) {
      return NextResponse.json({ error: 'Invalid Telegram Bot Token' }, { status: 400 });
    }
    const getMeData = await getMeRes.json();
    if (!getMeData.ok || !getMeData.result) {
      return NextResponse.json({ error: 'Failed to retrieve Telegram Bot details.' }, { status: 400 });
    }

    const botInfo = getMeData.result;
    const botUsername = botInfo.username;

    // 3. Register Webhook
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    // Ensure no trailing slash issue
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const webhookUrl = `${cleanBaseUrl}/api/webhooks/telegram/${workspaceId}`;

    // Generate secret_token for security
    const webhookSecretToken = crypto.randomBytes(32).toString('hex');

    const setWebhookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecretToken
      })
    });

    if (!setWebhookRes.ok) {
      const errText = await setWebhookRes.text();
      console.error('[Telegram Connect] setWebhook failed:', errText);
      return NextResponse.json({ error: 'Failed to set Telegram webhook.' }, { status: 500 });
    }

    const webhookData = await setWebhookRes.json();
    if (!webhookData.ok) {
      return NextResponse.json({ error: 'Telegram setWebhook was rejected.' }, { status: 500 });
    }

    // 4. Save to Firestore
    const payload = {
      status: 'connected',
      token: botToken,
      platform: 'telegram',
      botUsername,
      webhookSecretToken,
      connectedAt: new Date()
    };

    const adminDb = getAdminDb();
    if (adminDb) {
      await adminDb.doc(`workspaces/${workspaceId}/channels/ch-tg`).set(payload, { merge: true });
    } else if (db) {
      await setDoc(doc(db, 'workspaces', workspaceId, 'channels', 'ch-tg'), payload, { merge: true });
    }

    // Never return the token back to the browser in normal flow
    return NextResponse.json({ success: true, botUsername });
  } catch (err: unknown) {
    console.error('Error in Telegram connect route:', err);
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
