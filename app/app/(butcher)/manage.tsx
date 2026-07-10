// Powered by OnSpace.AI
// SAFAT — Butcher Manage Screen (إدارة الملحمة)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { uploadImageFromUri } from '@/services/upload';
import {
  CATEGORY_LABELS,
  CUT_LABELS,
  CutType,
  MeatCategory,
  Country,
} from '@/services/butcherData';
import { ButcherLocationPicker } from '@/components/feature/ButcherLocationPicker';
import { LocationMapPreview } from '@/components/feature/LocationMapPreview';
import { hasValidCoords, formatCoords } from '@/lib/butcherLocation';
import { formatLocationLabel } from '@/lib/formatAddress';
import type { ResolvedAddress } from '@/lib/formatAddress';
import { storyTimeLeftLabel } from '@/constants/stories';
import { UserProfileLink } from '@/components/feature/UserProfileLink';
import { connectSocket } from '@/lib/socket';

type ManageTab = 'products' | 'offers' | 'stories' | 'orders';

const MANAGE_TABS: ManageTab[] = ['orders', 'products', 'offers', 'stories'];

const CANCEL_REASONS = [
  'المنتج غير متوفر',
  'الكمية غير كافية',
  'تعذر التواصل مع العميل',
  'طلب خارج نطاق الخدمة',
] as const;

function parseManageTab(value: string | undefined): ManageTab | null {
  return MANAGE_TABS.includes(value as ManageTab) ? (value as ManageTab) : null;
}

// ─── Order status badge ───────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending:   'قيد الانتظار',
  confirmed: 'مؤكد',
  preparing: 'جارٍ التحضير',
  ready:     'جاهز',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
};

