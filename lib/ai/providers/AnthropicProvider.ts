import { ILLMProvider } from './ILLMProvider';
import { ConversationRequest } from '../types/ConversationRequest';
import { ConversationResponse } from '../types/ConversationResponse';

export class AnthropicProvider implements ILLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateResponse(request: ConversationRequest): Promise<ConversationResponse> {
    const messages = request.messages.map(m => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content
    }));

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
    });

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
}
