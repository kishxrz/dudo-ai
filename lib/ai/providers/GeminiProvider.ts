import { ILLMProvider } from './ILLMProvider';
import { ConversationRequest } from '../types/ConversationRequest';
import { ConversationResponse } from '../types/ConversationResponse';

export class GeminiProvider implements ILLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private mapMessages(request: ConversationRequest) {
    return request.messages.map(m => {
      let parts: Record<string, unknown>[] = [];
      if (typeof m.content === 'string') {
        parts = [{ text: m.content }];
      } else if (Array.isArray(m.content)) {
        parts = m.content.map(part => {
          if (part.type === 'text') {
            return { text: part.text || '' };
          } else if (part.type === 'image_url' && part.image_url?.url) {
            const url = part.image_url.url;
            const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
            if (match) {
              return {
                inlineData: {
                  mimeType: match[1],
                  data: match[2]
                }
              };
            }
          }
          return null;
        }).filter(Boolean) as Record<string, unknown>[];
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });
  }

  async generateResponse(request: ConversationRequest): Promise<ConversationResponse> {
    const contents = this.mapMessages(request);
    const geminiModel = request.model.startsWith('gemini-') ? request.model : 'gemini-2.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${this.apiKey}`;

    const startTs = Date.now();
    console.log(`[GeminiProvider] ▶ fetch START — model=${geminiModel}`);
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: request.systemPrompt }]
        },
        generationConfig: {
          temperature: request.temperature,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });
    console.log(`[GeminiProvider] ✔ fetch DONE — ${Date.now() - startTs}ms status=${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API responded with ${res.status}: ${text}`);
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const inputTokens = data.usageMetadata?.promptTokenCount || Math.round(JSON.stringify(contents).length / 4);
    const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.round(reply.length / 4);

    return {
      reply,
      inputTokens,
      outputTokens,
    };
  }

  async *generateResponseStream(request: ConversationRequest): AsyncGenerator<{ text: string; inputTokens?: number; outputTokens?: number }> {
    const contents = this.mapMessages(request);
    const geminiModel = request.model.startsWith('gemini-') ? request.model : 'gemini-2.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?key=${this.apiKey}`;

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: request.systemPrompt }]
        },
        generationConfig: {
          temperature: request.temperature,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini Streaming API responded with ${res.status}: ${text}`);
    }

    const reader = res.body;
    if (!reader) return;

    const decoder = new TextDecoder();
    for await (const chunk of reader as unknown as AsyncIterable<Uint8Array>) {
      const text = decoder.decode(chunk, { stream: true });
      const matches = text.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
      if (matches) {
        for (const m of matches) {
          const valMatch = m.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (valMatch) {
            try {
              const parsed = JSON.parse(`{"t": "${valMatch[1]}"}`);
              yield { text: parsed.t };
            } catch {
              // ignore
            }
          }
        }
      }
    }
  }
}
