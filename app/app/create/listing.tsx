// Powered by OnSpace.AI
// SAFAT — Create Listing Screen (إنشاء إعلان)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { calculateCommission, ListingCategory } from '@/services/commissions';
import { Country } from '@/services/types';
import { uploadImageFromUri } from '@/services/upload';
import { LocationMapPreview } from '@/components/feature/LocationMapPreview';
import * as Location from 'expo-location';
import { hasValidCoords } from '@/lib/butcherLocation';

type Category = 'camels' | 'sheep' | 'goats' | 'cows' | 'horses' | 'birds' | 'feed' | 'equipment';

const CATEGORIES: { id: Category; ar: string; icon: string }[] = [
  { id: 'camels', ar: 'إبل', icon: '🐪' },
  { id: 'sheep', ar: 'أغنام', icon: '🐑' },
  { id: 'goats', ar: 'معز', icon: '🐐' },
  { id: 'cows', ar: 'بقر', icon: '🐄' },
  { id: 'horses', ar: 'خيول', icon: '🐎' },
  { id: 'birds', ar: 'طيور', icon: '🦅' },
  { id: 'feed', ar: 'علف', icon: '🌾' },
  { id: 'equipment', ar: 'معدات', icon: '⚙️' },
];

const GCC_COUNTRIES: { code: Country; ar: string; flag: string; currency: string }[] = [
  { code: 'SA', ar: 'السعودية', flag: '🇸🇦', currency: 'SAR' },
  { code: 'EG', ar: 'مصر', flag: '🇪🇬', currency: 'EGP' },
];

const STEPS = ['النوع', 'التفاصيل', 'السعر', 'المراجعة'];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CAT_COLS = 4;
const CAT_GAP = spacing.md;
const CAT_CARD_SIZE =
  (SCREEN_WIDTH - spacing.lg * 2 - CAT_GAP * (CAT_COLS - 1)) / CAT_COLS;

