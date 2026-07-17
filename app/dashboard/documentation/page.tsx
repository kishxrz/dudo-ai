'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  LifeBuoy,
  Zap,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/SearchBar';
import { cn } from '@/lib/utils';

// ─── Component Interfaces ────────────────────────────────────────────────────

interface ArticleSection {
  title: string;
  content: string;
  steps?: string[];
  tips?: string[];
  warnings?: string[];
  successes?: string[];
  codeBlock?: {
    lang: string;
    code: string;
  };
}

interface ArticleFAQ {
  q: string;
  a: string;
}

interface DocArticle {
  id: string;
  title: string;
  category: 'getting-started' | 'modules' | 'system' | 'support';
  description: string;
  keywords: string[];
  overview: string;
  purpose: string;
  sections: ArticleSection[];
  faq?: ArticleFAQ[];
  bestPractices?: string[];
  commonMistakes?: string[];
  troubleshooting?: string[];
  related: string[];
}

// ─── Reusable Content Widgets ────────────────────────────────────────────────

const InfoCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex gap-3 text-sky-800 text-[12px] my-4 shadow-sm text-left font-medium leading-relaxed">
    <Info size={15} className="shrink-0 mt-0.5 text-sky-500" />
    <div>{children}</div>
  </div>
);

const WarningCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-[12px] my-4 shadow-sm text-left font-medium leading-relaxed">
    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
    <div>{children}</div>
  </div>
);

const SuccessCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 text-green-800 text-[12px] my-4 shadow-sm text-left font-medium leading-relaxed">
    <CheckCircle size={15} className="shrink-0 mt-0.5 text-green-600" />
    <div>{children}</div>
  </div>
);

const TipCard = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#E5F4F7] border border-[#C7E6EE] rounded-xl p-4 flex gap-3 text-[#22577A] text-[12px] my-4 shadow-sm text-left font-medium leading-relaxed">
    <Lightbulb size={15} className="shrink-0 mt-0.5 text-[#22577A]" />
    <div>{children}</div>
  </div>
);

const StepCard = ({ number, text }: { number: number; text: string }) => (
  <div className="flex gap-4 items-start py-3 border-b border-zinc-100 last:border-0 text-left">
    <div className="w-6 h-6 rounded-full bg-[#22577A] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
      {number}
    </div>
    <p className="text-[13px] text-zinc-600 font-medium leading-relaxed">{text}</p>
  </div>
);

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="bg-zinc-950 text-zinc-200 font-mono rounded-xl my-4 relative group shadow-inner text-left overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold select-none">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed">{code.trim()}</pre>
    </div>
  );
}

// ─── Article Feedback ─────────────────────────────────────────────────────────

function ArticleFeedback() {
  const [vote, setVote] = useState<'yes' | 'no' | null>(null);
  return (
    <div className="flex items-center gap-4 py-4 border-t border-zinc-100 mt-2">
      <span className="text-[12px] text-zinc-500 font-medium">Was this article helpful?</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVote('yes')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold cursor-pointer transition-all',
            vote === 'yes'
              ? 'bg-green-50 border-green-300 text-green-700'
              : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
          )}
        >
          <ThumbsUp size={12} /> Yes
        </button>
        <button
          onClick={() => setVote('no')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold cursor-pointer transition-all',
            vote === 'no'
              ? 'bg-red-50 border-red-300 text-red-600'
              : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
          )}
        >
          <ThumbsDown size={12} /> No
        </button>
      </div>
      {vote && (
        <span className="text-[11px] text-zinc-400 font-medium">
          {vote === 'yes' ? 'Thanks for your feedback!' : 'We\'ll work on improving this.'}
        </span>
      )}
    </div>
  );
}

// ─── Articles Dataset ─────────────────────────────────────────────────────────

