/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/purity, react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/layout/Sidebar';
import { Clock, Menu, LogOut, RefreshCw, X, Zap, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { LockedPage } from '@/components/subscription/FeatureGate';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from '@/components/ui/logo';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return <DashboardBody>{children}</DashboardBody>;
}

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

  // Auto-redirect to billing if plan/trial is expired (only from root dashboard page)
  useEffect(() => {
    if (!subLoading && isExpired) {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        if (pathname === '/dashboard') {
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
      // Build a personalised default from the logged-in user's name or email
      const rawDisplay = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'My';
      const firstName = rawDisplay.split(/[\s._-]/)[0];
      const capitalised = firstName.charAt(0).toUpperCase() + firstName.slice(1);
      let name = `${capitalised}'s AI Assistant`;
      
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
      let hasKey = false;
      if (db && workspaceId) {
        try {
          const provsSnap = await getDocs(collection(db, 'workspaces', workspaceId, 'providers'));
          provsSnap.forEach((doc) => {
            const data = doc.data();
            if (data.apiKey && data.active === true) {
              hasKey = true;
            }
          });
        } catch (e) {
          console.warn('Failed to check API keys from Firestore:', e);
        }
      }

      if (!hasKey) {
        const PROVIDERS = ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'deepseek', 'mistral'];
        for (const p of PROVIDERS) {
          const raw = localStorage.getItem(`__dudo_dev_provider_${p}`);
          if (raw) {
            try { if (JSON.parse(raw)?.apiKey) { hasKey = true; break; } } catch {}
          }
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

  // Real-time Firestore subscription for active API keys check
  useEffect(() => {
    if (!db || !workspaceId) return;
    const collRef = collection(db, 'workspaces', workspaceId, 'providers');
    const unsubscribe = onSnapshot(collRef, (snap: any) => {
      let hasKey = false;
      snap.forEach((doc: any) => {
        const data = doc.data();
        if (data.apiKey && data.active === true) {
          hasKey = true;
        }
      });
      setHasApiKey(hasKey);
    }, (err: any) => {
      console.warn('Failed to listen to providers for status check:', err);
    });
    return unsubscribe;
  }, [workspaceId]);

  // Derive AI status from state
  useEffect(() => {
    const hasChannel = waConnected || tgConnected;
    const isFullyLive = hasChannel && hasApiKey;
    const isPartiallyLive = hasChannel || hasApiKey;

    if (isFullyLive) {
      setAiStatus('online');
    } else if (isPartiallyLive) {
      setAiStatus('paused'); // Show yellow dot
    } else {
      setAiStatus('unconfigured'); // Show grey dot
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
  useEffect(() => {
    if (!subLoading && isExpired && workspaceId) {
      console.log('[Subscription] Plan/trial expired. Local development bypass: skipping auto-disconnect.');
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

  const slides: Array<{
    type: string;
    content: string;
    bg: string;
    textColor: string;
    action: { text: string; onClick: () => void } | null;
  }> = [
    {
      type: 'welcome',
      content: `👋 Welcome back, ${firstName}! Plan: ${planLabel}${timeLabel} — Let's build something amazing today!`,
      bg: 'bg-amber-500',
      textColor: 'text-white',
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
      bg: 'bg-[#22577A]',
      textColor: 'text-white',
      action: {
        text: 'Upgrade Now',
        onClick: () => router.push('/dashboard/billing')
      }
    });
  }

  // Proud India slide
  slides.push({
    type: 'proud',
    content: `🇮🇳 Homegrown & Proud: Built in India for ambitious businesses worldwide.`,
    bg: 'bg-[#22577A]',
    textColor: 'text-white',
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
      
      <div 
        style={{ transitionDuration: '250ms' }}
        className={cn(
          "flex-1 flex flex-col h-screen overflow-hidden relative bg-[#FFF8F0] transition-all ease-in-out origin-left",
          "ml-0 md:ml-[60px] lg:ml-[60px]",
          sidebarExpanded && "md:ml-60 lg:ml-60 scale-[0.99] translate-x-[6px] blur-[2px]"
        )}
      >
        
        {/* ── Slideshow Top Alert Bar ──────────────────────────────────── */}
        <div className={cn(
          "py-2.5 px-4 sm:px-6 flex items-center justify-between text-xs font-semibold select-none flex-shrink-0 z-20 transition-colors duration-500",
          currentSlide.bg,
          currentSlide.textColor
        )}>
          <div className="flex-1 flex justify-center text-center max-w-full min-w-0 pr-8">
            <span className="truncate">
              {currentSlide.content}
            </span>
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
                    className={cn(
                      "h-6 text-[10px] px-2.5 sm:px-3 font-bold rounded-lg border-none shadow-sm cursor-pointer flex items-center justify-center transition-all hover:scale-105 active:scale-95 leading-none shrink-0",
                      currentSlide.type === 'welcome'
                        ? 'bg-white text-amber-600 hover:bg-amber-50'
                        : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                    )}
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
            className="md:hidden w-11 h-11 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors focus:outline-none -ml-3 mr-1 cursor-pointer border-none bg-transparent"
          >
            <Menu size={20} />
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
            <div
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full border bg-white select-none shadow-xs transition-all",
                statusCfg.ring
              )}
              title={`AI Status: ${statusCfg.label}`}
            >
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  statusCfg.dot,
                  statusCfg.pulse && "animate-pulse"
                )}
              />
            </div>

            {/* Logout button (visible only on mobile width < 768px) */}
            <button
              onClick={handleSignOut}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all active:scale-95 focus:outline-none border-none bg-transparent cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>

          </div>
        </div>

        {/* ── Main View Panel Container ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-[#FFF8F0] relative">
          {/* Subscription Expiry Overlay (Feature gate) */}
          {!subLoading && isExpired && (
            <div className="absolute inset-0 bg-[#FFF8F0]/80 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4 text-amber-500">
                <AlertTriangle size={24} className="stroke-[2.5]" />
              </div>
              <h2 className="text-lg font-black text-zinc-800 tracking-tight leading-none mb-2">
                Your Workspace subscription has expired
              </h2>
              <p className="text-xs text-zinc-400 font-semibold max-w-[280px] leading-relaxed mb-6">
                Connect your account to a paid subscription plan to resume messaging automation and access billing/workspace logs.
              </p>
              <Button
                onClick={() => router.push('/dashboard/billing')}
                className="bg-[#22577A] hover:bg-[#1A4461] text-white font-bold px-5 h-9 rounded-xl border-none shadow-md cursor-pointer transition-all hover:scale-103 active:scale-97 text-xs flex items-center gap-1.5"
              >
                Renew Subscription &rarr;
              </Button>
            </div>
          )}

          {/* Render layout view child sub-pages (with access checks) */}
          {!isFeatureAllowed ? (
            <LockedPage feature={requiredFeature || ''} />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
