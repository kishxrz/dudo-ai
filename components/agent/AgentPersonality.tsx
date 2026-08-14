'use client';

import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { mockAssistant } from '@/services/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Sparkles, X, ChevronLeft, ChevronRight, RefreshCw, Check, AlertCircle, Key,
  Shield, Activity, CheckCircle2, Lock, Unlock, ShieldCheck, Eye, EyeOff, Copy, Trash2, HelpCircle
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { 
  EmailAuthProvider, 
  GoogleAuthProvider, 
  reauthenticateWithCredential, 
  reauthenticateWithPopup,
  getAuth
} from 'firebase/auth';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import SaveButton from '@/components/ui/SaveButton';

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
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  // Personality fields
  const [name, setName] = useState(mockAssistant.name);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [systemPrompt, setSystemPrompt] = useState(mockAssistant.systemPrompt);
  const [whatsappAdmins, setWhatsappAdmins] = useState('');
  const [telegramAdmins, setTelegramAdmins] = useState('');
  const [bossCode, setBossCode] = useState('');
  const [sttProvider, setSttProvider] = useState('openai');
  const [ttsProvider, setTtsProvider] = useState('openai');
  const [ttsVoice, setTtsVoice] = useState('nova');
  const [speakingStyle, setSpeakingStyle] = useState('friendly');

  // Database values tracker
  const [dbName, setDbName] = useState(mockAssistant.name);
  const [dbTimezone, setDbTimezone] = useState('Asia/Kolkata');
  const [dbSystemPrompt, setDbSystemPrompt] = useState(mockAssistant.systemPrompt);
  const [dbWhatsappAdmins, setDbWhatsappAdmins] = useState('');
  const [dbTelegramAdmins, setDbTelegramAdmins] = useState('');
  const [dbSttProvider, setDbSttProvider] = useState('openai');
  const [dbTtsProvider, setDbTtsProvider] = useState('openai');
  const [dbTtsVoice, setDbTtsVoice] = useState('nova');
  const [dbSpeakingStyle, setDbSpeakingStyle] = useState('friendly');

  // Boss Access states
  const [bossCodeStatus, setBossCodeStatus] = useState<'not_generated' | 'active' | 'expired' | 'linked' | 'revoked'>('not_generated');
  const [bossExpiresAt, setBossExpiresAt] = useState<number | null>(null);
  const [bossCodePlain, setBossCodePlain] = useState<string>('');
  const [bossCodeVisible, setBossCodeVisible] = useState(false);
  const [bossOwnerPlatform, setBossOwnerPlatform] = useState<string | null>(null);
  const [bossOwnerNumber, setBossOwnerNumber] = useState<string | null>(null);
  const [bossOwnerLinkedAt, setBossOwnerLinkedAt] = useState<string | null>(null);
  const [bossAccessEnabled, setBossAccessEnabled] = useState(true);
  const [codeAgeStr, setCodeAgeStr] = useState('');
  const [codeExpiryStr, setCodeExpiryStr] = useState('');
  const [bossCodeCreatedAt, setBossCodeCreatedAt] = useState<number | null>(null);
  const [showRegenNotice, setShowRegenNotice] = useState(false);

  // Validation states
  const [waValidation, setWaValidation] = useState<'valid' | 'invalid' | 'idle'>('idle');
  const [tgValidation, setTgValidation] = useState<'valid' | 'invalid' | 'idle'>('idle');
  const [hasDuplication, setHasDuplication] = useState(false);

  // Lockout states
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Modal states
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState('');

  // Pending action after re-auth
  const [pendingAction, setPendingAction] = useState<(() => Promise<void> | void) | null>(null);

  // Danger Zone confirmation modals
  const [showDangerConfirm, setShowDangerConfirm] = useState<'unlink' | 'disable' | 'regenerate' | null>(null);
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  // Audit Logs timeline
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Last successful re-auth timestamp
  const [lastAuthTime, setLastAuthTime] = useState<number>(0);

  // Subscription context
  const { isActive: isSubscriptionActive } = useSubscriptionContext();

  // Computed Save states
  const savedName = name.trim() === dbName.trim();
  const savedTimezone = timezone === dbTimezone;
  const savedPrompt = systemPrompt.trim() === dbSystemPrompt.trim();
  const savedBoss = whatsappAdmins.trim() === dbWhatsappAdmins.trim() &&
                    telegramAdmins.trim() === dbTelegramAdmins.trim();
  const savedVoice = sttProvider === dbSttProvider &&
                     ttsProvider === dbTtsProvider &&
                     ttsVoice === dbTtsVoice &&
                     speakingStyle.trim() === dbSpeakingStyle.trim();

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

  // Refs to track dirty states to prevent database updates from reverting unsaved local input edits
  const isWaDirtyRef = useRef(false);
  const isTgDirtyRef = useRef(false);
  isWaDirtyRef.current = whatsappAdmins.trim() !== dbWhatsappAdmins.trim();
  isTgDirtyRef.current = telegramAdmins.trim() !== dbTelegramAdmins.trim();

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

      let loadedFromDb = false;

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
            if (data.bossCodeHash) savedCode = '••••••';

            if (data.sttProvider) {
              setSttProvider(data.sttProvider);
              setDbSttProvider(data.sttProvider);
            }
            if (data.ttsProvider) {
              setTtsProvider(data.ttsProvider);
              setDbTtsProvider(data.ttsProvider);
            }
            if (data.ttsVoice) {
              setTtsVoice(data.ttsVoice);
              setDbTtsVoice(data.ttsVoice);
            }
            if (data.speakingStyle) {
              setSpeakingStyle(data.speakingStyle);
              setDbSpeakingStyle(data.speakingStyle);
            }
            loadedFromDb = true;
          }
        } catch (e) { console.error(e); }
      }

      // Dev fallback from localStorage
      if (!loadedFromDb && typeof window !== 'undefined') {
        const local = localStorage.getItem('__dudo_dev_assistant');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            savedName = parsed.name || savedName;
            savedSysPrompt = parsed.systemPrompt || savedSysPrompt;
            savedTz = parsed.timezone || savedTz;
            savedWa = parsed.whatsappAdmins || savedWa;
            savedTg = parsed.telegramAdmins || savedTg;
            if (parsed.bossCodeHash) savedCode = '••••••';

            if (parsed.sttProvider) {
              setSttProvider(parsed.sttProvider);
              setDbSttProvider(parsed.sttProvider);
            }
            if (parsed.ttsProvider) {
              setTtsProvider(parsed.ttsProvider);
              setDbTtsProvider(parsed.ttsProvider);
            }
            if (parsed.ttsVoice) {
              setTtsVoice(parsed.ttsVoice);
              setDbTtsVoice(parsed.ttsVoice);
            }
            if (parsed.speakingStyle) {
              setSpeakingStyle(parsed.speakingStyle);
              setDbSpeakingStyle(parsed.speakingStyle);
            }
          } catch (e) {}
        }
      }

      setName(savedName);
      setDbName(savedName);
      setSystemPrompt(savedSysPrompt);
      setDbSystemPrompt(savedSysPrompt);
      setTimezone(savedTz);
      setDbTimezone(savedTz);
      setWhatsappAdmins(savedWa);
      setDbWhatsappAdmins(savedWa);
      setTelegramAdmins(savedTg);
      setDbTelegramAdmins(savedTg);
      setBossCode(savedCode);
      setLoading(false);
    }
    loadData();
  }, [workspaceId]);

  // Real-time Firestore subscriptions for Boss Access and Takeover Audits
  useEffect(() => {
    if (!db || !workspaceId) return;
    const docRef = doc(db, 'workspaces', workspaceId, 'assistants', 'assistant-1');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const latestWa = data.whatsappAdmins || '';
        setDbWhatsappAdmins(latestWa);
        if (!isWaDirtyRef.current) {
          setWhatsappAdmins(latestWa);
        }

        const latestTg = data.telegramAdmins || '';
        setDbTelegramAdmins(latestTg);
        if (!isTgDirtyRef.current) {
          setTelegramAdmins(latestTg);
        }

        setBossOwnerPlatform(data.bossOwnerPlatform || null);
        setBossOwnerNumber(data.bossOwnerNumber || null);

        let linkedAtStr = 'Never';
        if (data.bossOwnerLinkedAt) {
          const d = data.bossOwnerLinkedAt.toDate ? data.bossOwnerLinkedAt.toDate() : new Date(data.bossOwnerLinkedAt);
          linkedAtStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
                        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' IST';
        }
        setBossOwnerLinkedAt(linkedAtStr);

        if (data.bossAccessLockedUntil) {
          const lockedUntil = data.bossAccessLockedUntil.toDate ? data.bossAccessLockedUntil.toDate().getTime() : new Date(data.bossAccessLockedUntil).getTime();
          if (lockedUntil > Date.now()) {
            setIsLockedOut(true);
            setLockoutRemaining(lockedUntil - Date.now());
          } else {
            setIsLockedOut(false);
          }
        } else {
          setIsLockedOut(false);
        }

        setBossCodeStatus(data.bossCodeStatus || 'not_generated');
        if (data.bossCodeExpiresAt) {
          const exp = data.bossCodeExpiresAt.toDate ? data.bossCodeExpiresAt.toDate().getTime() : new Date(data.bossCodeExpiresAt).getTime();
          setBossExpiresAt(exp);
        } else {
          setBossExpiresAt(null);
        }

        if (data.bossCodeCreatedAt) {
          const cat = data.bossCodeCreatedAt.toDate ? data.bossCodeCreatedAt.toDate().getTime() : new Date(data.bossCodeCreatedAt).getTime();
          setBossCodeCreatedAt(cat);
        } else {
          setBossCodeCreatedAt(null);
        }

        setBossAccessEnabled(data.bossAccessEnabled !== false);
      }
    }, (err) => {
      console.warn("Failed to subscribe to assistant configs:", err);
    });
    return () => unsubscribe();
  }, [workspaceId]);

  // Real-time Firestore Audit Logs subscription
  useEffect(() => {
    if (!db || !workspaceId) return;
    const q = query(
      collection(db, 'workspaces', workspaceId, 'takeover_audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const logsList: any[] = [];
      snap.forEach((docSnap) => {
        logsList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAuditLogs(logsList);
    }, (err) => {
      try {
        const localLogs = JSON.parse(localStorage.getItem(`__dudo_audit_logs_${workspaceId}`) || '[]');
        setAuditLogs(localLogs);
      } catch (e) {}
    });
    return () => unsubscribe();
  }, [workspaceId]);

  // Real-time local input validators
  useEffect(() => {
    const phone = whatsappAdmins.trim();
    if (!phone) {
      setWaValidation('idle');
    } else {
      const allValid = phone.split(',').every(num => /^\+[1-9]\d{1,14}$/.test(num.trim()));
      setWaValidation(allValid ? 'valid' : 'invalid');
    }

    const tgIds = telegramAdmins.trim();
    if (!tgIds) {
      setTgValidation('idle');
    } else {
      const allValid = tgIds.split(',').every(id => /^\d+$/.test(id.trim()));
      setTgValidation(allValid ? 'valid' : 'invalid');
    }

    setHasDuplication(false); // Duplicates are handled at item split level
  }, [whatsappAdmins, telegramAdmins]);

  // Countdown timers loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (bossCodeStatus === 'active' && bossExpiresAt) {
        const diff = bossExpiresAt - Date.now();
        if (diff <= 0) {
          setBossCodeStatus('expired');
          setCodeExpiryStr('');
          setCodeAgeStr('');
        } else {
          const totalSecs = Math.floor(diff / 1000);
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          setCodeExpiryStr(`Expires in ${mins}m ${secs}s`);

          if (bossCodeCreatedAt) {
            const ageMs = Date.now() - bossCodeCreatedAt;
            const ageSecs = Math.floor(ageMs / 1000);
            const ageMins = Math.floor(ageSecs / 60);
            if (ageMins === 0) {
              setCodeAgeStr('Generated just now');
            } else {
              setCodeAgeStr(`Generated ${ageMins} minute${ageMins !== 1 ? 's' : ''} ago`);
            }
          } else {
            setCodeAgeStr('');
          }
        }
      } else {
        setCodeExpiryStr('');
        setCodeAgeStr('');
      }

      if (isLockedOut && lockoutRemaining > 0) {
        setLockoutRemaining((prev) => {
          const next = prev - 1000;
          if (next <= 0) {
            setIsLockedOut(false);
            // Request server clear failures
            const token = currentUser ? currentUser.getIdToken() : Promise.resolve('');
            token.then(t => {
              fetch('/api/agent/boss-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
                body: JSON.stringify({ workspaceId, action: 'clear-lockout' })
              });
            });
            return 0;
          }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [bossCodeStatus, bossExpiresAt, bossCodeCreatedAt, isLockedOut, lockoutRemaining, workspaceId, currentUser]);

  // Abstracted Re-authentication flow
  const verifySessionRecency = async (onVerified: () => Promise<void> | void) => {
    const ageInMs = Date.now() - lastAuthTime;
    if (ageInMs < 300000 && lastAuthTime > 0) { // 5 minutes cache
      await onVerified();
      return;
    }

    if (!currentUser) return;
    const providerId = currentUser.providerData[0]?.providerId || 'password';

    if (providerId === 'google.com') {
      try {
        const auth = getAuth();
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(currentUser, provider);
        setLastAuthTime(Date.now());
        await onVerified();
      } catch (err) {
        console.error(err);
      }
    } else {
      setPendingAction(() => onVerified);
      setShowReauthModal(true);
    }
  };

  const handleReauthPasswordSubmit = async () => {
    if (!currentUser) return;
    setReauthLoading(true);
    setReauthError('');
    try {
      const credential = EmailAuthProvider.credential(currentUser.email!, reauthPassword);
      await reauthenticateWithCredential(currentUser, credential);
      setLastAuthTime(Date.now());
      setShowReauthModal(false);
      setReauthPassword('');
      if (pendingAction) {
        await pendingAction();
        setPendingAction(null);
      }
    } catch (err: any) {
      setReauthError(err.message || 'Incorrect password.');
    } finally {
      setReauthLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    if (ms <= 0) return '00:00';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // ─── Persistence ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveSection = async (fields: Record<string, any>, onSaved: () => void) => {
    if (!workspaceId) return;
    if (db) {
      try {
        const docRef = doc(db, 'workspaces', workspaceId, 'assistants', assistantId);
        await setDoc(docRef, fields, { merge: true });
      } catch (e) {
        console.error(e);
        throw e;
      }
    }

    if (typeof window !== 'undefined') {
      try {
        const existing = JSON.parse(localStorage.getItem('__dudo_dev_assistant') || '{}');
        localStorage.setItem('__dudo_dev_assistant', JSON.stringify({ ...existing, ...fields }));
      } catch (e) {}
      window.dispatchEvent(new Event('dudo-config-changed'));
    }

    onSaved();
  };

  const handleSaveName = () => saveSection({ 
    name: name.trim(),
    generalCompleted: true,
    'setupProgress.generalCompleted': true
  }, () => setDbName(name.trim()));
  const handleTimezoneChange = (val: string | null) => {
    if (!val) return;
    setTimezone(val);
    saveSection({ timezone: val }, () => setDbTimezone(val));
  };
  const handleSavePrompt = () => saveSection({ 
    systemPrompt: systemPrompt.trim(),
    generalCompleted: true,
    'setupProgress.generalCompleted': true
  }, () => setDbSystemPrompt(systemPrompt.trim()));
  const handleSaveBoss = async () => {

    try {
      const data = await apiCall('save-admins', {
        whatsappAdmins: whatsappAdmins.trim(),
        telegramAdmins: telegramAdmins.trim()
      });
      if (data.success) {
        setWhatsappAdmins(data.whatsappAdmins);
        setDbWhatsappAdmins(data.whatsappAdmins);
        setTelegramAdmins(data.telegramAdmins);
        setDbTelegramAdmins(data.telegramAdmins);
        toast.success('Boss Access Saved', 'Your security settings have been updated.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save security settings.');
    }
  };

  const handleSaveVoice = () => {
    saveSection({
      sttProvider,
      ttsProvider,
      ttsVoice,
      speakingStyle: speakingStyle.trim(),
    }, () => {
      setDbSttProvider(sttProvider);
      setDbTtsProvider(ttsProvider);
      setDbTtsVoice(ttsVoice);
      setDbSpeakingStyle(speakingStyle.trim());
    });
  };

  const apiCall = async (
    action: 'generate' | 'reveal' | 'unlink' | 'regenerate-all' | 'disable' | 'enable' | 'save-admins',
    extraBody: any = {}
  ) => {
    try {
      const token = currentUser ? await currentUser.getIdToken() : '';
      const res = await fetch('/api/agent/boss-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId, action, ...extraBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'STALE_SESSION') {
          setLastAuthTime(0);
          throw new Error('STALE_SESSION');
        }
        if (data.error === 'LOCKED') {
          setIsLockedOut(true);
        }
        throw new Error(data.message || data.error || 'Request failed');
      }
      return data;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  };

  const handleGenerateBossCode = async () => {
    if (waValidation === 'invalid' || tgValidation === 'invalid') {
      toast.error('Please resolve validation errors first.');
      return;
    }
    try {
      const data = await apiCall('generate');
      if (data.code) {
        setBossCodePlain(data.code);
        setBossCodeVisible(true);
        setShowRegenNotice(true);
        toast.success('Boss Link Code Generated', 'Valid for 15 minutes.');
      }
    } catch (err: any) {
      if (err.message === 'STALE_SESSION') {
        await verifySessionRecency(() => handleGenerateBossCode());
      } else {
        toast.error(err.message || 'Failed to generate code.');
      }
    }
  };

  const handleRevealBossCode = async () => {
    try {
      const data = await apiCall('reveal');
      if (data.code) {
        setBossCodePlain(data.code);
        setBossCodeVisible(true);
      }
    } catch (err: any) {
      if (err.message === 'STALE_SESSION') {
        await verifySessionRecency(() => handleRevealBossCode());
      } else {
        toast.error(err.message || 'Reveal failed.');
      }
    }
  };

  const handleUnlinkBoss = async () => {
    try {
      await apiCall('unlink');
      toast.success('Boss Unlinked', 'Owner link has been disconnected.');
      setBossCodePlain('');
      setBossCodeVisible(false);
      setShowRegenNotice(false);
    } catch (err: any) {
      if (err.message === 'STALE_SESSION') {
        await verifySessionRecency(() => handleUnlinkBoss());
      } else {
        toast.error(err.message || 'Unlink failed.');
      }
    }
  };

  const handleRegenerateAll = async () => {
    try {
      await apiCall('regenerate-all');
      toast.success('Boss Codes Revoked', 'All codes have been invalidated.');
      setBossCodePlain('');
      setBossCodeVisible(false);
      setShowRegenNotice(false);
    } catch (err: any) {
      if (err.message === 'STALE_SESSION') {
        await verifySessionRecency(() => handleRegenerateAll());
      } else {
        toast.error(err.message || 'Revoke failed.');
      }
    }
  };

  const handleDisableBossAccess = async () => {
    try {
      await apiCall('disable');
      toast.success('Boss Access Disabled', 'Boss override mode turned off.');
      setBossCodePlain('');
      setBossCodeVisible(false);
      setShowRegenNotice(false);
    } catch (err: any) {
      if (err.message === 'STALE_SESSION') {
        await verifySessionRecency(() => handleDisableBossAccess());
      } else {
        toast.error(err.message || 'Disable failed.');
      }
    }
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
    await saveSection({ systemPrompt: promptToSave }, () => {
      setDbSystemPrompt(promptToSave);
    });

    // Close modal
    setModalOpen(false);
  };

  const handleGoToApiKeys = () => {
    setModalOpen(false);
    window.dispatchEvent(new CustomEvent('dudo-switch-tab', { detail: 'api-keys' }));
  };

  const canGoNext = currentQuestion.required
    ? !!answers[currentQuestion.field].trim()
    : true;

  const getStatusBadge = () => {
    if (!bossAccessEnabled) {
      return (
        <span className="font-extrabold text-red-700 bg-red-50 border border-red-150 px-2.5 py-0.5 rounded-full text-[9px] leading-none inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Disabled
        </span>
      );
    }
    if (bossOwnerPlatform) {
      return (
        <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2.5 py-0.5 rounded-full text-[9px] leading-none inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Linked
        </span>
      );
    }
    if (bossCodeStatus === 'active') {
      return (
        <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-150 px-2.5 py-0.5 rounded-full text-[9px] leading-none inline-flex items-center gap-1 animate-pulse">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" /> Waiting for Verification
        </span>
      );
    }
    if (bossCodeStatus === 'expired') {
      return (
        <span className="font-extrabold text-zinc-500 bg-zinc-50 border border-zinc-200 px-2.5 py-0.5 rounded-full text-[9px] leading-none inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full" /> Verification Expired
        </span>
      );
    }
    if (bossCodeStatus === 'revoked') {
      return (
        <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-150 px-2.5 py-0.5 rounded-full text-[9px] leading-none inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Revoked
        </span>
      );
    }
    return (
      <span className="font-extrabold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full text-[9px] leading-none inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full" /> Not Linked
      </span>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading personality settings..." />;
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
            <SaveButton
              onClick={handleSaveName}
              isDirty={!savedName}
              label="Save Name"
              successToastTitle="Agent name updated"
              successToastDescription="Your changes have been saved."
              className="h-7.5 text-[10px] font-bold px-3.5 rounded-md"
            />
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John"
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
            <SelectTrigger className="h-8.5 text-xs border-zinc-200 w-full">
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
            <p className="text-[10px] text-zinc-400 mt-0.5">Instructions that control the AI&apos;s core behavior</p>
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
            <SaveButton
              onClick={handleSavePrompt}
              isDirty={!savedPrompt}
              label="Save Prompt"
              successToastTitle="System prompt updated"
              successToastDescription="Your changes have been saved."
              className="h-7.5 text-[10px] font-bold px-3.5 rounded-md"
            />
          </div>
        </div>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Your System Prompt"
          className="text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white font-mono min-h-[140px] resize-y text-zinc-800 placeholder:text-zinc-400"
        />
      </div>

      {/* Bottom Row: 🔒 Boss Access */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-zinc-150 pb-3">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[#22577A] shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Boss Access</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5 font-medium">Secure owner authentication and emergency control for your AI Employee.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!bossAccessEnabled && (
              <Button
                onClick={async () => {
                  try {
                    await apiCall('enable');
                    toast.success('Boss Access Enabled', 'Owners can now verify and manage takeover commands.');
                  } catch (e: any) {
                    toast.error(e.message || 'Failed to enable Boss Access.');
                  }
                }}
                className="h-7.5 text-[10px] font-bold px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md border-none cursor-pointer"
              >
                Enable Boss Access
              </Button>
            )}
            <SaveButton
              onClick={handleSaveBoss}
              isDirty={!savedBoss}
              label="Save Setup"
              successToastTitle="Boss Access Saved"
              successToastDescription="Your security settings have been updated."
              className="h-7.5 text-[10px] font-bold px-3.5 rounded-md"
            />
          </div>
        </div>

        {/* Security & Status Card */}
        <div className="bg-zinc-50/70 border border-zinc-150 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs select-none">
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Security Level</span>
            <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1 text-[9px] leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Enterprise Protected
            </span>
          </div>
          <div className="space-y-1 border-l border-zinc-200/60">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Owner Status</span>
            {getStatusBadge()}
          </div>
          <div className="space-y-1 border-l border-zinc-200/60">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Last Linked</span>
            <span className="font-bold text-zinc-700 block text-[10px] truncate leading-none pt-0.5">
              {bossOwnerPlatform ? bossOwnerLinkedAt : 'Never'}
            </span>
          </div>
        </div>

        {/* Disabled warning banner */}
        {!bossAccessEnabled && (
          <div className="bg-red-50 border border-red-150 rounded-xl p-3 flex items-start gap-2.5 select-none">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={16} />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-red-950">Boss Access Disabled</h4>
              <p className="text-[10px] text-red-700 leading-normal font-medium">
                Managers cannot run takeover commands or verify ownership. Enable Boss Access above to restore controls.
              </p>
            </div>
          </div>
        )}

        {/* Owner Dashboard Information */}
        {bossOwnerPlatform && (
          <div className="bg-zinc-50/60 border border-zinc-200 rounded-xl p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
              👤 Owner Verification Details
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Linked Platform</span>
                <span className="font-bold text-zinc-800 block pt-0.5">
                  {bossOwnerPlatform === 'whatsapp' ? 'WhatsApp Business' : 'Telegram Bot API'}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Linked Account ID</span>
                <span className="font-mono text-zinc-850 font-bold block pt-0.5">{bossOwnerNumber}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Linked Since</span>
                <span className="font-semibold text-zinc-600 block pt-0.5">{bossOwnerLinkedAt}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Verification Method</span>
                <span className="font-semibold text-zinc-650 block pt-0.5">
                  {bossOwnerPlatform === 'whatsapp' ? 'Verified Sender JID' : 'Webhook Caller UID'}
                </span>
              </div>
              <div className="space-y-0.5 pt-2">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Last Verified</span>
                <span className="font-semibold text-zinc-600 block pt-0.5">
                  {auditLogs.find(log => log.action?.toLowerCase().includes('verified') || log.action?.toLowerCase().includes('linked'))
                    ? (() => {
                        const l = auditLogs.find(log => log.action?.toLowerCase().includes('verified') || log.action?.toLowerCase().includes('linked'));
                        const date = l.timestamp?.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
                        return date.toLocaleDateString('en-IN') + ' ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
                      })()
                    : 'Instant via Webhook'}
                </span>
              </div>
              <div className="space-y-0.5 pt-2">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Last Command Used</span>
                <span className="font-mono text-zinc-600 font-semibold truncate block max-w-full pt-0.5">
                  {auditLogs.find(log => ['takeover_activated', 'takeover_deactivated', 'takeover_activated_details', 'takeover_deactivated_details'].includes(log.action))?.action
                    ? auditLogs.find(log => ['takeover_activated', 'takeover_deactivated', 'takeover_activated_details', 'takeover_deactivated_details'].includes(log.action)).action.replace('_details', '').toUpperCase()
                    : 'None recorded'}
                </span>
              </div>
              <div className="space-y-0.5 pt-2">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Boss Code Status</span>
                <span className="font-semibold text-emerald-700 block pt-0.5 font-bold">Consumed</span>
              </div>
              <div className="space-y-0.5 pt-2">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Code Expiry</span>
                <span className="font-semibold text-zinc-500 block pt-0.5">Expired (Used)</span>
              </div>
            </div>
          </div>
        )}

        {/* Inputs */}
        <div className="flex flex-col gap-6">
          <div className="space-y-1">
            <Label htmlFor="wa-admins" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Admin WhatsApp Number</Label>
            <Input 
              id="wa-admins" 
              value={whatsappAdmins} 
              onChange={(e) => setWhatsappAdmins(e.target.value)} 
              placeholder="+91XXXXXXXXXX" 
              className={cn(
                "h-8.5 text-xs border-zinc-200 focus-visible:ring-[#22577A] bg-white text-zinc-800 placeholder:text-zinc-400 max-w-md",
                waValidation === 'invalid' && "border-red-300 focus-visible:ring-red-500"
              )} 
            />
            {waValidation === 'valid' && <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">✓ Valid Format</span>}
            {waValidation === 'invalid' && <span className="text-[10px] text-red-600 font-bold block mt-0.5">❌ Please include your country code. Example: +91XXXXXXXXXX</span>}
            <span className="text-[11px] text-zinc-500 leading-normal block font-medium pt-1 max-w-2xl">
              Backup verification. Add your WhatsApp number including country code to help identify ownership if automatic linking fails.
            </span>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="tg-admins" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Telegram Numeric ID</Label>
            <Input 
              id="tg-admins" 
              value={telegramAdmins} 
              onChange={(e) => setTelegramAdmins(e.target.value)} 
              placeholder="123456789" 
              className={cn(
                "h-8.5 text-xs border-zinc-200 focus-visible:ring-[#22577A] bg-white text-zinc-800 placeholder:text-zinc-400 max-w-md",
                tgValidation === 'invalid' && "border-red-300 focus-visible:ring-red-500"
              )} 
            />
            {tgValidation === 'valid' && <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">✓ Valid Format</span>}
            {tgValidation === 'invalid' && <span className="text-[10px] text-red-600 font-bold block mt-0.5">❌ Telegram ID should contain numbers only.</span>}
            <span className="text-[11px] text-zinc-500 leading-normal block font-medium pt-1 max-w-2xl">
              Backup verification. Enter your numeric ID (not username). Send <span className="font-mono">/whoami</span> to your AI Employee or use <span className="font-mono">@userinfobot</span> to get it.
            </span>
          </div>
        </div>

        {/* Lockout banner if active */}
        {isLockedOut && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2.5 select-none animate-shake">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={16} />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-red-950">🚫 Boss Access Locked</h4>
              <p className="text-[10px] text-red-700 leading-normal">
                Too many failed authentication attempts. Retry in <span className="font-mono font-extrabold">{formatTime(lockoutRemaining)}</span>
              </p>
            </div>
          </div>
        )}

        {/* Boss Link Code (Recommended) Card */}
        {bossAccessEnabled && !bossOwnerPlatform && (
          <div className="bg-[#22577A]/5 border border-[#22577A]/15 rounded-xl p-4 space-y-3.5">
            <div className="flex justify-between items-start flex-col sm:flex-row gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-[#22577A] uppercase tracking-wider block">Boss Link Code (Recommended)</span>
                <p className="text-[10px] text-[#22577A]/80 leading-normal font-medium max-w-xl">
                  Send this exact code to your AI Employee from your own WhatsApp or Telegram account. Once verified, your AI Employee will permanently recognize you as the owner.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={isLockedOut || waValidation === 'invalid' || tgValidation === 'invalid'}
                onClick={handleGenerateBossCode}
                title={waValidation === 'invalid' || tgValidation === 'invalid' ? 'Please resolve validation errors first' : ''}
                className="h-7.5 text-[10px] border-[#22577A]/20 font-extrabold text-[#22577A] hover:bg-[#22577A]/5 flex items-center gap-1 cursor-pointer bg-white disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <RefreshCw size={11} /> {bossCodeStatus === 'active' ? 'Regenerate Link Code' : 'Generate Link Code'}
              </Button>
            </div>

            {bossCodeStatus === 'active' && (
              <div className="bg-white border border-[#22577A]/10 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Verification Code</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-800 font-extrabold text-base tracking-wider block select-all">
                      {bossCodeVisible ? bossCodePlain : '••••••••••••'}
                    </span>
                    <div className="flex gap-1.5">
                      {!bossCodeVisible ? (
                        <button 
                          onClick={handleRevealBossCode}
                          className="text-[10px] font-bold text-[#22577A] hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
                        >
                          <Eye size={12} /> Reveal
                        </button>
                      ) : (
                        <button 
                          onClick={() => setBossCodeVisible(false)}
                          className="text-[10px] font-bold text-zinc-500 hover:underline bg-transparent border-none cursor-pointer flex items-center gap-0.5"
                        >
                          <EyeOff size={12} /> Hide
                        </button>
                      )}
                      <button 
                        disabled={!bossCodeVisible}
                        onClick={() => {
                          navigator.clipboard.writeText(bossCodePlain);
                          toast.success('Code Copied', 'Boss Link Code copied to clipboard.');
                        }}
                        className="text-[10px] font-bold text-[#22577A] hover:underline bg-transparent border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5"
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-right text-[10px] space-y-0.5">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-extrabold uppercase text-[9px] inline-block leading-none">
                    Active
                  </span>
                  <div className="text-zinc-500 font-semibold font-mono text-[9.5px]">
                    {codeAgeStr} • {codeExpiryStr}
                  </div>
                </div>
              </div>
            )}

            {/* Regeneration revoked notice */}
            {showRegenNotice && bossCodeStatus === 'active' && (
              <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-2.5 flex items-start gap-2">
                <span className="text-xs">⚠️</span>
                <span className="text-[10px] text-amber-800 leading-normal font-medium">
                  Your previous Boss Link Code has been revoked. Anyone using the old code will no longer be able to link.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Audit timeline */}
        <div className="space-y-2 border-t border-zinc-100 pt-3">
          <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
            <Activity size={12} className="text-zinc-400" /> Recent Security Activity
          </h4>
          
          <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2 divide-y divide-zinc-100">
            {auditLogs.length === 0 ? (
              <p className="text-[10px] text-zinc-400 italic py-2">No security activities recorded.</p>
            ) : (
              auditLogs.map((log) => {
                const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                const displayTime = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + 
                                    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                const isFail = !log.success;
                
                return (
                  <div key={log.id} className="flex items-start justify-between text-[10px] pt-2 first:pt-0 gap-3 font-medium">
                    <div className="flex items-start gap-2">
                      <span className={cn("mt-0.5 shrink-0", isFail ? "text-red-500" : "text-emerald-500")}>
                        {isFail ? '⚠️' : '✓'}
                      </span>
                      <div className="space-y-0.5">
                        <span className={cn("font-bold block", isFail ? "text-red-950" : "text-zinc-800")}>{log.action}</span>
                        <span className="text-[9px] text-zinc-400 block font-semibold truncate max-w-[300px]">
                          Platform: {log.metadata?.platform?.toUpperCase() || log.channel?.toUpperCase() || 'System'} • 
                          User: {log.userId || log.metadata?.senderId || 'Owner'} • 
                          IP: {log.ip || 'Local'}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[9px] text-zinc-400 font-semibold">{displayTime}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="border border-red-200 bg-red-50/10 rounded-xl p-3.5 space-y-3 mt-4">
          <h4 className="text-[10px] font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5 select-none">
            ⚠️ Danger Zone
          </h4>
          <p className="text-[10px] text-zinc-500 leading-normal font-medium">
            Irreversible actions that modify ownership and security capabilities of your AI Employee.
          </p>

          <div className="flex flex-col gap-3 pt-1.5 select-none">
            {/* Unlink Boss */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs border-b border-red-100 pb-3">
              <div className="space-y-0.5">
                <span className="font-bold text-zinc-800 block">Disconnect Linked Owner</span>
                <span className="text-[10px] text-zinc-400 block font-semibold">Sever the active connection to the manager's channel.</span>
              </div>
              <Button 
                variant="outline"
                disabled={!bossOwnerPlatform}
                onClick={() => { setDangerConfirmText(''); setShowDangerConfirm('unlink'); }}
                className="h-7 text-[10px] border-red-200 hover:bg-red-50 text-red-700 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                Disconnect Boss
              </Button>
            </div>

            {/* Regenerate All Codes */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs border-b border-red-100 pb-3">
              <div className="space-y-0.5">
                <span className="font-bold text-zinc-800 block">Revoke All Verification Codes</span>
                <span className="text-[10px] text-zinc-400 block font-semibold">Immediately invalidate any generated active or legacy Boss Codes.</span>
              </div>
              <Button 
                variant="outline"
                disabled={bossCodeStatus === 'not_generated'}
                onClick={() => { setDangerConfirmText(''); setShowDangerConfirm('regenerate'); }}
                className="h-7 text-[10px] border-red-200 hover:bg-red-50 text-red-700 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                Revoke All Codes
              </Button>
            </div>

            {/* Disable Boss Access */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-zinc-800 block">Disable Override Access</span>
                <span className="text-[10px] text-zinc-400 block font-semibold">Completely lock the Boss control channel and shut down takeover endpoints.</span>
              </div>
              <Button 
                variant="outline"
                disabled={!bossAccessEnabled}
                onClick={() => { setDangerConfirmText(''); setShowDangerConfirm('disable'); }}
                className="h-7 text-[10px] border-red-200 hover:bg-red-50 text-red-700 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                Disable Boss Access
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Voice AI & Language Settings Card */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-3.5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Voice AI & Language Settings</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">Configure Speech-to-Text, Text-to-Speech, and voice styles</p>
          </div>
          <SaveButton
            onClick={handleSaveVoice}
            isDirty={!savedVoice}
            label="Save Voice Settings"
            successToastTitle="Voice settings updated"
            successToastDescription="Your changes have been saved."
            className="h-7.5 text-[10px] font-bold px-3.5 rounded-md"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label htmlFor="stt-provider" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">STT Provider</Label>
            <Select value={sttProvider} onValueChange={(val) => val && setSttProvider(val)}>
              <SelectTrigger id="stt-provider" className="h-8.5 text-xs border-zinc-200 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI Whisper</SelectItem>
                <SelectItem value="google">Google Speech</SelectItem>
                <SelectItem value="deepgram">Deepgram</SelectItem>
                <SelectItem value="azure">Azure Speech</SelectItem>
                <SelectItem value="assemblyai">AssemblyAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="tts-provider" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">TTS Provider</Label>
            <Select value={ttsProvider} onValueChange={(val) => {
              if (val) {
                setTtsProvider(val);
                // Set default voice accordingly
                if (val === 'openai') setTtsVoice('nova');
                else if (val === 'elevenlabs') setTtsVoice('21m00Tcm4TlvDq8ikWAM');
                else if (val === 'google') setTtsVoice('en-US-Neural2-F');
                else if (val === 'azure') setTtsVoice('en-US-JennyNeural');
              }
            }}>
              <SelectTrigger id="tts-provider" className="h-8.5 text-xs border-zinc-200 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI TTS</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="google">Google Cloud TTS</SelectItem>
                <SelectItem value="azure">Azure TTS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="tts-voice" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Default Voice</Label>
            <Select value={ttsVoice} onValueChange={(val) => val && setTtsVoice(val)}>
              <SelectTrigger id="tts-voice" className="h-8.5 text-xs border-zinc-200 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ttsProvider === 'openai' && (
                  <>
                    <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                    <SelectItem value="echo">Echo (Male)</SelectItem>
                    <SelectItem value="fable">Fable (Neutral)</SelectItem>
                    <SelectItem value="onyx">Onyx (Male)</SelectItem>
                    <SelectItem value="nova">Nova (Female)</SelectItem>
                    <SelectItem value="shimmer">Shimmer (Female)</SelectItem>
                  </>
                )}
                {ttsProvider === 'elevenlabs' && (
                  <>
                    <SelectItem value="21m00Tcm4TlvDq8ikWAM">Rachel (Female)</SelectItem>
                    <SelectItem value="AZnzlk1XvdvUeBnXmlld">Domi (Female)</SelectItem>
                    <SelectItem value="EXAVITQu4vr4xnSDxMaL">Bella (Female)</SelectItem>
                    <SelectItem value="ErXwobaYiN019PkySvjV">Antoni (Male)</SelectItem>
                    <SelectItem value="TxGEqn7nUa5To4YHHCOx">Josh (Male)</SelectItem>
                    <SelectItem value="VR6A4UBqhstHWoyxbc8j">Arnold (Male)</SelectItem>
                    <SelectItem value="pNInz6obpgdq51JdMT5y">Adam (Male)</SelectItem>
                    <SelectItem value="yoZ06aOLSsp5O3ADYu15">Sam (Male)</SelectItem>
                  </>
                )}
                {ttsProvider === 'google' && (
                  <>
                    <SelectItem value="en-US-Neural2-F">Jenny (US - Female)</SelectItem>
                    <SelectItem value="en-US-Neural2-H">Guy (US - Male)</SelectItem>
                    <SelectItem value="hi-IN-Neural2-C">Madhur (Hindi - Male)</SelectItem>
                    <SelectItem value="hi-IN-Wavenet-D">Swara (Hindi - Female)</SelectItem>
                    <SelectItem value="ta-IN-Wavenet-A">Valluvar (Tamil - Female)</SelectItem>
                    <SelectItem value="ta-IN-Wavenet-B">Venkat (Tamil - Male)</SelectItem>
                  </>
                )}
                {ttsProvider === 'azure' && (
                  <>
                    <SelectItem value="en-US-JennyNeural">Jenny (US - Female)</SelectItem>
                    <SelectItem value="en-US-GuyNeural">Guy (US - Male)</SelectItem>
                    <SelectItem value="hi-IN-SwaraNeural">Swara (Hindi - Female)</SelectItem>
                    <SelectItem value="hi-IN-MadhurNeural">Madhur (Hindi - Male)</SelectItem>
                    <SelectItem value="ta-IN-VenkatNeural">Venkat (Tamil - Female)</SelectItem>
                    <SelectItem value="ta-IN-ValluvarNeural">Valluvar (Tamil - Male)</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="speaking-style" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Speaking Style / Tone</Label>
            <Input id="speaking-style" value={speakingStyle} onChange={(e) => setSpeakingStyle(e.target.value)} placeholder="friendly, professional, energetic..." className="h-8.5 text-xs border-zinc-200 focus-visible:ring-zinc-900 bg-white text-zinc-800 placeholder:text-zinc-400" />
          </div>
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
                  <SaveButton
                    onClick={handleApplyAndSave}
                    isDirty={!!editablePrompt.trim()}
                    label="Apply & Save"
                    successToastTitle="System prompt updated"
                    successToastDescription="Your changes have been saved."
                    className="h-8 text-[10px] font-bold px-4 rounded-lg"
                  />
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

      {/* Password Re-authentication Modal */}
      {showReauthModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFF8F0] border border-[#EED9B4] flex items-center justify-center text-lg text-[#22577A] font-bold">
                🔒
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 leading-none">Confirm Admin Credentials</h3>
                <p className="text-[10px] text-zinc-400 mt-1">Re-enter your account password to verify your identity.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reauth-pw" className="text-xs font-semibold text-zinc-600 block">Password</Label>
              <Input 
                id="reauth-pw" 
                type="password" 
                value={reauthPassword} 
                onChange={(e) => setReauthPassword(e.target.value)} 
                placeholder="Enter password"
                className="w-full text-xs h-9 border-zinc-200 focus-visible:ring-[#22577A] bg-white text-zinc-800" 
              />
              {reauthError && <span className="text-[10px] text-red-600 font-bold block">{reauthError}</span>}
            </div>

            <div className="flex justify-end gap-2 pt-2 select-none">
              <Button 
                variant="outline" 
                onClick={() => { setShowReauthModal(false); setReauthPassword(''); }}
                className="h-9 text-xs px-3.5 border-zinc-200 hover:bg-zinc-50 font-bold text-zinc-700 cursor-pointer bg-white"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleReauthPasswordSubmit} 
                disabled={reauthLoading}
                className="h-9 text-xs px-4 bg-[#22577A] hover:bg-[#1A4461] text-white font-bold rounded-lg border-none cursor-pointer flex items-center gap-1.5"
              >
                {reauthLoading ? 'Confirming...' : 'Verify Password'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Secure Code Confirmation Modal */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFF8F0] border border-[#EED9B4] flex items-center justify-center text-[#22577A]">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 leading-none">Generate Secure Boss Code?</h3>
                <p className="text-[10px] text-zinc-400 mt-1">Verify code issuance properties before proceeding.</p>
              </div>
            </div>

            <div className="bg-zinc-50/70 border border-zinc-150 rounded-xl p-3.5 space-y-2 text-xs text-zinc-600 leading-relaxed font-medium">
              <p>This code grants administrator control over your AI Employee. The generated code:</p>
              <ul className="list-disc list-inside pl-1 space-y-1">
                <li>expires in 10 minutes</li>
                <li>works only once</li>
                <li>automatically invalidates previous codes</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 select-none">
              <Button 
                variant="outline" 
                onClick={() => setShowGenerateConfirm(false)}
                className="h-9 text-xs px-3.5 border-zinc-200 hover:bg-zinc-50 font-bold text-zinc-700 cursor-pointer bg-white"
              >
                Cancel
              </Button>
              <SaveButton 
                onClick={async () => {
                  await handleGenerateBossCode();
                  setShowGenerateConfirm(false);
                }}
                isDirty={true}
                label="Generate Secure Code"
                successLabel="Generated ✓"
                successToastTitle="Boss Code Generated"
                successToastDescription="Valid for 10 minutes."
                className="h-9 text-xs px-4"
              />
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone Action Modal */}
      {showDangerConfirm !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 leading-none">
                  {showDangerConfirm === 'unlink' && 'Confirm Disconnect Owner'}
                  {showDangerConfirm === 'regenerate' && 'Revoke All Active Codes'}
                  {showDangerConfirm === 'disable' && 'Confirm Disable Access'}
                </h3>
                <p className="text-[10px] text-zinc-400 mt-1">This operation is highly destructive and permanent.</p>
              </div>
            </div>

            <div className="text-xs text-zinc-600 leading-relaxed font-medium">
              {showDangerConfirm === 'unlink' && (
                <p>To confirm disconnecting your owner status, type <span className="font-bold text-red-800 font-mono">UNLINK</span> in the box below.</p>
              )}
              {showDangerConfirm === 'regenerate' && (
                <p>To confirm revoking all active codes, type <span className="font-bold text-red-800 font-mono">REVOKE</span> in the box below.</p>
              )}
              {showDangerConfirm === 'disable' && (
                <p>To confirm disabling all admin overriding endpoints, type <span className="font-bold text-red-800 font-mono">DISABLE</span> in the box below.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Input 
                type="text" 
                value={dangerConfirmText} 
                onChange={(e) => setDangerConfirmText(e.target.value)} 
                placeholder={
                  showDangerConfirm === 'unlink' ? 'Type UNLINK' :
                  showDangerConfirm === 'regenerate' ? 'Type REVOKE' : 'Type DISABLE'
                }
                className="w-full text-xs h-9 border-zinc-200 focus-visible:ring-red-500 focus-visible:border-red-500 bg-white text-zinc-800" 
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 select-none">
              <Button 
                variant="outline" 
                onClick={() => { setShowDangerConfirm(null); setDangerConfirmText(''); }}
                className="h-9 text-xs px-3.5 border-zinc-200 hover:bg-zinc-50 font-bold text-zinc-700 cursor-pointer bg-white"
              >
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  setDangerLoading(true);
                  if (showDangerConfirm === 'unlink') {
                    if (dangerConfirmText.trim() === 'UNLINK') {
                      await handleUnlinkBoss();
                      setShowDangerConfirm(null);
                    }
                  } else if (showDangerConfirm === 'regenerate') {
                    if (dangerConfirmText.trim() === 'REVOKE') {
                      await handleRegenerateAll();
                      setShowDangerConfirm(null);
                    }
                  } else if (showDangerConfirm === 'disable') {
                    if (dangerConfirmText.trim() === 'DISABLE') {
                      await handleDisableBossAccess();
                      setShowDangerConfirm(null);
                    }
                  }
                  setDangerLoading(false);
                  setDangerConfirmText('');
                }}
                disabled={
                  dangerLoading || 
                  ((showDangerConfirm === 'unlink' && dangerConfirmText.trim() !== 'UNLINK') || 
                   (showDangerConfirm === 'regenerate' && dangerConfirmText.trim() !== 'REVOKE') ||
                   (showDangerConfirm === 'disable' && dangerConfirmText.trim() !== 'DISABLE'))
                }
                className="h-9 text-xs px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg border-none cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {dangerLoading ? 'Processing...' : 'Confirm Action'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
