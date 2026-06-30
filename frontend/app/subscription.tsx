// Powered by OnSpace.AI
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { PLAN_ICONS, PlanId } from '@/services/subscriptionPlans';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon, rtlDirection, rtlRow } from '@/lib/rtl';

type Cycle = 'monthly' | 'yearly';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { subscription } = useSubscription();
  const { plans, getPlanById } = usePlans();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [selected, setSelected] = useState<PlanId>(subscription.planId);

  const currentPlanOrder: PlanId[] = ['free', 'starter', 'pro', 'vip'];
  const isUpgrade = (planId: PlanId) =>
    currentPlanOrder.indexOf(planId) > currentPlanOrder.indexOf(subscription.planId);
  const isCurrent = (planId: PlanId) => planId === subscription.planId;

  const yearlyDiscount = (plan: typeof plans[0]) =>
    plan.price > 0
      ? Math.round(100 - (plan.yearlyPrice / (plan.price * 12)) * 100)
      : 0;

  const handleContinue = () => {
    if (selected === 'free') return;
    router.push({ pathname: '/payment', params: { planId: selected, cycle } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>باقات الاشتراك</Text>
          <Text style={styles.headerSub}>اختر ما يناسب نشاطك</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Billing toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          onPress={() => setCycle('monthly')}
          style={[styles.toggleBtn, cycle === 'monthly' && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, cycle === 'monthly' && styles.toggleTextActive]}>
            شهري
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setCycle('yearly')}
          style={[styles.toggleBtn, cycle === 'yearly' && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, cycle === 'yearly' && styles.toggleTextActive]}>
            سنوي
          </Text>
          <View style={styles.savePill}>
            <Text style={styles.saveText}>وفّر 20%</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          const isCur = isCurrent(plan.id);
          const price = cycle === 'yearly' && plan.id !== 'free'
            ? Math.round(plan.yearlyPrice / 12)
            : plan.price;
          const discount = yearlyDiscount(plan);

          return (
            <Pressable
              key={plan.id}
              onPress={() => setSelected(plan.id)}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                pressed && { opacity: 0.92 },
              ]}
            >
              {/* Card gradient border */}
              {isSelected ? (
                <LinearGradient
                  colors={[plan.color, plan.colorEnd]}
                  style={styles.cardBorderGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                />
              ) : null}

              <View style={styles.cardInner}>
                {/* Plan header */}
                <View style={styles.planHeader}>
                  <LinearGradient
                    colors={[plan.color, plan.colorEnd]}
                    style={styles.planIconBox}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.planIconText}>{PLAN_ICONS[plan.id]}</Text>
                  </LinearGradient>

                  <View style={{ flex: 1 }}>
                    <View style={styles.planNameRow}>
                      <Text style={styles.planName}>{plan.arabicName}</Text>
                      {plan.badge ? (
                        <LinearGradient
                          colors={[plan.color, plan.colorEnd]}
                          style={styles.badgePill}
                        >
                          <Text style={styles.badgeText}>{plan.badge}</Text>
                        </LinearGradient>
                      ) : null}
                      {isCur ? (
                        <View style={styles.currentPill}>
                          <Text style={styles.currentText}>باقتك الحالية</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.planDesc}>{plan.arabicDescription}</Text>
                  </View>

                  {/* Price */}
                  <View style={styles.priceBlock}>
                    {plan.price === 0 ? (
                      <Text style={styles.priceFree}>مجاني</Text>
                    ) : (
                      <>
                        <View style={styles.priceRow}>
                          <Text style={[styles.priceAmount, { color: plan.colorEnd }]}>
                            {price}
                          </Text>
                          <Text style={styles.priceCurrency}> ريال</Text>
                        </View>
                        <Text style={styles.pricePer}>/ شهر</Text>
                        {cycle === 'yearly' && discount > 0 ? (
                          <Text style={[styles.discountBadge, { color: plan.colorEnd }]}>
                            -{discount}%
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Features */}
                <View style={styles.featuresList}>
                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <View
                        style={[
                          styles.featureIconWrap,
                          f.included
                            ? { backgroundColor: `${plan.colorEnd}22` }
                            : { backgroundColor: 'rgba(100,116,139,0.15)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={f.included ? 'check' : 'close'}
                          size={13}
                          color={f.included ? plan.colorEnd : colors.textSubtle}
                        />
                      </View>
                      <Text
                        style={[
                          styles.featureText,
                          !f.included && { color: colors.textSubtle, textDecorationLine: 'line-through' },
                          f.highlight && f.included && { color: colors.textPrimary, fontWeight: '600' },
                        ]}
                      >
                        {f.arabic}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Select indicator */}
                {isSelected ? (
                  <View style={[styles.selectedCheck, { backgroundColor: plan.colorEnd }]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}

        {/* NI trust strip */}
        <View style={styles.paymentBadge}>
          <MaterialCommunityIcons name="shield-check" size={18} color={colors.success} />
          <Text style={styles.paymentBadgeText}>
            مدفوعات آمنة عبر{' '}
            <Text style={{ color: colors.glow, fontWeight: '700' }}>Network International</Text>
            {' '}· مدى · فيزا · آبل باي · STC Pay
          </Text>
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
        {selected === 'free' || isCurrent(selected) ? (
          <Pressable
            onPress={() => router.back()}
            style={styles.ctaSecondary}
          >
            <Text style={styles.ctaSecondaryText}>
              {isCurrent(selected) ? 'باقتك الحالية' : 'متابعة بالباقة المجانية'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
          >
            <LinearGradient
              colors={[plans.find((p) => p.id === selected)!.color, plans.find((p) => p.id === selected)!.colorEnd]}
              style={styles.ctaBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <MaterialCommunityIcons name="credit-card-check-outline" size={20} color="#fff" />
              <Text style={styles.ctaBtnText}>
                متابعة الدفع ·{' '}
                {cycle === 'yearly'
                  ? plans.find((p) => p.id === selected)!.yearlyPrice
                  : plans.find((p) => p.id === selected)!.price}{' '}
                ريال
              </Text>
            </LinearGradient>
          </Pressable>
        )}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row',
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
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.glow },

  toggleRow: {
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    padding: spacing.lg,
    zIndex: 1,
  },

  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  planIconBox: {
    width: 48, height: 48, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  planIconText: { fontSize: 22 },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  planName: { ...typography.h3, color: colors.textPrimary },
  planDesc: { ...typography.caption, color: colors.textMuted },
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
  currentText: { fontSize: 10, fontWeight: '700', color: colors.success },

  priceBlock: { alignItems: 'flex-end', minWidth: 70 },
  priceFree: { ...typography.h3, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceAmount: { fontSize: 28, fontWeight: '800' },
  priceCurrency: { ...typography.caption, color: colors.textMuted },
  pricePer: { ...typography.micro, color: colors.textSubtle, marginTop: 1 },
  discountBadge: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: colors.borderSoft,
    marginVertical: spacing.md,
  },
  featuresList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIconWrap: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { ...typography.caption, color: colors.textSecondary, flex: 1 },

  selectedCheck: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 26, height: 26,
    borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bgSurface,
  },

  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  paymentBadgeText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 18 },

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
    flexDirection: 'row',
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
