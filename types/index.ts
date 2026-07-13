// ─── Core Entities ───────────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  workspaceId: string;
  role: 'admin' | 'member';
  createdAt: Date;
};

export type Workspace = {
  id: string;
  name: string;
  ownerId: string;
  plan: 'starter' | 'growth' | 'enterprise';
  timezone: string;
  createdAt: Date;
};

// ─── Agent Setup Progress ─────────────────────────────────────────────────────

export type AgentSetupProgress = {
  generalCompleted: boolean;   // name + description saved
  knowledgeCompleted: boolean; // at least 1 knowledge item uploaded
  channelConnected: boolean;   // WhatsApp or Telegram connected
  apiKeySaved: boolean;        // at least 1 API key saved
  testCompleted: boolean;      // at least 1 test message sent
};

// ─── Assistant (AI Agent) ─────────────────────────────────────────────────────

export type AssistantStatus = 'draft' | 'live' | 'paused';

export type Assistant = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  systemPrompt: string;
  personality: 'friendly' | 'professional' | 'formal' | 'casual' | 'custom';
  temperature: number;         // 0.0 – 1.0
  language: string;            // 'en', 'hi', 'ta', 'te', 'auto', etc.
  memoryEnabled: boolean;
  welcomeMessage: string;
  fallbackMessage: string;
  status: AssistantStatus;
  setupProgress: AgentSetupProgress;
  selectedProvider?: ApiProvider;
  selectedModel?: string;
  createdAt: Date;
  updatedAt: Date;
};

// ─── API Keys ─────────────────────────────────────────────────────────────────

export type ApiProvider =
  | 'openai'
  | 'gemini'
  | 'anthropic'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'mistral';

export type ApiKey = {
  id: string;
  workspaceId: string;
  provider: ApiProvider;
  model: string;
  maskedKey: string;           // e.g. "sk-••••••••••••1234"
  isActive: boolean;
  createdAt: Date;
};

export const PROVIDER_LABELS: Record<ApiProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  anthropic: 'Anthropic',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  mistral: 'Mistral',
};

export const PROVIDER_MODELS: Record<ApiProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  anthropic: ['claude-sonnet-4-5', 'claude-3-5-haiku', 'claude-3-opus'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet', 'meta-llama/llama-3.1-70b'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-7b'],
};

// ─── Channels ─────────────────────────────────────────────────────────────────

export type ChannelType = 'whatsapp' | 'telegram';

export type Channel = {
  id: string;
  workspaceId: string;
  type: ChannelType;
  status: 'connected' | 'disconnected';
  identifier?: string;         // phone number or bot username
  connectedAt?: Date;
};

// ─── Conversations ────────────────────────────────────────────────────────────

export type ConversationStatus = 'open' | 'bot' | 'waiting' | 'resolved';

export type Conversation = {
  id: string;
  workspaceId: string;
  assistantId: string;
  channel: ChannelType;
  status: ConversationStatus;
  customer: {
    name: string;
    phone?: string;
    language?: string;
  };
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  tags?: string[];
  intent?: string;
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export type MessageSender = 'user' | 'assistant' | 'agent';

export type Message = {
  id: string;
  conversationId: string;
  sender: MessageSender;
  text: string;
  timestamp: Date;
};

// ─── Knowledge ────────────────────────────────────────────────────────────────

export type KnowledgeItemType = 'pdf' | 'docx' | 'txt' | 'url' | 'faq';
export type KnowledgeItemStatus = 'processing' | 'ready' | 'error';

export type KnowledgeItem = {
  id: string;
  workspaceId: string;
  type: KnowledgeItemType;
  name: string;
  size?: number;               // bytes
  url?: string;                // for URL type
  question?: string;           // for FAQ type
  answer?: string;             // for FAQ type
  status: KnowledgeItemStatus;
  createdAt: Date;
};

// ─── Logs ─────────────────────────────────────────────────────────────────────

export type LogType =
  | 'activity'
  | 'api_call'
  | 'webhook'
  | 'connection'
  | 'conversation'
  | 'agent';

export type LogEntry = {
  id: string;
  workspaceId: string;
  type: LogType;
  description: string;
  metadata?: Record<string, string | number | boolean>;
  timestamp: Date;
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export type AnalyticsMetrics = {
  messages: number;
  conversations: number;
  users: number;
  avgResponseTime: string;      // e.g. "< 30s"
};

// ─── FAQs ────────────────────────────────────────────────────────────────────

export type FAQItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  updatedAt: Date;
};
