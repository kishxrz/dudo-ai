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
  ArrowRight,
  HelpCircle,
  Mail,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

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

export default function DudoSupportAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Draggable position state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const launcherRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { currentUser } = useAuth();
  const { workspaceId } = useWorkspace();

  // Load launcher position from localStorage or default to bottom-right
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dudo_assistant_position');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const clampedX = Math.max(12, Math.min(window.innerWidth - 68, parsed.x));
            const clampedY = Math.max(12, Math.min(window.innerHeight - 68, parsed.y));
            setPosition({ x: clampedX, y: clampedY });
            return;
          }
        } catch {}
      }
      // Default: bottom-right
      setPosition({
        x: Math.max(12, window.innerWidth - 72),
        y: Math.max(12, window.innerHeight - 72)
      });
    }
  }, []);

  // Clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        if (!prev) return null;
        return {
          x: Math.max(12, Math.min(window.innerWidth - 68, prev.x)),
          y: Math.max(12, Math.min(window.innerHeight - 68, prev.y))
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

  // Helper to render text formatted with basic markdown and interactive action buttons
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');

    // Collect navigation buttons for this response
    const actionButtons: Array<{ label: string; route: string; isMailto?: boolean }> = [];

    // Helper to add unique action button
    const addAction = (label: string, route: string, isMailto = false) => {
      if (!actionButtons.some(a => a.route === route)) {
        actionButtons.push({ label, route, isMailto });
      }
    };

    // Scan content for action triggers
    const lower = content.toLowerCase();
    if (lower.includes('knowledge')) addAction('Knowledge Base →', '/dashboard/knowledge');
    if (lower.includes('billing') || lower.includes('plan') || lower.includes('price')) addAction('Billing →', '/dashboard/billing');
    if (lower.includes('channel') || lower.includes('telegram') || lower.includes('whatsapp')) addAction('Channels Setup →', '/dashboard/agent?tab=channels');
    if (lower.includes('api key') || lower.includes('groq') || lower.includes('openai')) addAction('API Keys →', '/dashboard/agent?tab=api-keys');
    if (lower.includes('personality') || lower.includes('system prompt') || lower.includes('instructions')) addAction('Personality →', '/dashboard/agent?tab=personality');
    if (lower.includes('testing') || lower.includes('playground')) addAction('Agent Playground →', '/dashboard/agent?tab=testing');
    if (lower.includes('skill')) addAction('Agent Skills →', '/dashboard/agent?tab=skills');
    if (lower.includes('help center') || lower.includes('documentation') || lower.includes('docs')) addAction('Help Center →', '/dashboard/documentation');
    if (lower.includes('contact support') || lower.includes('report bug') || lower.includes('bug')) addAction('Contact Support →', '/dashboard/report-bug');
    if (lower.includes('dudosupport@gmail.com') || lower.includes('email us')) addAction('Email Support ✉', 'mailto:dudosupport@gmail.com', true);

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
                          onClick={() => {
                            if (navPath.startsWith('mailto:')) {
                              window.location.href = navPath;
                            } else {
                              router.push(navPath);
                            }
                          }}
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
                onClick={() => {
                  if (act.isMailto) {
                    window.location.href = act.route;
                  } else {
                    router.push(act.route);
                  }
                }}
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

  // Determine chat modal position relative to launcher or viewport
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
        maxHeight: '80vh'
      };
    }

    if (!position) {
      return {
        bottom: '80px',
        right: '20px',
        width: '380px',
        height: '510px'
      };
    }

    // Place modal above launcher or to the left if near top/bottom
    const modalWidth = 380;
    const modalHeight = 510;

    let left = position.x - modalWidth + 50;
    let top = position.y - modalHeight - 12;

    // Clamp inside screen bounds
    if (left < 16) left = 16;
    if (left + modalWidth > window.innerWidth - 16) left = window.innerWidth - modalWidth - 16;

    if (top < 16) {
      // Show below launcher if top overflows
      top = position.y + 60;
    }
    if (top + modalHeight > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - modalHeight - 16);
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${modalWidth}px`,
      height: `${modalHeight}px`
    };
  };

  return (
    <>
      {/* ── Floating Draggable Launcher Button ───────────────────────────── */}
      <motion.div
        ref={launcherRef}
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{
          left: 12,
          top: 12,
          right: (typeof window !== 'undefined' ? window.innerWidth : 1000) - 68,
          bottom: (typeof window !== 'undefined' ? window.innerHeight : 800) - 68
        }}
        onPointerDown={(e) => {
          pointerStartRef.current = { x: e.clientX, y: e.clientY };
        }}
        onDragStart={() => {
          setIsDragging(true);
        }}
        onDragEnd={() => {
          setTimeout(() => setIsDragging(false), 50);
          if (launcherRef.current) {
            const rect = launcherRef.current.getBoundingClientRect();
            const newPos = { x: rect.left, y: rect.top };
            setPosition(newPos);
            if (typeof window !== 'undefined') {
              localStorage.setItem('dudo_assistant_position', JSON.stringify(newPos));
            }
          }
        }}
        style={{
          position: 'fixed',
          left: position ? `${position.x}px` : undefined,
          top: position ? `${position.y}px` : undefined,
          right: !position ? '20px' : undefined,
          bottom: !position ? '20px' : undefined,
          zIndex: 9990,
          touchAction: 'none'
        }}
        className="select-none flex items-center gap-2"
      >
        <motion.button
          type="button"
          onClick={(e) => {
            if (isDragging) return;
            setIsOpen(prev => !prev);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "w-12 h-12 rounded-full shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors border-none relative text-white",
            isOpen ? "bg-zinc-800 hover:bg-zinc-900" : "bg-[#22577A] hover:bg-[#1A4461]"
          )}
          title="Dudo AI Support Assistant (Drag to move)"
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
      </motion.div>

      {/* ── Chat Modal Panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={getModalPositionStyles()}
            className="fixed z-[9995] bg-white border border-zinc-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left"
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
  if (normalized.includes('contact support') || normalized === 'contact') {
    return '/dashboard/report-bug';
  }

  return null;
}