export default function CreateListingScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { addListing } = useApp();
  const { accessToken } = useAuth();
  const { subscription } = useSubscription();

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [titleAr, setTitleAr] = useState('');
  const [descAr, setDescAr] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [price, setPrice] = useState('');
  const [country, setCountry] = useState<Country>('SA');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPledge, setShowPledge] = useState(false);
  const [pledgeChecked, setPledgeChecked] = useState(false);

  const selectedCountry = GCC_COUNTRIES.find((c) => c.code === country)!;

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح بالوصول إلى الصور لإضافتها للإعلان');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 8 - imageUris.length,
      quality: 0.85,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUris((prev) =>
        [...prev, ...result.assets.map((a) => a.uri)].slice(0, 8),
      );
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن الموقع', 'يرجى السماح بالوصول للموقع لتحديد مكان الإعلان');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(Math.round(pos.coords.latitude * 1_000_000) / 1_000_000);
      setLng(Math.round(pos.coords.longitude * 1_000_000) / 1_000_000);

      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const city = geo?.city || geo?.subregion || geo?.region;
        if (city && !location.trim()) setLocation(city);
      } catch {
        // city name optional
      }
    } catch {
      Alert.alert('خطأ', 'تعذّر الحصول على موقعك. حاول مجدداً.');
    } finally {
      setLocating(false);
    }
  };

  const canContinue = () => {
    if (step === 0) return !!category;
    if (step === 1) {
      return titleAr.trim().length >= 3 && descAr.trim().length >= 10 && imageUris.length > 0;
    }
    if (step === 2) return price.trim().length > 0 && location.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      // Show pledge modal before final submit
      setPledgeChecked(false);
      setShowPledge(true);
    }
  };

  const handlePledgeConfirm = async () => {
    setShowPledge(false);
    await handleSubmit();
  };

  const handleSubmit = async () => {
    if (!category || !accessToken) return;
    setSubmitting(true);

    try {
      const uploadedUrls: string[] = [];
      for (const uri of imageUris) {
        try {
          const url = await uploadImageFromUri(accessToken, uri, 'listings');
          uploadedUrls.push(url);
        } catch {
          if (__DEV__) {
            uploadedUrls.push(`https://picsum.photos/seed/${Date.now()}-${uploadedUrls.length}/800/600`);
          } else {
            throw new Error('تعذّر رفع الصور. تحقق من الاتصال وحاول مجدداً.');
          }
        }
      }

      if (uploadedUrls.length === 0) {
        Alert.alert('صور مطلوبة', 'يجب إضافة صورة واحدة على الأقل للإعلان.');
        setSubmitting(false);
        return;
      }

      const title = titleAr.trim();
      const result = await addListing({
        title,
        arabicTitle: title,
        description: descAr.trim(),
        arabicDescription: descAr.trim(),
        price: Number(price),
        currency: selectedCountry.currency,
        category,
        breed: breed.trim() || undefined,
        age: age.trim() || undefined,
        quantity: 1,
        location: location.trim(),
        arabicLocation: location.trim(),
        country,
        images: uploadedUrls,
        featured,
      });

      if (result.ok) {
        Alert.alert('تم النشر! 🎉', 'تم نشر إعلانك بنجاح في السوق.', [
          { text: 'عرض السوق', onPress: () => router.replace('/(tabs)/market') },
          { text: 'حسابي', onPress: () => router.replace('/(tabs)/profile') },
        ]);
      } else {
        Alert.alert(
          'خطأ',
          result.error ||
            'فشل نشر الإعلان. يرجى التحقق من المدخلات أو باقة الاشتراك الخاصة بك.',
        );
      }
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'فشل نشر الإعلان.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => (step > 0 ? setStep((s) => s - 1) : router.back())}
            style={styles.backBtn}
            hitSlop={8}
          >
            <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>إنشاء إعلان</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Step bar — fixed height, no vertical flex expansion */}
        <View style={styles.stepBarWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stepBarScroll}
            contentContainerStyle={styles.stepBar}
          >
            {STEPS.map((s, i) => (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                  {i < step ? (
                    <AppIcon name="checkmark" size={12} color="#fff" />
                  ) : (
                    <Text style={styles.stepNum}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]} numberOfLines={1}>
                  {s}
                </Text>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 0 - Category */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>ما نوع الإعلان؟</Text>
              <Text style={styles.stepSubtitle}>اختر تصنيف إعلانك</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={[styles.catCard, category === cat.id && styles.catCardActive]}
                  >
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <Text style={[styles.catLabel, category === cat.id && styles.catLabelActive]}>
                      {cat.ar}
                    </Text>
                    {category === cat.id && (
                      <View style={styles.catCheck}>
                        <AppIcon name="checkmark-circle" size={16} color={colors.electricBright} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Step 1 - Details */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>تفاصيل الإعلان</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>عنوان الإعلان *</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={titleAr}
                    onChangeText={setTitleAr}
                    placeholder="مثال: ناقة نجدية أصيلة..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { textAlign: 'right' }]}
                    maxLength={80}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الوصف *</Text>
                <View style={[styles.inputWrap, { height: 100, alignItems: 'flex-start', paddingTop: spacing.sm }]}>
                  <TextInput
                    value={descAr}
                    onChangeText={setDescAr}
                    placeholder="صف الحيوان بالتفصيل: العمر، الجنس، الحالة الصحية..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { textAlign: 'right', textAlignVertical: 'top', height: 80 }]}
                    multiline
                    maxLength={500}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>السلالة / النوع</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={breed}
                      onChangeText={setBreed}
                      placeholder="مثال: نجدية"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, { textAlign: 'right' }]}
                    />
                  </View>
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>العمر</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={age}
                      onChangeText={setAge}
                      placeholder="مثال: 3 سنوات"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, { textAlign: 'right' }]}
                    />
                  </View>
                </View>
              </View>

              {/* Images */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الصور * (صورة واحدة على الأقل)</Text>
                <View style={styles.imageGrid}>
                  {imageUris.map((uri, idx) => (
                    <View key={uri} style={styles.imageThumbWrap}>
                      <Image source={{ uri }} style={styles.imageThumb} contentFit="cover" />
                      <Pressable style={styles.imageRemove} onPress={() => removeImage(idx)} hitSlop={6}>
                        <AppIcon name="close-circle" size={22} color={colors.rose} />
                      </Pressable>
                    </View>
                  ))}
                  {imageUris.length < 8 && (
                    <Pressable style={styles.imageAddBtn} onPress={pickImages}>
                      <AppIcon name="add" size={28} color={colors.textMuted} />
                      <Text style={styles.imagePickerText}>إضافة</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.imagePickerSub}>حتى 8 صور · JPG، PNG</Text>
              </View>
            </View>
          )}

          {/* Step 2 - Price & Location */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>السعر والموقع</Text>

              {/* Country */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الدولة</Text>
                <View style={styles.countryRow}>
                  {GCC_COUNTRIES.map((c) => (
                    <Pressable
                      key={c.code}
                      onPress={() => setCountry(c.code)}
                      style={[styles.countryChip, country === c.code && styles.countryChipActive]}
                    >
                      <Text style={styles.countryFlag}>{c.flag}</Text>
                      <Text style={[styles.countryLabel, country === c.code && { color: colors.textBrandStrong }]}>
                        {c.ar}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>السعر * ({selectedCountry.currency})</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={price}
                    onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { flex: 1, textAlign: 'right' }]}
                    keyboardType="numeric"
                  />
                  <Text style={styles.currencyLabel}>{selectedCountry.currency}</Text>
                </View>
                {price ? (
                  <Text style={styles.fieldHint}>
                    {Number(price).toLocaleString()} {selectedCountry.currency}
                  </Text>
                ) : null}
              </View>

              {/* Commission preview */}
              {price && category && (
                <View style={styles.commissionBox}>
                  <View style={styles.commissionTop}>
                    <Text style={styles.commissionIcon}>📊</Text>
                    <Text style={styles.commissionTitle}>رسوم الإعلان المستحقة</Text>
                  </View>
                  {(() => {
                    const calc = calculateCommission(
                      category as ListingCategory,
                      Number(price),
                      1,
                      subscription.permissions,
                    );
                    return (
                      <View style={styles.commissionDetails}>
                        <View style={styles.commissionRow}>
                          <Text style={styles.commissionLabel}>نوع الرسوم</Text>
                          <Text style={styles.commissionValue}>{calc.descriptionAr}</Text>
                        </View>
                        <View style={[styles.commissionRow, styles.commissionHighlight]}>
                          <Text style={styles.commissionLabelBig}>الرسوم الإجمالية</Text>
                          <Text style={styles.commissionAmountBig}>{calc.commission} ريال</Text>
                        </View>
                        <Text style={styles.commissionNote}>
                          تُستحق خلال ١٤ يوم من نشر الإعلان · تُسدَّد في قسم سداد الرسوم
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              )}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الموقع على الخريطة *</Text>
                <LocationMapPreview
                  country={country}
                  cityLabel={location.trim() || undefined}
                  lat={lat}
                  lng={lng}
                  height={220}
                  showLocateButton
                  onLocate={useCurrentLocation}
                  locating={locating}
                />
                <View style={styles.inputWrap}>
                  <AppIcon name="location-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="مثال: الرياض"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { flex: 1, textAlign: 'right' }]}
                  />
                </View>
                {hasValidCoords(lat, lng) ? (
                  <Text style={styles.fieldHint}>✓ تم تحديد الموقع على الخريطة</Text>
                ) : (
                  <Text style={styles.mapHint}>اضغط «موقعي الحالي» أو أدخل اسم المدينة</Text>
                )}
              </View>

              {/* Featured toggle */}
              <Pressable
                style={styles.featuredToggle}
                onPress={() => setFeatured(!featured)}
              >
                <View style={styles.featuredInfo}>
                  <Text style={styles.featuredTitle}>⭐ إعلان مميز</Text>
                  <Text style={styles.featuredSub}>يظهر في أعلى نتائج البحث</Text>
                </View>
                <View style={[styles.toggle, featured && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, featured && styles.toggleThumbOn]} />
                </View>
              </Pressable>
            </View>
          )}

          {/* Step 3 - Review */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>مراجعة الإعلان</Text>
              <View style={styles.reviewCard}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>التصنيف</Text>
                  <Text style={styles.reviewValue}>
                    {CATEGORIES.find((c) => c.id === category)?.icon}{' '}
                    {CATEGORIES.find((c) => c.id === category)?.ar}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>العنوان</Text>
                  <Text style={styles.reviewValue}>{titleAr || '—'}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>السعر</Text>
                  <Text style={styles.reviewValue}>
                    {price ? `${Number(price).toLocaleString()} ${selectedCountry.currency}` : '—'}
                  </Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>الموقع</Text>
                  <Text style={styles.reviewValue}>{location || '—'} {selectedCountry.flag}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>الصور</Text>
                  <Text style={styles.reviewValue}>{imageUris.length} صورة</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>مميز</Text>
                  <Text style={styles.reviewValue}>{featured ? '✅ نعم' : '❌ لا'}</Text>
                </View>
              </View>

              <View style={styles.termsBox}>
                <AppIcon name="information-circle-outline" size={16} color={colors.textMuted} />
                <Text style={styles.termsText}>
                  بالنشر، تؤكد أن الإعلان صحيح ويتوافق مع شروط سرح.
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: spacing.md }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomBar}>
          <Pressable
            style={[styles.continueBtn, (!canContinue() || submitting) && styles.continueBtnDisabled]}
            onPress={handleNext}
            disabled={!canContinue() || submitting}
          >
            <LinearGradient
              colors={canContinue() && !submitting ? gradients.royal : [colors.bgSurface, colors.bgSurface]}
              style={styles.continueBtnInner}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.continueBtnText, !canContinue() && { color: colors.textMuted }]}>
                  {step === STEPS.length - 1 ? '🚀 نشر الإعلان' : 'التالي ← '}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
        <Modal
          visible={showPledge}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPledge(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={styles.pledgeHeaderIcon}>
                  <AppIcon name="shield-check" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>تعهد نشر الإعلان</Text>
                  <Text style={styles.modalSubtitle}>الشفافية تحفظ حقوق البائع والمشتري</Text>
                </View>
                <Pressable onPress={() => setShowPledge(false)} style={styles.modalCloseBtn} hitSlop={8}>
                  <AppIcon name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.pledgeIntro}>
                  <AppIcon name="information-circle-outline" size={18} color={colors.electricBright} />
                  <Text style={styles.pledgeIntroText}>
                    راجع البنود التالية بعناية. لن يتم نشر الإعلان قبل موافقتك الصريحة.
                  </Text>
                </View>

                {/* شروط وسياسة المنصة */}
                <View style={styles.pledgeCard}>
                  <View style={styles.pledgeSectionTitleRow}>
                    <View style={styles.pledgeSectionIcon}>
                      <AppIcon name="document-text-outline" size={17} color={colors.textBrandStrong} />
                    </View>
                    <Text style={styles.pledgeCardTitle}>شروط وسياسة المنصة</Text>
                  </View>
                  {[
                    'أُقرّ المستخدم بأن المعلومات المنشورة صحيحة ومطابقة للواقع.',
                    'لا يحق نشر إعلانات وهمية أو مضللة أو لحيوانات غير موجودة.',
                    'يلتزم البائع بالوفاء بالصفقة بعد قبول العرض.',
                    'تحتفظ المنصة بحق إزالة أي إعلان مخالف دون إشعار.',
                  ].map((item, i) => (
                    <View key={i} style={styles.pledgeItemRow}>
                      <View style={styles.pledgeItemNumber}>
                        <Text style={styles.pledgeItemNumberText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.pledgeItem}>{item}</Text>
                    </View>
                  ))}
                </View>

                {/* تعهد السعي / العمولة */}
                <View style={[styles.pledgeCard, styles.pledgeCardGold]}>
                  <View style={styles.pledgeSectionTitleRow}>
                    <View style={[styles.pledgeSectionIcon, styles.pledgeSectionIconGold]}>
                      <AppIcon name="receipt-outline" size={17} color={colors.gold} />
                    </View>
                    <Text style={styles.pledgeCardTitleGold}>تعهد السعي (العمولة)</Text>
                  </View>
                  <Text style={styles.pledgeBodyText}>
                    أتعهد بدفع سعي (عمولة) منصة سرح عند إتمام أي بيع يتم عبر المنصة، وفق النظام التالي:
                  </Text>
                  {[
                    { icon: '🐑', label: 'الأغنام والماعز',              value: '٢٠ ريال / رأس' },
                    { icon: '🐪', label: 'الإبل',                         value: '٦٠ ريال / رأس' },
                    { icon: '🐎', label: 'الخيول وباقي الأصناف',          value: '٢٪ من قيمة البيع' },
                    { icon: '🐄', label: 'الأبقار',                       value: '٢٪ من قيمة البيع' },
                    { icon: '🦅', label: 'الطيور والصقور',                 value: '٢٪ من قيمة البيع' },
                    { icon: '🌾', label: 'الأعلاف والمعدات',              value: '٢٪ من قيمة البيع' },
                    { icon: '🏪', label: 'المتجر والملاحم (بدون اشتراك)', value: '٥٪ من سعر البيع' },
                    { icon: '🏪', label: 'المتجر والملاحم (بـ اشتراك)',    value: 'صفر عمولة ✅' },
                  ].map((r, i) => (
                    <View key={i} style={styles.commRateRow}>
                      <Text style={styles.commRateValue}>{r.value}</Text>
                      <Text style={styles.commRateLabel}>{r.label} {r.icon}</Text>
                    </View>
                  ))}
                  <Text style={styles.commDueNote}>
                    يُستحق السداد خلال <Text style={styles.commDueBold}>7 أيام</Text> من تاريخ إتمام البيع. المتاجر الموثّقة بـ اشتراك مدفوع معفاة من العمولة.
                  </Text>
                </View>

                {/* القسم بالله */}
                <View style={[styles.pledgeCard, styles.pledgeCardBlue]}>
                  <View style={styles.pledgeSectionTitleRow}>
                    <View style={[styles.pledgeSectionIcon, styles.pledgeSectionIconBlue]}>
                      <AppIcon name="shield-check" size={17} color={colors.electricBright} />
                    </View>
                    <Text style={styles.pledgeCardTitleBlue}>الإقرار بصحة المعلومات</Text>
                  </View>
                  <Text style={styles.pledgeOath}>
                    «أقسم بالله العظيم أن هذا الإعلان صحيح، وأن ما عرضته مطابق للحقيقة، وأتعهد بدفع سعي المنصة عند البيع وفق نظام العمولة المعتمد.»
                  </Text>
                </View>

                {/* Checkbox */}
                <Pressable
                  onPress={() => setPledgeChecked((v) => !v)}
                  style={[styles.checkboxRow, pledgeChecked && styles.checkboxRowActive]}
                >
                  <View style={[styles.checkbox, pledgeChecked && styles.checkboxChecked]}>
                    {pledgeChecked && <AppIcon name="check" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    أقر بأنني قرأت وفهمت جميع الشروط، وأتعهد بدفع السعي (العمولة) وفق نظام سوق سرح عند إتمام أي بيع، وأقسم بالله على صحة المعلومات.
                  </Text>
                </Pressable>

                <View style={{ height: 16 }} />
              </ScrollView>

              {/* Buttons */}
              <View style={styles.modalBtns}>
                <Pressable
                  style={[styles.modalConfirmBtn, !pledgeChecked && styles.modalConfirmBtnDisabled]}
                  onPress={handlePledgeConfirm}
                  disabled={!pledgeChecked}
                >
                  <LinearGradient
                    colors={pledgeChecked ? gradients.royal : [colors.bgSurface, colors.bgSurface]}
                    style={styles.modalConfirmGradient}
                  >
                    <AppIcon
                      name="shield-check"
                      size={18}
                      color={pledgeChecked ? '#FFFFFF' : colors.textMuted}
                    />
                    <Text style={[styles.modalConfirmText, !pledgeChecked && { color: colors.textMuted }]}>
                      أوافق وأتابع النشر
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Pressable style={styles.modalCancelBtn} onPress={() => setShowPledge(false)}>
                  <Text style={styles.modalCancelText}>إلغاء</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    flexShrink: 0,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  stepBarWrap: {
    flexShrink: 0,
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  stepBarScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  stepBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.electric, borderColor: colors.electric },
  stepNum: { ...typography.micro, color: colors.textMuted },
  stepLabel: { ...typography.micro, color: colors.textMuted, marginStart: 4, maxWidth: 56 },
  stepLabelActive: { color: colors.textBrandStrong, fontWeight: '600' },
  stepLine: { width: 20, height: 1, backgroundColor: colors.borderSoft, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: colors.electric },
  scrollView: { flex: 1, flexShrink: 1 },
  scroll: {
    paddingBottom: spacing.lg,
    ...(Platform.OS === 'web' ? { flexGrow: 0 } : {}),
  },
  stepContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  stepTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'right' },
  stepSubtitle: { ...typography.body, color: colors.textMuted, textAlign: 'right', marginBottom: spacing.xs },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CAT_GAP },
  catCard: {
    width: CAT_CARD_SIZE,
    height: CAT_CARD_SIZE,
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    position: 'relative',
  },
  catCardActive: { borderColor: colors.electric, backgroundColor: `${colors.electric}15` },
  catIcon: { fontSize: 24 },
  catLabel: { ...typography.micro, color: colors.textMuted, textAlign: 'center' },
  catLabelActive: { color: colors.textBrandStrong },
  catCheck: { position: 'absolute', top: 4, right: 4 },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  input: {
    flex: 1, ...typography.body, color: colors.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  currencyLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  fieldHint: { ...typography.micro, color: colors.gold },
  mapHint: { ...typography.micro, color: colors.textMuted, textAlign: 'right' },
  row: { flexDirection: 'row', gap: spacing.md },
  imageGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  imageThumbWrap: {
    width: 88, height: 88, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderSoft,
  },
  imageThumb: { width: '100%', height: '100%' },
  imageRemove: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: 'rgba(6,9,26,0.6)', borderRadius: 11,
  },
  imageAddBtn: {
    width: 88, height: 88, borderRadius: radius.lg,
    backgroundColor: colors.bgSurface, borderWidth: 1,
    borderColor: colors.borderSoft, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  imagePickerText: { ...typography.caption, color: colors.textMuted },
  imagePickerSub: { ...typography.micro, color: colors.textSubtle, textAlign: 'right' },
  countryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  countryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.pill, backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  countryChipActive: { borderColor: colors.electric, backgroundColor: `${colors.electric}15` },
  countryFlag: { fontSize: 16 },
  countryLabel: { ...typography.caption, color: colors.textMuted },
  featuredToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.lg, backgroundColor: colors.bgSurface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.gold}40`,
  },
  featuredInfo: { gap: 2 },
  featuredTitle: { ...typography.bodyStrong, color: colors.gold },
  featuredSub: { ...typography.caption, color: colors.textMuted },
  toggle: {
    width: 44, height: 24, borderRadius: 12,
    backgroundColor: colors.bgElevated, justifyContent: 'center',
    paddingHorizontal: 2, borderWidth: 1, borderColor: colors.borderSoft,
  },
  toggleOn: { backgroundColor: colors.electric, borderColor: colors.electric },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textMuted },
  toggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },
  reviewCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft, overflow: 'hidden',
  },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  reviewLabel: { ...typography.caption, color: colors.textMuted },
  reviewValue: { ...typography.bodyStrong, color: colors.textPrimary, textAlign: 'right' },
  termsBox: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    padding: spacing.md, backgroundColor: `${colors.electric}10`,
    borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.electric}20`,
  },
  termsText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 18, textAlign: 'right' },
  bottomBar: {
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bgDeep,
  },
  continueBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnInner: {
    paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.xl,
  },
  continueBtnText: { ...typography.h3, color: '#fff' },

  // Commission preview
  commissionBox: {
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: `${colors.electric}08`,
    borderWidth: 1, borderColor: `${colors.electric}25`,
    gap: spacing.sm,
  },
  commissionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commissionIcon: { fontSize: 16 },
  commissionTitle: { ...typography.caption, color: colors.textBrandStrong, fontWeight: '700' },
  commissionDetails: { gap: spacing.sm },
  commissionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  commissionHighlight: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    backgroundColor: `${colors.electric}12`, borderRadius: radius.md,
    marginTop: 2,
  },
  commissionLabel: { ...typography.caption, color: colors.textMuted },
  commissionValue: { ...typography.caption, color: colors.textSecondary, textAlign: 'right' },
  commissionLabelBig: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  commissionAmountBig: { fontSize: 20, fontWeight: '800', color: colors.gold },
  commissionNote: { ...typography.micro, color: colors.textSubtle, textAlign: 'right', lineHeight: 16 },

  // ─── Pledge Modal Styles ───────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(5,10,18,0.68)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft,
    maxHeight: '94%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.electric,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  pledgeHeaderIcon: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalHeaderText: { flex: 1, alignItems: 'flex-end' },
  modalTitle: { ...typography.h3, color: '#fff', fontWeight: '800' },
  modalSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  modalScroll: { paddingHorizontal: spacing.lg },
  modalScrollContent: { paddingBottom: spacing.md },
  pledgeIntro: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    padding: spacing.md, marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: `${colors.electric}0D`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.electric}35`,
  },
  pledgeIntroText: {
    flex: 1, ...typography.caption, color: colors.textSecondary,
    lineHeight: 20, textAlign: 'right',
  },
  pledgeCard: {
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft,
    padding: spacing.lg, marginTop: spacing.md, gap: spacing.md,
  },
  pledgeCardGold: {
    backgroundColor: `${colors.gold}08`,
    borderColor: `${colors.gold}40`,
  },
  pledgeCardBlue: {
    backgroundColor: `${colors.electric}08`,
    borderColor: `${colors.electric}40`,
  },
  pledgeSectionTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  pledgeSectionIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.electric}12`,
  },
  pledgeSectionIconGold: { backgroundColor: `${colors.gold}14` },
  pledgeSectionIconBlue: { backgroundColor: `${colors.electricBright}12` },
  pledgeCardTitle: { ...typography.bodyStrong, color: colors.textBrandStrong, textAlign: 'right' },
  pledgeCardTitleGold: { ...typography.bodyStrong, color: colors.gold, textAlign: 'right' },
  pledgeCardTitleBlue: { ...typography.bodyStrong, color: colors.textBrand, textAlign: 'right' },
  pledgeItemRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
  },
  pledgeItemNumber: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.electric}12`, flexShrink: 0,
  },
  pledgeItemNumberText: {
    ...typography.micro, color: colors.textBrandStrong, fontWeight: '800',
  },
  pledgeItem: {
    flex: 1, ...typography.body, color: colors.textSecondary,
    lineHeight: 24, textAlign: 'right',
  },
  pledgeBodyText: { ...typography.body, color: colors.textSecondary, lineHeight: 22, textAlign: 'right' },
  commRateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: `${colors.gold}20`,
  },
  commRateLabel: { ...typography.body, color: colors.textSecondary, textAlign: 'right' },
  commRateValue: { ...typography.bodyStrong, color: colors.gold },
  commDueNote: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: spacing.sm },
  commDueBold: { color: colors.rose, fontWeight: '700' },
  pledgeOath: {
    ...typography.body, color: colors.textPrimary,
    lineHeight: 27, textAlign: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.borderSoft,
    padding: spacing.md, marginTop: spacing.md,
  },
  checkboxRowActive: { borderColor: colors.electric, backgroundColor: `${colors.electric}0D` },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: colors.borderMid,
    backgroundColor: colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.electric, borderColor: colors.electric },
  checkboxText: { flex: 1, ...typography.body, color: colors.textSecondary, lineHeight: 22, textAlign: 'right' },
  modalBtns: {
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
    backgroundColor: colors.bgPrimary,
  },
  modalConfirmBtn: {
    flex: 2, borderRadius: radius.xl, overflow: 'hidden',
  },
  modalConfirmGradient: {
    minHeight: 52, paddingHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderRadius: radius.xl,
  },
  modalConfirmBtnDisabled: { opacity: 0.65 },
  modalConfirmText: { ...typography.bodyStrong, color: '#fff' },
  modalCancelBtn: {
    flex: 1, backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    paddingVertical: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  modalCancelText: { ...typography.bodyStrong, color: colors.textSecondary },
  });
}
