import { db as clientDb } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface PlanLimits {
  allowedChannels: string[];
  agentLimit: number;
  maxEnabledSkills: number;
  apiProviders: string[];
  bookingAccess: boolean;
  supportLevel: 'standard' | 'priority' | 'none';
  conversationLimit: number;
  trialDurationMs: number;
}

export const PLAN_CONFIGS: Record<string, PlanLimits> = {
  trial: {
    allowedChannels: ['telegram'],
    agentLimit: 1,
    maxEnabledSkills: 2,
    apiProviders: ['openai', 'gemini'],
    bookingAccess: false,
    supportLevel: 'none',
    conversationLimit: 5,
    trialDurationMs: 24 * 60 * 60 * 1000,
  },
  monthly: {
    allowedChannels: ['telegram', 'whatsapp'],
    agentLimit: 1,
    maxEnabledSkills: 10,
    apiProviders: ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'deepseek', 'mistral'],
    bookingAccess: true,
    supportLevel: 'standard',
    conversationLimit: 100,
    trialDurationMs: 0,
  },
  '6months': {
    allowedChannels: ['telegram', 'whatsapp'],
    agentLimit: 1,
    maxEnabledSkills: 100,
    apiProviders: ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'deepseek', 'mistral'],
    bookingAccess: true,
    supportLevel: 'priority',
    conversationLimit: 1000,
    trialDurationMs: 0,
  }
};

async function updateSubscriptionStatus(workspaceId: string, status: string): Promise<void> {
  if (!clientDb) return;
  await setDoc(doc(clientDb, 'workspaces', workspaceId, 'billing', 'subscription'), { status }, { merge: true });
}

export async function getSubscriptionData(workspaceId: string): Promise<any> {
  if (!clientDb) return null;
  const docRef = doc(clientDb, 'workspaces', workspaceId, 'billing', 'subscription');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data();
  }
  return null;
}

export async function getOrInitSubscription(workspaceId: string): Promise<any> {
  if (!workspaceId) return null;
  let sub = await getSubscriptionData(workspaceId);
  if (sub) {
    const expiryDate = sub.expiryDate?.toDate ? sub.expiryDate.toDate() : sub.expiryDate ? new Date(sub.expiryDate) : null;
    if (expiryDate && expiryDate.getTime() < Date.now()) {
      if (sub.status !== 'expired') {
        sub.status = 'expired';
        await updateSubscriptionStatus(workspaceId, 'expired');
      }
    }
    return sub;
  }

  if (!clientDb) return null;
  const startDate = new Date();
  const expiryDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

  const defaultSub = {
    planId: 'trial',
    planName: 'Free Trial',
    price: 0,
    currency: '₹',
    billingCycle: 'trial',
    status: 'trial',
    startDate: startDate,
    expiryDate: expiryDate,
    nextBillingDate: expiryDate,
    autoRenew: false,
    conversationLimit: 5,
    campaignLimit: 0
  };

  await setDoc(doc(clientDb, 'workspaces', workspaceId, 'billing', 'subscription'), defaultSub);
  await setDoc(doc(clientDb, 'workspaces', workspaceId, 'billing', 'usage'), {
    conversationsThisMonth: 0,
    campaignsSentThisMonth: 0,
    updatedAt: new Date()
  });

  return defaultSub;
}

export async function getPlanLimits(workspaceId: string): Promise<PlanLimits> {
  const sub = await getOrInitSubscription(workspaceId);
  if (!sub || sub.status === 'expired') {
    return {
      allowedChannels: [],
      agentLimit: 0,
      maxEnabledSkills: 0,
      apiProviders: [],
      bookingAccess: false,
      supportLevel: 'none',
      conversationLimit: 0,
      trialDurationMs: 0
    };
  }

  const planId = sub.planId || 'trial';
  return PLAN_CONFIGS[planId] || PLAN_CONFIGS.trial;
}

export async function canUseFeature(workspaceId: string, feature: string): Promise<boolean> {
  const limits = await getPlanLimits(workspaceId);
  
  if (feature.startsWith('channels.')) {
    const channel = feature.substring(9);
    return limits.allowedChannels.includes(channel);
  }
  if (feature.startsWith('api-providers.')) {
    const provider = feature.substring(14);
    return limits.apiProviders.includes(provider);
  }
  if (feature === 'booking' || feature === 'calendar') {
    return limits.bookingAccess;
  }
  if (feature === 'skills') {
    return limits.maxEnabledSkills > 0;
  }
  return false;
}

export async function getUsageData(workspaceId: string): Promise<any> {
  if (!clientDb) return null;
  const snap = await getDoc(doc(clientDb, 'workspaces', workspaceId, 'billing', 'usage'));
  return snap.exists() ? snap.data() : null;
}

export async function checkUsageLimit(workspaceId: string, resource: string): Promise<boolean> {
  const limits = await getPlanLimits(workspaceId);
  if (resource === 'conversations') {
    const usage = await getUsageData(workspaceId);
    const used = usage?.conversationsThisMonth || 0;
    return used < limits.conversationLimit;
  }
  return true;
}

export async function incrementConversationUsage(workspaceId: string): Promise<void> {
  if (!clientDb) return;
  const docRef = doc(clientDb, 'workspaces', workspaceId, 'billing', 'usage');
  const snap = await getDoc(docRef);
  const current = snap.exists() ? snap.data()?.conversationsThisMonth || 0 : 0;
  await setDoc(docRef, {
    conversationsThisMonth: current + 1,
    updatedAt: new Date()
  }, { merge: true });
}

export async function upgradeSubscription(workspaceId: string, planId: string): Promise<void> {
  if (!clientDb) return;
  const startDate = new Date();
  let expiryDate = new Date();
  let planName = '';
  let price = 0;
  let billingCycle = '';
  let conversationLimit = 0;

  if (planId === 'monthly') {
    expiryDate.setDate(startDate.getDate() + 30);
    planName = 'Monthly Plan';
    price = 999;
    billingCycle = 'monthly';
    conversationLimit = 100;
  } else if (planId === '6months') {
    expiryDate.setMonth(startDate.getMonth() + 6);
    planName = '6-Month Pack';
    price = 2499;
    billingCycle = '6months';
    conversationLimit = 1000;
  } else {
    throw new Error(`Invalid plan ID: ${planId}`);
  }

  const payload = {
    planId,
    planName,
    price,
    currency: '₹',
    billingCycle,
    status: 'active',
    startDate,
    expiryDate,
    nextBillingDate: expiryDate,
    autoRenew: true,
    conversationLimit,
    campaignLimit: 0
  };

  await setDoc(doc(clientDb, 'workspaces', workspaceId, 'billing', 'subscription'), payload);
  const randId = Math.random().toString(36).substring(2, 15);
  await setDoc(doc(clientDb, 'workspaces', workspaceId, 'billing', 'history', 'records', randId), {
    date: startDate,
    planName,
    amount: price,
    currency: '₹',
    status: 'paid'
  });
}
