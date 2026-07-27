'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AgentSkills from '@/components/agent/AgentSkills';
import AgentSkillStore from '@/components/agent/AgentSkillStore';
import AgentChannels from '@/components/agent/AgentChannels';
import AgentApiKeys from '@/components/agent/AgentApiKeys';
import AgentPersonality from '@/components/agent/AgentPersonality';
import AgentTesting from '@/components/agent/AgentTesting';
import { useState, useEffect } from 'react';
import { Bot, Puzzle, Store, MessageSquare, Key, Brain, Play } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { mockAssistant } from '@/services/mockData';
import { useWorkspace } from '@/hooks/useWorkspace';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';

const TABS = [
  { id: 'skills', label: 'Skills', icon: Puzzle },
  { id: 'skill-store', label: 'Skill Store', icon: Store },
  { id: 'channels', label: 'Channels', icon: MessageSquare },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'personality', label: 'Personality', icon: Brain },
  { id: 'testing', label: 'Testing', icon: Play },
];

const assistantId = 'assistant-1';

function AgentPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { workspaceId } = useWorkspace();

  // Backward compatibility tab redirect mapping
  const getMappedTab = (tab: string | null) => {
    const raw = tab || 'skills';
    if (raw === 'general' || raw === 'behaviour') return 'personality';
    if (raw === 'knowledge' || raw === 'publish') return 'skills';
    return raw;
  };

  const mappedTab = getMappedTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState(mappedTab);
  const [prevTab, setPrevTab] = useState(mappedTab);

  if (mappedTab !== prevTab) {
    setActiveTab(mappedTab);
    setPrevTab(mappedTab);
  }

  const [name, setName] = useState(mockAssistant.name);
  const [status, setStatus] = useState(mockAssistant.status);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`/dashboard/agent?${params.toString()}`, { scroll: false });
  };

  const loadHeaderDetails = async () => {
    if (!workspaceId) return;
    let currentName = "Kishore's AI Assistant";
    let currentStatus = mockAssistant.status;

    if (db) {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'assistants', assistantId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          currentName = data.name || currentName;
          currentStatus = data.status || currentStatus;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (typeof window !== 'undefined') {
      const localStatus = localStorage.getItem('__dudo_dev_status');
      if (localStatus) currentStatus = localStatus as "live" | "paused" | "draft";

      const localAss = localStorage.getItem('__dudo_dev_assistant');
      if (localAss) {
        try {
          const parsed = JSON.parse(localAss);
          currentName = parsed.name || currentName;
        } catch (e) {}
      }
    }

    setName(currentName);
    setStatus(currentStatus);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHeaderDetails();

    window.addEventListener('dudo-config-changed', loadHeaderDetails);
    window.addEventListener('dudo-status-changed', loadHeaderDetails);

    const handleSwitch = (e: Event) => {
      const tabId = (e as CustomEvent).detail;
      if (tabId) handleTabChange(tabId);
    };
    window.addEventListener('dudo-switch-tab', handleSwitch);

    return () => {
      window.removeEventListener('dudo-config-changed', loadHeaderDetails);
      window.removeEventListener('dudo-status-changed', loadHeaderDetails);
      window.removeEventListener('dudo-switch-tab', handleSwitch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, workspaceId]);

  return (
    <PageLayout className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex flex-col gap-4">
      {/* Compact Agent Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-200/50 pb-3 text-left select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#22577A] flex items-center justify-center shadow-sm shrink-0 text-white">
            <Bot size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-zinc-950 tracking-tight leading-none">{name}</h2>
              <StatusBadge status={status === 'live' ? 'active' : status === 'paused' ? 'warning' : 'inactive'} label={status} className="h-5 text-[9px] px-1.5" />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1 font-bold uppercase tracking-wider leading-none">Dudo Assistant Panel</p>
          </div>
        </div>
      </div>

      {/* Compact Horizontal Tabs Bar */}
      <div className="flex flex-row border-b border-zinc-200 overflow-x-auto select-none max-w-full gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer bg-transparent border-t-0 border-l-0 border-r-0 ${
                activeTab === tab.id
                  ? 'border-[#22577A] text-[#22577A] font-black'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Icon size={13} className={activeTab === tab.id ? 'text-[#22577A]' : 'text-zinc-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Wrapper */}
      <div className="w-full min-h-[400px]">
        {activeTab === 'skills' && <AgentSkills />}
        {activeTab === 'skill-store' && <AgentSkillStore />}
        {activeTab === 'channels' && <AgentChannels />}
        {activeTab === 'api-keys' && <AgentApiKeys />}
        {activeTab === 'personality' && <AgentPersonality />}
        {activeTab === 'testing' && <AgentTesting />}
      </div>
    </PageLayout>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<LoadingSpinner size="lg" text="Loading Agent Config..." />}>
      <AgentPageInner />
    </Suspense>
  );
}
