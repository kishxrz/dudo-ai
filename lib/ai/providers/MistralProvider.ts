import { ILLMProvider } from './ILLMProvider';
import { ConversationRequest } from '../types/ConversationRequest';
import { ConversationResponse } from '../types/ConversationResponse';

export class MistralProvider implements ILLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateResponse(request: ConversationRequest): Promise<ConversationResponse> {
    const messages = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const startTs = Date.now();
    console.log(`[MistralProvider] ▶ fetch START — model=${request.model}`);
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
    console.log(`[MistralProvider] ✔ fetch DONE — ${Date.now() - startTs}ms status=${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mistral API responded with ${res.status}: ${text}`);
    }

    const data = await res.json();
    return {
      reply: data.choices?.[0]?.message?.content || '',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }
}
