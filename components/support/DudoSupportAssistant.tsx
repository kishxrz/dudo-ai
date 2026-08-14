'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Trash2,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  ChevronDown,
  Compass,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: Array<{ title: string; category: string }>;
  isError?: boolean;
}

const QUICK_PROMPTS = [
  { label: '⚡ agent epdi create panradhu?', text: 'agent epdi create panradhu?' },
  { label: '⚡ bhai agent kaise publish karu?', text: 'bhai agent kaise publish karu?' },
  { label: '⚡ How do I add knowledge?', text: 'How do I add knowledge to my agent?' },
  { label: '⚡ API key enga add panradhu?', text: 'API key enga add panradhu?' },
  { label: '⚡ How to connect Telegram/WhatsApp?', text: 'How do I connect Telegram or WhatsApp channels?' }
];

export default function DudoSupportAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { workspaceId } = useWorkspace();

  const currentTab = searchParams.get('tab');
  const fullRoute = currentTab ? `${pathname}?tab=${currentTab}` : pathname;

  // Format nice route label for header
  const getRouteLabel = (path: string, tab: string | null) => {
    if (path.includes('/agent')) {
      return `Agent / ${tab ? tab.charAt(0).toUpperCase() + tab.slice(1) : 'Overview'}`;
    }
    if (path.includes('/knowledge')) return 'Knowledge Base';
    if (path.includes('/billing')) return 'Billing & Plans';
    if (path.includes('/appointments')) return 'Appointments';
    if (path.includes('/profile')) return 'Profile';
    return 'Dashboard';
  };

  const routeLabel = getRouteLabel(pathname, currentTab);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  const handleSend = async (customText?: string) => {
    const messageText = (customText || input).trim();
    if (!messageText || isLoading) return;

    if (!customText) setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const idToken = currentUser ? await currentUser.getIdToken() : '';

      const res = await fetch('/api/assistant/support-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          message: messageText,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          route: fullRoute,
          workspaceId
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.message || 'Failed to get response');
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || "Sorry, I couldn't process your request.",
        timestamp: Date.now(),
        sources: data.sources
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      console.error('Support assistant error:', err);
      const errMsg = err instanceof Error ? err.message : 'Network error. Please try again.';
      
      const errorMsgObj: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry bro! ${errMsg}`,
        timestamp: Date.now(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsgObj]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  // Helper to render text formatted with basic markdown and interactive navigation links
  const renderFormattedContent = (content: string) => {
    // Split into paragraphs
    const lines = content.split('\n');

    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          // List item
          const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
          const isNum = /^\d+\.\s/.test(line.trim());
          const cleanLine = isBullet ? line.trim().substring(2) : isNum ? line.trim().replace(/^\d+\.\s/, '') : line;

          // Parse **bold** and `code`
          const parts = parseInlineMarkdown(cleanLine);

          return (
            <div key={idx} className={cn("flex items-start gap-1.5", isBullet && "ml-2", isNum && "ml-2")}>
              {isBullet && <span className="text-[#22577A] font-bold select-none">•</span>}
              {isNum && <span className="text-[#22577A] font-mono text-[10px] font-bold select-none">{line.trim().match(/^\d+/)?.[0]}.</span>}
              <div className="flex-1 flex-wrap">
                {parts.map((p, pIdx) => {
                  if (p.type === 'bold') {
                    // Check if bold text is a navigation path like "Agent → Skills" or "Knowledge"
                    const navPath = getNavigationPath(p.text);
                    if (navPath) {
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => router.push(navPath)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 my-0.5 mx-0.5 bg-[#22577A]/10 hover:bg-[#22577A]/20 text-[#22577A] font-bold rounded text-[10px] cursor-pointer transition-all border border-[#22577A]/20 leading-none align-baseline"
                          title={`Navigate to ${p.text}`}
                        >
                          <span>{p.text}</span>
                          <ArrowRight size={9} />
                        </button>
                      );
                    }
                    return <strong key={pIdx} className="font-bold text-zinc-900">{p.text}</strong>;
                  }
                  if (p.type === 'code') {
                    return <code key={pIdx} className="bg-zinc-100 text-[#22577A] font-mono text-[10px] px-1 py-0.5 rounded border border-zinc-200">{p.text}</code>;
                  }
                  return <span key={pIdx}>{p.text}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* ── Floating Launcher Button ────────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 select-none">
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.9 }}
              className="hidden sm:flex items-center gap-1.5 bg-white border border-[#EED9B4] text-[#22577A] text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md cursor-pointer hover:bg-[#FFF8F0] transition-all"
              onClick={() => setIsOpen(true)}
            >
              <Sparkles size={13} className="text-amber-500 animate-pulse" />
              <span>Ask Dudo AI</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all border-none relative text-white",
            isOpen ? "bg-zinc-800 hover:bg-zinc-900" : "bg-[#22577A] hover:bg-[#1A4461]"
          )}
          title="Dudo AI Support Assistant"
        >
          {isOpen ? (
            <X size={20} />
          ) : (
            <>
              <Bot size={22} />
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white animate-pulse" />
            </>
          )}
        </motion.button>
      </div>

      {/* ── Chat Modal Panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-20 right-4 sm:right-5 z-40 w-[calc(100vw-32px)] sm:w-[390px] h-[520px] max-h-[80vh] bg-white border border-zinc-200/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left"
          >
            {/* Header */}
            <div className="bg-[#22577A] text-white p-3.5 px-4 flex items-center justify-between shrink-0 select-none shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
                  <Bot size={18} className="text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold tracking-tight truncate leading-none">Dudo Support Assistant</h3>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-white/80 font-medium truncate">
                    <Compass size={10} className="shrink-0 text-amber-300" />
                    <span className="truncate">{routeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer border-none bg-transparent"
                    title="Clear Conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer border-none bg-transparent"
                  title="Close Assistant"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Conversation Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FFF8F0]/40">
              {messages.length === 0 ? (
                <div className="py-4 px-2 space-y-4 text-center select-none">
                  <div className="w-12 h-12 rounded-2xl bg-[#22577A]/10 border border-[#22577A]/20 flex items-center justify-center mx-auto text-[#22577A]">
                    <Sparkles size={22} className="text-[#22577A]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 leading-snug">
                      Hey there! How can I help you with Dudo today?
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-medium mt-1">
                      Ask in English, Tanglish, Hinglish, Tamil, Hindi, or any language!
                    </p>
                  </div>

                  {/* Quick Prompts */}
                  <div className="space-y-1.5 pt-2 text-left">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">Quick Questions</p>
                    <div className="flex flex-col gap-1.5">
                      {QUICK_PROMPTS.map((qp, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSend(qp.text)}
                          className="w-full text-left p-2 px-2.5 rounded-xl border border-zinc-200 bg-white hover:border-[#22577A]/40 hover:bg-[#FFF8F0] text-zinc-700 hover:text-[#22577A] text-[11px] font-semibold transition-all shadow-2xs cursor-pointer flex items-center justify-between group"
                        >
                          <span>{qp.label}</span>
                          <ArrowRight size={12} className="text-zinc-400 group-hover:text-[#22577A] shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[88%] text-xs",
                      msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "p-3 rounded-2xl shadow-2xs leading-relaxed",
                        msg.role === 'user'
                          ? "bg-[#22577A] text-white rounded-br-xs"
                          : msg.isError
                          ? "bg-red-50 border border-red-200 text-red-800 rounded-bl-xs"
                          : "bg-white border border-zinc-200/90 text-zinc-800 rounded-bl-xs"
                      )}
                    >
                      {msg.role === 'assistant' ? (
                        renderFormattedContent(msg.content)
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Sources Badge */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-400 font-medium px-1">
                        <span>📚 Docs:</span>
                        <span className="truncate max-w-[200px]">
                          {msg.sources.map(s => s.title).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="mr-auto items-start max-w-[88%] flex items-center gap-2 p-3 bg-white border border-zinc-200 rounded-2xl rounded-bl-xs text-xs text-zinc-500 font-semibold shadow-2xs">
                  <RefreshCw size={13} className="animate-spin text-[#22577A] shrink-0" />
                  <span>Searching Dudo docs &amp; thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-2.5 bg-white border-t border-zinc-200/80 shrink-0">
              <div className="flex items-center gap-2 bg-[#FFF8F0] border border-zinc-200 focus-within:border-[#22577A] focus-within:ring-1 focus-within:ring-[#22577A] rounded-xl p-1.5 transition-all">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about Dudo... (English, Tanglish, Hinglish)"
                  rows={1}
                  className="flex-1 bg-transparent text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none resize-none px-2 py-1 max-h-20"
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all shrink-0 cursor-pointer border-none",
                    input.trim() && !isLoading
                      ? "bg-[#22577A] hover:bg-[#1A4461] shadow-xs active:scale-95"
                      : "bg-zinc-300 cursor-not-allowed"
                  )}
                  title="Send message"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Markdown & Navigation Parsing Utilities ──────────────────────────────────

interface MarkdownToken {
  type: 'text' | 'bold' | 'code';
  text: string;
}

function parseInlineMarkdown(text: string): MarkdownToken[] {
  const tokens: MarkdownToken[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;

  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ type: 'text', text: text.substring(lastIdx, match.index) });
    }
    const tokenText = match[0];
    if (tokenText.startsWith('**') && tokenText.endsWith('**')) {
      tokens.push({ type: 'bold', text: tokenText.slice(2, -2) });
    } else if (tokenText.startsWith('`') && tokenText.endsWith('`')) {
      tokens.push({ type: 'code', text: tokenText.slice(1, -1) });
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    tokens.push({ type: 'text', text: text.substring(lastIdx) });
  }

  return tokens;
}

function getNavigationPath(boldText: string): string | null {
  const normalized = boldText.toLowerCase().trim();

  if (normalized.includes('agent → skills') || normalized === 'skills') {
    return '/dashboard/agent?tab=skills';
  }
  if (normalized.includes('agent → skill store') || normalized === 'skill store') {
    return '/dashboard/agent?tab=skill-store';
  }
  if (normalized.includes('agent → channels') || normalized === 'channels' || normalized === 'telegram' || normalized === 'whatsapp') {
    return '/dashboard/agent?tab=channels';
  }
  if (normalized.includes('agent → api keys') || normalized === 'api keys') {
    return '/dashboard/agent?tab=api-keys';
  }
  if (normalized.includes('agent → personality') || normalized === 'personality') {
    return '/dashboard/agent?tab=personality';
  }
  if (normalized.includes('agent → testing') || normalized === 'testing' || normalized === 'playground') {
    return '/dashboard/agent?tab=testing';
  }
  if (normalized.includes('knowledge') || normalized === 'knowledge base') {
    return '/dashboard/knowledge';
  }
  if (normalized.includes('appointments') || normalized === 'calendar') {
    return '/dashboard/appointments';
  }
  if (normalized.includes('billing') || normalized === 'plans') {
    return '/dashboard/billing';
  }

  return null;
}
