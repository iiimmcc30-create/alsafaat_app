import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '@/services/api';

export type StatsPeriod = 'week' | 'month' | '3months';

export interface ButcherStats {
  period: StatsPeriod;
  butcher: { id?: string; nameAr: string; subscriptionActive: boolean };
  revenue: number;
  orders: number;
  profileViews: number;
  completionRate: number;
  avgOrderValue: number;
  newCustomers: number;
  dailyRevenue: number[];
  topProducts: { name: string; sales: number; revenue: number }[];
  reviews: { avg: number; count: number };
  trends: {
    revenue: number | null;
    orders: number | null;
    profileViews: number | null;
    completionRate: number | null;
  };
}

export function useButcherStats(accessToken: string | null, period: StatsPeriod) {
  const [stats, setStats] = useState<ButcherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!accessToken) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/butchers/stats?period=${period}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.status === 401) {
        setError('unauthorized');
        setStats(null);
        return;
      }
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setStats(json.data);
      } else {
        setError(json.messageAr || 'fetch_failed');
      }
    } catch {
      setError('fetch_failed');
    } finally {
      setLoading(false);
    }
  }, [accessToken, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
