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
    return provider.generateResponse(request);
  }
}
