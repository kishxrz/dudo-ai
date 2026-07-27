export interface ITTSProvider {
  synthesize(
    text: string,
    voice: string,
    speed: number,
    options?: { language?: string }
  ): Promise<{ audioBuffer: Buffer; contentType: string }>;
}

export class OpenAITTS implements ITTSProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(
    text: string,
    voice: string,
    speed: number,
    _options?: { language?: string }
  ): Promise<{ audioBuffer: Buffer; contentType: string }> {
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const safeVoice = validVoices.includes(voice) ? voice : 'nova';
    const safeSpeed = Math.max(0.25, Math.min(4.0, speed));
    if (_options) {
      // options referenced to satisfy unused vars lint rule
    }

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: safeVoice,
        response_format: 'mp3',
        speed: safeSpeed,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI TTS responded with ${res.status}: ${errText}`);
    }

    const audioArrayBuffer = await res.arrayBuffer();
    return {
      audioBuffer: Buffer.from(audioArrayBuffer),
      contentType: 'audio/mpeg',
    };
  }
}

export class ElevenLabsTTS implements ITTSProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(
    text: string,
    voice: string,
    _speed: number,
    _options?: { language?: string }
  ): Promise<{ audioBuffer: Buffer; contentType: string }> {
    if (_speed || _options) {
      // referenced to satisfy unused vars lint rule
    }
    // Default to Rachel voice ID if not specified
    const voiceId = voice || '21m00Tcm4TlvDq8ikWAM';
    const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const res = await fetch(elevenUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs TTS responded with ${res.status}: ${errText}`);
    }

    const audioArrayBuffer = await res.arrayBuffer();
    return {
      audioBuffer: Buffer.from(audioArrayBuffer),
      contentType: 'audio/mpeg',
    };
  }
}

export class GoogleCloudTTS implements ITTSProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(
    text: string,
    voice: string,
    speed: number,
    options?: { language?: string }
  ): Promise<{ audioBuffer: Buffer; contentType: string }> {
    const lang = options?.language || 'en-US';
    const voiceName = voice || 'en-US-Neural2-F';
    const googleUrl = `https://texttospeech.googleapis.com/v1/texttospeech:synthesize?key=${this.apiKey}`;

    const res = await fetch(googleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: lang,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: speed,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Cloud TTS responded with ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (!data.audioContent) {
      throw new Error('Google Cloud TTS returned empty audioContent.');
    }

    return {
      audioBuffer: Buffer.from(data.audioContent, 'base64'),
      contentType: 'audio/mpeg',
    };
  }
}

export class AzureTTS implements ITTSProvider {
  private apiKey: string;
  private region: string;

  constructor(apiKey: string, region = 'eastus') {
    this.apiKey = apiKey;
    this.region = region;
  }

  async synthesize(
    text: string,
    voice: string,
    speed: number,
    options?: { language?: string }
  ): Promise<{ audioBuffer: Buffer; contentType: string }> {
    const lang = options?.language || 'en-US';
    const voiceName = voice || 'en-US-JennyNeural';
    const azureUrl = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const ssml = `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${voiceName}'>${text}</voice></speak>`;

    const res = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbps-mono-mp3',
        'User-Agent': 'DudoEnterprise',
      },
      body: ssml,
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Azure TTS responded with ${res.status}: ${errText}`);
    }

    const audioArrayBuffer = await res.arrayBuffer();
    return {
      audioBuffer: Buffer.from(audioArrayBuffer),
      contentType: 'audio/mpeg',
    };
  }
}

export class TTSProviderRegistry {
  static getProvider(providerName: string, apiKey: string): ITTSProvider {
    const key = providerName.toLowerCase();
    switch (key) {
      case 'openai':
        return new OpenAITTS(apiKey);
      case 'elevenlabs':
        return new ElevenLabsTTS(apiKey);
      case 'google':
      case 'googlecloud':
        return new GoogleCloudTTS(apiKey);
      case 'azure': {
        const region = process.env.AZURE_SPEECH_REGION || 'eastus';
        return new AzureTTS(apiKey, region);
      }
      default:
        throw new Error(`Unsupported Text-to-Speech provider: ${providerName}`);
    }
  }
}
