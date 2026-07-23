'use client';

import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useWorkspace } from '@/hooks/useWorkspace';
import type { PlanLimits } from '@/lib/subscription/config';
import { PLAN_LIMITS } from '@/lib/subscription/config';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClientPlanId = 'trial' | 'monthly' | 'six_month';
export type ClientSubStatus = 'trial' | 'active' | 'cancelled' | 'expired' | 'paused' | 'past_due' | 'loading';

export interface ClientSubscription {
  plan: ClientPlanId;
  planId: ClientPlanId;
  planName: string;
  status: ClientSubStatus;
  startedAt: Date | null;
  expiresAt: Date | null;
  renewalDate: Date | null;
  cancelAtPeriodEnd: boolean;
  conversationCount: number;
  subscriptionId: string;
  customerId: string;
  price: number;
  currency: string;
}

export interface UseSubscriptionReturn {
  subscription: ClientSubscription | null;
  loading: boolean;
  /** Plan limits from the centralized config */
  limits: PlanLimits;
  /** True if user has a non-expired active or trial subscription */
  isActive: boolean;
  /** True if user is on the free trial (active) */
  isTrial: boolean;
  /** True if trial or subscription has expired */
  isExpired: boolean;
  /** True if cancelled (but may still be within the paid period) */
  isCancelled: boolean;
  /** Milliseconds remaining. null if perpetual / unknown */
  remainingMs: number | null;
  /** Human-readable remaining time string */
  remainingText: string;
  /** Can use a specific feature */
  canUse: (feature: string) => boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'object' && val !== null) {
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
    const d = new Date(val as string | number);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizePlan(raw: string | undefined | null): ClientPlanId {
  if (raw === '6months' || raw === 'six_month') return 'six_month';
  if (raw === 'monthly') return 'monthly';
  return 'trial';
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  if (mins > 0) return `${mins}m ${secs}s remaining`;
  return `${secs}s remaining`;
}

function clientCanUse(limits: PlanLimits, sub: ClientSubscription | null, feature: string): boolean {
  if (!sub) return false;
  const { status } = sub;
  if (status === 'expired' || status === 'paused') return false;

  if (feature === 'whatsapp' || feature === 'channels.whatsapp') return limits.whatsappAccess;
  if (feature === 'telegram' || feature === 'channels.telegram') return limits.allowedChannels.includes('telegram');
  if (feature === 'knowledge') return limits.knowledgeAccess;
  if (feature === 'google' || feature === 'calendar' || feature === 'booking') return limits.googleAccess || limits.bookingAccess;
  if (feature === 'conversations') return sub.conversationCount < limits.conversationLimit;
  if (feature.startsWith('api-providers.')) return limits.apiProviders.includes(feature.substring(14));
  return true;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubscription(): UseSubscriptionReturn {
  const { workspaceId } = useWorkspace();
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  // Live ticker for remaining time (1s interval for sub-1h / trial)
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!db || !workspaceId) {
      setLoading(false);
      return;
    }
    const subRef = doc(db, 'workspaces', workspaceId, 'billing', 'subscription');
    const unsub = onSnapshot(
      subRef,
      (snap) => {
        setRaw(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
        setLoading(false);
      },
      () => {
        setRaw(null);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [workspaceId]);

  const subscription = useMemo<ClientSubscription | null>(() => {
    if (!raw) return null;
    const plan = normalizePlan((raw.planId ?? raw.plan) as string);
    return {
      plan,
      planId: plan,
      planName: (raw.planName as string) ?? (plan === 'six_month' ? '6-Month Pack' : plan === 'monthly' ? 'Monthly Plan' : 'Free Trial'),
      status: (raw.status as ClientSubStatus) ?? 'trial',
      startedAt: parseDate(raw.startedAt ?? raw.startDate),
      expiresAt: parseDate(raw.expiresAt ?? raw.expiryDate),
      renewalDate: parseDate(raw.renewalDate ?? raw.nextBillingDate),
      cancelAtPeriodEnd: !!(raw.cancelAtPeriodEnd ?? raw.cancel_at_next_billing_date),
      conversationCount: (raw.conversationCount as number) ?? (raw.conversationsThisMonth as number) ?? 0,
      subscriptionId: (raw.subscriptionId as string) ?? '',
      customerId: (raw.customerId as string) ?? '',
      price: (raw.price as number) ?? 0,
      currency: (raw.currency as string) ?? '₹',
    };
  }, [raw]);

  const limits = useMemo<PlanLimits>(() => {
    if (!subscription) return PLAN_LIMITS.trial;
    return PLAN_LIMITS[subscription.plan] ?? PLAN_LIMITS.trial;
  }, [subscription]);

  const { isActive, isTrial, isExpired, isCancelled } = useMemo(() => {
    if (!subscription) return { isActive: false, isTrial: false, isExpired: false, isCancelled: false };
    const { status, expiresAt } = subscription;
    const expired = status === 'expired' || (expiresAt ? expiresAt.getTime() < now : false);
    const cancelled = status === 'cancelled';
    const cancelledAndExpired = cancelled && (expiresAt ? expiresAt.getTime() < now : true);
    const trial = status === 'trial' && !expired;
    const active = (status === 'active' || (cancelled && !cancelledAndExpired)) && !expired;
    return {
      isActive: active || trial,
      isTrial: trial,
      isExpired: expired || cancelledAndExpired,
      isCancelled: cancelled,
    };
  }, [subscription, now]);

  const remainingMs = useMemo<number | null>(() => {
    if (!subscription?.expiresAt) return null;
    const diff = subscription.expiresAt.getTime() - now;
    return diff > 0 ? diff : 0;
  }, [subscription, now]);

  const remainingText = useMemo(() => {
    if (loading) return '';
    if (!subscription) return '';
    if (isExpired) return 'Expired';
    if (subscription.plan !== 'trial' && !subscription.expiresAt) return 'Active';
    if (remainingMs === null) return 'Active';
    return formatRemaining(remainingMs);
  }, [loading, subscription, isExpired, remainingMs]);

  const canUse = useMemo(
    () => (feature: string) => {
      if (!isActive) return false;
      return clientCanUse(limits, subscription, feature);
    },
    [isActive, limits, subscription]
  );

  return {
    subscription,
    loading,
    limits,
    isActive,
    isTrial,
    isExpired,
    isCancelled,
    remainingMs,
    remainingText,
    canUse,
  };
}
