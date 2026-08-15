'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Trash2,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

const QUICK_PROMPTS = [
  { label: '⚡ agent epdi create panradhu?', text: 'agent epdi create panradhu?' },
  { label: '⚡ bhai agent kaise publish karu?', text: 'bhai agent kaise publish karu?' },
  { label: '⚡ How do I add knowledge?', text: 'How do I add knowledge to my agent?' },
  { label: '⚡ API key enga add panradhu?', text: 'API key enga add panradhu?' },
  { label: '⚡ How to connect Telegram/WhatsApp?', text: 'How do I connect Telegram or WhatsApp channels?' }
];

const BOT_SIZE = 52; // Bot launcher dimensions (48px button + 4px margin)
const WHATSAPP_SUPPORT_URL = 'https://api.whatsapp.com/send/?phone=916374385901&text=Hi+Dudo+support%2C+I+need+help+with&type=phone_number&app_absent=0';

export default function DudoSupportAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Single source of truth for free-floating viewport coordinates (position: fixed; left, top)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  
  const botRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { currentUser } = useAuth();
  const { workspaceId } = useWorkspace();

  // Load launcher position from localStorage or default to bottom-right
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getInitialPosition = () => {
      const saved = localStorage.getItem('dudo-support-bot-position');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const maxX = window.innerWidth - BOT_SIZE - 12;
            const maxY = window.innerHeight - BOT_SIZE - 12;
            // Ignore top-left header overlapping coordinates (< 80px top/left)
            if (parsed.y >= 80 && parsed.x >= 80) {
              return {
                x: Math.max(12, Math.min(maxX, parsed.x)),
                y: Math.max(12, Math.min(maxY, parsed.y))
              };
            }
          }
        } catch {}
      }
      // Default: bottom-right corner
      return {
        x: Math.max(12, window.innerWidth - BOT_SIZE - 20),
        y: Math.max(12, window.innerHeight - BOT_SIZE - 20)
      };
    };

    setPosition(getInitialPosition());

    // Clamp position on window resize so bot stays 100% visible
    const handleResize = () => {
      setPosition(prev => {
        if (!prev) return null;
        const maxX = window.innerWidth - BOT_SIZE - 12;
        const maxY = window.innerHeight - BOT_SIZE - 12;
        return {
          x: Math.max(12, Math.min(maxX, prev.x)),
          y: Math.max(12, Math.min(maxY, prev.y))
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Unified navigation & external link dispatcher
  const executeNavigation = (targetPath: string) => {
    if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      window.open(targetPath, '_blank');
    } else if (targetPath.startsWith('mailto:')) {
      window.location.href = targetPath;
    } else if (targetPath === 'dudo-bug-modal' || targetPath === '/dashboard/report-bug') {
      // Directly trigger bug modal popup without navigating away (prevents 404)
      window.dispatchEvent(new CustomEvent('dudo-open-bug-modal'));
    } else {
      router.push(targetPath);
    }
  };

  // Pointer drag event handlers (desktop mouse + mobile touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!botRef.current || !position) return;

    // Capture pointer so move/up events track smoothly anywhere on screen
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = botRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    startPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !position) return;

    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 6) {
      hasMovedRef.current = true;
    }

    if (hasMovedRef.current) {
      const newRawX = e.clientX - dragOffsetRef.current.x;
      const newRawY = e.clientY - dragOffsetRef.current.y;

      const maxX = window.innerWidth - BOT_SIZE - 12;
      const maxY = window.innerHeight - BOT_SIZE - 12;

      const clampedX = Math.max(12, Math.min(maxX, newRawX));
      const clampedY = Math.max(12, Math.min(maxY, newRawY));

      setPosition({ x: clampedX, y: clampedY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    setIsDragging(false);

    if (hasMovedRef.current && position) {
      // User dragged the bot — persist final coordinates to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('dudo-support-bot-position', JSON.stringify(position));
      }
    } else {
      // User clicked/tapped without dragging — toggle chat panel
      setIsOpen(prev => !prev);
    }
  };

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
        timestamp: Date.now()
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

  // Render assistant formatted content with clean inline buttons for real routes
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');

    const actionButtons: Array<{ label: string; route: string }> = [];

    const addAction = (label: string, route: string) => {
      if (!actionButtons.some(a => a.route === route)) {
        actionButtons.push({ label, route });
      }
    };

    const lower = content.toLowerCase();
    if (lower.includes('talk to dudo') || lower.includes('business ai') || lower.includes('whatsapp bot')) {
      addAction('Talk to Dudo →', WHATSAPP_SUPPORT_URL);
    }
    if (lower.includes('contact support') || lower.includes('report bug') || lower.includes('bug') || lower.includes('contact / report')) {
      addAction('Contact Support →', 'dudo-bug-modal');
    }
    if (lower.includes('help center') || lower.includes('documentation') || lower.includes('docs')) {
      addAction('Help Center →', '/dashboard/documentation');
    }
    if (lower.includes('knowledge')) {
      addAction('Knowledge Base →', '/dashboard/knowledge');
    }
    if (lower.includes('billing') || lower.includes('plan') || lower.includes('price')) {
      addAction('Billing →', '/dashboard/billing');
    }
    if (lower.includes('channel') || lower.includes('telegram') || lower.includes('whatsapp')) {
      addAction('Channels Setup →', '/dashboard/agent?tab=channels');
    }
    if (lower.includes('api key') || lower.includes('groq') || lower.includes('openai')) {
      addAction('API Keys →', '/dashboard/agent?tab=api-keys');
    }
    if (lower.includes('personality') || lower.includes('system prompt')) {
      addAction('Personality →', '/dashboard/agent?tab=personality');
    }
    if (lower.includes('testing') || lower.includes('playground')) {
      addAction('Agent Playground →', '/dashboard/agent?tab=testing');
    }
    if (lower.includes('dudosupport@gmail.com') || lower.includes('email us')) {
      addAction('Email Support ✉', 'mailto:dudosupport@gmail.com');
    }

    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
          const isNum = /^\d+\.\s/.test(line.trim());
          const cleanLine = isBullet ? line.trim().substring(2) : isNum ? line.trim().replace(/^\d+\.\s/, '') : line;

          const parts = parseInlineMarkdown(cleanLine);

          return (
            <div key={idx} className={cn("flex items-start gap-1.5", isBullet && "ml-2", isNum && "ml-2")}>
              {isBullet && <span className="text-[#22577A] font-bold select-none">•</span>}
              {isNum && <span className="text-[#22577A] font-mono text-[10px] font-bold select-none">{line.trim().match(/^\d+/)?.[0]}.</span>}
              <div className="flex-1 flex-wrap">
                {parts.map((p, pIdx) => {
                  if (p.type === 'bold') {
                    const navPath = getNavigationPath(p.text);
                    if (navPath) {
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => executeNavigation(navPath)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 my-0.5 mx-0.5 bg-[#22577A]/10 hover:bg-[#22577A]/20 text-[#22577A] font-bold rounded text-[10px] cursor-pointer transition-all border border-[#22577A]/20 leading-none align-baseline"
                          title={`Go to ${p.text}`}
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

        {/* Action Buttons row if relevant navigation matches */}
        {actionButtons.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-1.5 border-t border-zinc-100 mt-2">
            {actionButtons.slice(0, 3).map((act, aIdx) => (
              <button
                key={aIdx}
                type="button"
                onClick={() => executeNavigation(act.route)}
                className="h-6 px-2.5 bg-[#22577A] hover:bg-[#1A4461] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all shadow-2xs flex items-center gap-1 leading-none"
              >
                <span>{act.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Dynamically position chat modal near bot launcher while respecting sidebar boundary on desktop
  const getModalPositionStyles = () => {
    if (typeof window === 'undefined') return {};

    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      return {
        bottom: '16px',
        left: '16px',
        right: '16px',
        width: 'calc(100vw - 32px)',
        height: '490px',
        maxHeight: '80vh',
        zIndex: 35
      };
    }

    const MIN_LEFT = 72; // Desktop sidebar width is 60px (collapsed) — keep clear of sidebar!
    const modalWidth = 380;
    const modalHeight = 510;

    if (!position) {
      return {
        bottom: '80px',
        right: '20px',
        width: `${modalWidth}px`,
        height: `${modalHeight}px`,
        zIndex: 35
      };
    }

    let left = position.x > window.innerWidth / 2
      ? position.x - modalWidth + 48
      : position.x;

    let top = position.y > window.innerHeight / 2
      ? position.y - modalHeight - 12
      : position.y + 56 + 12;

    // Clamp inside screen bounds respecting sidebar minimum left (72px)
    left = Math.max(MIN_LEFT, Math.min(window.innerWidth - modalWidth - 16, left));
    top = Math.max(16, Math.min(window.innerHeight - modalHeight - 16, top));

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${modalWidth}px`,
      height: `${modalHeight}px`,
      zIndex: 35
    };
  };

  return (
    <>
      {/* ── True Free-Position Floating Draggable Bot Launcher (z-30 < Sidebar z-50) ── */}
      {position && (
        <div
          ref={botRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 30,
            touchAction: 'none'
          }}
          className="select-none flex items-center gap-2 cursor-grab active:cursor-grabbing"
        >
          <button
            type="button"
            className={cn(
              "w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all border-none relative text-white",
              isOpen ? "bg-zinc-800 hover:bg-zinc-900" : "bg-[#22577A] hover:bg-[#1A4461]"
            )}
            title="Dudo AI Support Assistant (Drag anywhere)"
          >
            {isOpen ? (
              <X size={20} />
            ) : (
              <>
                <Bot size={22} />
                <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white animate-pulse" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Chat Modal Panel (z-35 < Sidebar z-50) ────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={getModalPositionStyles()}
            className="fixed bg-white border border-zinc-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left"
          >
            {/* Header */}
            <div className="bg-[#22577A] text-white p-3 px-4 flex items-center justify-between shrink-0 select-none shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
                  <Bot size={18} className="text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold tracking-tight truncate leading-none">Dudo Support Assistant</h3>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  </div>
                  <p className="text-[10px] text-white/80 font-medium mt-0.5 truncate">
                    Ask anything about Dudo AI
                  </p>
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
                      Vanakkam! How can I help you with Dudo today?
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
                  </div>
                ))
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="mr-auto items-start max-w-[88%] flex items-center gap-2 p-3 bg-white border border-zinc-200 rounded-2xl rounded-bl-xs text-xs text-zinc-500 font-semibold shadow-2xs">
                  <RefreshCw size={13} className="animate-spin text-[#22577A] shrink-0" />
                  <span>Thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Clean Input Bar */}
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

  if (normalized.includes('talk to dudo')) {
    return WHATSAPP_SUPPORT_URL;
  }
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
  if (normalized.includes('billing') || normalized === 'plans' || normalized === 'pricing') {
    return '/dashboard/billing';
  }
  if (normalized.includes('help center') || normalized === 'documentation') {
    return '/dashboard/documentation';
  }
  if (normalized.includes('contact support') || normalized === 'contact' || normalized === 'report bug' || normalized.includes('report a bug') || normalized === 'bug') {
    return 'dudo-bug-modal';
  }

  return null;
}
