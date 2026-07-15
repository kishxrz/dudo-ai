'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FeatureGateProps {
  /** Feature key: 'whatsapp' | 'knowledge' | 'google' | 'calendar' | 'telegram' */
  feature: string;
  /** Rendered when user has access */
  children: React.ReactNode;
  /** Custom fallback. Defaults to a locked overlay card */
  fallback?: React.ReactNode;
  /** If true, renders children blurred with a lock overlay instead of replacing them */
  blur?: boolean;
  /** Extra class on the wrapper */
  className?: string;
}

export function FeatureGate({ feature, children, fallback, blur = false, className }: FeatureGateProps) {
  const { canUse, loading, isExpired } = useSubscriptionContext();
  const router = useRouter();

  if (loading) return <>{children}</>;

  const allowed = canUse(feature);

  if (allowed) return <>{children}</>;

  const locked = fallback ?? (
    <LockedOverlay
      feature={feature}
      isExpired={isExpired}
      onUpgrade={() => router.push('/dashboard/billing')}
    />
  );

  if (blur) {
    return (
      <div className={cn('relative', className)}>
        <div className="pointer-events-none select-none blur-sm opacity-50">{children}</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          {locked}
        </div>
      </div>
    );
  }

  return <div className={className}>{locked}</div>;
}

/**
 * Standalone locked page — no children required.
 * Use in layout-level guards to replace the full page content with a lock screen.
 */
export function LockedPage({ feature }: { feature: string }) {
  const { isExpired } = useSubscriptionContext();
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full">
      <LockedOverlay
        feature={feature}
        isExpired={isExpired}
        onUpgrade={() => router.push('/dashboard/billing')}
      />
    </div>
  );
}

function LockedOverlay({
  feature,
  isExpired,
  onUpgrade,
}: {
  feature: string;
  isExpired: boolean;
  onUpgrade: () => void;
}) {
  const label = featureLabel(feature);
  const message = isExpired
    ? `Your subscription has expired. Upgrade to unlock ${label}.`
    : `${label} requires an upgraded plan.`;

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-zinc-200 bg-white/80 backdrop-blur-sm shadow-sm text-center">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-100">
        <Lock className="w-5 h-5 text-zinc-400" />
      </div>
      <p className="text-sm font-semibold text-zinc-700 max-w-xs">{message}</p>
      <Button
        onClick={onUpgrade}
        className="h-8 text-xs bg-[#22577A] hover:bg-[#1A4461] text-white px-4 font-bold rounded-lg"
      >
        Upgrade Now
      </Button>
    </div>
  );
}

function featureLabel(feature: string): string {
  const map: Record<string, string> = {
    whatsapp: 'WhatsApp',
    'channels.whatsapp': 'WhatsApp',
    telegram: 'Telegram',
    'channels.telegram': 'Telegram',
    knowledge: 'Knowledge Base',
    google: 'Google Integrations',
    calendar: 'Google Calendar',
    booking: 'Appointments',
    conversations: 'AI Messages',
  };
  return map[feature] ?? 'this feature';
}
