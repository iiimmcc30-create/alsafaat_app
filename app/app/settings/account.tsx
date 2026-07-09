// Powered by OnSpace.AI
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon, rtlForwardIcon, rtlRow } from '@/lib/rtl';

type Item = { icon: string; label: string; subtitle?: string; route: string };

const ITEMS: Item[] = [
  {
    icon: 'shield-check-outline',
    label: 'التحقق من الحساب والأمان',
    subtitle: 'حالة التوثيق وإعدادات الأمان',
    route: '/profile/edit',
  },
  {
    icon: 'lock-outline',
    label: 'تغيير كلمة المرور والبريد',
    subtitle: 'تحديث بيانات الدخول',
    route: '/auth/forgot-password',
  },
];

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t.colors));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, rtlRow]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>الحساب</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.list}>
        {ITEMS.map((item, idx) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as any)}
            style={({ pressed }) => [
              styles.row,
              idx < ITEMS.length - 1 && styles.rowDivider,
              pressed && { opacity: 0.72 },
            ]}
          >
            <AppIcon name={item.icon} size={22} color={colors.textPrimary} />
            <View style={styles.textWrap}>
              <Text style={styles.label}>{item.label}</Text>
              {item.subtitle ? (
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              ) : null}
            </View>
            <AppIcon name={rtlForwardIcon} size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDeep },
    header: {
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    backBtn: { width: 36, alignItems: 'center' },
    headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1, textAlign: 'center' },
    list: {
      marginTop: spacing.xl,
      marginHorizontal: spacing.lg,
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      overflow: 'hidden',
    },
    row: {
      ...rtlRow,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    textWrap: { flex: 1, gap: 2 },
    label: { ...typography.bodyStrong, color: colors.textPrimary },
    subtitle: { ...typography.caption, color: colors.textMuted },
  });
}
