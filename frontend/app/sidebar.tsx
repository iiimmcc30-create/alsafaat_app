// Powered by OnSpace.AI
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PLAN_ICONS } from '@/services/subscriptionPlans';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlForwardIcon } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';

export default function SidebarScreen() {
  const router = useRouter();
  const { me } = useApp();
  const { signOut, user, activeMode, switchMode } = useAuth();
  const { subscription } = useSubscription();

  const handleNav = (route: string) => {
    router.back();
    setTimeout(() => router.push(route as any), 120);
  };

  const handleSignOut = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد أنك تريد الخروج من حسابك؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'خروج',
          style: 'destructive',
          onPress: async () => {
            router.back();
            await signOut();
            setTimeout(() => router.replace('/auth/phone' as any), 300);
          },
        },
      ]
    );
  };

  const planIcon = PLAN_ICONS[subscription.planId];
  const planColors: [string, string] = {
    free: ['#334155', '#1E293B'],
    starter: ['#1E3A8A', '#3B82F6'],
    pro: ['#7C3AED', '#A855F7'],
    vip: ['#B45309', '#F5C56A'],
  }[subscription.planId] as [string, string];

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <SafeAreaView style={styles.panel} edges={['top', 'bottom']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>القائمة</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {/* Profile preview */}
          <Pressable
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/(tabs)/profile'), 100);
            }}
            style={styles.profilePreview}
          >
            <Image source={{ uri: me.avatar }} style={styles.previewAvatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.previewName}>{me.arabicName}</Text>
              <Text style={styles.previewHandle}>@{me.username}</Text>
            </View>
            <Ionicons name={rtlForwardIcon} size={20} color={colors.textMuted} />
          </Pressable>

          {/* Mode Switcher for Butchers */}
          {user?.role === 'BUTCHER' && (
            <Pressable
              onPress={() => {
                const newMode = activeMode === 'USER' ? 'BUTCHER' : 'USER';
                switchMode(newMode);
                router.back();
                setTimeout(() => {
                  if (newMode === 'BUTCHER') {
                    router.replace('/(butcher)' as any);
                  } else {
                    router.replace('/(tabs)' as any);
                  }
                }, 150);
              }}
              style={styles.modeSwitcher}
            >
              <LinearGradient
                colors={activeMode === 'BUTCHER' ? ['#1e6ff1', '#1099ec'] : ['#1e293b', '#0f172a']}
                style={styles.modeSwitcherGrad}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <MaterialCommunityIcons 
                  name={activeMode === 'BUTCHER' ? 'store' : 'store-outline'} 
                  size={20} 
                  color="#ffffff" 
                />
                <Text style={styles.modeSwitcherText}>
                  {activeMode === 'BUTCHER' ? 'التبديل لوضع المشتري' : 'التبديل لوضع البائع'}
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* Current Plan Banner */}
          <Pressable
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/subscription'), 120);
            }}
            style={styles.planBannerWrap}
          >
            <LinearGradient colors={planColors} style={styles.planBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.planBannerIcon}>{planIcon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.planBannerLabel}>باقتك الحالية</Text>
                <Text style={styles.planBannerName}>{subscription.plan.arabicName}</Text>
                <Text style={styles.planBannerRenew}>
                  التجديد: {new Date(subscription.renewDate).toLocaleDateString('ar-SA')}
                </Text>
              </View>
              <View style={styles.upgradeBtn}>
                <Text style={styles.upgradeBtnText}>ترقية</Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Usage stats */}
          <View style={styles.usageCard}>
            <Text style={styles.usageTitle}>الاستخدام هذا الشهر</Text>
            <View style={styles.usageRow}>
              <UsageStat
                icon="tag-multiple"
                label="الإعلانات"
                used={subscription.listingsUsed}
                total={subscription.plan.listingsPerMonth}
                color={planColors[1]}
              />
              <UsageStat
                icon="broadcast"
                label="دقائق البث"
                used={subscription.liveMinutesUsed}
                total={subscription.plan.liveMinutesPerWeek}
                color={planColors[1]}
              />
            </View>
          </View>

          {/* Account section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الحساب</Text>
            <View style={styles.card}>
              {[
                { icon: 'cog-outline', arabic: 'الإعدادات والخصوصية', route: '/info/privacy' },
                { icon: 'shield-account-outline', arabic: 'التحقق', route: '/profile/edit' },
                { icon: 'bell-outline', arabic: 'الإشعارات', route: '/info/contact' },
              ].map((item, idx, arr) => (
                <Pressable
                  key={item.arabic}
                  onPress={() => handleNav(item.route)}
                  style={({ pressed }) => [
                    styles.row,
                    idx < arr.length - 1 && styles.rowDivider,
                    pressed && { backgroundColor: colors.bgElevated },
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.glow} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{item.arabic}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Subscription section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الاشتراك</Text>
            <View style={styles.card}>
              {[
                { icon: 'crown-outline', arabic: 'صفاة بريميوم', route: '/subscription', badge: 'ترقية' },
                { icon: 'receipt-outline', arabic: 'سداد الرسوم والاشتراكات', route: '/fees' },
              ].map((item, idx, arr) => (
                <Pressable
                  key={item.arabic}
                  onPress={() => handleNav(item.route)}
                  style={({ pressed }) => [
                    styles.row,
                    idx < arr.length - 1 && styles.rowDivider,
                    pressed && { backgroundColor: colors.bgElevated },
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.glow} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{item.arabic}</Text>
                  </View>
                  {item.badge && subscription.planId === 'free' ? (
                    <LinearGradient colors={gradients.goldRing} style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </LinearGradient>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Help */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>المساعدة والمعلومات</Text>
            <View style={styles.card}>
              {[
                { icon: 'information-outline', arabic: 'من نحن', route: '/info/about' },
                { icon: 'file-document-outline', arabic: 'الشروط والأحكام', route: '/info/terms' },
                { icon: 'lock-outline', arabic: 'سياسة الخصوصية', route: '/info/privacy' },
                { icon: 'email-outline', arabic: 'تواصل معنا', route: '/info/contact' },
              ].map((item, idx, arr) => (
                <Pressable
                  key={item.arabic}
                  onPress={() => handleNav(item.route)}
                  style={({ pressed }) => [
                    styles.row,
                    idx < arr.length - 1 && styles.rowDivider,
                    pressed && { backgroundColor: colors.bgElevated },
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.glow} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{item.arabic}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color={colors.rose} />
            <Text style={styles.logoutText}>تسجيل الخروج</Text>
          </Pressable>

          <Text style={styles.versionText}>الصفاة · الإصدار ١.٠.٠</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function UsageStat({ icon, label, used, total, color }: {
  icon: any; label: string; used: number; total: number; color: string;
}) {
  const isUnlimited = total === 999;
  const pct = isUnlimited ? 20 : Math.min((used / total) * 100, 100);
  return (
    <View style={us.wrap}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={us.label}>{label}</Text>
      <Text style={us.value}>
        {used} / {isUnlimited ? '∞' : total}
      </Text>
      <View style={us.track}>
        <View style={[us.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const us = StyleSheet.create({
  wrap: { flex: 1, gap: 4, alignItems: 'center' },
  label: { ...typography.micro, color: colors.textMuted },
  value: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  track: {
    width: '100%', height: 4, borderRadius: 2,
    backgroundColor: colors.borderSoft, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,9,26,0.65)', flexDirection: 'row-reverse' },
  panel: { width: '88%', backgroundColor: colors.bgDeep, borderLeftWidth: 1, borderLeftColor: colors.borderMid },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  profilePreview: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgGlass, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  previewAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.electric },
  previewName: { ...typography.bodyStrong, color: colors.textPrimary },
  previewArabic: { ...typography.caption, color: colors.glow },
  previewHandle: { ...typography.micro, color: colors.textMuted },

  planBannerWrap: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.xl, overflow: 'hidden' },
  planBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.xl,
  },
  planBannerIcon: { fontSize: 28 },
  planBannerLabel: { ...typography.micro, color: 'rgba(255,255,255,0.7)' },
  planBannerName: { ...typography.h3, color: '#fff' },
  planBannerRenew: { ...typography.micro, color: 'rgba(255,255,255,0.6)' },
  upgradeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  upgradeBtnText: { ...typography.micro, color: '#fff' },

  usageCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderSoft, gap: spacing.sm,
  },
  usageTitle: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  usageRow: { flexDirection: 'row', gap: spacing.lg },

  section: { marginBottom: spacing.md },
  sectionTitle: {
    ...typography.micro, color: colors.textSubtle,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    letterSpacing: 1,
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  rowIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bgGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  rowArabic: { ...typography.caption, color: colors.textMuted },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { ...typography.micro, color: '#1A1300' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: `${colors.rose}15`,
    borderWidth: 1, borderColor: `${colors.rose}30`,
  },
  logoutText: { ...typography.bodyStrong, color: colors.rose },
  versionText: { ...typography.micro, color: colors.textSubtle, textAlign: 'center', marginTop: spacing.xl },

  modeSwitcher: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: '#1d273a',
  },
  modeSwitcherGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  modeSwitcherText: {
    ...typography.bodyStrong,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
