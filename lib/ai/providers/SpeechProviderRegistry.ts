
export interface ISpeechProvider {
  transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { language?: string }
  ): Promise<{ transcript: string; language: string; confidence: number }>;
}

export class OpenAIWhisperSpeech implements ISpeechProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { language?: string }
  ): Promise<{ transcript: string; language: string; confidence: number }> {
    const whisperForm = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    whisperForm.append('file', blob, 'recording.webm');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('response_format', 'verbose_json');
    if (options?.language) {
      whisperForm.append('language', options.language);
    } else {
      whisperForm.append(
        'prompt',
        'The speaker may use Tamil, Hindi, English, Tanglish, or Hinglish. Transcribe accurately.'
      );
    }

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: whisperForm,
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI Whisper STT responded with ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const transcript = data.text?.trim() || '';
    const language = data.language || 'en';
    const avgLogprob = data.segments?.[0]?.avg_logprob ?? -0.5;
    const confidence = Math.max(0, Math.min(1, 1 + avgLogprob));

    return { transcript, language, confidence };
  }
}

export class GoogleSpeech implements ISpeechProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { language?: string }
  ): Promise<{ transcript: string; language: string; confidence: number }> {
    const base64Audio = audioBuffer.toString('base64');
    const lang = options?.language || 'en-US';

    const googleUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`;
    const res = await fetch(googleUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 16000,
          languageCode: lang,
          alternativeLanguageCodes: ['hi-IN', 'ta-IN', 'es-ES', 'fr-FR'],
          enableAutomaticPunctuation: true,
        },
        audio: {
          content: base64Audio,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Speech STT responded with ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const results = data.results || [];
    const transcript = results.map((r: { alternatives?: { transcript?: string }[] }) => r.alternatives?.[0]?.transcript).join(' ').trim();
    const confidence = results[0]?.alternatives?.[0]?.confidence ?? 0.9;
    const language = results[0]?.languageCode || lang.split('-')[0];

    return { transcript, language, confidence };
  }
}

export class DeepgramSpeech implements ISpeechProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { language?: string }
  ): Promise<{ transcript: string; language: string; confidence: number }> {
    const lang = options?.language ? `&language=${options.language}` : '&detect_language=true';
    const dgUrl = `https://api.deepgram.com/v1/listen?smart_format=true&model=nova-2${lang}`;

    const res = await fetch(dgUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(audioBuffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Deepgram STT responded with ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const alternative = data.results?.channels?.[0]?.alternatives?.[0];
    const transcript = alternative?.transcript?.trim() || '';
    const language = data.results?.channels?.[0]?.detected_language || options?.language || 'en';
    const confidence = alternative?.confidence || 0.9;

    return { transcript, language, confidence };
  }
}

export class AzureSpeech implements ISpeechProvider {
  private apiKey: string;
  private region: string;

  constructor(apiKey: string, region = 'eastus') {
    this.apiKey = apiKey;
    this.region = region;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { language?: string }
  ): Promise<{ transcript: string; language: string; confidence: number }> {
    const lang = options?.language || 'en-US';
    const azureUrl = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${lang}&format=detailed`;

    const res = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(audioBuffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Azure STT responded with ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const transcript = data.DisplayText?.trim() || '';
    const confidence = data.NBest?.[0]?.Confidence || 0.9;
    const language = lang.split('-')[0];

    return { transcript, language, confidence };
  }
}

export class AssemblyAISpeech implements ISpeechProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioBuffer: Buffer,
    mimeType: string,
    options?: { language?: string }
  ): Promise<{ transcript: string; language: string; confidence: number }> {
    // 1. Upload audio buffer
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(audioBuffer),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`AssemblyAI Upload failed: ${errText}`);
    }

    const { upload_url } = await uploadRes.json();

    // 2. Submit transcription job
    const transcriptConfig: Record<string, string | boolean> = {
      audio_url: upload_url,
    };
    if (options?.language) {
      transcriptConfig.language_code = options.language;
    } else {
      transcriptConfig.language_detection = true;
    }

    const transRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcriptConfig),
    });

    if (!transRes.ok) {
      const errText = await transRes.text();
      throw new Error(`AssemblyAI transcript submission failed: ${errText}`);
    }

    const { id } = await transRes.json();

    // 3. Poll transcription completion
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { Authorization: this.apiKey },
      });

      if (!pollRes.ok) {
        throw new Error(`AssemblyAI status poll failed.`);
      }

      const pollData = await pollRes.json();
      if (pollData.status === 'completed') {
        return {
          transcript: pollData.text || '',
          language: pollData.language_code || 'en',
          confidence: pollData.confidence || 0.9,
        };
      } else if (pollData.status === 'error') {
        throw new Error(`AssemblyAI transcription error: ${pollData.error}`);
      }
      attempts++;
    }

    throw new Error('AssemblyAI transcription timed out.');
  }
}

export class SpeechProviderRegistry {
  static getProvider(providerName: string, apiKey: string): ISpeechProvider {
    const key = providerName.toLowerCase();
    switch (key) {
      case 'openai':
        return new OpenAIWhisperSpeech(apiKey);
      case 'google':
      case 'googlecloud':
        return new GoogleSpeech(apiKey);
      case 'deepgram':
        return new DeepgramSpeech(apiKey);
      case 'azure': {
        const region = process.env.AZURE_SPEECH_REGION || 'eastus';
        return new AzureSpeech(apiKey, region);
      }
      case 'assemblyai':
        return new AssemblyAISpeech(apiKey);
      default:
        throw new Error(`Unsupported Speech-to-Text provider: ${providerName}`);
    }
  }
}
