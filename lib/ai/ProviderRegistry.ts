import { ILLMProvider } from './providers/ILLMProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GroqProvider } from './providers/GroqProvider';
import { OpenRouterProvider } from './providers/OpenRouterProvider';
import { DeepSeekProvider } from './providers/DeepSeekProvider';
import { MistralProvider } from './providers/MistralProvider';
import { ConversationRequest } from './types/ConversationRequest';
import { ConversationResponse } from './types/ConversationResponse';

import { ProviderModelRegistry } from './providers/ProviderModelRegistry';

const LLM_TIMEOUT_MS = 30_000; // 30-second hard limit per LLM call

export class ProviderRegistry {
  static getProvider(providerName: string, apiKey: string): ILLMProvider {
    switch (providerName.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'gemini':
        return new GeminiProvider(apiKey);
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'groq':
        return new GroqProvider(apiKey);
      case 'openrouter':
        return new OpenRouterProvider(apiKey);
      case 'deepseek':
        return new DeepSeekProvider(apiKey);
      case 'mistral':
        return new MistralProvider(apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${providerName}`);
    }
  }

  static async generate(providerName: string, apiKey: string, request: ConversationRequest): Promise<ConversationResponse> {
    const provider = this.getProvider(providerName, apiKey);
    const startTs = Date.now();
    console.log(`[ProviderRegistry] ▶ LLM call START — provider=${providerName} model=${request.model}`);

    // Log model metadata/capabilities
    try {
      const modelDef = ProviderModelRegistry.getModel(providerName as any, request.model);
      console.log(`[VERIFICATION] Provider Registry model definition found:
- Provider: ${providerName}
- Model: ${request.model}
- Supports Vision: ${modelDef?.supportsVision ?? false}
- Supports Documents: ${request.messages.some(m => typeof m.content === 'string' && m.content.includes('[Document:'))}
- Supports Streaming: ${modelDef?.supportsStreaming ?? false}
- Supports Tool Calling: ${modelDef?.supportsToolCalling ?? false}
- Supports Images: ${modelDef?.supportsVision ?? false}
- Supports PDFs: ${request.messages.some(m => typeof m.content === 'string' && m.content.includes('[Document:'))}
`);
    } catch (e) {
      console.warn('[ProviderRegistry] Could not fetch capabilities from registry:', e);
    }

    // Verify messages content (systemPrompt, user message, extracted document text, image block)
    console.log(`[VERIFICATION] Final prompt config check:
- System Prompt: "${request.systemPrompt ? request.systemPrompt.slice(0, 300) + '...' : 'null'}"
- Total Messages: ${request.messages.length}
`);

    request.messages.forEach((msg, index) => {
      if (typeof msg.content === 'string') {
        const hasDocText = msg.content.includes('[Document:');
        console.log(`  Message[${index}] role=${msg.role} textLength=${msg.content.length} containsDocumentText=${hasDocText}`);
        if (hasDocText) {
          console.log(`    Document text preview: "${msg.content.slice(0, 150)}..."`);
        }
      } else if (Array.isArray(msg.content)) {
        console.log(`  Message[${index}] role=${msg.role} arrayContent (Multimodal):`);
        msg.content.forEach((part, partIdx) => {
          if (part.type === 'text') {
            console.log(`    Part[${partIdx}] type=text text="${part.text?.slice(0, 100)}..."`);
          } else if (part.type === 'image_url') {
            const hasData = !!part.image_url?.url;
            console.log(`    Part[${partIdx}] type=image_url hasData=${hasData} length=${part.image_url?.url?.length || 0}`);
          }
        });
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM call timed out after ${LLM_TIMEOUT_MS}ms (provider=${providerName})`)), LLM_TIMEOUT_MS)
    );

    try {
      const result = await Promise.race([provider.generateResponse(request), timeoutPromise]);
      console.log(`[ProviderRegistry] ✔ LLM call DONE — ${Date.now() - startTs}ms`);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ProviderRegistry] ✖ LLM call FAILED after ${Date.now() - startTs}ms — ${msg}`);
      throw err;
    }
  }

  static async *generateStream(providerName: string, apiKey: string, request: ConversationRequest): AsyncGenerator<{ text: string; inputTokens?: number; outputTokens?: number }> {
    const provider = this.getProvider(providerName, apiKey);
    if (provider.generateResponseStream) {
      yield* provider.generateResponseStream(request);
    } else {
      const res = await provider.generateResponse(request);
      yield { text: res.reply, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
    }
  }
}
