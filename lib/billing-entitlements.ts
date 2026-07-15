import { db as clientDb } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { PlanId, PLAN_LIMITS, normalizePlanId } from './subscription/config';

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

// Map PLAN_LIMITS from config to the legacy client interface
function mapLimitsToLegacy(plan: PlanId): PlanLimits {
  const limits = PLAN_LIMITS[plan];
  return {
    allowedChannels: limits.allowedChannels,
    agentLimit: limits.agentLimit,
    maxEnabledSkills: limits.maxEnabledSkills,
    apiProviders: limits.apiProviders,
    bookingAccess: limits.bookingAccess,
    supportLevel: limits.supportLevel === 'priority' ? 'priority' : limits.supportLevel === 'standard' ? 'standard' : 'none',
    conversationLimit: limits.conversationLimit,
    trialDurationMs: limits.durationMs,
  };
}

async function updateSubscriptionStatus(workspaceId: string, status: string): Promise<void> {
  if (!clientDb) return;
  await setDoc(doc(clientDb, 'workspaces', workspaceId, 'billing', 'subscription'), { status }, { merge: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSubscriptionData(workspaceId: string): Promise<any> {
  if (!clientDb) return null;
  const docRef = doc(clientDb, 'workspaces', workspaceId, 'billing', 'subscription');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data();
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getOrInitSubscription(workspaceId: string): Promise<any> {
  if (!workspaceId) return null;
  const sub = await getSubscriptionData(workspaceId);
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
  return null;
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

  const rawPlanId = sub.planId || sub.plan || 'trial';
  const plan = normalizePlanId(rawPlanId);
  return mapLimitsToLegacy(plan);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const expiryDate = new Date();
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
