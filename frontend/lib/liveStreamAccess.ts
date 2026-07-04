import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import { API_BASE } from '@/services/api';

export type LiveStreamEligibility = {
  canStream: boolean;
  listingsCount: number;
  reason?: string;
  messageAr?: string;
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
        reason: json.data.reason,
        messageAr: json.data.messageAr ?? json.messageAr,
      };
    }
    return {
      canStream: false,
      listingsCount: 0,
      reason: json.data?.reason ?? json.error,
      messageAr: json.data?.messageAr ?? json.messageAr,
    };
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

export function showLiveStreamEligibilityDeniedAlert(
  router: Router,
  eligibility: Pick<LiveStreamEligibility, 'reason' | 'messageAr'> & { listingsCount?: number },
) {
  switch (eligibility.reason) {
    case 'listing_required':
      showListingRequiredAlert(router);
      return;

    case 'plan_required':
      Alert.alert(
        'البث المباشر غير متاح',
        'البث المباشر متاح فقط للمشتركين في الباقات المدفوعة.\nقم بترقية اشتراكك لبدء البث.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'عرض الباقات', onPress: () => router.push('/subscription' as never) },
        ],
      );
      return;

    case 'weekly_limit':
    case 'live_minutes_limit':
      Alert.alert('البث المباشر غير متاح', eligibility.messageAr ?? 'لقد استنفدت حصة البث الأسبوعية.');
      return;

    default:
      if (eligibility.listingsCount === 0) {
        showListingRequiredAlert(router);
        return;
      }
      Alert.alert('البث المباشر غير متاح', eligibility.messageAr ?? 'تعذّر التحقق من أهلية البث. حاول مرة أخرى.');
  }
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

  const eligibility = await fetchLiveStreamEligibility(accessToken);
  if (!eligibility.canStream) {
    showLiveStreamEligibilityDeniedAlert(router, eligibility);
    return false;
  }

  router.push({ pathname: '/live/create', params } as never);
  return true;
}
