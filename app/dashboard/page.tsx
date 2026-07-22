'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { mockAssistant } from '@/services/mockData';
import { ApiProvider } from '@/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import {
  Settings,
  MessageSquare,
  Users,
  UserPlus,
  CornerUpLeft,
  Zap,
  Award,
  TrendingUp,
  Clock,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const assistantId = 'assistant-1';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { workspaceId } = useWorkspace();

  const [progress, setProgress] = useState({
    generalCompleted: false,
    apiKeySaved: false,
    channelConnected: false,
    testCompleted: false,
  });

  const [assistantDetails, setAssistantDetails] = useState({
    name: "My AI Assistant",
    status: mockAssistant.status,
    provider: 'Not configured',
    model: 'Not configured',
    knowledgeCount: 0,
    channelConnected: 'None',
  });

  const [metrics, setMetrics] = useState({
    messagesHandled: 0,
    timeSaved: '0.0h',
    moneySaved: '₹ 0',
    tokensUsed: '0K',
    messagesToday: 0,
    convosToday: 0,
    newUsersToday: 0,
    replyRate: '0%',
    totalMessages: 0,
    uniqueUsers: 0,
    userMessages: 0,
    botReplies: 0,
  });

  const [recentConversations, setRecentConversations] = useState<any[]>([]);

  useEffect(() => {
    async function checkSetup() {
      let isGeneral = false;
      let isKnowledge = false;
      let isChannel = false;
      let isProvider = false;
      let isPublished = false;

      let name = "My AI Assistant";
      let status = mockAssistant.status;
      let providerName = 'Not configured';
      let modelName = 'Not configured';
      let knowledgeCount = 0;
      let channelName = 'Not connected';

      // 1. Assistant config & status
      if (db) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'assistants', assistantId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            name = data.name || name;
            status = data.status || status;
            isGeneral = !!data.generalCompleted || !!data.setupProgress?.generalCompleted;
            isPublished = data.status === 'live';
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Check localStorage fallbacks
      if (typeof window !== 'undefined') {
        const localStatus = localStorage.getItem('__dudo_dev_status');
        if (localStatus) {
          status = localStatus as any;
          isPublished = localStatus === 'live';
        }
        
        const localAss = localStorage.getItem('__dudo_dev_assistant');
        if (localAss) {
          try {
            const parsed = JSON.parse(localAss);
            name = parsed.name || name;
            isGeneral = !!parsed.generalCompleted || !!parsed.setupProgress?.generalCompleted;
          } catch(e){}
        }
      }

      // 2. Providers config
      const supportedProviders: ApiProvider[] = ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'deepseek', 'mistral'];
      for (const p of supportedProviders) {
        let savedData: any = null;
        if (db) {
          try {
            const docRef = doc(db, 'workspaces', workspaceId, 'providers', p);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              savedData = snap.data();
            }
          } catch (e) {}
        }
        if (!savedData && typeof window !== 'undefined') {
          const raw = localStorage.getItem(`__dudo_dev_provider_${p}`);
          if (raw) {
            try { savedData = JSON.parse(raw); } catch(e){}
          }
        }
        if (savedData && savedData.apiKey) {
          isProvider = true;
          providerName = p.charAt(0).toUpperCase() + p.slice(1);
          modelName = savedData.model || '';
        }
      }

      // 3. Knowledge Items
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('__dudo_dev_knowledge_items');
        if (raw) {
          try {
            const items = JSON.parse(raw);
            if (Array.isArray(items) && items.length > 0) {
              isKnowledge = true;
              knowledgeCount = items.length;
            }
          } catch(e){}
        }
      }

      // 4. Channels
      if (typeof window !== 'undefined') {
        const localTelegramConnected = localStorage.getItem('__dudo_telegram_connected') === 'true';
        if (localTelegramConnected) {
          isChannel = true;
          channelName = 'Telegram';
        }

        try {
          const waRes = await fetch('/api/whatsapp/status');
          if (waRes.ok) {
            const waData = await waRes.json();
            if (waData.status === 'connected') {
              isChannel = true;
              channelName = channelName === 'Not connected' || !channelName ? 'WhatsApp' : `${channelName}, WhatsApp`;
            }
          }
        } catch (e) {
          console.error('Failed to check WhatsApp status in checkSetup:', e);
        }

        const raw = localStorage.getItem('__dudo_dev_channels');
        if (raw) {
          try {
            const channels = JSON.parse(raw);
            const active = Object.values(channels).some((c: any) => c.status === 'connected');
            if (active) {
              isChannel = true;
              const connected = Object.entries(channels)
                .filter(([_, c]: any) => c.status === 'connected')
                .map(([cName, _]) => cName.charAt(0).toUpperCase() + cName.slice(1))
                .join(', ');
              channelName = connected || 'Not connected';
            }
          } catch(e){}
        }
      }

      setProgress({
        generalCompleted: isGeneral,
        apiKeySaved: isProvider,
        channelConnected: isChannel,
        testCompleted: isPublished,
      });

      setAssistantDetails({
        name,
        status,
        provider: providerName,
        model: modelName,
        knowledgeCount,
        channelConnected: channelName,
      });

      // 5. Load conversations and calculate metrics
      if (db && workspaceId) {
        try {
          const colRef = collection(db, 'workspaces', workspaceId, 'conversations');
          const snap = await getDocs(colRef);
          const docs = snap.docs.map(doc => {
            const data = doc.data() as any;
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now()),
            } as any;
          });

          const totalDocs = docs.length;
          const botRepliesCount = docs.filter(d => !!d.botReply).length;
          const replyRatePct = totalDocs > 0 ? Math.round((botRepliesCount / totalDocs) * 100) : 0;
          
          const today = new Date();
          const todayDocs = docs.filter(d => {
            const dDate = d.timestamp;
            return dDate.getDate() === today.getDate() &&
                   dDate.getMonth() === today.getMonth() &&
                   dDate.getFullYear() === today.getFullYear();
          });

          const messagesToday = todayDocs.length;
          const convosToday = new Set(todayDocs.map(d => d.chatId).filter(Boolean)).size;
          const newUsersToday = new Set(todayDocs.map(d => d.customer?.name).filter(Boolean)).size;
          const uniqueUsers = new Set(docs.map(d => d.customer?.name).filter(Boolean)).size;

          const totalMsgs = totalDocs + botRepliesCount;
          const timeSavedHrs = (botRepliesCount * 1.5) / 60;
          const moneySavedVal = botRepliesCount * 10;
          const tokensUsedCount = botRepliesCount * 1.2;

          setMetrics({
            messagesHandled: totalDocs,
            timeSaved: `${timeSavedHrs.toFixed(1)}h`,
            moneySaved: `₹ ${moneySavedVal}`,
            tokensUsed: `${tokensUsedCount.toFixed(1)}K`,
            messagesToday,
            convosToday,
            newUsersToday,
            replyRate: `${replyRatePct}%`,
            totalMessages: totalMsgs,
            uniqueUsers,
            userMessages: totalDocs,
            botReplies: botRepliesCount,
          });

          const sortedDocs = [...docs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          setRecentConversations(sortedDocs.slice(0, 5));
        } catch (e) {
          console.error('[Dashboard Page] Error loading conversations for metrics:', e);
        }
      }
    }

    checkSetup();
    
    // Listen to changes
    window.addEventListener('dudo-config-changed', checkSetup);
    window.addEventListener('dudo-status-changed', checkSetup);
    return () => {
      window.removeEventListener('dudo-config-changed', checkSetup);
      window.removeEventListener('dudo-status-changed', checkSetup);
    };
  }, [workspaceId]);

  const completedCount = Object.values(progress).filter(Boolean).length;
  const totalCount = 4;

  const userDisplayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  const formatAssistantName = (name: string): string => {
    if (!name) return '';
    if (name.endsWith('AI Assistant') && !name.endsWith("'s AI Assistant") && !name.endsWith("s' AI Assistant")) {
      const prefix = name.slice(0, -12).trim();
      if (prefix.endsWith("'s") || prefix.endsWith("s'")) {
        return `${prefix} AI Assistant`;
      }
      return `${prefix}'s AI Assistant`;
    }
    return name;
  };

  const finalName = formatAssistantName(
    assistantDetails.name && 
    assistantDetails.name !== 'My Assistant' && 
    assistantDetails.name !== 'My AI Assistant' && 
    assistantDetails.name !== 'Assistant' && 
    assistantDetails.name !== "csk's AI Assistant"
      ? assistantDetails.name
      : `${userDisplayName}'s AI Assistant`
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 select-none pb-8 px-4 lg:px-6 min-w-0">
      
      {/* 1. TOP SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/50 pb-3 text-left">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-950 tracking-tight leading-none mb-0.5">
            {finalName}
          </h1>
          <p className="text-[10.5px] font-medium text-zinc-500 tracking-normal">
            General · Your AI Employee
          </p>
        </div>
        <Link href="/dashboard/agent" className="no-underline shrink-0">
          <Button 
            className="h-8.5 text-[11px] bg-[#22577A] hover:bg-[#1A4461] text-white font-semibold rounded-lg px-4 gap-1.5 shadow-sm shadow-[#22577A]/10 cursor-pointer border-none flex items-center hover:scale-[1.01] active:scale-99 transition-all w-full sm:w-auto"
          >
            <Settings size={12} />
            Config Agent
          </Button>
        </Link>
      </div>

      {/* Main Grid for content + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        
        {/* Left Column (Main widgets) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* 2. IMPACT BANNER */}
          <div className="bg-[#22577A] text-white rounded-xl p-4.5 shadow-sm relative overflow-hidden text-left border border-zinc-200/5">
            <div className="text-[9.5px] text-[#DBA11A]/95 font-bold uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
              <Zap size={11} className="text-[#DBA11A]" />
              YOUR DUDO IMPACT
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-left">
              <div>
                <div className="text-xl font-extrabold text-[#F3BE42] leading-none">{metrics.messagesHandled}</div>
                <div className="text-[8.5px] text-[#DBA11A]/90 font-semibold uppercase tracking-wider mt-1.5 leading-none">Messages Handled</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-[#F3BE42] leading-none">{metrics.timeSaved}</div>
                <div className="text-[8.5px] text-[#DBA11A]/90 font-semibold uppercase tracking-wider mt-1.5 leading-none">Time Saved</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-[#F3BE42] leading-none">{metrics.moneySaved}</div>
                <div className="text-[8.5px] text-[#DBA11A]/90 font-semibold uppercase tracking-wider mt-1.5 leading-none">Money Saved</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-[#F3BE42] leading-none">{metrics.tokensUsed}</div>
                <div className="text-[8.5px] text-[#DBA11A]/90 font-semibold uppercase tracking-wider mt-1.5 leading-none">Tokens Used</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-[#F3BE42] leading-none">24/7</div>
                <div className="text-[8.5px] text-[#DBA11A]/90 font-semibold uppercase tracking-wider mt-1.5 leading-none">Availability</div>
              </div>
            </div>
          </div>

          {/* 3. METRIC CARDS (8 cards in 2 rows of 4) */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 text-left">
              {[
                { 
                  label: 'Messages Today', 
                  value: String(metrics.messagesToday), 
                  icon: MessageSquare, 
                  color: 'text-[#22577A] bg-[#FFF3E5]/70 border-[#EED9B4]/60' 
                },
                { 
                  label: 'Convos Today', 
                  value: String(metrics.convosToday), 
                  icon: Users, 
                  color: 'text-[#22577A] bg-[#FFF3E5]/70 border-[#EED9B4]/60' 
                },
                { 
                  label: 'New Users Today', 
                  value: String(metrics.newUsersToday), 
                  icon: UserPlus, 
                  color: 'text-[#22577A] bg-[#FFF3E5]/70 border-[#EED9B4]/60' 
                },
                { 
                  label: 'Reply Rate', 
                  value: metrics.replyRate, 
                  icon: CornerUpLeft, 
                  color: 'text-[#22577A] bg-[#FFF3E5]/70 border-[#EED9B4]/60' 
                },
                { 
                  label: 'Total Messages', 
                  value: String(metrics.totalMessages), 
                  icon: Zap, 
                  color: 'text-[#22577A] bg-[#FFF3E5]/70 border-[#EED9B4]/60' 
                },
                { 
                  label: 'Unique Users', 
                  value: String(metrics.uniqueUsers), 
                  icon: Award, 
                  color: 'text-[#22577A] bg-[#FFF3E5]/70 border-[#EED9B4]/60' 
                },
                { 
                  label: 'User Messages', 
                  value: String(metrics.userMessages), 
                  icon: MessageSquare, 
                  color: 'text-[#22577A] bg-[#FFF3E5]/70 border-[#EED9B4]/60' 
                },
                { 
                  label: 'Bot Replies', 
                  value: String(metrics.botReplies), 
                  icon: TrendingUp, 
                  color: 'text-[#22577A] bg-[#FFF8F0]/70 border-[#EED9B4]/60' 
                },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} className="bg-white border border-zinc-150/80 rounded-xl p-3 flex flex-col justify-between h-[84px] hover:shadow-sm hover:border-zinc-300/80 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 border text-[11px]", card.color)}>
                        <Icon size={12} />
                      </div>
                    </div>
                    <div className="mt-1">
                      <div className="text-lg font-bold text-zinc-950 leading-none">{card.value}</div>
                      <div className="text-[9px] text-zinc-400 font-medium uppercase tracking-wider mt-1.5 leading-none">
                        {card.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. QUICK ACTIONS */}
          <div className="space-y-2.5 text-left">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {[
                { 
                  title: 'Configure Agent', 
                  desc: 'Skills, channels, API keys', 
                  href: '/dashboard/agent', 
                  icon: Settings,
                  style: 'bg-[#22577A]/10 border-[#22577A]/20 text-[#22577A]'
                },
                { 
                  title: 'Conversations', 
                  desc: 'See what your AI says', 
                  href: '/dashboard/conversations', 
                  icon: MessageSquare, 
                  style: 'bg-[#FFF8F0] border-[#EED9B4] text-[#22577A]' 
                },
                { 
                  title: 'Subscription', 
                  desc: 'Billing & plan details', 
                  href: '/dashboard/billing', 
                  icon: Clock, 
                  style: 'bg-[#FFF3E5] border-[#EED9B4] text-[#22577A]' 
                },
              ].map((action, i) => {
                const Icon = action.icon;
                return (
                  <Link key={i} href={action.href} className="no-underline group">
                    <div className="bg-white border border-zinc-150/80 hover:border-zinc-250 transition-all rounded-xl p-3 flex items-center gap-2.5 shadow-none cursor-pointer h-full hover:shadow-sm hover:scale-[1.01] duration-150">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 border", action.style)}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-800 group-hover:text-[#22577A] transition-colors">{action.title}</div>
                        <div className="text-[9.5px] text-zinc-400 font-medium mt-0.5">{action.desc}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 6. RECENT CONVERSATIONS */}
          <div className="space-y-2.5 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Recent Conversations</h3>
              <Link 
                href="/dashboard/conversations" 
                className="text-[9.5px] font-bold text-[#22577A] hover:underline no-underline flex items-center gap-0.5"
              >
                View all <ArrowRight size={9} />
              </Link>
            </div>
            {recentConversations.length === 0 ? (
              <div className="bg-white border border-zinc-150/80 rounded-xl p-6 text-center flex flex-col items-center justify-center gap-2 shadow-none min-h-[120px]">
                <MessageSquare className="w-6 h-6 text-zinc-300" />
                <p className="text-xs font-semibold text-zinc-800">No conversations yet</p>
                <p className="text-[10px] text-zinc-400 font-medium max-w-xs">Connect a channel and send your first message!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentConversations.map((c) => (
                  <div key={c.id} className="bg-white border border-zinc-150/80 rounded-xl py-2 px-3.5 flex items-center justify-between shadow-none hover:border-zinc-250 transition-colors duration-150">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#22577A]/10 text-[#22577A] flex items-center justify-center font-bold text-xs">
                        {(c.customer?.name || 'C')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 leading-snug">
                          {c.customer?.name || 'Customer'}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-normal line-clamp-1 max-w-[200px] sm:max-w-md">
                          {c.userMessage}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={cn(
                        "text-[8.5px] font-bold uppercase px-2 py-0.5 rounded-full border tracking-wider",
                        c.channel === 'whatsapp' 
                          ? 'bg-[#22577A]/10 text-[#22577A] border-[#22577A]/20' 
                          : 'bg-[#FFF3E5] text-[#22577A] border-[#EED9B4]'
                      )}>
                        {c.channel || 'unknown'}
                      </span>
                      <span className="text-[9.5px] text-zinc-400 font-medium shrink-0">
                        {c.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column (Sidebar widgets) */}
        <div className="space-y-4">
          
          {/* Getting Started Card */}
          <div className="bg-white border border-zinc-150/80 rounded-xl p-4 shadow-none space-y-3 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Getting Started</h3>
              <span className="text-[11px] font-bold text-[#22577A]">
                {completedCount}/{totalCount}
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-100">
              {[
                { 
                  id: 'generalCompleted', 
                  label: "Customize your agent's name & personality", 
                  tab: 'personality' 
                },
                { 
                  id: 'apiKeySaved', 
                  label: 'Add an AI API key', 
                  tab: 'api-keys' 
                },
                { 
                  id: 'channelConnected', 
                  label: 'Connect a channel (WhatsApp or Telegram)', 
                  tab: 'channels' 
                },
                { 
                  id: 'testCompleted', 
                  label: 'Send your first test message', 
                  tab: 'testing' 
                },
              ].map((item) => {
                const isComplete = progress[item.id as keyof typeof progress];
                return (
                  <Link 
                    key={item.id}
                    href={`/dashboard/agent?tab=${item.tab}`}
                    className="flex items-start gap-2 py-1 no-underline group"
                  >
                    {isComplete ? (
                      <CheckCircle2 size={13.5} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Circle size={13.5} className="text-zinc-300 group-hover:text-zinc-400 shrink-0 mt-0.5" />
                    )}
                    <span className={cn(
                      "text-[10px] font-semibold leading-normal transition-colors",
                      isComplete 
                        ? 'text-zinc-400 line-through' 
                        : 'text-zinc-600 group-hover:text-[#22577A]'
                    )}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Active Skills Card */}
          <div className="bg-white border border-zinc-150/80 rounded-xl p-4 shadow-none space-y-3 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Active Skills</h3>
              <Link 
                href="/dashboard/agent?tab=behaviour" 
                className="text-[9.5px] font-bold text-[#22577A] hover:underline no-underline"
              >
                Manage
              </Link>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-100">
              {[
                { title: 'FAQ Bot' },
                { title: 'Appointment Scheduler' },
                { title: 'Lead Capture' },
              ].map((skill, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <div className="w-5.5 h-5.5 rounded bg-[#FFF3E5] text-[#22577A] flex items-center justify-center shrink-0 border border-[#EED9B4]">
                    <Sparkles size={10} className="text-[#22577A] fill-[#22577A]/10" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-700">{skill.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Channels Card */}
          <div className="bg-white border border-zinc-150/80 rounded-xl p-4 shadow-none space-y-3 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Channels</h3>
              <Link 
                href="/dashboard/agent?tab=channels" 
                className="text-[9.5px] font-bold text-[#22577A] hover:underline no-underline"
              >
                Connect
              </Link>
            </div>
            
            <div className="pt-2 text-[10px] text-zinc-700 font-semibold border-t border-zinc-100">
              {assistantDetails.channelConnected === 'None' || assistantDetails.channelConnected === 'Not connected' ? (
                <span className="text-zinc-400">No channels connected.</span>
              ) : (
                <span className="text-[#22577A] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22577A] animate-pulse" />
                  Active: {assistantDetails.channelConnected}
                </span>
              )}
            </div>
          </div>

          {/* Agent Status Card */}
          <div className="bg-white border border-zinc-150/80 rounded-xl p-4 shadow-none space-y-3 text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Agent Status</h3>
            </div>
            
            <div className="space-y-2 pt-2 border-t border-zinc-100 text-xs">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-400 font-semibold">Status</span>
                <span className="text-[#22577A] font-bold bg-[#FFF3E5] px-2 py-0.5 rounded-full border border-[#EED9B4] text-[8.5px] uppercase tracking-wide">
                  active
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-400 font-semibold">Skills</span>
                <span className="font-bold text-zinc-700">3 active</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-400 font-semibold">Channels</span>
                <span className="font-bold text-zinc-700">
                  {assistantDetails.channelConnected === 'None' || assistantDetails.channelConnected === 'Not connected' ? 0 : assistantDetails.channelConnected.split(',').length} connected
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-400 font-semibold">Memory</span>
                <span className="text-[#22577A] font-bold flex items-center gap-0.5 text-[9px] uppercase tracking-wider">
                  ⚡ ReMe Active
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
