// Powered by OnSpace.AI
// SAFAT — About Us (من نحن)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { AppLogo } from '@/components/ui/AppLogo';
import { rtlBackIcon } from '@/lib/rtl';
import {
  BRAND_FOOTER_AR,
  BRAND_GOAL_AR,
  BRAND_MISSION_AR,
  BRAND_NAME_AR,
  BRAND_TAGLINE_AR,
  BRAND_VISION_AR,
} from '@/constants/brandCopy';

export default function AboutScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>من نحن</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <LinearGradient colors={['#0B1330', '#162149', '#1E3A8A']} style={styles.hero}>
          <AppLogo size={96} showRing={false} />
          <Text style={styles.heroTitle}>{BRAND_NAME_AR}</Text>
          <Text style={styles.heroSub}>{BRAND_TAGLINE_AR}</Text>
        </LinearGradient>

        {/* About text */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>رسالتنا</Text>
          <Text style={styles.bodyText}>{BRAND_MISSION_AR}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>رؤيتنا</Text>
          <Text style={styles.bodyText}>{BRAND_VISION_AR}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>هدفنا</Text>
          <Text style={styles.bodyText}>{BRAND_GOAL_AR}</Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ما نقدّمه</Text>
          {[
            { icon: 'tag-multiple', label: 'إعلانات واضحة وموثوقة لبيع وشراء الحيوانات والمعدات' },
            { icon: 'broadcast', label: 'بث مباشر للمزادات والعروض الحية' },
            { icon: 'message-text-outline', label: 'تواصل مباشر وسريع بين البائعين والمشترين' },
            { icon: 'shield-check-outline', label: 'بيئة آمنة وموثوقة مع نظام تحقق للحسابات' },
            { icon: 'map-marker-outline', label: 'تغطية شاملة لدول الخليج العربي' },
          ].map((item, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <AppIcon name={item.icon} size={20} color={colors.electricBright} />
              </View>
              <Text style={styles.featureText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Ownership */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المالك والامتثال</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>المالك الرسمي</Text>
              <Text style={styles.infoValue}>مؤسسة ماد يونيت للتجارة</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>السجل التجاري</Text>
              <Text style={styles.infoValue}>مسجّلة في المركز السعودي للأعمال</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>الموقع</Text>
              <Text style={styles.infoValue}>المملكة العربية السعودية</Text>
            </View>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>تواصل معنا</Text>
          <Pressable
            style={styles.contactBtn}
            onPress={() => Linking.openURL('tel:+966591298136')}
          >
            <AppIcon name="call-outline" size={20} color={colors.electricBright} />
            <Text style={styles.contactText}>+966 591 298 136</Text>
          </Pressable>
          <Pressable
            style={styles.contactBtn}
            onPress={() => Linking.openURL('mailto:info@alsfat.com')}
          >
            <AppIcon name="mail-outline" size={20} color={colors.electricBright} />
            <Text style={styles.contactText}>info@alsfat.com</Text>
          </Pressable>
          <Pressable
            style={styles.contactBtn}
            onPress={() => Linking.openURL('https://alsfat.com')}
          >
            <AppIcon name="globe-outline" size={20} color={colors.electricBright} />
            <Text style={styles.contactText}>alsfat.com</Text>
          </Pressable>
        </View>

        <Text style={styles.version}>
          {BRAND_FOOTER_AR}{'\n'}
          Uicons by Flaticon
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  hero: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.huge,
    gap: spacing.sm,
  },
  heroTitle: { fontSize: 32, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  heroSub: { ...typography.body, color: colors.textBrand, textAlign: 'center', paddingHorizontal: spacing.xl },
  scroll: { paddingBottom: 40 },
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'right' },
  bodyText: { ...typography.body, color: colors.textSecondary, lineHeight: 26, textAlign: 'right' },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: `${colors.electric}15`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  featureText: { flex: 1, ...typography.body, color: colors.textSecondary, textAlign: 'right' },
  infoCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  infoLabel: { ...typography.caption, color: colors.textMuted },
  infoValue: { ...typography.bodyStrong, color: colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: spacing.md },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginHorizontal: spacing.lg },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  contactText: { ...typography.body, color: colors.textBrandStrong },
  version: { ...typography.micro, color: colors.textSubtle, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  });
}
