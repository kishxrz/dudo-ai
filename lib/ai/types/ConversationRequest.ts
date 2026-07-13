export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationRequest {
  systemPrompt: string;
  messages: Message[];
  model: string;
  temperature: number;
  maxTokens?: number;
}
