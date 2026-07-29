/**
 * SubscriptionService — Server-side canonical subscription service.
 *
 * This is the SINGLE source of truth for all subscription checks.
 * Every premium API route must use requireSubscription() from this module.
 * Never trust client-side state, LocalStorage, cookies, or React state.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import {
  PlanId,
  SubscriptionStatus,
  PlanLimits,
  PLAN_LIMITS,
  PLAN_META,
  getPlanIdFromProductId,
  normalizePlanId,
} from './config';

// ─── Firestore Subscription Document ─────────────────────────────────────────

export interface SubscriptionDoc {
  plan: PlanId;
  planId: PlanId;
  planName: string;
  status: SubscriptionStatus;
  startedAt: Date | null;
  expiresAt: Date | null;
  provider: string;           // 'internal' | 'dodo'
  subscriptionId: string;
  checkoutId: string;
  productId: string;
  paymentId: string;
  customerId: string;
  renewalDate: Date | null;
  cancelAtPeriodEnd: boolean;
  conversationCount: number;  // used for trial 5-message limit
  updatedAt: Date | null;
  // Legacy compat fields
  planName_legacy?: string;
  billingCycle?: string;
  price?: number;
  currency?: string;
  conversationLimit?: number;
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface SubscriptionCheckResult {
  allowed: boolean;
  plan: PlanId;
  status: SubscriptionStatus;
  limits: PlanLimits;
  subscription: SubscriptionDoc | null;
  reason?: string;
  code?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'object' && val !== null) {
    // Firestore Timestamp
    if ('toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate();
    }
    if ('seconds' in val && typeof (val as { seconds: number }).seconds === 'number') {
      return new Date((val as { seconds: number }).seconds * 1000);
    }
    if ('_seconds' in val && typeof (val as { _seconds: number })._seconds === 'number') {
      return new Date((val as { _seconds: number })._seconds * 1000);
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isExpired(sub: SubscriptionDoc): boolean {
  if (sub.status === 'expired') return true;
  if (!sub.expiresAt) return false;
  return sub.expiresAt.getTime() < Date.now();
}

// ─── Trial Initialization ──────────────────────────────────────────────────────

export async function initTrialSubscription(workspaceId: string): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) return;

  const subRef = adminDb.doc(`workspaces/${workspaceId}/billing/subscription`);
  const snap = await subRef.get();
  if (snap.exists) return; // already initialized — never overwrite

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PLAN_LIMITS.trial.durationMs);

  const trialDoc: Omit<SubscriptionDoc, 'updatedAt'> & { updatedAt: unknown; startedAt: unknown } = {
    plan: 'trial',
    planId: 'trial',
    planName: PLAN_META.trial.name,
    status: 'trial',
    startedAt: null,
    expiresAt,
    provider: 'internal',
    subscriptionId: '',
    checkoutId: '',
    productId: '',
    paymentId: '',
    customerId: '',
    renewalDate: null,
    cancelAtPeriodEnd: false,
    conversationCount: 0,
    updatedAt: null,
    // Legacy compat
    billingCycle: 'trial',
    price: 0,
    currency: '₹',
    conversationLimit: PLAN_LIMITS.trial.conversationLimit,
  };

  trialDoc.startedAt = FieldValue.serverTimestamp() as unknown as null;
  trialDoc.updatedAt = FieldValue.serverTimestamp() as unknown as null;

  await subRef.set(trialDoc);

  // Initialize usage doc
  await adminDb.doc(`workspaces/${workspaceId}/billing/usage`).set({
    conversationsThisMonth: 0,
    campaignsSentThisMonth: 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ─── Get Subscription ─────────────────────────────────────────────────────────

export async function getUserSubscription(workspaceId: string): Promise<SubscriptionDoc | null> {
  const adminDb = getAdminDb();
  if (!adminDb) return null;

  const subRef = adminDb.doc(`workspaces/${workspaceId}/billing/subscription`);
  const snap = await subRef.get();

  if (!snap.exists) {
    // Auto-initialize trial if doc is missing (defensive)
    await initTrialSubscription(workspaceId);
    const newSnap = await subRef.get();
    if (!newSnap.exists) return null;
    return buildSubDoc(newSnap.data()!);
  }

  const raw = snap.data()!;
  const sub = buildSubDoc(raw);

  // Lazy expiry: if expiresAt has passed, mark as expired immediately
  if (isExpired(sub) && sub.status !== 'expired') {
    await subRef.set({ status: 'expired', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    sub.status = 'expired';
  }

  return sub;
}

function buildSubDoc(raw: Record<string, unknown>): SubscriptionDoc {
  const rawPlanId = (raw.planId ?? raw.plan ?? 'trial') as string;
  const plan = normalizePlanId(rawPlanId);

  return {
    plan,
    planId: plan,
    planName: (raw.planName as string) ?? PLAN_META[plan].name,
    status: (raw.status as SubscriptionStatus) ?? 'trial',
    startedAt: parseDate(raw.startedAt ?? raw.startDate),
    expiresAt: parseDate(raw.expiresAt ?? raw.expiryDate),
    provider: (raw.provider as string) ?? 'internal',
    subscriptionId: (raw.subscriptionId as string) ?? '',
    checkoutId: (raw.checkoutId as string) ?? '',
    productId: (raw.productId as string) ?? '',
    paymentId: (raw.paymentId as string) ?? '',
    customerId: (raw.customerId as string) ?? '',
    renewalDate: parseDate(raw.renewalDate ?? raw.nextBillingDate),
    cancelAtPeriodEnd: !!(raw.cancelAtPeriodEnd ?? raw.cancel_at_next_billing_date),
    conversationCount: (raw.conversationCount as number) ?? (raw.conversationsThisMonth as number) ?? 0,
    updatedAt: parseDate(raw.updatedAt),
    billingCycle: (raw.billingCycle as string) ?? undefined,
    price: (raw.price as number) ?? undefined,
    currency: (raw.currency as string) ?? '₹',
    conversationLimit: (raw.conversationLimit as number) ?? PLAN_LIMITS[plan].conversationLimit,
  };
}

export async function getPlanLimits(workspaceId: string): Promise<PlanLimits> {
  const sub = await getUserSubscription(workspaceId);
  if (!sub || sub.status === 'expired') {
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
  return PLAN_LIMITS[sub.plan] ?? PLAN_LIMITS.trial;
}

// ─── Check Subscription ───────────────────────────────────────────────────────

export async function checkSubscription(
  workspaceId: string,
  feature?: string
): Promise<SubscriptionCheckResult> {
  const sub = await getUserSubscription(workspaceId);

  if (!sub) {
    return {
      allowed: false,
      plan: 'trial',
      status: 'expired',
      limits: PLAN_LIMITS.trial,
      subscription: null,
      reason: 'Subscription record not found. Please contact support.',
      code: 'SUBSCRIPTION_NOT_FOUND',
    };
  }

  const limits = PLAN_LIMITS[sub.plan] ?? PLAN_LIMITS.trial;

  // Expired check
  if (sub.status === 'expired' || isExpired(sub)) {
    return {
      allowed: false,
      plan: sub.plan,
      status: 'expired',
      limits,
      subscription: sub,
      reason: 'Your subscription has expired. Please upgrade to continue.',
      code: 'SUBSCRIPTION_EXPIRED',
    };
  }

  // Cancelled but still within period
  if (sub.status === 'cancelled') {
    const stillActive = sub.expiresAt && sub.expiresAt.getTime() > Date.now();
    if (!stillActive) {
      return {
        allowed: false,
        plan: sub.plan,
        status: 'expired',
        limits,
        subscription: sub,
        reason: 'Your subscription has ended. Please upgrade to continue.',
        code: 'SUBSCRIPTION_EXPIRED',
      };
    }
    // Still within cancel period — allow with current limits
  }

  // Paused check
  if (sub.status === 'paused') {
    return {
      allowed: false,
      plan: sub.plan,
      status: 'paused',
      limits,
      subscription: sub,
      reason: 'Your subscription is paused. Please resume to continue.',
      code: 'SUBSCRIPTION_PAUSED',
    };
  }

  // Feature-specific checks
  if (feature) {
    const featureAllowed = checkFeatureAccess(limits, sub, feature);
    if (!featureAllowed.allowed) {
      return {
        allowed: false,
        plan: sub.plan,
        status: sub.status,
        limits,
        subscription: sub,
        reason: featureAllowed.reason,
        code: featureAllowed.code,
      };
    }
  }

  return {
    allowed: true,
    plan: sub.plan,
    status: sub.status,
    limits,
    subscription: sub,
  };
}

// ─── Feature Access ───────────────────────────────────────────────────────────

function checkFeatureAccess(
  limits: PlanLimits,
  sub: SubscriptionDoc,
  feature: string
): { allowed: boolean; reason?: string; code?: string } {
  if (feature === 'channels.whatsapp' || feature === 'whatsapp') {
    if (!limits.whatsappAccess) {
      return {
        allowed: false,
        reason: 'WhatsApp is not available on your current plan. Please upgrade to unlock it.',
        code: 'FEATURE_NOT_AVAILABLE',
      };
    }
  }

  if (feature === 'channels.telegram' || feature === 'telegram') {
    if (!limits.allowedChannels.includes('telegram')) {
      return {
        allowed: false,
        reason: 'Telegram is not available on your current plan.',
        code: 'FEATURE_NOT_AVAILABLE',
      };
    }
  }

  if (feature === 'knowledge') {
    if (!limits.knowledgeAccess) {
      return {
        allowed: false,
        reason: 'Knowledge Base is not available on your current plan. Please upgrade to unlock it.',
        code: 'FEATURE_NOT_AVAILABLE',
      };
    }
  }

  if (feature === 'google' || feature === 'calendar' || feature === 'booking') {
    if (!limits.googleAccess && !limits.bookingAccess) {
      return {
        allowed: false,
        reason: 'Google integrations are not available on your current plan. Please upgrade to unlock them.',
        code: 'FEATURE_NOT_AVAILABLE',
      };
    }
  }

  if (feature === 'conversations') {
    const used = sub.conversationCount ?? 0;
    if (used >= limits.conversationLimit) {
      return {
        allowed: false,
        reason: `You have reached the ${limits.conversationLimit} message limit for your plan. Please upgrade to continue.`,
        code: 'USAGE_LIMIT_REACHED',
      };
    }
  }

  if (feature.startsWith('api-providers.')) {
    const provider = feature.substring(14);
    if (!limits.apiProviders.includes(provider)) {
      return {
        allowed: false,
        reason: `The AI provider '${provider}' is not available on your current plan. Please upgrade.`,
        code: 'FEATURE_NOT_AVAILABLE',
      };
    }
  }

  return { allowed: true };
}

// ─── requireSubscription middleware ──────────────────────────────────────────

/**
 * Call at the top of every premium API route.
 *
 * Returns a NextResponse (403) if access is denied, or null if allowed.
 *
 * Usage:
 *   const denied = await requireSubscription(req, workspaceId, 'channels.whatsapp');
 *   if (denied) return denied;
 */
