/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/purity, react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/layout/Sidebar';
import { Clock, Menu, LogOut, Wifi, WifiOff, RefreshCw, X, Zap, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { SubscriptionProvider, useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { LockedPage } from '@/components/subscription/FeatureGate';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/ui/logo';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ToastProvider } from '@/contexts/ToastContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ToastProvider>
          <DashboardBody>{children}</DashboardBody>
        </ToastProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

// ─── Indian Flag SVG Component (for Windows OS fallback) ───────────────────────
const IndianFlag = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 900 600" 
    className="w-4.5 h-3 shrink-0 rounded-[2px] shadow-xs border border-zinc-200/20"
  >
    <rect width="900" height="200" fill="#FF9933" />
    <rect y="200" width="900" height="200" fill="#FFFFFF" />
    <rect y="400" width="900" height="200" fill="#138808" />
    <g transform="translate(450, 300)">
      <circle r="92" fill="none" stroke="#000080" strokeWidth="10" />
      <circle r="16" fill="#000080" />
      {Array.from({ length: 24 }).map((_, i) => (
        <line
          key={i}
          y1="-92"
          y2="0"
          stroke="#000080"
          strokeWidth="6"
          transform={`rotate(${(i * 360) / 24})`}
        />
      ))}
    </g>
  </svg>
);

// ─── AI Status types ──────────────────────────────────────────────────────────
type AiStatus = 'online' | 'paused' | 'training' | 'offline' | 'unconfigured';

interface AiStatusConfig {
  label: string;
  dot: string;
  pulse: boolean;
  ring: string;
}

const AI_STATUS_MAP: Record<AiStatus, AiStatusConfig> = {
  online:       { label: 'Online',              dot: 'bg-emerald-500', pulse: true,  ring: 'border-emerald-300 text-emerald-700 bg-emerald-50/40' },
  paused:       { label: 'Paused',              dot: 'bg-amber-500',   pulse: false, ring: 'border-amber-300 text-amber-700 bg-amber-50/40'   },
  training:     { label: 'Training / Syncing',  dot: 'bg-blue-500',    pulse: true,  ring: 'border-blue-300 text-blue-700 bg-blue-50/40'    },
  offline:      { label: 'Offline',             dot: 'bg-red-500',     pulse: false, ring: 'border-red-300 text-red-700 bg-red-50/40'     },
  unconfigured: { label: 'Not Configured',      dot: 'bg-zinc-400',    pulse: false, ring: 'border-zinc-200 text-zinc-500 bg-zinc-50/30'    },
};

function DashboardBody({ children }: { children: React.ReactNode }) {
  const { currentUser: authUser, loading: authLoading, signOut } = useAuth();
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const [assistantName, setAssistantName] = useState("My AI Assistant");
  const [profileName, setProfileName] = useState("User");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // Channel connection state for the popover
  const [waConnected, setWaConnected] = useState(false);
  const [tgConnected, setTgConnected] = useState(false);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [lastSync, setLastSync] = useState<string>('—');
  const [aiStatus, setAiStatus] = useState<AiStatus>('unconfigured');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const { subscription, loading: subLoading, isExpired, isTrial, remainingText, canUse } = useSubscriptionContext();

  // Auto-rotate header banner slides every 5 seconds
  useEffect(() => {
    const hasMonthlyOrTrial = !subLoading && (!subscription || subscription.plan === 'trial' || subscription.plan === 'monthly');
    const slideCount = hasMonthlyOrTrial ? 3 : 2;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slideCount);
    }, 5000);
    return () => clearInterval(interval);
  }, [subLoading, subscription]);

  const pathname = usePathname();

  const getRequiredFeature = (path: string): string | null => {
    if (path.startsWith('/dashboard/knowledge')) return 'knowledge';
    if (path.startsWith('/dashboard/appointments')) return 'calendar';
    if (path.startsWith('/dashboard/integration')) return 'google';
    if (path.startsWith('/dashboard/analytics')) return 'google';
    if (path.startsWith('/dashboard/schedule')) return 'calendar';
    if (path.startsWith('/dashboard/logs')) return 'google';
    return null;
  };

  const requiredFeature = getRequiredFeature(pathname);
  const isFeatureAllowed = requiredFeature ? canUse(requiredFeature) : true;

  const currentUser = authUser;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  // Auto-redirect to billing if plan/trial is expired
  useEffect(() => {
    if (!subLoading && isExpired) {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        if (pathname !== '/dashboard/billing' && pathname !== '/dashboard/settings/billing') {
          router.replace('/dashboard/billing');
        }
      }
    }
  }, [subLoading, isExpired, router]);

  useEffect(() => {
    const loadProfileName = () => {
      let pName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
      if (typeof window !== 'undefined') {
        const localName = localStorage.getItem('__dudo_user_fullname');
        if (localName) pName = localName;
      }
      setProfileName(pName);
    };
    loadProfileName();
    window.addEventListener('dudo-profile-changed', loadProfileName);
    return () => {
      window.removeEventListener('dudo-profile-changed', loadProfileName);
    };
  }, [currentUser]);

  useEffect(() => {
    async function loadAssistant() {
      let name = "My AI Assistant";
      
      if (db && workspaceId) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            name = snap.data().name || name;
          }
        } catch (e) {}
      }

      if (typeof window !== 'undefined') {
        const localAss = localStorage.getItem('__dudo_dev_assistant');
        if (localAss) {
          try {
            const parsed = JSON.parse(localAss);
            name = parsed.name || name;
          } catch(e){}
        }
      }
      setAssistantName(name);
    }

    if (workspaceId) {
      loadAssistant();
    }
    
    window.addEventListener('dudo-config-changed', loadAssistant);
    return () => {
      window.removeEventListener('dudo-config-changed', loadAssistant);
    };
  }, [workspaceId]);

  // Load channel/knowledge/AI status for popover
  useEffect(() => {
    async function loadStatus() {
      if (typeof window === 'undefined') return;

      // WhatsApp
      try {
        const waRes = await fetch('/api/whatsapp/status');
        if (waRes.ok) {
          const d = await waRes.json();
          setWaConnected(d.status === 'connected');
        }
      } catch {}

      // Telegram
      setTgConnected(localStorage.getItem('__dudo_telegram_connected') === 'true');

      // Knowledge fallback
      const rawKb = localStorage.getItem('__dudo_dev_knowledge_items');
      if (rawKb) {
        try {
          const items = JSON.parse(rawKb);
          setKnowledgeCount(Array.isArray(items) ? items.length : 0);
        } catch {}
      }

      // Last sync
      const syncTs = localStorage.getItem('__dudo_last_sync');
      if (syncTs) {
        try {
          const d = new Date(parseInt(syncTs, 10));
          setLastSync(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch {}
      }

      // API key check
      const PROVIDERS = ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'deepseek', 'mistral'];
      let hasKey = false;
      for (const p of PROVIDERS) {
        const raw = localStorage.getItem(`__dudo_dev_provider_${p}`);
        if (raw) {
          try { if (JSON.parse(raw)?.apiKey) { hasKey = true; break; } } catch {}
        }
      }
      setHasApiKey(hasKey);
    }

    loadStatus();
    window.addEventListener('dudo-config-changed', loadStatus);
    return () => window.removeEventListener('dudo-config-changed', loadStatus);
  }, [workspaceId]);

  // Real-time Firestore subscription for Knowledge Base items count
  useEffect(() => {
    if (!db || !workspaceId) return;
    const collRef = collection(db, 'workspaces', workspaceId, 'knowledge');
    const unsubscribe = onSnapshot(collRef, (snap: any) => {
      const RESERVED_IDS = ['knowledge-base', 'business-profile'];
      let count = snap.docs.filter((d: any) => !RESERVED_IDS.includes(d.id)).length;
      const bizDoc = snap.docs.find((d: any) => d.id === 'business-profile');
      if (bizDoc && bizDoc.exists()) {
        const data = bizDoc.data();
        if (data.businessName || data.description || data.productsServices) {
          count += 1;
        }
      }
      setKnowledgeCount(count);
    }, (err: any) => {
      console.warn('Failed to listen to knowledge count:', err);
    });
    return unsubscribe;
  }, [workspaceId]);

  // Derive AI status from state
  useEffect(() => {
    const isLive = (waConnected || tgConnected) && hasApiKey;
    if (isLive) {
      setAiStatus('online');
    } else {
      setAiStatus('unconfigured');
    }
  }, [waConnected, tgConnected, hasApiKey]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusPopoverOpen(false);
      }
    };
    if (statusPopoverOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusPopoverOpen]);

  // Auto-disconnect connected channels when 30-minute free trial / plan expires
  // MUST be before any early returns to comply with React Rules of Hooks
  useEffect(() => {
    if (!subLoading && isExpired && workspaceId) {
      console.log('[Subscription] Plan/trial expired. Local development bypass: skipping auto-disconnect.');
      /*
      // Disconnect WhatsApp
      fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      }).catch(() => {});

      // Disconnect Telegram
      fetch('/api/telegram/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      }).catch(() => {});

      if (typeof window !== 'undefined') {
        localStorage.removeItem('__dudo_telegram_token');
        localStorage.setItem('__dudo_telegram_connected', 'false');
        window.dispatchEvent(new Event('dudo-status-changed'));
      }
      */
    }
  }, [subLoading, isExpired, workspaceId]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFF8F0] flex flex-col items-center justify-center p-4">
        <LoadingSpinner size="lg" text="Loading Dudo" />
      </div>
    );
  }

  if (!currentUser) return null;

  // ─── Banner slideshow generation ──────────────────────────────────────────
  const firstName = profileName.split(' ')[0];
  const planLabel = subLoading ? '…'
    : !subscription ? 'Free Trial'
    : subscription.planName;
  const timeLabel = subLoading ? '' : remainingText ? ` • ${remainingText}` : '';

  const showWelcomeUpgradeBtn = subLoading || !subscription || subscription.plan === 'trial' || isExpired;
  const welcomeUpgradeBtnText = subscription?.plan === 'trial' ? 'Upgrade ₹999' : 'Upgrade';

  const slides = [
    {
      type: 'welcome',
      content: `Welcome back, ${firstName}! Plan: ${planLabel}${timeLabel} — Let's build something amazing today!`,
      action: showWelcomeUpgradeBtn ? {
        text: welcomeUpgradeBtnText,
        onClick: () => router.push('/dashboard/billing')
      } : null
    }
  ];

  // Offer: only for trial and monthly users, not for six_month plan users
  const hasMonthlyOrTrial = !subLoading && (!subscription || subscription.plan === 'trial' || subscription.plan === 'monthly');
  if (hasMonthlyOrTrial) {
    slides.push({
      type: 'offer',
      content: `Special Upgrade Offer: Save 58% — Upgrade to the 6-Month Pack for just ₹2499!`,
      action: {
        text: 'Upgrade Now',
        onClick: () => router.push('/dashboard/billing')
      }
    });
  }

  // Proud India slide
  slides.push({
    type: 'proud',
    content: `Homegrown & Proud: Built in India for ambitious businesses worldwide.`,
    action: null
  });

  const activeIndex = currentSlideIndex >= slides.length ? 0 : currentSlideIndex;
  const currentSlide = slides[activeIndex];

  const statusCfg = AI_STATUS_MAP[aiStatus];

  const handleSignOut = async () => {
    try { await signOut?.(); } catch {}
    router.replace('/');
  };



  return (
    <div className="flex h-screen bg-[#FFF8F0] overflow-hidden">
      <Sidebar 
        onExpandedChange={setSidebarExpanded} 
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      
      <div className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden relative bg-[#FFF8F0] transition-all duration-200 ease-in-out",
        "ml-0 md:ml-[60px] lg:ml-[60px]",
        sidebarExpanded && "md:ml-60 lg:ml-60"
      )}>
        
        <div className="relative z-0 flex-1 flex flex-col h-screen overflow-hidden bg-[#FFF8F0]">
          {/* Black backdrop overlay when sidebar is expanded on tablet */}
          <div 
            className={cn(
              "absolute inset-0 bg-black transition-opacity duration-200 pointer-events-none z-40 hidden md:block",
              sidebarExpanded ? "opacity-25" : "opacity-0"
            )}
          />
          {/* Mobile drawer overlay */}
          {mobileSidebarOpen && (
            <div 
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden transition-opacity duration-200"
            />
          )}

          {/* ── Combined Animated Top Banner ────────────────────────────────── */}
          <div className="relative overflow-hidden bg-[#FFF3E5] border-b border-[#EED9B4]/50 h-9 flex items-center justify-between px-2 sm:px-4 gap-2 flex-shrink-0 select-none text-[#22577A]">
            {/* Left spacer to balance the right button */}
            <div className="shrink-0 w-[80px] sm:w-[90px] hidden md:block" />

            {/* Centered animated content — full text visible on all devices */}
            <div className="flex-1 relative h-full flex items-center justify-center min-w-0 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="absolute inset-0 flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold tracking-tight px-1"
                >
                  {currentSlide.type === 'welcome' && (
                    <span className="animate-wave-emoji shrink-0 text-xs sm:text-sm">👋</span>
                  )}
                  {currentSlide.type === 'offer' && (
                    <span className="animate-shimmer-emoji shrink-0 text-xs sm:text-sm">⚡</span>
                  )}
                  {currentSlide.type === 'proud' && (
                    <div className="animate-shimmer-emoji shrink-0">
                      <IndianFlag />
                    </div>
                  )}
                  <div className="overflow-x-auto no-scrollbar whitespace-nowrap sm:whitespace-normal max-w-full text-center">
                    <span className="inline-block text-[#22577A] text-[11px] sm:text-xs font-bold">{currentSlide.content}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right action button */}
            <div className="shrink-0 w-auto sm:w-[90px] flex justify-end">
              {currentSlide.action && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide.type}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      onClick={currentSlide.action.onClick}
                      className="h-6 text-[10px] bg-[#22577A] hover:bg-[#1A4461] text-white px-2.5 sm:px-3 font-bold rounded-lg border-none shadow-sm cursor-pointer flex items-center justify-center transition-all hover:scale-105 active:scale-95 leading-none shrink-0"
                    >
                      {currentSlide.action.text}
                    </Button>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
          
          {/* ── Top breadcrumb / status bar ─────────────────────────────────── */}
          <div className="bg-white border-b border-zinc-200/50 h-14 flex items-center px-4 sm:px-6 flex-shrink-0">
            {/* Hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1.5 mr-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors focus:outline-none"
            >
              <Menu size={18} />
            </button>

            {/* Assistant name */}
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 select-none flex-1 min-w-0">
              <span className="w-1.5 h-1.5 bg-[#22577A] rounded-full shrink-0" />
              <span className="text-xs font-bold text-zinc-800 tracking-tight truncate">
                {assistantName}
              </span>
            </div>

            {/* Right side: AI status + logout (visible on mobile; desktop shows nothing extra) */}
            <div className="flex items-center gap-2 shrink-0">

              {/* AI Status Indicator */}
              <div ref={statusRef} className="relative">
                <button
                  onClick={() => setStatusPopoverOpen((p) => !p)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-white hover:bg-zinc-50 transition-all cursor-pointer",
                    statusCfg.ring
                  )}
                  title={`AI Status: ${statusCfg.label}`}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      statusCfg.dot,
                      statusCfg.pulse && "animate-pulse"
                    )}
                  />
                  <span className="text-[10px] font-bold text-zinc-700 hidden sm:block whitespace-nowrap">
                    {statusCfg.label}
                  </span>
                  <ChevronUp
                    size={10}
                    className={cn(
                      "text-zinc-400 transition-transform hidden sm:block",
                      statusPopoverOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>

                {/* Status popover */}
                {statusPopoverOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[220px] bg-white border border-zinc-200 rounded-xl shadow-xl z-[9999] p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">AI Health</span>
                      <button
                        onClick={() => setStatusPopoverOpen(false)}
                        className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 border-none bg-transparent cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    </div>

                    {[
                      {
                        label: 'AI Status',
                        value: statusCfg.label,
                        dotCls: statusCfg.dot,
                        textCls: aiStatus === 'online' ? 'text-emerald-600' : aiStatus === 'paused' ? 'text-amber-600' : aiStatus === 'unconfigured' ? 'text-zinc-500' : 'text-red-500',
                        pulse: statusCfg.pulse,
                      },
                      {
                        label: 'WhatsApp',
                        value: waConnected ? 'Connected' : 'Not connected',
                        dotCls: waConnected ? 'bg-emerald-500' : 'bg-red-500',
                        textCls: waConnected ? 'text-emerald-600' : 'text-red-500',
                        pulse: false,
                      },
                      {
                        label: 'Telegram',
                        value: tgConnected ? 'Connected' : 'Not connected',
                        dotCls: tgConnected ? 'bg-emerald-500' : 'bg-red-500',
                        textCls: tgConnected ? 'text-emerald-600' : 'text-red-500',
                        pulse: false,
                      },
                      {
                        label: 'Knowledge',
                        value: knowledgeCount > 0 ? `${knowledgeCount} item${knowledgeCount !== 1 ? 's' : ''}` : 'Empty',
                        dotCls: knowledgeCount > 0 ? 'bg-emerald-500' : 'bg-amber-500',
                        textCls: knowledgeCount > 0 ? 'text-emerald-600' : 'text-amber-600',
                        pulse: false,
                      },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-zinc-500">{row.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full", row.dotCls, row.pulse && "animate-pulse")} />
                          <span className={cn("text-[11px] font-extrabold", row.textCls)}>{row.value}</span>
                        </div>
                      </div>
                    ))}

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 font-semibold">Last sync</span>
                      <span className="text-[10px] font-bold text-zinc-600">{lastSync}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Logout button — mobile only */}
              <button
                onClick={handleSignOut}
                className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* Main content area */}
          <main className="flex-1 p-4 sm:p-5 md:p-6 overflow-y-auto">
            {isFeatureAllowed ? children : (
              <LockedPage feature={requiredFeature!} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

