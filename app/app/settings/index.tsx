// Powered by OnSpace.AI
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon, rtlForwardIcon, rtlRow, rtlDirection } from '@/lib/rtl';

type SubItem = { icon: string; label: string; route: string };
type Section = { key: string; icon: string; title: string; route: string; items: SubItem[] };

const SECTIONS: Section[] = [
  {
    key: 'account',
    icon: 'account-cog-outline',
    title: 'الحساب',
    route: '/settings/account',
    items: [
      { icon: 'shield-check-outline', label: 'التحقق من الحساب والأمان', route: '/settings/account' },
      { icon: 'lock-outline', label: 'تغيير كلمة المرور والبريد', route: '/settings/account' },
    ],
  },
  {
    key: 'info',
    icon: 'information-outline',
    title: 'مركز المعلومات',
    route: '/settings/info',
    items: [
      { icon: 'information-outline', label: 'من نحن', route: '/settings/info' },
      { icon: 'file-document-outline', label: 'الشروط والأحكام', route: '/settings/info' },
      { icon: 'lock-outline', label: 'سياسة الخصوصية', route: '/settings/info' },
      { icon: 'receipt-outline', label: 'سياسة الاسترداد', route: '/settings/info' },
    ],
  },
  {
    key: 'support',
    icon: 'lifebuoy',
    title: 'الدعم والمساعدة',
    route: '/settings/support',
    items: [
      { icon: 'email-outline', label: 'تواصل معنا', route: '/settings/support' },
      { icon: 'alert-circle-outline', label: 'الإبلاغ عن مشكلة', route: '/settings/support' },
      { icon: 'ticket-outline', label: 'تذاكر الدعم', route: '/settings/support' },
    ],
  },
];

export default function SettingsScreen() {
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
        <Text style={styles.headerTitle}>الإعدادات والخصوصية</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, rtlDirection]}
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <AppIcon name="shield-check-outline" size={24} color={colors.electricBright} />
          </View>
          <View style={styles.introText}>
            <Text style={styles.introTitle}>إدارة تجربتك بأمان</Text>
            <Text style={styles.introSubtitle}>
              تحكم في حسابك وخصوصيتك وطرق التواصل مع الدعم.
            </Text>
          </View>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.key} style={styles.sectionBlock}>
            {/* Section header row — tapping navigates to the section page */}
            <Pressable
              onPress={() => router.push(section.route as any)}
              style={({ pressed }) => [styles.sectionHeader, pressed && { opacity: 0.72 }]}
            >
              <View style={styles.sectionIcon}>
                <AppIcon name={section.icon} size={20} color={colors.electricBright} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <AppIcon name={rtlForwardIcon} size={18} color={colors.textMuted} />
            </Pressable>

            {/* Sub-items preview */}
            <View style={styles.subList}>
              {section.items.map((item, idx) => (
                <Pressable
                  key={`${item.label}-${idx}`}
                  onPress={() => router.push(section.route as any)}
                  style={({ pressed }) => [
                    styles.subRow,
                    idx < section.items.length - 1 && styles.subRowDivider,
                    pressed && { opacity: 0.72 },
                  ]}
                >
                  <View style={styles.subIcon}>
                    <AppIcon name={item.icon} size={17} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.subLabel}>{item.label}</Text>
                  <AppIcon name={rtlForwardIcon} size={14} color={colors.textSubtle} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDeep },
    header: {
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      minHeight: 60,
      backgroundColor: colors.bgGlassStrong,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: { width: 42, height: 42 },
    headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1, textAlign: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.huge, gap: spacing.lg },
    intro: {
      ...rtlRow,
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.royal,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMid,
    },
    introIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.lg,
      backgroundColor: colors.bgGlassStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    introText: { flex: 1, gap: spacing.xs },
    introTitle: { ...typography.bodyStrong, color: colors.textPrimary },
    introSubtitle: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
    sectionBlock: {
      backgroundColor: colors.bgGlassStrong,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      overflow: 'hidden',
    },
    sectionHeader: {
      ...rtlRow,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    sectionIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.bgGlass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },
    subList: { paddingVertical: spacing.xs },
    subRow: {
      ...rtlRow,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    subRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    subIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subLabel: { ...typography.body, color: colors.textSecondary, flex: 1 },
  });
}
