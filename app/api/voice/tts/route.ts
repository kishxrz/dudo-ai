import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';
import { TTSProviderRegistry } from '@/lib/ai/providers/TTSProviderRegistry';
import { LanguageCapabilityRegistry } from '@/lib/ai/providers/LanguageCapabilityRegistry';

export const runtime = 'nodejs';
export const maxDuration = 30;

import { z } from 'zod';

const ttsPayloadSchema = z.object({
  text: z.string().min(1, 'Text is required for speech synthesis.'),
  workspaceId: z.string().optional(),
  voice: z.string().optional(),
  provider: z.string().optional(),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0),
  language: z.string().optional().default('en'),
});

/**
 * POST /api/voice/tts
 *
 * Accepts JSON body: { text, workspaceId, voice, provider, speed, language }
 * Resolves the API key server-side and calls TTSProviderRegistry.
 * Returns audio/mpeg stream or text-only fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = ttsPayloadSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ 
        error: 'Invalid payload verification failed', 
        details: parseResult.error.format() 
      }, { status: 400 });
    }

    const { text, workspaceId, voice, provider: requestedProvider, speed, language } = parseResult.data;

    // Authenticate and enforce workspace isolation if workspaceId is provided
    if (workspaceId) {
      const denied = await requireSubscription(req, workspaceId);
      if (denied) return denied;
    }

    // Resolve TTS provider and voice
    let ttsProvider = requestedProvider || 'openai';
    let ttsVoice = voice || '';
    let apiKey = '';

    // If workspaceId is provided, look up assistant settings
    if (workspaceId) {
      const adminDb = getAdminDb();
      if (adminDb) {
        try {
          const assSnap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
          if (assSnap.exists) {
            const assData = assSnap.data();
            if (assData?.ttsProvider && !requestedProvider) {
              ttsProvider = assData.ttsProvider;
            }
            if (assData?.ttsVoice && !voice) {
              ttsVoice = assData.ttsVoice;
            }
          }

          const provSnap = await adminDb.doc(`workspaces/${workspaceId}/providers/${ttsProvider}`).get();
          const provData = provSnap.data();
          if (provSnap.exists && provData?.apiKey) {
            apiKey = provData.apiKey;
          }
        } catch (dbErr) {
          console.warn('[TTS Route] Firestore lookup failed (non-fatal, using fallbacks):', dbErr);
        }
      }
    }

    // Fallback to environment variables if apiKey is empty
    if (!apiKey) {
      const keyName = ttsProvider.toLowerCase();
      if (keyName === 'openai') {
        apiKey = process.env.OPENAI_API_KEY || '';
      } else if (keyName === 'elevenlabs') {
        apiKey = process.env.ELEVENLABS_API_KEY || '';
      } else if (keyName === 'google' || keyName === 'googlecloud') {
        apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      } else if (keyName === 'azure') {
        apiKey = process.env.AZURE_SPEECH_KEY || '';
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key for Text-to-Speech provider '${ttsProvider}' is not configured.` },
        { status: 400 }
      );
    }

    // Check language compatibility via LanguageCapabilityRegistry
    const normalizedLang = language.split('-')[0].toLowerCase();
    const supportedLangs = LanguageCapabilityRegistry.getTTSSupportedLanguages(ttsProvider);
    const isSupported = supportedLangs.some(l => l.code === normalizedLang);

    if (!isSupported) {
      // Graceful fallback: notify the user that voice output is unavailable for this language
      return NextResponse.json({
        fallback: true,
        message: `Voice output is unavailable in ${normalizedLang.toUpperCase()} using ${ttsProvider}.`,
        text: text,
      });
    }

    // Select default voice for the language if not provided or empty
    const availableVoices = LanguageCapabilityRegistry.getTTSSupportedVoices(ttsProvider, normalizedLang);
    let activeVoice = ttsVoice;
    if (!activeVoice || !availableVoices.some(v => v.id === activeVoice)) {
      activeVoice = availableVoices[0]?.id || 'nova'; // Fallback to nova for OpenAI
    }

    // Synthesize using TTSProviderRegistry
    const ttsEngine = TTSProviderRegistry.getProvider(ttsProvider, apiKey);
    const { audioBuffer, contentType } = await ttsEngine.synthesize(text, activeVoice, speed, { language });

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
        'X-Audio-Voice': activeVoice,
        'X-Audio-Provider': ttsProvider,
      },
    });

  } catch (err: any) {
    console.error('[TTS Route] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Text-to-speech synthesis failed. Please try again.' },
      { status: 500 }
    );
  }
}
