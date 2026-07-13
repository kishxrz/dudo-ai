'use client';

import { useState, useEffect, useRef } from 'react';
import { mockAssistant } from '@/services/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, X, ChevronLeft, ChevronRight, RefreshCw, Check, AlertCircle, Key } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const assistantId = 'assistant-1';
const MAX_GENERATIONS = 3;

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (UTC+5:30)' },
  { value: 'America/New_York', label: 'US Eastern (UTC-5:00)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (UTC-8:00)' },
  { value: 'Europe/London', label: 'London (UTC+0:00)' },
  { value: 'UTC', label: 'UTC (UTC+0:00)' },
];

// ─── Persona Builder Types ────────────────────────────────────────────────────

interface PersonaAnswers {
  businessName: string;
  productsServices: string;
  typicalCustomers: string;
  communicationStyle: string;
  languages: string;
  specialRules: string;
}

const EMPTY_ANSWERS: PersonaAnswers = {
  businessName: '',
  productsServices: '',
  typicalCustomers: '',
  communicationStyle: '',
  languages: '',
  specialRules: '',
};

type PersonaStep = 1 | 2 | 3 | 4 | 5 | 6;

interface QuestionConfig {
  field: keyof PersonaAnswers;
  label: string;
  placeholder: string;
  hint: string;
  required?: boolean;
}

