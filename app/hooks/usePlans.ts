import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/services/api';
import {
  EMPTY_PLAN,
  mapApiPlan,
  normalizeSlug,
  type PlanAudience,
  type SubscriptionPlan,
} from '@/services/subscriptionPlans';

export function usePlans(audience: PlanAudience = 'USER') {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([EMPTY_PLAN]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plans?audience=${audience}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.plans)) {
          const mapped = json.data.plans.map((p: Record<string, unknown>) =>
            mapApiPlan(p),
          );
          if (mapped.length > 0) setPlans(mapped);
        }
      }
    } catch {
      // keep last known plans
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const getPlanBySlug = useCallback(
    (slug: string) =>
      plans.find((p) => p.slug === normalizeSlug(slug)) ?? plans[0] ?? EMPTY_PLAN,
    [plans],
  );

  return { plans, loading, getPlanBySlug, refetch: fetchPlans };
}
