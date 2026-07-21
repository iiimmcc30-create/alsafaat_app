// Payment result screen — shown after NI redirect or dev test payment.
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import type { PaymentContext } from '@/services/payments';

type SyncState = 'syncing' | 'paid' | 'pending' | 'failed';

type ContextCopy = {
  successTitle: string;
  successSubtitle: string;
  pendingSubtitle: string;
  primaryLabel: string;
  secondaryLabel?: string;
};

const CONTEXT_COPY: Record<PaymentContext, ContextCopy> = {
  subscription: {
    successTitle: 'تم تفعيل الاشتراك!',
    successSubtitle: 'اشتراكك في الباقة أصبح نشطاً. استمتع بمزاياك الآن.',
    pendingSubtitle: 'إذا أكملت الدفع، سيُفعَّل اشتراكك خلال لحظات.',
    primaryLabel: 'الملف الشخصي',
    secondaryLabel: 'عرض الباقات',
  },
  listing_fee: {
    successTitle: 'تم سداد رسوم الإعلان',
    successSubtitle: 'تم تأكيد الدفع وتحديث حالة رسوم إعلانك.',
    pendingSubtitle: 'إذا أكملت الدفع، ستُحدَّث الرسوم تلقائياً.',
    primaryLabel: 'صفحة الرسوم',
  },
  commission: {
    successTitle: 'تم سداد الرسوم',
    successSubtitle: 'شكراً لك — تم تسجيل عملية الدفع بنجاح.',
    pendingSubtitle: 'إذا أكملت الدفع، سيظهر في السجل خلال لحظات.',
    primaryLabel: 'صفحة الرسوم',
  },
  boost: {
    successTitle: 'تم تفعيل الترقية!',
    successSubtitle: 'إعلانك مميّز أو مثبّت الآن حسب الخدمة التي اخترتها.',
    pendingSubtitle: 'إذا أكملت الدفع، ستُفعَّل الترقية خلال لحظات.',
    primaryLabel: 'عرض الإعلان',
  },
  butcher_order: {
    successTitle: 'تم الدفع وإرسال الطلب!',
    successSubtitle: 'وصل طلبك المدفوع للملحمة وسيتواصل معك الجزار قريباً.',
    pendingSubtitle: 'إذا أكملت الدفع، سيصل طلبك للملحمة تلقائياً.',
    primaryLabel: 'تفاصيل الطلب',
    secondaryLabel: 'قسم الملاحم',
  },
  generic: {
    successTitle: 'تم الدفع بنجاح!',
    successSubtitle: 'تم تأكيد عملية الدفع.',
    pendingSubtitle: 'إذا أكملت الدفع، سيُحدَّث طلبك خلال لحظات.',
    primaryLabel: 'الملف الشخصي',
    secondaryLabel: 'صفحة الرسوم',
  },
};

function normalizeContext(raw?: string): PaymentContext {
  const allowed: PaymentContext[] = [
    'subscription',
    'listing_fee',
    'commission',
    'boost',
    'butcher_order',
    'generic',
  ];
  if (raw && allowed.includes(raw as PaymentContext)) {
    return raw as PaymentContext;
  }
  return 'generic';
}

