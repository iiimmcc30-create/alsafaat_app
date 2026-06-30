// Powered by OnSpace.AI
// SAFAT — Butcher Order Screen (صفحة الطلب)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

const CUT_OPTIONS: CutType[] = ['whole', 'half', 'quarter', 'ribs', 'leg', 'shoulder', 'liver', 'mixed', 'custom'];

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
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={{ marginTop: spacing.md, color: colors.textSecondary, ...typography.body, textAlign: 'center' }}>
            تعذر العثور على بيانات الملحمة المطلوبة.
          </Text>
          <Pressable style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.bgSurface, borderRadius: radius.md }} onPress={() => router.back()}>
            <Text style={{ color: colors.electricBright }}>رجوع</Text>
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

  const handleSubmit = async () => {
    if (!selectedProduct) return;
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
        totalPrice: computedTotal,
        currency: currency.symbol,
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

      if (res.ok && json.success) {
        const orderId = json.data?.id;
        setSubmitted(true);
        setTimeout(() => {
          router.replace({
            pathname: '/butchers/order-success',
            params: {
              orderId: orderId ?? '',
              butcherId: butcherId ?? '',
            },
          });
        }, 1500);
      } else {
        const errorMsg = json.messageAr || json.message || 'حدث خطأ أثناء إرسال الطلب';
        Alert.alert('خطأ', errorMsg);
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
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>تم إرسال طلبك!</Text>
          <Text style={s.successSub}>سيتواصل معك الجزار قريباً لتأكيد الطلب</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>طلب جديد</Text>
          <Text style={s.headerSub}>{butcher.nameAr}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Butcher mini-card */}
        <View style={s.butcherCard}>
          <Image source={{ uri: butcher.logo }} style={s.butcherLogo} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={s.butcherName}>{butcher.nameAr}</Text>
            <Text style={s.butcherCity}>{butcher.cityAr} · {currency.nameAr}</Text>
          </View>
          {butcher.subscriptionActive && (
            <View style={s.verifiedMini}>
              <Ionicons name="shield-checkmark" size={13} color={colors.gold} />
              <Text style={s.verifiedMiniText}>موثّق</Text>
            </View>
          )}
        </View>

        {/* Product Selection */}
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
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        {/* Cut Type */}
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

        {/* Weight (if priced per kg) */}
        {selectedProduct?.pricePerKg && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>الوزن (كغ)</Text>
            <View style={s.weightRow}>
              <Pressable
                style={s.weightBtn}
                onPress={() => setWeight((w) => Math.max(0.5, parseFloat(w || '1') - 0.5).toString())}
              >
                <Ionicons name="remove" size={20} color={colors.textPrimary} />
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
                <Ionicons name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            {selectedProduct.weightRange && (
              <Text style={s.weightHint}>
                النطاق المتاح: {selectedProduct.weightRange.min}–{selectedProduct.weightRange.max} كغ
              </Text>
            )}
          </View>
        )}

        {/* Delivery Type */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>طريقة الاستلام</Text>
          <View style={s.deliveryRow}>
            <Pressable
              onPress={() => setDeliveryType('pickup')}
              style={[s.deliveryOption, deliveryType === 'pickup' && s.deliveryOptionActive]}
            >
              <MaterialCommunityIcons
                name="store-outline"
                size={22}
                color={deliveryType === 'pickup' ? colors.electric : colors.textMuted}
              />
              <Text style={[s.deliveryLabel, deliveryType === 'pickup' && s.deliveryLabelActive]}>
                استلام من الملحمة
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDeliveryType('delivery')}
              style={[s.deliveryOption, deliveryType === 'delivery' && s.deliveryOptionActive]}
            >
              <MaterialCommunityIcons
                name="truck-delivery-outline"
                size={22}
                color={deliveryType === 'delivery' ? colors.electric : colors.textMuted}
              />
              <Text style={[s.deliveryLabel, deliveryType === 'delivery' && s.deliveryLabelActive]}>
                توصيل للمنزل
              </Text>
            </Pressable>
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

        {/* Notes */}
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

        {/* Order Summary */}
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
            <Text style={s.summaryTotalLabel}>الإجمالي التقريبي</Text>
            <Text style={s.summaryTotalValue}>
              {computedTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })} {currency.symbol}
            </Text>
          </View>
          <Text style={s.summaryNote}>
            * السعر النهائي يُحدد بعد تأكيد الجزار بناءً على الوزن الفعلي
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Submit */}
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
                <Ionicons name="paper-plane-outline" size={20} color="#fff" />
                <Text style={s.submitBtnText}>إرسال الطلب للجزار</Text>
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
  headerSub: { ...typography.caption, color: colors.glow, marginTop: 1 },

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
  weightHint: { ...typography.caption, color: colors.textMuted, marginTop: 6, textAlign: 'right' },

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
  deliveryLabelActive: { color: colors.electricBright, fontWeight: '600' },
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

  // Success
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  successIcon: { fontSize: 72 },
  successTitle: { ...typography.h1, color: colors.textPrimary },
  successSub: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
