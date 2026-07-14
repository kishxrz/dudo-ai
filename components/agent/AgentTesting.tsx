'use client';

import { useState, useRef, useEffect } from 'react';
import { ApiProvider, PROVIDER_LABELS, PROVIDER_MODELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Send, User, RotateCcw, Activity, ShieldAlert, Cpu, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { generate2000Skills } from '@/lib/skills-generator';
import { mockAssistant } from '@/services/mockData';

type ChatMessage = {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
};

interface DiagnosticsData {
  provider: string;
  model: string;
  latency: number;
  totalLatency?: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  status: string;
  time: string;
  installedSkillsCount?: number;
  enabledSkillsCount?: number;
  skillsSelected?: string[];
  toolsExposed?: string[];
  toolsExecuted?: string[];
  executionErrors?: string[];
}

const PROVIDER_LOGOS: Record<ApiProvider, React.ReactNode> = {
  openai: (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="#10A37F">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" fill="#10A37F" />
    </svg>
  ),
  anthropic: (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="#CC5A37">
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  ),
  groq: (
    <svg viewBox="0 0 512 512" className="w-4.5 h-4.5" fill="#F05A28">
      <path d="M256.867 16.007c-92.47-.84-167.997 71.999-168.861 162.741-.84 90.767 73.319 164.926 165.789 165.766h58.08V282.93h-55.008c-57.767.672-105.118-44.784-105.79-101.519-.696-56.687 45.623-103.15 103.39-103.822h2.4c57.767 0 104.59 45.96 104.758 102.67v151.318c0 56.207-46.655 101.998-103.75 102.694a104.988 104.988 0 01-72.79-30.047l-44.424 43.63c30.983 30.432 72.599 47.712 116.038 48.144h2.208c91.27-1.344 164.59-73.99 165.093-163.581V176.42c-2.232-89.302-76.39-160.413-167.133-160.413z" />
    </svg>
  ),
  openrouter: (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="#0F172A">
      <path d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z" />
    </svg>
  ),
  deepseek: (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="#5786FE">
      <path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45" />
    </svg>
  ),
  mistral: (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="#FA520F">
      <path d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z" />
    </svg>
  )
};

export default function AgentTesting() {
  const { workspaceId } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Playground Settings
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider>('openai');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [knowledgeEnabled, setKnowledgeEnabled] = useState<boolean>(true);

  // State to check which providers are connected
  const [connectedProviders, setConnectedProviders] = useState<Record<ApiProvider, boolean>>({
    openai: false,
    gemini: false,
    anthropic: false,
    groq: false,
    openrouter: false,
    deepseek: false,
    mistral: false,
  });

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolved API keys loaded client-side (user is authenticated here)
  const [resolvedApiKeys, setResolvedApiKeys] = useState<Partial<Record<ApiProvider, string>>>({});

  // Saved system prompt — loaded from Firestore (same source as Personality tab)
  const [savedSystemPrompt, setSavedSystemPrompt] = useState<string>('');
  const [workspaceSkills, setWorkspaceSkills] = useState<any[]>([]);

  const fetchWorkspaceSkills = async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/agent/skills?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.skills) {
          setWorkspaceSkills(data.skills);
        }
      }
    } catch (e) {
      console.error('[AgentTesting] Failed to load workspace skills:', e);
    }
  };

  useEffect(() => {
    fetchWorkspaceSkills();
  }, [workspaceId]);

  useEffect(() => {
    window.addEventListener('dudo-skills-changed', fetchWorkspaceSkills);
    return () => {
      window.removeEventListener('dudo-skills-changed', fetchWorkspaceSkills);
    };
  }, [workspaceId]);

  // Load configured providers and their API keys (client-side, user is authenticated)
  const checkConnections = async () => {
    if (!workspaceId) return;
    const status = { ...connectedProviders };
    const keys: Partial<Record<ApiProvider, string>> = {};
    let firstConnected: ApiProvider | null = null;

    for (const key of Object.keys(connectedProviders) as ApiProvider[]) {
      let isConnected = false;
      let apiKey = '';

      // Firestore (client-side: authenticated)
      if (db) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'providers', key);
          const snap = await getDoc(docRef);
          if (snap.exists() && snap.data().apiKey) {
            isConnected = true;
            apiKey = snap.data().apiKey;
          }
        } catch (e) {
          console.error('[AgentTesting] Firestore read error for', key, e);
        }
      }

      // Local fallback
      if (!isConnected && typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`__dudo_dev_provider_${key}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.apiKey) {
              isConnected = true;
              apiKey = parsed.apiKey;
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      status[key] = isConnected;
      if (apiKey) keys[key] = apiKey;
      if (isConnected) {
        if (!firstConnected) firstConnected = key;
      }
    }

    setConnectedProviders(status);
    setResolvedApiKeys(keys);

    // Auto-select first connected provider if current selected provider is not connected
    if (firstConnected && !status[selectedProvider]) {
      setSelectedProvider(firstConnected);
      setSelectedModel(PROVIDER_MODELS[firstConnected][0]);
    }
  };

  // Load the saved system prompt from Firestore (primary source) with localStorage fallback
  const loadSavedSystemPrompt = async () => {
    let prompt = mockAssistant.systemPrompt;

    if (workspaceId && db) {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().systemPrompt) {
          prompt = snap.data().systemPrompt;
        }
      } catch (e) {
        console.error('[AgentTesting] Failed to load systemPrompt from Firestore:', e);
      }
    }

    // localStorage as explicit dev fallback only
    if (prompt === mockAssistant.systemPrompt && typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('__dudo_dev_assistant');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.systemPrompt) prompt = parsed.systemPrompt;
        }
      } catch (e) {}
    }

    setSavedSystemPrompt(prompt);
  };

  useEffect(() => {
    checkConnections();
    loadSavedSystemPrompt();

    const handleConfigChanged = () => {
      checkConnections();
      loadSavedSystemPrompt();
    };

    window.addEventListener('dudo-config-changed', handleConfigChanged);
    return () => {
      window.removeEventListener('dudo-config-changed', handleConfigChanged);
    };
  }, [selectedProvider, workspaceId]);

  // Load welcome message when provider changes
  useEffect(() => {
    setMessages([
      { 
        id: 'welcome', 
        sender: 'agent', 
        text: selectedProvider === 'gemini'
          ? 'Hello! I am Google Gemini model configured for Dudo. How can I help you today?'
          : `Hello! I am ${PROVIDER_LABELS[selectedProvider] || selectedProvider} AI model configured for Dudo. How can I help you today?`,
        timestamp: new Date() 
      },
    ]);
  }, [selectedProvider]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleProviderChange = (val: string | null) => {
    if (!val) return;
    const prov = val as ApiProvider;
    setSelectedProvider(prov);
    setSelectedModel(PROVIDER_MODELS[prov]?.[0] || '');
  };

  const handleSend = async () => {
    if (!inputVal.trim() || isTyping) return;
    setErrorMsg(null);

    const userText = inputVal.trim();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    let knowledgeData = null;
    if (knowledgeEnabled) {
      try {
        const bp = localStorage.getItem('__dudo_business_profile');
        const kb = localStorage.getItem('__dudo_dev_knowledge_base');
        knowledgeData = {
          businessProfile: bp,
          knowledgeBase: kb,
        };
      } catch (e) {
        console.error('Failed to read localStorage:', e);
      }
    }

    try {
      const response = await fetch('/api/playground/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userText,
          history: messages,
          provider: selectedProvider,
          model: selectedModel,
          temperature: temperature,
          memoryEnabled: memoryEnabled,
          knowledgeEnabled: knowledgeEnabled,
          // Use the saved system prompt directly (backend resolves dynamic skill instructions)
          systemPrompt: savedSystemPrompt || mockAssistant.systemPrompt,
          workspaceId: workspaceId,
          // Pass the resolved API key directly — the client is authenticated,
          // the server Route Handler is not (no Firebase Auth token).
          apiKey: resolvedApiKeys[selectedProvider] || '',
          knowledgeData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to communicate with proxy.');
      }

      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        sender: 'agent',
        text: data.reply,
        timestamp: new Date(),
      }]);

      if (data.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: 'agent',
        text: `⚠️ Error: ${err.message || 'Could not fetch response from model.'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleReset = () => {
    setMessages([
      { 
        id: 'welcome', 
        sender: 'agent', 
          text: `Hello! I am ${PROVIDER_LABELS[selectedProvider] || selectedProvider} AI model configured for Dudo. How can I help you today?`,
        timestamp: new Date() 
      },
    ]);
    setErrorMsg(null);
    setDiagnostics(null);
  };

  const isCurrentProviderConnected = connectedProviders[selectedProvider];

  const handleSwitchToApiKeys = () => {
    window.dispatchEvent(new CustomEvent('dudo-switch-tab', { detail: 'api-keys' }));
  };

  if (!isCurrentProviderConnected) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm text-center max-w-md mx-auto select-none mt-10">
        <div className="w-12 h-12 rounded-full bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-400 mx-auto mb-3">
          <ShieldAlert size={20} />
        </div>
        <h3 className="text-xs font-bold text-zinc-800">Connect this provider before testing</h3>
        <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">
          Configure API credentials in the API Keys tab to activate the playground for this model.
        </p>
        <Button
          onClick={handleSwitchToApiKeys}
          className="mt-4 h-8 text-[10px] bg-zinc-950 text-white hover:bg-zinc-800 rounded-md px-4 border-none cursor-pointer"
        >
          Go to API Keys
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-270px)] min-h-[480px]">
      
      {/* ─── Left Section: Parameters ─── */}
      <div className="border border-zinc-200 rounded-xl p-4 bg-white space-y-4 h-full overflow-y-auto overflow-x-hidden flex flex-col justify-between shadow-sm select-none">
        <div className="space-y-3.5">
          <div>
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={13} className="text-zinc-500" /> Playground Config
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Configure active parameters</p>
          </div>

          <div className="space-y-3 pt-3 border-t border-zinc-100">
            {/* Provider Selector */}
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Provider</Label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger className="h-8 text-xs border-zinc-200 w-full">
                  <SelectValue>{PROVIDER_LABELS[selectedProvider]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k} disabled={!connectedProviders[k as ApiProvider]}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${connectedProviders[k as ApiProvider] ? 'bg-green-500' : 'bg-zinc-200'}`} />
                        {v}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selector */}
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Model Endpoint</Label>
              <Select value={selectedModel} onValueChange={(val) => val && setSelectedModel(val)}>
                <SelectTrigger className="h-8 text-xs border-zinc-200 w-full">
                  <SelectValue>{selectedModel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(PROVIDER_MODELS[selectedProvider] || []).map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Temperature Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                <span>Temperature</span>
                <span className="font-mono text-zinc-800 normal-case font-bold">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-zinc-950 mt-1"
              />
            </div>

            {/* Memory Switch */}
            <div className="flex items-center justify-between py-1 border-t border-b border-zinc-50">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-zinc-700">Memory History</span>
                <span className="text-[9px] text-zinc-400">Maintains conversation context</span>
              </div>
              <Switch checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
            </div>

            {/* Knowledge Toggle */}
            <div className="flex items-center justify-between py-1 border-b border-zinc-50">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-zinc-700">Knowledge Injection</span>
                <span className="text-[9px] text-zinc-400">Inject related articles</span>
              </div>
              <Switch checked={knowledgeEnabled} onCheckedChange={setKnowledgeEnabled} />
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="w-full text-xs border-zinc-200 font-semibold gap-1.5 h-8 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 bg-white cursor-pointer"
        >
          <RotateCcw size={11} /> Reset Chat
        </Button>
      </div>

      {/* ─── Center Section: Interactive Chat ─── */}
      <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-zinc-50/50 border-b border-zinc-100 px-4 py-3 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-zinc-50 border border-zinc-200 flex items-center justify-center shrink-0">
              {PROVIDER_LOGOS[selectedProvider] || <Bot size={13} />}
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-800">{PROVIDER_LABELS[selectedProvider]} Playground</h4>
              <span className="text-[9px] text-zinc-400 mt-0.5 block font-medium">Model: {selectedModel}</span>
            </div>
          </div>
        </div>

        {/* Messaging Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-50/30">
          {messages.map((msg) => {
            const isAgent = msg.sender === 'agent';
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end gap-2 max-w-[85%]',
                  isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'
                )}
              >
                <div className={cn(
                  'w-5.5 h-5.5 rounded-full flex items-center justify-center flex-shrink-0 border',
                  isAgent ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 text-white border-zinc-900'
                )}>
                  {isAgent ? (PROVIDER_LOGOS[selectedProvider] || <Bot size={10} />) : <User size={10} />}
                </div>

                <div className="flex flex-col">
                  <div
                    className={cn(
                      'text-xs px-3 py-2 rounded-xl shadow-sm leading-normal border font-medium whitespace-pre-wrap',
                      isAgent ? 'bg-white text-zinc-800 border-zinc-150 rounded-bl-none' : 'bg-zinc-900 text-white border-zinc-900 rounded-br-none'
                    )}
                  >
                    {msg.text}
                  </div>
                  <span className={cn('text-[8px] text-zinc-400 mt-0.5 font-mono', isAgent ? 'text-left' : 'text-right')}>
                    {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-end gap-2 max-w-[85%] mr-auto">
              <div className="w-5.5 h-5.5 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center flex-shrink-0">
                {PROVIDER_LOGOS[selectedProvider] || <Bot size={10} />}
              </div>
              <div className="bg-white border border-zinc-150 text-zinc-500 text-xs px-3 py-1.5 rounded-xl rounded-bl-none flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Input Form */}
        <div className="border-t border-zinc-150 p-2 bg-zinc-50/50">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isTyping}
              placeholder="Type your message to test AI..."
              className="h-8.5 text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 placeholder:text-zinc-400"
            />
            <Button
              type="submit"
              disabled={!inputVal.trim() || isTyping}
              className="h-8.5 w-8.5 p-0 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg flex items-center justify-center cursor-pointer border-none animate-in fade-in"
            >
              <Send size={13} />
            </Button>
          </form>
        </div>
      </div>

      {/* ─── Right Section: Diagnostics ─── */}
      <div className="border border-zinc-200 rounded-xl p-4 bg-white space-y-3.5 h-full overflow-y-auto shadow-sm select-none">
        <div>
          <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={13} className="text-zinc-500" /> Diagnostics
          </h3>
          <p className="text-[10px] text-zinc-400 mt-0.5">Execution profile stats</p>
        </div>

        <div className="pt-2.5 border-t border-zinc-100 space-y-2.5">
          {diagnostics ? (
            <div className="grid grid-cols-1 gap-2 text-xs animate-fade-in">
              {[
                { label: 'Provider', value: PROVIDER_LABELS[diagnostics.provider as ApiProvider] || diagnostics.provider },
                { label: 'Model', value: diagnostics.model, isMono: true },
                { label: 'LLM Latency', value: `${diagnostics.latency}ms`, isHighlight: true },
                ...(diagnostics.totalLatency !== undefined ? [{ label: 'Total Latency', value: `${diagnostics.totalLatency}ms` }] : []),
                { label: 'Input Tokens', value: diagnostics.inputTokens },
                { label: 'Output Tokens', value: diagnostics.outputTokens },
                { label: 'Total Tokens', value: diagnostics.totalTokens },
                { 
                  label: 'Request Status', 
                  value: diagnostics.status, 
                  isBadge: true,
                  badgeStyle: diagnostics.status === 'Success' 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-destructive/10 text-destructive border-destructive/20' 
                },
                { label: 'Memory Enabled', value: memoryEnabled ? 'Yes' : 'No' },
                { label: 'Knowledge Base', value: knowledgeEnabled ? 'Yes' : 'No' },
                { label: 'Temperature', value: temperature.toString() },
                {
                  label: 'System Prompt',
                  value: savedSystemPrompt
                    ? `Custom (${savedSystemPrompt.substring(0, 30)}${savedSystemPrompt.length > 30 ? '…' : ''})`
                    : 'Default',
                  isMono: false,
                },
                { label: 'Request Time', value: diagnostics.time },
                { label: 'Installed Skills', value: diagnostics.installedSkillsCount !== undefined ? diagnostics.installedSkillsCount.toString() : '0' },
                { label: 'Enabled Skills', value: diagnostics.enabledSkillsCount !== undefined ? diagnostics.enabledSkillsCount.toString() : '0' },
                { 
                  label: 'Skills Selected', 
                  value: diagnostics.skillsSelected && diagnostics.skillsSelected.length > 0 
                    ? diagnostics.skillsSelected.join(', ') 
                    : 'None' 
                },
                { 
                  label: 'Tools Exposed', 
                  value: diagnostics.toolsExposed && diagnostics.toolsExposed.length > 0 
                    ? diagnostics.toolsExposed.join(', ') 
                    : 'None' 
                },
                { 
                  label: 'Tools Executed', 
                  value: diagnostics.toolsExecuted && diagnostics.toolsExecuted.length > 0 
                    ? diagnostics.toolsExecuted.join(', ') 
                    : 'None' 
                },
                { 
                  label: 'Execution Errors', 
                  value: diagnostics.executionErrors && diagnostics.executionErrors.length > 0 
                    ? diagnostics.executionErrors.join(', ') 
                    : 'None',
                  isBadge: diagnostics.executionErrors && diagnostics.executionErrors.length > 0,
                  badgeStyle: 'bg-red-55 text-red-700 border-red-200 font-bold text-[9px]'
                },
              ].map((item: any, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 border-b border-zinc-50">
                  <span className="text-zinc-500 font-medium text-[11px]">{item.label}</span>
                  {item.isBadge ? (
                    <span className={cn('text-[9px] font-bold border px-1.5 py-0.5 rounded', item.badgeStyle)}>
                      {item.value}
                    </span>
                  ) : (
                    <span className={cn(
                      'font-bold text-zinc-700 text-[11px]',
                      item.isMono && 'font-mono text-[9.5px] bg-zinc-50 border border-zinc-155 px-1 py-0.5 rounded',
                      item.isHighlight && 'text-zinc-950 font-semibold'
                    )}>
                      {item.value}
                    </span>
                  )}
                </div>
              ))}

              {/* Skills Diagnostic Pipeline */}
              <div className="mt-4 pt-4 border-t border-zinc-150">
                <h4 className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Activity size={12} className="text-[#22577A]" /> Skills Pipeline Trace
                </h4>
                {workspaceSkills.filter(s => s.enabled || diagnostics.skillsSelected?.includes(s.name)).length === 0 ? (
                  <p className="text-[10px] text-zinc-400 italic">No skills currently enabled or selected.</p>
                ) : (
                  <div className="space-y-3">
                    {workspaceSkills
                      .filter(s => s.enabled || diagnostics.skillsSelected?.includes(s.name))
                      .map(skill => {
                        const isInstalled = true;
                        const isEnabled = skill.enabled;
                        const isSelected = diagnostics.skillsSelected?.includes(skill.name) || false;
                        const hasTools = (skill.requiredTools || []).length > 0;
                        
                        let step4Label = 'Injected';
                        let step4Active = false;
                        if (isSelected) {
                          step4Active = true;
                          step4Label = hasTools ? 'Exposed' : 'Injected';
                        }

                        let step5Active = false;
                        let step5Label = 'Executed';
                        if (hasTools) {
                          const executed = skill.requiredTools.some((t: string) => diagnostics.toolsExecuted?.includes(t));
                          if (executed) {
                            step5Active = true;
                          }
                        } else {
                          step5Label = 'N/A';
                        }

                        return (
                          <div key={skill.id} className="bg-zinc-50/70 border border-zinc-150 rounded-xl p-3 text-left space-y-2.5">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-[10.5px] font-black text-zinc-800 truncate">{skill.name}</span>
                              <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 leading-none">
                                {skill.handlerType}
                              </span>
                            </div>
                            
                            {/* Stepper Pipeline */}
                            <div className="flex items-center gap-0.5 text-[8px] font-mono justify-between text-center select-none font-bold">
                              {/* Installed */}
                              <div className="flex flex-col items-center flex-1">
                                <span className={cn(
                                  "w-4 h-4 rounded-full flex items-center justify-center border font-sans font-bold leading-none mb-0.5",
                                  isInstalled ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-zinc-100 text-zinc-400 border-zinc-200"
                                )}>
                                  1
                                </span>
                                <span className={isInstalled ? "text-emerald-700 font-extrabold" : "text-zinc-400"}>Inst</span>
                              </div>

                              <span className="text-zinc-300 mb-2">➔</span>

                              {/* Enabled */}
                              <div className="flex flex-col items-center flex-1">
                                <span className={cn(
                                  "w-4 h-4 rounded-full flex items-center justify-center border font-sans font-bold leading-none mb-0.5",
                                  isEnabled ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-zinc-100 text-zinc-400 border-zinc-200"
                                )}>
                                  2
                                </span>
                                <span className={isEnabled ? "text-emerald-700 font-extrabold" : "text-zinc-400"}>Enab</span>
                              </div>

                              <span className="text-zinc-300 mb-2">➔</span>

                              {/* Selected */}
                              <div className="flex flex-col items-center flex-1">
                                <span className={cn(
                                  "w-4 h-4 rounded-full flex items-center justify-center border font-sans font-bold leading-none mb-0.5",
                                  isSelected ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-zinc-100 text-zinc-400 border-zinc-200"
                                )}>
                                  3
                                </span>
                                <span className={isSelected ? "text-emerald-700 font-extrabold" : "text-zinc-400"}>Sel</span>
                              </div>

                              <span className="text-zinc-300 mb-2">➔</span>

                              {/* Injected/Exposed */}
                              <div className="flex flex-col items-center flex-1">
                                <span className={cn(
                                  "w-4 h-4 rounded-full flex items-center justify-center border font-sans font-bold leading-none mb-0.5",
                                  step4Active ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-zinc-100 text-zinc-400 border-zinc-200"
                                )}>
                                  4
                                </span>
                                <span className={step4Active ? "text-emerald-700 font-extrabold" : "text-zinc-400"}>{step4Label}</span>
                              </div>

                              <span className="text-zinc-300 mb-2">➔</span>

                              {/* Executed */}
                              <div className="flex flex-col items-center flex-1">
                                <span className={cn(
                                  "w-4 h-4 rounded-full flex items-center justify-center border font-sans font-bold leading-none mb-0.5",
                                  step5Active ? "bg-emerald-50 text-emerald-700 border-emerald-300" : hasTools ? "bg-zinc-100 text-zinc-400 border-zinc-200" : "bg-zinc-100 text-zinc-300 border-zinc-200/50"
                                )}>
                                  5
                                </span>
                                <span className={step5Active ? "text-emerald-700 font-extrabold" : "text-zinc-400"}>{step5Label}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <Sparkles size={18} className="text-zinc-200 mb-1.5" />
              <p className="text-xs font-semibold text-zinc-400">No diagnostics loaded yet</p>
              <p className="text-[10px] text-zinc-400 mt-1 max-w-[150px] mx-auto leading-relaxed">
                Send a test prompt message to profile latency and tokens metrics.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
