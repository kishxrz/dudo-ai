import { ApiProvider } from '@/types';
import { MODELS_CATALOG_RAW } from './models-list';

export interface ModelDefinition {
  id: string; // unique ID, e.g. 'openai-gpt-4o'
  provider: ApiProvider;
  displayName: string;
  modelId: string; // exact model ID string passed to APIs
  description: string;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsImageGeneration: boolean;
  supportsReasoning: boolean;
  supportsAudioInput: boolean;
  supportsAudioOutput: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  recommended: boolean;
  price: string;
  isDefault: boolean;
}

export const MODELS_CATALOG: ModelDefinition[] = MODELS_CATALOG_RAW as ModelDefinition[];

export class ProviderModelRegistry {
  static getModelsByProvider(provider: ApiProvider): ModelDefinition[] {
    return MODELS_CATALOG.filter((m) => m.provider === provider);
  }

  static getModel(provider: ApiProvider, modelId: string): ModelDefinition | undefined {
    return MODELS_CATALOG.find((m) => m.provider === provider && m.modelId === modelId);
  }

  static getDefaultModel(provider: ApiProvider): ModelDefinition {
    const list = this.getModelsByProvider(provider);
    const defaultModel = list.find((m) => m.isDefault);
    if (defaultModel) return defaultModel;
    if (list.length > 0) return list[0];
    throw new Error(`No models configured in registry for provider: ${provider}`);
  }
}
