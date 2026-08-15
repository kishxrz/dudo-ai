'use client';

import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import SaveButton from '@/components/ui/SaveButton';
import {
  MessageSquare,
  Search,
  Info,
  Bot,
  ChevronRight,
  ChevronLeft,
  BarChart2,
  Tag,
  X,
  BellOff,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConversationDoc {
  id: string;
  channel?: string;
  chatId?: string;
  customer?: { name?: string };
  userMessage?: string;
  botReply?: string;
  timestamp?: any;
  status?: string;
}

interface GroupedConversation {
  chatId: string;
  customer?: { name?: string };
  channel?: string;
  latestTimestamp?: any;
  latestMessagePreview?: string;
  messages: ConversationDoc[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return '';
  const date = toDate(timestamp);
  const now = new Date();
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatBubbleTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = toDate(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(timestamp: any): string {
  if (!timestamp) return '';
  const date = toDate(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function getDateKey(timestamp: any): string {
  const date = toDate(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDisplayName(name?: string, chatId?: string, channel?: string): string {
  const ch = (channel || 'telegram').toLowerCase();
  
  // If we don't have a name, fallback to chatId
  let rawName = name || chatId || 'Unknown User';
  
  if (ch === 'whatsapp') {
    // If it's a JID like 123456789@c.us or 123456789@lid
    if (rawName.includes('@')) {
      const parts = rawName.split('@');
      const localPart = parts[0];
      if (/^\d+$/.test(localPart)) {
        return `+${localPart}`;
      }
      return localPart;
    }
    if (/^\d+$/.test(rawName)) {
      return `+${rawName}`;
    }
  } else if (ch === 'telegram') {
    if (/^\d+$/.test(rawName)) {
      return `+${rawName}`;
    }
  }
  
  return rawName;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  if (name.startsWith('+')) {
    return name.slice(0, 3); // Return country code prefix like "+1" or "+9"
  }
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getAvatarColor(name?: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700',
    'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700',
    'bg-teal-100 text-teal-700',
  ];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

// ─── Channel SVG Logos (same source as AgentChannels.tsx) ─────────────────────

const WhatsAppLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path fill="#25D366" d="M12.004 2C6.48 2 2.002 6.477 2.002 12c0 1.892.522 3.66 1.43 5.176l-1.42 5.19 5.31-1.39A9.936 9.936 0 0 0 12.004 22c5.52 0 9.998-4.477 9.998-10s-4.478-10-9.998-10z" />
    <path fill="#FFFFFF" d="M8.391 7.308a.961.961 0 0 0-.371.1 1.293 1.293 0 0 0-.294.228c-.12.113-.188.211-.261.306A2.729 2.729 0 0 0 6.9 9.62c.002.49.13.967.33 1.413.409.902 1.082 1.857 1.971 2.742.214.213.423.427.648.626a9.448 9.448 0 0 0 3.84 2.046l.569.087c.185.01.37-.004.556-.013a1.99 1.99 0 0 0 .833-.231c.166-.088.244-.132.383-.22 0 0 .043-.028.125-.09.135-.1.218-.171.33-.288.083-.086.155-.187.21-.302.078-.163.156-.474.188-.733.024-.198.017-.306.014-.373-.004-.107-.093-.218-.19-.265l-.582-.261s-.87-.379-1.401-.621a.498.498 0 0 0-.177-.041.482.482 0 0 0-.378.127v-.002c-.005 0-.072.057-.795.933a.35.35 0 0 1-.368.13 1.416 1.416 0 0 1-.191-.066c-.124-.052-.167-.072-.252-.109l-.005-.002a6.01 6.01 0 0 1-1.57-1c-.126-.11-.243-.23-.363-.346a6.296 6.296 0 0 1-1.02-1.268l-.059-.095a.923.923 0 0 1-.102-.205c-.038-.147.061-.265.061-.265s.243-.266.356-.41a4.38 4.38 0 0 0 .263-.373c.118-.19.155-.385.093-.536-.28-.684-.57-1.365-.868-2.041-.059-.134-.234-.23-.393-.249-.054-.006-.108-.012-.162-.016a3.385 3.385 0 0 0-.403.004z" />
  </svg>
);

const TelegramLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path fill="#24A1DE" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" />
    <path fill="#FFFFFF" d="M12.3583 9.38244C11.3857 9.787 9.44177 10.6243 6.52657 11.8944C6.05318 12.0827 5.8052 12.2669 5.78263 12.4469C5.74448 12.7513 6.12559 12.8711 6.64455 13.0343C6.71515 13.0565 6.78829 13.0795 6.86327 13.1038C7.37385 13.2698 8.06068 13.464 8.41773 13.4717C8.74161 13.4787 9.1031 13.3452 9.50219 13.0711C12.226 11.2325 13.632 10.3032 13.7202 10.2831C13.7825 10.269 13.8688 10.2512 13.9273 10.3032C13.9858 10.3032 13.98 10.4536 13.9738 10.48C13.9361 10.641 12.4401 12.0318 11.6659 12.7515C11.4246 12.9759 11.2534 13.135 11.2184 13.1714C11.14 13.2528 11.0601 13.3298 10.9833 13.4038C10.509 13.8611 10.1532 14.204 11.003 14.764C11.4114 15.0331 11.7381 15.2556 12.0641 15.4776C12.4201 15.7201 12.7752 15.9619 13.2347 16.2631C13.3517 16.3398 13.4635 16.4195 13.5724 16.4971C13.9867 16.7925 14.3589 17.0579 14.8188 17.0155C15.086 16.991 15.362 16.7397 15.5022 15.9903C15.8335 14.2193 16.4847 10.382 16.6352 8.80081C16.6484 8.66228 16.6318 8.48498 16.6185 8.40715C16.6051 8.32932 16.5773 8.21842 16.4761 8.13633C16.3563 8.03911 16.1714 8.01861 16.0886 8.02C15.7125 8.0267 15.1354 8.22735 12.3583 9.38244Z" />
  </svg>
);

// Small icon for conversation list rows
function ChannelIcon({ channel }: { channel?: string }) {
  const ch = (channel || 'telegram').toLowerCase();
  if (ch === 'whatsapp') {
    return <WhatsAppLogo className="w-4 h-4 shrink-0" />;
  }
  return <TelegramLogo className="w-4 h-4 shrink-0" />;
}

// Badge for chat header and details panel
function ChannelBadge({ channel }: { channel?: string }) {
  const ch = (channel || 'telegram').toLowerCase();
  if (ch === 'whatsapp') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#1B5E20] border border-[#A5D6A7]/50">
        <WhatsAppLogo className="w-3 h-3 shrink-0" />
        WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E3F2FD] text-[#0D47A1] border border-[#90CAF9]/50">
      <TelegramLogo className="w-3 h-3 shrink-0" />
      Telegram
    </span>
  );
}



// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const { workspaceId } = useWorkspace();
  const [conversations, setConversations] = useState<GroupedConversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Existing filter state — logic unchanged
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'telegram'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // New UI-only states
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Notes syncing states and handlers ──────────────────────────────────
  const [noteText, setNoteText] = useState('');
  const [dbNoteText, setDbNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!db || !workspaceId || !selectedChatId) {
      setNoteText('');
      setDbNoteText('');
      return;
    }
    const docRef = doc(db, 'workspaces', workspaceId, 'conversation_notes', selectedChatId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNoteText(data.notes || '');
        setDbNoteText(data.notes || '');
      } else {
        setNoteText('');
        setDbNoteText('');
      }
    }, (err) => {
      console.error("Error loading note:", err);
    });
    return () => unsubscribe();
  }, [workspaceId, selectedChatId]);

  const handleSaveNote = async () => {
    if (!db || !workspaceId || !selectedChatId) return;
    setSavingNote(true);
    try {
      const docRef = doc(db, 'workspaces', workspaceId, 'conversation_notes', selectedChatId);
      await setDoc(docRef, {
        notes: noteText,
        updatedAt: new Date()
      }, { merge: true });
      setDbNoteText(noteText);
    } catch (e) {
      console.error("Error saving note:", e);
      throw e;
    } finally {
      setSavingNote(false);
    }
  };

  // ── Firebase subscription (unchanged) ───────────────────────────────────
  useEffect(() => {
    if (!db || !workspaceId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'workspaces', workspaceId, 'conversations'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const grouped: { [key: string]: ConversationDoc[] } = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          const key = data.chatId || doc.id;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({ id: doc.id, ...data } as ConversationDoc);
        });

        const list: GroupedConversation[] = Object.keys(grouped).map((chatId) => {
          const msgs = grouped[chatId];
          const sortedMsgs = [...msgs].sort((a, b) => {
            const tA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
            const tB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
            return tA - tB;
          });
          const latestMsgDoc = msgs[0];
          return {
            chatId,
            customer: latestMsgDoc.customer,
            channel: latestMsgDoc.channel,
            latestTimestamp: latestMsgDoc.timestamp,
            latestMessagePreview: latestMsgDoc.userMessage || latestMsgDoc.botReply || '',
            messages: sortedMsgs,
          };
        });

        list.sort((a, b) => {
          const tA = a.latestTimestamp?.toDate ? a.latestTimestamp.toDate().getTime() : new Date(a.latestTimestamp).getTime();
          const tB = b.latestTimestamp?.toDate ? b.latestTimestamp.toDate().getTime() : new Date(b.latestTimestamp).getTime();
          return tB - tA;
        });

        setConversations(list);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [workspaceId]);

  // ── Scroll to bottom on conversation select ──────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChatId]);

  // ── Filtering (existing channel + time logic preserved) ──────────────────
  const filteredConversations = conversations.filter((conv) => {
    // channel filter
    if (channelFilter !== 'all') {
      const ch = (conv.channel || 'telegram').toLowerCase();
      if (ch !== channelFilter) return false;
    }
    // time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      const msgDate = toDate(conv.latestTimestamp);
      const diffDays = (now.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24);
      if (timeFilter === 'today') {
        const isToday =
          msgDate.getDate() === now.getDate() &&
          msgDate.getMonth() === now.getMonth() &&
          msgDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (timeFilter === '7days' && diffDays > 7) return false;
      else if (timeFilter === '30days' && diffDays > 30) return false;
    }
    // search filter (new)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const displayName = formatDisplayName(conv.customer?.name, conv.chatId, conv.channel);
      const nameMatch = displayName.toLowerCase().includes(q);
      const msgMatch = (conv.latestMessagePreview || '').toLowerCase().includes(q);
      if (!nameMatch && !msgMatch) return false;
    }
    return true;
  });

  const activeSelected = conversations.find((c) => c.chatId === selectedChatId) || null;

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-148px)] bg-white border border-zinc-200 rounded-2xl">
        <LoadingSpinner size="lg" text="Loading conversations…" />
      </div>
    );
  }

  // ─── Layout ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-[#FFF8F0] min-h-full flex flex-col justify-start box-border">
      <div
        className="flex h-[calc(100vh-176px)] bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm w-full"
        style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
      >
      {/* ══════════════════════════════════════════════════════════════════
          LEFT PANEL — Conversation List
      ══════════════════════════════════════════════════════════════════ */}
      <div className={cn(
        "w-full md:w-[320px] shrink-0 md:border-r border-zinc-200 bg-white flex flex-col h-full",
        selectedChatId ? "hidden md:flex" : "flex"
      )}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-zinc-900">Conversations</h2>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#22577A]/10 text-[#22577A] text-[10px] font-bold">
              {filteredConversations.length}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-zinc-200 focus:outline-none focus:border-[#22577A]/50 focus:ring-1 focus:ring-[#22577A]/20 text-xs font-medium text-zinc-800 placeholder:text-zinc-400 bg-zinc-50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer p-0"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2.5 border-b border-zinc-100 shrink-0 space-y-2">
          {/* Channel segmented control */}
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 gap-0.5">
            {(['all', 'whatsapp', 'telegram'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border-none ${
                  channelFilter === ch
                    ? 'bg-white text-[#22577A] shadow-sm font-bold'
                    : 'text-zinc-500 bg-transparent hover:text-zinc-700'
                }`}
              >
                {ch === 'all' ? 'All' : ch === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
              </button>
            ))}
          </div>

          {/* Time filter + Unread toggle row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 gap-0.5 flex-1">
              {(['today', '7days', '30days', 'all'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer border-none ${
                    timeFilter === t
                      ? 'bg-white text-[#22577A] shadow-sm font-bold'
                      : 'text-zinc-500 bg-transparent hover:text-zinc-700'
                  }`}
                >
                  {t === 'today' ? 'Today' : t === '7days' ? '7d' : t === '30days' ? '30d' : 'All'}
                </button>
              ))}
            </div>
            {/* Unread toggle */}
            <button
              onClick={() => setShowUnreadOnly((v) => !v)}
              title={showUnreadOnly ? 'Show all' : 'Unread only'}
              className={`h-7 px-2.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer shrink-0 ${
                showUnreadOnly
                  ? 'bg-[#22577A] border-[#22577A] text-white'
                  : 'bg-white border-zinc-200 text-zinc-500 hover:border-[#22577A]/40 hover:text-[#22577A]'
              }`}
            >
              Unread
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e4e4e7 transparent' }}>
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mb-3">
                <MessageSquare size={20} className="text-zinc-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-600">No conversations found</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Try adjusting your filters or search query.
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedChatId === conv.chatId;
              const lastMsg = conv.latestMessagePreview || '';
              const preview = lastMsg.length > 60 ? lastMsg.slice(0, 60) + '…' : lastMsg;
              const displayName = formatDisplayName(conv.customer?.name, conv.chatId, conv.channel);
              const initials = getInitials(displayName);
              const avatarColor = getAvatarColor(displayName);

              return (
                <div
                  key={conv.chatId}
                  onClick={() => setSelectedChatId(conv.chatId)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-100 border-l-2 ${
                    isSelected
                      ? 'bg-[#EBF4FF] border-[#22577A]'
                      : 'bg-white border-transparent hover:bg-zinc-50 hover:border-zinc-200'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor}`}
                  >
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-zinc-900 truncate">
                        {displayName}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium shrink-0">
                        {formatTimestamp(conv.latestTimestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ChannelIcon channel={conv.channel} />
                      <p className="text-[11px] text-zinc-500 truncate flex-1 leading-snug">
                        {preview || 'No message content'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RIGHT AREA — Chat Panel + Details Sidebar
      ══════════════════════════════════════════════════════════════════ */}
      <div className={cn("flex-1 flex min-w-0 bg-[#F8FAFC] overflow-hidden", !selectedChatId ? "hidden md:flex" : "flex")}>

        {/* ── Chat Panel ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

          {activeSelected ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Chat Header */}
              <div className="h-14 px-4 bg-white border-b border-zinc-200 flex items-center gap-3 shrink-0">
                {/* Back button for mobile */}
                <button
                  onClick={() => setSelectedChatId(null)}
                  className="md:hidden p-1.5 -ml-1.5 mr-0.5 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors border-none bg-transparent cursor-pointer"
                >
                  <ChevronLeft size={18} />
                </button>
                {/* Avatar */}
                {(() => {
                  const headerDisplayName = formatDisplayName(activeSelected.customer?.name, activeSelected.chatId, activeSelected.channel);
                  return (
                    <>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(headerDisplayName)}`}
                      >
                        {getInitials(headerDisplayName)}
                      </div>

                      {/* Name + channel badge */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900 truncate">
                            {headerDisplayName}
                          </span>
                          <ChannelBadge channel={activeSelected.channel} />
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Info toggle */}
                <button
                  onClick={() => setDetailsOpen((v) => !v)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border-none ${
                    detailsOpen ? 'bg-[#EBF4FF] text-[#22577A]' : 'bg-transparent text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                  }`}
                  title="Customer info"
                >
                  <Info size={14} />
                </button>
              </div>

              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#e4e4e7 transparent' }}
              >
                {(() => {
                  const msgs = activeSelected.messages;
                  const elements: React.ReactNode[] = [];
                  let lastDateKey = '';

                  msgs.forEach((msg) => {
                    const dateKey = getDateKey(msg.timestamp);

                    // Date separator
                    if (dateKey !== lastDateKey) {
                      lastDateKey = dateKey;
                      elements.push(
                        <div key={`sep-${dateKey}`} className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-zinc-200" />
                          <span className="text-[10px] font-semibold text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 whitespace-nowrap">
                            {formatDateSeparator(msg.timestamp)}
                          </span>
                          <div className="flex-1 h-px bg-zinc-200" />
                        </div>
                      );
                    }

                    // Customer message bubble — LEFT, white card
                    if (msg.userMessage) {
                      elements.push(
                        <div key={`user-${msg.id}`} className="flex flex-col items-start gap-1 mb-4">
                          <span className="text-[10px] font-semibold text-zinc-400 ml-8">Customer</span>
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 mt-0.5 border border-zinc-300">
                              <span className="text-[9px] font-bold text-zinc-500">C</span>
                            </div>
                            <div className="max-w-[68%]">
                              <div className="bg-white text-zinc-800 px-3.5 py-2.5 rounded-2xl rounded-tl-sm border border-zinc-200 shadow-sm text-xs leading-relaxed whitespace-pre-wrap font-medium break-words">
                                {msg.userMessage}
                              </div>
                              {msg.timestamp && (
                                <span className="text-[10px] text-zinc-400 ml-1 mt-0.5 block">{formatBubbleTime(msg.timestamp)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // AI Agent reply bubble — RIGHT, blue
                    if (msg.botReply) {
                      elements.push(
                        <div key={`bot-${msg.id}`} className="flex flex-col items-end gap-1 mb-4">
                          <div className="flex items-center gap-1.5 mr-8">
                            <span className="text-[10px] font-semibold text-zinc-400">AI Agent</span>
                          </div>
                          <div className="flex items-end gap-2 flex-row-reverse">
                            <div className="w-6 h-6 rounded-full bg-[#22577A] flex items-center justify-center shrink-0 mb-0.5 border border-[#22577A]/30">
                              <Bot size={12} className="text-white" />
                            </div>
                            <div className="max-w-[68%]">
                              <div className="bg-[#22577A] text-white px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm text-xs leading-relaxed whitespace-pre-wrap font-medium break-words">
                                {msg.botReply}
                              </div>
                              {msg.timestamp && (
                                <div className="flex items-center justify-end gap-1.5 mt-1 mr-1">
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#EBF4FF] text-[#22577A] text-[9px] font-bold border border-[#22577A]/10">
                                    <Bot size={8} />
                                    AI
                                  </span>
                                  <span className="text-[10px] text-zinc-400">{formatBubbleTime(msg.timestamp)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                  });

                  return elements;
                })()}
                <div ref={messagesEndRef} />
              </div>

              {/* Read-only footer */}
              <div className="shrink-0 bg-zinc-50 border-t border-zinc-200 px-4 py-3 flex items-center justify-center gap-2">
                <Bot size={13} className="text-zinc-400 shrink-0" />
                <span className="text-[11px] text-zinc-500 font-medium">
                  Read-only conversation history
                  <span className="mx-1.5 text-zinc-300">·</span>
                  Messages are handled by your AI agent
                </span>
              </div>
            </div>
          ) : (
            /* ── Empty State ─────────────────────────────────────────── */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-3xl bg-[#22577A]/8 flex items-center justify-center border border-[#22577A]/10 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[#22577A]/12 flex items-center justify-center border border-[#22577A]/15">
                  <MessageSquare size={28} className="text-[#22577A]" />
                </div>
              </div>

              <h3 className="text-base font-bold text-zinc-800 mb-1.5">Select a conversation</h3>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-[280px] mb-6">
                Choose a conversation from the inbox to view messages between customers and your AI agent.
              </p>

              {/* Quick action cards */}
              <div className="flex gap-3 flex-wrap justify-center">
                {[
                  { icon: Search, label: 'Search Conversations', desc: 'Find by name or keyword', href: undefined },
                  { icon: BellOff, label: 'Filter Unread', desc: 'Show unread threads', href: undefined },
                  { icon: BarChart2, label: 'Open Analytics', desc: 'See conversation metrics', href: '/dashboard/analytics' },
                ].map(({ icon: Icon, label, desc, href }) => (
                  <a
                    key={label}
                    href={href}
                    className="flex flex-col items-center gap-1.5 w-[130px] p-3 rounded-xl bg-white border border-zinc-200 hover:border-[#22577A]/30 hover:shadow-sm transition-all cursor-pointer no-underline"
                    onClick={!href ? (e) => {
                      e.preventDefault();
                      if (label === 'Search Conversations') {
                        document.querySelector<HTMLInputElement>('input[placeholder="Search conversations…"]')?.focus();
                      } else if (label === 'Filter Unread') {
                        setShowUnreadOnly(true);
                      }
                    } : undefined}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#22577A]/8 flex items-center justify-center border border-[#22577A]/10">
                      <Icon size={15} className="text-[#22577A]" />
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-700 leading-tight text-center">{label}</span>
                    <span className="text-[10px] text-zinc-400 leading-tight text-center">{desc}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Customer Details Sidebar ────────────────────────────────── */}
        {activeSelected && (
          <div
            className={cn(
              "shrink-0 border-l border-zinc-200 bg-white flex flex-col h-full transition-all duration-200 overflow-hidden",
              detailsOpen ? "w-full md:w-[240px]" : "w-0 lg:w-9"
            )}
          >
            {/* Toggle button — sticky at top */}
            <button
              onClick={() => setDetailsOpen((v) => !v)}
              className="h-14 shrink-0 flex items-center justify-center border-b border-zinc-100 hover:bg-zinc-50 transition-all cursor-pointer border-none bg-transparent w-full"
              title={detailsOpen ? 'Collapse details' : 'Expand details'}
            >
              {detailsOpen ? (
                <ChevronRight size={15} className="text-zinc-400" />
              ) : (
                <ChevronLeft size={15} className="text-zinc-400" />
              )}
            </button>

            {detailsOpen && (
              <div
                className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-4 space-y-4"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#e4e4e7 transparent' }}
              >
                {/* Customer Avatar + Name */}
                {(() => {
                  const detailsDisplayName = formatDisplayName(activeSelected.customer?.name, activeSelected.chatId, activeSelected.channel);
                  return (
                    <div className="flex flex-col items-center text-center pt-1 pb-2">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${getAvatarColor(detailsDisplayName)}`}
                      >
                        {getInitials(detailsDisplayName)}
                      </div>
                      <span className="text-xs font-bold text-zinc-900 leading-snug">
                        {detailsDisplayName}
                      </span>
                    </div>
                  );
                })()}

                <div className="h-px bg-zinc-100" />

                {/* Details fields */}
                <div className="space-y-3">
                  <DetailRow label="Channel">
                    <ChannelBadge channel={activeSelected.channel} />
                  </DetailRow>

                  <DetailRow label="Status">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Open
                    </span>
                  </DetailRow>

                  <DetailRow label="Handled by">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF4FF] text-[#22577A] border border-[#22577A]/20">
                      <Bot size={9} />
                      AI Agent
                    </span>
                  </DetailRow>

                  <DetailRow label="Messages">
                    <span className="text-[11px] font-semibold text-zinc-700">
                      {activeSelected.messages.length}
                    </span>
                  </DetailRow>

                  <DetailRow label="Last active">
                    <span className="text-[11px] font-semibold text-zinc-700">
                      {formatTimestamp(activeSelected.latestTimestamp)}
                    </span>
                  </DetailRow>
                </div>

                <div className="h-px bg-zinc-100" />

                {/* Tags placeholder */}
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <Tag size={11} className="text-zinc-400" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-semibold border border-zinc-200">
                      {(activeSelected.channel || 'telegram').toLowerCase()}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-zinc-100" />

                {/* Notes */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">Notes</span>
                  <textarea
                    placeholder="Add a note about this conversation…"
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 text-[11px] text-zinc-700 placeholder:text-zinc-400 resize-none focus:outline-none focus:border-[#22577A]/40 focus:ring-1 focus:ring-[#22577A]/10 transition-all bg-zinc-50 font-medium"
                  />
                  <SaveButton
                    onClick={handleSaveNote}
                    isDirty={noteText.trim() !== dbNoteText.trim()}
                    label="Save Note"
                    successLabel="Saved Note"
                    successToastTitle="Note updated"
                    successToastDescription="The conversation notes have been saved."
                    className="w-full h-8 text-[11px] rounded-lg"
                  />
                </div>
                <div className="h-2 shrink-0" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);
}

// ─── Small helper component ───────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide shrink-0 mt-0.5">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
