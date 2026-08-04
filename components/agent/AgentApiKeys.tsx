'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ApiProvider } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Trash2, Key, AlertCircle, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/contexts/AuthContext';
import SaveButton from '@/components/ui/SaveButton';

import { ProviderModelRegistry } from '@/lib/ai/providers/ProviderModelRegistry';

// ─── Types ───────────────────────────────────────────────────────────────────

type ValidationStatus = 'not_configured' | 'validating' | 'valid' | 'invalid' | 'error';

interface ProviderState {
  provider: ApiProvider;
  model: string;
  /** The raw key the user typed (never sent back after save). Empty after masking. */
  apiKeyInput: string;
  /** Whether there's a validated key stored server-side */
  isValidated: boolean;
  validationStatus: ValidationStatus;
  validationError: string | null;
  originalModel?: string;
}

// ─── Static Provider Metadata (logo, names) ───

const PROVIDER_METADATA: Record<ApiProvider, {
  name: string;
  placeholderKey: string;
  logo: React.ReactNode | ((color?: string) => React.ReactNode);
}> = {
  openai: {
    name: 'OpenAI',
    placeholderKey: 'Paste your OpenAI API key (sk-...)',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill="#10A37F">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
      </svg>
    ),
  },
  anthropic: {
    name: 'Anthropic',
    placeholderKey: 'Paste your Anthropic API key',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill="#CC5A37">
        <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
      </svg>
    ),
  },
  gemini: {
    name: 'Google Gemini',
    placeholderKey: 'Paste your Gemini API key (AIzaSy...)',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
  groq: {
    name: 'Groq',
    placeholderKey: 'Paste your Groq API key',
    logo: (
      <svg viewBox="0 0 512 512" className="w-5.5 h-5.5" fill="#F05A28">
        <path d="M256.867 16.007c-92.47-.84-167.997 71.999-168.861 162.741-.84 90.767 73.319 164.926 165.789 165.766h58.08V282.93h-55.008c-57.767.672-105.118-44.784-105.79-101.519-.696-56.687 45.623-103.15 103.39-103.822h2.4c57.767 0 104.59 45.96 104.758 102.67v151.318c0 56.207-46.655 101.998-103.75 102.694a104.988 104.988 0 01-72.79-30.047l-44.424 43.63c30.983 30.432 72.599 47.712 116.038 48.144h2.208c91.27-1.344 164.59-73.99 165.093-163.581V176.42c-2.232-89.302-76.39-160.413-167.133-160.413z" />
      </svg>
    ),
  },
  openrouter: {
    name: 'OpenRouter',
    placeholderKey: 'Paste your OpenRouter API key',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill="currentColor">
        <path d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z" />
      </svg>
    ),
  },
  deepseek: {
    name: 'DeepSeek',
    placeholderKey: 'Paste your DeepSeek API key',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill="#5786FE">
        <path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588" />
      </svg>
    ),
  },
  mistral: {
    name: 'Mistral',
    placeholderKey: 'Paste your Mistral API key',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill="#FA520F">
        <path d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z" />
      </svg>
    ),
  },
  elevenlabs: {
    name: 'ElevenLabs',
    placeholderKey: 'Paste your ElevenLabs API key',
    logo: (color?: string) => (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill={color || "#1A1A1A"} fillRule="evenodd">
        <path d="M5 0h5v24H5V0zM14 0h5v24h-5V0z" />
      </svg>
    ),
  },
  deepgram: {
    name: 'Deepgram',
    placeholderKey: 'Paste your Deepgram API key',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill="#13EF95">
        <path d="M11.203 24H1.517a.364.364 0 0 1-.258-.62l6.239-6.275a.37.37 0 0 1 .259-.108h3.52c2.723 0 5.025-2.127 5.107-4.845a5.004 5.004 0 0 0-4.999-5.148H7.613v4.646c0 .2-.164.364-.365.364H.968a.365.365 0 0 1-.363-.364V.364C.605.164.768 0 .969 0h10.416c6.684 0 12.111 5.485 12.01 12.187C23.293 18.77 17.794 24 11.202 24z" />
      </svg>
    ),
  },
  assemblyai: {
    name: 'AssemblyAI',
    placeholderKey: 'Paste your AssemblyAI API key',
    logo: (color?: string) => (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill={color || "#243B53"} fillRule="evenodd">
        <path d="M10.595 1.5a3.695 3.695 0 00-3.444 2.355L0 22.26h5.432l5.629-14.486h.002a.96.96 0 011.782 0h.75V4.835h-1.393L13.498 1.5h-2.902z" />
        <path d="M7.151 3.855a3.695 3.695 0 013.26-2.35l-.002-.005H13.405c1.524 0 2.893.936 3.444 2.355L24 22.26h-5.525L11.54 4.413a2.528 2.528 0 00-4.609.006l.22-.564z" />
      </svg>
    ),
  },
  azure: {
    name: 'Azure Speech',
    placeholderKey: 'Paste your Azure Speech API key',
    logo: (color?: string) => (
      <svg viewBox="0 0 24 24" className="w-5.5 h-5.5" fill={color || "#0078D4"} fillRule="evenodd">
        <path d="M18.397 15.296H7.4a.51.51 0 00-.347.882l7.066 6.595c.206.192.477.298.758.298h6.226l-2.706-7.775z" fillOpacity=".75" />
        <path d="M8.295.857c-.477 0-.9.304-1.053.756L.495 21.605a1.11 1.11 0 001.052 1.466h5.43c.477 0 .9-.304 1.053-.755l1.341-3.975-2.318-2.163a.51.51 0 01.347-.882h3L15.271.857H8.295z" fillOpacity=".5" />
        <path d="M17.193 1.613a1.11 1.11 0 00-1.052-.756h-7.81.035c.477 0 .9.304 1.052.756l6.748 19.992a1.11 1.11 0 01-1.052 1.466h-.12 7.895a1.11 1.11 0 001.052-1.466L17.193 1.613z" />
      </svg>
    ),
  },
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function ValidationBadge({ status }: { status: ValidationStatus }) {
  const config: Record<ValidationStatus, { icon: React.ReactNode; label: string; className: string }> = {
    not_configured: {
      icon: <ShieldOff size={10} />,
      label: 'Not Configured',
      className: 'bg-zinc-100 text-zinc-500 border-zinc-200',
    },
    validating: {
      icon: <Loader2 size={10} className="animate-spin" />,
      label: 'Validating',
      className: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    valid: {
      icon: <ShieldCheck size={10} />,
      label: 'Valid',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    invalid: {
      icon: <ShieldOff size={10} />,
      label: 'Invalid Key',
      className: 'bg-red-50 text-red-600 border-red-200',
    },
    error: {
      icon: <AlertCircle size={10} />,
      label: 'Error',
      className: 'bg-orange-50 text-orange-600 border-orange-200',
    },
  };

  const c = config[status];
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[9px] font-bold border px-2 py-0.5 rounded-full',
        c.className
      )}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const INITIAL_PROVIDERS: Record<ApiProvider, ProviderState> = {
  openai: { provider: 'openai', model: 'gpt-4o-mini', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  anthropic: { provider: 'anthropic', model: 'claude-3-5-haiku-latest', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  gemini: { provider: 'gemini', model: 'gemini-2.5-flash', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  groq: { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  openrouter: { provider: 'openrouter', model: 'openrouter-best-value', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  deepseek: { provider: 'deepseek', model: 'deepseek-chat', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  mistral: { provider: 'mistral', model: 'mistral-large-latest', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  elevenlabs: { provider: 'elevenlabs', model: 'eleven_multilingual_v2', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  deepgram: { provider: 'deepgram', model: 'nova-2', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  assemblyai: { provider: 'assemblyai', model: 'best', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
  azure: { provider: 'azure', model: 'azure-speech-standard', apiKeyInput: '', isValidated: false, validationStatus: 'not_configured', validationError: null },
};

export default function AgentApiKeys() {
  const { workspaceId } = useWorkspace();
  const { currentUser } = useAuth();
  const [activeProvider, setActiveProvider] = useState<ApiProvider>('openai');
  const [providers, setProviders] = useState<Record<ApiProvider, ProviderState>>(INITIAL_PROVIDERS);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Load validation state from Firestore (client-side read to know which are configured)
  useEffect(() => {
    async function loadConfigs() {
      if (!workspaceId || !db) { setLoading(false); return; }

      const { doc, getDoc } = await import('firebase/firestore');
      const updated = { ...providers };
      let firstValid: ApiProvider | null = null;

      for (const key of Object.keys(providers) as ApiProvider[]) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'providers', key);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const hasKey = !!data.apiKey;
            const defaultModelId = ProviderModelRegistry.getDefaultModel(key).modelId;
            updated[key] = {
              ...updated[key],
              model: data.model || defaultModelId,
              originalModel: data.model || defaultModelId,
              apiKeyInput: '',             // never populate with real key
              isValidated: hasKey,
              validationStatus: hasKey ? 'valid' : 'not_configured',
              validationError: null,
            };
            if (hasKey && !firstValid) firstValid = key;
          }
        } catch (e) {
          console.error(`[AgentApiKeys] Error loading provider ${key}:`, e);
        }
      }

      setProviders(updated);
      if (firstValid) setActiveProvider(firstValid);
      setLoading(false);
    }
    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleValidateAndSave = async () => {
    const prov = providers[activeProvider];
    setGlobalError(null);

    const rawKey = prov.apiKeyInput.trim();

    // If provider is already valid and no new key entered → just update model
    if (prov.isValidated && !rawKey) {
      // Model-only update via validate-key route (pass empty key sentinel)
      setProviders(prev => ({
        ...prev,
        [activeProvider]: { ...prev[activeProvider], validationStatus: 'validating', validationError: null },
      }));
      try {
        const token = currentUser ? await currentUser.getIdToken() : '';
        const res = await fetch('/api/agent/validate-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            workspaceId,
            provider: activeProvider,
            apiKey: '__MODEL_ONLY_UPDATE__',   // sentinel handled server-side
            model: prov.model,
            modelOnly: true,
          }),
        });
        const data = await res.json();
        if (data.valid || data.modelUpdated) {
          setProviders(prev => ({
            ...prev,
            [activeProvider]: {
              ...prev[activeProvider],
              validationStatus: 'valid',
              validationError: null,
              originalModel: prev[activeProvider].model,
            },
          }));
          window.dispatchEvent(new Event('dudo-config-changed'));
        } else {
          throw new Error(data.error || 'Failed to update model.');
        }
      } catch (e) {
        console.error(e);
        setProviders(prev => ({
          ...prev,
          [activeProvider]: { ...prev[activeProvider], validationStatus: 'valid', validationError: null },
        }));
        throw e;
      }
      return;
    }

    if (!rawKey) {
      setGlobalError('Enter an API key to validate and save.');
      return;
    }

    // Begin validation
    setProviders(prev => ({
      ...prev,
      [activeProvider]: { ...prev[activeProvider], validationStatus: 'validating', validationError: null },
    }));

    try {
      const token = currentUser ? await currentUser.getIdToken() : '';
      const res = await fetch('/api/agent/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          workspaceId,
          provider: activeProvider,
          apiKey: rawKey,
          model: prov.model,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setProviders(prev => ({
          ...prev,
          [activeProvider]: {
            ...prev[activeProvider],
            validationStatus: 'error',
            validationError: data.error || 'Server error during validation.',
          },
        }));
        throw new Error(data.error || 'Server error during validation.');
      }

      if (data.valid) {
        setProviders(prev => ({
          ...prev,
          // Mark all others as not-active in UI (validation route already does this in DB)
          ...Object.fromEntries(
            Object.keys(prev).map(k => [
              k,
              k === activeProvider
                ? {
                    ...prev[k as ApiProvider],
                    apiKeyInput: '',
                    isValidated: true,
                    validationStatus: 'valid' as ValidationStatus,
                    validationError: null,
                    originalModel: prev[k as ApiProvider].model,
                  }
                : prev[k as ApiProvider],
            ])
          ),
        }));
        window.dispatchEvent(new Event('dudo-config-changed'));
      } else {
        setProviders(prev => ({
          ...prev,
          [activeProvider]: {
            ...prev[activeProvider],
            validationStatus: 'invalid',
            validationError: data.error || 'The API key was rejected by the provider.',
          },
        }));
        throw new Error(data.error || 'The API key was rejected by the provider.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error.';
      setProviders(prev => ({
        ...prev,
        [activeProvider]: { ...prev[activeProvider], validationStatus: 'error', validationError: msg },
      }));
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || !db) return;
    try {
      const docRef = doc(db, 'workspaces', workspaceId, 'providers', activeProvider);
      await deleteDoc(docRef);
    } catch (e) {
      console.error(e);
    }

    setProviders(prev => ({
      ...prev,
      [activeProvider]: {
        ...INITIAL_PROVIDERS[activeProvider],
        model: prev[activeProvider].model,
      },
    }));
    window.dispatchEvent(new Event('dudo-config-changed'));
  };

  const handleModelChange = (val: string | null) => {
    if (!val) return;
    setProviders(prev => ({
      ...prev,
      [activeProvider]: { ...prev[activeProvider], model: val },
    }));
  };

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading API Configurations..." />;
  }

  const activeConf = providers[activeProvider];
  const metadata = PROVIDER_METADATA[activeProvider];
  const regModel = ProviderModelRegistry.getModel(activeProvider, activeConf.model);
  const contextText = regModel ? (regModel.contextWindow >= 1000000 ? `${regModel.contextWindow / 1000000}M` : `${regModel.contextWindow / 1000}K`) : '—';
  const priceInfo = {
    recommended: regModel?.recommended ?? false,
    context: contextText,
    price: regModel?.price ?? '—',
  };
  const availableModels = ProviderModelRegistry.getModelsByProvider(activeProvider);
  const isValidating = activeConf.validationStatus === 'validating';

  const saveButtonLabel = () => {
    if (isValidating) return 'Validating...';
    if (activeConf.isValidated && !activeConf.apiKeyInput.trim()) return 'Update Model';
    return 'Validate & Save';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none w-full">

      {/* Left Column: Provider List */}
      <div className="md:col-span-1 bg-white border border-zinc-200 rounded-xl p-3.5 shadow-sm space-y-1.5 h-fit">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1.5 mb-2.5">AI Providers</h3>
        {(Object.entries(PROVIDER_METADATA) as [ApiProvider, typeof PROVIDER_METADATA[ApiProvider]][]).map(([key, metaData]) => {
          const isConnected = providers[key].isValidated;
          const isSelected = activeProvider === key;
          const models = ProviderModelRegistry.getModelsByProvider(key);
          const subtext = models.map(m => m.displayName).slice(0, 3).join(', ');
          return (
            <button
              key={key}
              onClick={() => { setActiveProvider(key); setGlobalError(null); }}
              className={cn(
                'w-full flex items-center justify-between p-2.5 rounded-lg transition-all border text-left cursor-pointer',
                isSelected
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                  : 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50'
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'w-7.5 h-7.5 rounded-lg flex items-center justify-center border shrink-0',
                  isSelected ? 'bg-white/10 border-white/10' : 'bg-zinc-50 border-zinc-200'
                )}>
                  {typeof metaData.logo === 'function' ? metaData.logo(isSelected ? '#FFFFFF' : undefined) : metaData.logo}
                </div>
                <div>
                  <h4 className="text-xs font-bold capitalize leading-none">{metaData.name}</h4>
                  <span className="text-[9px] block text-zinc-400 mt-1 leading-none">{subtext}</span>
                </div>
              </div>
              {isConnected && (
                <CheckCircle2 size={13} className={isSelected ? 'text-white' : 'text-green-500'} />
              )}
            </button>
          );
        })}
      </div>

      {/* Right Column: Settings Form */}
      <div className="md:col-span-2 bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4 flex flex-col justify-between">

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
            <div className="w-8.5 h-8.5 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-800">
              {typeof metadata.logo === 'function' ? metadata.logo() : metadata.logo}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-zinc-900">{metadata.name} Setup</h3>
                <ValidationBadge status={activeConf.validationStatus} />
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">Configure your API key to enable this provider</p>
            </div>
          </div>

          {/* Model selector */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-zinc-700">Model</Label>
            <Select value={activeConf.model} onValueChange={handleModelChange}>
              <SelectTrigger className="h-8.5 text-xs border-zinc-200 w-full max-w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m.modelId} value={m.modelId}>{m.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="bg-zinc-50 border border-zinc-150 rounded-lg p-3 text-[10.5px] space-y-1.5 mt-2">
              <div className="flex justify-between font-medium">
                <span className="text-zinc-400">Context Window</span>
                <span className="text-zinc-800 font-bold">{priceInfo.context}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-zinc-400">Estimated Cost</span>
                <span className="text-zinc-800 font-bold">{priceInfo.price}</span>
              </div>
              {priceInfo.recommended && (
                <div className="text-[9px] text-[#22577A] font-extrabold uppercase mt-1">
                  Recommended for general chatbot workflows
                </div>
              )}
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1">
            <Label htmlFor="api-key" className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5 flex-wrap">
              <span>API Secret Key</span>
              {activeConf.isValidated && (
                <span className="text-[9px] font-medium text-zinc-400">
                  (Key stored securely — enter a new key to replace)
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="api-key"
                type="password"
                value={activeConf.apiKeyInput}
                onChange={(e) => {
                  setProviders(prev => ({
                    ...prev,
                    [activeProvider]: {
                      ...prev[activeProvider],
                      apiKeyInput: e.target.value,
                      validationError: null,
                    },
                  }));
                  setGlobalError(null);
                }}
                placeholder={
                  activeConf.isValidated
                    ? 'Enter a new key to replace the saved one'
                    : metadata.placeholderKey
                }
                className="h-8.5 pr-10 text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 placeholder:text-zinc-400"
              />
              <Key size={13} className="absolute right-3 top-2.5 text-zinc-400" />
            </div>
            {activeConf.validationStatus === 'invalid' && activeConf.validationError && (
              <div className="text-[11px] text-red-700 font-bold flex items-center gap-1.5 mt-2 bg-red-50 border border-red-200 p-2.5 rounded-lg leading-snug">
                <AlertCircle size={14} className="text-red-600 shrink-0" />
                <span>{activeConf.validationError}</span>
              </div>
            )}
            {activeConf.validationStatus === 'error' && activeConf.validationError && (
              <div className="text-[11px] text-amber-900 font-bold flex items-center gap-1.5 mt-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg leading-snug">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <span>{activeConf.validationError}</span>
              </div>
            )}
          </div>

          {/* Validation info note */}
          <div className="bg-blue-50/40 border border-blue-100 rounded-lg px-3 py-2 text-[10px] text-blue-700 font-medium leading-relaxed">
            Your API key is validated server-side against the provider before being stored.
            It is never exposed in browser responses or logs.
          </div>
        </div>

        {/* Global error */}
        {globalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-1.5 rounded-md font-medium">
            ⚠️ {globalError}
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 border-t border-zinc-150 flex justify-between items-center">
          {activeConf.isValidated ? (
            <Button
              onClick={handleDelete}
              variant="outline"
              size="sm"
              className="h-7.5 text-[10px] font-bold border-zinc-200 text-red-500 hover:bg-red-50/30 bg-white cursor-pointer"
            >
              <Trash2 size={11} className="mr-1" /> Disconnect
            </Button>
          ) : (
            <div />
          )}

          <SaveButton
            onClick={handleValidateAndSave}
            isDirty={activeConf.apiKeyInput.trim() !== '' || activeConf.model !== activeConf.originalModel}
            label={saveButtonLabel()}
            successLabel="Validated & Saved"
            successToastTitle={`${metadata.name} configured`}
            successToastDescription="API key and model preferences saved."
            className="h-7.5 text-[10px] font-bold px-4 rounded-md min-w-[130px]"
          />
        </div>
      </div>
    </div>
  );
}
