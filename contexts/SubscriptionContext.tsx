'use client';

import React, { createContext, useContext } from 'react';
import { useSubscription, UseSubscriptionReturn } from '@/hooks/useSubscription';

const SubscriptionContext = createContext<UseSubscriptionReturn | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const subscription = useSubscription();
  return (
    <SubscriptionContext.Provider value={subscription}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): UseSubscriptionReturn {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscriptionContext must be used within SubscriptionProvider');
  return ctx;
}
