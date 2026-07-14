// @ts-nocheck
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { WorkspaceContext } from './types/WorkspaceContext';
import { KnowledgeService } from './KnowledgeService';
import { SkillService, SkillDefinition } from './SkillService';

const LEGACY_ID_MAP: Record<string, string> = {
  'faq-bot': 'customer-support-general-helpdesk-faq',
  'complaint-handler': 'customer-support-complaint-triage-and-escalation-dispute',
  'order-tracker': 'customer-support-order-status-tracking-status',
  'returns-refunds': 'customer-support-returns-and-exchange-triage',
  'it-architect': 'customer-support-software-troubleshooting-diagnose',
  'system-updater': 'customer-support-software-troubleshooting-update',
  'local-faq-handler': 'customer-support-local-store-faqs-faq',
  'furniture-disposal': 'customer-support-local-store-faqs-action',
  'recruiter': 'customer-support-live-callback-requests-action',
  'context-memory': 'customer-support-account-access-and-mfa-update',
  'study-companion': 'education-learning-study-planners-faq',
  'whatsapp-phone-detect': 'customer-support-account-access-and-mfa-triage',
  'furniture-sortti': 'customer-support-local-store-faqs-action',
  'price-time-calculator': 'customer-support-billing-disputes-action',
  'dm-support': 'communication-tone-switcher-triage',
  'driver-handoff': 'customer-support-live-callback-requests-escalate',
  'critical-handoff': 'customer-support-live-callback-requests-escalate',
  'lead-gen': 'sales-marketing-bant-lead-qualification-triage',
  'product-recommender': 'sales-marketing-product-matches-and-recommendations-action',
  'promo-announcer': 'sales-marketing-promo-and-coupon-distribution-faq',
};

