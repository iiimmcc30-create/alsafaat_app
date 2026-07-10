// Powered by OnSpace.AI
// SAFAT — Butcher Order Screen (صفحة الطلب + الدفع عبر بوابة المنصة)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import {
  CATEGORY_LABELS,
  CUT_LABELS,
  CutType,
  DeliveryType,
  gccCurrencies,
  MeatCategory,
} from '@/services/butcherData';
import { PAYMENT_METHODS, NIPaymentMethod } from '@/services/network_international';

export default function ButcherOrderScreen() {
  const { productId, butcherId } = useLocalSearchParams<{ productId?: string; butcherId: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [butcher, setButcher] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<string>(productId ?? '');
  const [selectedCut, setSelectedCut] = useState<CutType>('whole');
  const [weight, setWeight] = useState<string>('1');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<NIPaymentMethod>('mada');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const [resButcher, resProducts] = await Promise.all([
          fetch(`${API_BASE}/api/butchers/${butcherId}`, { headers }),
          fetch(`${API_BASE}/api/butchers/products?butcherId=${butcherId}`, { headers }),
        ]);

        if (!active) return;

        if (resButcher.ok) {
          const json = await resButcher.json();
          if (json.success && json.data) {
            setButcher(json.data);
          }
        }
        if (resProducts.ok) {
          const json = await resProducts.json();
          if (json.success && json.data) {
            setProducts(json.data);
            if (json.data.length > 0) {
              const defaultProd = json.data.find((p: any) => p.id === productId) || json.data[0];
              setSelectedProductId(defaultProd.id);
              setSelectedCut(defaultProd.availableCuts[0] || 'whole');
            }
          }
        }
      } catch (err) {
        console.warn('[ButcherOrder] Fetch failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [butcherId, accessToken, productId]);

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.electricBright} />
          <Text style={{ marginTop: spacing.md, color: colors.textMuted, ...typography.body }}>جاري تحميل البيانات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!butcher) {
    return (
      <SafeAreaView style={s.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <AppIcon name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={{ marginTop: spacing.md, color: colors.textSecondary, ...typography.body, textAlign: 'center' }}>
            تعذر العثور على بيانات الملحمة المطلوبة.
          </Text>
          <Pressable style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.bgSurface, borderRadius: radius.md }} onPress={() => router.back()}>
            <Text style={{ color: colors.textBrandStrong }}>رجوع</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currency = gccCurrencies[butcher.country as keyof typeof gccCurrencies] || gccCurrencies['SA'];
  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? products[0];
  const availableCuts = selectedProduct?.availableCuts ?? [];

  const computedTotal = (() => {
    if (!selectedProduct) return 0;
    if (selectedProduct.pricePerKg) {
      return parseFloat(weight || '0') * selectedProduct.pricePerKg;
    }
    return selectedProduct.priceFixed ?? 0;
  })();

  const goSuccess = (orderId: string, orderNumber: string, paymentStatus: string) => {
    setSubmitted(true);
    setTimeout(() => {
      router.replace({
        pathname: '/butchers/order-success',
        params: {
          orderId: orderId ?? '',
          orderNumber: orderNumber ?? '',
          butcherId: butcherId ?? '',
          paymentStatus: paymentStatus ?? 'unpaid',
        },
      });
    }, 800);
  };

  const handleSubmit = async () => {
    if (!selectedProduct) return;
    if (!accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لإتمام الطلب والدفع');
      return;
    }
    if (deliveryType === 'delivery' && !address.trim()) {
      Alert.alert('العنوان مطلوب', 'أدخل عنوان التوصيل قبل إتمام الدفع');
      return;
    }
    if (computedTotal <= 0) {
      Alert.alert('خطأ', 'مبلغ الطلب غير صالح');
      return;
    }

    setLoadingSubmit(true);
    try {
      const payload = {
        butcherId,
        productId: selectedProductId,
        cutType: selectedCut,
        weightKg: selectedProduct.pricePerKg ? parseFloat(weight || '1') : 1.0,
        deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? address : null,
        notes: notes || null,
        currency: currency.code,
      };

      const res = await fetch(`${API_BASE}/api/butchers/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        const errorMsg = json.messageAr || json.message || 'حدث خطأ أثناء إنشاء الطلب';
        Alert.alert('خطأ', errorMsg);
        return;
      }

      const orderId = json.data?.id as string;
      const orderNumber = json.data?.orderNumber as string;
      const amount = Number(json.data?.totalPrice ?? computedTotal);

      const payRes = await fetch(`${API_BASE}/api/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount,
          currency: currency.code || 'SAR',
          method: selectedMethod,
          type: 'butcher_order',
          referenceId: orderId,
          description: `Butcher order ${orderNumber}`,
          descriptionAr: `دفع طلب ملحمة رقم ${orderNumber}`,
        }),
      });

      const payJson = await payRes.json().catch(() => ({}));

      if (!payRes.ok || !payJson.success || !payJson.data) {
        const errMsg = payJson.messageAr || payJson.message || 'فشل إنشاء معاملة الدفع';
        Alert.alert(
          'الطلب بانتظار الدفع',
          `${errMsg}\nيمكنك إكمال الدفع لاحقاً من صفحة الطلب.`,
          [{ text: 'متابعة', onPress: () => goSuccess(orderId, orderNumber, 'unpaid') }],
        );
        return;
      }

      const { checkoutUrl, paymentId, devMode } = payJson.data as {
        checkoutUrl?: string;
        paymentId?: string;
        devMode?: boolean;
      };

      if (devMode && paymentId) {
        const simRes = await fetch(`${API_BASE}/api/payments/${paymentId}/dev-complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const simJson = await simRes.json().catch(() => ({}));
        if (simRes.ok && simJson.success) {
          goSuccess(orderId, orderNumber, 'paid');
          return;
        }
      }

      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl).catch(() => {});
        Alert.alert(
          'أكمل الدفع',
          'تم فتح بوابة الدفع. بعد إتمام الدفع سيصل طلبك للملحمة تلقائياً.',
          [{ text: 'حسناً', onPress: () => goSuccess(orderId, orderNumber, 'unpaid') }],
        );
      } else {
        goSuccess(orderId, orderNumber, 'unpaid');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'تعذر الاتصال بالخادم. يرجى التحقق من الشبكة.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <View style={s.successWrap}>
          <ActivityIndicator size="large" color={colors.electricBright} />
          <Text style={s.successTitle}>جاري التحويل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>طلب جديد</Text>
          <Text style={s.headerSub}>{butcher.nameAr}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.butcherCard}>
          <Image source={{ uri: butcher.logo }} style={s.butcherLogo} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={s.butcherName}>{butcher.nameAr}</Text>
            <Text style={s.butcherCity}>{butcher.cityAr} · {currency.nameAr}</Text>
          </View>
          {butcher.subscriptionActive && (
            <View style={s.verifiedMini}>
              <AppIcon name="shield-checkmark" size={13} color={colors.gold} />
              <Text style={s.verifiedMiniText}>موثّق</Text>
            </View>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>اختر المنتج</Text>
          {products.map((p: any) => (
            <Pressable
              key={p.id}
              onPress={() => {
                setSelectedProductId(p.id);
                setSelectedCut(p.availableCuts[0] ?? 'whole');
              }}
              style={[s.productOption, selectedProductId === p.id && s.productOptionActive]}
            >
              <Image source={{ uri: p.images[0] }} style={s.productThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={s.productOptionName}>{p.nameAr}</Text>
                <Text style={s.productOptionCat}>{CATEGORY_LABELS[p.category as MeatCategory]?.ar || p.category}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {p.pricePerKg ? (
                  <Text style={s.productOptionPrice}>{p.pricePerKg} {currency.symbol}/كغ</Text>
                ) : (
                  <Text style={s.productOptionPrice}>{p.priceFixed?.toLocaleString()} {currency.symbol}</Text>
                )}
                {selectedProductId === p.id && (
                  <View style={s.checkCircle}>
                    <AppIcon name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        {availableCuts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>طريقة التقطيع</Text>
            <View style={s.cutsGrid}>
              {availableCuts.map((cut: CutType) => (
                <Pressable
                  key={cut}
                  onPress={() => setSelectedCut(cut)}
                  style={[s.cutOption, selectedCut === cut && s.cutOptionActive]}
                >
                  <Text style={[s.cutOptionText, selectedCut === cut && s.cutOptionTextActive]}>
                    {CUT_LABELS[cut as CutType]?.ar || cut}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {selectedProduct?.pricePerKg && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>الوزن (كغ)</Text>
            <View style={s.weightRow}>
              <Pressable
                style={s.weightBtn}
                onPress={() => setWeight((w) => Math.max(0.5, parseFloat(w || '1') - 0.5).toString())}
              >
                <AppIcon name="remove" size={20} color={colors.textPrimary} />
              </Pressable>
              <TextInput
                style={s.weightInput}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Pressable
                style={s.weightBtn}
                onPress={() => setWeight((w) => (parseFloat(w || '0') + 0.5).toString())}
              >
                <AppIcon name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>طريقة الاستلام</Text>
          <View style={s.deliveryRow}>
            {(['pickup', 'delivery'] as DeliveryType[]).map((type) => (
              <Pressable
                key={type}
                onPress={() => setDeliveryType(type)}
                style={[s.deliveryOption, deliveryType === type && s.deliveryOptionActive]}
              >
                <AppIcon
                  name={type === 'pickup' ? 'store-outline' : 'truck-delivery-outline'}
                  size={18}
                  color={deliveryType === type ? colors.electricBright : colors.textMuted}
                />
                <Text style={[s.deliveryLabel, deliveryType === type && s.deliveryLabelActive]}>
                  {type === 'pickup' ? 'استلام من الملحمة' : 'توصيل'}
                </Text>
              </Pressable>
            ))}
          </View>
          {deliveryType === 'delivery' && (
            <TextInput
              style={s.addressInput}
              placeholder="أدخل عنوان التوصيل..."
              placeholderTextColor={colors.textSubtle}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>ملاحظات إضافية (اختياري)</Text>
          <TextInput
            style={s.notesInput}
            placeholder="مثال: أريد الكبد والرقبة منفصلين..."
            placeholderTextColor={colors.textSubtle}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>طريقة الدفع</Text>
          <Text style={s.payHint}>الدفع إلزامي عبر بوابة المنصة قبل إرسال الطلب للملحمة</Text>
          {PAYMENT_METHODS.map((method) => (
            <Pressable
              key={method.id}
              onPress={() => setSelectedMethod(method.id)}
              style={[s.payOption, selectedMethod === method.id && s.payOptionActive]}
            >
              <View style={[s.payDot, selectedMethod === method.id && s.payDotActive]} />
              <Text style={s.payOptionText}>{method.arabic}</Text>
              {selectedMethod === method.id && (
                <AppIcon name="checkmark-circle" size={18} color={colors.electricBright} />
              )}
            </Pressable>
          ))}
        </View>

        <View style={s.summaryCard}>
          <LinearGradient
            colors={[colors.electric + '22', colors.bgElevated]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={s.summaryTitle}>ملخص الطلب</Text>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>المنتج</Text>
            <Text style={s.summaryValue}>{selectedProduct?.nameAr}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>التقطيع</Text>
            <Text style={s.summaryValue}>{CUT_LABELS[selectedCut as CutType]?.ar || selectedCut}</Text>
          </View>
          {selectedProduct?.pricePerKg && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>الوزن</Text>
              <Text style={s.summaryValue}>{weight} كغ</Text>
            </View>
          )}
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>الاستلام</Text>
            <Text style={s.summaryValue}>{deliveryType === 'pickup' ? 'استلام من الملحمة' : 'توصيل'}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryTotalLabel}>المبلغ المستحق</Text>
            <Text style={s.summaryTotalValue}>
              {computedTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })} {currency.symbol}
            </Text>
          </View>
          <Text style={s.summaryNote}>
            * يتم الدفع عبر بوابة المنصة، ثم يصل الطلب للملحمة بعد نجاح العملية
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={s.submitWrap}>
        <LinearGradient
          colors={['transparent', colors.bgDeep]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable
          style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.88 }]}
          onPress={handleSubmit}
          disabled={loadingSubmit}
        >
          <LinearGradient
            colors={[colors.electric, colors.cyan]}
            style={s.submitBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loadingSubmit ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <AppIcon name="card-outline" size={20} color="#fff" />
                <Text style={s.submitBtnText}>إتمام الدفع وإرسال الطلب</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textBrand, marginTop: 1 },

  butcherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  butcherLogo: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgElevated,
  },
  butcherName: { ...typography.bodyStrong, color: colors.textPrimary },
  butcherCity: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  verifiedMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold + '22',
    borderWidth: 1,
    borderColor: colors.gold + '44',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  verifiedMiniText: { ...typography.micro, color: colors.gold, fontWeight: '700' },

  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'right' },
  payHint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md, textAlign: 'right' },

  productOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  productOptionActive: {
    borderColor: colors.electric,
    backgroundColor: colors.electric + '11',
  },
  productThumb: {
    width: 52, height: 52, borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  productOptionName: { ...typography.bodyStrong, color: colors.textPrimary },
  productOptionCat: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  productOptionPrice: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.electric,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },

  cutsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cutOption: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  cutOptionActive: { backgroundColor: colors.electric, borderColor: colors.electric },
  cutOptionText: { ...typography.caption, color: colors.textMuted },
  cutOptionTextActive: { color: '#fff', fontWeight: '600' },

  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  weightBtn: {
    width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  weightInput: {
    flex: 1,
    ...typography.h2,
    textAlign: 'center',
    color: colors.textPrimary,
    paddingVertical: 10,
  },

  deliveryRow: { flexDirection: 'row', gap: spacing.md },
  deliveryOption: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSurface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  deliveryOptionActive: { borderColor: colors.electric, backgroundColor: colors.electric + '11' },
  deliveryLabel: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  deliveryLabelActive: { color: colors.textBrandStrong, fontWeight: '600' },
  addressInput: {
    marginTop: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'right',
    minHeight: 70,
  },
  notesInput: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'right',
    minHeight: 80,
  },

  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.sm,
  },
  payOptionActive: {
    borderColor: colors.electric,
    backgroundColor: colors.electric + '11',
  },
  payDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderMid,
  },
  payDotActive: {
    borderColor: colors.electricBright,
    backgroundColor: colors.electricBright,
  },
  payOptionText: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1 },

  summaryCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.electric + '44',
    overflow: 'hidden',
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },
  summaryTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: { ...typography.caption, color: colors.textMuted },
  summaryValue: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 10 },
  summaryTotalLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  summaryTotalValue: { ...typography.h3, color: colors.gold },
  summaryNote: { ...typography.micro, color: colors.textSubtle, marginTop: spacing.sm, textAlign: 'right' },

  submitWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  submitBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  submitBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: radius.xl,
  },
  submitBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 16 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  successTitle: { ...typography.h1, color: colors.textPrimary },
});
