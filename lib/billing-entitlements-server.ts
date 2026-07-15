/**
 * billing-entitlements-server.ts
 *
 * Backward-compatible re-export wrapper around the canonical SubscriptionService.
 * New code should import directly from '@/lib/subscription/SubscriptionService'.
 * This file exists so existing API routes continue to compile without modification.
 */
import 'server-only';
import {
  getUserSubscription,
  checkSubscription,
  requireSubscription,
  incrementConversationCount,
  initTrialSubscription,
  upgradeSubscription as upgradeSubscriptionInternal,
  PLAN_LIMITS,
  PLAN_META,
} from '@/lib/subscription/SubscriptionService';

import type { PlanLimits } from '@/lib/subscription/config';

export type { PlanLimits };

export { PLAN_LIMITS as PLAN_CONFIGS };

export async function getSubscriptionData(workspaceId: string) {
  return getUserSubscription(workspaceId);
}

export async function getOrInitSubscription(workspaceId: string) {
  // Provision trial if no subscription doc exists, then return the doc (never null)
  await initTrialSubscription(workspaceId);
  const sub = await getUserSubscription(workspaceId);
  return sub!;
}


export async function getPlanLimits(workspaceId: string): Promise<PlanLimits> {
  const sub = await getUserSubscription(workspaceId);
  if (!sub) return PLAN_LIMITS.trial;
  const { status, plan } = sub;
  if (status === 'expired') {
    return {
      allowedChannels: [],
      agentLimit: 0,
      maxEnabledSkills: 0,
      apiProviders: [],
      bookingAccess: false,
      knowledgeAccess: false,
      whatsappAccess: false,
      googleAccess: false,
      conversationLimit: 0,
      supportLevel: 'none',
      durationMs: 0,
    };
  }
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial;
}

export async function canUseFeature(workspaceId: string, feature: string): Promise<boolean> {
  const result = await checkSubscription(workspaceId, feature);
  return result.allowed;
}

export async function getUsageData(workspaceId: string) {
  const sub = await getUserSubscription(workspaceId);
  return sub
    ? {
        conversationsThisMonth: sub.conversationCount ?? 0,
        campaignsSentThisMonth: 0,
        updatedAt: sub.updatedAt,
      }
    : null;
}

export async function checkUsageLimit(workspaceId: string, resource: string): Promise<boolean> {
  if (resource === 'conversations') {
    const result = await checkSubscription(workspaceId, 'conversations');
    return result.allowed;
  }
  return true;
}

export async function incrementConversationUsage(workspaceId: string): Promise<void> {
  return incrementConversationCount(workspaceId);
}

export { requireSubscription, checkSubscription, getUserSubscription };

/**
 * upgradeSubscription — backward-compat stub used by scripts/verify-billing-entitlements.ts.
 * In production, subscriptions are upgraded via Dodo webhooks only.
 * This function is only for test/script use.
 */
export async function upgradeSubscription(workspaceId: string, planId: string): Promise<void> {
  const { normalizePlanId } = await import('@/lib/subscription/config');
  const plan = normalizePlanId(planId);
  await upgradeSubscriptionInternal({ workspaceId, plan });
}


