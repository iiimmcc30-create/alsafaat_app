// Powered by OnSpace.AI
// SAFAT — Edit Butcher Account (تعديل حساب الملحمة)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { alertMessage } from '@/lib/actionSheet';
import { rtlBackIcon } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';
import { Country, countries } from '@/services/types';
import { ButcherLocationPicker } from '@/components/feature/ButcherLocationPicker';
import { formatLocationLabel } from '@/lib/formatAddress';
import { hasValidCoords } from '@/lib/butcherLocation';
import { uploadImageFromUri } from '@/services/upload';
import { useRequireApprovedButcher } from '@/hooks/useRequireApprovedButcher';

const SAUDI_COUNTRY: Country = 'SA';

const SPECIALTY_OPTIONS = [
  'ذبح يومي',
  'خروف كامل',
  'عجل بلدي',
  'لحم برازيلي',
  'دواجن طازجة',
  'طلبات خاصة',
  'إبل',
  'مشاريع المناسبات',
];

const CLOSED_DAYS = [
  { id: 'sunday', ar: 'الأحد' },
  { id: 'monday', ar: 'الاثنين' },
  { id: 'tuesday', ar: 'الثلاثاء' },
  { id: 'wednesday', ar: 'الأربعاء' },
  { id: 'thursday', ar: 'الخميس' },
  { id: 'friday', ar: 'الجمعة' },
  { id: 'saturday', ar: 'السبت' },
];

function normalizeTime(value: string): string {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return value.trim();
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function buildFullPhone(country: Country, localPhone: string): string {
  const phoneCode = countries[country]?.phoneCode ?? '+966';
  const digits = localPhone
    .trim()
    .replace(/\s+/g, '')
    .replace(/^\+/, '')
    .replace(new RegExp(`^(?:${phoneCode.replace('+', '')}|00${phoneCode.replace('+', '')})`), '')
    .replace(/^0/, '')
    .replace(/\D/g, '');
  return `${phoneCode}${digits}`;
}

function formatValidationError(json: any): string {
  const fieldErrors = json?.details?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const first = Object.entries(fieldErrors).find(([, msgs]) => Array.isArray(msgs) && msgs.length);
    if (first) {
      const [field, msgs] = first as [string, string[]];
      return `${field}: ${msgs[0]}`;
    }
  }
  return json?.messageAr || json?.message || 'فشل حفظ التغييرات';
}

function stripLocalPhone(fullPhone: string, country: Country): string {
  const phoneCode = countries[country]?.phoneCode ?? '+966';
  return fullPhone
    .trim()
    .replace(/\s+/g, '')
    .replace(/^\+/, '')
    .replace(new RegExp(`^(?:${phoneCode.replace('+', '')}|00${phoneCode.replace('+', '')})`), '')
    .replace(/^0/, '');
}

