/**
 * ServerProviderResolver — single source of truth for resolving the active AI
 * provider configuration on the server side.
 *
 * Uses Firebase Admin SDK exclusively. Never falls back to client-side Firestore.
 * Never exposes API keys in logs or responses.
 */

import { getAdminDb } from '@/lib/firebase-admin';
import { ApiProvider } from '@/types';

export interface ResolvedProvider {
  name: ApiProvider;
  model: string;
  /** Raw API key — server-side only. Never send to browser. */
  apiKey: string;
}

const DEFAULT_MODELS: Record<ApiProvider, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-3-5-haiku-latest',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openrouter-best-value',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-large-latest',
};

/**
 * Resolve the active provider for a workspace.
 *
 * Resolution order:
 *  1. Provider doc with active=true AND apiKey
 *  2. Requested provider (if supplied) — any doc with apiKey regardless of active flag
 *  3. First provider doc found with an apiKey
 *
 * Returns null if no provider with a valid API key is found.
 */
export async function resolveActiveProvider(
  workspaceId: string,
  requestedProviderName?: string
): Promise<ResolvedProvider | null> {
  const adminDb = getAdminDb();

  if (!adminDb) {
    throw new Error(
      'Firebase Admin SDK is not initialised. Ensure FIREBASE_ADMIN_PROJECT_ID, ' +
      'FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY are set.'
    );
  }

  const collectionPath = `workspaces/${workspaceId}/providers`;
  let snap;
  try {
    snap = await adminDb.collection(collectionPath).get();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to read provider config from Firestore: ${msg}`);
  }

  if (snap.empty) {
    return null;
  }

  type DocEntry = { id: string; data: Record<string, unknown> };

  let activeDoc: DocEntry | null = null;
  let requestedDoc: DocEntry | null = null;
  let fallbackDoc: DocEntry | null = null;

  snap.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    if (!data.apiKey) return; // skip entries without a key

    if (data.active === true && activeDoc === null) {
      activeDoc = { id: d.id, data };
    }
    if (requestedProviderName && d.id === requestedProviderName && requestedDoc === null) {
      requestedDoc = { id: d.id, data };
    }
    if (fallbackDoc === null) {
      fallbackDoc = { id: d.id, data };
    }
  });

  const chosen: DocEntry | null = activeDoc ?? requestedDoc ?? fallbackDoc;
  if (!chosen) return null;

  const name = (chosen as DocEntry).id as ApiProvider;
  const chosenData = (chosen as DocEntry).data;
  const model: string = (chosenData.model as string) || DEFAULT_MODELS[name] || 'gpt-4o-mini';
  const apiKey: string = chosenData.apiKey as string;

  return { name, model, apiKey };
}

/**
 * Validate a provider API key by making the smallest practical request.
 * Returns { valid: true } on success or { valid: false, reason: string } on failure.
 * NEVER throws — errors are returned as structured results.
 */
export async function validateProviderKey(
  providerName: string,
  apiKey: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    switch (providerName.toLowerCase()) {
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) return { valid: true };
        const errData = await res.json().catch(() => ({}));
        return { valid: false, reason: errData?.error?.message || `HTTP ${res.status}` };
      }

      case 'anthropic': {
        // Smallest possible Anthropic request — 1-token completion
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        if (res.ok) return { valid: true };
        // 400 on empty response is still auth-valid
        if (res.status === 400) return { valid: true };
        const errData = await res.json().catch(() => ({}));
        return { valid: false, reason: errData?.error?.message || `HTTP ${res.status}` };
      }

      case 'gemini': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (res.ok) return { valid: true };
        const errData = await res.json().catch(() => ({}));
        return { valid: false, reason: errData?.error?.message || `HTTP ${res.status}` };
      }

      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) return { valid: true };
        const errData = await res.json().catch(() => ({}));
        return { valid: false, reason: errData?.error?.message || `HTTP ${res.status}` };
      }

      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) return { valid: true };
        const errData = await res.json().catch(() => ({}));
        return { valid: false, reason: errData?.error?.message || `HTTP ${res.status}` };
      }

      case 'deepseek': {
        const res = await fetch('https://api.deepseek.com/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) return { valid: true };
        const errData = await res.json().catch(() => ({}));
        return { valid: false, reason: errData?.error?.message || `HTTP ${res.status}` };
      }

      case 'mistral': {
        const res = await fetch('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) return { valid: true };
        const errData = await res.json().catch(() => ({}));
        return { valid: false, reason: errData?.error?.message || `HTTP ${res.status}` };
      }

      default:
        return { valid: false, reason: `Unsupported provider: ${providerName}` };
    }
  } catch (e: unknown) {
    const reason = e instanceof Error ? e.message : 'Network error';
    return { valid: false, reason };
  }
}
