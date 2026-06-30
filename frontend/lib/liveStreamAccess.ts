import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import { API_BASE } from '@/services/api';

export type LiveStreamEligibility = {
  canStream: boolean;
  listingsCount: number;
};

export async function fetchLiveStreamEligibility(
  accessToken: string | null,
): Promise<LiveStreamEligibility> {
  if (!accessToken) {
    return { canStream: false, listingsCount: 0 };
  }

  try {
    const res = await fetch(`${API_BASE}/api/livestreams/eligibility`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success && json.data) {
      return {
        canStream: Boolean(json.data.canStream),
        listingsCount: json.data.listingsCount ?? 0,
      };
    }
  } catch {
    // fall through
  }

  return { canStream: false, listingsCount: 0 };
}

export function showListingRequiredAlert(router: Router) {
  Alert.alert(
    'إعلان مطلوب',
    'لا يمكن بدء بث مباشر إلا بعد نشر إعلان واحد على الأقل في السوق.',
    [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إنشاء إعلان', onPress: () => router.push('/create/listing') },
    ],
  );
}

export async function openLiveCreateIfAllowed(
  router: Router,
  accessToken: string | null,
  params?: Record<string, string>,
): Promise<boolean> {
  if (!accessToken) {
    Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لبدء بث مباشر');
    return false;
  }

  const { canStream } = await fetchLiveStreamEligibility(accessToken);
  if (!canStream) {
    showListingRequiredAlert(router);
    return false;
  }

  router.push({ pathname: '/live/create', params } as never);
  return true;
}