function isLocalImageUri(uri: string) {
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://')
  );
}

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
  const { colors } = useTheme();
  const apf = useThemedStyles(({ colors }) => createProductFormStyles(colors));
  const [loading, setLoading] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>(
    Array.isArray(product?.images) ? product.images.filter(Boolean) : [],
  );
  const [form, setForm] = useState({
    nameAr: product?.nameAr ?? '',
    category: (product?.category ?? 'lamb') as MeatCategory,
    pricePerKg: product?.pricePerKg?.toString() ?? '',
    priceFixed: product?.priceFixed?.toString() ?? '',
    availableQuantity: product?.availableQuantity?.toString() ?? '',
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

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح بالوصول إلى الصور لإضافتها للمنتج');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - imageUris.length,
      quality: 0.85,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUris((prev) =>
        [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5),
      );
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
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
    if (!accessToken) {
      Alert.alert('خطأ', 'يرجى تسجيل الدخول أولاً');
      return;
    }

    setLoading(true);
    try {
      const uploadedImages: string[] = [];
      for (const uri of imageUris) {
        if (isLocalImageUri(uri)) {
          uploadedImages.push(await uploadImageFromUri(accessToken, uri, 'butchers'));
        } else {
          uploadedImages.push(uri);
        }
      }

      const payload: Record<string, unknown> = {
        nameAr: form.nameAr,
        nameEn: form.nameAr,
        category: form.category,
        pricePerKg: form.pricePerKg ? parseFloat(form.pricePerKg) : null,
        priceFixed: form.priceFixed ? parseFloat(form.priceFixed) : null,
        availableQuantity: form.availableQuantity.trim()
          ? parseFloat(form.availableQuantity)
          : undefined,
        availableCuts: selectedCuts,
        freshness: form.freshness,
        descriptionAr: form.nameAr,
        descriptionEn: form.nameAr,
        inStock: form.inStock,
        images: uploadedImages,
      };

      if (!product) {
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
      Alert.alert('خطأ', err instanceof Error ? err.message : 'تعذر الاتصال بالخادم');
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

      <Text style={apf.label}>الكمية المتاحة (كغ)</Text>
      <TextInput
        style={apf.input}
        placeholder="مثال: 50"
        placeholderTextColor={colors.textSubtle}
        value={form.availableQuantity}
        onChangeText={(v) => setForm({ ...form, availableQuantity: v })}
        keyboardType="numeric"
        textAlign="center"
      />

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

      <Text style={apf.label}>صور المنتج</Text>
      <View style={apf.imageGrid}>
        {imageUris.map((uri, idx) => (
          <View key={`${uri}-${idx}`} style={apf.imageThumbWrap}>
            <Image source={{ uri }} style={apf.imageThumb} contentFit="cover" />
            <Pressable style={apf.imageRemove} onPress={() => removeImage(idx)} hitSlop={6}>
              <AppIcon name="close-circle" size={22} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {imageUris.length < 5 && (
          <Pressable style={apf.uploadBox} onPress={pickImages} disabled={loading}>
            <AppIcon name="camera-outline" size={28} color={colors.electricBright} />
            <Text style={apf.uploadText}>إضافة صورة</Text>
          </Pressable>
        )}
      </View>
      <Text style={apf.uploadHint}>حتى 5 صور · JPG أو PNG</Text>

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
  const { colors } = useTheme();
  const apf = useThemedStyles(({ colors }) => createProductFormStyles(colors));
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
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createMainStyles(colors));
  const pm = useThemedStyles(({ colors }) => createProductManageStyles(colors));
  const ord = useThemedStyles(({ colors }) => createOrderStyles(colors));
  const of = useThemedStyles(({ colors }) => createOfferManageStyles(colors));
  const statusColors: Record<string, string> = {
    pending: colors.amber,
    confirmed: colors.electricBright,
    preparing: colors.cyan,
    ready: colors.success,
    delivered: colors.success,
    cancelled: colors.danger,
  };
  const { tab, action } = useLocalSearchParams<{ tab?: string; action?: string }>();
  const { accessToken } = useAuth();
  const initialTab = parseManageTab(tab) ?? 'orders';
  const [activeTab, setActiveTab] = useState<ManageTab>(initialTab);
  const [showProductForm, setShowProductForm] = useState(action === 'add' && initialTab === 'products');
  const [showOfferForm, setShowOfferForm] = useState(action === 'add' && initialTab === 'offers');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingOffer, setEditingOffer] = useState<any>(null);

  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationAddress, setLocationAddress] = useState<ResolvedAddress | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const [butcher, setButcher] = useState<any>(null);
  const [butcherStories, setButcherStories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState<string>(CANCEL_REASONS[0]);
  const [cancelReasonCustom, setCancelReasonCustom] = useState('');

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
    const nextTab = parseManageTab(tab);
    if (nextTab) setActiveTab(nextTab);
    if (action === 'add') {
      if (nextTab === 'products') setShowAddProduct(true);
      if (nextTab === 'offers') setShowOfferForm(true);
    }
  }, [tab, action]);

  useEffect(() => {
    if (butcher && hasValidCoords(butcher.lat, butcher.lng)) {
      setLocationLat(butcher.lat);
      setLocationLng(butcher.lng);
      setLocationAddress({
        cityAr: butcher.cityAr ?? '',
        addressAr: butcher.addressAr ?? butcher.address ?? '',
      });
    }
  }, [butcher?.id, butcher?.lat, butcher?.lng, butcher?.cityAr, butcher?.addressAr]);

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
        body: JSON.stringify({
          lat: locationLat,
          lng: locationLng,
          ...(locationAddress?.cityAr ? { cityAr: locationAddress.cityAr } : {}),
          ...(locationAddress?.addressAr ? { addressAr: locationAddress.addressAr } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setButcher((prev: any) => prev ? {
          ...prev,
          lat: locationLat,
          lng: locationLng,
          ...(locationAddress?.cityAr ? { cityAr: locationAddress.cityAr } : {}),
          ...(locationAddress?.addressAr ? { addressAr: locationAddress.addressAr } : {}),
        } : prev);
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

  const transitionOrder = async (
    orderId: string,
    nextStatus: string,
    cancellationReason?: string,
  ) => {

    try {
      const res = await fetch(`${API_BASE}/api/butchers/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          status: nextStatus,
          ...(cancellationReason ? { cancellationReason } : {}),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  ...json.data,
                  status: nextStatus,
                }
              : o,
          )
        );
      } else {
        Alert.alert('خطأ', json.messageAr || json.message || 'فشل تحديث حالة الطلب');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'تعذر الاتصال بالخادم');
    }
  };

  const cancelOrder = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReasonPreset(CANCEL_REASONS[0]);
    setCancelReasonCustom('');
  };

  const confirmCancelOrder = async () => {
    if (!cancelOrderId) return;
    const reason =
      cancelReasonPreset === 'custom'
        ? cancelReasonCustom.trim()
        : cancelReasonPreset;
    if (!reason) {
      Alert.alert('خطأ', 'يرجى تحديد سبب الإلغاء');
      return;
    }
    await transitionOrder(cancelOrderId, 'cancelled', reason);
    setCancelOrderId(null);
  };

  useEffect(() => {
    if (!accessToken) return;
    const socket = connectSocket(accessToken);
    const onOrderChanged = () => setRefreshTrigger((prev) => prev + 1);
    socket.on('order.created', onOrderChanged);
    socket.on('order.updated', onOrderChanged);
    socket.on('order.cancelled', onOrderChanged);
    socket.on('order.timeline.updated', onOrderChanged);
    socket.on('inventory.updated', onOrderChanged);
    return () => {
      socket.off('order.created', onOrderChanged);
      socket.off('order.updated', onOrderChanged);
      socket.off('order.cancelled', onOrderChanged);
      socket.off('order.timeline.updated', onOrderChanged);
      socket.off('inventory.updated', onOrderChanged);
      socket.disconnect();
    };
  }, [accessToken]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
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
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Text style={{ fontSize: 60 }}>🥩</Text>
          <Text style={{ ...typography.h2, color: colors.textPrimary, textAlign: 'center' }}>سجّل ملحمتك في سرح</Text>
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

  const TABS: { id: ManageTab; label: string; icon: string; count?: number }[] = [
    { id: 'orders',   label: 'الطلبات',   icon: 'clipboard-outline', count: orders.filter((o) => o.status === 'pending').length },
    { id: 'products', label: 'المنتجات',  icon: 'cube-outline',      count: products.length },
    { id: 'offers',   label: 'العروض',    icon: 'pricetag-outline',  count: offers.length },
    { id: 'stories',  label: 'القصص',     icon: 'camera-outline' },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/sidebar')} hitSlop={12} style={styles.backBtn}>
          <AppIcon name="menu" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>إدارة الملحمة</Text>
          <Text style={styles.headerSub}>{butcher?.nameAr}</Text>
        </View>
        <Pressable onPress={() => router.push('/butchers/edit')} hitSlop={12} style={styles.backBtn}>
          <AppIcon name="create-outline" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Verified status */}
      {butcher?.subscriptionActive && (
        <View style={styles.verifiedStrip}>
          <LinearGradient colors={[colors.gold + '22', colors.amber + '11']} style={StyleSheet.absoluteFill} />
          <AppIcon name="shield-checkmark" size={14} color={colors.gold} />
          <Text style={styles.verifiedText}>حساب موثّق نشط</Text>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>
            {butcher.isOpen ? 'مفتوح الآن' : 'مغلق'}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsGrid}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.tabIconCircle, isActive && styles.tabIconCircleActive]}>
                <AppIcon
                  name={tab.icon}
                  size={20}
                  color={isActive ? '#fff' : colors.textMuted}
                />
                {!!tab.count && tab.count > 0 && (
                  <View style={[styles.tabCountBadge, isActive && styles.tabCountBadgeActive]}>
                    <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                      {tab.count > 99 ? '99+' : tab.count}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>📍 موقع الملحمة</Text>
              <Text style={styles.locationSub}>
                {hasValidCoords(butcher?.lat, butcher?.lng)
                  ? formatLocationLabel(butcher?.cityAr, butcher?.addressAr ?? butcher?.address, butcher.lat, butcher.lng)
                  : 'لم يتم تحديد الموقع بعد — أضف موقعك ليظهر على الخريطة'}
              </Text>
            </View>
            <Pressable
              style={styles.locationEditBtn}
              onPress={() => setShowLocationEditor((v) => !v)}
            >
              <AppIcon
                name={showLocationEditor ? 'chevron-up' : 'pencil-outline'}
                size={18}
                color={colors.electricBright}
              />
            </Pressable>
          </View>

          {!showLocationEditor && hasValidCoords(butcher?.lat, butcher?.lng) ? (
            <LocationMapPreview
              country={(butcher?.country as Country) ?? 'SA'}
              lat={butcher.lat}
              lng={butcher.lng}
              cityLabel={butcher?.cityAr}
              height={180}
            />
          ) : null}

          {showLocationEditor && (
            <View style={styles.locationEditor}>
              <ButcherLocationPicker
                country={(butcher?.country as Country) ?? 'SA'}
                lat={locationLat}
                lng={locationLng}
                cityLabel={butcher?.cityAr}
                addressLabel={butcher?.addressAr ?? butcher?.address}
                onChange={({ lat, lng }) => {
                  setLocationLat(lat);
                  setLocationLng(lng);
                }}
                onAddressResolved={setLocationAddress}
                height={240}
              />
              <Pressable
                style={[styles.locationSaveBtn, savingLocation && { opacity: 0.7 }]}
                onPress={saveLocation}
                disabled={savingLocation}
              >
                {savingLocation ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.locationSaveText}>حفظ الموقع</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Orders Tab ── */}
        {activeTab === 'orders' && (
          <View>
            <Text style={styles.sectionTitle}>
              الطلبات الواردة ({orders.length})
            </Text>
            {orders.map((order) => {
              const status = order.status;
              const statusColor = statusColors[status] ?? colors.textMuted;
              const customerName = order.customer?.arabicName || order.customer?.displayName || 'عميل سرح';
              const productName = order.product?.nameAr || 'منتج لحم';
              const formattedDate = new Date(order.createdAt).toLocaleDateString('ar-SA');
              const allowedNext: string[] = Array.isArray(order.allowedNextStatuses)
                ? order.allowedNextStatuses
                : [];
              return (
                <View key={order.id} style={ord.card}>
                  <View style={ord.header}>
                    <View style={ord.customerWrap}>
                      <View style={[ord.statusDot, { backgroundColor: statusColor }]} />
                      <UserProfileLink userId={order.customer?.id}>
                        <Text style={ord.customerName}>{customerName}</Text>
                      </UserProfileLink>
                    </View>
                    <View style={[ord.statusBadge, { backgroundColor: statusColor + '33', borderColor: statusColor + '66' }]}>
                      <Text style={[ord.statusText, { color: statusColor }]}>
                        {STATUS_LABELS[status] || status}
                      </Text>
                    </View>
                  </View>

                  <Text style={ord.orderNumber}>
                    رقم الطلب: {order.orderNumber || `#${order.id.slice(0, 8).toUpperCase()}`}
                  </Text>
                  {order.paymentStatus !== 'paid' && (
                    <View style={{ marginBottom: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.amber + '33', borderWidth: 1, borderColor: colors.amber + '66' }}>
                      <Text style={{ color: colors.amber, fontSize: 11, fontWeight: '700' }}>بانتظار الدفع</Text>
                    </View>
                  )}
                  {order.paymentStatus === 'paid' && (
                    <View style={{ marginBottom: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.success + '33', borderWidth: 1, borderColor: colors.success + '66' }}>
                      <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>مدفوع</Text>
                    </View>
                  )}

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
                      <AppIcon
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
                      onPress={() => {
                        const customerId = order.customer?.id;
                        if (!customerId) {
                          Alert.alert('خطأ', 'لا يمكن فتح المحادثة لعدم توفر بيانات العميل');
                          return;
                        }
                        router.push({
                          pathname: '/butchers/chat',
                          params: {
                            receiverId: customerId,
                            receiverName: customerName,
                            receiverAvatar: order.customer?.avatar || '',
                          },
                        });
                      }}
                    >
                      <AppIcon name="chatbubble-outline" size={16} color={colors.electricBright} />
                      <Text style={ord.chatBtnText}>محادثة</Text>
                    </Pressable>

                    {allowedNext
                      .filter((next) => next !== 'cancelled')
                      .filter((next) => !(next === 'confirmed' && order.paymentStatus !== 'paid'))
                      .map((next) => (
                      <Pressable
                        key={`${order.id}-${next}`}
                        style={ord.advanceBtn}
                        onPress={() => transitionOrder(order.id, next)}
                      >
                        <LinearGradient
                          colors={[statusColor, statusColor + 'BB']}
                          style={ord.advanceBtnGrad}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={ord.advanceBtnText}>
                            {next === 'confirmed'
                              ? 'تأكيد'
                              : next === 'preparing'
                                ? 'بدء التحضير'
                                : next === 'ready'
                                  ? 'جاهز'
                                  : 'تم التسليم'}
                          </Text>
                          <AppIcon name="arrow-forward" size={14} color="#fff" />
                        </LinearGradient>
                      </Pressable>
                    ))}

                    {allowedNext.includes('cancelled') && (
                      <Pressable
                        style={ord.rejectBtn}
                        onPress={() => cancelOrder(order.id)}
                      >
                        <AppIcon name="close" size={16} color={colors.danger} />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
            {orders.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>لا توجد طلبات بعد</Text>
                <Text style={styles.emptySub}>ستظهر هنا الطلبات الواردة من العملاء</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Products Tab ── */}
        {activeTab === 'products' && (
          <View>
            <View style={styles.tabHeader}>
              <Text style={styles.sectionTitle}>منتجاتي ({products.length})</Text>
              <Pressable style={styles.addBtn} onPress={() => openProductForm()}>
                <AppIcon name="add" size={16} color={colors.electricBright} />
                <Text style={styles.addBtnText}>إضافة منتج</Text>
              </Pressable>
            </View>

            {showProductForm && (
              <View style={styles.formCard}>
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
                    <AppIcon name="pencil-outline" size={16} color={colors.electricBright} />
                  </Pressable>
                  <Pressable style={pm.deleteBtn} onPress={() => deleteProduct(p.id)}>
                    <AppIcon name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))}
            {products.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🥩</Text>
                <Text style={styles.emptyTitle}>لا توجد منتجات بعد</Text>
                <Text style={styles.emptySub}>أضف منتجاتك لتبدأ في البيع</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Offers Tab ── */}
        {activeTab === 'offers' && (
          <View>
            <View style={styles.tabHeader}>
              <Text style={styles.sectionTitle}>عروضي ({offers.length})</Text>
              <Pressable style={styles.addBtn} onPress={() => openOfferForm()}>
                <AppIcon name="add" size={16} color={colors.electricBright} />
                <Text style={styles.addBtnText}>إضافة عرض</Text>
              </Pressable>
            </View>

            {showOfferForm && (
              <View style={styles.formCard}>
                <AddOfferForm
                  offer={editingOffer}
                  onClose={closeOfferForm}
                  onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
                  butcherCountry={butcher?.country || 'SA'}
                />
              </View>
            )}

            {offers.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏷️</Text>
                <Text style={styles.emptyTitle}>لا توجد عروض بعد</Text>
                <Text style={styles.emptySub}>أضف عروضاً لجذب المزيد من العملاء</Text>
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
                      <AppIcon name="pencil-outline" size={16} color={colors.electricBright} />
                    </Pressable>
                    <Pressable style={pm.deleteBtn} onPress={() => deleteOffer(offer.id)}>
                      <AppIcon name="trash-outline" size={16} color={colors.danger} />
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
            <View style={styles.tabHeader}>
              <Text style={styles.sectionTitle}>قصصي</Text>
              <Pressable
                style={styles.addBtn}
                onPress={() => router.push({ pathname: '/create/story', params: { mode: 'butcher' } })}
              >
                <AppIcon name="add" size={16} color={colors.electricBright} />
                <Text style={styles.addBtnText}>نشر قصة</Text>
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
                      <AppIcon name="trash-outline" size={16} color={colors.danger} />
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
                  <AppIcon name="add" size={18} color="#fff" />
                </View>
              </Pressable>
            ))}

            {!butcher?.subscriptionActive && (
              <View style={sto.lockCard}>
                <AppIcon name="lock-closed" size={24} color={colors.gold} />
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

      <Modal visible={!!cancelOrderId} transparent animationType="fade">
        <View style={ord.modalBackdrop}>
          <View style={ord.modalCard}>
            <Text style={ord.modalTitle}>إلغاء الطلب</Text>
            <Text style={ord.modalSub}>اختر سبب الإلغاء أو اكتب سبباً مخصصاً</Text>
            {CANCEL_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={[ord.reasonChip, cancelReasonPreset === reason && ord.reasonChipActive]}
                onPress={() => setCancelReasonPreset(reason)}
              >
                <Text
                  style={[
                    ord.reasonChipText,
                    cancelReasonPreset === reason && ord.reasonChipTextActive,
                  ]}
                >
                  {reason}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[ord.reasonChip, cancelReasonPreset === '__custom__' && ord.reasonChipActive]}
              onPress={() => setCancelReasonPreset('__custom__')}
            >
              <Text
                style={[
                  ord.reasonChipText,
                  cancelReasonPreset === '__custom__' && ord.reasonChipTextActive,
                ]}
              >
                سبب آخر
              </Text>
            </Pressable>
            {cancelReasonPreset === '__custom__' && (
              <TextInput
                style={ord.customReasonInput}
                placeholder="اكتب سبب الإلغاء"
                placeholderTextColor={colors.textSubtle}
                value={cancelReasonCustom}
                onChangeText={setCancelReasonCustom}
                textAlign="right"
              />
            )}
            <View style={ord.modalActions}>
              <Pressable style={ord.modalCancelBtn} onPress={() => setCancelOrderId(null)}>
                <Text style={ord.modalCancelText}>تراجع</Text>
              </Pressable>
              <Pressable style={ord.modalConfirmBtn} onPress={confirmCancelOrder}>
                <Text style={ord.modalConfirmText}>تأكيد الإلغاء</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createMainStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}

// Add product / offer form
function createProductFormStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  imageThumbWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  imageThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bgElevated,
  },
  imageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.bgOverlay,
    borderRadius: 12,
  },
  uploadBox: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.electricBright + '55',
    borderStyle: 'dashed',
    backgroundColor: colors.electric + '08',
  },
  uploadText: { ...typography.micro, color: colors.textBrandStrong, fontWeight: '600', textAlign: 'center' },
  uploadHint: { ...typography.micro, color: colors.textSubtle, textAlign: 'right', marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: 13,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
  },
  cancelText: { ...typography.bodyStrong, color: colors.textMuted },
  saveBtn: { flex: 2, borderRadius: radius.xl, overflow: 'hidden' },
  saveBtnGrad: {
    paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { ...typography.bodyStrong, color: '#fff' },
  });
}

function createOrderStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  orderNumber: { ...typography.micro, color: colors.textMuted, textAlign: 'right' },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'right' },
  modalSub: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginBottom: spacing.sm },
  reasonChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgElevated,
  },
  reasonChipActive: {
    borderColor: colors.danger,
    backgroundColor: colors.danger + '18',
  },
  reasonChipText: { ...typography.caption, color: colors.textSecondary, textAlign: 'right' },
  reasonChipTextActive: { color: colors.danger, fontWeight: '700' },
  customReasonInput: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.bgElevated,
    marginTop: spacing.xs,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  modalCancelText: { ...typography.caption, color: colors.textMuted },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  modalConfirmText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  });
}

function createProductManageStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}

function createOfferManageStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}

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
