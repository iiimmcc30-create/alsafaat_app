// SARH — Payment Screen (Network International)
// Modern, professional payment UI:
//   • Visual credit-card preview with live typing
//   • Payment method grid with real brand logos (pure RN — no extra deps)
//   • Step indicator: Method → Card Details → Processing → Success
//   • Trust badges, NI branding, PCI-DSS notice
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { openPaymentCheckout } from '@/services/paymentCheckout';
import { NIPaymentMethod, PAYMENT_METHODS } from '@/services/network_international';
import { normalizeSlug, planGradientColors } from '@/services/subscriptionPlans';
import { usePlans } from '@/hooks/usePlans';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';

type Step = 'method' | 'card_details' | 'processing' | 'success';

// ─── Payment method brand logos ───────────────────────────────────────────────

function MadaLogo({ size = 32 }: { size?: number }) {
  return (
    <View style={{ width: size * 1.9, height: size, borderRadius: size * 0.25, backgroundColor: '#005BAA', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.45, letterSpacing: 1 }}>mada</Text>
    </View>
  );
}

function VisaLogo({ size = 32 }: { size?: number }) {
  return (
    <View style={{ width: size * 1.9, height: size, borderRadius: size * 0.25, backgroundColor: '#1A1F71', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontStyle: 'italic', fontWeight: '900', fontSize: size * 0.55, letterSpacing: -1 }}>VISA</Text>
    </View>
  );
}

function MastercardLogo({ size = 32 }: { size?: number }) {
  const r = size * 0.46;
  return (
    <View style={{ width: size * 1.9, height: size, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#EB001B' }} />
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#F79E1B', marginLeft: -r * 0.72, opacity: 0.95 }} />
    </View>
  );
}

function ApplePayLogo({ size = 32 }: { size?: number }) {
  return (
    <View style={{ width: size * 2.4, height: size, borderRadius: size * 0.25, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 }}>
      <Text style={{ color: '#fff', fontSize: size * 0.52, marginBottom: 2 }}></Text>
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: size * 0.4 }}>Pay</Text>
    </View>
  );
}

function StcPayLogo({ size = 32 }: { size?: number }) {
  return (
    <View style={{ width: size * 2.2, height: size, borderRadius: size * 0.25, backgroundColor: '#4F008C', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.4, letterSpacing: 0.5 }}>stc pay</Text>
    </View>
  );
}

function MethodLogo({ id, size = 32 }: { id: NIPaymentMethod; size?: number }) {
  switch (id) {
    case 'mada':       return <MadaLogo size={size} />;
    case 'visa':       return <VisaLogo size={size} />;
    case 'mastercard': return <MastercardLogo size={size} />;
    case 'apple_pay':  return <ApplePayLogo size={size} />;
    case 'stc_pay':    return <StcPayLogo size={size} />;
  }
}

// ─── Virtual card preview ─────────────────────────────────────────────────────

function formatCardDisplay(num: string): string {
  const n = num.replace(/\D/g, '');
  const groups = [];
  for (let i = 0; i < 16; i += 4) {
    groups.push(n.slice(i, i + 4).padEnd(4, '·'));
  }
  return groups.join('  ');
}

function formatExpiryDisplay(val: string): string {
  const n = val.replace(/\D/g, '');
  if (n.length >= 2) return n.slice(0, 2) + '/' + n.slice(2, 4).padEnd(2, 'YY'.slice(n.length > 2 ? 0 : 2));
  return n.padEnd(2, 'MM'.slice(n.length));
}

