export interface VoiceInfo {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  languageCode: string;
}

export interface LanguageInfo {
  code: string;
  name: string;
}

export class LanguageCapabilityRegistry {
  private static readonly STT_LANGUAGES: Record<string, LanguageInfo[]> = {
    openai: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese' },
    ],
    google: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
    ],
    deepgram: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
    ],
    azure: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
    ],
    assemblyai: [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'pt', name: 'Portuguese' },
    ],
  };

  private static readonly TTS_LANGUAGES: Record<string, LanguageInfo[]> = {
    openai: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese' },
    ],
    elevenlabs: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese' },
    ],
    google: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
    ],
    azure: [
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
    ],
  };

  private static readonly TTS_VOICES: Record<string, VoiceInfo[]> = {
    openai: [
      { id: 'alloy', name: 'Alloy', gender: 'neutral', languageCode: 'all' },
      { id: 'echo', name: 'Echo', gender: 'male', languageCode: 'all' },
      { id: 'fable', name: 'Fable', gender: 'neutral', languageCode: 'all' },
      { id: 'onyx', name: 'Onyx', gender: 'male', languageCode: 'all' },
      { id: 'nova', name: 'Nova', gender: 'female', languageCode: 'all' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female', languageCode: 'all' },
    ],
    elevenlabs: [
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', languageCode: 'all' },
      { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'female', languageCode: 'all' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'female', languageCode: 'all' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'male', languageCode: 'all' },
      { id: 'TxGEqn7nUa5To4YHHCOx', name: 'Josh', gender: 'male', languageCode: 'all' },
      { id: 'VR6A4UBqhstHWoyxbc8j', name: 'Arnold', gender: 'male', languageCode: 'all' },
      { id: 'pNInz6obpgdq51JdMT5y', name: 'Adam', gender: 'male', languageCode: 'all' },
      { id: 'yoZ06aOLSsp5O3ADYu15', name: 'Sam', gender: 'male', languageCode: 'all' },
    ],
    google: [
      { id: 'en-US-Neural2-F', name: 'Jenny (US)', gender: 'female', languageCode: 'en' },
      { id: 'en-US-Neural2-H', name: 'Guy (US)', gender: 'male', languageCode: 'en' },
      { id: 'hi-IN-Neural2-C', name: 'Madhur (Hindi)', gender: 'male', languageCode: 'hi' },
      { id: 'hi-IN-Wavenet-D', name: 'Swara (Hindi)', gender: 'female', languageCode: 'hi' },
      { id: 'ta-IN-Wavenet-A', name: 'Valluvar (Tamil)', gender: 'female', languageCode: 'ta' },
      { id: 'ta-IN-Wavenet-B', name: 'Venkat (Tamil)', gender: 'male', languageCode: 'ta' },
      { id: 'es-ES-Neural2-F', name: 'Elvira (Spanish)', gender: 'female', languageCode: 'es' },
      { id: 'fr-FR-Neural2-A', name: 'Denise (French)', gender: 'female', languageCode: 'fr' },
      { id: 'de-DE-Neural2-F', name: 'Katja (German)', gender: 'female', languageCode: 'de' },
    ],
    azure: [
      { id: 'en-US-JennyNeural', name: 'Jenny (US)', gender: 'female', languageCode: 'en' },
      { id: 'en-US-GuyNeural', name: 'Guy (US)', gender: 'male', languageCode: 'en' },
      { id: 'hi-IN-SwaraNeural', name: 'Swara (Hindi)', gender: 'female', languageCode: 'hi' },
      { id: 'hi-IN-MadhurNeural', name: 'Madhur (Hindi)', gender: 'male', languageCode: 'hi' },
      { id: 'ta-IN-VenkatNeural', name: 'Venkat (Tamil)', gender: 'female', languageCode: 'ta' },
      { id: 'ta-IN-ValluvarNeural', name: 'Valluvar (Tamil)', gender: 'male', languageCode: 'ta' },
      { id: 'es-ES-ElviraNeural', name: 'Elvira (Spanish)', gender: 'female', languageCode: 'es' },
      { id: 'fr-FR-DeniseNeural', name: 'Denise (French)', gender: 'female', languageCode: 'fr' },
      { id: 'de-DE-KatjaNeural', name: 'Katja (German)', gender: 'female', languageCode: 'de' },
    ],
  };

  static getSTTSupportedLanguages(providerName: string): LanguageInfo[] {
    const key = providerName.toLowerCase();
    return this.STT_LANGUAGES[key] || this.STT_LANGUAGES['openai'];
  }

  static getTTSSupportedLanguages(providerName: string): LanguageInfo[] {
    const key = providerName.toLowerCase();
    return this.TTS_LANGUAGES[key] || this.TTS_LANGUAGES['openai'];
  }

  static getTTSSupportedVoices(providerName: string, languageCode: string): VoiceInfo[] {
    const key = providerName.toLowerCase();
    const voices = this.TTS_VOICES[key] || this.TTS_VOICES['openai'];
    const normalizedLang = languageCode.split('-')[0].toLowerCase();
    
    return voices.filter(v => v.languageCode === 'all' || v.languageCode === normalizedLang);
  }

  static getCombinedSupportedLanguages(sttProvider: string, ttsProvider: string): LanguageInfo[] {
    const sttLangs = this.getSTTSupportedLanguages(sttProvider);
    const ttsLangs = this.getTTSSupportedLanguages(ttsProvider);
    
    return sttLangs.filter(stt => ttsLangs.some(tts => tts.code === stt.code));
  }
}