export async function requireSubscription(
  req: NextRequest | Request,
  workspaceId: string,
  feature?: string,
  options: { requireAuth?: boolean } = { requireAuth: true }
): Promise<NextResponse | null> {
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Workspace ID is required.', code: 'MISSING_WORKSPACE_ID' },
      { status: 400 }
    );
  }

  // Verify Firebase auth token (workspace ownership)
  const adminDb = getAdminDb();
  if (adminDb) {
    const authHeader = (req as Request).headers.get('Authorization');
    
    if (options.requireAuth) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Unauthorized: Missing or invalid Authorization header.', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { getAuth } = await import('@/lib/firebase-admin');
        const token = authHeader.substring(7);
        const decoded = await getAuth().verifyIdToken(token);
        // Ensure the token owner matches the workspace (workspace ID = Firebase UID or workspace.ownerId = UID)
        if (decoded.uid !== workspaceId) {
          const wsSnap = await adminDb.doc(`workspaces/${workspaceId}`).get();
          const wsData = wsSnap.exists ? wsSnap.data() : null;
          if (!wsData || wsData.ownerId !== decoded.uid) {
            return NextResponse.json(
              { error: 'Forbidden: You do not own this workspace.', code: 'FORBIDDEN' },
              { status: 403 }
            );
          }
        }
      } catch {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid or expired authentication token.', code: 'UNAUTHORIZED' },
          { status: 401 }
        );
      }
    }
  }

  const result = await checkSubscription(workspaceId, feature);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: result.reason ?? 'Access denied. Please upgrade your subscription.',
        code: result.code ?? 'SUBSCRIPTION_REQUIRED',
        plan: result.plan,
        status: result.status,
      },
      { status: 403 }
    );
  }

  return null; // allowed
}

