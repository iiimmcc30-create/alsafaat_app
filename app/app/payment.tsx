// frontend/app/payment.tsx
// frontend/app/payment.tsx
// واجهة الدفع — نفس التصميم، فقط تغير الخدمة الخلفية وحذف Tabby
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import {
  NIPaymentMethod,
  PAYMENT_METHODS,
} from '@/services/network_international';
import { normalizeSlug, planGradientColors } from '@/services/subscriptionPlans';
import { usePlans } from '@/hooks/usePlans';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';

type Step = 'method' | 'card_details' | 'processing' | 'success';

export default function PaymentScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
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
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState('');

  useEffect(() => {
    if (!subscription.id && accessToken) {
      void refetchSubscription();
    }
  }, [subscription.id, accessToken, refetchSubscription]);

  const needsCardForm =
    selectedMethod === 'mada' ||
    selectedMethod === 'visa' ||
    selectedMethod === 'mastercard';

  const handleSelectMethod = (method: NIPaymentMethod) => {
    setSelectedMethod(method);
  };

  const handlePay = async () => {
    if (!selectedMethod) return;

    if (needsCardForm && step === 'method') {
      setStep('card_details');
      return;
    }

    if (!accessToken) {
      Alert.alert('غير مصرح', 'يجب تسجيل الدخول لإتمام الدفع');
      return;
    }

    if (!subscription.id) {
      Alert.alert(
        'خطأ',
        'تعذر تحميل بيانات الاشتراك. تأكدي أن الباك إند شغال وأنك مسجّلة الدخول، ثم حاولي مجدداً.',
      );
      return;
    }

    setLoading(true);
    setStep('processing');

    try {
      const res = await fetch(`${API_BASE}/api/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
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
        const { checkoutUrl, paymentId, devMode } = json.data as {
          checkoutUrl: string;
          paymentId?: string;
          devMode?: boolean;
        };

        if (devMode && paymentId) {
          Alert.alert(
            'وضع التطوير',
            'بوابة الدفع الحقيقية غير مفعّلة. يمكنك محاكاة نجاح الدفع للاختبار.',
            [
              {
                text: 'محاكاة النجاح',
                onPress: async () => {
                  const simRes = await fetch(
                    `${API_BASE}/api/payments/${paymentId}/dev-complete`,
                    {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${accessToken}` },
                    },
                  );
                  const simJson = await simRes.json().catch(() => ({}));
                  if (simRes.ok && simJson.success) {
                    setTransactionId(paymentId);
                    setStep('success');
                    await refetchSubscription();
                  } else {
                    setStep('method');
                    Alert.alert('فشل', simJson.messageAr || 'تعذرت محاكاة الدفع');
                  }
                },
              },
              {
                text: 'فتح الرابط',
                onPress: async () => {
                  const canOpen = await Linking.canOpenURL(checkoutUrl);
                  if (canOpen) await Linking.openURL(checkoutUrl);
                  else await WebBrowser.openBrowserAsync(checkoutUrl);
                },
              },
              { text: 'إلغاء', style: 'cancel', onPress: () => setStep('method') },
            ],
          );
          return;
        }

        const canOpen = await Linking.canOpenURL(checkoutUrl);
        if (canOpen) {
          await Linking.openURL(checkoutUrl);
        } else {
          await WebBrowser.openBrowserAsync(checkoutUrl);
        }
        Alert.alert(
          'أكمل الدفع',
          'تم فتح صفحة الدفع عبر الشبكة الدولية. بعد إتمام الدفع سيتم تحديث اشتراكك تلقائياً.',
          [{
            text: 'حسناً',
            onPress: async () => {
              await refetchSubscription();
              router.back();
            },
          }]
        );
      } else {
        setStep('method');
        const detail =
          json.messageAr ||
          json.message ||
          (Array.isArray(json.message) ? json.message.join('\n') : null) ||
          json.error ||
          'حدث خطأ أثناء الدفع. يرجى المحاولة مجددًا.';
        Alert.alert('فشل الدفع', String(detail));
      }
    } catch {
      setStep('method');
      Alert.alert('فشل الدفع', 'تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success Screen ──
  if (step === 'success') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.successWrap} edges={['top', 'bottom']}>
          <LinearGradient colors={[planColor, planColorEnd]} style={styles.successIconBg}>
            <AppIcon name="check-bold" size={56} color="#fff" />
          </LinearGradient>
          <Text style={styles.successTitle}>تمّ الاشتراك بنجاح! 🎉</Text>
          <Text style={styles.successSubtitle}>
            مرحباً بك في باقة{' '}
            <Text style={{ color: planColorEnd, fontWeight: '700' }}>{plan.name}</Text>
          </Text>
          <View style={styles.receiptCard}>
            <ReceiptRow label="الباقة"        value={plan.name} />
            <ReceiptRow label="دورة الفوترة"  value={billingCycle === 'yearly' ? 'سنوي' : 'شهري'} />
            <ReceiptRow label="المبلغ المدفوع" value={`${amount} ريال`} highlight />
            <ReceiptRow label="طريقة الدفع"   value={PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.arabic ?? ''} />
            <ReceiptRow label="رقم العملية"   value={transactionId} small />
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
        </SafeAreaView>
      </View>
    );
  }

  // ── Processing Screen ──
  if (step === 'processing') {
    return (
      <View style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <View style={styles.processingWrap}>
          <ActivityIndicator size="large" color={planColorEnd} />
          <Text style={styles.processingTitle}>جارٍ معالجة الدفع...</Text>
          <Text style={styles.processingSubtitle}>عبر الشبكة الدولية الآمنة</Text>
          <View style={styles.processingLogo}>
            <AppIcon name="shield-lock" size={20} color={colors.success} />
            <Text style={styles.processingLogoText}>محمي بواسطة Network International</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => step === 'card_details' ? setStep('method') : router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>الدفع والاشتراك</Text>
          <Text style={styles.headerSub}>دفع آمن عبر الشبكة الدولية</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Order summary */}
        <LinearGradient colors={[planColor, planColorEnd]} style={styles.orderCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.orderTop}>
            <View>
              <Text style={styles.orderPlan}>باقة {plan.name}</Text>
              <Text style={styles.orderCycle}>{billingCycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'}</Text>
            </View>
            <View style={styles.orderPrice}>
              <Text style={styles.orderAmount}>{amount}</Text>
              <Text style={styles.orderCurrency}> ريال</Text>
            </View>
          </View>
          {billingCycle === 'yearly' ? (
            <View style={styles.orderSavingTag}>
              <AppIcon name="tag" size={14} color="#fff" />
              <Text style={styles.orderSavingText}>
                وفّرت {plan.monthlyPrice * 12 - plan.yearlyPrice} ريال مقارنةً بالشهري
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        {step === 'method' ? (
          <>
            <Text style={styles.sectionTitle}>اختر طريقة الدفع</Text>
            <Text style={styles.sectionSub}>اختر الطريقة المناسبة</Text>
            <View style={styles.methodsList}>
              {PAYMENT_METHODS.map((method) => {
                const isChosen = selectedMethod === method.id;
                return (
                  <Pressable
                    key={method.id}
                    onPress={() => handleSelectMethod(method.id)}
                    style={({ pressed }) => [
                      styles.methodCard,
                      isChosen && { borderColor: method.color, borderWidth: 2 },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={[styles.methodIcon, { backgroundColor: method.color + '22' }]}>
                      <Text style={styles.methodEmoji}>{method.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.methodLabel}>{method.arabic}</Text>
                      <Text style={styles.methodSub}>{method.english}</Text>
                    </View>
                    {isChosen ? (
                      <AppIcon name="check-circle" size={22} color={method.color} />
                    ) : (
                      <View style={styles.radioEmpty} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 'card_details' ? (
          <>
            <Text style={styles.sectionTitle}>بيانات البطاقة</Text>
            <Text style={styles.sectionSub}>أدخل بيانات البطاقة</Text>
            <View style={styles.cardForm}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>اسم حامل البطاقة</Text>
                <TextInput
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder="الاسم كما يظهر على البطاقة"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.field}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>رقم البطاقة</Text>
                <TextInput
                  value={cardNumber}
                  onChangeText={(t) => setCardNumber(t.replace(/\D/g, '').slice(0, 16))}
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.field}
                  keyboardType="number-pad"
                  maxLength={19}
                />
                <AppIcon name="credit-card-outline" size={20} color={colors.textSubtle} style={styles.fieldIcon} />
              </View>
              <View style={styles.fieldRow}>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>تاريخ الانتهاء</Text>
                  <TextInput
                    value={expiry}
                    onChangeText={(t) => setExpiry(t.replace(/\D/g, '').slice(0, 4))}
                    placeholder="MM/YY"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.field}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>رمز الأمان</Text>
                  <TextInput
                    value={cvv}
                    onChangeText={(t) => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.field}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                  />
                </View>
              </View>
            </View>
            <View style={styles.secureNotice}>
              <AppIcon name="shield-lock" size={16} color={colors.success} />
              <Text style={styles.secureText}>محمية بـ 3D Secure · بيانات مشفرة بالكامل</Text>
            </View>
          </>
        ) : null}

        {/* NI branding */}
        <View style={styles.niStrip}>
          <AppIcon name="lock-outline" size={16} color={colors.textSubtle} />
          <Text style={styles.niStripText}>
            مدفوعات آمنة عبر{' '}
            <Text style={{ color: colors.textBrand }}>Network International</Text>
            {' '}· PCI-DSS Level 1
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Pay CTA */}
      <SafeAreaView edges={['bottom']} style={styles.ctaWrap}>
        <Pressable
          onPress={handlePay}
          disabled={!selectedMethod || loading}
          style={({ pressed }) => [
            styles.ctaBtn,
            (!selectedMethod || loading) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <LinearGradient
            colors={selectedMethod ? [planColor, planColorEnd] : [colors.bgSurface, colors.bgSurface]}
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
                    : `ادفع ${amount} ريال الآن`}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function ReceiptRow({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  const rr = useThemedStyles(({ colors }) => createReceiptStyles(colors));
  return (
    <View style={rr.row}>
      <Text style={rr.label}>{label}</Text>
      <Text style={[rr.value, highlight && rr.valueHighlight, small && rr.valueSmall]}>{value}</Text>
    </View>
  );
}

function createReceiptStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  label:          { ...typography.caption, color: colors.textMuted },
  value:          { ...typography.caption, color: colors.textSecondary, flex: 1, textAlign: 'right' },
  valueHighlight: { ...typography.bodyStrong, color: colors.gold },
  valueSmall:     { fontSize: 10, color: colors.textSubtle },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.bgDeep },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSoft },
  headerTitle:  { ...typography.h2, color: colors.textPrimary },
  headerSub:    { ...typography.caption, color: colors.textBrand },
  scroll:       { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  orderCard:       { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm },
  orderTop:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  orderPlan:       { ...typography.h3, color: '#fff' },
  orderCycle:      { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
  orderPrice:      { flexDirection: 'row', alignItems: 'baseline' },
  orderAmount:     { fontSize: 32, fontWeight: '800', color: '#fff' },
  orderCurrency:   { ...typography.bodyStrong, color: 'rgba(255,255,255,0.8)' },
  orderSavingTag:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  orderSavingText: { ...typography.caption, color: '#fff' },

  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 2 },
  sectionSub:   { ...typography.caption, color: colors.textMuted, marginBottom: spacing.lg },

  methodsList:  { gap: spacing.md },
  methodCard:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderSoft },
  methodIcon:   { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  methodEmoji:  { fontSize: 22 },
  methodLabel:  { ...typography.bodyStrong, color: colors.textPrimary },
  methodSub:    { ...typography.caption, color: colors.textMuted },
  radioEmpty:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderMid },

  cardForm:    { gap: spacing.md, marginBottom: spacing.md },
  fieldWrap:   { position: 'relative' },
  fieldRow:    { flexDirection: 'row', gap: spacing.md },
  fieldLabel:  { ...typography.caption, color: colors.textMuted, marginBottom: 6 },
  field:       { height: 52, borderRadius: radius.lg, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderMid, paddingHorizontal: spacing.lg, paddingRight: 48, color: colors.textPrimary, fontSize: 15 },
  fieldIcon:   { position: 'absolute', right: spacing.lg, bottom: 16 },

  secureNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${colors.success}15`, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: `${colors.success}30`, marginBottom: spacing.lg },
  secureText:   { ...typography.caption, color: colors.textSecondary },

  niStrip:     { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: spacing.md, padding: spacing.md },
  niStripText: { ...typography.caption, color: colors.textSubtle },

  ctaWrap:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  ctaBtn:      { borderRadius: radius.xl, overflow: 'hidden' },
  ctaBtnGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: radius.xl },
  ctaBtnText:  { ...typography.bodyStrong, color: '#fff', fontSize: 16 },

  processingWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  processingTitle:    { ...typography.h2, color: colors.textPrimary },
  processingSubtitle: { ...typography.body, color: colors.textMuted },
  processingLogo:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xl, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderSoft },
  processingLogoText: { ...typography.caption, color: colors.textBrandSuccess },

  successWrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  successIconBg:       { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  successTitle:        { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  successSubtitle:     { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  receiptCard:         { width: '100%', backgroundColor: colors.bgSurface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.borderMid, gap: 4 },
  successFeatures:     { width: '100%', gap: spacing.sm },
  successFeaturesTitle:{ ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  successFeatureRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  successFeatureIcon:  { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  successFeatureText:  { ...typography.caption, color: colors.textSecondary },
  successBtn:          { width: '100%', borderRadius: radius.xl, overflow: 'hidden' },
  successBtnGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  successBtnText:      { ...typography.bodyStrong, color: '#fff', fontSize: 16 },
  });
}