const QUESTIONS: QuestionConfig[] = [
  {
    field: 'businessName',
    label: 'What is your business name?',
    placeholder: 'e.g. Sunshine Bakery',
    hint: 'The name of your business or brand.',
    required: true,
  },
  {
    field: 'productsServices',
    label: 'What products or services do you offer?',
    placeholder: 'e.g. Fresh baked goods, custom cakes, pastries...',
    hint: 'Briefly describe what you sell or provide.',
    required: true,
  },
  {
    field: 'typicalCustomers',
    label: 'Who are your typical customers?',
    placeholder: 'e.g. Local families, corporate clients, event planners...',
    hint: 'Describe your target audience or customer profile.',
    required: true,
  },
  {
    field: 'communicationStyle',
    label: 'What communication style should your AI use?',
    placeholder: 'e.g. Warm and friendly, professional, casual...',
    hint: 'This defines the tone and personality of the AI.',
    required: false,
  },
  {
    field: 'languages',
    label: 'What languages should the AI respond in?',
    placeholder: 'e.g. English, Hindi, Tamil...',
    hint: 'List the languages your customers typically use.',
    required: false,
  },
  {
    field: 'specialRules',
    label: 'Any special rules or instructions?',
    placeholder: 'e.g. Never discuss competitors, always recommend calling for pricing...',
    hint: 'Optional: Specific do\'s and don\'ts for the AI.',
    required: false,
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentPersonality() {
  const { workspaceId } = useWorkspace();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);

  // Personality fields
  const [name, setName] = useState(mockAssistant.name);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [systemPrompt, setSystemPrompt] = useState(mockAssistant.systemPrompt);
  const [whatsappAdmins, setWhatsappAdmins] = useState('');
  const [telegramAdmins, setTelegramAdmins] = useState('');
  const [takeoverTimeout, setTakeoverTimeout] = useState(30);
  const [bossCode, setBossCode] = useState('');

  // Save states
  const [savedName, setSavedName] = useState(false);
  const [savedTimezone, setSavedTimezone] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState(false);
  const [savedBoss, setSavedBoss] = useState(false);

  // Build Persona modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<PersonaStep>(1);
  const [answers, setAnswers] = useState<PersonaAnswers>(EMPTY_ANSWERS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [editablePrompt, setEditablePrompt] = useState('');
  const [reviewMode, setReviewMode] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genErrorType, setGenErrorType] = useState<'no_provider' | 'server_config' | 'generation' | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      if (!workspaceId) return;
      let savedName = mockAssistant.name;
      let savedSysPrompt = mockAssistant.systemPrompt;
      let savedTz = 'Asia/Kolkata';
      let savedWa = '';
      let savedTg = '';
      let savedCode = '';
      let savedTimeout = 30;

      if (db) {
        try {
          const docRef = doc(db, 'workspaces', workspaceId, 'assistants', assistantId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            savedName = data.name || savedName;
            savedSysPrompt = data.systemPrompt || savedSysPrompt;
            savedTz = data.timezone || savedTz;
            savedWa = data.whatsappAdmins || savedWa;
            savedTg = data.telegramAdmins || savedTg;
            savedTimeout = data.takeoverTimeout || 30;
            if (data.bossCodeHash) savedCode = '••••••';
          }
        } catch (e) { console.error(e); }
      }

      // Dev fallback from localStorage
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('__dudo_dev_assistant');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            savedName = parsed.name || savedName;
            savedSysPrompt = parsed.systemPrompt || savedSysPrompt;
            savedTz = parsed.timezone || savedTz;
            savedWa = parsed.whatsappAdmins || savedWa;
            savedTg = parsed.telegramAdmins || savedTg;
            savedTimeout = parsed.takeoverTimeout || 30;
            if (parsed.bossCodeHash) savedCode = '••••••';
          } catch (e) {}
        }
      }

      setName(savedName);
      setSystemPrompt(savedSysPrompt);
      setTimezone(savedTz);
      setWhatsappAdmins(savedWa);
      setTelegramAdmins(savedTg);
      setTakeoverTimeout(savedTimeout);
      setBossCode(savedCode);
      setLoading(false);
    }
    loadData();
  }, [workspaceId]);

  // ─── Persistence ───────────────────────────────────────────────────────────

  const saveSection = async (fields: Record<string, any>, setSaveState: (b: boolean) => void) => {
    if (!workspaceId) return;
    if (db) {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'assistants', assistantId);
        await setDoc(docRef, fields, { merge: true });
      } catch (e) { console.error(e); }
    }

    if (typeof window !== 'undefined') {
      try {
        const existing = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
        localStorage.setItem('__dudo_dev_assistant', JSON.stringify({ ...existing, ...fields }));
      } catch (e) {}
      window.dispatchEvent(new Event('dudo-config-changed'));
    }

    setSaveState(true);
    setTimeout(() => setSaveState(false), 2000);
  };

  const handleSaveName = () => saveSection({ name: name.trim() }, setSavedName);
  const handleTimezoneChange = (val: string | null) => {
    if (!val) return;
    setTimezone(val);
    saveSection({ timezone: val }, setSavedTimezone);
  };
  const handleSavePrompt = () => saveSection({ systemPrompt: systemPrompt.trim() }, setSavedPrompt);
  const handleSaveBoss = () => {
    saveSection({
      whatsappAdmins: whatsappAdmins.trim(),
      telegramAdmins: telegramAdmins.trim(),
      takeoverTimeout: Number(takeoverTimeout) || 30,
    }, setSavedBoss);
  };

  const handleGenerateBossCode = async () => {
    if (!whatsappAdmins.trim() && !telegramAdmins.trim()) return;
    try {
      const token = currentUser ? await currentUser.getIdToken() : '';
      const res = await fetch('/api/agent/boss-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.code) setBossCode(data.code);
      } else {
        console.error('Failed to generate boss code:', await res.text());
      }
    } catch (e) { console.error(e); }
  };

  // ─── Build Persona Modal ───────────────────────────────────────────────────

  const openModal = () => {
    setStep(1);
    setAnswers(EMPTY_ANSWERS);
    setIsGenerating(false);
    setGenerationCount(0);
    setGeneratedPrompt('');
    setEditablePrompt('');
    setReviewMode(false);
    setGenError(null);
    setGenErrorType(null);
    setModalOpen(true);
    // Lock body scroll while modal is open
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    // Cancel: do NOT touch systemPrompt
    setModalOpen(false);
    document.body.style.overflow = '';
  };

  // Restore scroll on unmount in case modal is open
  useEffect(() => {
    return () => { document.body.style.overflow = ''; };
  }, []);

  const currentQuestion = QUESTIONS[step - 1];

  const handleNext = () => {
    // Validate required fields
    if (currentQuestion.required && !answers[currentQuestion.field].trim()) return;
    if (step < 6) {
      setStep((prev) => (prev + 1) as PersonaStep);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => (prev - 1) as PersonaStep);
  };

  const handleGenerate = async () => {
    if (generationCount >= MAX_GENERATIONS) return;
    setIsGenerating(true);
    setReviewMode(false);
    setGenError(null);
    setGenErrorType(null);

    try {
      const res = await fetch('/api/agent/generate-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, answers }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Server error (5xx) — do not count
        setGenError(data.error || 'Server error. Please try again.');
        setGenErrorType('generation');
        return;
      }

      if (data.error === 'NO_PROVIDER') {
        setGenError(data.message || 'No valid AI provider is configured.');
        setGenErrorType('no_provider');
        return; // no count consumed
      }

      if (data.error === 'SERVER_CONFIG_ERROR') {
        setGenError(data.message || 'Server configuration error.');
        setGenErrorType('server_config');
        return; // no count consumed
      }

      if (data.error === 'GENERATION_ERROR') {
        setGenError(data.message || 'Generation failed. Please try again.');
        setGenErrorType('generation');
        return; // do NOT increment count — failed request
      }

      if (data.error) {
        setGenError(data.error);
        setGenErrorType('generation');
        return; // do NOT increment count
      }

      if (!data.prompt) {
        setGenError('Empty response from AI. Please try again.');
        setGenErrorType('generation');
        return;
      }

      // Success — increment count
      const newCount = generationCount + 1;
      setGenerationCount(newCount);
      setGeneratedPrompt(data.prompt);
      setEditablePrompt(data.prompt);
      setReviewMode(true);

    } catch (err: unknown) {
      // Network-level failure — do NOT increment count
      const msg = err instanceof Error ? err.message : 'Network error. Please check your connection.';
      setGenError(msg);
      setGenErrorType('generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAndSave = async () => {
    const promptToSave = editablePrompt.trim();
    if (!promptToSave) return;

    // Update local state immediately
    setSystemPrompt(promptToSave);

    // Persist via existing saveSection path
    await saveSection({ systemPrompt: promptToSave }, () => {});

    // Close modal
    setModalOpen(false);

    // Visual feedback on the main prompt save button
    setSavedPrompt(true);
    setTimeout(() => setSavedPrompt(false), 2500);
  };

  const handleGoToApiKeys = () => {
    setModalOpen(false);
    window.dispatchEvent(new CustomEvent('dudo-switch-tab', { detail: 'api-keys' }));
  };

  const canGoNext = currentQuestion.required
    ? !!answers[currentQuestion.field].trim()
    : true;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-pulse">
        <div className="w-8 h-8 rounded-full border-2 border-[#22577A] border-t-transparent animate-spin" />
        <p className="text-xs text-zinc-400 font-semibold">Loading personality settings...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 select-none w-full max-w-[1200px] mx-auto">
      
      {/* Top Row: Name and Timezone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assistant Name */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Assistant Name</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">The display identity for user chats</p>
            </div>
            <Button
              onClick={handleSaveName}
              className="h-7.5 text-[10px] font-bold px-3.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md border-none cursor-pointer"
            >
              {savedName ? 'Saved!' : 'Save Name'}
            </Button>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My AI Assistant"
            className="h-8.5 text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 placeholder:text-zinc-400"
          />
        </div>

        {/* Timezone */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Timezone</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">Used for calculating working business hours</p>
            </div>
            {savedTimezone && (
              <span className="text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-md">
                Saved!
              </span>
            )}
          </div>
          <Select value={timezone} onValueChange={handleTimezoneChange}>
            <SelectTrigger className="h-8.5 text-xs border-zinc-200 w-full max-w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Row: System Prompt */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">System Prompt (Instructions)</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Instructions that control the AI's core behavior</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              onClick={openModal}
              className="h-7.5 text-[10px] border-zinc-200 font-bold text-[#22577A] border-[#22577A]/20 hover:text-[#1A4461] hover:bg-zinc-50 bg-white gap-1 cursor-pointer"
            >
              <Sparkles size={10} />
              Build Persona
            </Button>
            <Button
              onClick={handleSavePrompt}
              className="h-7.5 text-[10px] font-bold px-3.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md border-none cursor-pointer"
            >
              {savedPrompt ? 'Saved!' : 'Save Prompt'}
            </Button>
          </div>
        </div>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a helpful customer service receptionist..."
          className="text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white font-mono min-h-[140px] resize-y text-zinc-800 placeholder:text-zinc-400"
        />
      </div>

      {/* Bottom Row: Escalation & Boss Code */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-3.5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Escalation & Boss Code</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Notify admins and override chat using boss code</p>
          </div>
          <Button
            onClick={handleSaveBoss}
            className="h-7.5 text-[10px] font-bold px-3.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md border-none cursor-pointer"
          >
            {savedBoss ? 'Saved!' : 'Save Setup'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="wa-admins" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">WhatsApp Admin Phone</Label>
            <Input id="wa-admins" value={whatsappAdmins} onChange={(e) => setWhatsappAdmins(e.target.value)} placeholder="e.g. +919876543210" className="h-8.5 text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 placeholder:text-zinc-400" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tg-admins" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Telegram Admin Username</Label>
            <Input id="tg-admins" value={telegramAdmins} onChange={(e) => setTelegramAdmins(e.target.value)} placeholder="e.g. kishore_admin" className="h-8.5 text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 placeholder:text-zinc-400" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="takeover-timeout" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Auto-Resume Timeout</Label>
            <Input id="takeover-timeout" type="number" min={1} max={1440} value={takeoverTimeout} onChange={(e) => setTakeoverTimeout(parseInt(e.target.value) || 30)} className="h-8.5 text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 placeholder:text-zinc-400" />
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">Boss Code Override:</span>
            {bossCode ? (
              <span className="font-mono text-zinc-950 font-bold bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">{bossCode}</span>
            ) : (
              <span className="text-zinc-400 italic">Not generated yet</span>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleGenerateBossCode}
            className="h-7.5 text-[10px] border-zinc-200 font-bold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 bg-white cursor-pointer"
          >
            Generate Boss Code
          </Button>
        </div>
      </div>
    </div>

      {/* ─── Build Persona Modal ─────────────────────────────────────────────── */}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {/*
            Modal shell:
            - flex col so header + body + footer stack vertically
            - max-height locks it inside the viewport on all screen sizes
            - overflow-hidden so nothing bleeds outside the rounded corners
          */}
          <div
            className="
              relative flex flex-col bg-white rounded-2xl shadow-2xl border border-zinc-200/60
              w-full max-w-[calc(100vw-24px)] sm:max-w-2xl lg:max-w-[860px]
              max-h-[calc(100dvh-24px)] sm:max-h-[calc(100vh-48px)]
              overflow-hidden
              animate-in fade-in slide-in-from-bottom-4 duration-200
            "
          >

            {/* ── STICKY HEADER ───────────────────────────────────────────── */}
            <div className="flex-none px-5 sm:px-6 pt-5 pb-4 flex items-start justify-between border-b border-zinc-100 bg-white">
              <div className="flex-1 min-w-0 pr-4">
                {reviewMode ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-zinc-950 leading-tight">Generated Persona</h2>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#22577A]/10 text-[#22577A] border border-[#22577A]/20">
                      AI Generated
                    </span>
                    <span className="text-[9px] text-zinc-400 font-medium">
                      {generationCount} of {MAX_GENERATIONS} generations used
                    </span>
                  </div>
                ) : (
                  <h2 className="text-sm font-bold text-zinc-950">Build Persona</h2>
                )}
                {!reviewMode && (
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {isGenerating
                      ? 'Generating your persona with AI...'
                      : genError
                        ? 'Generation error — see details below'
                        : 'Answer 6 questions to generate a custom AI persona'}
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="flex-none text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer bg-transparent border-none p-0.5 rounded-lg hover:bg-zinc-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── SCROLLABLE BODY ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-5 sm:px-6 py-5">

              {isGenerating ? (
                /* Loading */
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 space-y-4">
                  <div className="w-10 h-10 rounded-full border-2 border-[#22577A] border-t-transparent animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-zinc-800">Generating your persona...</p>
                    <p className="text-xs text-zinc-400 mt-1">This usually takes a few seconds</p>
                  </div>
                </div>

              ) : genError && !reviewMode ? (
                /* Error */
                <div
                  className={cn(
                    'flex gap-3 p-4 rounded-xl border',
                    genErrorType === 'no_provider' ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'
                  )}
                >
                  <AlertCircle size={16} className={cn('shrink-0 mt-0.5', genErrorType === 'no_provider' ? 'text-orange-500' : 'text-red-500')} />
                  <div>
                    <p className={cn('text-xs font-semibold', genErrorType === 'no_provider' ? 'text-orange-800' : 'text-red-800')}>
                      {genErrorType === 'no_provider' ? 'No AI Provider Configured' : 'Generation Failed'}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">{genError}</p>
                  </div>
                </div>

              ) : reviewMode ? (
                /* Review: editable textarea */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold text-zinc-700">System Prompt</Label>
                    <span className="text-[10px] text-zinc-400">Edit before applying</span>
                  </div>
                  {/*
                    Textarea:
                    - h-[350px] sm:h-[420px] — fixed height, never grows
                    - overflow-y-auto — scrolls internally for long content
                    - resize-y — user can drag to resize within the modal body
                  */}
                  <textarea
                    ref={textareaRef}
                    value={editablePrompt}
                    onChange={(e) => setEditablePrompt(e.target.value)}
                    className="
                      w-full h-[300px] sm:h-[380px] lg:h-[420px]
                      text-xs font-mono leading-relaxed
                      border border-zinc-200 rounded-xl
                      bg-white text-zinc-800
                      px-3 py-3
                      overflow-y-auto resize-y
                      focus:outline-none focus:ring-2 focus:ring-[#22577A]/30 focus:border-[#22577A]/60
                      transition-shadow
                    "
                    style={{ minHeight: '200px', maxHeight: '60vh' }}
                    spellCheck={false}
                  />
                  {/* Generation dots */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                    <span>Characters: {editablePrompt.length.toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      <span>Generations:</span>
                      <div className="flex gap-1">
                        {Array.from({ length: MAX_GENERATIONS }).map((_, i) => (
                          <div
                            key={i}
                            className={cn('w-2 h-2 rounded-full transition-colors', i < generationCount ? 'bg-[#22577A]' : 'bg-zinc-200')}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              ) : (
                /* 6-step question wizard */
                <div className="space-y-5">
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                      <span>Step {step} of 6</span>
                      <span>{Math.round((step / 6) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22577A] rounded-full transition-all duration-300"
                        style={{ width: `${(step / 6) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Question */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-zinc-800 leading-snug">
                      {currentQuestion.label}
                      {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <p className="text-[10px] text-zinc-400">{currentQuestion.hint}</p>
                    <Textarea
                      value={answers[currentQuestion.field]}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.field]: e.target.value }))}
                      placeholder={currentQuestion.placeholder}
                      className="text-xs border-zinc-200 focus-visible:ring-[#22577A] bg-white min-h-[90px] resize-none text-zinc-800 placeholder:text-zinc-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canGoNext) handleNext(); }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── STICKY FOOTER ───────────────────────────────────────────── */}
            <div className="flex-none px-5 sm:px-6 py-4 border-t border-zinc-100 bg-white">

              {/* Error action buttons */}
              {genError && !reviewMode && !isGenerating && (
                <div className="flex flex-wrap gap-2 justify-end">
                  {genErrorType === 'no_provider' && (
                    <Button
                      onClick={handleGoToApiKeys}
                      className="h-8 text-[10px] font-bold px-4 bg-[#22577A] hover:bg-[#1A4461] text-white rounded-lg border-none cursor-pointer gap-1.5"
                    >
                      <Key size={11} />
                      Go to API Keys
                    </Button>
                  )}
                  {genErrorType === 'generation' && generationCount < MAX_GENERATIONS && (
                    <Button
                      onClick={handleGenerate}
                      className="h-8 text-[10px] font-bold px-4 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg border-none cursor-pointer gap-1.5"
                    >
                      <RefreshCw size={11} />
                      Try Again
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => { setGenError(null); setGenErrorType(null); }}
                    className="h-8 text-[10px] font-bold px-4 border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                  >
                    Back to Questions
                  </Button>
                </div>
              )}

              {/* Review footer */}
              {reviewMode && !isGenerating && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={closeModal}
                      className="h-8 text-[10px] font-bold px-3 border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleGenerate}
                      disabled={generationCount >= MAX_GENERATIONS}
                      className="h-8 text-[10px] font-bold px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-40 gap-1.5"
                    >
                      <RefreshCw size={11} />
                      Regenerate
                      {generationCount >= MAX_GENERATIONS && (
                        <span className="text-[9px] text-zinc-400">(limit reached)</span>
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={handleApplyAndSave}
                    disabled={!editablePrompt.trim()}
                    className="h-8 text-[10px] font-bold px-4 bg-[#22577A] hover:bg-[#1A4461] text-white rounded-lg border-none cursor-pointer gap-1.5 disabled:opacity-40"
                  >
                    <Check size={11} />
                    Apply & Save
                  </Button>
                </div>
              )}

              {/* Wizard navigation footer */}
              {!reviewMode && !isGenerating && !genError && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={step === 1}
                    className="h-8 text-[10px] font-bold px-3 border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer disabled:opacity-40 gap-1"
                  >
                    <ChevronLeft size={13} />
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canGoNext}
                    className="h-8 text-[10px] font-bold px-4 bg-[#22577A] hover:bg-[#1A4461] text-white rounded-lg border-none cursor-pointer disabled:opacity-40 gap-1"
                  >
                    {step === 6 ? (<><Sparkles size={11} />Generate Persona</>) : (<>Next<ChevronRight size={13} /></>)}
                  </Button>
                </div>
              )}

              {/* Loading footer — just Cancel */}
              {isGenerating && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    className="h-8 text-[10px] font-bold px-3 border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
