'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  Globe,
  Plus,
  FileText,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Building2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, getDoc, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Core UI components
import { PageLayout } from '@/components/ui/PageLayout';
import { EmptyState } from '@/components/ui/EmptyState';

interface KnowledgeItem {
  id: string;
  type: 'text' | 'faq' | 'url' | 'pdf' | 'docx' | 'txt' | 'md';
  status: 'Uploading' | 'Extracting' | 'Indexing' | 'Analyzing' | 'Suggestions Ready' | 'Ready' | 'Failed';
  title: string;
  source: string;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: any;
  updatedAt: any;
}

const KNOWLEDGE_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <FileText size={16} className="text-blue-500" />,
  faq: <Sparkles size={16} className="text-amber-500" />,
  url: <Globe size={16} className="text-emerald-500" />,
  pdf: <FileText size={16} className="text-rose-500" />,
  docx: <FileText size={16} className="text-sky-500" />,
  txt: <FileText size={16} className="text-zinc-500" />,
  md: <FileText size={16} className="text-purple-500" />,
};

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const getMillis = (dateObj: any): number => {
  if (!dateObj) return 0;
  if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
  if (dateObj.seconds !== undefined) return dateObj.seconds * 1000;
  if (dateObj instanceof Date) return dateObj.getTime();
  return new Date(dateObj).getTime() || 0;
};

