'use client';

import { useState, useEffect } from 'react';
import { mockAssistant } from '@/services/mockData';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';


const assistantId = 'assistant-1';

const personalities = [
  { value: 'friendly',     label: 'Friendly',     desc: 'Warm, approachable, conversational' },
  { value: 'professional', label: 'Professional',  desc: 'Formal, precise, business-focused' },
  { value: 'formal',       label: 'Formal',        desc: 'Strict, structured, no small talk' },
  { value: 'casual',       label: 'Casual',        desc: 'Relaxed, informal, personable' },
  { value: 'custom',       label: 'Custom',        desc: 'Define in system prompt' },
];

const languages = [
  { value: 'auto',   label: 'Auto-detect' },
  { value: 'en',     label: 'English' },
  { value: 'hi',     label: 'Hindi' },
  { value: 'ta',     label: 'Tamil' },
  { value: 'te',     label: 'Telugu' },
  { value: 'bn',     label: 'Bengali' },
  { value: 'gu',     label: 'Gujarati' },
  { value: 'mr',     label: 'Marathi' },
];

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-zinc-700">{label}</Label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export default function AgentBehaviour() {
  const { workspaceId } = useWorkspace();
  const [systemPrompt, setSystemPrompt] = useState(mockAssistant.systemPrompt);
  const [personality, setPersonality] = useState(mockAssistant.personality);
  const [temperature, setTemperature] = useState(mockAssistant.temperature);
  const [language, setLanguage] = useState(mockAssistant.language);
  const [memoryEnabled, setMemoryEnabled] = useState(mockAssistant.memoryEnabled);
  const [welcomeMessage, setWelcomeMessage] = useState(mockAssistant.welcomeMessage);
  const [fallbackMessage, setFallbackMessage] = useState(mockAssistant.fallbackMessage);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      let savedPrompt = mockAssistant.systemPrompt;
      let savedPersonality = mockAssistant.personality;
      let savedTemp = mockAssistant.temperature;
      let savedLang = mockAssistant.language;
      let savedMemory = mockAssistant.memoryEnabled;
      let savedWelcome = mockAssistant.welcomeMessage;
      let savedFallback = mockAssistant.fallbackMessage;

      if (db) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'assistants', assistantId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            savedPrompt = data.systemPrompt || savedPrompt;
            savedPersonality = data.personality || savedPersonality;
            savedTemp = data.temperature !== undefined ? data.temperature : savedTemp;
            savedLang = data.language || savedLang;
            savedMemory = data.memoryEnabled !== undefined ? data.memoryEnabled : savedMemory;
            savedWelcome = data.welcomeMessage || savedWelcome;
            savedFallback = data.fallbackMessage || savedFallback;
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('__dudo_dev_assistant');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            savedPrompt = parsed.systemPrompt || savedPrompt;
            savedPersonality = parsed.personality || savedPersonality;
            savedTemp = parsed.temperature !== undefined ? parsed.temperature : savedTemp;
            savedLang = parsed.language || savedLang;
            savedMemory = parsed.memoryEnabled !== undefined ? parsed.memoryEnabled : savedMemory;
            savedWelcome = parsed.welcomeMessage || savedWelcome;
            savedFallback = parsed.fallbackMessage || savedFallback;
          } catch(e){}
        }
      }

      setSystemPrompt(savedPrompt);
      setPersonality(savedPersonality as any);
      setTemperature(savedTemp);
      setLanguage(savedLang);
      setMemoryEnabled(savedMemory);
      setWelcomeMessage(savedWelcome);
      setFallbackMessage(savedFallback);
      setLoading(false);
    }
    loadData();
  }, [workspaceId]);

  const handleSave = async () => {
    const payload = {
      systemPrompt: systemPrompt.trim(),
      personality,
      temperature,
      language,
      memoryEnabled,
      welcomeMessage: welcomeMessage.trim(),
      fallbackMessage: fallbackMessage.trim(),
      updatedAt: new Date().toISOString(),
    };

    if (db) {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'assistants', assistantId);
        await setDoc(docRef, payload, { merge: true });
      } catch (e) {
        console.error(e);
      }
    }

    if (typeof window !== 'undefined') {
      const existing = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
      localStorage.setItem('__dudo_dev_assistant', JSON.stringify({ ...existing, ...payload }));
      window.dispatchEvent(new Event('dudo-config-changed'));
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  useEffect(() => {
    const handleGlobalSave = () => {
      handleSave();
    };
    window.addEventListener('dudo-save-active-tab', handleGlobalSave);
    return () => {
      window.removeEventListener('dudo-save-active-tab', handleGlobalSave);
    };
  }, [systemPrompt, personality, temperature, language, memoryEnabled, welcomeMessage, fallbackMessage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-zinc-900 border-r-2" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* System Prompt */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-card">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4">Instructions</h3>
        <FormField
          label="System Prompt"
          hint="The core instructions that define how your agent thinks and responds."
        >
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant. You help customers with..."
            className="text-sm border-zinc-200 focus-visible:ring-zinc-900 resize-none font-mono"
            rows={7}
          />
        </FormField>
      </div>

      {/* Personality & Language */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-card">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4">Personality</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Personality">
            <Select value={personality} onValueChange={(val) => val && setPersonality(val as any)}>
              <SelectTrigger className="h-10 text-sm border-zinc-200 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {personalities.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    <div>
                      <div className="font-medium">{p.label}</div>
                      <div className="text-xs text-zinc-400">{p.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Language">
            <Select value={language} onValueChange={(val) => val && setLanguage(val)}>
              <SelectTrigger className="h-10 text-sm border-zinc-200 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* Temperature */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs font-medium text-zinc-700">Temperature</Label>
            <span className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
              {temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-zinc-200 rounded-full appearance-none cursor-pointer accent-zinc-900"
          />
          <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-card">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4">Messages</h3>
        <div className="space-y-4">
          <FormField
            label="Welcome Message"
            hint="Sent when a user starts a new conversation."
          >
            <Textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Hi! How can I help you today?"
              className="text-sm border-zinc-200 focus-visible:ring-zinc-900 resize-none"
              rows={2}
            />
          </FormField>

          <FormField
            label="Fallback Message"
            hint="Sent when the agent cannot answer a question."
          >
            <Textarea
              value={fallbackMessage}
              onChange={(e) => setFallbackMessage(e.target.value)}
              placeholder="I'm not sure about that. Let me connect you with a team member."
              className="text-sm border-zinc-200 focus-visible:ring-zinc-900 resize-none"
              rows={2}
            />
          </FormField>
        </div>
      </div>

      {/* Memory */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Memory</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Remember past conversations with each user
            </p>
          </div>
          <Switch
            checked={memoryEnabled}
            onCheckedChange={setMemoryEnabled}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className={`gap-2 h-9 text-sm font-medium transition-all ${saved ? 'bg-green-600 hover:bg-green-600' : 'bg-zinc-900 hover:bg-zinc-800'} text-white`}
        >
          <Save size={14} />
          {saved ? 'Saved!' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
