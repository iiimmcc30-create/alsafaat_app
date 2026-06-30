import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/services/api';
import type { PlanId, SubscriptionPlan } from '@/services/subscriptionPlans';
import { plans as fallbackPlans } from '@/services/subscriptionPlans';

export function usePlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(fallbackPlans);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plans`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.plans) {
          setPlans(json.data.plans);
        }
      }
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const getPlanById = useCallback(
    (id: PlanId) => plans.find((p) => p.id === id) ?? plans[0],
    [plans]
  );

  return { plans, loading, getPlanById, refetch: fetchPlans };
}
