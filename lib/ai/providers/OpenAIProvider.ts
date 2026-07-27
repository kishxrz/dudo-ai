import { ILLMProvider } from './ILLMProvider';
import { ConversationRequest } from '../types/ConversationRequest';
import { ConversationResponse } from '../types/ConversationResponse';

export class OpenAIProvider implements ILLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private mapMessages(request: ConversationRequest) {
    return request.messages.map(m => {
      let content: unknown = m.content;
      if (Array.isArray(m.content)) {
        content = m.content.map(part => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text || '' };
          } else if (part.type === 'image_url') {
            return {
              type: 'image_url',
              image_url: {
                url: part.image_url.url
              }
            };
          }
          return null;
        }).filter(Boolean);
      }
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content
      };
    });
  }

  async generateResponse(request: ConversationRequest): Promise<ConversationResponse> {
    const messages = [
      { role: 'system', content: request.systemPrompt },
      ...this.mapMessages(request)
    ];

    const startTs = Date.now();
    console.log(`[OpenAIProvider] ▶ fetch START — model=${request.model}`);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        temperature: request.temperature,
      }),
      signal: AbortSignal.timeout(30000),
    });
    console.log(`[OpenAIProvider] ✔ fetch DONE — ${Date.now() - startTs}ms status=${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API responded with ${res.status}: ${text}`);
    }

    const data = await res.json();
    return {
      reply: data.choices?.[0]?.message?.content || '',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }

  async *generateResponseStream(request: ConversationRequest): AsyncGenerator<{ text: string; inputTokens?: number; outputTokens?: number }> {
    const messages = [
      { role: 'system', content: request.systemPrompt },
      ...this.mapMessages(request)
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        temperature: request.temperature,
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI Streaming API responded with ${res.status}: ${text}`);
    }

    const reader = res.body;
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of reader as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleaned = line.trim();
        if (cleaned.startsWith('data:')) {
          const jsonStr = cleaned.substring(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { text: delta };
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }
}
