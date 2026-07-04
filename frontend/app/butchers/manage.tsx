// Powered by OnSpace.AI
// SAFAT — Butcher Manage Screen (إدارة الملحمة)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
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
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import {
  CATEGORY_LABELS,
  CUT_LABELS,
  CutType,
  MeatCategory,
  Country,
} from '@/services/butcherData';
import { ButcherLocationPicker } from '@/components/feature/ButcherLocationPicker';
import { hasValidCoords, formatCoords } from '@/lib/butcherLocation';
import { storyTimeLeftLabel } from '@/constants/stories';
import { useRequireApprovedButcher } from '@/hooks/useRequireApprovedButcher';

type ManageTab = 'products' | 'offers' | 'stories' | 'orders';

// ─── Order status badge ───────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:   colors.amber,
  confirmed: colors.electricBright,
  preparing: colors.cyan,
  ready:     colors.success,
  delivered: colors.success,
  cancelled: colors.danger,
};
const STATUS_LABELS: Record<string, string> = {
  pending:   'قيد الانتظار',
  confirmed: 'مؤكد',
  preparing: 'جارٍ التحضير',
  ready:     'جاهز',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
};



// ─── Add / Edit Product Form ───────────────────────────────────────────────────
function AddProductForm({
  onClose,
  onSuccess,
  butcherCountry,
  product,
}: {
  onClose: () => void;
  onSuccess: () => void;
  butcherCountry: string;
  product?: any;
}) {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nameAr: product?.nameAr ?? '',
    category: (product?.category ?? 'lamb') as MeatCategory,
    pricePerKg: product?.pricePerKg?.toString() ?? '',
    priceFixed: product?.priceFixed?.toString() ?? '',
    freshness: product?.freshness ?? 'fresh',
    inStock: product?.inStock ?? true,
  });

  const ALL_CATEGORIES = Object.entries(CATEGORY_LABELS) as [MeatCategory, any][];
  const ALL_CUTS: CutType[] = ['whole','half','quarter','ribs','leg','shoulder','liver','mixed','custom'];
  const [selectedCuts, setSelectedCuts] = useState<CutType[]>(
    (product?.availableCuts?.length ? product.availableCuts : ['whole']) as CutType[]
  );

  const toggleCut = (cut: CutType) => {
    setSelectedCuts((prev) =>
      prev.includes(cut) ? prev.filter((c) => c !== cut) : [...prev, cut]
    );
  };

  const handleSave = async () => {
    if (!form.nameAr.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المنتج');
      return;
    }
    if (!form.pricePerKg && !form.priceFixed) {
      Alert.alert('خطأ', 'يرجى تحديد السعر');
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        nameAr: form.nameAr,
        nameEn: form.nameAr,
        category: form.category,
        pricePerKg: form.pricePerKg ? parseFloat(form.pricePerKg) : null,
        priceFixed: form.priceFixed ? parseFloat(form.priceFixed) : null,
        availableCuts: selectedCuts,
        freshness: form.freshness,
        descriptionAr: form.nameAr,
        descriptionEn: form.nameAr,
        inStock: form.inStock,
      };

      if (product) {
        if (product.images?.length) payload.images = product.images;
      } else {
        payload.images = [];
        payload.country = butcherCountry || 'SA';
      }

      const url = product
        ? `${API_BASE}/api/butchers/products/${product.id}`
        : `${API_BASE}/api/butchers/products`;
      const res = await fetch(url, {
        method: product ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        Alert.alert('نجاح', product ? 'تم تحديث المنتج' : 'تمت إضافة المنتج بنجاح');
        onSuccess();
        onClose();
      } else {
        Alert.alert('خطأ', data.messageAr || data.message || (product ? 'فشل تحديث المنتج' : 'فشل إضافة المنتج'));
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={apf.wrap}>
      <View style={apf.handle} />
      <Text style={apf.title}>{product ? 'تعديل المنتج' : 'إضافة منتج جديد'}</Text>

      <Text style={apf.label}>اسم المنتج بالعربي</Text>
      <TextInput
        style={apf.input}
        placeholder="مثال: خروف كامل طازج"
        placeholderTextColor={colors.textSubtle}
        value={form.nameAr}
        onChangeText={(v) => setForm({ ...form, nameAr: v })}
        textAlign="right"
      />

      <Text style={apf.label}>الفئة</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {ALL_CATEGORIES.map(([cat, info]) => (
            <Pressable
              key={cat}
              onPress={() => setForm({ ...form, category: cat })}
              style={[apf.catChip, form.category === cat && apf.catChipActive]}
            >
              <Text style={apf.catIcon}>{info.icon}</Text>
              <Text style={[apf.catLabel, form.category === cat && apf.catLabelActive]}>{info.ar}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={apf.label}>التسعير</Text>
      <View style={apf.priceRow}>
        <View style={{ flex: 1 }}>
          <Text style={apf.priceLabel}>سعر/كغ</Text>
          <TextInput
            style={apf.input}
            placeholder="0"
            placeholderTextColor={colors.textSubtle}
            value={form.pricePerKg}
            onChangeText={(v) => setForm({ ...form, pricePerKg: v })}
            keyboardType="numeric"
            textAlign="center"
          />
        </View>
        <Text style={{ color: colors.textMuted, marginTop: 24 }}>أو</Text>
        <View style={{ flex: 1 }}>
          <Text style={apf.priceLabel}>سعر ثابت</Text>
          <TextInput
            style={apf.input}
            placeholder="0"
            placeholderTextColor={colors.textSubtle}
            value={form.priceFixed}
            onChangeText={(v) => setForm({ ...form, priceFixed: v })}
            keyboardType="numeric"
            textAlign="center"
          />
        </View>
      </View>

      <Text style={apf.label}>طرق التقطيع المتاحة</Text>
      <View style={apf.cutsGrid}>
        {ALL_CUTS.map((cut) => (
          <Pressable
            key={cut}
            onPress={() => toggleCut(cut)}
            style={[apf.cutChip, selectedCuts.includes(cut) && apf.cutChipActive]}
          >
            <Text style={[apf.cutLabel, selectedCuts.includes(cut) && apf.cutLabelActive]}>
              {CUT_LABELS[cut].ar}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={apf.label}>الطزاجة</Text>
      <View style={apf.freshnessRow}>
        {[
          { id: 'fresh',   label: '🟢 طازج'  },
          { id: 'chilled', label: '🔵 مبرد'  },
          { id: 'frozen',  label: '❄️ مجمد'  },
        ].map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => setForm({ ...form, freshness: opt.id })}
            style={[apf.freshnessBtn, form.freshness === opt.id && apf.freshnessBtnActive]}
          >
            <Text style={apf.freshnessLabel}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={apf.label}>التوفر</Text>
      <View style={apf.freshnessRow}>
        {[
          { id: true,  label: '✅ متوفر' },
          { id: false, label: '❌ غير متوفر' },
        ].map((opt) => (
          <Pressable
            key={String(opt.id)}
            onPress={() => setForm({ ...form, inStock: opt.id })}
            style={[apf.freshnessBtn, form.inStock === opt.id && apf.freshnessBtnActive]}
          >
            <Text style={apf.freshnessLabel}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Upload images */}
      <Pressable style={apf.uploadBox}>
        <Ionicons name="camera-outline" size={28} color={colors.electricBright} />
        <Text style={apf.uploadText}>إضافة صور المنتج</Text>
      </Pressable>

      <View style={apf.actions}>
        <Pressable style={apf.cancelBtn} onPress={onClose} disabled={loading}>
          <Text style={apf.cancelText}>إلغاء</Text>
        </Pressable>
        <Pressable style={apf.saveBtn} onPress={handleSave} disabled={loading}>
          <LinearGradient colors={[colors.electric, colors.cyan]} style={apf.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={apf.saveBtnText}>{product ? 'تحديث المنتج' : 'حفظ المنتج'}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Add / Edit Offer Form ───────────────────────────────────────────────────
function AddOfferForm({
  onClose,
  onSuccess,
  butcherCountry,
  offer,
}: {
  onClose: () => void;
  onSuccess: () => void;
  butcherCountry: string;
  offer?: any;
}) {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    titleAr: offer?.titleAr ?? '',
    descriptionAr: offer?.descriptionAr ?? '',
    originalPrice: offer?.originalPrice?.toString() ?? '',
    offerPrice: offer?.offerPrice?.toString() ?? '',
    discountPercent: offer?.discountPercent?.toString() ?? '',
    image: offer?.image ?? '',
    validUntil: offer?.validUntil
      ? new Date(offer.validUntil).toISOString().slice(0, 10)
      : '',
  });

  const handleSave = async () => {
    if (!form.titleAr.trim() || !form.descriptionAr.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال عنوان ووصف العرض');
      return;
    }
    if (!form.image.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال رابط صورة العرض');
      return;
    }
    if (!form.validUntil.trim()) {
      Alert.alert('خطأ', 'يرجى تحديد تاريخ انتهاء العرض');
      return;
    }

    const originalPrice = form.originalPrice ? parseFloat(form.originalPrice) : null;
    const offerPrice = form.offerPrice ? parseFloat(form.offerPrice) : null;
    let discountPercent = form.discountPercent ? parseInt(form.discountPercent, 10) : null;
    if (!discountPercent && originalPrice && offerPrice && originalPrice > 0) {
      discountPercent = Math.round((1 - offerPrice / originalPrice) * 100);
    }

    const validUntil = new Date(`${form.validUntil}T23:59:59.000Z`).toISOString();

    const payload = {
      titleAr: form.titleAr,
      titleEn: form.titleAr,
      descriptionAr: form.descriptionAr,
      descriptionEn: form.descriptionAr,
      originalPrice,
      offerPrice,
      discountPercent,
      image: form.image.trim(),
      validUntil,
      country: butcherCountry || 'SA',
    };

    setLoading(true);
    try {
      const url = offer
        ? `${API_BASE}/api/butchers/offers/${offer.id}`
        : `${API_BASE}/api/butchers/offers`;
      const res = await fetch(url, {
        method: offer ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        Alert.alert('نجاح', offer ? 'تم تحديث العرض' : 'تمت إضافة العرض');
        onSuccess();
        onClose();
      } else {
        Alert.alert('خطأ', data.messageAr || data.message || 'فشل حفظ العرض');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={apf.wrap}>
      <View style={apf.handle} />
      <Text style={apf.title}>{offer ? 'تعديل العرض' : 'إضافة عرض جديد'}</Text>

      <Text style={apf.label}>عنوان العرض</Text>
      <TextInput
        style={apf.input}
        placeholder="مثال: عرض نهاية الأسبوع"
        placeholderTextColor={colors.textSubtle}
        value={form.titleAr}
        onChangeText={(v) => setForm({ ...form, titleAr: v })}
        textAlign="right"
      />

      <Text style={apf.label}>الوصف</Text>
      <TextInput
        style={[apf.input, { minHeight: 72 }]}
        placeholder="وصف مختصر للعرض"
        placeholderTextColor={colors.textSubtle}
        value={form.descriptionAr}
        onChangeText={(v) => setForm({ ...form, descriptionAr: v })}
        textAlign="right"
        multiline
      />

      <View style={apf.priceRow}>
        <View style={{ flex: 1 }}>
          <Text style={apf.priceLabel}>السعر الأصلي</Text>
          <TextInput
            style={apf.input}
            placeholder="0"
            placeholderTextColor={colors.textSubtle}
            value={form.originalPrice}
            onChangeText={(v) => setForm({ ...form, originalPrice: v })}
            keyboardType="numeric"
            textAlign="center"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={apf.priceLabel}>سعر العرض</Text>
          <TextInput
            style={apf.input}
            placeholder="0"
            placeholderTextColor={colors.textSubtle}
            value={form.offerPrice}
            onChangeText={(v) => setForm({ ...form, offerPrice: v })}
            keyboardType="numeric"
            textAlign="center"
          />
        </View>
      </View>

      <Text style={apf.label}>نسبة الخصم % (اختياري)</Text>
      <TextInput
        style={apf.input}
        placeholder="20"
        placeholderTextColor={colors.textSubtle}
        value={form.discountPercent}
        onChangeText={(v) => setForm({ ...form, discountPercent: v })}
        keyboardType="numeric"
        textAlign="center"
      />

      <Text style={apf.label}>رابط الصورة</Text>
      <TextInput
        style={apf.input}
        placeholder="https://..."
        placeholderTextColor={colors.textSubtle}
        value={form.image}
        onChangeText={(v) => setForm({ ...form, image: v })}
        textAlign="left"
        autoCapitalize="none"
      />

      <Text style={apf.label}>تاريخ الانتهاء (YYYY-MM-DD)</Text>
      <TextInput
        style={apf.input}
        placeholder="2026-12-31"
        placeholderTextColor={colors.textSubtle}
        value={form.validUntil}
        onChangeText={(v) => setForm({ ...form, validUntil: v })}
        textAlign="center"
      />

      <View style={apf.actions}>
        <Pressable style={apf.cancelBtn} onPress={onClose} disabled={loading}>
          <Text style={apf.cancelText}>إلغاء</Text>
        </Pressable>
        <Pressable style={apf.saveBtn} onPress={handleSave} disabled={loading}>
          <LinearGradient colors={[colors.gold, colors.amber]} style={apf.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={apf.saveBtnText}>{offer ? 'تحديث العرض' : 'حفظ العرض'}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ButcherManageScreen() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { hasApprovedApplication, loading: accessLoading } = useRequireApprovedButcher();
  const [activeTab, setActiveTab] = useState<ManageTab>('orders');
  const [showProductForm, setShowProductForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const [butcher, setButcher] = useState<any>(null);
  const [butcherStories, setButcherStories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadData = async () => {
    try {
      const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
      const [resButcher, resOrders, resStories] = await Promise.all([
        fetch(`${API_BASE}/api/butchers/me`, { headers }),
        fetch(`${API_BASE}/api/butchers/orders`, { headers }),
        fetch(`${API_BASE}/api/butchers/stories`, { headers }),
      ]);

      let butcherId: string | null = null;
      if (resButcher.ok) {
        const json = await resButcher.json();
        if (json.success && json.data) {
          butcherId = json.data.id;
          setButcher(json.data);
        }
      }
      if (resOrders.ok) {
        const json = await resOrders.json();
        if (json.success && json.data) {
          setOrders(json.data);
        }
      }
      if (resStories.ok && butcherId) {
        const json = await resStories.json();
        if (json.success && Array.isArray(json.data)) {
          setButcherStories(json.data.filter((s: any) => s.butcherId === butcherId));
        }
      }
    } catch (err) {
      console.warn('[ButcherManage] Load data failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [accessToken, refreshTrigger]);

  useEffect(() => {
    if (butcher && hasValidCoords(butcher.lat, butcher.lng)) {
      setLocationLat(butcher.lat);
      setLocationLng(butcher.lng);
    }
  }, [butcher?.id, butcher?.lat, butcher?.lng]);

  const saveLocation = async () => {
    if (!accessToken || !hasValidCoords(locationLat, locationLng)) {
      Alert.alert('الموقع مطلوب', 'حدّد موقع الملحمة على الخريطة');
      return;
    }
    setSavingLocation(true);
    try {
      const res = await fetch(`${API_BASE}/api/butchers/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ lat: locationLat, lng: locationLng }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setButcher((prev: any) => prev ? { ...prev, lat: locationLat, lng: locationLng } : prev);
        setShowLocationEditor(false);
        Alert.alert('تم الحفظ', 'تم تحديث موقع الملحمة على الخريطة');
      } else {
        Alert.alert('خطأ', json.messageAr || json.message || 'فشل حفظ الموقع');
      }
    } catch {
      Alert.alert('خطأ', 'تعذّر الاتصال بالخادم');
    } finally {
      setSavingLocation(false);
    }
  };

  const advanceOrder = async (orderId: string, currentStatus: string) => {
    const flow = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    const idx = flow.indexOf(currentStatus);
    if (idx < 0 || idx >= flow.length - 1) return;
    const nextStatus = flow[idx + 1];

    try {
      const res = await fetch(`${API_BASE}/api/butchers/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
        );
      } else {
        Alert.alert('خطأ', json.messageAr || json.message || 'فشل تحديث حالة الطلب');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'تعذر الاتصال بالخادم');
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/butchers/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o))
        );
      } else {
        Alert.alert('خطأ', json.messageAr || json.message || 'فشل إلغاء الطلب');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'تعذر الاتصال بالخادم');
    }
  };

  const deleteOffer = (offerId: string) => {
    Alert.alert('حذف العرض', 'هل تريد حذف هذا العرض؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/api/butchers/offers/${offerId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok && json.success) {
              setRefreshTrigger((prev) => prev + 1);
            } else {
              Alert.alert('خطأ', json.messageAr || json.message || 'فشل حذف العرض');
            }
          } catch (err) {
            console.error(err);
            Alert.alert('خطأ', 'تعذر الاتصال بالخادم');
          }
        },
      },
    ]);
  };

  const deleteProduct = (productId: string) => {
    Alert.alert('حذف المنتج', 'هل تريد حذف هذا المنتج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/api/butchers/products/${productId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok && json.success) {
              setRefreshTrigger((prev) => prev + 1);
            } else {
              Alert.alert('خطأ', json.messageAr || json.message || 'فشل حذف المنتج');
            }
          } catch (err) {
            console.error(err);
            Alert.alert('خطأ', 'تعذر الاتصال بالخادم');
          }
        },
      },
    ]);
  };

  const openProductForm = (product?: any) => {
    setEditingProduct(product ?? null);
    setShowProductForm(true);
  };

  const closeProductForm = () => {
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const openOfferForm = (offer?: any) => {
    setEditingOffer(offer ?? null);
    setShowOfferForm(true);
  };

  const closeOfferForm = () => {
    setShowOfferForm(false);
    setEditingOffer(null);
  };

  const deleteStory = (storyId: string) => {
    Alert.alert('حذف القصة', 'هل تريد حذف هذه القصة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/api/butchers/stories/${storyId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok && json.success) {
              setButcherStories((prev) => prev.filter((s) => s.id !== storyId));
            } else {
              Alert.alert('خطأ', json.messageAr || json.message || 'فشل حذف القصة');
            }
          } catch (err) {
            console.error(err);
            Alert.alert('خطأ', 'تعذر الاتصال بالخادم');
          }
        },
      },
    ]);
  };

  if (accessLoading || !hasApprovedApplication) {
    return (
      <SafeAreaView style={s.screen}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.electricBright} />
        </View>
      </SafeAreaView>
    );
  }

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
      <SafeAreaView style={s.screen} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ fontSize: 60 }}>🥩</Text>
          <Text style={{ ...typography.h2, color: colors.textPrimary, textAlign: 'center' }}>سجّل ملحمتك في صفاة</Text>
          <Text style={{ ...typography.body, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 22 }}>
            ابدأ بعرض منتجاتك الحيوانية واللحوم الطازجة لآلاف المشترين في منطقة الخليج العربي.
          </Text>
          <Pressable
            style={{
              marginTop: spacing.md,
              paddingHorizontal: spacing.xxl,
              paddingVertical: spacing.md,
              borderRadius: radius.xl,
              backgroundColor: colors.electric,
            }}
            onPress={() => router.push('/butchers/apply')}
          >
            <Text style={{ ...typography.bodyStrong, color: '#fff' }}>سجل ملحمتك الآن</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const products = butcher.products || [];
  const offers = butcher.offers || [];

  const TABS: { id: ManageTab; label: string; icon: keyof typeof Ionicons.glyphMap; count?: number }[] = [
    { id: 'orders',   label: 'الطلبات',   icon: 'clipboard-outline', count: orders.filter((o) => o.status === 'pending').length },
    { id: 'products', label: 'المنتجات',  icon: 'cube-outline',      count: products.length },
    { id: 'offers',   label: 'العروض',    icon: 'pricetag-outline',  count: offers.length },
    { id: 'stories',  label: 'القصص',     icon: 'camera-outline' },
  ];

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.push('/sidebar')} hitSlop={12} style={s.backBtn}>
          <Ionicons name="menu" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>إدارة الملحمة</Text>
          <Text style={s.headerSub}>{butcher?.nameAr}</Text>
        </View>
        <Pressable onPress={() => router.push('/butchers/edit')} hitSlop={12} style={s.backBtn}>
          <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Verified status */}
      {butcher?.subscriptionActive && (
        <View style={s.verifiedStrip}>
          <LinearGradient colors={[colors.gold + '22', colors.amber + '11']} style={StyleSheet.absoluteFill} />
          <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
          <Text style={s.verifiedText}>حساب موثّق نشط</Text>
          <View style={s.onlineDot} />
          <Text style={s.onlineText}>
            {butcher.isOpen ? 'مفتوح الآن' : 'مغلق'}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabsGrid}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={({ pressed }) => [s.tabItem, pressed && { opacity: 0.85 }]}
            >
              <View style={[s.tabIconCircle, isActive && s.tabIconCircleActive]}>
                <Ionicons
                  name={tab.icon}
                  size={20}
                  color={isActive ? '#fff' : colors.textMuted}
                />
                {!!tab.count && tab.count > 0 && (
                  <View style={[s.tabCountBadge, isActive && s.tabCountBadgeActive]}>
                    <Text style={[s.tabCountText, isActive && s.tabCountTextActive]}>
                      {tab.count > 99 ? '99+' : tab.count}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[s.tabLabel, isActive && s.tabLabelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Location */}
        <View style={s.locationCard}>
          <View style={s.locationHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionTitle}>📍 موقع الملحمة</Text>
              <Text style={s.locationSub}>
                {hasValidCoords(butcher?.lat, butcher?.lng)
                  ? formatCoords(butcher.lat, butcher.lng)
                  : 'لم يتم تحديد الموقع بعد — أضف موقعك ليظهر على الخريطة'}
              </Text>
            </View>
            <Pressable
              style={s.locationEditBtn}
              onPress={() => setShowLocationEditor((v) => !v)}
            >
              <Ionicons
                name={showLocationEditor ? 'chevron-up' : 'pencil-outline'}
                size={18}
                color={colors.electricBright}
              />
            </Pressable>
          </View>

          {showLocationEditor && (
            <View style={s.locationEditor}>
              <ButcherLocationPicker
                country={(butcher?.country as Country) ?? 'SA'}
                lat={locationLat}
                lng={locationLng}
                onChange={({ lat, lng }) => {
                  setLocationLat(lat);
                  setLocationLng(lng);
                }}
                height={240}
              />
              <Pressable
                style={[s.locationSaveBtn, savingLocation && { opacity: 0.7 }]}
                onPress={saveLocation}
                disabled={savingLocation}
              >
                {savingLocation ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.locationSaveText}>حفظ الموقع</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Orders Tab ── */}
        {activeTab === 'orders' && (
          <View>
            <Text style={s.sectionTitle}>
              الطلبات الواردة ({orders.length})
            </Text>
            {orders.map((order) => {
              const status = order.status;
              const statusColor = STATUS_COLORS[status] ?? colors.textMuted;
              const customerName = order.customer?.arabicName || order.customer?.displayName || 'عميل صفاة';
              const productName = order.product?.nameAr || 'منتج لحم';
              const formattedDate = new Date(order.createdAt).toLocaleDateString('ar-SA');
              return (
                <View key={order.id} style={ord.card}>
                  <View style={ord.header}>
                    <View style={ord.customerWrap}>
                      <View style={[ord.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={ord.customerName}>{customerName}</Text>
                    </View>
                    <View style={[ord.statusBadge, { backgroundColor: statusColor + '33', borderColor: statusColor + '66' }]}>
                      <Text style={[ord.statusText, { color: statusColor }]}>
                        {STATUS_LABELS[status] || status}
                      </Text>
                    </View>
                  </View>

                  <View style={ord.detailRow}>
                    <View style={ord.detail}>
                      <Text style={ord.detailLabel}>المنتج</Text>
                      <Text style={ord.detailValue}>{productName}</Text>
                    </View>
                    <View style={ord.detail}>
                      <Text style={ord.detailLabel}>التقطيع</Text>
                      <Text style={ord.detailValue}>{CUT_LABELS[order.cutType as CutType]?.ar ?? order.cutType}</Text>
                    </View>
                    <View style={ord.detail}>
                      <Text style={ord.detailLabel}>الوزن</Text>
                      <Text style={ord.detailValue}>{order.weightKg} كغ</Text>
                    </View>
                  </View>

                  <View style={ord.footer}>
                    <View style={ord.footerLeft}>
                      <MaterialCommunityIcons
                        name={order.deliveryType === 'delivery' ? 'truck-delivery-outline' : 'store-outline'}
                        size={14}
                        color={colors.textMuted}
                      />
                      <Text style={ord.footerText}>
                        {order.deliveryType === 'delivery' ? 'توصيل' : 'استلام'} · {formattedDate}
                      </Text>
                    </View>
                    <Text style={ord.total}>{order.totalPrice.toLocaleString()} {order.currency || 'ر.س'}</Text>
                  </View>

                  {/* Action buttons */}
                  <View style={ord.actions}>
                    <Pressable
                      style={ord.chatBtn}
                      onPress={() => router.push('/butchers/chat')}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color={colors.electricBright} />
                      <Text style={ord.chatBtnText}>محادثة</Text>
                    </Pressable>

                    {status !== 'delivered' && status !== 'cancelled' && (
                      <Pressable
                        style={ord.advanceBtn}
                        onPress={() => advanceOrder(order.id, status)}
                      >
                        <LinearGradient
                          colors={[statusColor, statusColor + 'BB']}
                          style={ord.advanceBtnGrad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={ord.advanceBtnText}>
                            {status === 'pending'   ? 'قبول الطلب' :
                             status === 'confirmed' ? 'بدء التحضير' :
                             status === 'preparing' ? 'جاهز للاستلام' :
                             'تأكيد التسليم'}
                          </Text>
                          <Ionicons name="arrow-forward" size={14} color="#fff" />
                        </LinearGradient>
                      </Pressable>
                    )}

                    {status === 'pending' && (
                      <Pressable
                        style={ord.rejectBtn}
                        onPress={() => cancelOrder(order.id)}
                      >
                        <Ionicons name="close" size={16} color={colors.danger} />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
            {orders.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📋</Text>
                <Text style={s.emptyTitle}>لا توجد طلبات بعد</Text>
                <Text style={s.emptySub}>ستظهر هنا الطلبات الواردة من العملاء</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Products Tab ── */}
        {activeTab === 'products' && (
          <View>
            <View style={s.tabHeader}>
              <Text style={s.sectionTitle}>منتجاتي ({products.length})</Text>
              <Pressable style={s.addBtn} onPress={() => openProductForm()}>
                <Ionicons name="add" size={16} color={colors.electricBright} />
                <Text style={s.addBtnText}>إضافة منتج</Text>
              </Pressable>
            </View>

            {showProductForm && (
              <View style={s.formCard}>
                <AddProductForm
                  product={editingProduct ?? undefined}
                  onClose={closeProductForm}
                  onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
                  butcherCountry={butcher?.country || 'SA'}
                />
              </View>
            )}

            {products.map((p: any) => (
              <View key={p.id} style={pm.card}>
                {p.images?.[0] ? (
                  <Image source={{ uri: p.images[0] }} style={pm.img} contentFit="cover" />
                ) : (
                  <View style={[pm.img, { backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 28 }}>🥩</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={pm.name}>{p.nameAr}</Text>
                  <Text style={pm.cat}>{CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS]?.icon || '🥩'} {CATEGORY_LABELS[p.category as keyof typeof CATEGORY_LABELS]?.ar || p.category}</Text>
                  <View style={pm.priceRow}>
                    {p.pricePerKg
                      ? <Text style={pm.price}>{p.pricePerKg} ر.س/كغ</Text>
                      : <Text style={pm.price}>{p.priceFixed?.toLocaleString()} ر.س</Text>
                    }
                    <View style={[pm.stockBadge, { backgroundColor: p.inStock ? colors.success + '33' : colors.danger + '33' }]}>
                      <Text style={[pm.stockText, { color: p.inStock ? colors.textBrandSuccess : colors.danger }]}>
                        {p.inStock ? 'متوفر' : 'نفد'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={pm.actions}>
                  <Pressable style={pm.editBtn} onPress={() => openProductForm(p)}>
                    <Ionicons name="pencil-outline" size={16} color={colors.electricBright} />
                  </Pressable>
                  <Pressable style={pm.deleteBtn} onPress={() => deleteProduct(p.id)}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
            {products.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🥩</Text>
                <Text style={s.emptyTitle}>لا توجد منتجات بعد</Text>
                <Text style={s.emptySub}>أضف منتجاتك لتبدأ في البيع</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Offers Tab ── */}
        {activeTab === 'offers' && (
          <View>
            <View style={s.tabHeader}>
              <Text style={s.sectionTitle}>عروضي ({offers.length})</Text>
              <Pressable style={s.addBtn} onPress={() => openOfferForm()}>
                <Ionicons name="add" size={16} color={colors.electricBright} />
                <Text style={s.addBtnText}>إضافة عرض</Text>
              </Pressable>
            </View>

            {showOfferForm && (
              <View style={s.formCard}>
                <AddOfferForm
                  offer={editingOffer}
                  onClose={closeOfferForm}
                  onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
                  butcherCountry={butcher?.country || 'SA'}
                />
              </View>
            )}

            {offers.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🏷️</Text>
                <Text style={s.emptyTitle}>لا توجد عروض بعد</Text>
                <Text style={s.emptySub}>أضف عروضاً لجذب المزيد من العملاء</Text>
              </View>
            ) : (
              offers.map((offer: any) => (
                <View key={offer.id} style={of.card}>
                  <Image source={{ uri: offer.image }} style={of.img} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={of.title}>{offer.titleAr}</Text>
                    <Text style={of.desc} numberOfLines={1}>{offer.descriptionAr}</Text>
                    <View style={of.priceRow}>
                      <Text style={of.price}>{offer.offerPrice?.toLocaleString()} ر.س</Text>
                      <Text style={of.original}>{offer.originalPrice?.toLocaleString()}</Text>
                      <View style={of.discBadge}>
                        <Text style={of.discText}>-{offer.discountPercent}%</Text>
                      </View>
                    </View>
                  </View>
                  <View style={pm.actions}>
                    <Pressable style={pm.editBtn} onPress={() => openOfferForm(offer)}>
                      <Ionicons name="pencil-outline" size={16} color={colors.electricBright} />
                    </Pressable>
                    <Pressable style={pm.deleteBtn} onPress={() => deleteOffer(offer.id)}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── Stories Tab ── */}
        {activeTab === 'stories' && (
          <View>
            <View style={s.tabHeader}>
              <Text style={s.sectionTitle}>قصصي</Text>
              <Pressable
                style={s.addBtn}
                onPress={() => router.push({ pathname: '/create/story', params: { mode: 'butcher' } })}
              >
                <Ionicons name="add" size={16} color={colors.electricBright} />
                <Text style={s.addBtnText}>نشر قصة</Text>
              </Pressable>
            </View>

            {butcherStories.length > 0 && (
              <View style={sto.activeList}>
                <Text style={sto.activeListTitle}>القصص النشطة (٢٤ ساعة)</Text>
                {butcherStories.map((story: any) => (
                  <View key={story.id} style={sto.activeCard}>
                    <Image source={{ uri: story.thumbnail }} style={sto.activeThumb} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={sto.activeCaption} numberOfLines={1}>
                        {story.captionAr || story.caption || 'قصة بدون وصف'}
                      </Text>
                      <Text style={sto.activeMeta}>{storyTimeLeftLabel(story.expiresAt)}</Text>
                    </View>
                    <Pressable style={pm.deleteBtn} onPress={() => deleteStory(story.id)}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Story types */}
            {[
              { type: 'daily_slaughter', label: 'ذبح يومي',    icon: '🔪', color: colors.danger   },
              { type: 'new_stock',       label: 'مخزون جديد',  icon: '📦', color: colors.textBrandSuccess  },
              { type: 'offer',           label: 'عرض اليوم',   icon: '🏷️', color: colors.amber    },
              { type: 'update',          label: 'تحديث عام',   icon: '📢', color: colors.textBrandAlt },
            ].map((st) => (
              <Pressable
                key={st.type}
                style={sto.typeCard}
                onPress={() => router.push({
                  pathname: '/create/story',
                  params: { mode: 'butcher', type: st.type },
                })}
              >
                <LinearGradient colors={[st.color + '33', st.color + '11']} style={StyleSheet.absoluteFill} />
                <View style={[sto.typeIcon, { backgroundColor: st.color + '44' }]}>
                  <Text style={sto.typeIconText}>{st.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sto.typeLabel}>{st.label}</Text>
                  <Text style={sto.typeSub}>انشر الآن ويظهر فوراً في القصص</Text>
                </View>
                <View style={[sto.addBadge, { backgroundColor: st.color }]}>
                  <Ionicons name="add" size={18} color="#fff" />
                </View>
              </Pressable>
            ))}

            {!butcher?.subscriptionActive && (
              <View style={sto.lockCard}>
                <Ionicons name="lock-closed" size={24} color={colors.gold} />
                <View>
                  <Text style={sto.lockTitle}>ميزة القصص للحسابات الموثّقة</Text>
                  <Text style={sto.lockSub}>اشترك بـ ٢٩٩ ر.س/شهر لنشر قصصك</Text>
                </View>
                <Pressable
                  style={sto.lockBtn}
                  onPress={() => router.push('/butchers/apply')}
                >
                  <Text style={sto.lockBtnText}>توثيق الحساب</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textBrand, marginTop: 1 },
  verifiedStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.gold + '44',
    overflow: 'hidden', position: 'relative',
  },
  verifiedText: { ...typography.caption, color: colors.gold, flex: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  onlineText: { ...typography.micro, color: colors.textBrandSuccess },
  tabsGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  tabIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgSurface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIconCircleActive: {
    backgroundColor: colors.electric,
    borderColor: colors.electricBright,
  },
  tabCountBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountBadgeActive: {
    backgroundColor: '#fff',
    borderColor: colors.electric,
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 12,
  },
  tabCountTextActive: {
    color: colors.textBrandAlt,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.textBrandStrong,
    fontWeight: '700',
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  locationCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  locationSub: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  locationEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  locationEditor: { gap: spacing.md },
  locationSaveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.electric,
  },
  locationSaveText: { ...typography.bodyStrong, color: '#fff' },
  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.electricBright + '66',
    backgroundColor: colors.electric + '11',
  },
  addBtnText: { ...typography.micro, color: colors.textBrandStrong },
  formCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: spacing.sm },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { ...typography.h3, color: colors.textMuted },
  emptySub: { ...typography.caption, color: colors.textSubtle },
});

// Orders
const ord = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  customerName: { ...typography.bodyStrong, color: colors.textPrimary },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, borderWidth: 1,
  },
  statusText: { ...typography.micro, fontWeight: '700' },
  detailRow: { flexDirection: 'row', gap: spacing.md },
  detail: { flex: 1, gap: 2 },
  detailLabel: { ...typography.micro, color: colors.textMuted },
  detailValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { ...typography.micro, color: colors.textMuted },
  total: { ...typography.bodyStrong, color: colors.gold },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.electricBright + '66',
    backgroundColor: colors.electric + '11',
  },
  chatBtnText: { ...typography.micro, color: colors.textBrandStrong },
  advanceBtn: { flex: 1, borderRadius: radius.pill, overflow: 'hidden' },
  advanceBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9,
  },
  advanceBtnText: { ...typography.micro, color: '#fff', fontWeight: '700' },
  rejectBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.danger + '55',
    backgroundColor: colors.danger + '11',
  },
});

// Products manage
const pm = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  img: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.bgElevated },
  name: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  cat: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  price: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  stockText: { ...typography.micro, fontWeight: '700' },
  actions: { gap: 6 },
  editBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.electric + '22',
    borderWidth: 1, borderColor: colors.electric + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.danger + '22',
    borderWidth: 1, borderColor: colors.danger + '44',
    alignItems: 'center', justifyContent: 'center',
  },
});

// Offers manage
const of = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.gold + '33',
    padding: spacing.md, marginBottom: spacing.sm,
  },
  img: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.bgElevated },
  title: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  desc: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  price: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  original: { ...typography.micro, color: colors.textMuted, textDecorationLine: 'line-through' },
  discBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.danger },
  discText: { ...typography.micro, color: '#fff', fontWeight: '700' },
});

// Stories
const sto = StyleSheet.create({
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.lg, marginBottom: spacing.sm,
    overflow: 'hidden', position: 'relative',
  },
  typeIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  typeIconText: { fontSize: 18 },
  typeLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  typeSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  addBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  lockCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.gold + '11',
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.gold + '44',
    padding: spacing.lg, marginTop: spacing.lg,
  },
  lockTitle: { ...typography.bodyStrong, color: colors.gold },
  lockSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  lockBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: colors.gold,
  },
  lockBtnText: { ...typography.micro, color: '#1A1300', fontWeight: '700' },
  activeList: { gap: spacing.sm, marginBottom: spacing.lg },
  activeListTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: spacing.xs,
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.sm,
  },
  activeThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  activeCaption: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  activeMeta: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
});

// Add product form
const apf = StyleSheet.create({
  wrap: { gap: spacing.sm },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.borderMid,
    alignSelf: 'center', marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.md },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: 5, textAlign: 'right' },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    ...typography.body, color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, backgroundColor: colors.bgElevated,
    borderWidth: 1.5, borderColor: colors.borderSoft,
  },
  catChipActive: { borderColor: colors.electric, backgroundColor: colors.electric + '22' },
  catIcon: { fontSize: 14 },
  catLabel: { ...typography.caption, color: colors.textMuted },
  catLabelActive: { color: colors.textBrandStrong, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  priceLabel: { ...typography.micro, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  cutsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg },
  cutChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: colors.bgElevated,
    borderWidth: 1.5, borderColor: colors.borderSoft,
  },
  cutChipActive: { borderColor: colors.electric, backgroundColor: colors.electric + '22' },
  cutLabel: { ...typography.micro, color: colors.textMuted },
  cutLabelActive: { color: colors.textBrandStrong, fontWeight: '600' },
  freshnessRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  freshnessBtn: {
    flex: 1, paddingVertical: 10,
    borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.borderSoft,
    backgroundColor: colors.bgElevated, alignItems: 'center',
  },
  freshnessBtnActive: { borderColor: colors.electric, backgroundColor: colors.electric + '22' },
  freshnessLabel: { ...typography.caption, color: colors.textSecondary },
  uploadBox: {
    alignItems: 'center', gap: 8,
    paddingVertical: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.electricBright + '55',
    borderStyle: 'dashed',
    backgroundColor: colors.electric + '08',
    marginBottom: spacing.lg,
  },
  uploadText: { ...typography.caption, color: colors.textBrandStrong, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: 13,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  cancelText: { ...typography.bodyStrong, color: colors.textMuted },
  saveBtn: { flex: 2, borderRadius: radius.xl, overflow: 'hidden' },
  saveBtnGrad: {
    paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { ...typography.bodyStrong, color: '#fff' },
});
