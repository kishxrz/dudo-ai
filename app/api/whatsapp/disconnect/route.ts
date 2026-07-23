import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
    }

    // Note: Disconnection is always allowed regardless of subscription/plan status.

    const authorization = req.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, { status: 401 });
    }

    const serviceUrl = process.env.WHATSAPP_SERVICE_URL || 'https://dudo-ai-production.up.railway.app';
    const internalSecret = process.env.WHATSAPP_INTERNAL_SECRET || process.env.WHATSAPP_SERVICE_SECRET || '948ae6bcb0f8421c1e060aadee9d08d3cd75c366946fdc966ee290f7262ee7f1';
    if (!serviceUrl || !internalSecret) {
      return NextResponse.json({ error: 'WhatsApp service is not configured' }, { status: 500 });
    }

    const response = await fetch(`${serviceUrl}/v1/workspaces/${workspaceId}/disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'x-internal-secret': internalSecret,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errText);
      } catch {
        errorJson = { error: errText || 'Failed to disconnect WhatsApp' };
      }
      return NextResponse.json(errorJson, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[WhatsApp Disconnect Proxy Error] Exception in disconnect route:', {
      route: '/api/whatsapp/disconnect',
      message: err.message,
      stack: err.stack
    });
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
