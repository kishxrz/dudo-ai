import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { validateProviderKey } from '@/lib/ai/ServerProviderResolver';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';

/**
 * POST /api/agent/validate-key
 *
 * Body: { workspaceId: string, provider: string, apiKey: string, model: string }
 *
 * Validates the supplied API key against the live provider endpoint.
 * On success, writes the key + metadata to Firestore (server-side, Firebase Admin).
 * NEVER returns the API key in the response.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { workspaceId, provider, apiKey, model, modelOnly } = body;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspaceId is required.' }, { status: 400 });
    }
    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({ error: 'provider is required.' }, { status: 400 });
    }

    const denied = await requireSubscription(req, workspaceId);
    if (denied) return denied;

    // Model-only update: skip validation, just update the model field
    if (modelOnly === true) {
      const adminDb = getAdminDb();
      if (!adminDb) {
        return NextResponse.json({ error: 'Firebase Admin SDK not initialised.' }, { status: 500 });
      }
      try {
        await adminDb.doc(`workspaces/${workspaceId}/providers/${provider}`).set(
          { model: model || null, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      } catch (e) {
        console.error('[validate-key] Model-only update failed:', e);
      }
      return NextResponse.json({ valid: true, modelUpdated: true });
    }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.startsWith('••••')) {
      return NextResponse.json({ error: 'A real API key is required (not a masked value).' }, { status: 400 });
    }

    // 1. Validate the key against the provider
    const validation = await validateProviderKey(provider, apiKey);

    if (!validation.valid) {
      return NextResponse.json(
        { valid: false, error: validation.reason || 'API key validation failed.' },
        { status: 200 } // 200 so the client can read the body
      );
    }

    // 2. On success, persist to Firestore via Admin SDK (no auth header needed)
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK is not initialised. Cannot persist API key.' },
        { status: 500 }
      );
    }

    const providerDocPath = `workspaces/${workspaceId}/providers/${provider}`;
    const providerRef = adminDb.doc(providerDocPath);

    // Mark all other providers as inactive first
    try {
      const allProviders = await adminDb.collection(`workspaces/${workspaceId}/providers`).get();
      const batch = adminDb.batch();
      allProviders.forEach((d) => {
        if (d.id !== provider) {
          batch.set(d.ref, { active: false }, { merge: true });
        }
      });
      await batch.commit();
    } catch (e) {
      console.warn('[validate-key] Failed to deactivate other providers:', e);
    }

    // Write the new provider config
    await providerRef.set(
      {
        provider,
        apiKey,                // stored server-side only
        model: model || null,
        active: true,
        validatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 3. Return success — NO apiKey in response
    return NextResponse.json({ valid: true, provider, model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[validate-key] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
