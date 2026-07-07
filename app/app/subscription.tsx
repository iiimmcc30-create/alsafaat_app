// Powered by OnSpace.AI
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { usePlans } from '@/hooks/usePlans';
import { formatPlanFeatureText, planDisplayName, planGradientColors, planIcon, type PlanSlug, type SubscriptionPlan } from '@/services/subscriptionPlans';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon, rtlDirection, rtlRow, inlineStart, ltrInputText } from '@/lib/rtl';

type Cycle = 'monthly' | 'yearly';

export default function SubscriptionScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { subscription } = useSubscription();
  const { plans, getPlanBySlug } = usePlans(subscription.planAudience);
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const paidDefault = plans.find((p) => p.monthlyPrice > 0)?.slug ?? 'sarh-pro';
  const [selected, setSelected] = useState<PlanSlug>(
    subscription.planSlug === 'free' ? paidDefault : subscription.planSlug,
  );

  useEffect(() => {
    if (subscription.planSlug === 'free') {
      setSelected((prev) => (prev === 'free' ? paidDefault : prev));
    }
  }, [subscription.planSlug, paidDefault]);

  const isUpgrade = (slug: PlanSlug) => {
    const cur = plans.find((p) => p.slug === subscription.planSlug);
    const target = plans.find((p) => p.slug === slug);
    return (target?.sortOrder ?? 0) > (cur?.sortOrder ?? 0);
  };
  const isCurrent = (slug: PlanSlug) => slug === subscription.planSlug;

  const planColors = planGradientColors;

  const yearlyDiscount = (plan: typeof plans[0]) =>
    plan.monthlyPrice > 0
      ? Math.round(100 - (plan.yearlyPrice / (plan.monthlyPrice * 12)) * 100)
      : 0;

  const handleContinue = () => {
    if (selected === 'free') return;
    router.push({ pathname: '/payment', params: { planId: selected, cycle } });
  };

  const currentPlan = getPlanBySlug(subscription.planSlug);
  const upgradePlans =
    subscription.planSlug === 'free'
      ? plans.filter((p) => p.slug !== 'free')
      : plans;

  return (
    <SafeAreaView style={[styles.screen, rtlDirection]} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, rtlRow]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>باقات الاشتراك</Text>
          <Text style={styles.headerSub}>اختر ما يناسب نشاطك</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Billing toggle */}
      <View style={[styles.toggleRow, rtlRow]}>
        <Pressable
          onPress={() => setCycle('monthly')}
          style={[styles.toggleBtn, rtlRow, cycle === 'monthly' && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, cycle === 'monthly' && styles.toggleTextActive]}>
            شهري
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setCycle('yearly')}
          style={[styles.toggleBtn, rtlRow, cycle === 'yearly' && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, cycle === 'yearly' && styles.toggleTextActive]}>
            سنوي
          </Text>
          <View style={styles.savePill}>
            <Text style={styles.saveText}>وفّر 20%</Text>
          </View>
        </Pressable>
      </View>

      {subscription.planSlug === 'free' ? (
        <Text style={styles.pickHint}>اختار باقة للترقية ثم اضغط «متابعة الدفع» بالأسفل</Text>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, rtlDirection]}
      >
        {/* بطاقة الباقة الحالية */}
        <CurrentPlanCard
          plan={currentPlan}
          subscription={subscription}
          styles={styles}
        />

        {subscription.planSlug === 'free' && upgradePlans.length > 0 ? (
          <Text style={styles.sectionTitle}>باقات الترقية</Text>
        ) : null}

        {upgradePlans.map((plan) => {
          const [color, colorEnd] = planColors(plan.sortOrder);
          const isSelected = selected === plan.slug;
          const isCur = isCurrent(plan.slug);
          const price = cycle === 'yearly' && plan.slug !== 'free'
            ? Math.round(plan.yearlyPrice / 12)
            : plan.monthlyPrice;
          const discount = yearlyDiscount(plan);

          return (
            <Pressable
              key={plan.slug}
              onPress={() => setSelected(plan.slug)}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                pressed && { opacity: 0.92 },
              ]}
            >
              {/* Card gradient border */}
              {isSelected ? (
                <LinearGradient
                  colors={[color, colorEnd]}
                  style={styles.cardBorderGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                />
              ) : null}

              <View style={styles.cardInner}>
                {/* Plan header */}
                <View style={styles.planHeader}>
                  <View style={[styles.planTopRow, rtlRow]}>
                    <View style={styles.planHeaderBody}>
                      <View style={styles.planNameRow}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        {isCur ? (
                          <View style={styles.currentPill}>
                            <Text style={styles.currentText}>باقتك الحالية</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.planDesc}>{plan.description}</Text>
                      {plan.monthlyPrice === 0 ? (
                        <Text style={styles.priceFree}>مجاني</Text>
                      ) : (
                        <Text style={styles.priceLine}>
                          {price} ريال
                          <Text style={styles.pricePer}> / شهر</Text>
                          {cycle === 'yearly' && discount > 0 ? (
                            <Text style={[styles.discountBadge, { color: colorEnd }]}>
                              {' '}(-{discount}%)
                            </Text>
                          ) : null}
                        </Text>
                      )}
                    </View>
                    <LinearGradient
                      colors={[color, colorEnd]}
                      style={styles.planIconBox}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <AppIcon name={planIcon(plan.slug) as never} size={22} color="#fff" />
                    </LinearGradient>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Features */}
                <View style={styles.featuresList}>
                  {(plan.displayFeatures ?? []).map((f, i) => {
                    const included =
                      f.valueType === 'BOOLEAN'
                        ? Boolean(f.value)
                        : f.valueType === 'NUMBER'
                          ? Number(f.value) > 0 || Number(f.value) < 0
                          : true;
                    return (
                    <View key={i} style={styles.featureRow}>
                      <Text
                        style={[
                          styles.featureText,
                          !included && { color: colors.textSubtle, textDecorationLine: 'line-through' },
                        ]}
                      >
                        {f.label}: {formatPlanFeatureText(f.key, f.value, f.valueType)}
                      </Text>
                      <View
                        style={[
                          styles.featureIconWrap,
                          included
                            ? { backgroundColor: `${colorEnd}22` }
                            : { backgroundColor: 'rgba(100,116,139,0.15)' },
                        ]}
                      >
                        <AppIcon
                          name={included ? 'check' : 'close'}
                          size={13}
                          color={included ? colorEnd : colors.textSubtle}
                        />
                      </View>
                    </View>
                  );})}
                </View>

                {/* Select indicator */}
                {isSelected ? (
                  <View style={[styles.selectedCheck, inlineStart(spacing.md), { backgroundColor: colorEnd }]}>
                    <AppIcon name="checkmark" size={16} color="#fff" />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}

        {/* NI trust strip */}
        <View style={[styles.paymentBadge, rtlRow]}>
          <Text style={styles.paymentBadgeText}>
            مدفوعات آمنة عبر{' '}
            <Text style={{ color: colors.textBrand, fontWeight: '700' }}>Network International</Text>
            {' '}· مدى · فيزا · آبل باي · STC Pay
          </Text>
          <AppIcon name="shield-check" size={18} color={colors.success} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <SafeAreaView edges={['bottom']} style={styles.ctaWrap}>
        <LinearGradient
          colors={['transparent', colors.bgDeep]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {selected === 'free' ? (
          <Pressable
            onPress={() => router.back()}
            style={styles.ctaSecondary}
          >
            <Text style={styles.ctaSecondaryText}>متابعة بالباقة المجانية</Text>
          </Pressable>
        ) : isCurrent(selected) ? (
          (() => {
            const selectedPlan = getPlanBySlug(selected);
            const [ctaStart, ctaEnd] = planColors(selectedPlan.sortOrder);
            const ctaAmount =
              cycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
            return (
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
          >
            <LinearGradient
              colors={[ctaStart, ctaEnd]}
              style={[styles.ctaBtnGrad, rtlRow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <AppIcon name="refresh-circle-outline" size={20} color="#fff" />
              <Text style={styles.ctaBtnText}>
                تجديد الاشتراك · {ctaAmount} ريال
              </Text>
            </LinearGradient>
          </Pressable>
            );
          })()
        ) : (
          (() => {
            const selectedPlan = getPlanBySlug(selected);
            const [ctaStart, ctaEnd] = planColors(selectedPlan.sortOrder);
            const ctaAmount =
              cycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
            return (
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
          >
            <LinearGradient
              colors={[ctaStart, ctaEnd]}
              style={[styles.ctaBtnGrad, rtlRow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <AppIcon name="credit-card-check-outline" size={20} color="#fff" />
              <Text style={styles.ctaBtnText}>
                متابعة الدفع · {ctaAmount} ريال
              </Text>
            </LinearGradient>
          </Pressable>
            );
          })()
        )}
      </SafeAreaView>
    </SafeAreaView>
  );
}

type CurrentPlanCardProps = {
  plan: SubscriptionPlan;
  subscription: {
    planSlug: string;
    renewDate: string;
    permissions: SubscriptionPlan['permissions'];
    usageCounters: {
      dailyAdsUsed: number;
      liveMinutesUsed: number;
    };
    plan: SubscriptionPlan;
  };
  styles: ReturnType<typeof createStyles>;
};

function CurrentPlanCard({ plan, subscription, styles }: CurrentPlanCardProps) {
  const [color, colorEnd] = planGradientColors(plan.sortOrder);
  const features = plan.displayFeatures?.length
    ? plan.displayFeatures
    : subscription.plan.displayFeatures ?? [];

  const dailyLimit = subscription.permissions.maxAdsPer24Hours;
  const dailyUsed = subscription.usageCounters.dailyAdsUsed;
  const liveHours = subscription.permissions.monthlyLiveHours;
  const liveUsed = subscription.usageCounters.liveMinutesUsed;
  const liveLimitMin =
    typeof liveHours === 'number' && liveHours < 0
      ? null
      : typeof liveHours === 'number'
        ? liveHours * 60
        : null;

  return (
    <LinearGradient
      colors={[color, colorEnd]}
      style={[styles.currentPlanCard, rtlDirection]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={[styles.currentPlanTop, rtlRow]}>
        <View style={styles.currentPlanInfo}>
          <Text style={styles.currentPlanLabel}>باقتك الحالية</Text>
          <Text style={styles.currentPlanName}>
            {planDisplayName(subscription.planSlug, plan.name)}
          </Text>
          <Text style={styles.currentPlanDesc}>{plan.description}</Text>
          <Text style={styles.currentPlanPrice}>
            {plan.monthlyPrice === 0 ? 'مجاني' : `${plan.monthlyPrice} ريال / شهر`}
          </Text>
          {subscription.planSlug !== 'free' ? (
            <Text style={styles.currentPlanRenew}>
              التجديد: {new Date(subscription.renewDate).toLocaleDateString('ar-SA')}
            </Text>
          ) : (
            <Text style={styles.currentPlanRenew}>أنت على الباقة المجانية حالياً</Text>
          )}
        </View>
        <LinearGradient
          colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
          style={styles.currentPlanIcon}
        >
          <AppIcon name={planIcon(plan.slug) as never} size={24} color="#fff" />
        </LinearGradient>
      </View>

      <View style={styles.currentPlanUsage}>
        <View style={styles.usageItem}>
          <View style={styles.usageTop}>
            <Text style={styles.usageLabel}>إعلانات اليوم</Text>
            <Text style={styles.usageVal}>
              {dailyUsed}/
              {typeof dailyLimit === 'number' && dailyLimit < 0
                ? '∞'
                : String(dailyLimit ?? '—')}
            </Text>
          </View>
          <View style={styles.usageTrack}>
            <View
              style={[
                styles.usageFill,
                {
                  width:
                    typeof dailyLimit === 'number' && dailyLimit > 0
                      ? `${Math.min((dailyUsed / dailyLimit) * 100, 100)}%`
                      : typeof dailyLimit === 'number' && dailyLimit < 0
                        ? '12%'
                        : '0%',
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.usageItem}>
          <View style={styles.usageTop}>
            <Text style={styles.usageLabel}>دقائق البث</Text>
            <Text style={styles.usageVal}>
              {liveUsed}/{liveLimitMin === null ? '∞' : liveLimitMin}
            </Text>
          </View>
          <View style={styles.usageTrack}>
            <View
              style={[
                styles.usageFill,
                {
                  width:
                    liveLimitMin && liveLimitMin > 0
                      ? `${Math.min((liveUsed / liveLimitMin) * 100, 100)}%`
                      : '0%',
                },
              ]}
            />
          </View>
        </View>
      </View>

      {features.length > 0 ? (
        <>
          <View style={styles.currentPlanDivider} />
          <Text style={styles.currentPlanFeaturesTitle}>مميزات باقتك</Text>
          <View style={styles.currentPlanFeatures}>
            {features.map((f, i) => {
              const included =
                f.valueType === 'BOOLEAN'
                  ? Boolean(f.value)
                  : f.valueType === 'NUMBER'
                    ? Number(f.value) > 0 || Number(f.value) < 0
                    : true;
              return (
                <View key={i} style={styles.currentFeatureRow}>
                  <Text
                    style={[
                      styles.currentFeatureText,
                      !included && styles.currentFeatureTextMuted,
                    ]}
                  >
                    {f.label}: {formatPlanFeatureText(f.key, f.value, f.valueType)}
                  </Text>
                  <AppIcon
                    name={included ? 'check' : 'close'}
                    size={14}
                    color={included ? '#fff' : 'rgba(255,255,255,0.45)'}
                  />
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </LinearGradient>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgGlass,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  headerTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  headerSub: { ...typography.caption, color: colors.textBrand, textAlign: 'center' },

  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  currentPlanCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  currentPlanTop: {
    ...rtlRow,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  currentPlanIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPlanInfo: { flex: 1, gap: 4, alignItems: 'flex-end' },
  currentPlanLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentPlanName: {
    ...typography.h2,
    color: '#fff',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentPlanDesc: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentPlanPrice: {
    ...typography.bodyStrong,
    color: '#fff',
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentPlanRenew: {
    ...typography.micro,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentPlanUsage: { gap: spacing.sm },
  usageItem: { gap: 6 },
  usageTop: {
    ...rtlRow,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  usageVal: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
    ...ltrInputText,
  },
  usageTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignSelf: 'flex-end',
  },
  currentPlanDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  currentPlanFeaturesTitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentPlanFeatures: { gap: 8 },
  currentFeatureRow: {
    ...rtlRow,
    alignItems: 'center',
    gap: 8,
  },
  currentFeatureText: {
    ...typography.caption,
    color: '#fff',
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  currentFeatureTextMuted: {
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'line-through',
  },

  toggleRow: {
    ...rtlRow,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  toggleActive: {
    backgroundColor: colors.electric,
  },
  toggleText: { ...typography.bodyStrong, color: colors.textMuted },
  toggleTextActive: { color: '#fff' },
  savePill: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  saveText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  pickHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  scroll: { paddingHorizontal: spacing.lg, paddingTop: 4 },

  card: {
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    position: 'relative',
  },
  cardSelected: {
    borderColor: 'transparent',
  },
  cardBorderGrad: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
    padding: 1.5,
    zIndex: 0,
  },
  cardInner: {
    margin: 1.5,
    borderRadius: radius.xl - 1,
    backgroundColor: colors.bgSurface,
    padding: spacing.md,
    zIndex: 1,
  },

  planHeader: { gap: spacing.sm },
  planTopRow: {
    ...rtlRow,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  planHeaderBody: { flex: 1, gap: 4, alignItems: 'flex-end' },
  planIconBox: {
    width: 44, height: 44, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  planIconText: { fontSize: 22 },
  planNameRow: {
    ...rtlRow,
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  planName: { ...typography.h3, color: colors.textPrimary, textAlign: 'right', writingDirection: 'rtl' },
  planDesc: { ...typography.caption, color: colors.textMuted, textAlign: 'right', writingDirection: 'rtl', lineHeight: 20 },
  badgePill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  currentPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.success + '33',
    borderWidth: 1,
    borderColor: colors.success + '66',
  },
  currentText: { fontSize: 10, fontWeight: '700', color: colors.textBrandSuccess },

  priceFree: { ...typography.h3, color: colors.textBrand, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  priceLine: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginTop: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pricePer: { ...typography.micro, color: colors.textSubtle },
  discountBadge: { fontSize: 11, fontWeight: '700' },

  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.sm,
  },
  featuresList: { gap: 0 },
  featureRow: {
    ...rtlRow,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  featureIconWrap: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  selectedCheck: {
    position: 'absolute',
    top: spacing.md,
    width: 26, height: 26,
    borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bgSurface,
  },

  paymentBadge: {
    ...rtlRow,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  paymentBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },

  ctaWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  ctaBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  ctaBtnGrad: {
    ...rtlRow,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: radius.xl,
  },
  ctaBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 16 },
  ctaSecondary: {
    paddingVertical: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  ctaSecondaryText: { ...typography.bodyStrong, color: colors.textMuted },
  });
}
