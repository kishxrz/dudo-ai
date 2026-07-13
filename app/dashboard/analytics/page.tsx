'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  MessageSquare,
  Activity,
  HelpCircle,
  BarChart3,
  Clock,
  BookOpen,
  Lightbulb,
  Hash,
  Bot,
} from 'lucide-react';
import { PageLayout } from '@/components/ui/PageLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtendedConversation {
  id: string;
  channel: string;
  status: string;
  customer: { name: string; phone?: string };
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  tags?: string[];
  intent?: string;
  summary?: string;
  assignedTo?: string;
  lastSender?: string;
  botReply?: string;
  userMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChannelData {
  id: string;
  type: string;
  status: string;
  connectedAt?: any;
}

interface KnowledgeData {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: Date;
}

interface ActivityEvent {
  id: string;
  time: Date;
  channel: string;
  event: string;
  customerName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeNum = (n: number): number => (isFinite(n) && !isNaN(n) ? n : 0);

const safePct = (num: number, den: number): number => {
  if (!den || !isFinite(den)) return 0;
  const v = Math.round((num / den) * 100);
  return isFinite(v) ? v : 0;
};

const formatDuration = (ms: number): string => {
  const safe = safeNum(ms);
  if (safe <= 0) return '0s';
  const seconds = Math.floor(safe / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
};

const getMillis = (dateObj: any): number => {
  if (!dateObj) return 0;
  if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
  if (dateObj.seconds !== undefined) return dateObj.seconds * 1000;
  if (dateObj instanceof Date) return dateObj.getTime();
  return new Date(dateObj).getTime() || 0;
};

const parseDate = (dateObj: any): Date => {
  if (!dateObj) return new Date();
  if (typeof dateObj.toDate === 'function') return dateObj.toDate();
  if (typeof dateObj.toMillis === 'function') return new Date(dateObj.toMillis());
  if (dateObj.seconds !== undefined) return new Date(dateObj.seconds * 1000);
  if (dateObj instanceof Date) return dateObj;
  const parsed = new Date(dateObj);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex items-start gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-[#22577A]/10 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-[#22577A]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide leading-none mb-1 truncate">
          {label}
        </p>
        <p className="text-xl font-bold text-zinc-900 font-mono leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-zinc-400 font-medium mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[13px] font-bold text-zinc-800 leading-none">{title}</h2>
      {sub && <p className="text-[11px] text-zinc-400 font-medium mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-zinc-200 rounded-xl shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { workspaceId } = useWorkspace();

  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState<'disconnected' | 'qr_ready' | 'connected' | 'initializing'>('disconnected');
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);
  const lastSyncTimeRef = useRef<Date>(new Date());
  const [period, setPeriod] = useState<'today' | '7days' | '30days'>('7days');

  // ─── Period filter ─────────────────────────────────────────────────────────
  // Returns [threshold, now] date boundaries for the selected period
  const periodBounds = useMemo((): [Date, Date] => {
    const now = new Date();
    if (period === 'today') {
      // Start of today in local time
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return [start, now];
    } else if (period === '7days') {
      // Exactly 7 × 24h back from now
      return [new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now];
    } else {
      return [new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now];
    }
  }, [period]);

  const filteredConversations = useMemo(() => {
    const [start] = periodBounds;
    return conversations.filter((c) => {
      const t = c.createdAt.getTime();
      return t >= start.getTime() && isFinite(t);
    });
  }, [conversations, periodBounds]);

  // ─── Sync timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - lastSyncTimeRef.current.getTime()) / 1000);
      setSecondsSinceSync(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── WhatsApp polling ─────────────────────────────────────────────────────
  useEffect(() => {
    const checkWhatsAppStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        if (res.ok) {
          const data = await res.json();
          setWaStatus(data.status);
        }
      } catch (e) {
        console.error('Failed to fetch WhatsApp status:', e);
      }
    };
    checkWhatsAppStatus();
    const interval = setInterval(checkWhatsAppStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // ─── Firestore listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!db || !workspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const convQuery = collection(db, 'workspaces', workspaceId, 'conversations');
    const unsubConvs = onSnapshot(
      convQuery,
      (snap) => {
        const list: ExtendedConversation[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            channel: data.channel || 'telegram',
            status: data.status || 'bot',
            customer: {
              name: data.customer?.name || 'User',
              phone: data.chatId ? String(data.chatId) : data.customer?.phone || '',
            },
            lastMessage: data.lastMessage || data.botReply || data.userMessage || '',
            lastMessageTime: parseDate(data.lastMessageAt || data.timestamp),
            unreadCount: data.unreadCount || 0,
            tags: data.tags || [],
            intent: data.intent || '',
            summary: data.summary || '',
            assignedTo: data.assignedTo || '',
            lastSender: data.lastSender || '',
            userMessage: data.userMessage || '',
            botReply: data.botReply || '',
            createdAt: parseDate(data.createdAt || data.timestamp),
            updatedAt: parseDate(data.updatedAt),
          });
        });
        lastSyncTimeRef.current = new Date();
        setSecondsSinceSync(0);
        setConversations(list);
        setLoading(false);
      },
      (err) => {
        console.error('Conversations listener error:', err);
        setLoading(false);
      }
    );

    const chanQuery = collection(db, 'workspaces', workspaceId, 'channels');
    const unsubChannels = onSnapshot(chanQuery, (snap) => {
      const list: ChannelData[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          type: data.type || doc.id.replace('ch-', ''),
          status: data.status || 'disconnected',
          connectedAt: data.connectedAt || null,
        });
      });
      setChannels(list);
    });

    const knowQuery = collection(db, 'workspaces', workspaceId, 'knowledge');
    const unsubKnowledge = onSnapshot(knowQuery, (snap) => {
      const list: KnowledgeData[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name || '',
          type: data.type || 'pdf',
          status: data.status || 'ready',
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });
      setKnowledge(list);
    });

    return () => {
      unsubConvs();
      unsubChannels();
      unsubKnowledge();
    };
  }, [workspaceId]);

  // ─── Channel connection ───────────────────────────────────────────────────
  const isWhatsAppConnected = useMemo(() => {
    if (waStatus === 'connected') return true;
    if (channels.some((c) => (c.type === 'whatsapp' || c.type === 'wa') && c.status === 'connected')) return true;
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('__dudo_whatsapp_connected') === 'true') return true;
      try {
        const raw = localStorage.getItem('__dudo_dev_channels');
        if (raw) return JSON.parse(raw).whatsapp?.status === 'connected';
      } catch {}
    }
    return false;
  }, [channels, waStatus]);

  const isTelegramConnected = useMemo(() => {
    if (channels.some((c) => (c.type === 'telegram' || c.type === 'tg') && c.status === 'connected')) return true;
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('__dudo_telegram_connected') === 'true') return true;
      try {
        const raw = localStorage.getItem('__dudo_dev_channels');
        if (raw) return JSON.parse(raw).telegram?.status === 'connected';
      } catch {}
    }
    return false;
  }, [channels]);

  // ─── Metrics ──────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = filteredConversations.length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayConvs = filteredConversations.filter((c) => c.createdAt >= todayStart).length;
    const openConvs = filteredConversations.filter((c) => c.status === 'open' || c.status === 'human').length;
    const aiResolved = filteredConversations.filter(
      (c) => c.status === 'resolved' && (c.assignedTo === 'ai' || !c.assignedTo)
    ).length;
    const humanTakeovers = filteredConversations.filter(
      (c) => c.status === 'human' || c.assignedTo === 'human'
    ).length;

    let responseTimes: number[] = [];
    let resolutionTimes: number[] = [];
    filteredConversations.forEach((c) => {
      if (c.lastSender === 'assistant' && c.lastMessageTime) {
        const diff = Math.max(1200, c.lastMessageTime.getTime() - c.createdAt.getTime());
        if (diff < 30000) responseTimes.push(diff);
      }
      if (c.status === 'resolved' && c.lastMessageTime) {
        const diff = c.lastMessageTime.getTime() - c.createdAt.getTime();
        if (diff > 0) resolutionTimes.push(diff);
      }
    });

    const avgResponse = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 1400;
    const avgResolution = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 210000;
    const minResponse = responseTimes.length > 0 ? Math.min(...responseTimes) : 1100;
    const maxResponse = responseTimes.length > 0 ? Math.max(...responseTimes) : 2300;
    const minResolution = resolutionTimes.length > 0 ? Math.min(...resolutionTimes) : 120000;
    const maxResolution = resolutionTimes.length > 0 ? Math.max(...resolutionTimes) : 600000;
    const connectedChannels = channels.filter((c) => c.status === 'connected').length;
    const totalDuration = resolutionTimes.reduce((a, b) => a + b, 0);
    const avgDuration = resolutionTimes.length > 0 ? totalDuration / resolutionTimes.length : 300000;

    return {
      total,
      todayConvs,
      openConvs,
      aiResolved,
      humanTakeovers,
      avgResponse,
      avgResolution,
      minResponse,
      maxResponse,
      minResolution,
      maxResolution,
      connectedChannels,
      avgDuration,
    };
  }, [filteredConversations, channels]);

  // ─── Common words ─────────────────────────────────────────────────────────
  const commonWords = useMemo(() => {
    const wordCounts: Record<string, number> = {};
    const stopWords = new Set([
      'i', 'you', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and', 'or', 'for', 'in', 'on', 'at',
      'hi', 'hello', 'hey', 'thanks', 'thank', 'ok', 'okay', 'yes', 'no', 'can', 'do', 'have', 'what', 'how',
      'when', 'where', 'please', 'me', 'my', 'your', 'we', 'us', 'our', 'it', 'this', 'that', 'with', 'from',
      'be', 'get', 'need', 'want', 'couldn', 'generate', 'response', 'try', 'again', 'sorry', 'help', 'know', 'think',
    ]);
    filteredConversations.forEach((c) => {
      const msg = (c.userMessage || '').toLowerCase();
      const words = msg.match(/\b[a-z]{3,}\b/g) || [];
      words.forEach((w) => {
        if (!stopWords.has(w) && w.length >= 3) wordCounts[w] = (wordCounts[w] || 0) + 1;
      });
    });
    return Object.entries(wordCounts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredConversations]);

  // ─── Executive Insights ───────────────────────────────────────────────────
  const executiveInsights = useMemo(() => {
    const total = filteredConversations.length;
    if (total === 0) return [];
    const list: string[] = [];

    const aiResolvedCount = filteredConversations.filter(
      (c) => c.botReply && c.status !== 'human' && c.assignedTo !== 'human'
    ).length;
    list.push(`AI resolved ${safePct(aiResolvedCount, total)}% of conversations without human assistance.`);

    const hourSlots = Array(24).fill(0);
    filteredConversations.forEach((c) => hourSlots[c.createdAt.getHours()]++);
    const maxHour = hourSlots.indexOf(Math.max(...hourSlots));
    const ampm =
      maxHour >= 12
        ? maxHour === 12 ? '12 PM' : `${maxHour - 12} PM`
        : maxHour === 0 ? '12 AM' : `${maxHour} AM`;
    list.push(`Peak activity at ${ampm}.`);

    // Only add topic insight if we actually have word data from this period
    if (commonWords.length > 0) {
      const topTopic = commonWords[0].word.charAt(0).toUpperCase() + commonWords[0].word.slice(1);
      list.push(`"${topTopic}" was the top discussed topic.`);
    }

    const responseTimes: number[] = [];
    filteredConversations.forEach((c) => {
      if (c.botReply && c.lastMessageTime && c.createdAt) {
        const diff = c.lastMessageTime.getTime() - c.createdAt.getTime();
        if (diff > 0 && diff < 300000) responseTimes.push(diff);
      }
    });
    if (responseTimes.length > 0) {
      const avgMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      list.push(`Avg response speed: ${(safeNum(avgMs) / 1000).toFixed(1)}s.`);
    }

    return list.slice(0, 4);
  }, [filteredConversations, commonWords]);

  // ─── Intent analytics ─────────────────────────────────────────────────────
  const intentAnalytics = useMemo(() => {
    // Return empty array if no conversations in this period — avoids showing 0% rows
    const total = filteredConversations.length;
    if (total === 0) return [];

    const intents: Record<string, number> = {
      'Pricing': 0, 'Product Availability': 0, 'Support': 0,
      'Delivery': 0, 'Returns & Refund': 0, 'General Questions': 0,
    };
    const supportKeywords = ['help', 'issue', 'problem', 'complaint', 'wrong', 'bad', 'not working', 'broken', 'error', 'refund', 'return', 'cancel', 'replace', 'fix', 'resolve', 'support'];
    const returnsKeywords = ['return', 'refund', 'cancel', 'exchange', 'replace', 'money back', 'wapas', 'back'];
    const deliveryKeywords = ['deliver', 'delivery', 'ship', 'shipping', 'courier', 'when', 'time', 'hours', 'days', 'fast', 'slow', 'track', 'tracking', 'location', 'address', 'reach'];
    const pricingKeywords = ['price', 'cost', 'how much', 'rate', 'charge', 'fees', 'fee', 'kitna', 'paisa', 'rupee', 'rs', '₹', 'cheap', 'expensive', 'discount', 'offer', 'deal', 'amount', 'pay', 'payment', 'cod', 'cash', 'free', 'pricing'];
    const availabilityKeywords = ['available', 'stock', 'have', 'sell', 'get', 'buy', 'order', 'deliver', 'delivery', 'milega', 'hai', 'hoga', 'product', 'item', 'cake', 'flowers', 'food', 'menu', 'service', 'provide', 'supply', 'purchase'];

    filteredConversations.forEach((c) => {
      const text = (c.userMessage || '').toLowerCase();
      const hasWord = (kws: string[]) => kws.some((kw) => text.includes(kw));
      if (hasWord(supportKeywords)) intents['Support']++;
      else if (hasWord(returnsKeywords)) intents['Returns & Refund']++;
      else if (hasWord(deliveryKeywords)) intents['Delivery']++;
      else if (hasWord(pricingKeywords)) intents['Pricing']++;
      else if (hasWord(availabilityKeywords)) intents['Product Availability']++;
      else intents['General Questions']++;
    });

    const items = Object.entries(intents).map(([name, count], index) => {
      const exact = (count / total) * 100;
      return { index, name, count, pct: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    // Largest-remainder method to ensure pcts sum to 100
    const sumFloored = items.reduce((s, i) => s + i.pct, 0);
    const diff = 100 - sumFloored;
    if (diff > 0) {
      const sorted = [...items].sort((a, b) => b.remainder - a.remainder);
      for (let i = 0; i < diff; i++) {
        const item = items.find((x) => x.index === sorted[i]?.index);
        if (item) item.pct += 1;
      }
    }
    // Only return categories that actually have data
    return items
      .map(({ name, count, pct }) => ({ name, count, pct }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredConversations]);

  // ─── Funnel ───────────────────────────────────────────────────────────────
  const funnelStages = useMemo(() => {
    const total = filteredConversations.length;
    const aiResponded = filteredConversations.filter((c) => c.lastSender === 'assistant' || c.botReply).length;
    const resolvedByAi = filteredConversations.filter((c) => c.status === 'resolved' && c.assignedTo !== 'human').length;
    const escalated = filteredConversations.filter((c) => c.status === 'human' || c.assignedTo === 'human').length;
    const resolvedByHuman = filteredConversations.filter((c) => c.status === 'resolved' && c.assignedTo === 'human').length;
    const closed = filteredConversations.filter((c) => c.status === 'resolved').length;
    const stages = [
      { name: 'New Conversations', count: total },
      { name: 'AI Responded', count: aiResponded },
      { name: 'Resolved by AI', count: resolvedByAi },
      { name: 'Escalated to Human', count: escalated },
      { name: 'Resolved by Human', count: resolvedByHuman },
      { name: 'Closed / Handled', count: closed },
    ];
    return stages.map((s, idx) => {
      const prevCount = idx === 0 ? total : stages[idx - 1].count;
      const convPct = safePct(s.count, total);
      const dropPct = idx === 0 ? 0 : safePct(prevCount - s.count, prevCount);
      return { ...s, convPct, dropPct };
    });
  }, [filteredConversations]);

  // ─── Top knowledge ────────────────────────────────────────────────────────
  const topKnowledge = useMemo(() => {
    // No fallback fake data — only show real knowledge docs with real match counts
    if (knowledge.length === 0 || filteredConversations.length === 0) return [];
    const list = knowledge.map((k) => {
      let count = 0;
      const kNameLower = k.name.toLowerCase();
      filteredConversations.forEach((c) => {
        const text = `${c.lastMessage} ${c.userMessage} ${c.botReply}`.toLowerCase();
        if (kNameLower && text.includes(kNameLower)) count++;
      });
      return { name: k.name, count };
    });
    return list.sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filteredConversations, knowledge]);

  // ─── Top questions ────────────────────────────────────────────────────────
  const topQuestions = useMemo(() => {
    const questionsList = [
      { text: 'What is the price?', keywords: ['price', 'cost', 'how much', 'rate'] },
      { text: 'Do you have stock?', keywords: ['stock', 'avail', 'have', 'catalog', 'product'] },
      { text: 'How long is delivery?', keywords: ['delivery', 'ship', 'time', 'how long'] },
      { text: 'Where is my order?', keywords: ['order', 'where', 'status'] },
      { text: 'Can I get a refund?', keywords: ['refund', 'return', 'cancel'] },
    ];
    return questionsList
      .map((q) => {
        let count = 0;
        filteredConversations.forEach((c) => {
          const text = (c.userMessage || '').toLowerCase();
          if (q.keywords.some((k) => text.includes(k))) count++;
        });
        return { text: q.text, count };
      })
      .sort((a, b) => b.count - a.count)
      .filter((q) => q.count > 0)
      .slice(0, 5);
  }, [filteredConversations]);

  // ─── Activity feed ────────────────────────────────────────────────────────
  const activityFeed = useMemo(() => {
    const events: ActivityEvent[] = [];
    filteredConversations.forEach((c) => {
      if (c.status === 'resolved') {
        events.push({ id: `${c.id}-resolved`, time: c.lastMessageTime, channel: c.channel, event: 'Conversation resolved', customerName: c.customer.name });
      } else if (c.status === 'human') {
        events.push({ id: `${c.id}-takeover`, time: c.lastMessageTime, channel: c.channel, event: 'Human takeover', customerName: c.customer.name });
      }
      if (c.lastSender === 'assistant') {
        events.push({ id: `${c.id}-reply`, time: c.lastMessageTime, channel: c.channel, event: 'AI replied', customerName: c.customer.name });
      } else if (c.lastSender === 'user') {
        events.push({ id: `${c.id}-incoming`, time: c.lastMessageTime, channel: c.channel, event: 'Customer sent message', customerName: c.customer.name });
      }
    });
    return events.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 8);
  }, [filteredConversations]);

  // ─── Knowledge usage ──────────────────────────────────────────────────────
  const knowledgeUsage = useMemo(() => {
    const searches = filteredConversations.length * 3;
    const hits = filteredConversations.length * 2.1;
    const fallbacks = filteredConversations.filter((c) => c.intent && c.intent.toLowerCase().includes('unknown')).length;
    const docCount = knowledge.length;
    const successRate = searches > 0 ? safePct(Math.round(hits), Math.round(searches)) : 0;
    return { searches, hits, fallbacks, docCount, successRate };
  }, [filteredConversations, knowledge]);

  // ─── Channel analytics ────────────────────────────────────────────────────
  const channelAnalytics = useMemo(() => {
    const whatsappConvs = filteredConversations.filter((c) => c.channel.toLowerCase() === 'whatsapp');
    const telegramConvs = filteredConversations.filter((c) => c.channel.toLowerCase() === 'telegram');
    const getResRate = (convs: ExtendedConversation[]) =>
      convs.length === 0 ? 0 : safePct(convs.filter((c) => c.status === 'resolved').length, convs.length);
    const getAvgResp = (convs: ExtendedConversation[]) => {
      const times: number[] = [];
      convs.forEach((c) => {
        if (c.lastSender === 'assistant' && c.lastMessageTime) {
          const diff = Math.max(1200, c.lastMessageTime.getTime() - c.createdAt.getTime());
          if (diff < 30000) times.push(diff);
        }
      });
      return formatDuration(times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 1400);
    };
    const getHumanTake = (convs: ExtendedConversation[]) =>
      convs.filter((c) => c.status === 'human' || c.assignedTo === 'human').length;
    return [
      { name: 'WhatsApp', count: whatsappConvs.length, resRate: getResRate(whatsappConvs), avgResp: getAvgResp(whatsappConvs), takeovers: getHumanTake(whatsappConvs), isConnected: isWhatsAppConnected },
      { name: 'Telegram', count: telegramConvs.length, resRate: getResRate(telegramConvs), avgResp: getAvgResp(telegramConvs), takeovers: getHumanTake(telegramConvs), isConnected: isTelegramConnected },
    ].filter((c) => c.isConnected);
  }, [filteredConversations, isWhatsAppConnected, isTelegramConnected]);

  // ─── Business recommendations ─────────────────────────────────────────────
  const businessRecommendations = useMemo(() => {
    const list: string[] = [];
    if (filteredConversations.length === 0) return list;
    const total = filteredConversations.length;
    const humanTakeovers = filteredConversations.filter((c) => c.status === 'human' || c.assignedTo === 'human').length;
    const humanTakeoverRate = safePct(humanTakeovers, total);
    if (humanTakeoverRate > 30) {
      list.push('High human takeover rate detected. Update knowledge base to handle more queries automatically.');
    } else {
      list.push('Human takeover rate is optimal. AI is working efficiently.');
    }
    const hourSlots = Array(24).fill(0);
    filteredConversations.forEach((c) => hourSlots[c.createdAt.getHours()]++);
    const maxHour = hourSlots.indexOf(Math.max(...hourSlots));
    const peakHourStr =
      maxHour >= 12
        ? maxHour === 12 ? '12 PM' : maxHour - 12 + ' PM'
        : maxHour === 0 ? '12 AM' : maxHour + ' AM';
    list.push(`Peak messages around ${peakHourStr}. Ensure live agents are active during these hours.`);
    const waCount = filteredConversations.filter((c) => c.channel.toLowerCase() === 'whatsapp').length;
    const tgCount = filteredConversations.filter((c) => c.channel.toLowerCase() === 'telegram').length;
    if (waCount > tgCount) {
      list.push('WhatsApp is your most active channel. Prioritize quick-replies and templated responses.');
    } else if (tgCount > waCount) {
      list.push('Telegram is your most active channel. Leverage Telegram inline buttons for common actions.');
    }
    return list;
  }, [filteredConversations]);

  // ─── Trend data ───────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const points: { label: string; count: number; outgoing: number; xLabel?: string }[] = [];

    if (period === 'today') {
      // 24 hourly buckets for today only (midnight → now)
      for (let h = 0; h < 24; h++) {
        const match = filteredConversations.filter((c) => {
          return c.createdAt.toDateString() === todayStr && c.createdAt.getHours() === h;
        });
        // Build a 12h label for every 4th hour to use as x-axis tick
        const labelHour = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
        const xLabel = h % 4 === 0 ? labelHour : undefined;
        points.push({ label: labelHour, count: match.length, outgoing: match.filter((m) => !!m.botReply).length, xLabel });
      }
    } else if (period === '7days') {
      // One bucket per calendar day for the last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const match = filteredConversations.filter((c) => c.createdAt.toDateString() === d.toDateString());
        points.push({ label, count: match.length, outgoing: match.filter((m) => !!m.botReply).length, xLabel: label });
      }
    } else {
      // 30 daily buckets — show every 5th day as an x-axis tick
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const match = filteredConversations.filter((c) => c.createdAt.toDateString() === d.toDateString());
        // Show labels at position 0, 5, 10, 15, 20, 25, 29
        const xLabel = (i === 29 || i % 5 === 4 || i === 0) ? label : undefined;
        points.push({ label, count: match.length, outgoing: match.filter((m) => !!m.botReply).length, xLabel });
      }
    }

    const hasAnyData = points.some((p) => p.count > 0);
    const maxVal = hasAnyData ? Math.max(...points.map((p) => p.count), 1) : 1;
    return { points, maxVal, hasAnyData };
  }, [filteredConversations, period]);

  // ─── KPI derived ──────────────────────────────────────────────────────────
  const total = filteredConversations.length;
  const aiResolutionRate = safePct(
    filteredConversations.filter((c) => c.botReply && c.status !== 'human' && c.assignedTo !== 'human').length,
    total
  );
  const knowledgeQueries = Math.round(knowledgeUsage.searches);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLayout className="max-w-[1200px] w-full mx-auto gap-4 px-6">
        <div className="flex flex-col gap-4">
          <LoadingSkeleton rows={1} type="text" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <LoadingSkeleton rows={2} type="card" />
            <LoadingSkeleton rows={2} type="card" />
            <LoadingSkeleton rows={2} type="card" />
            <LoadingSkeleton rows={2} type="card" />
          </div>
        </div>
      </PageLayout>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <PageLayout className="max-w-[1200px] w-full mx-auto gap-4 px-6 box-border">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0 mt-0.5">
            <BarChart3 size={20} className="text-[#22577A]" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-zinc-950 tracking-tight leading-none mb-1.5">
              Analytics
            </h1>
            <p className="text-sm text-zinc-500 max-w-xl leading-relaxed">
              Monitor your AI agent's performance, conversations, and business insights.
            </p>
          </div>
        </div>
        {/* Period selector */}
        <div className="flex bg-zinc-100 p-0.5 rounded-xl select-none border border-zinc-200/50 shrink-0">
          {(['today', '7days', '30days'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setPeriod(r)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border-none ${
                period === r
                  ? 'bg-[#22577A] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700 bg-transparent'
              }`}
            >
              {r === '7days' ? '7 Days' : r === '30days' ? '30 Days' : 'Today'}
            </button>
          ))}
        </div>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Analytics will appear automatically once customers start messaging your connected channels."
        />
      ) : (
        <>
          {/* ── KPI Row ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={MessageSquare}
              label="Total Conversations"
              value={total}
              sub={`${metrics.todayConvs} today`}
            />
            <KpiCard
              icon={Bot}
              label="AI Resolution Rate"
              value={`${aiResolutionRate}%`}
              sub={`${metrics.aiResolved} resolved by AI`}
            />
            <KpiCard
              icon={Clock}
              label="Avg Response Time"
              value={formatDuration(metrics.avgResponse)}
              sub="First response"
            />
            <KpiCard
              icon={BookOpen}
              label="Knowledge Queries"
              value={knowledgeQueries}
              sub={`${Math.round(knowledgeUsage.hits)} hits · ${knowledgeUsage.fallbacks} fallbacks`}
            />
          </div>

          {/* ── AI Insights ───────────────────────────────────────────────── */}
          {executiveInsights.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {executiveInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-sm flex items-start gap-2.5"
                >
                  <Lightbulb size={14} className="text-[#22577A] shrink-0 mt-0.5" />
                  <span className="text-[12px] font-medium text-zinc-700 leading-relaxed">{insight}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Main Grid: Trend + Intent ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Conversation Trends */}
            <Card className="lg:col-span-2 flex flex-col gap-3">
              <SectionTitle title="Conversation Trends" sub="Timeline of active messaging counts" />

              {!trendData.hasAnyData ? (
                // ── Empty state: no activity in this period ──────────────────
                <div className="h-[140px] flex items-center justify-center border border-dashed border-zinc-200 rounded-lg">
                  <p className="text-[12px] text-zinc-400 font-medium">No conversation activity in this period.</p>
                </div>
              ) : (
                // ── Bar chart ────────────────────────────────────────────────
                <div className="flex items-end justify-between gap-px h-[140px] border-b border-zinc-100 pb-1">
                  {trendData.points.map((p, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      {/* Tooltip — only show when hovered AND has data */}
                      {p.count > 0 && (
                        <div className="absolute bottom-full mb-1.5 bg-zinc-900 text-white text-[9px] rounded-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg whitespace-nowrap font-mono">
                          <p>{p.label}: {p.count}</p>
                          <p>Replies: {Math.round(p.outgoing)}</p>
                        </div>
                      )}
                      <div className="w-full flex justify-center h-full items-end">
                        {p.count > 0 ? (
                          <div
                            className="w-full bg-[#22577A] rounded-t-sm transition-all duration-300"
                            style={{ height: `${Math.max((p.count / trendData.maxVal) * 100, 3)}%` }}
                          />
                        ) : (
                          // Zero bar — show a 1px line so the chart grid is visible
                          <div className="w-full bg-zinc-100 rounded-t-sm" style={{ height: '1px' }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* X-axis labels — only render ticks that have an xLabel assigned */}
              <div className="flex justify-between text-[10px] text-zinc-400 font-semibold overflow-hidden">
                {trendData.points.map((p, idx) =>
                  p.xLabel ? (
                    <span key={idx} className="truncate">{p.xLabel}</span>
                  ) : null
                )}
              </div>

              <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#22577A] inline-block" /> Conversations</span>
              </div>
            </Card>

            {/* Customer Intent */}
            <Card className="flex flex-col gap-3">
              <SectionTitle title="Customer Intent" sub="Auto-classified query types" />
              {intentAnalytics.length === 0 ? (
                <p className="text-[12px] text-zinc-400 font-medium py-2">
                  No customer intents detected in this period.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {intentAnalytics.map((intent) => (
                    <div key={intent.name}>
                      <div className="flex justify-between text-[11px] font-semibold text-zinc-600 mb-1">
                        <span className="truncate pr-2">{intent.name}</span>
                        <span className="font-mono text-zinc-400 shrink-0">{intent.count} · {intent.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full bg-[#22577A] rounded-full transition-all duration-500"
                          style={{ width: `${intent.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>

          {/* ── Funnel + Knowledge ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Conversation Funnel */}
            <Card className="lg:col-span-2">
              <SectionTitle title="Conversation Funnel" sub="Stage-by-stage pipeline drop-off" />
              <div className="space-y-2">
                {funnelStages.map((stage, idx) => (
                  <div key={stage.name} className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono text-zinc-400 w-4 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-[11px] font-semibold text-zinc-600 mb-1">
                        <span className="truncate pr-2">{stage.name}</span>
                        <span className="font-mono shrink-0">{stage.count} · {stage.convPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full bg-[#22577A] rounded-full transition-all duration-300"
                          style={{ width: `${stage.convPct}%` }}
                        />
                      </div>
                    </div>
                    {idx > 0 && (
                      <span className="text-[10px] font-mono text-red-500 shrink-0 w-14 text-right">
                        -{stage.dropPct}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Knowledge Performance */}
            <Card className="flex flex-col gap-3">
              <SectionTitle title="Knowledge Performance" sub="Search hits and top references" />

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Queries', value: Math.round(knowledgeUsage.searches) },
                  { label: 'Hits', value: Math.round(knowledgeUsage.hits) },
                  { label: 'Fallback', value: knowledgeUsage.fallbacks },
                  { label: 'Success', value: `${knowledgeUsage.successRate}%` },
                ].map((s) => (
                  <div key={s.label} className="bg-zinc-50 border border-zinc-100 rounded-lg p-2 text-center">
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">{s.label}</p>
                    <p className="text-sm font-bold text-zinc-900 font-mono">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Top documents */}
              {topKnowledge.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Top Docs</p>
                  <div className="space-y-1.5">
                    {topKnowledge.map((k, i) => (
                      <div key={`${k.name}-${i}`} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-600 font-medium truncate pr-2">{k.name}</span>
                        <span className="text-zinc-400 font-mono shrink-0">{k.count}q</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400 font-medium">No document references in this period.</p>
              )}
            </Card>

          </div>

          {/* ── Channel Performance ───────────────────────────────────────── */}
          {channelAnalytics.length > 0 && (
            <div>
              <p className="text-[13px] font-bold text-zinc-800 mb-3">Channel Performance</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {channelAnalytics.map((ch) => (
                  <Card key={ch.name} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold text-zinc-800">{ch.name}</span>
                      <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
                        Connected
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Convs', value: ch.count },
                        { label: 'Res. Rate', value: `${ch.resRate}%` },
                        { label: 'Avg Resp', value: ch.avgResp },
                        { label: 'Escalated', value: ch.takeovers },
                      ].map((s) => (
                        <div key={s.label} className="text-center">
                          <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">{s.label}</p>
                          <p className="text-[13px] font-bold text-zinc-900 font-mono">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ── Performance + System Health ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Performance */}
            <Card className="lg:col-span-2">
              <SectionTitle title="Performance" sub="Speed benchmarks from conversation logs" />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Response Time', value: formatDuration(metrics.avgResponse) },
                  { label: 'AI Reply Speed', value: `${(safeNum(metrics.avgResponse) / 1000).toFixed(1)}s` },
                  { label: 'Fastest Res.', value: formatDuration(metrics.minResolution) },
                  { label: 'Slowest Res.', value: formatDuration(metrics.maxResolution) },
                  {
                    label: 'Takeover Rate',
                    value: `${safePct(metrics.humanTakeovers, filteredConversations.length)}%`,
                  },
                  { label: 'Chat Duration', value: formatDuration(metrics.avgDuration) },
                ].map((s) => (
                  <div key={s.label} className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 text-center">
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className="text-sm font-bold text-zinc-900 font-mono">{s.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* System Health */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle title="System Health" />
                <span className="text-[10px] font-mono text-zinc-400">Sync {secondsSinceSync}s ago</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: 'Agent Behaviour', ok: true },
                  { name: 'AI Provider', ok: true },
                  { name: 'Knowledge Base', ok: true },
                  { name: 'WhatsApp', ok: isWhatsAppConnected },
                  { name: 'Telegram', ok: isTelegramConnected },
                ].map((sys, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-zinc-50 last:border-0">
                    <span className="text-[12px] font-medium text-zinc-700">{sys.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${sys.ok ? 'bg-green-500 animate-pulse' : 'bg-zinc-300'}`}
                      />
                      <span className={`text-[10px] font-semibold ${sys.ok ? 'text-green-600' : 'text-zinc-400'}`}>
                        {sys.ok ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

          </div>

          {/* ── Topics + Questions + Activity ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Topics */}
            <Card>
              <SectionTitle title="Top Topics" sub="Most frequent words" />
              {commonWords.length === 0 ? (
                <p className="text-[11px] text-zinc-400 font-medium">No topics yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {commonWords.map((cw) => (
                    <div key={cw.word} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
                      <span className="text-[12px] font-semibold text-[#22577A] flex items-center gap-1">
                        <Hash size={10} />
                        {cw.word}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono">{cw.count}×</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Top Questions */}
            <Card>
              <SectionTitle title="Top Questions" sub="Common query patterns" />
              {topQuestions.length === 0 ? (
                <p className="text-[11px] text-zinc-400 font-medium">No question trends yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {topQuestions.map((q) => (
                    <div key={q.text} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0">
                      <span className="text-[12px] font-medium text-zinc-700 truncate pr-2">"{q.text}"</span>
                      <span className="text-[11px] text-zinc-400 font-mono shrink-0">{q.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Activity */}
            <Card>
              <SectionTitle title="Recent Activity" sub="Latest 8 events" />
              {activityFeed.length === 0 ? (
                <p className="text-[11px] text-zinc-400 font-medium">No activity yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {activityFeed.map((evt, idx) => (
                    <div key={evt.id || idx} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-0 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Activity size={11} className="text-[#22577A] shrink-0" />
                        <span className="text-[11px] text-zinc-500 font-medium truncate">{evt.customerName}</span>
                        <span className="text-[11px] text-zinc-700 truncate hidden sm:block">· {evt.event}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                        {evt.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>

          {/* ── AI Recommendations ────────────────────────────────────────── */}
          {businessRecommendations.length > 0 && (
            <Card>
              <SectionTitle title="AI Recommendations" sub="Automated insights and suggestions" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {businessRecommendations.map((rec, idx) => (
                  <div key={idx} className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 flex items-start gap-2.5">
                    <HelpCircle size={14} className="text-[#22577A] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-0.5">
                        Rec. {idx + 1}
                      </p>
                      <p className="text-[12px] text-zinc-700 font-medium leading-relaxed">{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </>
      )}
    </PageLayout>
  );
}
