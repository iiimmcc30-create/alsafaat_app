import { Alert } from 'react-native';
import { authFetch } from '@/services/authFetch';
import { API_BASE } from '@/services/api';
import { parseApiError } from '@/services/apiError';

export type ReportTargetType = 'listing' | 'post' | 'user' | 'story';

const REASONS = [
  'محتوى غير لائق',
  'احتيال أو خداع',
  'سبام / إعلان مزعج',
  'انتحال شخصية',
  'أخرى',
];

export async function submitReport(params: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await authFetch(`${API_BASE}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: await parseApiError(res) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'فشل إرسال البلاغ',
    };
  }
}

/** Shows reason picker then submits a report. */
export function promptReport(
  targetType: ReportTargetType,
  targetId: string,
  requireLogin: boolean,
) {
  if (!requireLogin) {
    Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول للإبلاغ');
    return;
  }

  Alert.alert(
    'إبلاغ',
    'اختر سبب البلاغ',
    [
      ...REASONS.map((reason) => ({
        text: reason,
        onPress: async () => {
          const result = await submitReport({ targetType, targetId, reason });
          if (result.ok) {
            Alert.alert('تم', 'تم إرسال البلاغ وسيتم مراجعته من فريق الدعم.');
          } else {
            Alert.alert('خطأ', result.error || 'فشل إرسال البلاغ');
          }
        },
      })),
      { text: 'إلغاء', style: 'cancel' as const },
    ],
  );
}
