export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | any[];
}

export interface ConversationRequest {
  systemPrompt: string;
  messages: Message[];
  model: string;
  temperature: number;
  maxTokens?: number;
}
