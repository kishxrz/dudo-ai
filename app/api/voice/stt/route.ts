import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireSubscription } from '@/lib/subscription/SubscriptionService';
import { SpeechProviderRegistry } from '@/lib/ai/providers/SpeechProviderRegistry';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/voice/stt
 *
 * Accepts a FormData audio file, resolves the configured STT provider and key,
 * transcribes it using SpeechProviderRegistry, and returns transcription + language info.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const clientApiKey = formData.get('apiKey') as string | null;
    const requestedProvider = formData.get('provider') as string | null;
    const workspaceId = formData.get('workspaceId') as string | null;
    const requestedLanguage = formData.get('language') as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
    }

    // Validate file size (max 25MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio file too large. Maximum 25MB.' }, { status: 400 });
    }

    // Authenticate and enforce workspace isolation if workspaceId is provided
    if (workspaceId) {
      const denied = await requireSubscription(req, workspaceId);
      if (denied) return denied;
    }

    // Resolve STT provider and API key
    let sttProvider = requestedProvider || 'openai';
    let apiKey = clientApiKey || '';

    // If workspaceId is provided, look up in Firestore settings
    if (workspaceId) {
      const adminDb = getAdminDb();
      if (adminDb) {
        try {
          // 1. Get assistant configuration for default STT provider
          const assSnap = await adminDb.doc(`workspaces/${workspaceId}/assistants/assistant-1`).get();
          if (assSnap.exists) {
            const assData = assSnap.data();
            if (assData?.sttProvider && !requestedProvider) {
              sttProvider = assData.sttProvider;
            }
          }

          // 2. Fetch the corresponding API key
          const provSnap = await adminDb.doc(`workspaces/${workspaceId}/providers/${sttProvider}`).get();
          const provData = provSnap.data();
          if (provSnap.exists && provData?.apiKey) {
            apiKey = provData.apiKey;
          }
        } catch (dbErr) {
          console.warn('[STT Route] Firestore lookup failed (non-fatal, using fallbacks):', dbErr);
        }
      }
    }

    // Fallback to environment variables if apiKey is still empty
    if (!apiKey) {
      const keyName = sttProvider.toLowerCase();
      if (keyName === 'openai') {
        apiKey = process.env.OPENAI_API_KEY || '';
      } else if (keyName === 'google' || keyName === 'googlecloud') {
        apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      } else if (keyName === 'deepgram') {
        apiKey = process.env.DEEPGRAM_API_KEY || '';
      } else if (keyName === 'azure') {
        apiKey = process.env.AZURE_SPEECH_KEY || '';
      } else if (keyName === 'assemblyai') {
        apiKey = process.env.ASSEMBLYAI_API_KEY || '';
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key for Speech-to-Text provider '${sttProvider}' is not configured.` },
        { status: 400 }
      );
    }

    // Transcribe using SpeechProviderRegistry
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const mimeType = audioFile.type || 'audio/webm';
    
    const provider = SpeechProviderRegistry.getProvider(sttProvider, apiKey);
    const options = requestedLanguage ? { language: requestedLanguage } : undefined;
    
    const transcriptionResult = await provider.transcribe(audioBuffer, mimeType, options);

    return NextResponse.json({
      transcript: transcriptionResult.transcript,
      language: transcriptionResult.language,
      confidence: parseFloat(transcriptionResult.confidence.toFixed(2)),
      duration: 0, // Fallback duration
    });

  } catch (err: any) {
    console.error('[STT Route] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Speech-to-text failed. Please try again.' },
      { status: 500 }
    );
  }
}