export default function KnowledgePage() {
  const { workspaceId } = useWorkspace();
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Lists & Loaders
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingType, setAddingType] = useState<'text' | 'faq' | 'url' | 'file' | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedSugs, setSelectedSugs] = useState<string[]>([]);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [confirmReplaceSug, setConfirmReplaceSug] = useState<any | null>(null);
  const [confirmApplyAll, setConfirmApplyAll] = useState(false);
  const [dismissedDocs, setDismissedDocs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Text/FAQ/URL form states
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formFaqAnswer, setFormFaqAnswer] = useState('');
  const [formUrl, setFormUrl] = useState('');

  // Business Profile state
  const [bizName, setBizName] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [bizIndustry, setBizIndustry] = useState('');
  const [bizProducts, setBizProducts] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizWebsite, setBizWebsite] = useState('');
  const [bizSaving, setBizSaving] = useState(false);

  // Database values tracker
  const [dbBizName, setDbBizName] = useState('');
  const [dbBizDesc, setDbBizDesc] = useState('');
  const [dbBizIndustry, setDbBizIndustry] = useState('');
  const [dbBizProducts, setDbBizProducts] = useState('');
  const [dbBizEmail, setDbBizEmail] = useState('');
  const [dbBizPhone, setDbBizPhone] = useState('');
  const [dbBizWebsite, setDbBizWebsite] = useState('');

  // Computed Save state
  const bizSaved = bizName.trim() === dbBizName.trim() &&
                   bizDesc.trim() === dbBizDesc.trim() &&
                   bizIndustry.trim() === dbBizIndustry.trim() &&
                   bizProducts.trim() === dbBizProducts.trim() &&
                   bizEmail.trim() === dbBizEmail.trim() &&
                   bizPhone.trim() === dbBizPhone.trim() &&
                   bizWebsite.trim() === dbBizWebsite.trim();

  // Reserved doc IDs that should not appear in the knowledge items table
  const RESERVED_IDS = ['knowledge-base', 'business-profile'];

  useEffect(() => {
    if (!db || !workspaceId) return;
    setLoading(true);

    const collRef = collection(db, 'workspaces', workspaceId, 'knowledge');
    const unsubscribe = onSnapshot(collRef, (snap) => {
      const loaded: KnowledgeItem[] = [];
      snap.forEach((d) => {
        if (RESERVED_IDS.includes(d.id)) return; // skip reserved docs
        const data = d.data();
        
        let normalizedStatus: 'Uploading' | 'Extracting' | 'Indexing' | 'Analyzing' | 'Suggestions Ready' | 'Ready' | 'Failed' = 'Ready';
        if (data.status) {
          const s = data.status.toLowerCase();
          const createdMillis = getMillis(data.createdAt);
          const ageMinutes = createdMillis > 0 ? (Date.now() - createdMillis) / (60 * 1000) : 0;

          if (s === 'uploading') {
            if (ageMinutes > 5) {
              normalizedStatus = 'Failed';
              setDoc(d.ref, { status: 'Failed', updatedAt: new Date() }, { merge: true }).catch(err => {
                console.warn('Failed to update stuck status in Firestore:', err);
              });
            } else {
              normalizedStatus = 'Uploading';
            }
          } else if (s === 'extracting' || s === 'processing') {
            normalizedStatus = 'Extracting';
          } else if (s === 'indexing') {
            normalizedStatus = 'Indexing';
          } else if (s === 'analyzing') {
            normalizedStatus = 'Analyzing';
          } else if (s === 'suggestions ready') {
            normalizedStatus = 'Suggestions Ready';
          } else if (s === 'failed') {
            normalizedStatus = 'Failed';
          } else {
            normalizedStatus = 'Ready';
          }
        }

        loaded.push({
          id: d.id,
          type: data.type || 'pdf',
          title: data.title || data.name || 'Untitled Document',
          status: normalizedStatus,
          source: data.source || data.url || data.fileUrl || '',
          fileUrl: data.fileUrl || data.url || null,
          fileSize: data.fileSize !== undefined ? data.fileSize : (data.size !== undefined ? data.size : null),
          mimeType: data.mimeType || null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt || data.createdAt,
        } as KnowledgeItem);
      });
      loaded.sort((a, b) => {
        return getMillis(b.createdAt) - getMillis(a.createdAt);
      });
      setItems(loaded);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setErrorMsg('Failed to subscribe to knowledge list.');
      setLoading(false);
    });

    return unsubscribe;
  }, [workspaceId]);

  // Load suggestions from Firestore
  useEffect(() => {
    if (!db || !workspaceId) return;
    const collRef = collection(db, 'workspaces', workspaceId, 'suggestions');
    const unsubscribe = onSnapshot(collRef, (snap) => {
      const loaded: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.status === 'pending') {
          loaded.push({ id: d.id, ...data });
        }
      });
      setSuggestions(loaded);
    });
    return unsubscribe;
  }, [workspaceId]);

  const checkSnapshot = async () => {
    if (!db || !workspaceId) return;
    try {
      const q = query(collection(db, 'workspaces', workspaceId, 'profile-snapshots'), limit(1));
      const snap = await getDocs(q);
      setHasSnapshot(!snap.empty);
    } catch (e) {
      console.warn('Failed to check profile snapshot:', e);
    }
  };

  // Load business profile from Firestore on mount
  useEffect(() => {
    async function loadBizProfile() {
      if (!db || !workspaceId) return;
      try {
        const ref = doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          const nameVal = d.businessName || '';
          const descVal = d.description || '';
          const indVal = d.industry || '';
          const prodVal = d.productsServices || '';
          const emailVal = d.supportEmail || '';
          const phoneVal = d.supportPhone || '';
          const webVal = d.website || '';

          setBizName(nameVal);
          setDbBizName(nameVal);
          setBizDesc(descVal);
          setDbBizDesc(descVal);
          setBizIndustry(indVal);
          setDbBizIndustry(indVal);
          setBizProducts(prodVal);
          setDbBizProducts(prodVal);
          setBizEmail(emailVal);
          setDbBizEmail(emailVal);
          setBizPhone(phoneVal);
          setDbBizPhone(phoneVal);
          setBizWebsite(webVal);
          setDbBizWebsite(webVal);
        }
        await checkSnapshot();
      } catch (e) {
        console.error('Failed to load business profile:', e);
      }
    }
    loadBizProfile();
  }, [workspaceId]);

  const handleSaveBizProfile = async () => {
    if (!db || !workspaceId) return;
    setBizSaving(true);
    try {
      const ref = doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile');
      await setDoc(ref, {
        businessName: bizName.trim(),
        description: bizDesc.trim(),
        industry: bizIndustry.trim(),
        productsServices: bizProducts.trim(),
        supportEmail: bizEmail.trim(),
        supportPhone: bizPhone.trim(),
        website: bizWebsite.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (typeof window !== 'undefined') {
        localStorage.setItem('__dudo_business_profile', JSON.stringify({
          businessName: bizName.trim(),
          industry: bizIndustry.trim(),
          businessDescription: bizDesc.trim(),
          productsServices: bizProducts.trim(),
          supportEmail: bizEmail.trim(),
          supportPhone: bizPhone.trim(),
          website: bizWebsite.trim()
        }));
        localStorage.setItem('__dudo_dev_knowledge_base', JSON.stringify({
          businessDetails: bizName.trim() + ' - ' + bizDesc.trim(),
          productsServices: bizProducts.trim(),
          commonQuestions: '',
          policies: ''
        }));
      }

      setDbBizName(bizName.trim());
      setDbBizDesc(bizDesc.trim());
      setDbBizIndustry(bizIndustry.trim());
      setDbBizProducts(bizProducts.trim());
      setDbBizEmail(bizEmail.trim());
      setDbBizPhone(bizPhone.trim());
      setDbBizWebsite(bizWebsite.trim());
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save business profile.');
    } finally {
      setBizSaving(false);
    }
  };

  // Helper to extract text from PDF binary string
  const extractTextFromPDFBinary = (binaryStr: string): string => {
    const parenMatches = binaryStr.match(/\(([^)]+)\)/g);
    if (parenMatches && parenMatches.length > 0) {
      return parenMatches
        .map(m => {
          let text = m.slice(1, -1);
          text = text.replace(/\\(\d{3})/g, (match, octal) => {
            return String.fromCharCode(parseInt(octal, 8));
          });
          text = text.replace(/\\(.)/g, '$1');
          return text;
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return binaryStr.replace(/[^\x20-\x7E\s\n\r]/g, '').replace(/\s+/g, ' ').trim();
  };

  // Helper to get first connected provider from localStorage
  const getFirstConnectedProvider = () => {
    const keys = [
      'openai',
      'groq',
      'gemini',
      'anthropic',
      'deepseek',
      'openrouter',
      'mistral',
      'qwen'
    ];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(`__dudo_dev_provider_${k}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.apiKey && parsed.model) {
            return { provider: k, apiKey: parsed.apiKey, model: parsed.model };
          }
        }
      } catch (e) {}
    }
    return null;
  };

  // Helper to call AI model (via server route proxy or direct endpoint fallback)
  const extractProfileWithAI = async (providerInfo: { provider: string; apiKey: string; model: string }, text: string) => {
    const prompt = `You are a data extraction assistant. Extract the following business profile fields from this text. Respond ONLY with a valid JSON object matching this TypeScript interface:
{
  "businessName": string,
  "industry": string,
  "businessDescription": string,
  "productsServices": string,
  "supportPhone": string,
  "supportEmail": string
}
Do not include any explanation, backticks, or markdown formatting like \`\`\`json. Just return the raw JSON object.

Text:
${text}`;

    const { provider, apiKey, model } = providerInfo;
    const serverSupportedProviders = ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'deepseek', 'mistral'];

    if (serverSupportedProviders.includes(provider.toLowerCase())) {
      try {
        const res = await fetch('/api/playground/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: prompt,
            provider: provider,
            model: model,
            apiKey: apiKey,
            workspaceId: workspaceId || 'workspace-1',
            temperature: 0.1,
            systemPrompt: 'You are a precise data extractor. Output JSON only.'
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.reply) {
            return parseAIResponseJSON(data.reply);
          }
        }
      } catch (e) {
        console.warn('Server proxy AI extraction failed, trying direct API:', e);
      }
    }

    // Direct endpoints fallback
    let url = '';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let body: any = {};
    const pLower = provider.toLowerCase();

    if (pLower === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      };
    } else if (pLower === 'groq') {
      url = 'https://api.groq.com/openai/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      };
    } else if (pLower === 'gemini') {
      url = `https://generativelanguage.googleapis.com/v1beta/chat/completions?key=${apiKey}`;
      body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      };
    } else if (pLower === 'deepseek') {
      url = 'https://api.deepseek.com/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      };
    } else if (pLower === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      };
    } else if (pLower === 'mistral') {
      url = 'https://api.mistral.ai/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      };
    } else if (pLower === 'qwen') {
      url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1
      };
    } else if (pLower === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['dangerously-allow-developer-user-agent'] = 'true';
      body = {
        model: model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      };
    } else {
      return null;
    }

    if (url) {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        let textResponse = '';
        if (pLower === 'anthropic') {
          textResponse = data.content?.[0]?.text || '';
        } else {
          textResponse = data.choices?.[0]?.message?.content || '';
        }
        return parseAIResponseJSON(textResponse);
      }
    }
    return null;
  };

  const parseAIResponseJSON = (text: string) => {
    let clean = text.trim();
    if (clean.includes('```')) {
      const parts = clean.split('```');
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (trimmedPart.startsWith('json')) {
          clean = trimmedPart.substring(4).trim();
          break;
        } else if (trimmedPart.startsWith('{') && trimmedPart.endsWith('}')) {
          clean = trimmedPart;
          break;
        }
      }
    }
    try {
      return JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse AI JSON response:', e, 'Raw text:', text);
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (nestedErr) {}
      }
      return null;
    }
  };

  const handleApproveSuggestion = async (sug: any) => {
    let token = '';
    if (currentUser) {
      token = await currentUser.getIdToken();
    }
    try {
      const res = await fetch('/api/agent/knowledge/suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          suggestionId: sug.id,
          action: 'approve',
          fieldName: sug.fieldName,
          newValue: sug.newValue
        })
      });
      if (res.ok) {
        if (sug.fieldName === 'businessName') setBizName(sug.newValue);
        if (sug.fieldName === 'industry') setBizIndustry(sug.newValue);
        if (sug.fieldName === 'description') setBizDesc(sug.newValue);
        if (sug.fieldName === 'supportEmail') setBizEmail(sug.newValue);
        if (sug.fieldName === 'supportPhone') setBizPhone(sug.newValue);
        if (sug.fieldName === 'website') setBizWebsite(sug.newValue);
        if (sug.fieldName === 'productsServices') setBizProducts(sug.newValue);
        
        setSuccessMsg(`Approved suggested update for ${sug.fieldName}!`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to apply suggestion.');
    }
  };

  const handleRejectSuggestion = async (sug: any) => {
    let token = '';
    if (currentUser) {
      token = await currentUser.getIdToken();
    }
    try {
      await fetch('/api/agent/knowledge/suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          suggestionId: sug.id,
          action: 'reject'
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplySelectedSuggestions = async () => {
    for (const id of selectedSugs) {
      const sug = suggestions.find(s => s.id === id);
      if (sug) {
        await handleApproveSuggestion(sug);
      }
    }
    setSelectedSugs([]);
  };

  const handleApplyAllSuggestions = async () => {
    for (const sug of suggestions) {
      await handleApproveSuggestion(sug);
    }
  };

  const handleRejectAllSuggestions = async () => {
    for (const sug of suggestions) {
      await handleRejectSuggestion(sug);
    }
  };

  // Validates file format and size limit (<= 500KB)
  const validateDocFile = (file: File): string | null => {
    const validExtensions = ['pdf', 'docx', 'txt', 'md'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !validExtensions.includes(ext)) {
      return 'Invalid document format. Please upload PDF, DOCX, TXT, or Markdown (MD) files only.';
    }
    if (file.size > 500 * 1024) {
      return 'File too large. Max 500KB for free plan.';
    }
    return null;
  };

  const handleFileUpload = async (file: File, replaceId?: string) => {
    setErrorMsg(null);
    setAlertMsg('');
    const validationError = validateDocFile(file);
    if (validationError) {
      if (file.size > 500 * 1024) {
        setAlertMsg("File too large! Please upload a PDF under 500KB.");
        setTimeout(() => setAlertMsg(''), 4000);
      } else {
        setErrorMsg(validationError);
      }
      return;
    }

    if (!db || !workspaceId) return;

    const itemId = replaceId || `k-${Date.now()}`;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
    const type = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ext === 'md' ? 'md' : 'txt';

    const docRef = doc(db, 'workspaces', workspaceId, 'knowledge', itemId);

    // 1. Show progress while reading: set status to 'Processing'
    const initData = {
      id: itemId,
      type,
      name: file.name,
      title: file.name,
      status: 'processing',
      source: file.name,
      url: null,
      fileUrl: null,
      size: file.size,
      fileSize: file.size,
      mimeType: file.type || `application/${ext}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await setDoc(docRef, initData, { merge: true });

      // 2. Read file as base64 using FileReader
      const reader = new FileReader();

      reader.onload = async (e) => {
        let base64String = e.target?.result as string;
        if (base64String && base64String.includes('base64,')) {
          base64String = base64String.split('base64,')[1];
        }

        try {
          // 3. Save base64 payload to Firestore
          await setDoc(docRef, {
            name: file.name,
            title: file.name,
            type,
            base64: base64String,
            size: file.size,
            fileSize: file.size,
            status: 'Processing',
            updatedAt: new Date(),
          }, { merge: true });

          // 4. Trigger server-side backend ingestion pipeline
          let token = '';
          if (currentUser) {
            token = await currentUser.getIdToken();
          }
          const res = await fetch('/api/agent/knowledge/ingest', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ workspaceId, itemId })
          });
          if (!res.ok) {
            const errBody = await res.json();
            throw new Error(errBody.error || 'Ingestion request failed');
          }

        } catch (saveErr: any) {
          console.warn('[Upload] Ingestion failed:', saveErr);
          setErrorMsg(saveErr.message || 'Ingestion failed.');
          await setDoc(docRef, { status: 'Failed', updatedAt: new Date() }, { merge: true });
        }
      };

      reader.onerror = async (err) => {
        console.warn(err);
        await setDoc(docRef, { status: 'Failed', updatedAt: new Date() }, { merge: true });
        setErrorMsg('Failed to read file.');
      };

      reader.readAsDataURL(file);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'File upload execution error.');
      await setDoc(docRef, { status: 'Failed', updatedAt: new Date() }, { merge: true });
    }
  };

  const handleAddText = async () => {
    if (!formTitle.trim() || !formContent.trim() || !workspaceId || !db) return;
    setErrorMsg(null);

    const itemId = `k-${Date.now()}`;
    const docRef = doc(db, 'workspaces', workspaceId, 'knowledge', itemId);
    
    try {
      await setDoc(docRef, {
        id: itemId,
        type: 'text',
        title: formTitle.trim(),
        status: 'Processing',
        source: formContent.trim(),
        fileUrl: null,
        fileSize: formContent.length,
        mimeType: 'text/plain',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setFormTitle('');
      setFormContent('');
      setAddingType(null);

      // Trigger backend ingestion
      let token = '';
      if (currentUser) {
        token = await currentUser.getIdToken();
      }
      fetch('/api/agent/knowledge/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workspaceId, itemId })
      }).catch(err => console.error(err));

    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save text knowledge.');
    }
  };

  const handleAddFaq = async () => {
    if (!formTitle.trim() || !formFaqAnswer.trim() || !workspaceId || !db) return;
    setErrorMsg(null);

    const itemId = `k-${Date.now()}`;
    const docRef = doc(db, 'workspaces', workspaceId, 'knowledge', itemId);

    try {
      await setDoc(docRef, {
        id: itemId,
        type: 'faq',
        title: formTitle.trim(),
        question: formTitle.trim(),
        answer: formFaqAnswer.trim(),
        status: 'Processing',
        source: formFaqAnswer.trim(),
        fileUrl: null,
        fileSize: formTitle.length + formFaqAnswer.length,
        mimeType: 'application/json',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setFormTitle('');
      setFormFaqAnswer('');
      setAddingType(null);

      // Trigger backend ingestion
      let token = '';
      if (currentUser) {
        token = await currentUser.getIdToken();
      }
      fetch('/api/agent/knowledge/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workspaceId, itemId })
      }).catch(err => console.error(err));

    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save FAQ knowledge.');
    }
  };

  const handleAddUrl = async () => {
    if (!formTitle.trim() || !formUrl.trim() || !workspaceId || !db) return;
    setErrorMsg(null);

    const itemId = `k-${Date.now()}`;
    const docRef = doc(db, 'workspaces', workspaceId, 'knowledge', itemId);
    const targetUrl = formUrl.trim();

    try {
      await setDoc(docRef, {
        id: itemId,
        type: 'url',
        title: formTitle.trim(),
        status: 'Processing',
        source: targetUrl,
        fileUrl: null,
        fileSize: targetUrl.length,
        mimeType: 'text/html',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      setFormTitle('');
      setFormUrl('');
      setAddingType(null);

      fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      })
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(async (data) => {
        if (data.text) {
          await setDoc(docRef, {
            status: 'Processing',
            source: data.text,
            updatedAt: new Date()
          }, { merge: true });

          let token = '';
          if (currentUser) {
            token = await currentUser.getIdToken();
          }
          fetch('/api/agent/knowledge/ingest', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ workspaceId, itemId })
          }).catch(err => console.error(err));
        } else {
          await setDoc(docRef, { status: 'Failed', updatedAt: new Date() }, { merge: true });
        }
      })
      .catch(async (fetchErr) => {
        console.error('Failed to fetch URL:', fetchErr);
        await setDoc(docRef, { status: 'Failed', updatedAt: new Date() }, { merge: true });
      });

    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save URL knowledge.');
    }
  };

  const handleDeleteItem = async (item: KnowledgeItem) => {
    if (!workspaceId || !db) return;
    setErrorMsg(null);
    try {
      console.log('Deleting item with ID:', item.id);
      await deleteDoc(doc(db, 'workspaces', workspaceId, 'knowledge', item.id));

      let token = '';
      if (currentUser) {
        token = await currentUser.getIdToken();
      }
      fetch('/api/agent/knowledge/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workspaceId, itemId: item.id })
      }).catch(err => console.error('Vector deletion trigger failed:', err));

      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to delete knowledge resource.');
    }
  };

  const checkFileSizeAndUpload = (e: React.ChangeEvent<HTMLInputElement>, replaceId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileUpload(file, replaceId);
    if (replaceId) {
      setReplaceTargetId(null);
    }
  };

  const handleReplaceProfile = async (sug: any) => {
    let token = '';
    if (currentUser) {
      token = await currentUser.getIdToken();
    }
    try {
      const res = await fetch('/api/agent/knowledge/suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          suggestionId: sug.id,
          action: 'replace'
        })
      });
      if (res.ok) {
        setSuccessMsg(`Business Profile replaced successfully!`);
        setTimeout(() => setSuccessMsg(null), 3000);
        // Reload profile inputs
        const ref = doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setBizName(d.businessName || '');
          setBizDesc(d.description || '');
          setBizIndustry(d.industry || '');
          setBizProducts(d.productsServices || '');
          setBizEmail(d.supportEmail || '');
          setBizPhone(d.supportPhone || '');
          setBizWebsite(d.website || '');
        }
        await checkSnapshot();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to replace profile.');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to replace profile.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const handleKeepAsKnowledge = async (sug: any) => {
    let token = '';
    if (currentUser) {
      token = await currentUser.getIdToken();
    }
    try {
      const res = await fetch('/api/agent/knowledge/suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          suggestionId: sug.id,
          action: 'keep_as_knowledge'
        })
      });
      if (res.ok) {
        setSuccessMsg(`Suggestions dismissed, kept as RAG knowledge.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to dismiss suggestions.');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to dismiss suggestions.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const handleRollbackProfile = async () => {
    let token = '';
    if (currentUser) {
      token = await currentUser.getIdToken();
    }
    try {
      const res = await fetch('/api/agent/knowledge/suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId,
          action: 'rollback'
        })
      });
      if (res.ok) {
        setSuccessMsg(`Business Profile rolled back successfully!`);
        setTimeout(() => setSuccessMsg(null), 3000);
        
        // Reload profile inputs
        const ref = doc(db, 'workspaces', workspaceId, 'knowledge', 'business-profile');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          setBizName(d.businessName || '');
          setBizDesc(d.description || '');
          setBizIndustry(d.industry || '');
          setBizProducts(d.productsServices || '');
          setBizEmail(d.supportEmail || '');
          setBizPhone(d.supportPhone || '');
          setBizWebsite(d.website || '');
        }
        await checkSnapshot();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to rollback profile.');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to rollback profile.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const triggerReplace = (itemId: string) => {
    setReplaceTargetId(itemId);
    setTimeout(() => replaceInputRef.current?.click(), 100);
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PageLayout className="max-w-[1150px] w-full text-left mx-auto gap-3 px-4 sm:px-6 pb-16 box-border">
      {/* Custom compact header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-5 text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0 text-[#22577A] mt-1">
            <FolderOpen size={20} />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-zinc-950 tracking-tight leading-none mb-2">
              Knowledge Base
            </h1>
            <p className="text-sm text-zinc-600 max-w-2xl leading-relaxed">
              Supply business details, documents, and FAQs to train your AI receptionist.
            </p>
          </div>
        </div>
      </div>

      {alertMsg && (
        <div 
          className="fixed top-5 right-5 z-[9999] bg-[#8B1A1A] text-white px-5 py-3 rounded-xl font-bold text-sm shadow-2xl flex items-center gap-2 animate-fade-in"
        >
          ⚠️ {alertMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-[#FFF3E5] border border-[#EED9B4] text-[#8B1A1A] text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-semibold animate-fade-in text-left">
          <AlertCircle size={14} className="shrink-0 text-[#8B1A1A]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-xl flex items-center gap-2 font-semibold animate-fade-in text-left">
          <CheckCircle2 size={14} className="shrink-0 text-green-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ─── Business Profile Card ─── */}
      <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 shadow-sm space-y-4 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-3 gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight flex items-center gap-2 leading-none">
              <Building2 size={15} className="text-[#22577A]" /> Business Profile
            </h3>
            <p className="text-xs text-zinc-600 mt-1 leading-relaxed">Core business context injected into every AI conversation.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {hasSnapshot && (
              <Button
                onClick={handleRollbackProfile}
                variant="outline"
                className="h-8 text-xs font-semibold px-3 border-red-300 text-red-700 hover:bg-red-50 rounded-xl flex items-center gap-1.5 cursor-pointer bg-white flex-1 sm:flex-none justify-center"
              >
                <RotateCcw size={12} /> Rollback
              </Button>
            )}
            <Button
              onClick={handleSaveBizProfile}
              disabled={bizSaving}
              className="h-8 text-xs font-semibold px-4 bg-[#22577A] hover:bg-[#1A4461] text-white rounded-xl border-none cursor-pointer flex items-center justify-center shadow-sm transition-all hover:scale-[1.01] flex-1 sm:flex-none"
            >
              {bizSaving ? 'Saving...' : bizSaved ? '✓ Saved!' : 'Save Profile'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">Business Name</Label>
            <Input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Your Business Name" className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">Industry</Label>
            <Input value={bizIndustry} onChange={e => setBizIndustry(e.target.value)} placeholder="Your Industry" className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">Business Description</Label>
            <Textarea value={bizDesc} onChange={e => setBizDesc(e.target.value)} placeholder="Your Business Description" className="text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white resize-none rounded-xl" rows={2} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">Products / Services</Label>
            <Textarea value={bizProducts} onChange={e => setBizProducts(e.target.value)} placeholder="Your Products / Services" className="text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white resize-none rounded-xl" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">Support Email</Label>
            <Input value={bizEmail} onChange={e => setBizEmail(e.target.value)} placeholder="Your Support Email" className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">Support Phone</Label>
            <Input value={bizPhone} onChange={e => setBizPhone(e.target.value)} placeholder="Your Support Phone" className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-700">Website</Label>
            <Input value={bizWebsite} onChange={e => setBizWebsite(e.target.value)} placeholder="Your Website URL" className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl" />
          </div>
        </div>
      </div>



      {/* ─── Control Header ─── */}
      <div className="bg-white border border-zinc-200/60 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 tracking-tight flex items-center gap-2 leading-none">
            <FolderOpen size={15} className="text-[#22577A]" /> Knowledge Resources
          </h3>
          <p className="text-xs text-zinc-600 mt-1 leading-relaxed">Upload documents, Q&amp;A records, or website pages for the AI to learn from.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 512000) {
                setAlertMsg('File too large! Max 500KB allowed.');
                setTimeout(() => setAlertMsg(''), 4000);
                e.target.value = '';
                return;
              }
              checkFileSizeAndUpload(e);
            }}
          />
          <input
            type="file"
            ref={replaceInputRef}
            className="hidden"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 512000) {
                setAlertMsg('File too large! Max 500KB allowed.');
                setTimeout(() => setAlertMsg(''), 4000);
                e.target.value = '';
                return;
              }
              checkFileSizeAndUpload(e, replaceTargetId || undefined);
            }}
          />

          <Button
            onClick={() => { setAddingType('file'); fileInputRef.current?.click(); }}
            className="h-8 px-3.5 text-xs font-semibold bg-[#22577A] hover:bg-[#1A4461] text-white rounded-xl flex items-center gap-1.5 border-none cursor-pointer shadow-sm transition-all hover:scale-[1.01]"
          >
            <Upload size={13} /> Upload Document
          </Button>

          <Button
            onClick={() => setAddingType(addingType === 'text' ? null : 'text')}
            className={cn(
              'h-8 px-3 text-xs font-semibold border border-zinc-300 text-zinc-700 bg-white rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-400 shadow-none',
              addingType === 'text' && 'bg-zinc-50 border-zinc-400'
            )}
          >
            <Plus size={13} className="text-zinc-600" /> Add Text
          </Button>

          <Button
            onClick={() => setAddingType(addingType === 'faq' ? null : 'faq')}
            className={cn(
              'h-8 px-3 text-xs font-semibold border border-zinc-300 text-zinc-700 bg-white rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-400 shadow-none',
              addingType === 'faq' && 'bg-zinc-50 border-zinc-400'
            )}
          >
            Add FAQ
          </Button>

          <Button
            onClick={() => setAddingType(addingType === 'url' ? null : 'url')}
            className={cn(
              'h-8 px-3 text-xs font-semibold border border-zinc-300 text-zinc-700 bg-white rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-400 shadow-none',
              addingType === 'url' && 'bg-zinc-50 border-zinc-400'
            )}
          >
            <Globe size={13} className="text-zinc-600" /> Add Website
          </Button>
        </div>
      </div>

      {/* ─── Adding forms conditional display ─── */}
      {addingType === 'text' && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in text-left">
          <h4 className="text-sm font-semibold text-zinc-900 tracking-tight border-b border-zinc-100 pb-2.5">Add Plain Text Knowledge</h4>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700">Resource Title</Label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Return Policy Overview"
                className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700">Content / Details</Label>
              <Textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                placeholder="Write business details, instructions, or policies..."
                className="text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white resize-none rounded-xl"
                rows={5}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setAddingType(null)} className="h-8 text-xs font-semibold border-zinc-250 text-zinc-750 bg-white rounded-xl flex-1 sm:flex-none justify-center">Cancel</Button>
              <Button size="sm" onClick={handleAddText} disabled={!formTitle.trim() || !formContent.trim()} className="h-8 text-xs font-semibold bg-[#22577A] hover:bg-[#1A4461] text-white border-none cursor-pointer rounded-xl shadow-sm transition-all hover:scale-[1.01] flex-1 sm:flex-none justify-center">Save Knowledge</Button>
            </div>
          </div>
        </div>
      )}

      {addingType === 'faq' && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in text-left">
          <h4 className="text-sm font-semibold text-zinc-900 tracking-tight border-b border-zinc-100 pb-2.5">Add Custom FAQ Entry</h4>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700">Question</Label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Do you support cash on delivery?"
                className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700">Answer</Label>
              <Textarea
                value={formFaqAnswer}
                onChange={e => setFormFaqAnswer(e.target.value)}
                placeholder="Answer text AI should convey..."
                className="text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white resize-none rounded-xl"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setAddingType(null)} className="h-8 text-xs font-semibold border-zinc-250 text-zinc-750 bg-white rounded-xl flex-1 sm:flex-none justify-center">Cancel</Button>
              <Button size="sm" onClick={handleAddFaq} disabled={!formTitle.trim() || !formFaqAnswer.trim()} className="h-8 text-xs font-semibold bg-[#22577A] hover:bg-[#1A4461] text-white border-none cursor-pointer rounded-xl shadow-sm transition-all hover:scale-[1.01] flex-1 sm:flex-none justify-center">Save FAQ</Button>
            </div>
          </div>
        </div>
      )}

      {addingType === 'url' && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in text-left">
          <h4 className="text-sm font-semibold text-zinc-900 tracking-tight border-b border-zinc-100 pb-2.5">Add Website URL Resource</h4>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700">Resource Name</Label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Services Catalog Page"
                className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-700">URL Link Address</Label>
              <Input
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                placeholder="e.g. https://yoursite.com/services"
                className="h-9 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 bg-white rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setAddingType(null)} className="h-8 text-xs font-semibold border-zinc-250 text-zinc-750 bg-white rounded-xl flex-1 sm:flex-none justify-center">Cancel</Button>
              <Button size="sm" onClick={handleAddUrl} disabled={!formTitle.trim() || !formUrl.trim()} className="h-8 text-xs font-semibold bg-[#22577A] hover:bg-[#1A4461] text-white border-none cursor-pointer rounded-xl shadow-sm transition-all hover:scale-[1.01] flex-1 sm:flex-none justify-center">Save Link</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Knowledge Items List ─── */}
      <div className="bg-white border border-zinc-200/60 rounded-2xl shadow-sm text-left overflow-hidden">
        {/* Search + Filter bar */}
        {!loading && items.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-5 pt-4 pb-3.5 border-b border-zinc-100">
            <div className="relative flex-1 min-w-0 w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search resources by name or type..."
                className="w-full h-8 pl-8 pr-3 text-sm text-zinc-900 placeholder:text-zinc-500 border border-zinc-200 rounded-xl bg-white outline-none focus:border-[#22577A] transition-colors"
              />
              <svg className="absolute left-2.5 top-2 w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M16.5 10.5a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </div>
            {/* Filter chips — horizontally scrollable on mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto shrink-0 pb-0.5">
              {['All', 'Ready', 'Processing', 'Suggestions Ready', 'Failed'].map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'h-7 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0',
                    statusFilter === f
                      ? 'bg-[#22577A] text-white border-[#22577A]'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 size={20} className="text-[#22577A] animate-spin" />
            <p className="text-xs text-zinc-500 font-semibold">Syncing knowledge resources...</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No Knowledge Resources Uploaded"
            description="Upload business rules, FAQs, or manuals so the AI receptionist can accurately answer user questions."
          />
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <FolderOpen size={32} className="text-zinc-300" />
            <p className="text-sm font-semibold text-zinc-500">No results found</p>
            <p className="text-xs text-zinc-600">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <>
            {/* ── Mobile card list (hidden on sm+) ── */}
            <div className="flex flex-col divide-y divide-zinc-100 sm:hidden select-none">
              {filteredItems.map((item) => {
                const statusLower = item.status?.toLowerCase() || '';
                const isUploading = statusLower === 'uploading';
                const isProcessing = statusLower === 'processing';
                const progress = uploadProgress[item.id];
                return (
                  <div key={item.id} className="py-3 flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {KNOWLEDGE_TYPE_ICONS[item.type] || <FileText size={16} className="text-zinc-400" />}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-zinc-900 truncate" title={item.title}>{item.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span className="capitalize">{item.type}</span>
                        <span>·</span>
                        <span className="font-mono">{formatBytes(item.fileSize)}</span>
                        {item.createdAt?.seconds && (
                          <><span>·</span><span>{new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></>
                        )}
                      </div>
                      <div>
                        {item.status === 'Uploading' ? (
                          <div className="flex items-center gap-1.5 text-[#22577A] font-semibold text-xs">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Uploading {progress !== undefined ? `(${progress}%)` : ''}</span>
                          </div>
                        ) : item.status === 'Extracting' || item.status === 'Indexing' || item.status === 'Analyzing' ? (
                          <div className="flex items-center gap-1.5 text-[#22577A] bg-blue-50 px-2 py-0.5 border border-blue-200 rounded-full font-semibold text-[10px] w-max">
                            <Loader2 size={10} className="animate-spin" /><span>Processing</span>
                          </div>
                        ) : item.status === 'Suggestions Ready' ? (
                          <div className="flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200 rounded-full font-semibold text-[10px] w-max"><span>Suggestions Ready</span></div>
                        ) : item.status === 'Ready' ? (
                          <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 border border-green-200 rounded-full font-semibold text-[10px] w-max">
                            <CheckCircle2 size={10} className="text-green-600" /><span>Ready</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-700 bg-red-50 px-2 py-0.5 border border-red-200 rounded-full font-semibold text-[10px] w-max">
                            <AlertCircle size={10} className="text-red-600" /><span>Failed</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {['pdf', 'docx', 'txt', 'md'].includes(item.type) && (
                        <button
                          onClick={() => triggerReplace(item.id)}
                          disabled={isUploading || isProcessing}
                          className="p-1.5 border border-zinc-300 rounded-lg text-zinc-500 hover:text-[#22577A] hover:border-[#22577A]/40 hover:bg-blue-50 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed bg-white transition-colors"
                          title="Replace file"
                        >
                          <RefreshCw size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteItem(item)}
                        disabled={isUploading || isProcessing}
                        className="p-1.5 border border-zinc-300 rounded-lg text-zinc-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed bg-white transition-colors"
                        title="Delete resource"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table (hidden on mobile) ── */}
            <div className="hidden sm:block overflow-x-auto select-none">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 text-zinc-500 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Resource Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date Added</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const statusLower = item.status?.toLowerCase() || '';
                    const isUploading = statusLower === 'uploading';
                    const isProcessing = statusLower === 'processing';
                    const isReady = statusLower === 'ready';
                    const progress = uploadProgress[item.id];

                    return (
                      <tr key={item.id} className="border-b border-zinc-50 hover:bg-zinc-50/60 last:border-0 transition-colors">
                        <td className="py-3 px-3 font-semibold text-zinc-900 max-w-[220px]">
                          <div className="flex items-center gap-2.5">
                            {KNOWLEDGE_TYPE_ICONS[item.type] || <FileText size={16} className="text-zinc-400" />}
                            <span className="truncate text-sm" title={item.title}>{item.title}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 capitalize text-zinc-600 text-xs">{item.type}</td>
                        <td className="py-3 px-3 font-mono text-zinc-500 text-xs">{formatBytes(item.fileSize)}</td>
                        <td className="py-3 px-3">
                          {item.status === 'Uploading' ? (
                            <div className="flex items-center gap-1.5 text-[#22577A] font-semibold text-xs">
                              <Loader2 size={12} className="animate-spin" />
                              <span>Uploading {progress !== undefined ? `(${progress}%)` : ''}</span>
                            </div>
                          ) : item.status === 'Extracting' || item.status === 'Indexing' || item.status === 'Analyzing' ? (
                            <div className="flex items-center gap-1.5 text-[#22577A] bg-blue-50 px-2 py-0.5 border border-blue-200 rounded-full font-semibold text-[10px] w-max leading-none">
                              <Loader2 size={10} className="animate-spin" />
                              <span>Processing</span>
                            </div>
                          ) : item.status === 'Suggestions Ready' ? (
                            <div className="flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200 rounded-full font-semibold text-[10px] w-max leading-none">
                              <span>Suggestions Ready</span>
                            </div>
                          ) : item.status === 'Ready' ? (
                            <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 border border-green-200 rounded-full font-semibold text-[10px] w-max leading-none">
                              <CheckCircle2 size={10} className="text-green-600" />
                              <span>Ready</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-red-700 bg-red-50 px-2 py-0.5 border border-red-200 rounded-full font-semibold text-[10px] w-max leading-none">
                              <AlertCircle size={10} className="text-red-600" />
                              <span>Failed</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-zinc-500 text-xs">
                          {item.createdAt?.seconds 
                            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '-'
                          }
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {['pdf', 'docx', 'txt', 'md'].includes(item.type) && (
                              <button
                                onClick={() => triggerReplace(item.id)}
                                disabled={isUploading || isProcessing}
                                className="p-1.5 border border-zinc-300 rounded-lg text-zinc-500 hover:text-[#22577A] hover:border-[#22577A]/40 hover:bg-blue-50 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed bg-white transition-colors"
                                title="Replace file"
                              >
                                <RefreshCw size={12} />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteItem(item)}
                              disabled={isUploading || isProcessing}
                              className="p-1.5 border border-zinc-300 rounded-lg text-zinc-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed bg-white transition-colors"
                              title="Delete resource"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        </div>
      </div>

      {/* ─── Business Profile Suggestions ─── */}
      {(() => {
        const suggestionsByDoc: Record<string, any[]> = {};
        suggestions.forEach((sug) => {
          if (!suggestionsByDoc[sug.sourceDocument]) {
            suggestionsByDoc[sug.sourceDocument] = [];
          }
          suggestionsByDoc[sug.sourceDocument].push(sug);
        });

        const activeGroupCount = Object.keys(suggestionsByDoc).filter(title => !dismissedDocs.includes(title)).length;
        if (activeGroupCount === 0) return null;

        return (
          <div className="mt-6 bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4 animate-fade-in text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-3.5 gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 tracking-tight flex items-center leading-none">
                  AI Profile Suggestions
                </h3>
                <p className="text-xs text-zinc-700 mt-1 leading-relaxed">Review and apply extracted business profile facts.</p>
              </div>
              <div className="flex flex-wrap gap-1.5 self-end sm:self-center">
                <Button 
                  onClick={() => setConfirmApplyAll(true)} 
                  className="h-7.5 text-xs font-semibold px-3.5 border border-[#22577A] text-[#22577A] bg-white hover:bg-blue-50 rounded-xl cursor-pointer flex items-center justify-center shadow-none"
                >
                  Apply All
                </Button>
                <Button 
                  onClick={handleRejectAllSuggestions}
                  className="h-7.5 text-xs font-semibold px-3.5 border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-xl cursor-pointer flex items-center justify-center shadow-none"
                >
                  Reject All
                </Button>
              </div>
            </div>
            <div className="space-y-4">
              {Object.entries(suggestionsByDoc).map(([docTitle, docSugs]) => {
                if (dismissedDocs.includes(docTitle)) return null;

                const isDifferentBusiness = docSugs.some((sug) => sug.isDifferentBusiness);
                const displayFields: Record<string, string> = {
                  businessName: 'Business Name',
                  industry: 'Industry',
                  description: 'Business Description',
                  supportEmail: 'Support Email',
                  supportPhone: 'Support Phone',
                  website: 'Website',
                  productsServices: 'Products / Services',
                };

                if (isDifferentBusiness) {
                  return (
                    <div key={docTitle} className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-4">
                      {/* Warning text */}
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={16} />
                        <div>
                          <span className="text-sm font-semibold text-red-800 block">Different Business Detected</span>
                          <span className="text-xs text-red-700 block mt-0.5 leading-relaxed">
                            This document appears to describe a different business. Replace the current Business Profile, keep as RAG knowledge only, or cancel.
                          </span>
                        </div>
                      </div>

                      {/* Suggestions Grid */}
        <div className="space-y-2.5">
          {docSugs.map((sug) => {
            const isConflict = sug.type === 'conflict';
            return (
              <div key={sug.id} className="bg-white border border-red-150 rounded-xl p-3 text-xs flex flex-col gap-1.5 text-left">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-2.5 py-0.5 rounded-full capitalize">
                                  {displayFields[sug.fieldName] || sug.fieldName}
                                </span>
                                {isConflict ? (
                                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                    Conflicting Change
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                    New Profile Information
                                  </span>
                                )}
                                <span className="text-xs text-zinc-600">
                                  Source: <strong className="text-zinc-800 font-semibold">{sug.sourceDocument}</strong> | Confidence: <strong className="text-zinc-800 font-semibold">{Math.round((sug.confidenceScore || 0.9) * 100)}%</strong>
                                </span>
                              </div>

                              <div className="text-xs grid grid-cols-1 md:grid-cols-2 gap-2 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
                                <div>
                                  <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider mb-1">Current Value</span>
                                  <span className="font-mono text-zinc-800 not-italic block min-h-[14px]">
                                    {sug.oldValue ? sug.oldValue : '(unset)'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider mb-1">Suggested Value</span>
                                  <span className="font-mono text-green-700 font-semibold block">
                                    {sug.newValue}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-red-200">
                    <Button
                      onClick={() => setConfirmReplaceSug(docSugs[0])}
                      className="h-8 text-xs font-semibold px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl border-none cursor-pointer flex items-center justify-center shadow-sm flex-1 sm:flex-none"
                    >
                      Replace Profile
                    </Button>
                    <Button
                      onClick={() => handleKeepAsKnowledge(docSugs[0])}
                      className="h-8 text-xs font-semibold px-3 border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-xl cursor-pointer shadow-none flex-1 sm:flex-none justify-center"
                    >
                      Keep as Knowledge
                    </Button>
                    <Button
                      onClick={() => setDismissedDocs((prev) => [...prev, docTitle])}
                      className="h-8 text-xs font-semibold px-3 border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 hover:border-zinc-400 rounded-xl cursor-pointer shadow-none flex-1 sm:flex-none justify-center"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            }

            // Normal suggestions list
            return (
              <div key={docTitle} className="space-y-3">
              {docSugs.map((sug) => {
                const isSelected = selectedSugs.includes(sug.id);
                const isConflict = sug.type === 'conflict';
                return (
                  <div key={sug.id} className="bg-zinc-50/50 border border-zinc-150 rounded-xl p-3 shadow-3xs flex items-start gap-3 transition-all hover:bg-white text-left">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedSugs((prev) =>
                                prev.includes(sug.id) ? prev.filter((id) => id !== sug.id) : [...prev, sug.id]
                              );
                            }}
                            className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#22577A] focus:ring-[#22577A] cursor-pointer shrink-0"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-2.5 py-0.5 rounded-full capitalize">
                                {displayFields[sug.fieldName] || sug.fieldName}
                              </span>
                              {isConflict ? (
                                <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                  Conflicting Change
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                  New Profile Information
                                </span>
                              )}
                              <span className="text-xs text-zinc-700">
                                Source: <strong className="text-zinc-900 font-semibold">{sug.sourceDocument}</strong> | Confidence: <strong className="text-zinc-900 font-semibold">{Math.round((sug.confidenceScore || 0.9) * 100)}%</strong>
                              </span>
                            </div>

                            <div className="text-xs text-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-zinc-200/60">
                              <div>
                                <span className="text-[9px] text-zinc-600 font-bold block uppercase tracking-wider mb-1">Current Value</span>
                                <span className="font-mono text-zinc-800 not-italic block min-h-[14px]">
                                  {sug.oldValue ? sug.oldValue : '(unset)'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-zinc-600 font-bold block uppercase tracking-wider mb-1">Suggested Value</span>
                                <span className="font-mono text-green-800 font-semibold block">
                                  {sug.newValue}
                                </span>
                              </div>
                            </div>
                          </div>
                  <div className="flex gap-1.5 self-start sm:self-center shrink-0">
                    <Button 
                      onClick={() => handleApproveSuggestion(sug)} 
                      className="h-7 text-xs font-semibold px-3 bg-[#22577A] hover:bg-[#1A4461] text-white border-none cursor-pointer rounded-xl transition-all"
                    >
                      Apply
                    </Button>
                    <Button 
                      onClick={() => handleRejectSuggestion(sug)} 
                      variant="outline" 
                      className="h-7 text-xs font-semibold px-3 border-zinc-200 text-zinc-750 bg-white rounded-xl cursor-pointer"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
          </div>
        </div>
      );
    })()}

      {confirmReplaceSug && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-zinc-200 shadow-2xl space-y-4 text-left">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <AlertTriangle className="text-red-600" size={18} /> Confirm Profile Replacement
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Are you sure you want to replace the current Business Profile with the details from <span className="font-semibold text-zinc-900">&ldquo;{confirmReplaceSug.sourceDocument}&rdquo;</span>?
            </p>
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3.5 text-xs leading-relaxed">
              <strong>Warning:</strong> This will overwrite existing fields, back up the current profile for rollback, and clear all other old business fields (like Website or Products/Services) that are not present in the new document to avoid a mixed-business profile.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button
                onClick={() => setConfirmReplaceSug(null)}
                className="h-8.5 text-xs font-semibold border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 rounded-xl px-4 shadow-none"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleReplaceProfile(confirmReplaceSug);
                  setConfirmReplaceSug(null);
                }}
                className="h-8.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white border-none cursor-pointer rounded-xl px-4 shadow-sm"
              >
                Confirm Replace
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmApplyAll && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-zinc-200 shadow-2xl space-y-4 text-left">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} /> Apply All Suggestions?
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              This will apply <strong className="text-zinc-900">all {suggestions.length} pending suggestion{suggestions.length !== 1 ? 's' : ''}</strong> to your Business Profile at once. Individual fields will be updated with the suggested values.
            </p>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-3.5 text-xs leading-relaxed">
              <strong>Note:</strong> You can always roll back your profile using the Rollback button after applying.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button
                onClick={() => setConfirmApplyAll(false)}
                className="h-8.5 text-xs font-semibold border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 rounded-xl px-4 shadow-none"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleApplyAllSuggestions();
                  setConfirmApplyAll(false);
                }}
                className="h-8.5 text-xs font-semibold bg-[#22577A] hover:bg-[#1A4461] text-white border-none cursor-pointer rounded-xl px-4 shadow-sm"
              >
                Confirm Apply All
              </Button>
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}
