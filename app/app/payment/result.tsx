// Payment result screen — shown when NI redirects back to the app.
// Immediately calls POST /payments/:id/sync to confirm the payment status
// without waiting for the webhook (handles race conditions / slow networks).
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';

type SyncState = 'syncing' | 'paid' | 'pending' | 'failed';

export default function PaymentResultScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const { refetchSubscription } = useSubscription();
  const { accessToken } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>('syncing');

  useEffect(() => {
    void (async () => {
      // Always refresh subscription data regardless
      void refetchSubscription();

      if (!paymentId || !accessToken) {
        setSyncState('pending');
        return;
      }

      // Try to sync the payment status from NI
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

  // ── Syncing (loading) ──
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

  // ── Paid ──
  if (syncState === 'paid') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.emerald}22` }]}>
            <AppIcon name="checkmark-circle" size={52} color={colors.emerald} />
          </View>
          <Text style={styles.title}>✅ تم الدفع بنجاح!</Text>
          <Text style={styles.subtitle}>اشتراكك أو طلبك تم تفعيله تلقائياً.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/profile' as never)}>
            <Text style={styles.primaryBtnText}>العودة للملف الشخصي</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  // ── Failed ──
  if (syncState === 'failed') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
          <View style={[styles.iconWrap, { backgroundColor: `${colors.rose}22` }]}>
            <AppIcon name="close-circle" size={52} color={colors.rose} />
          </View>
          <Text style={styles.title}>❌ لم يتم الدفع</Text>
          <Text style={styles.subtitle}>لم تكتمل عملية الدفع. يمكنك المحاولة مجدداً.</Text>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.rose }]} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>حاول مجدداً</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/profile' as never)}>
            <Text style={styles.secondaryBtnText}>العودة للملف</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  // ── Pending (couldn't confirm yet — webhook will come later) ──
  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.amber}22` }]}>
          <AppIcon name="time-outline" size={52} color={colors.amber} />
        </View>
        <Text style={styles.title}>قيد التأكيد</Text>
        <Text style={styles.subtitle}>
          إذا أكملت الدفع، سيُحدَّث اشتراكك أو طلبك خلال لحظات عبر تأكيد البنك تلقائياً.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/profile' as never)}>
          <Text style={styles.primaryBtnText}>العودة للملف الشخصي</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/fees' as never)}>
          <Text style={styles.secondaryBtnText}>صفحة الرسوم</Text>
        </Pressable>
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
