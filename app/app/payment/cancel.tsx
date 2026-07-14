import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

/** Cancel URL from Network International when the shopper abandons checkout. */
export default function PaymentCancelScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
        <View style={styles.iconWrap}>
          <AppIcon name="close-circle" size={48} color={colors.rose} />
        </View>
        <Text style={styles.title}>تم إلغاء الدفع</Text>
        <Text style={styles.subtitle}>
          لم تُخصم أي مبالغ. يمكنك المحاولة مرة أخرى متى شئت.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/subscription' as never)}>
          <Text style={styles.primaryBtnText}>إعادة المحاولة</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)/profile' as never)}
        >
          <Text style={styles.secondaryBtnText}>العودة للملف</Text>
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
      backgroundColor: `${colors.rose}22`,
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
