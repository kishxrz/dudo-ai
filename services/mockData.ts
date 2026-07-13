import {
  Conversation,
  Message,
  LogEntry,
  Assistant,
  KnowledgeItem,
  AgentSetupProgress,
  AnalyticsMetrics,
  FAQItem,
} from '@/types';

// ─── Assistant ─────────────────────────────────────────────────────────────

const defaultSetupProgress: AgentSetupProgress = {
  generalCompleted: false,
  knowledgeCompleted: false,
  channelConnected: false,
  apiKeySaved: false,
  testCompleted: false,
};

export const mockAssistant: Assistant = {
  id: 'assistant-1',
  workspaceId: 'workspace-1',
  name: 'My Assistant',
  description: 'A helpful AI assistant for customer support',
  systemPrompt: 'You are a helpful assistant. Answer questions clearly and concisely.',
  personality: 'friendly',
  temperature: 0.7,
  language: 'en',
  memoryEnabled: true,
  welcomeMessage: 'Hi! How can I help you today?',
  fallbackMessage: "I'm not sure about that. Let me connect you with a team member.",
  status: 'draft',
  setupProgress: defaultSetupProgress,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date(),
};

// ─── Conversations ─────────────────────────────────────────────────────────

export const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    workspaceId: 'workspace-1',
    assistantId: 'assistant-1',
    channel: 'whatsapp',
    status: 'open',
    customer: { name: 'Alex Morgan', phone: '+1-555-0101', language: 'English' },
    lastMessage: 'Hi, I have a question about your service',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 1000),
    unreadCount: 3,
    tags: ['inquiry'],
    intent: 'Gold necklace set pricing',
  },
  {
    id: 'conv-2',
    workspaceId: 'workspace-1',
    assistantId: 'assistant-1',
    channel: 'whatsapp',
    status: 'bot',
    customer: { name: 'Jamie Lee', phone: '+1-555-0102', language: 'English' },
    lastMessage: 'Can you help me track my order?',
    lastMessageTime: new Date(Date.now() - 15 * 60 * 1000),
    unreadCount: 0,
    tags: ['support'],
    intent: 'Order status query',
  },
  {
    id: 'conv-3',
    workspaceId: 'workspace-1',
    assistantId: 'assistant-1',
    channel: 'telegram',
    status: 'waiting',
    customer: { name: 'Sam Rivera', phone: '+1-555-0103', language: 'Spanish' },
    lastMessage: 'What are your pricing options?',
    lastMessageTime: new Date(Date.now() - 45 * 60 * 1000),
    unreadCount: 1,
    tags: ['pricing'],
    intent: 'Pricing options enquiry',
  },
  {
    id: 'conv-4',
    workspaceId: 'workspace-1',
    assistantId: 'assistant-1',
    channel: 'whatsapp',
    status: 'resolved',
    customer: { name: 'Casey Jordan', phone: '+1-555-0104', language: 'English' },
    lastMessage: 'Thank you, that helped!',
    lastMessageTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
    unreadCount: 0,
    tags: ['resolved'],
    intent: 'General feedback',
  },
];

// ─── Messages ──────────────────────────────────────────────────────────────

export const mockMessages: Record<string, Message[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      sender: 'assistant',
      text: 'Hi! How can I help you today?',
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      sender: 'user',
      text: 'Hi, I have a question about your service',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
    },
  ],
  'conv-2': [
    {
      id: 'msg-3',
      conversationId: 'conv-2',
      sender: 'assistant',
      text: 'Hello! I can help you with order tracking. Could you share your order ID?',
      timestamp: new Date(Date.now() - 20 * 60 * 1000),
    },
    {
      id: 'msg-4',
      conversationId: 'conv-2',
      sender: 'user',
      text: 'Can you help me track my order?',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
    },
  ],
};

// ─── Knowledge ─────────────────────────────────────────────────────────────

export const mockKnowledge: KnowledgeItem[] = [];

// ─── Logs ──────────────────────────────────────────────────────────────────

export const mockLogs: LogEntry[] = [
  {
    id: 'log-1',
    workspaceId: 'workspace-1',
    type: 'activity',
    description: 'New conversation started',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: 'log-2',
    workspaceId: 'workspace-1',
    type: 'api_call',
    description: 'OpenAI API call completed — 312ms',
    metadata: { provider: 'openai', model: 'gpt-4o', latency: 312 },
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
  },
  {
    id: 'log-3',
    workspaceId: 'workspace-1',
    type: 'webhook',
    description: 'WhatsApp webhook received',
    metadata: { event: 'message', status: '200' },
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
  },
  {
    id: 'log-4',
    workspaceId: 'workspace-1',
    type: 'connection',
    description: 'WhatsApp channel connected successfully',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'log-5',
    workspaceId: 'workspace-1',
    type: 'activity',
    description: 'Conversation resolved',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: 'log-6',
    workspaceId: 'workspace-1',
    type: 'api_call',
    description: 'Gemini API call completed — 198ms',
    metadata: { provider: 'gemini', model: 'gemini-1.5-pro', latency: 198 },
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
];

// ─── Analytics ─────────────────────────────────────────────────────────────

export const mockAnalytics: AnalyticsMetrics = {
  messages: 1284,
  conversations: 1284,
  users: 89,
  avgResponseTime: '1.2s',
};

// ─── Missing Mock Data for Dashboard pages ───────────────────────────────────

export const mockKnowledgeBase: FAQItem[] = [
  {
    id: 'kb-1',
    category: 'General',
    question: 'What are your store timings?',
    answer: 'We are open Monday to Sunday, from 10:30 AM to 8:30 PM. We are closed only on national holidays.',
    updatedAt: new Date('2026-06-25'),
  },
  {
    id: 'kb-2',
    category: 'Payment',
    question: 'Do you offer EMI plans?',
    answer: 'Yes! We offer 0% EMI options for 3 and 6 months on credit cards from HDFC, ICICI, and Axis banks on purchases above ₹50,000.',
    updatedAt: new Date('2026-06-24'),
  },
  {
    id: 'kb-3',
    category: 'Warranty',
    question: 'Is there a warranty on your jewellery?',
    answer: 'Every piece of gold jewellery comes with a 100% BIS Hallmarked certification. We provide a lifetime exchange policy and a 3-year warranty against any manufacturing defects.',
    updatedAt: new Date('2026-06-20'),
  },
  {
    id: 'kb-4',
    category: 'Delivery',
    question: 'Do you ship jewellery across India?',
    answer: 'Yes, we offer free, fully insured shipping for online purchases across India. Delivery usually takes 4-6 business days.',
    updatedAt: new Date('2026-06-15'),
  },
];

export const mockActivityLogs: LogEntry[] = [
  {
    id: 'log-1',
    workspaceId: 'workspace-1',
    type: 'conversation',
    description: 'New conversation started on WhatsApp channel',
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: 'log-2',
    workspaceId: 'workspace-1',
    type: 'connection',
    description: 'WhatsApp channel connected successfully',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
  },
  {
    id: 'log-3',
    workspaceId: 'workspace-1',
    type: 'conversation',
    description: 'Vijay Rajan requested to transfer chat to human agent',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: 'log-4',
    workspaceId: 'workspace-1',
    type: 'agent',
    description: 'Dudo resolved customer inquiry about store timings using Knowledge Base',
    timestamp: new Date(Date.now() - 32 * 60 * 1000),
  },
  {
    id: 'log-5',
    workspaceId: 'workspace-1',
    type: 'api_call',
    description: 'Gemini API call completed — latency: 245ms',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
];
