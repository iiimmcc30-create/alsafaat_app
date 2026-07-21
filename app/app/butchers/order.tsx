// SAFAT — Butcher Order Screen (صفحة الطلب + الدفع)
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { launchPaymentCheckout } from '@/services/payments';
import { resolveMediaUrl } from '@/services/media';
import {
  CATEGORY_LABELS,
  ButcherProduct,
  CutType,
  DeliveryType,
  MeatCategory,
  cutLabelAr,
  gccCurrencies,
  mapButcherFromApi,
  mapButcherProductFromApi,
  parseOrderWeightKg,
  routeParam,
  type ButcherProfile,
} from '@/services/butcherData';
import { PAYMENT_METHODS, NIPaymentMethod } from '@/services/network_international';

const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80';

export default function ButcherOrderScreen() {
  const params = useLocalSearchParams<{ productId?: string; butcherId?: string }>();
  const butcherId = routeParam(params.butcherId);
  const initialProductId = routeParam(params.productId);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors: c }) => createStyles(c));

  const [butcher, setButcher] = useState<ButcherProfile | null>(null);
  const [products, setProducts] = useState<ButcherProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCut, setSelectedCut] = useState<CutType>('whole');
  const [weight, setWeight] = useState('1');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<NIPaymentMethod>('mada');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!butcherId) {
      setLoadError('معرّف الملحمة غير صالح');
      setLoading(false);
      return;
    }

    let active = true;
    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const headers: HeadersInit = accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {};

        const [resButcher, resProducts] = await Promise.all([
          fetch(`${API_BASE}/api/butchers/${butcherId}`, { headers }),
          fetch(`${API_BASE}/api/butchers/products?butcherId=${butcherId}`, { headers }),
        ]);

        if (!active) return;

        let butcherJson: { success?: boolean; data?: Record<string, unknown> } | null = null;

        if (resButcher.ok) {
          butcherJson = await resButcher.json();
          if (butcherJson?.success && butcherJson.data) {
            setButcher(mapButcherFromApi(butcherJson.data));
          }
        }

        let mapped: ButcherProduct[] = [];
        if (resProducts.ok) {
          const json = await resProducts.json();
          const rows = Array.isArray(json.data) ? json.data : json.data?.products;
          if (json.success && Array.isArray(rows)) {
            mapped = rows.map((p: Record<string, unknown>) => mapButcherProductFromApi(p));
          }
        }

        if (mapped.length === 0 && Array.isArray(butcherJson?.data?.products)) {
          mapped = (butcherJson!.data!.products as Record<string, unknown>[]).map((p) =>
            mapButcherProductFromApi(p),
          );
        }

        setProducts(mapped.filter((p) => p.inStock));

        if (mapped.length > 0) {
          const preferred =
            mapped.find((p) => p.id === initialProductId && p.inStock) ??
            mapped.find((p) => p.inStock) ??
            mapped[0];
          setSelectedProductId(preferred.id);
          setSelectedCut(preferred.availableCuts[0] ?? 'whole');
          if (preferred.weightRange?.min) {
            setWeight(String(preferred.weightRange.min));
          }
        }

        if (!resButcher.ok) {
          setLoadError('تعذّر تحميل بيانات الملحمة');
        }
      } catch (err) {
        console.warn('[ButcherOrder] Fetch failed:', err);
        if (active) setLoadError('تعذّر الاتصال بالخادم');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    return () => {
      active = false;
    };
  }, [butcherId, accessToken, initialProductId]);

  const currency = gccCurrencies[butcher?.country ?? 'SA'] ?? gccCurrencies.SA;
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? products[0],
    [products, selectedProductId],
  );
  const availableCuts = selectedProduct?.availableCuts ?? [];

  const weightKg = parseOrderWeightKg(weight, selectedProduct);

  const computedTotal = useMemo(() => {
    if (!selectedProduct) return 0;
    if (selectedProduct.pricePerKg) {
      return weightKg * selectedProduct.pricePerKg;
    }
    return selectedProduct.priceFixed ?? 0;
  }, [selectedProduct, weightKg]);

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
    }, 600);
  };

  const handleSubmit = async () => {
    if (!selectedProduct) {
      Alert.alert('لا منتجات', 'لا توجد منتجات متاحة للطلب من هذه الملحمة حالياً');
      return;
    }
    if (!accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لإتمام الطلب والدفع');
      return;
    }
    if (deliveryType === 'delivery' && !address.trim()) {
      Alert.alert('العنوان مطلوب', 'أدخل عنوان التوصيل قبل إتمام الدفع');
      return;
    }
    if (computedTotal <= 0 || !Number.isFinite(computedTotal)) {
      Alert.alert('خطأ', 'مبلغ الطلب غير صالح');
      return;
    }

    setLoadingSubmit(true);
    try {
      const payload = {
        butcherId,
        productId: selectedProduct.id,
        cutType: selectedCut,
        weightKg,
        deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? address.trim() : null,
        notes: notes.trim() || null,
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

      const payOutcome = await launchPaymentCheckout({
        accessToken,
        paymentId,
        checkoutUrl,
        devMode,
        context: 'butcher_order',
        returnParams: {
          orderId,
          orderNumber,
          butcherId,
        },
      });

      if (payOutcome === 'cancelled') {
        goSuccess(orderId, orderNumber, 'unpaid');
        return;
      }

      if (payOutcome === 'failed') {
        Alert.alert(
          'الطلب بانتظار الدفع',
          devMode
            ? 'لم يكتمل الدفع التجريبي. يمكنك المحاولة مجدداً لاحقاً.'
            : 'تعذّر فتح بوابة الدفع. يمكنك إكمال الدفع لاحقاً.',
          [{ text: 'متابعة', onPress: () => goSuccess(orderId, orderNumber, 'unpaid') }],
        );
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'تعذر الاتصال بالخادم. يرجى التحقق من الشبكة.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loading || submitted) {
    return (
      <SafeAreaView style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.electricBright} />
          <Text style={styles.centeredText}>
            {submitted ? 'جاري التحويل...' : 'جاري تحميل الطلب...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!butcher || loadError) {
    return (
      <SafeAreaView style={styles.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <View style={styles.centered}>
          <AppIcon name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={styles.centeredText}>{loadError ?? 'الملحمة غير موجودة'}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>رجوع</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>طلب جديد</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {butcher.nameAr}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 130 }]}
      >
        <View style={styles.butcherHero}>
          <Image
            source={{ uri: resolveMediaUrl(butcher.logo) }}
            style={styles.butcherLogo}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.butcherName}>{butcher.nameAr}</Text>
            <Text style={styles.butcherMeta}>
              {butcher.cityAr} · {currency.symbol}
            </Text>
          </View>
          {butcher.subscriptionActive ? (
            <View style={styles.verifiedBadge}>
              <AppIcon name="shield-checkmark" size={13} color={colors.gold} />
              <Text style={styles.verifiedText}>موثّق</Text>
            </View>
          ) : null}
        </View>

        <Section title="اختر المنتج" styles={styles}>
          {products.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🥩</Text>
              <Text style={styles.emptyTitle}>لا منتجات متاحة</Text>
              <Text style={styles.emptySub}>تواصل مع الملحمة أو عد لاحقاً</Text>
            </View>
          ) : (
            products.map((p) => {
              const active = selectedProductId === p.id;
              const cat = CATEGORY_LABELS[p.category as MeatCategory];
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setSelectedProductId(p.id);
                    setSelectedCut(p.availableCuts[0] ?? 'whole');
                    if (p.weightRange?.min) setWeight(String(p.weightRange.min));
                  }}
                  style={[styles.productCard, active && styles.productCardActive]}
                >
                  <Image
                    source={{ uri: resolveMediaUrl(p.images[0]) ?? PLACEHOLDER_IMG }}
                    style={styles.productImg}
                    contentFit="cover"
                  />
                  <View style={styles.productBody}>
                    <View style={styles.productTopRow}>
                      <Text style={styles.productName} numberOfLines={1}>
                        {p.nameAr}
                      </Text>
                      {active ? (
                        <View style={styles.selectedDot}>
                          <AppIcon name="checkmark" size={12} color="#fff" />
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.productCat}>
                      {cat?.icon} {cat?.ar ?? p.category}
                    </Text>
                    <Text style={styles.productPrice}>
                      {p.pricePerKg
                        ? `${p.pricePerKg} ${currency.symbol}/كغ`
                        : `${(p.priceFixed ?? 0).toLocaleString('en-US')} ${currency.symbol}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </Section>

        {availableCuts.length > 0 ? (
          <Section title="طريقة التقطيع" styles={styles}>
            <View style={styles.chipsWrap}>
              {availableCuts.map((cut) => {
                const active = selectedCut === cut;
                return (
                  <Pressable
                    key={cut}
                    onPress={() => setSelectedCut(cut as CutType)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {cutLabelAr(cut)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>
        ) : null}

        {selectedProduct?.pricePerKg ? (
          <Section title="الوزن (كغ)" styles={styles}>
            <View style={styles.weightCard}>
              <Pressable
                style={styles.weightBtn}
                onPress={() =>
                  setWeight(String(Math.max(0.5, weightKg - 0.5)))
                }
              >
                <AppIcon name="remove" size={20} color={colors.textPrimary} />
              </Pressable>
              <TextInput
                style={styles.weightInput}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Pressable
                style={styles.weightBtn}
                onPress={() => setWeight(String(weightKg + 0.5))}
              >
                <AppIcon name="add" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            {selectedProduct.weightRange ? (
              <Text style={styles.hint}>
                من {selectedProduct.weightRange.min} إلى {selectedProduct.weightRange.max} كغ
              </Text>
            ) : null}
          </Section>
        ) : null}

        <Section title="طريقة الاستلام" styles={styles}>
          <View style={styles.deliveryRow}>
            {(['pickup', 'delivery'] as DeliveryType[]).map((type) => {
              const active = deliveryType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setDeliveryType(type)}
                  style={[styles.deliveryCard, active && styles.deliveryCardActive]}
                >
                  <AppIcon
                    name={type === 'pickup' ? 'shop' : 'box'}
                    size={22}
                    color={active ? colors.electricBright : colors.textMuted}
                  />
                  <Text style={[styles.deliveryLabel, active && styles.deliveryLabelActive]}>
                    {type === 'pickup' ? 'استلام' : 'توصيل'}
                  </Text>
                  <Text style={styles.deliverySub}>
                    {type === 'pickup' ? 'من الملحمة مباشرة' : 'إلى عنوانك'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {deliveryType === 'delivery' ? (
            <TextInput
              style={styles.textArea}
              placeholder="عنوان التوصيل..."
              placeholderTextColor={colors.textSubtle}
              value={address}
              onChangeText={setAddress}
              multiline
              textAlign="right"
            />
          ) : null}
        </Section>

        <Section title="ملاحظات (اختياري)" styles={styles}>
          <TextInput
            style={styles.textArea}
            placeholder="مثال: افصل الكبد والرقبة..."
            placeholderTextColor={colors.textSubtle}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlign="right"
          />
        </Section>

        <Section title="طريقة الدفع" styles={styles}>
          <View style={styles.payRow}>
            {PAYMENT_METHODS.map((method) => {
              const active = selectedMethod === method.id;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => setSelectedMethod(method.id)}
                  style={[styles.payPill, active && styles.payPillActive]}
                >
                  <Text style={[styles.payPillText, active && styles.payPillTextActive]}>
                    {method.arabic}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>ملخص الطلب</Text>
          <SummaryRow label="المنتج" value={selectedProduct?.nameAr ?? '—'} styles={styles} />
          <SummaryRow label="التقطيع" value={cutLabelAr(selectedCut)} styles={styles} />
          {selectedProduct?.pricePerKg ? (
            <SummaryRow label="الوزن" value={`${weightKg} كغ`} styles={styles} />
          ) : null}
          <SummaryRow
            label="الاستلام"
            value={deliveryType === 'pickup' ? 'استلام من الملحمة' : 'توصيل'}
            styles={styles}
          />
          <View style={styles.summaryDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>المبلغ</Text>
            <Text style={styles.totalValue}>
              {computedTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
              {currency.symbol}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <LinearGradient
          colors={['transparent', colors.bgDeep]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.footerInner}>
          <View>
            <Text style={styles.footerLabel}>الإجمالي</Text>
            <Text style={styles.footerTotal}>
              {computedTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
              {currency.symbol}
            </Text>
          </View>
          <Pressable
            style={[styles.submitBtn, (loadingSubmit || products.length === 0) && { opacity: 0.5 }]}
            onPress={() => void handleSubmit()}
            disabled={loadingSubmit || products.length === 0}
          >
            <LinearGradient
              colors={[colors.electric, colors.cyan]}
              style={styles.submitGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loadingSubmit ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <AppIcon name="card-outline" size={18} color="#fff" />
                  <Text style={styles.submitText}>ادفع وأرسل الطلب</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgDeep },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    centeredText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
    },
    secondaryBtn: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    secondaryBtnText: { ...typography.bodyStrong, color: colors.textBrandStrong },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bgGlass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 17 },
    headerSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

    scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

    butcherHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    butcherLogo: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.bgElevated,
    },
    butcherName: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 16 },
    butcherMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.gold + '18',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.gold + '44',
    },
    verifiedText: { ...typography.micro, color: colors.gold, fontWeight: '700' },

    section: { marginBottom: spacing.lg },
    sectionTitle: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: 'right',
      fontSize: 15,
    },
    hint: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },

    emptyBox: {
      alignItems: 'center',
      padding: spacing.xl,
      borderRadius: radius.xxl,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      gap: spacing.xs,
    },
    emptyEmoji: { fontSize: 32 },
    emptyTitle: { ...typography.bodyStrong, color: colors.textPrimary },
    emptySub: { ...typography.caption, color: colors.textMuted },

    productCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
    },
    productCardActive: {
      borderColor: colors.electric,
      backgroundColor: colors.electric + '0D',
    },
    productImg: {
      width: 72,
      height: 72,
      borderRadius: radius.lg,
      backgroundColor: colors.bgElevated,
    },
    productBody: { flex: 1, gap: 2 },
    productTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    productName: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      flex: 1,
      textAlign: 'right',
    },
    productCat: { ...typography.micro, color: colors.textMuted, textAlign: 'right' },
    productPrice: {
      ...typography.caption,
      color: colors.gold,
      fontWeight: '800',
      textAlign: 'right',
      marginTop: 2,
    },
    selectedDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
    },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.bgSurface,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
    },
    chipActive: {
      backgroundColor: colors.electric,
      borderColor: colors.electric,
    },
    chipText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
    chipTextActive: { color: '#fff' },

    weightCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    weightBtn: {
      width: 52,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
    },
    weightInput: {
      flex: 1,
      ...typography.h2,
      textAlign: 'center',
      color: colors.textPrimary,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    },

    deliveryRow: { flexDirection: 'row', gap: spacing.sm },
    deliveryCard: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
    },
    deliveryCardActive: {
      borderColor: colors.electric,
      backgroundColor: colors.electric + '10',
    },
    deliveryLabel: { ...typography.bodyStrong, color: colors.textMuted, fontSize: 14 },
    deliveryLabelActive: { color: colors.textBrandStrong },
    deliverySub: { ...typography.micro, color: colors.textSubtle, textAlign: 'center' },

    textArea: {
      marginTop: spacing.sm,
      minHeight: 88,
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      padding: spacing.md,
      color: colors.textPrimary,
      ...typography.body,
      textAlignVertical: 'top',
    },

    payRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    payPill: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.bgSurface,
      borderWidth: 1.5,
      borderColor: colors.borderSoft,
    },
    payPillActive: {
      borderColor: colors.electric,
      backgroundColor: colors.electric + '14',
    },
    payPillText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
    payPillTextActive: { color: colors.textBrandStrong },

    summaryCard: {
      borderRadius: radius.xxl,
      padding: spacing.lg,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.electric + '33',
      marginBottom: spacing.md,
    },
    summaryTitle: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      textAlign: 'right',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: 6,
    },
    summaryLabel: { ...typography.caption, color: colors.textMuted },
    summaryValue: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
      flex: 1,
      textAlign: 'left',
    },
    summaryDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderSoft,
      marginVertical: spacing.sm,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: { ...typography.bodyStrong, color: colors.textPrimary },
    totalValue: { ...typography.h3, color: colors.gold },

    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    footerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      backgroundColor: colors.bgDeep + 'EE',
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      padding: spacing.md,
    },
    footerLabel: { ...typography.micro, color: colors.textMuted },
    footerTotal: { ...typography.h3, color: colors.gold, fontSize: 20 },
    submitBtn: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', maxWidth: 220 },
    submitGrad: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: radius.xl,
    },
    submitText: { ...typography.bodyStrong, color: '#fff' },
  });
}