export default function PaymentResultScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const params = useLocalSearchParams<{
    paymentId?: string;
    context?: string;
    listingId?: string;
    orderId?: string;
    orderNumber?: string;
    butcherId?: string;
  }>();
  const { paymentId, context: rawContext, listingId, orderId, orderNumber, butcherId } = params;
  const context = normalizeContext(rawContext);
  const copy = CONTEXT_COPY[context];
  const { refetchSubscription } = useSubscription();
  const { accessToken } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>('syncing');

  useEffect(() => {
    void (async () => {
      void refetchSubscription();

      if (!paymentId || !accessToken) {
        setSyncState('pending');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/payments/${paymentId}/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json().catch(() => ({}));

        if (res.ok && json.success) {
          const status: string = json.data?.status ?? 'pending';
          if (status === 'paid') {
            await refetchSubscription();
            setSyncState('paid');
          } else if (status === 'failed') {
            setSyncState('failed');
          } else {
            setSyncState('pending');
          }
        } else {
          setSyncState('pending');
        }
      } catch {
        setSyncState('pending');
      }
    })();
  }, [paymentId, accessToken, refetchSubscription]);

  const goPrimary = useCallback(() => {
    switch (context) {
      case 'subscription':
        router.replace('/(tabs)/profile' as never);
        break;
      case 'listing_fee':
      case 'commission':
        router.replace('/fees' as never);
        break;
      case 'boost':
        if (listingId) {
          router.replace({ pathname: '/listing/[id]', params: { id: listingId } } as never);
        } else {
          router.replace('/(tabs)/' as never);
        }
        break;
      case 'butcher_order':
        router.replace({
          pathname: '/butchers/order-success',
          params: {
            orderId: orderId ?? '',
            orderNumber: orderNumber ?? '',
            butcherId: butcherId ?? '',
            paymentStatus: syncState === 'paid' ? 'paid' : 'unpaid',
          },
        } as never);
        break;
      default:
        router.replace('/(tabs)/profile' as never);
    }
  }, [context, listingId, orderId, orderNumber, butcherId, router, syncState]);

  const goSecondary = useCallback(() => {
    if (context === 'subscription') {
      router.replace('/subscription' as never);
      return;
    }
    if (context === 'butcher_order') {
      router.replace('/butchers' as never);
      return;
    }
    router.replace('/fees' as never);
  }, [context, router]);

  if (syncState === 'syncing') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={colors.electricBright} />
          <Text style={styles.title}>جارٍ التحقق من حالة الدفع...</Text>
          <Text style={styles.subtitle}>انتظر لحظة، نتحقق من تأكيد بوابة الدفع</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (syncState === 'paid') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.emerald}22` }]}>
            <AppIcon name="checkmark-circle" size={52} color={colors.emerald} />
          </View>
          <Text style={styles.title}>{copy.successTitle}</Text>
          <Text style={styles.subtitle}>{copy.successSubtitle}</Text>
          <Pressable style={styles.primaryBtn} onPress={goPrimary}>
            <Text style={styles.primaryBtnText}>{copy.primaryLabel}</Text>
          </Pressable>
          {copy.secondaryLabel ? (
            <Pressable style={styles.secondaryBtn} onPress={goSecondary}>
              <Text style={styles.secondaryBtnText}>{copy.secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </View>
    );
  }

  if (syncState === 'failed') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.rose}22` }]}>
            <AppIcon name="close-circle" size={52} color={colors.rose} />
          </View>
          <Text style={styles.title}>لم يتم الدفع</Text>
          <Text style={styles.subtitle}>لم تكتمل عملية الدفع. يمكنك المحاولة مجدداً.</Text>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.rose }]} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>حاول مجدداً</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={goPrimary}>
            <Text style={styles.secondaryBtnText}>{copy.primaryLabel}</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.amber}22` }]}>
          <AppIcon name="time-outline" size={52} color={colors.amber} />
        </View>
        <Text style={styles.title}>قيد التأكيد</Text>
        <Text style={styles.subtitle}>{copy.pendingSubtitle}</Text>
        <Pressable style={styles.primaryBtn} onPress={goPrimary}>
          <Text style={styles.primaryBtnText}>{copy.primaryLabel}</Text>
        </Pressable>
        {copy.secondaryLabel ? (
          <Pressable style={styles.secondaryBtn} onPress={goSecondary}>
            <Text style={styles.secondaryBtnText}>{copy.secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1 },
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
    iconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    title: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
    subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: spacing.md },
    primaryBtn: { backgroundColor: colors.electricBright, borderRadius: radius.xl, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, minWidth: 220, alignItems: 'center' },
    primaryBtnText: { ...typography.bodyStrong, color: '#fff' },
    secondaryBtn: { paddingVertical: spacing.sm },
    secondaryBtnText: { ...typography.body, color: colors.textMuted },
  });
}