export class WorkspaceContextLoader {
  static async load(
    workspaceId: string,
    requestedProviderName?: string,
    clientApiKey?: string       // Optional: key already loaded by the authenticated client
  ): Promise<WorkspaceContext> {
    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    const adminDb = getAdminDb();
    let enabledSkills: Skill[] = [];

    // 1. Load Assistant Config
    let assistant = {
      name: "My AI Assistant",
      systemPrompt: "You are a helpful customer support agent for Dudo reception desk. Keep responses simple and concise.",
      timezone: 'Asia/Kolkata',
      status: 'draft' as const,
      whatsappAdmins: '',
      telegramAdmins: '',
      bossCode: ''
    };

    let provider = {
      name: requestedProviderName || 'openai',
      model: '',
      apiKey: ''
    };
    let activeProvDoc: { name: string; model?: string; apiKey?: string } | null = null;
    let providerDocs: any[] = [];
    let knowledge = '';

    if (adminDb || db) {
      try {
        const assistantPath = `workspaces/${workspaceId}/assistants/assistant-1`;
        const providerPath = `workspaces/${workspaceId}/providers`;

        const [assSnap, resolvedSkills, providersSnap, loadedKnowledge] = await Promise.all([
          adminDb ? adminDb.doc(assistantPath).get() : getDoc(doc(db!, 'workspaces', workspaceId, 'assistants', 'assistant-1')),
          SkillService.resolveEnabledSkills(workspaceId),
          adminDb ? adminDb.collection(providerPath).get() : getDocs(collection(db!, 'workspaces', workspaceId, 'providers')),
          KnowledgeService.getStaticKnowledge(workspaceId)
        ]);

        const assistantExists = typeof assSnap.exists === 'function' ? assSnap.exists() : assSnap.exists;
        if (assistantExists) {
          const data = assSnap.data();
          if (data) {
            assistant = {
              name: data.name || assistant.name,
              systemPrompt: data.systemPrompt || assistant.systemPrompt,
              timezone: data.timezone || assistant.timezone,
              status: data.status || assistant.status,
              whatsappAdmins: data.whatsappAdmins || '',
              telegramAdmins: data.telegramAdmins || '',
              bossCode: data.bossCode || ''
            };
          }
        }

        enabledSkills = resolvedSkills;
        providerDocs = providersSnap.docs || [];
        knowledge = loadedKnowledge;

        // Process providers from parallel load
        console.log('[WorkspaceContextLoader] Reading providers from path: ' + providerPath);
        console.log('[WorkspaceContextLoader] Provider docs found:', providerDocs.length);
        providerDocs.forEach((providerDoc) => {
          const data = providerDoc.data();
          console.log('[WorkspaceContextLoader] Doc:', providerDoc.id, '| active:', data.active, '| hasApiKey:', !!data.apiKey);
          if (data.active === true && data.apiKey) {
            activeProvDoc = { name: providerDoc.id, ...data };
          }
        });

        // Fallback: if no active provider was set, query the requested one
        if (!activeProvDoc && requestedProviderName) {
          const snap = adminDb
            ? await adminDb.doc(`workspaces/${workspaceId}/providers/${requestedProviderName}`).get()
            : await getDoc(doc(db!, 'workspaces', workspaceId, 'providers', requestedProviderName));
          const providerExists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
          if (providerExists && snap.data()?.apiKey) {
            activeProvDoc = { name: requestedProviderName, ...snap.data() };
          }
        }

        // Second fallback: pick the first connected provider
        if (!activeProvDoc) {
          providerDocs.forEach((providerDoc) => {
            const data = providerDoc.data();
            if (data.apiKey && !activeProvDoc) {
              activeProvDoc = { name: providerDoc.id, ...data };
            }
          });
        }

        if (activeProvDoc) {
          console.log('[WorkspaceContextLoader] Resolved provider from Firestore:', activeProvDoc.name);
          if (clientApiKey && requestedProviderName) {
            // Client already supplied the key — only update model from Firestore
            provider.model = activeProvDoc.model || '';
          } else {
            // No client key — use full Firestore payload
            provider = {
              name: activeProvDoc.name,
              model: activeProvDoc.model || '',
              apiKey: activeProvDoc.apiKey || ''
            };
          }
        } else {
          console.warn('[WorkspaceContextLoader] No provider with apiKey found in Firestore.');
        }

      } catch (e) {
        console.error('[WorkspaceContextLoader] Firestore parallel read FAILED:', e);
      }
    } else {
      console.error('[WorkspaceContextLoader] db is null — Firebase not initialized on server.');
    }

    // Use the client-supplied API key directly when available if it wasn't resolved
    if (clientApiKey && requestedProviderName && !provider.apiKey) {
      console.log('[WorkspaceContextLoader] Using client-supplied apiKey for:', requestedProviderName);
      provider.apiKey = clientApiKey;
    }

    // 3. Environment variable fallback
    if (!provider.apiKey) {
      if (provider.name === 'openai') {
        provider.apiKey = process.env.OPENAI_API_KEY || '';
      } else if (provider.name === 'gemini') {
        provider.apiKey = process.env.GEMINI_API_KEY || '';
      } else if (provider.name === 'anthropic') {
        provider.apiKey = process.env.ANTHROPIC_API_KEY || '';
      } else if (provider.name === 'groq') {
        provider.apiKey = process.env.GROQ_API_KEY || '';
      }
    }

    // Assign default models if undefined
    if (!provider.model) {
      if (provider.name === 'openai') provider.model = 'gpt-4o-mini';
      else if (provider.name === 'gemini') provider.model = 'gemini-2.5-flash';
      else if (provider.name === 'anthropic') provider.model = 'claude-3-5-haiku-latest';
      else if (provider.name === 'groq') provider.model = 'llama-3.3-70b-versatile';
      else if (provider.name === 'openrouter') provider.model = 'openrouter-best-value';
      else if (provider.name === 'deepseek') provider.model = 'deepseek-chat';
      else if (provider.name === 'mistral') provider.model = 'mistral-large-latest';
    }

    console.log('[WorkspaceContextLoader] Knowledge loaded statically', {
      workspaceId,
      knowledgeLength: knowledge.length,
      knowledge,
    });

    return {
      workspaceId,
      assistant,
      provider,
      knowledge,
      enabledSkills
    };
  }
}