const articles: DocArticle[] = [
  {
    id: 'getting-started',
    title: 'Getting Started Guide',
    category: 'getting-started',
    description: 'Launch Dudo receptionist and connect your business channel in less than 5 minutes.',
    keywords: ['setup', 'provider key', 'connect telegram', 'launch', 'test AI'],
    overview: 'Welcome to Dudo. This guide helps business operators configure and activate their autonomous AI receptionist.',
    purpose: 'To ensure a smooth starting setup, linking workspace parameters to connected communication platforms.',
    sections: [
      {
        title: 'Step-by-step Setup Flow',
        content: 'Follow these 6 steps to configure and launch your virtual employee receptionist:',
        steps: [
          'Create your workspace: Select a unique workspace name and plan details inside the dashboard.',
          'Add your AI provider key: Input API credentials (OpenAI, Gemini, or Groq) in Settings.',
          'Connect WhatsApp or Telegram: Go to Integrations and toggle the channel connection.',
          'Configure your AI: Give your receptionist a name, select response style, and write core instructions.',
          'Upload business knowledge: Provide pricing policies, products/services descriptions, or FAQ lists.',
          'Test the AI: Access the playground page to chat directly with your configured receptionist and verify responses.'
        ]
      }
    ],
    bestPractices: [
      'Use a specific personality profile (e.g. Friendly or Professional) aligned with your target business audience.',
      'Check system prompt variables before going live.'
    ],
    commonMistakes: [
      'Leaving the provider API key blank, causing conversation dispatch timeouts.',
      'Uploading documents larger than 500KB.'
    ],
    related: ['agent-config', 'integrations', 'knowledge-base']
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    category: 'modules',
    description: 'Understand every widget, setup progress card, and metrics tracking on your dashboard.',
    keywords: ['widgets', 'setup progress', 'health indicators', 'workspace overview'],
    overview: 'The dashboard provides a central command center representing live workspace statuses and setup checklists.',
    purpose: 'To monitor system operations, review pending config steps, and view connected channel diagnostics.',
    sections: [
      {
        title: 'Dashboard Widgets Explanation',
        content: 'Each card displayed on the main home screen has a specific functional purpose:',
        steps: [
          'Workspace overview: Represents plan types, owner profiles, and active receptionist names.',
          'Connected channels: Lists connection states of Telegram bots and WhatsApp Cloud API.',
          'Recent conversations: Highlights the latest client chats requiring human takeover review.',
          'Quick actions: Easy access links to train knowledge base or configure business hours.',
          'Setup progress checklist: Shows what configurations are completed (provider keys, knowledge docs).',
          'Health indicators: Real-time telemetry check indicating if webhook sync processes are healthy.'
        ]
      }
    ],
    bestPractices: [
      'Check the setup checklist widgets immediately after creating a new workspace.',
      'Verify connected status dots daily.'
    ],
    related: ['analytics', 'logs']
  },
  {
    id: 'conversations',
    title: 'Conversations Inbox',
    category: 'modules',
    description: 'Read customer messages, review AI activities, and take over chats in real-time.',
    keywords: ['inbox', 'take over', 'resolved', 'typing indicator', 'unread badge'],
    overview: 'The Conversations Inbox is an operational center designed like Apple Mail to review customer discussions.',
    purpose: 'To supervise AI communication, step in when complex questions arise, and mark chats as resolved.',
    sections: [
      {
        title: 'Inbox Operations Manual',
        content: 'Review conversation details, monitor messages, and interact with the following components:',
        steps: [
          'Conversation List: Displays time-sorted cards indicating channel, timestamp, and unread badges.',
          'Search & Filters: Filter by WhatsApp or Telegram, and search text strings (name, phone, tags, summary).',
          'Human Takeover: Select "Take Over" in the dropdown to pause the AI and reply manually.',
          'Mark Resolved: Toggle status to "Resolved" to close the ticket and archive the interaction.',
          'Details Drawer: View AI Summaries, user intent, customer phone, language, and total messages.'
        ]
      }
    ],
    bestPractices: [
      'Take over the chat immediately if the customer indicates a complaint or high-intent buying decision.',
      'Use the Copy Summary action to share conversation insights with team members.'
    ],
    related: ['agent-config', 'analytics']
  },
  {
    id: 'analytics',
    title: 'Analytics & Insights',
    category: 'modules',
    description: 'Track key performance indicators, AI resolution rates, and business intent metrics.',
    keywords: ['kpi', 'intent analysis', 'trends', 'funnel', 'performance metrics'],
    overview: 'The Analytics Dashboard presents dynamic data on customer interactions, response speed benchmarks, and funnel performance.',
    purpose: 'To discover customer intentions, identify bottlenecks, and measure receptionist response times.',
    sections: [
      {
        title: 'Analytics Metrics Breakdown',
        content: 'Configure time range filters (Today, 7 Days, 30 Days) and evaluate:',
        steps: [
          'Executive Insights: Natural language AI business suggestions derived from dataset trends.',
          'Intent Analytics: Proportional progress bars tracking client query topics (pricing, delivery, availability).',
          'Conversation Funnel: Standard dropoff funnel from new chats to AI/Human resolution.',
          'Peak Hours Staffing Heatmap: Tracks hourly density to assist in support staffing decisions.',
          'System Connection Health: Real-time latency diagnostics for connected platforms and webhooks.'
        ]
      }
    ],
    bestPractices: [
      'Inspect peak hours heatmaps to align human agent shifts with high customer activity times.',
      'Expand the knowledge base if the Human Takeover rate increases.'
    ],
    related: ['dashboard', 'conversations']
  },
  {
    id: 'appointments',
    title: 'Appointments Booking',
    category: 'modules',
    description: 'Configure automated scheduling, Google Calendar syncing, and timezone mappings.',
    keywords: ['scheduling', 'calendar integration', 'booking flow', 'confirmations'],
    overview: 'Dudo schedules appointments autonomously during user chat streams based on availability parameters.',
    purpose: 'To convert inquiries into booked meetings without manual coordination.',
    sections: [
      {
        title: 'Appointment Flow & Confirmation',
        content: 'Understand booking stages and timezone mappings:',
        steps: [
          'Google Calendar Integration: Connect calendar inside Settings to fetch active slots.',
          'Availability Management: Set working days, timezone offsets, and gap buffers.',
          'AI Scheduling: Receptionist presents open dates and books slot automatically.',
          'Automatic Confirmations: Sends confirmation emails/details to the client instantly.',
          'Cancellations & Rescheduling: AI processes cancellation request and offers alternatives.'
        ]
      }
    ],
    bestPractices: [
      'Ensure your Google Calendar timezone matches your Dudo workspace timezone settings.',
      'Configure buffer gaps of at least 15 minutes between appointments.'
    ],
    related: ['schedules', 'integrations']
  },
  {
    id: 'knowledge-base',
    title: 'Knowledge Base Training',
    category: 'modules',
    description: 'Train the AI receptionist using business details, PDFs, website URLs, and FAQs.',
    keywords: ['business profile', 'website scrape', 'base64 pdf', 'faq upload', 'training'],
    overview: 'The Knowledge Base acts as the primary brain of your receptionist, storing details to address customer queries.',
    purpose: 'To provide accurate, context-aware information about products, pricing, and refund policies.',
    sections: [
      {
        title: 'Supported Document Formats',
        content: 'You can upload training resources in these formats:',
        steps: [
          'Business Profile: Form inputs for business name, industry, description, and contact info.',
          'PDF Documents: Upload files under 500KB; converted to base64 and stored inside Firestore.',
          'Website Scraping: Fetch website URLs to automatically extract business detail context.',
          'FAQ Q&A Blocks: Add direct question and answer pairs for high-precision matching.'
        ]
      }
    ],
    bestPractices: [
      'Structure FAQs clearly with simple questions and direct answers.',
      'Ensure document uploads are clean PDFs without heavy formatting.'
    ],
    related: ['getting-started', 'agent-config']
  },
  {
    id: 'learning',
    title: 'AI Learning Loop',
    category: 'modules',
    description: 'Review conversation details and approve new learning suggestions to train your receptionist.',
    keywords: ['learning loop', 'suggestions', 'human feedback', 'model refinement'],
    overview: 'The Learning module identifies missing questions from chats and suggests additions to the knowledge base.',
    purpose: 'To continually improve the AI response quality using human feedback.',
    sections: [
      {
        title: 'Reviewing Learning Suggestions',
        content: 'Approve or reject suggestions inside the dashboard:',
        steps: [
          'Intent Detection: AI detects when it uses the fallback message or cannot answer a query.',
          'Suggested FAQ: Suggestion cards are created with customer question and suggested answer.',
          'Approve Additions: Clicking "Approve" adds the item directly to the Knowledge Base.',
          'Continuous Improvement: Receptionist updates immediately and answers similar queries autonomously.'
        ]
      }
    ],
    bestPractices: [
      'Review suggestions at the end of each working day to maintain receptionist accuracy.',
      'Refine suggested text fields before clicking approve.'
    ],
    related: ['knowledge-base', 'conversations']
  },
  {
    id: 'integrations',
    title: 'Integrations & AI Providers',
    category: 'system',
    description: 'Connect WhatsApp, Telegram, Google Calendar, and configure model providers.',
    keywords: ['whatsapp api', 'telegram bot token', 'calendar sync', 'model configuration'],
    overview: 'The Integrations tab connects Dudo with messaging channels, calendars, and model endpoints.',
    purpose: 'To sync business workflows and allow multi-channel messaging support.',
    sections: [
      {
        title: 'Configuration Settings',
        content: 'Set up integrations with the following steps:',
        steps: [
          'AI Providers: Input OpenAI, Groq, or Gemini keys in Bring Your Own Key (BYOK) mode.',
          'Telegram Integration: Enter your Telegram bot token created via BotFather.',
          'WhatsApp Cloud API: Link Meta developer tokens and webhook credentials.',
          'Google Calendar: Authorize Google OAuth to read slot details.'
        ]
      }
    ],
    bestPractices: [
      'Enable only the messaging channels you are actively monitor.',
      'Double check model compatibility before saving provider keys.'
    ],
    related: ['getting-started', 'schedules']
  },
  {
    id: 'schedules',
    title: 'Schedules & Business Hours',
    category: 'system',
    description: 'Set working days, holiday timetables, and AI offline responses.',
    keywords: ['working days', 'timezone config', 'holiday schedules', 'after-hours'],
    overview: 'Schedules determine when your business is operational and how the AI handles inquiries during off-hours.',
    purpose: 'To manage appointment windows and direct after-hours client expectations.',
    sections: [
      {
        title: 'Configuring Operating Windows',
        content: 'Define schedule parameters inside the page:',
        steps: [
          'Working Days: Toggle days of the week and define daily start/end operational hours.',
          'Timezone Setting: Select local timezone to align calendar bookings and timestamps.',
          'Holiday Timetable: Insert date blocks when the office is closed.',
          'After-Hours Reply: Set custom automated messages for customer interactions after operational hours.'
        ]
      }
    ],
    bestPractices: [
      'Set clear after-hours responses telling clients when human operators will be back.',
      'Align workspace timezone with Google Calendar timezone.'
    ],
    related: ['appointments', 'agent-config']
  },
  {
    id: 'logs',
    title: 'Activity Logs & Debugging',
    category: 'system',
    description: 'Monitor API calls, webhook activities, and diagnostic warning states.',
    keywords: ['webhook logs', 'api trace', 'debugging', 'errors', 'activity logs'],
    overview: 'The Logs module logs events, webhook logs, and API transactions in real time.',
    purpose: 'To audit operational processes, troubleshoot webhook issues, and view error tracebacks.',
    sections: [
      {
        title: 'Audit Logs & Filtering',
        content: 'Inspect system state and trace errors:',
        steps: [
          'Log Categories: Filter logs by Webhook events, API proxy calls, and user queries.',
          'Search Query: Filter logs containing customer names, status values, or phone numbers.',
          'Trace Details: Click log items to inspect headers, JSON payloads, and timestamps.',
          'Diagnostic Alerts: Highlights warning codes when API keys fail or tokens expire.'
        ]
      }
    ],
    bestPractices: [
      'Check webhook logs if Telegram messages fail to render in the Conversations inbox.',
      'Verify API latency times inside trace details.'
    ],
    related: ['dashboard', 'analytics']
  },
  {
    id: 'agent-config',
    title: 'Agent Configuration',
    category: 'system',
    description: 'Write custom receptionist instructions, select languages, and set model temperature.',
    keywords: ['system prompt', 'ai name', 'temperature setting', 'fallback instructions'],
    overview: 'Agent Configuration controls the behavior, personality, instructions, and settings of your AI receptionist.',
    purpose: 'To tailor the receptionist responses to represent your brand values.',
    sections: [
      {
        title: 'Personality & Instructions Config',
        content: 'Configure system prompt parameters:',
        steps: [
          'AI Name & Description: Define the virtual name (e.g. Dudo Receptionist).',
          'Core Instructions: Write the system prompt template guiding customer interactions.',
          'Languages: Set target languages (Hindi, Tamil, English, auto-detect) for responses.',
          'Temperature Control: Set lower temperature (e.g. 0.2) for strict, factual guidelines.',
          'Fallback Message: Write the default response when the AI cannot answer a question.'
        ],
        tips: [
          'Keep instructions concise and direct — long prompts can cause model drift on some providers.'
        ],
        warnings: [
          'Setting temperature above 0.8 may produce inconsistent or overly creative responses for business-critical queries.'
        ]
      }
    ],
    bestPractices: [
      'Keep instructions clear and brief to prevent model drift.',
      'Set temperature between 0.1 and 0.3 to ensure consistent responses about business details.'
    ],
    related: ['knowledge-base', 'getting-started']
  },
  {
    id: 'billing',
    title: 'Billing & Plan Management',
    category: 'system',
    description: 'Select pricing plans, download invoices, and manage subscription renewals.',
    keywords: ['pricing plan', 'byok bills', 'subscription renewal', 'invoices'],
    overview: 'The Billing page outlines workspace tiers, invoicing histories, and subscription renewals.',
    purpose: 'To manage SaaS costs, billing methods, and review active usage limits.',
    sections: [
      {
        title: 'Pricing & BYOK Billing Details',
        content: 'Manage billing operations with the following points:',
        steps: [
          'Subscription Tiers: Review and select Starter, Growth, or Enterprise options.',
          'Bring Your Own Key (BYOK): Explanation of API key bills handled directly with OpenAI/Groq.',
          'Invoice History: Download PDF receipts for subscription renewals.',
          'Payment Options: Link credit cards and change renewal parameters.'
        ]
      }
    ],
    bestPractices: [
      'Review your API usage inside OpenAI dashboard directly to keep BYOK costs low.',
      'Ensure payment methods are up to date to prevent subscription pause.'
    ],
    related: ['dashboard', 'integrations']
  },
  {
    id: 'search-docs',
    title: 'In-App Documentation Help',
    category: 'support',
    description: 'Learn how to navigate documentation articles and use keyboard search shortcuts.',
    keywords: ['keyboard shortcut', 'documentation search', 'help index'],
    overview: 'The Documentation Center provides context-aware guides for every module in your dashboard.',
    purpose: 'To solve setup issues and guide configuration changes.',
    sections: [
      {
        title: 'Documentation Features',
        content: 'Features of the documentation interface:',
        steps: [
          'Instant Search: Typing in the search bar matches titles, keywords, and section contents.',
          'Search Shortcut: Press Ctrl + K (or Cmd + K) to focus search immediately.',
          'Responsive Navigation: Use sub-sidebar navigation or Next/Previous buttons.'
        ]
      }
    ],
    bestPractices: [
      'Use Ctrl + K to search documentation instead of manual navigation.',
      'Review related articles at the bottom of the page.'
    ],
    related: ['getting-started', 'contact-support']
  },
  {
    id: 'talk-to-dudo',
    title: 'Talk to Dudo Assistant',
    category: 'support',
    description: 'Interact with the virtual assistant for dashboard configuration advice.',
    keywords: ['dudo assistant', 'chat help', 'configuration queries'],
    overview: 'Dudo Assistant is an on-demand virtual helper available to answer settings and configuration queries.',
    purpose: 'To assist you in setting up business hours, uploading documents, or configuring model settings.',
    sections: [
      {
        title: 'Interacting with Dudo Assistant',
        content: 'Understand when to chat with Dudo Assistant:',
        steps: [
          'Settings Help: Ask how to change timezones, add provider keys, or edit schedules.',
          'Troubleshooting: Ask why Telegram is offline or how to fix PDF upload issues.',
          'Factual Guides: Get step-by-step instructions on updating FAQs and billing.'
        ]
      }
    ],
    bestPractices: [
      'Ask specific questions like "How do I connect a Google Calendar?" to get the best guidance.',
      'Check the related article links suggested by the assistant.'
    ],
    related: ['search-docs', 'getting-started']
  },
  {
    id: 'contact-support',
    title: 'Contact Support & Bug Report',
    category: 'support',
    description: 'Report system errors, request features, and review support resolution times.',
    keywords: ['report bug', 'feature request', 'support hours', 'ticket log'],
    overview: 'Contact Support connects you directly with the development team to report bugs or request features.',
    purpose: 'To resolve workspace errors and submit custom integration requests.',
    sections: [
      {
        title: 'Submitting Bug Logs & Tickets',
        content: 'Ensure fast resolution times by providing the required details:',
        steps: [
          'Required Information: Detail the issue, expected behavior, and steps to reproduce.',
          'Screenshots & Media: Upload images illustrating UI alignment errors.',
          'Logs Tracing: Attach error traces from your dashboard Logs page.',
          'Support Response SLA: Standard tickets are resolved within 24 operational hours.'
        ]
      }
    ],
    bestPractices: [
      'Double check your Logs tab for error codes before submitting a ticket.',
      'Select the appropriate priority level to speed up critical issue resolution.'
    ],
    related: ['logs', 'search-docs']
  }
];

