import { ILLMProvider } from './ILLMProvider';
import { ConversationRequest } from '../types/ConversationRequest';
import { ConversationResponse } from '../types/ConversationResponse';

export class GroqProvider implements ILLMProvider {
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

    let model = request.model;
    if (model === 'gemma2-9b-it' || model === 'gemma-7b-it') {
      model = 'llama-3.3-70b-versatile';
    }

    const startTs = Date.now();
    console.log(`[GroqProvider] ▶ fetch START — model=${model}`);
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature,
      }),
      signal: AbortSignal.timeout(30000),
    });
    console.log(`[GroqProvider] ✔ fetch DONE — ${Date.now() - startTs}ms status=${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API responded with ${res.status}: ${text}`);
    }

    const data = await res.json();
    return {
      reply: data.choices?.[0]?.message?.content || '',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }
}
