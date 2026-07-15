/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-function-type, react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/contexts/AuthContext';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Wallet,
  ArrowUpRight,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageLayout } from '@/components/ui/PageLayout';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubscriptionData {
  planName?: string;
  planId?: string;
  price?: number;
  currency?: string;
  billingCycle?: string;     // 'monthly' | '6months' | 'trial'
  status?: string;           // 'active' | 'trial' | 'cancelled' | 'expired'
  nextBillingDate?: any;
  startDate?: any;
  autoRenew?: boolean;
  conversationLimit?: number;
  campaignLimit?: number;
  customerId?: string;
  subscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  paymentStatus?: string;
  expiryDate?: unknown;
  renewalDate?: unknown;
  trialExpiry?: unknown;
}

interface UsageData {
  conversationsThisMonth?: number;
  campaignsSentThisMonth?: number;
  updatedAt?: unknown;
}

interface PaymentMethod {
  type?: string;       // 'card' | 'upi' | 'netbanking'
  last4?: string;
  brand?: string;
  upiId?: string;
  expMonth?: number;
  expYear?: number;
}

interface BillingRecord {
  id: string;
  date: unknown;
  planName: string;
  amount: number;
  currency: string;
  status: string;   // 'paid' | 'pending' | 'failed'
  invoiceUrl?: string;
  paymentMethod?: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseDate = (d: unknown): Date | null => {
  if (!d) return null;
  if (typeof d === 'object' && d !== null && 'toDate' in d && typeof (d as { toDate: Function }).toDate === 'function') {
    return (d as { toDate: Function }).toDate();
  }
  if (typeof d === 'object' && d !== null && 'seconds' in d && typeof (d as { seconds: number }).seconds === 'number') {
    return new Date((d as { seconds: number }).seconds * 1000);
  }
  if (d instanceof Date) return d;
  if (typeof d === 'string' || typeof d === 'number') {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatDate = (d: unknown): string => {
  const parsed = parseDate(d);
  if (!parsed) return 'Not available';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const safePct = (used: number, limit: number): number => {
  if (!limit || !isFinite(limit) || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
};

// ─── Static plan definitions ─────────────────────────────────────────────────

const PLANS = [
  {
    id: 'trial',
    name: 'Free Trial',
    price: '₹0',
    period: '/30 min access',
    billingCycle: 'trial',
    features: [
      '30 Min Telegram Bot Trial',
      'Telegram Channel Only',
      '1 Custom AI assistant agent',
      'Connect & test in under 60 seconds',
      'Handover to human in 1-click',
    ],
  },
  {
    id: 'monthly',
    name: 'Monthly Plan',
    price: '₹999',
    period: '/month',
    billingCycle: 'monthly',
    features: [
      'WhatsApp + Telegram channels',
      '1 Custom AI assistant agent',
      'Handles bookings & scheduling',
      'Learns your custom menu & FAQ',
      'Google Calendar workspace sync',
      'Standard customer support',
    ],
  },
  {
    id: '6months',
    name: '6-Month Pack',
    price: '₹2,499',
    period: '/6 months',
    billingCycle: '6months',
    features: [
      '6 Months Full Pro Access',
      'WhatsApp + Telegram channels',
      '1 Custom AI assistant agent',
      'Handles bookings & scheduling',
      'Learns your custom menu & FAQ',
      'Priority 24/7 customer support',
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-zinc-200 rounded-xl shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4 pb-3 border-b border-zinc-100">
      <h2 className="text-[13px] font-bold text-zinc-800 leading-none">{title}</h2>
      {sub && <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === 'active') {
    return (
      <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Active
      </span>
    );
  }
  if (s === 'trial') {
    return (
      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
        <Clock size={10} />
        Trial
      </span>
    );
  }
  if (s === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
        <AlertCircle size={10} />
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-zinc-100 border border-zinc-200 text-zinc-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">
      {status || 'Unknown'}
    </span>
  );
}

function BillingStatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === 'paid') {
    return (
      <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        Paid
      </span>
    );
  }
  if (s === 'pending') {
    return (
      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        Pending
      </span>
    );
  }
  if (s === 'failed') {
    return (
      <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        Failed
      </span>
    );
  }
  if (s === 'refunded') {
    return (
      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
        Refunded
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full">
      {status}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { workspaceId } = useWorkspace();
  const { currentUser } = useAuth();
  const searchParams = useSearchParams();
  const checkoutAuto = searchParams.get('checkout_auto');

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [managingPortal, setManagingPortal] = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);
  const [resumingSub, setResumingSub] = useState(false);
  const [trialRemainingText, setTrialRemainingText] = useState('');

  useEffect(() => {
    if (subscription?.expiryDate) {
      const expiry = parseDate(subscription.expiryDate);
      if (!expiry) return;
      const updateText = () => {
        const diffMs = expiry.getTime() - Date.now();
        if (diffMs <= 0) {
          setTrialRemainingText('Expired');
        } else {
          const totalSecs = Math.floor(diffMs / 1000);
          const days = Math.floor(totalSecs / 86400);
          const hours = Math.floor((totalSecs % 86400) / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          if (days > 0) {
            setTrialRemainingText(`${days}d ${hours}h remaining`);
          } else if (hours > 0) {
            setTrialRemainingText(`${hours}h ${mins}m remaining`);
          } else {
            setTrialRemainingText(`${mins}m remaining`);
          }
        }
      };
      updateText();
      const interval = setInterval(updateText, 10000);
      return () => clearInterval(interval);
    } else {
      setTimeout(() => setTrialRemainingText(''), 0);
    }
  }, [subscription]);

  const handleUpgrade = async (planId: string) => {
    if (!workspaceId || !currentUser) return;
    setUpgradingId(planId);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ workspaceId, planId })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error('Failed to upgrade:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to initiate checkout session';
      alert(errMsg);
    } finally {
      setUpgradingId(null);
    }
  };

  useEffect(() => {
    if (checkoutAuto && (checkoutAuto === 'monthly' || checkoutAuto === '6months') && workspaceId && currentUser && !loading) {
      const params = new URLSearchParams(window.location.search);
      params.delete('checkout_auto');
      const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
      window.history.replaceState({}, '', newUrl);

      setTimeout(() => handleUpgrade(checkoutAuto), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutAuto, workspaceId, currentUser, loading]);

  const handleManageBilling = async () => {
    if (!workspaceId || !currentUser) return;
    setManagingPortal(true);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ workspaceId })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (err) {
      console.error('Failed to open customer portal:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to open billing portal';
      alert(errMsg);
    } finally {
      setManagingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel subscription auto-renewal?')) return;
    if (!workspaceId || !currentUser) return;
    setCancellingSub(true);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ workspaceId })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      alert('Subscription cancelled successfully.');
    } catch (err) {
      console.error('Failed to cancel:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to cancel subscription';
      alert(errMsg);
    } finally {
      setCancellingSub(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!workspaceId || !currentUser) return;
    setResumingSub(true);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/billing/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ workspaceId })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      alert('Subscription resumed successfully.');
    } catch (err) {
      console.error('Failed to resume:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to resume subscription';
      alert(errMsg);
    } finally {
      setResumingSub(false);
    }
  };

  // ─── Firestore real-time listeners ──────────────────────────────────────
  useEffect(() => {
    if (!db || !workspaceId) {
      setTimeout(() => setLoading(false), 0);
      return;
    }
    setTimeout(() => setLoading(true), 0);
    let resolved = 0;
    const done = () => { resolved++; if (resolved >= 2) setLoading(false); };

    // 1. Subscription doc
    const subRef = doc(db, 'workspaces', workspaceId, 'billing', 'subscription');
    const unsubSub = onSnapshot(subRef, (snap) => {
      setSubscription(snap.exists() ? (snap.data() as SubscriptionData) : null);
      done();
    }, () => { setSubscription(null); done(); });

    // 2. Usage doc
    const usageRef = doc(db, 'workspaces', workspaceId, 'billing', 'usage');
    const unsubUsage = onSnapshot(usageRef, (snap) => {
      setUsage(snap.exists() ? (snap.data() as UsageData) : null);
      done();
    }, () => { setUsage(null); done(); });

    // 3. Payment method doc (one-time read is fine)
    const pmRef = doc(db, 'workspaces', workspaceId, 'billing', 'paymentMethod');
    const unsubPm = onSnapshot(pmRef, (snap) => {
      setPaymentMethod(snap.exists() ? (snap.data() as PaymentMethod) : null);
    }, () => setPaymentMethod(null));

    // 4. Billing history collection
    const histRef = collection(db, 'workspaces', workspaceId, 'billing', 'history', 'records');
    const histQ = query(histRef, orderBy('date', 'desc'), limit(20));
    const unsubHist = onSnapshot(histQ, (snap) => {
      const records: BillingRecord[] = [];
      snap.forEach((d) => {
        const data = d.data();
        records.push({
          id: d.id,
          date: data.date,
          planName: data.planName || 'Plan',
          amount: data.amount || 0,
          currency: data.currency || '₹',
          status: data.status || 'paid',
          invoiceUrl: data.invoiceUrl,
          paymentMethod: data.paymentMethod || null
        });
      });
      setBillingHistory(records);
      setHistoryLoaded(true);
    }, () => { setBillingHistory([]); setHistoryLoaded(true); });

    return () => {
      unsubSub();
      unsubUsage();
      unsubPm();
      unsubHist();
    };
  }, [workspaceId]);

  // ─── Derived values ──────────────────────────────────────────────────────

  // Detect current plan from subscription data, fallback to planId matching
  const currentPlanId = subscription?.planId || subscription?.billingCycle || null;
  const currentPlanDef = PLANS.find((p) =>
    p.id === currentPlanId ||
    p.billingCycle === currentPlanId ||
    p.name.toLowerCase() === subscription?.planName?.toLowerCase()
  );

  const planName = subscription?.planName || currentPlanDef?.name || 'No Active Plan';
  const planStatus = subscription?.status || null;

  const convLimit = subscription?.conversationLimit ?? null;
  const campLimit = subscription?.campaignLimit ?? null;
  const convUsed = usage?.conversationsThisMonth ?? null;
  const campUsed = usage?.campaignsSentThisMonth ?? null;

  const convPct = (convUsed !== null && convLimit !== null && convLimit > 0)
    ? safePct(convUsed, convLimit) : null;
  const campPct = (campUsed !== null && campLimit !== null && campLimit > 0)
    ? safePct(campUsed, campLimit) : null;

  const nextBilling = formatDate(subscription?.nextBillingDate);
  const autoRenew = subscription?.autoRenew ?? null;

  // Price display
  const priceDisplay = subscription?.price !== undefined
    ? `${subscription.currency || '₹'}${subscription.price}${
        subscription.billingCycle === 'monthly' ? '/month'
        : subscription.billingCycle === '6months' ? '/6 months'
        : subscription.billingCycle === 'trial' ? ' trial'
        : ''
      }`
    : currentPlanDef
      ? `${currentPlanDef.price}${currentPlanDef.period}`
      : null;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageLayout className="max-w-[1200px] w-full mx-auto gap-5 px-6 box-border">
        <div className="flex flex-col gap-5">
          <LoadingSkeleton rows={1} type="text" />
          <LoadingSkeleton rows={3} type="card" />
          <div className="grid grid-cols-2 gap-4">
            <LoadingSkeleton rows={2} type="card" />
            <LoadingSkeleton rows={2} type="card" />
          </div>
        </div>
      </PageLayout>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <PageLayout className="max-w-[1200px] w-full mx-auto gap-5 px-6 box-border">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#22577A]/10 flex items-center justify-center shrink-0 mt-0.5">
            <CreditCard size={20} className="text-[#22577A]" />
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-zinc-950 tracking-tight leading-none mb-1.5">
              Billing
            </h1>
            <p className="text-sm text-zinc-500 max-w-xl leading-relaxed">
              Manage your plan, usage, and payment details.
            </p>
          </div>
        </div>
      </div>

      {/* ── Current Plan ──────────────────────────────────────────────────── */}
      <div className={cn(
        'border rounded-xl p-5 shadow-sm',
        subscription
          ? 'bg-[#22577A]/5 border-[#22577A]/20'
          : 'bg-zinc-50 border-zinc-200'
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: plan info */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[17px] font-bold text-zinc-950 leading-none">{planName}</span>
              {planStatus && <StatusBadge status={planStatus} />}
            </div>

            {priceDisplay && (
              <p className="text-2xl font-black text-zinc-950 tracking-tight font-mono leading-none">
                {priceDisplay}
              </p>
            )}

            <p className="text-[11px] text-zinc-400 font-medium">
              {subscription
                ? <>
                    {subscription.planId === 'trial' ? (
                      <span className="text-amber-600 font-bold">{trialRemainingText}</span>
                    ) : (
                      <>
                        Next billing: {nextBilling}
                        {autoRenew !== null && (
                          <span className="ml-1.5">
                            · {autoRenew ? 'Renews automatically' : 'Will not auto-renew'}
                          </span>
                        )}
                      </>
                    )}
                  </>
                : 'No active subscription found in your account.'
              }
            </p>

            {/* Dodo Subscription Detail Fields */}
            {subscription && (
              <div className="space-y-0.5 mt-2 pt-2 border-t border-zinc-100">
                {subscription.startDate && (
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Started Date: <span className="text-zinc-650 font-bold">{formatDate(subscription.startDate)}</span>
                  </p>
                )}
                {subscription.expiryDate && (
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Expiry Date: <span className="text-zinc-650 font-bold">{formatDate(subscription.expiryDate)}</span>
                  </p>
                )}
                {trialRemainingText && (
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Remaining Time: <span className="text-amber-600 font-bold">{trialRemainingText}</span>
                  </p>
                )}
                {subscription.subscriptionId && (
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Subscription ID: <span className="text-zinc-650 font-bold select-all">{subscription.subscriptionId}</span>
                  </p>
                )}
                {subscription.customerId && (
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Customer ID: <span className="text-zinc-650 font-bold select-all">{subscription.customerId}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {subscription && subscription.planId !== 'trial' && (
              <Button
                onClick={handleManageBilling}
                disabled={managingPortal}
                className="h-8 px-3.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-semibold rounded-xl shadow-sm text-[12px] cursor-pointer transition-all hover:scale-[1.01]"
              >
                {managingPortal ? 'Opening Portal...' : 'Manage Billing'}
              </Button>
            )}

            {/* Programmatic Cancel / Resume buttons */}
            {subscription && subscription.planId !== 'trial' && subscription.status === 'active' && (
              subscription.cancelAtPeriodEnd ? (
                <Button
                  onClick={handleResumeSubscription}
                  disabled={resumingSub}
                  className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm text-[12px] border-none cursor-pointer transition-all hover:scale-[1.01]"
                >
                  {resumingSub ? 'Resuming...' : 'Resume Subscription'}
                </Button>
              ) : (
                <Button
                  onClick={handleCancelSubscription}
                  disabled={cancellingSub}
                  className="h-8 px-3.5 bg-red-650 hover:bg-red-750 text-white font-semibold rounded-xl shadow-sm text-[12px] border-none cursor-pointer transition-all hover:scale-[1.01]"
                >
                  {cancellingSub ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
              )
            )}

            {(!subscription || subscription.billingCycle !== '6months') && (
              <Button 
                onClick={() => handleUpgrade('6months')}
                disabled={upgradingId === '6months'}
                className="h-8 px-3.5 bg-[#22577A] hover:bg-[#1A4461] text-white font-semibold rounded-xl shadow-sm text-[12px] border-none cursor-pointer transition-all hover:scale-[1.01]"
              >
                {upgradingId === '6months' ? 'Upgrading...' : 'Upgrade to 6-Month Pack'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Usage This Month ──────────────────────────────────────────────── */}
      <Card>
        <SectionLabel title="Usage This Month" sub="Real-time usage tracked against your plan limits" />

        {!subscription && !usage ? (
          <p className="text-[12px] text-zinc-400 font-medium py-2">
            No usage data available. Usage will appear once your plan is active.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Conversations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px] font-semibold text-zinc-700">
                <span>Conversations</span>
                {convLimit === null || convLimit === 0 ? (
                  <span className="text-zinc-400 font-mono">
                    {convUsed !== null ? convUsed.toLocaleString() : '—'} / Unlimited
                  </span>
                ) : (
                  <span className="text-zinc-400 font-mono">
                    {convUsed !== null ? convUsed.toLocaleString() : '—'} / {convLimit.toLocaleString()}
                  </span>
                )}
              </div>

              {convLimit === null || convLimit === 0 ? (
                <div className="h-2 rounded-full bg-zinc-100 flex items-center px-2">
                  <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wide">Unlimited</span>
                </div>
              ) : convUsed !== null && convPct !== null ? (
                <>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200/30">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        convPct > 85 ? 'bg-red-500' : convPct > 65 ? 'bg-amber-500' : 'bg-[#22577A]'
                      )}
                      style={{ width: `${convPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide',
                      convPct > 85 ? 'text-red-500' : 'text-zinc-400'
                    )}>
                      {convPct}% used
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium">
                      {(convLimit - convUsed).toLocaleString()} remaining
                    </p>
                  </div>
                </>
              ) : (
                <div className="h-2 rounded-full bg-zinc-100" />
              )}
            </div>

            {/* Campaigns Sent */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px] font-semibold text-zinc-700">
                <span>Campaigns Sent</span>
                {campLimit === null || campLimit === 0 ? (
                  <span className="text-zinc-400 font-mono">
                    {campUsed !== null ? campUsed : '—'} / Unlimited
                  </span>
                ) : (
                  <span className="text-zinc-400 font-mono">
                    {campUsed !== null ? campUsed : '—'} / {campLimit}
                  </span>
                )}
              </div>

              {campLimit === null || campLimit === 0 ? (
                <div className="h-2 rounded-full bg-zinc-100 flex items-center px-2">
                  <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wide">Unlimited</span>
                </div>
              ) : campUsed !== null && campPct !== null ? (
                <>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200/30">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        campPct > 85 ? 'bg-red-500' : campPct > 65 ? 'bg-amber-500' : 'bg-[#22577A]'
                      )}
                      style={{ width: `${campPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide',
                      campPct > 85 ? 'text-red-500' : 'text-zinc-400'
                    )}>
                      {campPct}% used
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium">
                      {(campLimit - campUsed)} remaining
                    </p>
                  </div>
                </>
              ) : (
                <div className="h-2 rounded-full bg-zinc-100" />
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Plan Features ─────────────────────────────────────────────────── */}
      <Card>
        <SectionLabel title="Plan Features" sub="Compare plans and switch anytime" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {PLANS.map((plan) => {
            const isCurrent =
              plan.id === currentPlanId ||
              plan.billingCycle === currentPlanId ||
              plan.name.toLowerCase() === subscription?.planName?.toLowerCase();

            return (
              <div
                key={plan.id}
                className={cn(
                  'border rounded-xl p-4 flex flex-col gap-4 transition-all duration-200',
                  isCurrent
                    ? 'border-[#22577A] bg-[#22577A]/5 shadow-sm'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm'
                )}
              >
                {/* Plan name + badge */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-zinc-800 uppercase tracking-wide">
                    {plan.name}
                  </span>
                  {isCurrent && (
                    <span className="bg-[#22577A] text-white text-[9px] font-bold px-2 py-0.5 rounded-full leading-none">
                      Current Plan
                    </span>
                  )}
                </div>

                {/* Price */}
                <div>
                  <span className="text-xl font-black text-zinc-950 tracking-tight font-mono">
                    {plan.price}
                  </span>
                  <span className="text-[10px] font-medium text-zinc-400 ml-0.5">{plan.period}</span>
                </div>

                {/* Features */}
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[11px] text-zinc-600 font-medium leading-relaxed">
                      <CheckCircle2 size={12} className="text-[#22577A] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Action button */}
                {!isCurrent && (
                  <Button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgradingId !== null || plan.id === 'trial'}
                    className={cn(
                      'w-full h-8 rounded-lg text-[12px] font-semibold border cursor-pointer transition-all hover:scale-[1.01] mt-1',
                      plan.id === '6months'
                        ? 'bg-[#22577A] hover:bg-[#1A4461] text-white border-none'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    )}
                  >
                    {upgradingId === plan.id ? 'Upgrading...' : plan.id === 'trial' ? 'Start Trial' : plan.id === '6months' ? 'Upgrade' : 'Select Plan'}
                  </Button>
                )}

                {isCurrent && (
                  <div className="h-8 flex items-center justify-center">
                    <span className="text-[11px] text-[#22577A] font-semibold">✓ Your current plan</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Payment & Billing ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Payment Method */}
        <Card>
          <SectionLabel title="Payment Method" />
          {paymentMethod ? (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                <Wallet size={16} className="text-zinc-500" />
              </div>
              <div className="min-w-0">
                {paymentMethod.type === 'card' && (
                  <>
                    <p className="text-[13px] font-bold text-zinc-800">
                      {paymentMethod.brand || 'Card'} •••• {paymentMethod.last4 || '——'}
                    </p>
                    <p className="text-[11px] text-zinc-400 font-medium">
                      Expires {paymentMethod.expMonth}/{paymentMethod.expYear}
                    </p>
                  </>
                )}
                {paymentMethod.type === 'upi' && (
                  <>
                    <p className="text-[13px] font-bold text-zinc-800">UPI</p>
                    <p className="text-[11px] text-zinc-400 font-medium truncate">
                      {paymentMethod.upiId || 'Not available'}
                    </p>
                  </>
                )}
                {!paymentMethod.type && (
                  <p className="text-[13px] font-bold text-zinc-800">Payment method on file</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
                <CreditCard size={16} className="text-zinc-400" />
              </div>
              <p className="text-[12px] text-zinc-500 font-medium">No payment method added</p>
              <p className="text-[11px] text-zinc-400">Add a card or UPI to enable billing.</p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-zinc-100">
            <Button
              onClick={handleManageBilling}
              disabled={managingPortal}
              className="w-full h-8 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-[12px] font-semibold cursor-pointer transition-all"
            >
              {managingPortal ? 'Opening Portal...' : paymentMethod ? 'Update Payment Method' : 'Add Payment Method'}
            </Button>
          </div>
        </Card>

        {/* Billing History / Invoice Section */}
        <Card className="lg:col-span-2">
          <SectionLabel title="Billing History & Invoices" sub="Your recent transactions, payment methods, and downloadable invoices" />

          {!historyLoaded ? (
            <div className="py-6 flex items-center justify-center">
              <RefreshCw size={16} className="text-zinc-400 animate-spin" />
            </div>
          ) : billingHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                <Receipt size={18} className="text-zinc-400" />
              </div>
              <p className="text-[12px] text-zinc-500 font-medium">No billing records yet</p>
              <p className="text-[11px] text-zinc-400">
                Transactions will appear here after your first payment.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-left min-w-[550px]">
                <thead>
                  <tr className="border-b border-zinc-100">
                    {['Date', 'Plan', 'Amount', 'Status', 'Payment Method', 'Invoice'].map((h) => (
                      <th
                        key={h}
                        className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide pb-2 px-1"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {billingHistory.map((rec) => {
                    const pm = rec.paymentMethod as any;
                    let pmString = '—';
                    if (pm) {
                      if (pm.type === 'card' || pm.card) {
                        const card = pm.card || pm;
                        pmString = `${card.brand || 'Card'} •••• ${card.last4 || ''}`;
                      } else if (pm.type === 'upi' || pm.upi) {
                        const upi = pm.upi || pm;
                        pmString = `UPI (${upi.id || upi.upi_id || 'Active'})`;
                      } else if (pm.type) {
                        pmString = pm.type.toUpperCase();
                      }
                    }

                    return (
                      <tr
                        key={rec.id}
                        className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors"
                      >
                        <td className="py-2.5 px-1 text-[12px] text-zinc-600 font-medium whitespace-nowrap">
                          {formatDate(rec.date)}
                        </td>
                        <td className="py-2.5 px-1 text-[12px] text-zinc-700 font-semibold truncate max-w-[120px]">
                          {rec.planName}
                        </td>
                        <td className="py-2.5 px-1 text-[12px] text-zinc-800 font-bold font-mono whitespace-nowrap">
                          {rec.currency}{rec.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-1">
                          <BillingStatusBadge status={rec.status} />
                        </td>
                        <td className="py-2.5 px-1 text-[11px] text-zinc-500 font-medium whitespace-nowrap">
                          {pmString}
                        </td>
                        <td className="py-2.5 px-1">
                          {rec.invoiceUrl ? (
                            <a
                              href={rec.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-[#22577A] font-semibold hover:underline"
                            >
                              Download <ArrowUpRight size={10} />
                            </a>
                          ) : (
                            <span className="text-[11px] text-zinc-350 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>

    </PageLayout>
  );
}