// ─── Category definitions ──────────────────────────────────────────────────────

const categories = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'modules', label: 'Dashboard Modules' },
  { id: 'system', label: 'System Configuration' },
  { id: 'support', label: 'Help & Support' },
] as const;

// ─── Popular guides for home page ─────────────────────────────────────────────

const popularGuides = [
  { id: 'integrations', title: 'Connect WhatsApp', desc: 'Link your WhatsApp Cloud API account.' },
  { id: 'integrations', title: 'Connect Telegram', desc: 'Enter your BotFather token to go live.' },
  { id: 'agent-config', title: 'Configure AI Provider', desc: 'Add your BYOK API key and set temperature.' },
  { id: 'knowledge-base', title: 'Upload Knowledge Base', desc: 'Add PDFs, FAQs, and web pages.' },
  { id: 'getting-started', title: 'Test Your Agent', desc: 'Use the playground to verify responses.' },
  { id: 'getting-started', title: 'Publish Your Agent', desc: 'Go live on your connected channels.' },
];

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function DocumentationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeArticleId, setActiveArticleId] = useState<string>('home');
  const [mobileDocNavOpen, setMobileDocNavOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'getting-started': true,
    'modules': true,
    'system': true,
    'support': true,
  });

  const toggleCategory = (id: string) =>
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Search ────────────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return articles.filter((article) => {
      return (
        article.title.toLowerCase().includes(term) ||
        article.description.toLowerCase().includes(term) ||
        article.overview.toLowerCase().includes(term) ||
        article.keywords.some((k) => k.toLowerCase().includes(term)) ||
        article.sections.some(
          (s) => s.title.toLowerCase().includes(term) || s.content.toLowerCase().includes(term)
        )
      );
    });
  }, [searchTerm]);

  const activeArticle = useMemo(
    () => articles.find((a) => a.id === activeArticleId) || null,
    [activeArticleId]
  );

  const navIndex = useMemo(() => {
    if (!activeArticle) return { prev: null, next: null };
    const idx = articles.findIndex((a) => a.id === activeArticle.id);
    return {
      prev: idx > 0 ? articles[idx - 1] : null,
      next: idx < articles.length - 1 ? articles[idx + 1] : null,
    };
  }, [activeArticle]);

  // Breadcrumb for active article
  const breadcrumb = useMemo(() => {
    if (!activeArticle) return null;
    const cat = categories.find((c) => c.id === activeArticle.category);
    return { category: cat?.label || 'Documentation', title: activeArticle.title };
  }, [activeArticle]);

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-100 text-zinc-950 px-0.5 rounded font-medium">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const navigate = (id: string) => {
    setActiveArticleId(id);
    setSearchTerm('');
    setMobileDocNavOpen(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F7F8FA] font-sans select-none overflow-hidden">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-zinc-200/60 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDocNavOpen(true)}
              className="md:hidden p-1.5 -ml-1 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors border-none bg-transparent cursor-pointer"
              title="Open documentation menu"
            >
              <BookOpen size={18} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-[#22577A]/10 hidden md:flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-[#22577A]" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-zinc-950 tracking-tight leading-none mb-0.5">
                Documentation
              </h1>
              <p className="text-[12px] text-zinc-500 leading-none">
                Guides and references for configuring and managing your AI agent.
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* ── Left Nav (260px) ─────────────────────────────────────────── */}
        {/* Mobile backdrop */}
        {mobileDocNavOpen && (
          <div
            onClick={() => setMobileDocNavOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
          />
        )}
        <aside
          className={cn(
            "w-[260px] shrink-0 border-r border-zinc-200/50 flex flex-col bg-white h-full overflow-hidden",
            "transition-transform duration-200 ease-in-out z-50",
            "fixed inset-y-0 left-0 md:relative md:translate-x-0",
            mobileDocNavOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Close button inside Left Nav on mobile */}
          <div className="md:hidden flex items-center justify-between p-3 border-b border-zinc-100 bg-zinc-50 shrink-0">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Doc Menu</span>
            <button
              onClick={() => setMobileDocNavOpen(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-650 border-none bg-transparent cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Search only */}
          <div className="p-3 shrink-0 border-b border-zinc-100">
            <SearchBar
              placeholder="Search documentation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Scrollable categories */}
          <div className="flex-1 overflow-y-auto py-2">
            {searchTerm ? (
              <div className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                Search Results Active
              </div>
            ) : (
              categories.map((cat) => {
                const catArticles = articles.filter((a) => a.category === cat.id);
                const isExpanded = expandedCategories[cat.id] !== false;
                return (
                  <div key={cat.id} className="mb-1">
                    {/* Category header with collapse */}
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wide hover:text-zinc-600 transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <span>{cat.label}</span>
                      {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>

                    {isExpanded && (
                      <div className="space-y-px">
                        {catArticles.map((a) => {
                          const isActive = activeArticleId === a.id;
                          return (
                            <button
                              key={a.id}
                              onClick={() => navigate(a.id)}
                              className={cn(
                                'w-full text-left px-3 py-2 text-[12px] transition-all duration-150 border-none cursor-pointer border-l-2 mx-1 w-[calc(100%-8px)] rounded-r-lg',
                                isActive
                                  ? 'bg-[#22577A]/8 text-[#22577A] font-semibold border-l-2 border-[#22577A]'
                                  : 'text-zinc-600 hover:text-zinc-900 border-l-2 border-transparent bg-transparent hover:bg-zinc-50'
                              )}
                            >
                              {a.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Right Content ────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-[780px] mx-auto px-4 py-6 sm:px-6 sm:py-8 text-left w-full">

            {/* 1. Search Results */}
            {searchTerm.trim() ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-[18px] font-bold text-zinc-950 tracking-tight">Search Results</h2>
                  <p className="text-[12px] text-zinc-400 font-medium mt-0.5">
                    Matching articles for &ldquo;{searchTerm}&rdquo;
                  </p>
                </div>
                {searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <HelpCircle size={32} className="text-zinc-300" />
                    <p className="text-[13px] font-semibold text-zinc-600">No documentation matches found</p>
                    <p className="text-[12px] text-zinc-400">Try searching for other setup variables or features.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((article) => (
                      <button
                        key={article.id}
                        onClick={() => navigate(article.id)}
                        className="w-full text-left p-4 border border-zinc-200 bg-zinc-50/50 hover:bg-white hover:border-[#22577A]/40 hover:shadow-sm transition-all rounded-xl flex flex-col gap-1.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#22577A] uppercase tracking-wide bg-[#22577A]/8 px-2 py-0.5 rounded-full">
                            {categories.find((c) => c.id === article.category)?.label}
                          </span>
                        </div>
                        <span className="text-[13px] font-semibold text-zinc-800">
                          {highlightText(article.title, searchTerm)}
                        </span>
                        <p className="text-[12px] text-zinc-500 leading-relaxed line-clamp-2">
                          {highlightText(article.description, searchTerm)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

            ) : activeArticleId === 'home' ? (

              /* 2. Documentation Home */
              <div className="space-y-8">
                {/* Hero */}
                <div className="bg-[#22577A]/5 border border-[#22577A]/15 rounded-xl p-6">
                  <h2 className="text-[20px] font-bold text-zinc-950 tracking-tight mb-1.5">
                    Dudo Documentation
                  </h2>
                  <p className="text-[13px] text-zinc-500 leading-relaxed max-w-[520px]">
                    Everything you need to configure, train, and manage your virtual AI receptionist.
                    Learn how to connect channels, manage business settings, and get the most out of Dudo.
                  </p>
                </div>

                {/* Quick Access */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Quick Access Guides</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { id: 'getting-started', title: 'Getting Started', desc: 'Launch Dudo in under 5 minutes.' },
                      { id: 'agent-config', title: 'Agent Config', desc: 'Custom instructions & fallback settings.' },
                      { id: 'knowledge-base', title: 'Knowledge Base', desc: 'Train AI with FAQs and PDF docs.' },
                      { id: 'conversations', title: 'Conversations', desc: 'Manage chats and manual takeover.' },
                      { id: 'analytics', title: 'Analytics', desc: 'Verify AI conversion rates & trends.' },
                      { id: 'integrations', title: 'Integrations', desc: 'WhatsApp & Telegram setup guides.' },
                    ].map((item) => (
                      <button
                        key={item.id + item.title}
                        onClick={() => navigate(item.id)}
                        className="text-left p-4 bg-white border border-zinc-200 hover:border-[#22577A]/40 hover:shadow-sm rounded-xl transition-all cursor-pointer group"
                      >
                        <span className="text-[13px] font-semibold text-zinc-800 block mb-1 group-hover:text-[#22577A] transition-colors">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-zinc-500 leading-relaxed block mb-3">{item.desc}</span>
                        <div className="flex items-center gap-1 text-[10px] text-[#22577A] font-bold uppercase tracking-wide">
                          Read Guide <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Popular Guides */}
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Popular Guides</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {popularGuides.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => navigate(item.id)}
                        className="text-left p-4 bg-white border border-zinc-200 hover:border-[#22577A]/40 hover:shadow-sm rounded-xl transition-all cursor-pointer group flex items-start gap-3"
                      >
                        <div className="w-7 h-7 rounded-lg bg-[#22577A]/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Zap size={13} className="text-[#22577A]" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[13px] font-semibold text-zinc-800 block group-hover:text-[#22577A] transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-zinc-400 leading-relaxed">{item.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Need Help card */}
                <div className="border border-zinc-200 rounded-xl p-5 bg-white flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-[#22577A]/10 flex items-center justify-center shrink-0">
                      <LifeBuoy size={16} className="text-[#22577A]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-zinc-800">Need Help?</p>
                      <p className="text-[12px] text-zinc-400 mt-0.5 leading-relaxed">
                        Can't find what you're looking for? Browse troubleshooting guides or reach out to the support team.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('contact-support')}
                    className="shrink-0 h-8 px-4 bg-[#22577A] hover:bg-[#1A4461] text-white font-semibold rounded-lg text-[12px] border-none cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    Troubleshooting Guide
                  </button>
                </div>
              </div>

            ) : activeArticle ? (

              /* 3. Article View */
              <div className="space-y-7">

                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium flex-wrap">
                  <button
                    onClick={() => navigate('home')}
                    className="hover:text-[#22577A] transition-colors cursor-pointer border-none bg-transparent"
                  >
                    Documentation
                  </button>
                  <ChevronRight size={11} />
                  <span className="text-zinc-500">
                    {breadcrumb?.category}
                  </span>
                  <ChevronRight size={11} />
                  <span className="text-zinc-700 font-semibold truncate">{breadcrumb?.title}</span>
                </nav>

                {/* Article header */}
                <div className="space-y-2 pb-5 border-b border-zinc-200">
                  <span className="inline-block text-[10px] font-bold text-[#22577A] uppercase tracking-wider bg-[#22577A]/8 border border-[#22577A]/20 px-2.5 py-0.5 rounded-full">
                    {categories.find((c) => c.id === activeArticle.category)?.label || 'Documentation'}
                  </span>
                  <h1 className="text-[24px] font-bold text-zinc-950 tracking-tight leading-tight">
                    {activeArticle.title}
                  </h1>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">{activeArticle.description}</p>
                </div>

                {/* Overview & Purpose */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-[13px] leading-relaxed">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Overview</span>
                    <p className="text-zinc-700 font-medium">{activeArticle.overview}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Purpose</span>
                    <p className="text-zinc-700 font-medium">{activeArticle.purpose}</p>
                  </div>
                </div>

                {/* Sections */}
                <div className="space-y-8">
                  {activeArticle.sections.map((sec, sidx) => (
                    <div key={sidx} className="space-y-4">
                      <h2 className="text-[15px] font-bold text-zinc-800 border-b border-zinc-100 pb-2">
                        {sec.title}
                      </h2>
                      <p className="text-[13px] text-zinc-600 leading-relaxed">{sec.content}</p>

                      {sec.steps && (
                        <div className="border border-zinc-200 rounded-xl p-4 bg-white shadow-sm space-y-0">
                          {sec.steps.map((st, snum) => (
                            <StepCard key={snum} number={snum + 1} text={st} />
                          ))}
                        </div>
                      )}

                      {sec.tips?.map((tp, tid) => <TipCard key={tid}>{tp}</TipCard>)}
                      {sec.warnings?.map((wn, wid) => <WarningCard key={wid}>{wn}</WarningCard>)}
                      {sec.successes?.map((sc, scid) => <SuccessCard key={scid}>{sc}</SuccessCard>)}
                      {sec.codeBlock && <CodeBlock lang={sec.codeBlock.lang} code={sec.codeBlock.code} />}
                    </div>
                  ))}
                </div>

                {/* Best Practices / Common Mistakes */}
                {(activeArticle.bestPractices || activeArticle.commonMistakes) && (
                  <div className="space-y-5 pt-5 border-t border-zinc-100">
                    {activeArticle.bestPractices && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-green-700 uppercase tracking-wider block">
                          ✓ Best Practices
                        </span>
                        <ul className="space-y-1.5 pl-1">
                          {activeArticle.bestPractices.map((bp, bidx) => (
                            <li key={bidx} className="flex items-start gap-2 text-[13px] text-zinc-600 leading-relaxed">
                              <span className="text-green-500 mt-0.5 shrink-0">•</span>
                              {bp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {activeArticle.commonMistakes && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">
                          ✗ Common Mistakes
                        </span>
                        <ul className="space-y-1.5 pl-1">
                          {activeArticle.commonMistakes.map((cm, cidx) => (
                            <li key={cidx} className="flex items-start gap-2 text-[13px] text-zinc-600 leading-relaxed">
                              <span className="text-red-400 mt-0.5 shrink-0">•</span>
                              {cm}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Related guides */}
                {activeArticle.related.length > 0 && (
                  <div className="pt-5 border-t border-zinc-100 space-y-2.5">
                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Related Guides</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeArticle.related.map((rid) => {
                        const rel = articles.find((a) => a.id === rid);
                        if (!rel) return null;
                        return (
                          <button
                            key={rid}
                            onClick={() => navigate(rid)}
                            className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 hover:border-[#22577A]/40 hover:text-[#22577A] rounded-lg text-[12px] font-medium text-zinc-600 cursor-pointer transition-all"
                          >
                            {rel.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Article feedback */}
                <ArticleFeedback />

                {/* Prev / Next navigation */}
                <div className="flex justify-between items-center pt-4 border-t border-zinc-100">
                  {navIndex.prev ? (
                    <button
                      onClick={() => navigate(navIndex.prev!.id)}
                      className="flex items-center gap-2 text-[12px] text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer font-semibold border-none bg-transparent group"
                    >
                      <div className="w-7 h-7 rounded-lg border border-zinc-200 flex items-center justify-center group-hover:border-zinc-300 transition-colors">
                        <ArrowLeft size={13} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] text-zinc-400 font-medium">Previous</p>
                        <p className="text-[12px] font-semibold text-zinc-700">{navIndex.prev.title}</p>
                      </div>
                    </button>
                  ) : <div />}

                  {navIndex.next ? (
                    <button
                      onClick={() => navigate(navIndex.next!.id)}
                      className="flex items-center gap-2 text-[12px] text-[#22577A] hover:text-[#1A4461] transition-all cursor-pointer font-semibold border-none bg-transparent group text-right"
                    >
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-400 font-medium">Next</p>
                        <p className="text-[12px] font-semibold text-[#22577A]">{navIndex.next.title}</p>
                      </div>
                      <div className="w-7 h-7 rounded-lg border border-[#22577A]/30 flex items-center justify-center group-hover:border-[#22577A] transition-colors">
                        <ArrowRight size={13} />
                      </div>
                    </button>
                  ) : <div />}
                </div>

              </div>
            ) : null}

          </div>
        </main>
      </div>
    </div>
  );
}
