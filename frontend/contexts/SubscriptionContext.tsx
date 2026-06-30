// Powered by OnSpace.AI
// SAFAT — Subscription Context (API-driven)

import { createContext, ReactNode, useContext, useState, useEffect, useCallback } from 'react';
import { plans, PlanId, SubscriptionPlan } from '@/services/subscriptionPlans';
import { useAuth } from './AuthContext';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';

interface SubscriptionState {
  id: string | null;
  planId: PlanId;
  plan: SubscriptionPlan;
  renewDate: string;
  listingsUsed: number;
  liveMinutesUsed: number;
  loading: boolean;
}

interface SubscriptionContextValue {
  subscription: SubscriptionState;
  upgradePlan: (planId: PlanId) => void;
  refetchSubscription: () => Promise<void>;
}

const defaultPlan = plans.find((p) => p.id === 'free')!;

const defaultState: SubscriptionState = {
  id: null,
  planId: 'free',
  plan: defaultPlan,
  renewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  listingsUsed: 0,
  liveMinutesUsed: 0,
  loading: true,
};

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { accessToken, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>(defaultState);

  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      setSubscription((prev) => ({ ...prev, loading: false }));
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/api/subscriptions`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const data = json.data;
          const planId = (data.planId || 'free') as PlanId;
          const plan = plans.find((p) => p.id === planId) ?? defaultPlan;
          setSubscription({
            id: data.id ?? null,
            planId,
            plan,
            renewDate: data.renewDate || defaultState.renewDate,
            listingsUsed: data.listingsUsed ?? 0,
            liveMinutesUsed: data.liveMinutesUsed ?? 0,
            loading: false,
          });
          return;
        }
      }
    } catch (err) {
      console.warn('[SubscriptionContext] Failed to fetch subscription:', err);
    }
    setSubscription((prev) => ({ ...prev, loading: false }));
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const upgradePlan = (_planId: PlanId) => {
    // Subscription changes are applied via payment webhook — refetch from API
    fetchSubscription();
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, upgradePlan, refetchSubscription: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
