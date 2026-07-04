import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listApplications } from '@/services/butcherApplications';
import type { ApplicationSummary } from '@/services/butcherApplicationTypes';

export function useApprovedButcherApplication() {
  const { isAuthenticated, accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await listApplications({ limit: 10 });
      setApplications(result.applications);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const approvedApplication =
    applications.find((application) => application.status === 'APPROVED') ?? null;

  const hasApprovedApplication = approvedApplication !== null;
  const hasAnyApplication = applications.length > 0;
  const hasPendingApplication = applications.some(
    (application) => application.status === 'DRAFT' || application.status === 'SUBMITTED',
  );

  return {
    loading,
    applications,
    approvedApplication,
    hasApprovedApplication,
    hasAnyApplication,
    hasPendingApplication,
    provisionedButcherId: approvedApplication?.provisionedButcherId ?? null,
    refresh,
  };
}
