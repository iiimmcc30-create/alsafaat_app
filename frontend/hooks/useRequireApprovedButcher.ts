import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useApprovedButcherApplication } from '@/hooks/useApprovedButcherApplication';

export function useRequireApprovedButcher() {
  const router = useRouter();
  const access = useApprovedButcherApplication();

  useEffect(() => {
    if (!access.loading && !access.hasApprovedApplication) {
      router.replace('/butchers/my-application');
    }
  }, [access.loading, access.hasApprovedApplication, router]);

  return access;
}
