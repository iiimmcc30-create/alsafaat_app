import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/contexts/SubscriptionContext';

/**
 * Return URL from Network International after checkout.
 * Final confirmation still comes from the NI webhook on the backend.
 */
export default function PaymentResultScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { refetchSubscription } = useSubscription();

  useEffect(() => {
    void refetchSubscription();
  }, [refetchSubscription]);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
        <View style={styles.iconWrap}>
          <AppIcon name="checkmark-circle" size={48} color={colors.emerald} />
        </View>
        <Text style={styles.title}>تمت العودة من بوابة الدفع</Text>
        <Text style={styles.subtitle}>
          إذا أكملت الدفع بنجاح سيُحدَّث اشتراكك أو رسومك خلال لحظات عبر تأكيد البنك.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.replace('/(tabs)/profile' as never)}
        >
          <Text style={styles.primaryBtnText}>العودة للملف</Text>
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
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.emerald}33`,
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    primaryBtn: {
      backgroundColor: colors.electricBright,
      borderRadius: radius.xl,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      minWidth: 220,
      alignItems: 'center',
    },
    primaryBtnText: {
      ...typography.bodyStrong,
      color: '#fff',
    },
    secondaryBtn: {
      paddingVertical: spacing.sm,
    },
    secondaryBtnText: {
      ...typography.body,
      color: colors.textMuted,
    },
  });
}
