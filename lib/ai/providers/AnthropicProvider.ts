import { ILLMProvider } from './ILLMProvider';
import { ConversationRequest } from '../types/ConversationRequest';
import { ConversationResponse } from '../types/ConversationResponse';

export class AnthropicProvider implements ILLMProvider {
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
          } else if (part.type === 'image_url' && part.image_url?.url) {
            const url = part.image_url.url;
            const match = url.match(/^data:(image\/[a-zA-Z+-]+);base64,(.+)$/);
            if (match) {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: match[1],
                  data: match[2]
                }
              };
            }
          }
          return null;
        }).filter(Boolean);
      }
      return {
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content
      };
    });
  }

  async generateResponse(request: ConversationRequest): Promise<ConversationResponse> {
    const messages = this.mapMessages(request);

    const startTs = Date.now();
    console.log(`[AnthropicProvider] ▶ fetch START — model=${request.model}`);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        max_tokens: request.maxTokens || 1024,
        system: request.systemPrompt,
        temperature: request.temperature,
      }),
      signal: AbortSignal.timeout(30000),
    });
    console.log(`[AnthropicProvider] ✔ fetch DONE — ${Date.now() - startTs}ms status=${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API responded with ${res.status}: ${text}`);
    }

    const data = await res.json();
    return {
      reply: data.content?.[0]?.text || '',
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  }

  async *generateResponseStream(request: ConversationRequest): AsyncGenerator<{ text: string; inputTokens?: number; outputTokens?: number }> {
    const messages = this.mapMessages(request);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        max_tokens: request.maxTokens || 1024,
        system: request.systemPrompt,
        temperature: request.temperature,
        stream: true,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic streaming API responded with ${res.status}: ${text}`);
    }

    if (!res.body) throw new Error('No response body from Anthropic stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === '[DONE]' || !jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            yield { text: parsed.delta.text };
          }
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  }
}
