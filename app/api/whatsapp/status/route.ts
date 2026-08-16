import { NextRequest, NextResponse } from 'next/server';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    const denied = await requireSubscription(req, workspaceId, 'whatsapp');
    if (denied) return denied;

    const authorization = req.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, { status: 401 });
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:4000';
    const internalSecret = process.env.WHATSAPP_INTERNAL_SECRET || process.env.WHATSAPP_SERVICE_SECRET || '948ae6bcb0f8421c1e060aadee9d08d3cd75c366946fdc966ee290f7262ee7f1';
    if (!serviceUrl || !internalSecret) {
      // Graceful fallback — don't expose config errors to the client
      return NextResponse.json({ status: 'disconnected', message: 'Service not configured' });
    }

    let response: Response;
    try {
      response = await fetch(`${serviceUrl}/v1/workspaces/${workspaceId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': authorization,
          'x-internal-secret': internalSecret,
          'Content-Type': 'application/json'
        },
        // 8-second timeout to prevent hanging
        signal: AbortSignal.timeout(8000),
      });
    } catch (fetchErr: any) {
      // Network error / timeout — treat as disconnected gracefully
      console.warn('[WhatsApp Status] Upstream service unreachable:', fetchErr.message);
      return NextResponse.json({ status: 'disconnected', message: 'Service temporarily unavailable' });
    }

    // If the upstream returns 5xx, return disconnected gracefully instead of propagating the error
    if (!response.ok) {
      if (response.status >= 500) {
        console.warn(`[WhatsApp Status] Upstream returned ${response.status} — returning disconnected gracefully`);
        return NextResponse.json({ status: 'disconnected', message: 'Service temporarily unavailable' });
      }
      const errText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errText);
      } catch {
        errorJson = { error: errText || 'Failed to get status' };
      }
      return NextResponse.json(errorJson, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[WhatsApp Status Proxy Error] Exception in status route:', {
      route: '/api/whatsapp/status',
      message: err.message,
      stack: err.stack
    });
    // Return a graceful disconnected state rather than a 500
    return NextResponse.json({ status: 'disconnected', message: 'Status check failed' });
  }
}