function VirtualCard({
  cardNumber,
  cardName,
  expiry,
  methodId,
  colors,
}: {
  cardNumber: string;
  cardName: string;
  expiry: string;
  methodId: NIPaymentMethod | null;
  colors: ThemeColors;
}) {
  const cardColor = methodId === 'mada' ? ['#005BAA', '#003F80']
    : methodId === 'visa' ? ['#1A1F71', '#333A99']
    : methodId === 'mastercard' ? ['#1a1a1a', '#2d2d2d']
    : ['#1a1a2e', '#16213e'];

  return (
    <LinearGradient colors={cardColor as [string, string]} style={virtualCardStyles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={virtualCardStyles.topRow}>
        <View style={virtualCardStyles.chip}>
          <View style={virtualCardStyles.chipLine} />
          <View style={virtualCardStyles.chipLine} />
        </View>
        {methodId ? <MethodLogo id={methodId} size={22} /> : null}
      </View>
      <Text style={virtualCardStyles.cardNumber}>{formatCardDisplay(cardNumber)}</Text>
      <View style={virtualCardStyles.bottomRow}>
        <View>
          <Text style={virtualCardStyles.cardLabel}>اسم حامل البطاقة</Text>
          <Text style={virtualCardStyles.cardValue} numberOfLines={1}>
            {cardName.toUpperCase() || '· · · · · · · · · ·'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={virtualCardStyles.cardLabel}>صالحة حتى</Text>
          <Text style={virtualCardStyles.cardValue}>{formatExpiryDisplay(expiry)}</Text>
        </View>
      </View>
      {/* Decorative circles */}
      <View style={[virtualCardStyles.circle, { top: -40, right: -40, width: 130, height: 130, opacity: 0.12 }]} />
      <View style={[virtualCardStyles.circle, { bottom: -30, left: -20, width: 100, height: 100, opacity: 0.08 }]} />
    </LinearGradient>
  );
}

const virtualCardStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    marginHorizontal: spacing.lg,
    marginBottom: 24,
    height: 200,
    justifyContent: 'space-between',
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chip: {
    width: 42, height: 32, borderRadius: 6, backgroundColor: '#F5C56A',
    justifyContent: 'space-around', alignItems: 'center', paddingVertical: 4,
  },
  chipLine: { width: '80%', height: 3, backgroundColor: '#C8A000', borderRadius: 2 },
  cardNumber: { color: '#fff', fontSize: 18, letterSpacing: 2.5, fontFamily: 'monospace', fontWeight: '600', textAlign: 'center' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, letterSpacing: 1, marginBottom: 3, textTransform: 'uppercase' },
  cardValue: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: '#fff' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PaymentScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors, scheme }) => createStyles(colors, scheme));
  const router = useRouter();
  const { planId, cycle } = useLocalSearchParams<{ planId: string; cycle: 'monthly' | 'yearly' }>();
  const { me } = useApp();
  const { user: authUser, accessToken } = useAuth();
  const { upgradePlan, subscription, refetchSubscription } = useSubscription();
  const { getPlanBySlug } = usePlans(subscription.planAudience);
  const slug = normalizeSlug(planId ?? 'sarh-pro');
  const plan = getPlanBySlug(slug);
  const [planColor, planColorEnd] = planGradientColors(plan.sortOrder);
  const billingCycle = cycle ?? 'monthly';
  const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

  const [step, setStep] = useState<Step>('method');
  const [selectedMethod, setSelectedMethod] = useState<NIPaymentMethod | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [cvvFocused, setCvvFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState('');

  const stepAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!subscription.id && accessToken) void refetchSubscription();
  }, [subscription.id, accessToken, refetchSubscription]);

  useEffect(() => {
    Animated.timing(stepAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    return () => { stepAnim.setValue(0); };
  }, [step]);

  useEffect(() => {
    if (step === 'success') {
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
        Animated.timing(successOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [step]);

  const needsCardForm = selectedMethod === 'mada' || selectedMethod === 'visa' || selectedMethod === 'mastercard';
  const isWallet = selectedMethod === 'apple_pay' || selectedMethod === 'stc_pay';

  const formatCardInput = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, 16);
    return clean.replace(/(.{4})/g, '$1 ').trim();
  };

  const handleSelectMethod = (method: NIPaymentMethod) => setSelectedMethod(method);

  const handlePay = async () => {
    if (!selectedMethod) return;
    if (needsCardForm && step === 'method') { setStep('card_details'); return; }

    if (!accessToken) { Alert.alert('غير مصرح', 'يجب تسجيل الدخول لإتمام الدفع'); return; }
    if (!subscription.id) {
      Alert.alert('خطأ', 'تعذر تحميل بيانات الاشتراك، يرجى المحاولة مجدداً.');
      return;
    }

    setLoading(true);
    setStep('processing');

    try {
      const res = await fetch(`${API_BASE}/api/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          amount,
          currency: 'SAR',
          method: selectedMethod,
          type: 'subscription',
          referenceId: subscription.id,
          planId: plan.slug,
          billingCycle,
          description: `sarh ${plan.name} subscription - ${billingCycle}`,
          descriptionAr: `اشتراك سرح ${plan.name} - ${billingCycle === 'yearly' ? 'سنوي' : 'شهري'}`,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data?.checkoutUrl) {
        const { checkoutUrl, paymentId, devMode } = json.data as { checkoutUrl: string; paymentId?: string; devMode?: boolean };

        if (devMode) {
          setStep('method');
          Alert.alert(
            'الدفع غير متاح حالياً',
            'بوابة الدفع تعمل حالياً في وضع التطوير، لذلك تم إيقاف أي نجاح وهمي. لن يتم اعتماد أي عملية حتى يتم ربط مفاتيح الدفع الحقيقية أو بطاقات الاختبار الرسمية من Network International.',
          );
          return;
        }

        // Hosted NI checkout. This account is connected to the real KSA gateway,
        // so random card numbers are rejected by the gateway itself.
        Alert.alert(
          'صفحة الدفع الآمنة',
          'ستُفتح بوابة Network International داخل التطبيق.\n\nلا تستخدم رقماً عشوائياً للبطاقة؛ يلزم استخدام بطاقة صالحة، أو بطاقة اختبار رسمية يوفرها حساب NI إن تم تفعيل وضع الاختبار.',
          [
            {
              text: 'متابعة للدفع',
              onPress: async () => {
                await openPaymentCheckout(checkoutUrl, paymentId);
                await refetchSubscription();
              },
            },
            { text: 'إلغاء', style: 'cancel', onPress: () => setStep('method') },
          ],
        );
      } else {
        setStep('method');
        const detail =
          json.messageAr ||
          (json.error === 'payment_gateway_error'
            ? 'تعذر إنشاء رابط الدفع. حاول مرة أخرى بعد قليل.'
            : json.message) ||
          'حدث خطأ أثناء الدفع.';
        Alert.alert('فشل الدفع', String(detail));
      }
    } catch {
      setStep('method');
      Alert.alert('فشل الدفع', 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success ──────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.successWrap} edges={['top', 'bottom']}>
          <Animated.View style={{ transform: [{ scale: successScale }], opacity: successOpacity, alignItems: 'center', gap: spacing.lg, width: '100%' }}>
            <LinearGradient colors={[planColor, planColorEnd]} style={styles.successIcon}>
              <AppIcon name="check-bold" size={52} color="#fff" />
            </LinearGradient>
            <Text style={styles.successTitle}>تمّ الاشتراك بنجاح 🎉</Text>
            <Text style={styles.successSub}>أهلاً بك في باقة <Text style={{ color: planColorEnd, fontWeight: '800' }}>{plan.name}</Text></Text>

            <View style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <AppIcon name="receipt-outline" size={16} color={colors.textMuted} />
                <Text style={styles.receiptHeaderText}>تفاصيل العملية</Text>
              </View>
              <View style={styles.receiptDivider} />
              <ReceiptRow label="الباقة"         value={plan.name} />
              <ReceiptRow label="دورة الفوترة"   value={billingCycle === 'yearly' ? 'سنوي' : 'شهري'} />
              <ReceiptRow label="المبلغ المدفوع"  value={`${amount} ريال`} highlight />
              <ReceiptRow label="طريقة الدفع"    value={PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.arabic ?? ''} />
              {transactionId ? <ReceiptRow label="رقم العملية" value={transactionId} small /> : null}
            </View>

            <Pressable
              onPress={() => { router.dismissAll(); router.replace('/(tabs)/profile'); }}
              style={({ pressed }) => [styles.successBtn, pressed && { opacity: 0.88 }]}
            >
              <LinearGradient colors={[planColor, planColorEnd]} style={styles.successBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.successBtnText}>ابدأ الاستخدام</Text>
                <AppIcon name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Processing ───────────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <View style={styles.processingWrap}>
          <View style={styles.processingIconWrap}>
            <ActivityIndicator size="large" color={planColorEnd} />
          </View>
          <Text style={styles.processingTitle}>جارٍ معالجة الدفع...</Text>
          <Text style={styles.processingSubtitle}>يُرجى الانتظار، لا تغلق التطبيق</Text>
          <View style={styles.processingBadge}>
            <AppIcon name="shield-lock" size={14} color={colors.emerald} />
            <Text style={styles.processingBadgeText}>محمي بـ Network International · PCI-DSS Level 1</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Step indicator ───────────────────────────────────────────────────────────
  const steps = ['طريقة الدفع', needsCardForm ? 'بيانات البطاقة' : null, 'الدفع'].filter(Boolean) as string[];
  const currentStepIdx = step === 'method' ? 0 : step === 'card_details' ? 1 : 2;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          hitSlop={12}
          onPress={() => step === 'card_details' ? setStep('method') : router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
        >
          <AppIcon name={rtlBackIcon} size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>الدفع الآمن</Text>
          <View style={styles.headerSecure}>
            <AppIcon name="shield-lock" size={11} color={colors.emerald} />
            <Text style={styles.headerSecureText}>Network International</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Step indicator ── */}
      <View style={styles.stepRow}>
        {steps.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= currentStepIdx && styles.stepDotActive]}>
              {i < currentStepIdx
                ? <AppIcon name="checkmark" size={10} color="#fff" />
                : <Text style={[styles.stepDotText, i <= currentStepIdx && { color: '#fff' }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, i === currentStepIdx && styles.stepLabelActive]}>{s}</Text>
            {i < steps.length - 1 ? <View style={[styles.stepLine, i < currentStepIdx && styles.stepLineActive]} /> : null}
          </View>
        ))}
      </View>

      <Animated.View style={{ flex: 1, opacity: stepAnim }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Order summary ── */}
          <LinearGradient
            colors={[planColor, planColorEnd]}
            style={styles.orderCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.orderTopRow}>
              <View>
                <Text style={styles.orderLabel}>{billingCycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'}</Text>
                <Text style={styles.orderPlanName}>باقة {plan.name}</Text>
              </View>
              <View style={styles.orderAmountWrap}>
                <Text style={styles.orderAmount}>{amount}</Text>
                <Text style={styles.orderCurrency}>ريال</Text>
              </View>
            </View>
            {billingCycle === 'yearly' && plan.monthlyPrice > 0 ? (
              <View style={styles.savingsTag}>
                <AppIcon name="tag" size={12} color="#fff" />
                <Text style={styles.savingsText}>
                  وفّرت {Math.round(plan.monthlyPrice * 12 - plan.yearlyPrice)} ريال مقارنةً بالاشتراك الشهري
                </Text>
              </View>
            ) : null}
          </LinearGradient>

          {/* ── Method Selection ── */}
          {step === 'method' ? (
            <>
              <Text style={styles.sectionTitle}>اختر طريقة الدفع</Text>

              {/* Card methods (mada, visa, mastercard) in 2-col grid */}
              <View style={styles.methodGrid}>
                {PAYMENT_METHODS.filter((m) => ['mada', 'visa', 'mastercard'].includes(m.id)).map((method) => {
                  const chosen = selectedMethod === method.id;
                  return (
                    <Pressable
                      key={method.id}
                      onPress={() => handleSelectMethod(method.id)}
                      style={({ pressed }) => [
                        styles.methodCard,
                        chosen && [styles.methodCardActive, { borderColor: method.color }],
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <MethodLogo id={method.id} size={24} />
                      <Text style={styles.methodName}>{method.arabic}</Text>
                      {chosen ? (
                        <View style={[styles.methodCheck, { backgroundColor: method.color }]}>
                          <AppIcon name="checkmark" size={10} color="#fff" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {/* Digital wallets (full width) */}
              <Text style={styles.walletTitle}>المحافظ الرقمية</Text>
              <View style={styles.walletList}>
                {PAYMENT_METHODS.filter((m) => ['apple_pay', 'stc_pay'].includes(m.id)).map((method) => {
                  const chosen = selectedMethod === method.id;
                  return (
                    <Pressable
                      key={method.id}
                      onPress={() => handleSelectMethod(method.id)}
                      style={({ pressed }) => [
                        styles.walletCard,
                        chosen && [styles.walletCardActive, { borderColor: method.color }],
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <MethodLogo id={method.id} size={26} />
                      <View style={{ flex: 1, marginHorizontal: spacing.md }}>
                        <Text style={styles.walletName}>{method.arabic}</Text>
                        <Text style={styles.walletSub}>دفع سريع وآمن</Text>
                      </View>
                      {chosen
                        ? <View style={[styles.radioCircle, { backgroundColor: method.color, borderColor: method.color }]}><View style={styles.radioDot} /></View>
                        : <View style={styles.radioCircle} />
                      }
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* ── Card Details ── */}
          {step === 'card_details' ? (
            <>
              <VirtualCard
                cardNumber={cardNumber}
                cardName={cardName}
                expiry={expiry}
                methodId={selectedMethod}
                colors={colors}
              />

              <Text style={styles.sectionTitle}>بيانات البطاقة</Text>

              <View style={styles.formCard}>
                {/* Card holder name */}
                <FloatingField
                  label="اسم حامل البطاقة"
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder="كما يظهر على البطاقة"
                  autoCapitalize="characters"
                  colors={colors}
                />

                {/* Card number */}
                <FloatingField
                  label="رقم البطاقة"
                  value={cardNumber}
                  onChangeText={(t) => setCardNumber(formatCardInput(t))}
                  placeholder="0000  0000  0000  0000"
                  keyboardType="number-pad"
                  maxLength={19}
                  icon="credit-card-outline"
                  colors={colors}
                />

                {/* Expiry + CVV */}
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <FloatingField
                      label="تاريخ الانتهاء"
                      value={expiry}
                      onChangeText={(t) => {
                        const n = t.replace(/\D/g, '').slice(0, 4);
                        setExpiry(n.length > 2 ? n.slice(0, 2) + '/' + n.slice(2) : n);
                      }}
                      placeholder="MM/YY"
                      keyboardType="number-pad"
                      maxLength={5}
                      colors={colors}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatingField
                      label="رمز CVV"
                      value={cvv}
                      onChangeText={(t) => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                      placeholder="•••"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      icon="help-circle-outline"
                      onFocus={() => setCvvFocused(true)}
                      onBlur={() => setCvvFocused(false)}
                      colors={colors}
                    />
                  </View>
                </View>
              </View>

              {/* 3DS / Secure notice */}
              <View style={styles.secureRow}>
                <AppIcon name="shield-lock" size={15} color={colors.emerald} />
                <Text style={styles.secureText}>محمية بـ 3D Secure · TLS 1.3 · PCI-DSS Level 1</Text>
              </View>
            </>
          ) : null}

          {/* ── Trust badges ── */}
          <View style={styles.trustRow}>
            {[
              { icon: 'shield-lock',  label: 'دفع مشفّر' },
              { icon: 'badge-check',  label: 'PCI-DSS' },
              { icon: 'lock-outline', label: '3D Secure' },
            ].map((b) => (
              <View key={b.icon} style={styles.trustBadge}>
                <AppIcon name={b.icon} size={16} color={colors.textMuted} />
                <Text style={styles.trustLabel}>{b.label}</Text>
              </View>
            ))}
          </View>

          {/* NI branding */}
          <View style={styles.niBrand}>
            <AppIcon name="lock-outline" size={13} color={colors.textSubtle} />
            <Text style={styles.niText}>
              مدفوعات آمنة عبر{' '}
              <Text style={{ color: colors.electricBright, fontWeight: '700' }}>Network International</Text>
            </Text>
          </View>

          <View style={{ height: 130 }} />
        </ScrollView>
      </Animated.View>

      {/* ── Pay CTA (fixed bottom) ── */}
      <SafeAreaView edges={['bottom']} style={styles.ctaWrap}>
        <Pressable
          onPress={handlePay}
          disabled={!selectedMethod || loading}
          style={({ pressed }) => [
            styles.ctaBtn,
            (!selectedMethod || loading) && { opacity: 0.45 },
            pressed && { opacity: 0.82 },
          ]}
        >
          <LinearGradient
            colors={selectedMethod ? [planColor, planColorEnd] : [colors.bgSurface, colors.bgElevated]}
            style={styles.ctaBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <AppIcon name="lock" size={18} color="#fff" />
                <Text style={styles.ctaBtnText}>
                  {step === 'method' && needsCardForm
                    ? 'التالي · إدخال بيانات البطاقة'
                    : step === 'method' && isWallet
                    ? `ادفع ${amount} ريال`
                    : `ادفع ${amount} ريال الآن`}
                </Text>
                <View style={styles.ctaAmountPill}>
                  <Text style={styles.ctaAmountText}>{amount} ر.س</Text>
                </View>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

// ─── Floating label field ──────────────────────────────────────────────────────

interface FloatingFieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad' | 'email-address';
  maxLength?: number;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  icon?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  colors: ThemeColors;
}

function FloatingField({ label, value, onChangeText, placeholder, keyboardType, maxLength, secureTextEntry, autoCapitalize, icon, onFocus, onBlur, colors }: FloatingFieldProps) {
  const [focused, setFocused] = useState(false);
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(labelAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    onFocus?.();
  };
  const handleBlur = () => {
    setFocused(false);
    if (!value) Animated.timing(labelAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    onBlur?.();
  };

  const labelTop = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 4] });
  const labelSize = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 11] });
  const labelColor = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.textSubtle, colors.electricBright] });

  return (
    <View style={[floatStyles.wrap, focused && floatStyles.wrapFocused, { borderColor: focused ? colors.electricBright : colors.borderMid }]}>
      <Animated.Text style={[floatStyles.label, { top: labelTop, fontSize: labelSize, color: focused ? colors.electricBright : colors.textMuted }]}>
        {label}
      </Animated.Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={focused ? placeholder : ''}
        placeholderTextColor={colors.textSubtle}
        style={[floatStyles.input, { color: colors.textPrimary, paddingRight: icon ? 42 : 16 }]}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        onFocus={handleFocus}
        onBlur={handleBlur}
        textAlign="right"
      />
      {icon ? (
        <View style={floatStyles.iconWrap}>
          <AppIcon name={icon} size={18} color={colors.textSubtle} />
        </View>
      ) : null}
    </View>
  );
}

const floatStyles = StyleSheet.create({
  wrap: {
    height: 60,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    position: 'relative',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  wrapFocused: {
    borderWidth: 2,
  },
  label: {
    position: 'absolute',
    right: 16,
    fontWeight: '500',
  },
  input: {
    height: 38,
    paddingHorizontal: 16,
    paddingTop: 0,
    fontSize: 15,
    fontWeight: '500',
  },
  iconWrap: {
    position: 'absolute',
    left: 14,
    bottom: 14,
  },
});

// ─── Receipt row ───────────────────────────────────────────────────────────────

function ReceiptRow({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ fontSize: 13, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: highlight ? 16 : small ? 11 : 13, fontWeight: highlight ? '800' : '600', color: highlight ? colors.electricBright : small ? colors.textSubtle : colors.textSecondary, textAlign: 'right', flex: 1, marginStart: 8 }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  const cardBg = scheme === 'dark' ? colors.bgElevated : colors.bgSurface;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgDeep },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSoft },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { ...typography.h3, color: colors.textPrimary },
    headerSecure: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
    headerSecureText: { fontSize: 11, color: colors.emerald, fontWeight: '600' },

    // Step indicator
    stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingBottom: 12, gap: 0 },
    stepItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.bgElevated, borderWidth: 1.5, borderColor: colors.borderMid, alignItems: 'center', justifyContent: 'center' },
    stepDotActive: { backgroundColor: colors.electric, borderColor: colors.electric },
    stepDotText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
    stepLabel: { fontSize: 11, color: colors.textMuted, marginHorizontal: 4 },
    stepLabelActive: { color: colors.electricBright, fontWeight: '700' },
    stepLine: { width: 24, height: 1.5, backgroundColor: colors.borderSoft, marginHorizontal: 2 },
    stepLineActive: { backgroundColor: colors.electric },

    scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

    // Order card
    orderCard: { borderRadius: 20, padding: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm },
    orderTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    orderLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 4 },
    orderPlanName: { fontSize: 22, fontWeight: '800', color: '#fff' },
    orderAmountWrap: { alignItems: 'flex-end' },
    orderAmount: { fontSize: 38, fontWeight: '900', color: '#fff', lineHeight: 42 },
    orderCurrency: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
    savingsTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, alignSelf: 'flex-start', marginTop: 4 },
    savingsText: { fontSize: 12, color: '#fff', fontWeight: '600' },

    sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 14 },

    // Method grid (cards)
    methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    methodCard: { flex: 1, minWidth: '28%', aspectRatio: 1.4, backgroundColor: cardBg, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.borderSoft, position: 'relative' },
    methodCardActive: { borderWidth: 2, backgroundColor: colors.bgDeep },
    methodName: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    methodCheck: { position: 'absolute', top: 8, left: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

    // Wallet list
    walletTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 10, letterSpacing: 0.5 },
    walletList: { gap: 10, marginBottom: 20 },
    walletCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: 16, backgroundColor: cardBg, borderWidth: 1.5, borderColor: colors.borderSoft },
    walletCardActive: { borderWidth: 2, backgroundColor: colors.bgDeep },
    walletName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    walletSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderMid, alignItems: 'center', justifyContent: 'center' },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },

    // Card form
    formCard: { backgroundColor: cardBg, borderRadius: 20, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderSoft },
    fieldRow: { flexDirection: 'row', gap: 12 },

    // Secure
    secureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.emerald + '12', borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.emerald + '30', marginBottom: spacing.lg },
    secureText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

    // Trust
    trustRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginVertical: spacing.lg },
    trustBadge: { alignItems: 'center', gap: 5 },
    trustLabel: { fontSize: 10, color: colors.textSubtle, fontWeight: '600' },

    niBrand: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', paddingBottom: spacing.sm },
    niText: { fontSize: 12, color: colors.textSubtle },

    // CTA
    ctaWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.bgDeep + 'EE' },
    ctaBtn: { borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
    ctaBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17, borderRadius: 18 },
    ctaBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 16 },
    ctaAmountPill: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
    ctaAmountText: { fontSize: 12, fontWeight: '800', color: '#fff' },

    // Processing
    processingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
    processingIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSoft },
    processingTitle: { ...typography.h2, color: colors.textPrimary },
    processingSubtitle: { ...typography.body, color: colors.textMuted },
    processingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderSoft, marginTop: spacing.md },
    processingBadgeText: { fontSize: 12, color: colors.emerald, fontWeight: '600' },

    // Success
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
    successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    successTitle: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
    successSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
    receiptCard: { width: '100%', backgroundColor: cardBg, borderRadius: 20, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderMid },
    receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    receiptHeaderText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
    receiptDivider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 10 },
    successBtn: { width: '100%', borderRadius: 18, overflow: 'hidden' },
    successBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    successBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 16 },
  });
}