export default function EditButcherScreen() {
  const router = useRouter();
  const { colors, gradients: themeGradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { accessToken } = useAuth();
  const { hasApprovedApplication, loading: accessLoading } = useRequireApprovedButcher();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [nameAr, setNameAr] = useState('');
  const [bioAr, setBioAr] = useState('');
  const [phone, setPhone] = useState('');
  const country = SAUDI_COUNTRY;
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [commercialReg, setCommercialReg] = useState('');
  const [openTime, setOpenTime] = useState('06:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [isOpen, setIsOpen] = useState(true);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);

  const phoneCode = countries[country]?.phoneCode ?? countries.SA.phoneCode;
  const fullPhone = buildFullPhone(country, phone);

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      setErrorMsg('الرجاء تسجيل الدخول أولاً');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch(`${API_BASE}/api/butchers/me?t=${Date.now()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        setErrorMsg(json.messageAr || json.message || 'لم يتم العثور على ملف الملحمة');
        return;
      }
      const b = json.data;
      const c = SAUDI_COUNTRY;
      setNameAr(b.nameAr ?? '');
      setBioAr(b.bioAr ?? '');
      setPhone(stripLocalPhone(b.phone ?? '', c));
      setCity(b.cityAr ?? b.city ?? '');
      setAddress(b.addressAr ?? b.address ?? '');
      setCommercialReg(b.commercialReg ?? '');
      setOpenTime(b.openTime ?? '06:00');
      setCloseTime(b.closeTime ?? '22:00');
      setIsOpen(b.isOpen ?? true);
      setSpecialties(Array.isArray(b.specialties) ? b.specialties : []);
      setClosedDays(Array.isArray(b.closedDays) ? b.closedDays : []);
      setLat(typeof b.lat === 'number' ? b.lat : null);
      setLng(typeof b.lng === 'number' ? b.lng : null);
      setLogoUrl(b.logo ?? null);
      setCoverUrl(b.cover ?? null);
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const pickImage = async (target: 'logo' | 'cover') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح للتطبيق بالوصول إلى مكتبة الصور');
      return;
    }
    const aspect = target === 'logo' ? [1, 1] as [number, number] : [16, 9] as [number, number];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      if (target === 'logo') setLogoUri(result.assets[0].uri);
      else setCoverUri(result.assets[0].uri);
    }
  };

  const toggleSpecialty = (spec: string) => {
    setSpecialties((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec],
    );
  };

  const toggleClosedDay = (dayId: string) => {
    setClosedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId],
    );
  };

  const handleSave = async () => {
    if (!accessToken) return;
    if (!nameAr.trim()) {
      Alert.alert('خطأ', 'اسم الملحمة مطلوب');
      return;
    }
    if (!city.trim() || !address.trim()) {
      Alert.alert('خطأ', 'المدينة والعنوان مطلوبان');
      return;
    }

    const normalizedOpen = normalizeTime(openTime);
    const normalizedClose = normalizeTime(closeTime);
    const timeRe = /^([0-9]{2}):([0-9]{2})$/;
    if (!timeRe.test(normalizedOpen) || !timeRe.test(normalizedClose)) {
      Alert.alert('خطأ', 'صيغة ساعات العمل: HH:MM (مثال 06:00)');
      return;
    }

    const normalizedPhone = buildFullPhone(country, phone);
    if (!/^\+?[0-9]{8,20}$/.test(normalizedPhone)) {
      Alert.alert('خطأ', 'رقم الهاتف غير صالح');
      return;
    }

    setSaving(true);
    try {
      let logo = logoUrl;
      let cover = coverUrl;
      if (logoUri) logo = await uploadImageFromUri(accessToken, logoUri, 'butchers');
      if (coverUri) cover = await uploadImageFromUri(accessToken, coverUri, 'butchers');

      const payload: Record<string, unknown> = {
        nameAr: nameAr.trim(),
        nameEn: nameAr.trim(),
        bioAr: bioAr.trim() || null,
        bioEn: bioAr.trim() || null,
        phone: normalizedPhone,
        country,
        city: city.trim(),
        cityAr: city.trim(),
        address: address.trim(),
        addressAr: address.trim(),
        commercialReg: commercialReg.trim() || null,
        openTime: normalizedOpen,
        closeTime: normalizedClose,
        isOpen,
        specialties,
        closedDays,
      };
      if (hasValidCoords(lat, lng)) {
        payload.lat = lat;
        payload.lng = lng;
      }
      if (logo) payload.logo = logo;
      if (cover) payload.cover = cover;

      const res = await authFetch(`${API_BASE}/api/butchers/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        await alertMessage('تم الحفظ', 'تم حفظ بيانات الملحمة بنجاح');
        router.back();
      } else {
        Alert.alert('خطأ', formatValidationError(json));
      }
    } catch (err) {
      console.warn('[EditButcher] save failed:', err);
      Alert.alert('خطأ', err instanceof Error ? err.message : 'تعذر حفظ التغييرات');
    } finally {
      setSaving(false);
    }
  };

  if (accessLoading || !hasApprovedApplication) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.electricBright} />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.electricBright} />
          <Text style={styles.loadingText}>جاري تحميل بيانات الملحمة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>تعديل حساب الملحمة</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.retryBtn} onPress={loadProfile}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>تعديل حساب الملحمة</Text>
          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnLoading]}
            onPress={handleSave}
            disabled={saving}
          >
            <LinearGradient
              colors={saving ? [colors.bgSurface, colors.bgSurface] : themeGradients.royal}
              style={styles.saveBtnInner}
            >
              <Text style={[styles.saveBtnText, saving && { color: colors.textMuted }]}>
                {saving ? 'جاري...' : 'حفظ'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Cover & Logo */}
          <View style={styles.mediaSection}>
            <Pressable style={styles.coverWrap} onPress={() => pickImage('cover')}>
              {(coverUri ?? coverUrl) ? (
                <Image
                  source={{ uri: (coverUri ?? coverUrl)! }}
                  style={styles.coverImg}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <AppIcon name="image-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.coverHint}>صورة الغلاف</Text>
                </View>
              )}
              <View style={styles.mediaBadge}>
                <AppIcon name="camera" size={14} color="#fff" />
              </View>
            </Pressable>
            <Pressable style={styles.logoWrap} onPress={() => pickImage('logo')}>
              {(logoUri ?? logoUrl) ? (
                <Image
                  source={{ uri: (logoUri ?? logoUrl)! }}
                  style={styles.logoImg}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <AppIcon name="storefront-outline" size={24} color={colors.textMuted} />
                </View>
              )}
              <View style={[styles.mediaBadge, styles.logoBadge]}>
                <AppIcon name="camera" size={12} color="#fff" />
              </View>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Field styles={styles} colors={colors} label="اسم الملحمة *" value={nameAr} onChange={setNameAr} placeholder="مثال: ملحمة الطازج" />
            <Field styles={styles} colors={colors} label="نبذة" value={bioAr} onChange={setBioAr} placeholder="وصف مختصر عن ملحمتك..." multiline />

            <Text style={styles.fieldLabel}>البلد</Text>
            <View style={styles.countryFixed}>
              <Text style={styles.countryFlag}>🇸🇦</Text>
              <Text style={styles.countryLabelFixed}>السعودية</Text>
            </View>

            <Text style={styles.fieldLabel}>رقم الهاتف</Text>
            <View style={styles.phoneRow}>
              <View style={styles.phoneCodePill}>
                <Text style={styles.phoneCodeText}>{phoneCode}</Text>
              </View>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                placeholder="5X XXX XXXX"
                placeholderTextColor={colors.textSubtle}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                textAlign="right"
              />
            </View>

            <Field styles={styles} colors={colors} label="المدينة *" value={city} onChange={setCity} placeholder="مثال: الرياض" />
            <Field styles={styles} colors={colors} label="العنوان التفصيلي *" value={address} onChange={setAddress} placeholder="الحي، الشارع، رقم المبنى" multiline />
            <Field styles={styles} colors={colors} label="السجل التجاري" value={commercialReg} onChange={setCommercialReg} placeholder="رقم السجل التجاري" />

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>ساعات العمل</Text>
            </View>
            <View style={styles.hoursRow}>
              <View style={styles.hourField}>
                <Text style={styles.hourLabel}>الافتتاح</Text>
                <TextInput
                  style={styles.input}
                  value={openTime}
                  onChangeText={setOpenTime}
                  placeholder="06:00"
                  placeholderTextColor={colors.textSubtle}
                  textAlign="center"
                />
              </View>
              <AppIcon name="arrow-forward" size={18} color={colors.textMuted} style={{ marginTop: 28 }} />
              <View style={styles.hourField}>
                <Text style={styles.hourLabel}>الإغلاق</Text>
                <TextInput
                  style={styles.input}
                  value={closeTime}
                  onChangeText={setCloseTime}
                  placeholder="22:00"
                  placeholderTextColor={colors.textSubtle}
                  textAlign="center"
                />
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>الملحمة مفتوحة الآن</Text>
              <Switch
                value={isOpen}
                onValueChange={setIsOpen}
                trackColor={{ false: colors.bgElevated, true: colors.electric + '88' }}
                thumbColor={isOpen ? colors.electricBright : colors.textMuted}
              />
            </View>

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>أيام الإغلاق</Text>
            </View>
            <View style={styles.chipsRow}>
              {CLOSED_DAYS.map((day) => {
                const active = closedDays.includes(day.id);
                return (
                  <Pressable
                    key={day.id}
                    onPress={() => toggleClosedDay(day.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{day.ar}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>التخصصات</Text>
            </View>
            <View style={styles.chipsRow}>
              {SPECIALTY_OPTIONS.map((spec) => {
                const active = specialties.includes(spec);
                return (
                  <Pressable
                    key={spec}
                    onPress={() => toggleSpecialty(spec)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{spec}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>موقع الملحمة على الخريطة (اختياري)</Text>
            </View>
            <ButcherLocationPicker
              country={country}
              lat={lat}
              lng={lng}
              cityLabel={city}
              addressLabel={address}
              onChange={({ lat: newLat, lng: newLng }) => {
                setLat(newLat);
                setLng(newLng);
              }}
              onAddressResolved={({ cityAr, addressAr }) => {
                if (cityAr) setCity(cityAr);
                if (addressAr) setAddress(addressAr);
              }}
              height={260}
            />
            {hasValidCoords(lat, lng) && (
              <View style={styles.coordsBox}>
                <AppIcon name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.coordsText}>
                  {formatLocationLabel(city, address, lat, lng)}
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  styles,
  colors,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rtl = true,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rtl?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, rtl && styles.inputRtl]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        textAlign={rtl ? 'right' : 'left'}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  loadingText: { ...typography.body, color: colors.textMuted },
  errorText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.electric,
  },
  retryText: { ...typography.bodyStrong, color: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgGlass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  saveBtn: { borderRadius: radius.pill, overflow: 'hidden' },
  saveBtnLoading: { opacity: 0.7 },
  saveBtnInner: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill },
  saveBtnText: { ...typography.bodyStrong, color: '#fff' },
  scroll: { paddingBottom: 40 },
  mediaSection: { position: 'relative', marginBottom: 48 },
  coverWrap: {
    height: 140,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coverHint: { ...typography.caption, color: colors.textMuted },
  logoWrap: {
    position: 'absolute',
    bottom: -36,
    right: spacing.lg,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.electricBright,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  logoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  mediaBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: { bottom: 4, left: 4, width: 24, height: 24, borderRadius: 12 },
  form: { paddingHorizontal: spacing.lg, gap: spacing.md },
  fieldGroup: { gap: 6 },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', textAlign: 'right' },
  input: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputRtl: { textAlign: 'right' },
  inputMultiline: { minHeight: 80, paddingTop: 12 },
  countryFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderMid,
    backgroundColor: colors.bgElevated,
    marginBottom: spacing.sm,
  },
  countryFlag: { fontSize: 16 },
  countryLabelFixed: { ...typography.bodyStrong, color: colors.textPrimary },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  phoneCodePill: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  phoneCodeText: { ...typography.bodyStrong, color: colors.textPrimary },
  phoneInput: { flex: 1 },
  sectionDivider: { marginTop: spacing.sm, marginBottom: 4 },
  sectionLabel: { ...typography.caption, color: colors.textBrand, fontWeight: '700', textAlign: 'right' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  hourField: { flex: 1, gap: 6 },
  hourLabel: { ...typography.micro, color: colors.textMuted, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  toggleLabel: { ...typography.body, color: colors.textPrimary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipActive: { borderColor: colors.electricBright, backgroundColor: colors.electric + '18' },
  chipText: { ...typography.caption, color: colors.textMuted },
  chipTextActive: { color: colors.textBrandStrong, fontWeight: '700' },
  coordsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '33',
  },
  coordsText: { ...typography.caption, color: colors.textBrandSuccess, flex: 1, textAlign: 'right' },
});
}