// ─── Increment conversation usage ─────────────────────────────────────────────

export async function incrementConversationCount(workspaceId: string): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) return;

  const subRef = adminDb.doc(`workspaces/${workspaceId}/billing/subscription`);
  await subRef.set(
    { conversationCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // Also keep billing/usage in sync for dashboard display
  await adminDb.doc(`workspaces/${workspaceId}/billing/usage`).set(
    { conversationsThisMonth: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

// ─── Upgrade subscription (called by webhook) ─────────────────────────────────

export async function upgradeSubscription(params: {
  workspaceId: string;
  plan: PlanId;
  subscriptionId?: string;
  checkoutId?: string;
  productId?: string;
  paymentId?: string;
  customerId?: string;
  expiresAt?: Date;
  cancelAtPeriodEnd?: boolean;
  status?: SubscriptionStatus;
}): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) return;

  const {
    workspaceId,
    plan,
    subscriptionId = '',
    checkoutId = '',
    productId = '',
    paymentId = '',
    customerId = '',
    expiresAt,
    cancelAtPeriodEnd = false,
    status = 'active',
  } = params;

  const meta = PLAN_META[plan];
  const limits = PLAN_LIMITS[plan];
  const now = new Date();
  const effectiveExpiry = expiresAt ?? new Date(now.getTime() + limits.durationMs);

  const payload = {
    plan,
    planId: plan,
    planName: meta.name,
    status,
    startedAt: FieldValue.serverTimestamp(),
    expiresAt: effectiveExpiry,
    provider: 'dodo',
    subscriptionId,
    checkoutId,
    productId,
    paymentId,
    customerId,
    renewalDate: effectiveExpiry,
    cancelAtPeriodEnd,
    conversationCount: 0, // Reset on new subscription
    updatedAt: FieldValue.serverTimestamp(),
    // Legacy compat
    billingCycle: meta.billingCycle,
    price: meta.price,
    currency: meta.currency,
    conversationLimit: limits.conversationLimit,
    // Keep these for billing page compat
    startDate: FieldValue.serverTimestamp(),
    expiryDate: effectiveExpiry,
    nextBillingDate: effectiveExpiry,
    autoRenew: !cancelAtPeriodEnd,
  };

  await adminDb.doc(`workspaces/${workspaceId}/billing/subscription`).set(payload, { merge: true });
}

// ─── Re-exports for backwards compat ─────────────────────────────────────────

export { PLAN_LIMITS, PLAN_META, getPlanIdFromProductId, normalizePlanId };
export type { PlanId, SubscriptionStatus, PlanLimits };
