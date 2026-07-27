import { NextRequest, NextResponse } from 'next/server';
import { LanguageCapabilityRegistry } from '@/lib/ai/providers/LanguageCapabilityRegistry';

export const runtime = 'nodejs';

/**
 * GET /api/voice/capabilities
 *
 * Query params:
 *   sttProvider: string
 *   ttsProvider: string
 *   languageCode: string (optional, e.g. 'en')
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sttProvider = searchParams.get('sttProvider') || 'openai';
    const ttsProvider = searchParams.get('ttsProvider') || 'openai';
    const languageCode = searchParams.get('languageCode') || 'en';

    const sttLanguages = LanguageCapabilityRegistry.getSTTSupportedLanguages(sttProvider);
    const ttsLanguages = LanguageCapabilityRegistry.getTTSSupportedLanguages(ttsProvider);
    const ttsVoices = LanguageCapabilityRegistry.getTTSSupportedVoices(ttsProvider, languageCode);
    const combinedLanguages = LanguageCapabilityRegistry.getCombinedSupportedLanguages(sttProvider, ttsProvider);

    return NextResponse.json({
      sttLanguages,
      ttsLanguages,
      ttsVoices,
      combinedLanguages,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch capabilities.' },
      { status: 500 }
    );
  }
}
