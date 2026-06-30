// Powered by OnSpace.AI
// SAFAT — Butcher Registration & Verification Screen (تسجيل الملحمة)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';
import { Country, gccCurrencies } from '@/services/butcherData';
import { countries } from '@/services/types';
import { ButcherLocationPicker } from '@/components/feature/ButcherLocationPicker';
import { hasValidCoords, formatCoords } from '@/lib/butcherLocation';

type Step = 'type' | 'info' | 'verification' | 'location' | 'subscription' | 'success';
type ButcherTypeChoice = 'regular' | 'verified';

const STEPS = ['type', 'info', 'verification', 'location', 'subscription'];

const SUPPORTED_COUNTRIES = (Object.keys(countries) as Country[]).map((code) => ({
  code,
  ar: countries[code].ar,
  flag: countries[code].flag,
}));

// ─── Step indicators ──────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <View style={sb.wrap}>
      {STEPS.map((_, i) => (
        <View key={i} style={[sb.dot, i <= current && sb.dotActive]}>
          {i < current ? (
            <Ionicons name="checkmark" size={10} color="#fff" />
          ) : (
            <Text style={sb.dotNum}>{i + 1}</Text>
          )}
        </View>
      ))}
      {/* connector lines */}
      {STEPS.slice(0, -1).map((_, i) => (
        <View
          key={`line-${i}`}
          style={[sb.line, i < current && sb.lineActive, { left: 16 + i * 52 }]}
        />
      ))}
    </View>
  );
}

// ─── Step 1: Type Choice ──────────────────────────────────────────────────────
function StepType({ onSelect }: { onSelect: (t: ButcherTypeChoice) => void }) {
  return (
    <View style={f.wrap}>
      <Text style={f.heading}>اختر نوع ملحمتك</Text>
      <Text style={f.sub}>حدد خيارك وابدأ رحلتك في سوق صفاة للملاحم</Text>

      {/* Regular */}
      <Pressable
        style={({ pressed }) => [tc.card, pressed && { opacity: 0.9 }]}
        onPress={() => onSelect('regular')}
      >
        <View style={tc.iconWrap}>
          <Text style={tc.icon}>🥩</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={tc.title}>جزار عادي</Text>
          <Text style={tc.desc}>بدون رسوم شهرية · عمولة على كل طلب مكتمل فقط</Text>
        </View>
        <View style={tc.commBadge}>
          <Text style={tc.commText}>عمولة</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>

      {/* Verified */}
      <Pressable
        style={({ pressed }) => [tc.card, tc.cardVerified, pressed && { opacity: 0.9 }]}
        onPress={() => onSelect('verified')}
      >
        <LinearGradient
          colors={[colors.gold + '22', colors.amber + '11']}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[colors.gold, '#F59E0B']}
          style={tc.iconWrapGold}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="shield-checkmark" size={22} color="#1A1300" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <View style={tc.titleRow}>
            <Text style={tc.title}>جزار موثّق</Text>
            <View style={tc.popularBadge}>
              <Text style={tc.popularText}>الأشهر</Text>
            </View>
          </View>
          <Text style={tc.desc}>٢٩٩ ريال/شهر · ظهور أولوي · شارة التوثيق · تحليلات</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gold} />
      </Pressable>

      {/* Comparison */}
      <View style={tc.compareCard}>
        <Text style={tc.compareTitle}>مقارنة سريعة</Text>
        {[
          { feature: 'بدون رسوم شهرية',      regular: true,  verified: false },
          { feature: 'شارة التوثيق',           regular: false, verified: true  },
          { feature: 'أولوية في البحث',        regular: false, verified: true  },
          { feature: 'نشر القصص اليومية',     regular: false, verified: true  },
          { feature: 'لوحة التحليلات',         regular: false, verified: true  },
          { feature: 'دعم ذو أولوية',          regular: false, verified: true  },
          { feature: 'عمولة على الطلبات',      regular: true,  verified: false },
        ].map((row, i) => (
          <View key={i} style={tc.compareRow}>
            <Text style={tc.compareFeature}>{row.feature}</Text>
            <View style={tc.compareIcons}>
              <Ionicons
                name={row.regular ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={row.regular ? colors.success : colors.textSubtle}
              />
              <Ionicons
                name={row.verified ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={row.verified ? colors.gold : colors.textSubtle}
              />
            </View>
          </View>
        ))}
        <View style={tc.compareHeader}>
          <Text style={tc.compareHeaderLabel}>الميزة</Text>
          <View style={tc.compareIcons}>
            <Text style={tc.compareHeaderCol}>عادي</Text>
            <Text style={[tc.compareHeaderCol, { color: colors.gold }]}>موثّق</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Step 2: Basic Info ───────────────────────────────────────────────────────
function StepInfo({
  form, setForm, onNext, onPhoneChange, onCountryChange,
}: {
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  onNext: () => void;
  onPhoneChange: (phone: string) => void;
  onCountryChange: (country: Country) => void;
}) {
  const set = (key: string, val: string) => setForm({ ...form, [key]: val });
  const phoneCode = countries[(form.country as Country) ?? 'SA'].phoneCode;

  return (
    <View style={f.wrap}>
      <Text style={f.heading}>معلومات الملحمة</Text>
      <Text style={f.sub}>أدخل بيانات ملحمتك الأساسية</Text>

      <FormField label="اسم الملحمة بالعربي" value={form.nameAr} onChange={(v) => set('nameAr', v)} placeholder="مثال: ملحمة الطازج الذهبي" />
      <FormField label="اسم الملحمة بالإنجليزي" value={form.nameEn} onChange={(v) => set('nameEn', v)} placeholder="e.g. Al-Tazej Premium Butcher" />
      <FormField label="البريد الإلكتروني" value={form.email} onChange={(v) => set('email', v)} placeholder="butcher@example.com" keyboardType="email-address" />

      {/* Country selector */}
      <Text style={fi.label}>البلد</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.sm }}>
          {SUPPORTED_COUNTRIES.map((c) => (
            <Pressable
              key={c.code}
              onPress={() => onCountryChange(c.code)}
              style={[fi.countryBtn, form.country === c.code && fi.countryBtnActive]}
            >
              <Text style={fi.countryFlag}>{c.flag}</Text>
              <Text style={[fi.countryLabel, form.country === c.code && fi.countryLabelActive]}>
                {c.ar}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Text style={fi.label}>رقم الهاتف</Text>
      <View style={fi.phoneRow}>
        <View style={fi.phoneCodePill}>
          <Text style={fi.phoneCodeText}>{phoneCode}</Text>
        </View>
        <TextInput
          style={[fi.input, fi.phoneInput]}
          placeholder="5X XXX XXXX"
          placeholderTextColor={colors.textSubtle}
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={onPhoneChange}
          textAlign="right"
        />
      </View>
      <Text style={fi.helpText}>سيتم استخدام كود الدولة المختار تلقائياً عند إرسال OTP</Text>

      <FormField label="المدينة" value={form.city} onChange={(v) => set('city', v)} placeholder="مثال: الرياض" />
      <FormField label="العنوان التفصيلي" value={form.address} onChange={(v) => set('address', v)} placeholder="الحي، الشارع، رقم المبنى" multiline />

      <Pressable
        style={({ pressed }) => [f.nextBtn, pressed && { opacity: 0.88 }]}
        onPress={onNext}
      >
        <LinearGradient colors={[colors.electric, colors.cyan]} style={f.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={f.nextBtnText}>التالي</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Step 3: Verification Docs ────────────────────────────────────────────────
function StepVerification({
  form, setForm, butcherType, onNext, phoneDisplay, otp, setOtp,
  otpSent, otpVerified, otpBusy, otpError, onSendOtp, onVerifyOtp,
}: {
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  butcherType: ButcherTypeChoice;
  onNext: () => void;
  phoneDisplay: string;
  otp: string;
  setOtp: (value: string) => void;
  otpSent: boolean;
  otpVerified: boolean;
  otpBusy: boolean;
  otpError: string;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
}) {
  const set = (key: string, val: string) => setForm({ ...form, [key]: val });

  return (
    <View style={f.wrap}>
      <Text style={f.heading}>التحقق والتوثيق</Text>
      <Text style={f.sub}>
        {butcherType === 'verified'
          ? 'مطلوب لتفعيل الحساب الموثّق'
          : 'أدخل بياناتك للتسجيل'}
      </Text>

      <FormField label="اسم المالك الكامل" value={form.ownerName} onChange={(v) => set('ownerName', v)} placeholder="الاسم الثلاثي" />

      {butcherType === 'verified' && (
        <>
          <FormField label="رقم السجل التجاري" value={form.crNumber} onChange={(v) => set('crNumber', v)} placeholder="1010XXXXXX" keyboardType="numeric" />

          {/* CR Upload */}
          <Text style={fi.label}>صورة السجل التجاري</Text>
          <Pressable style={vf.uploadBox}>
            <MaterialCommunityIcons name="cloud-upload-outline" size={32} color={colors.electricBright} />
            <Text style={vf.uploadTitle}>ارفع صورة السجل التجاري</Text>
            <Text style={vf.uploadSub}>JPG أو PNG · حتى 10MB</Text>
          </Pressable>
        </>
      )}

      {/* OTP Verification */}
      <Text style={fi.label}>التحقق من رقم الهاتف</Text>
      <Text style={vf.phoneHint}>{phoneDisplay}</Text>
      <View style={vf.otpRow}>
        <TextInput
          style={[fi.input, { flex: 1, letterSpacing: 8, textAlign: 'center' }]}
          placeholder="- - - - - -"
          placeholderTextColor={colors.textSubtle}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          editable={otpSent}
        />
        <Pressable
          style={[vf.otpBtn, otpSent && vf.otpBtnSent, otpBusy && { opacity: 0.7 }]}
          onPress={onSendOtp}
          disabled={otpBusy}
        >
          {otpBusy ? (
            <ActivityIndicator size="small" color={colors.electricBright} />
          ) : (
            <Text style={vf.otpBtnText}>{otpSent ? 'إعادة إرسال' : 'إرسال OTP'}</Text>
          )}
        </Pressable>
      </View>
      {!!otpError && <Text style={vf.errorText}>{otpError}</Text>}
      {otpSent && !otpVerified && (
        <Pressable
          style={vf.verifyOtpBtn}
          onPress={onVerifyOtp}
          disabled={otpBusy}
        >
          {otpBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={vf.verifyOtpText}>تحقق من الرمز</Text>
          )}
        </Pressable>
      )}
      {otpVerified && (
        <View style={vf.verifiedRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={vf.verifiedLabel}>تم التحقق من رقم الهاتف</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [f.nextBtn, pressed && { opacity: 0.88 }, !otpVerified && { opacity: 0.55 }]}
        onPress={() => {
          if (!otpVerified) {
            Alert.alert('تنبيه', 'أكمل التحقق من رقم الهاتف أولاً');
            return;
          }
          onNext();
        }}
      >
        <LinearGradient colors={[colors.electric, colors.cyan]} style={f.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={f.nextBtnText}>التالي</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Step 4: Location ─────────────────────────────────────────────────────────
function StepLocation({ form, setForm, onNext }: {
  form: Record<string, string>;
  setForm: (f: Record<string, string>) => void;
  onNext: () => void;
}) {
  const lat = form.lat ? parseFloat(form.lat) : null;
  const lng = form.lng ? parseFloat(form.lng) : null;
  const locationSet = hasValidCoords(lat, lng);

  const handleNext = () => {
    if (!locationSet) {
      Alert.alert('الموقع مطلوب', 'حدّد موقع الملحمة على الخريطة أو استخدم GPS');
      return;
    }
    onNext();
  };

  return (
    <View style={f.wrap}>
      <Text style={f.heading}>تثبيت الموقع</Text>
      <Text style={f.sub}>حدد موقع ملحمتك بدقة — سيظهر للعملاء على الخريطة</Text>

      <ButcherLocationPicker
        country={(form.country as Country) ?? 'SA'}
        lat={lat}
        lng={lng}
        onChange={({ lat: newLat, lng: newLng }) => {
          setForm({ ...form, lat: String(newLat), lng: String(newLng) });
        }}
        height={280}
      />

      {locationSet && (
        <View style={loc.confirmedBox}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={loc.confirmedText}>
            {form.city ? `${form.city} · ` : ''}{formatCoords(lat!, lng!)}
          </Text>
        </View>
      )}

      {/* Working hours */}
      <Text style={fi.label}>ساعات العمل</Text>
      <View style={loc.hoursRow}>
        <View style={loc.hourInput}>
          <Text style={loc.hourLabel}>الافتتاح</Text>
          <TextInput
            style={fi.input}
            placeholder="05:00"
            placeholderTextColor={colors.textSubtle}
            value={form.openTime}
            onChangeText={(v) => setForm({ ...form, openTime: v })}
          />
        </View>
        <Ionicons name="arrow-forward" size={18} color={colors.textMuted} style={{ marginTop: 28 }} />
        <View style={loc.hourInput}>
          <Text style={loc.hourLabel}>الإغلاق</Text>
          <TextInput
            style={fi.input}
            placeholder="22:00"
            placeholderTextColor={colors.textSubtle}
            value={form.closeTime}
            onChangeText={(v) => setForm({ ...form, closeTime: v })}
          />
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [f.nextBtn, pressed && { opacity: 0.88 }, !locationSet && { opacity: 0.55 }]}
        onPress={handleNext}
      >
        <LinearGradient colors={[colors.electric, colors.cyan]} style={f.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={f.nextBtnText}>التالي</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Step 5: Subscription ─────────────────────────────────────────────────────
function StepSubscription({
  butcherType, country, onFinish, loading,
}: {
  butcherType: ButcherTypeChoice;
  country: Country;
  onFinish: () => void;
  loading?: boolean;
}) {
  const currency = gccCurrencies[country] ?? gccCurrencies['SA'];
  const PRICE_MAP: Record<Country, number> = {
    SA: 299, AE: 309, KW: 89, QA: 309, BH: 109, OM: 109,
  };
  const price = PRICE_MAP[country] ?? 299;

  if (butcherType === 'regular') {
    return (
      <View style={f.wrap}>
        <Text style={f.heading}>التسجيل مجاني!</Text>
        <Text style={f.sub}>ستدفع عمولة بسيطة فقط على كل طلب مكتمل</Text>
        <View style={sub.commCard}>
          <LinearGradient colors={[colors.bgElevated, colors.bgSurface]} style={StyleSheet.absoluteFill} />
          <Text style={sub.commIcon}>🤝</Text>
          <Text style={sub.commTitle}>نموذج العمولة</Text>
          <Text style={sub.commDesc}>
            لا رسوم شهرية ثابتة. ندفع معاً فقط عند نجاح الطلب.
            العمولة تشمل: معالجة الدفع، الدعم الفني، والظهور في المنصة.
          </Text>
          <View style={sub.commRow}>
            <Text style={sub.commLabel}>نسبة العمولة</Text>
            <Text style={sub.commValue}>٨–١٢٪ لكل طلب</Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [f.nextBtn, pressed && { opacity: 0.88 }]} onPress={onFinish} disabled={loading}>
          <LinearGradient colors={[colors.success, '#059669']} style={f.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={f.nextBtnText}>إنشاء الحساب مجاناً</Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={f.wrap}>
      <Text style={f.heading}>اشتراك الجزار الموثّق</Text>
      <Text style={f.sub}>احصل على شارة التوثيق وكل مميزات المنصة</Text>

      {/* Plan card */}
      <LinearGradient colors={[colors.gold + '33', colors.amber + '11']} style={sub.planCard}>
        <LinearGradient colors={[colors.gold, '#F59E0B']} style={sub.planBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="shield-checkmark" size={14} color="#1A1300" />
          <Text style={sub.planBadgeText}>جزار موثّق</Text>
        </LinearGradient>

        <View style={sub.planPriceRow}>
          <Text style={sub.planPrice}>{price}</Text>
          <View>
            <Text style={sub.planCurrency}>{currency.symbol}</Text>
            <Text style={sub.planPer}>/شهر</Text>
          </View>
        </View>
        <Text style={sub.planRenew}>يتجدد تلقائياً · يمكن الإلغاء في أي وقت</Text>

        <View style={sub.featuresList}>
          {[
            'شارة التوثيق الذهبية على ملفك',
            'أولوية الظهور في نتائج البحث',
            'نشر القصص اليومية (ذبح، عروض، مخزون)',
            'لوحة التحليلات (طلبات، مشاهدات، مبيعات)',
            'دعم ذو أولوية قصوى',
            'ظهور أولوي في خريطة الملاحم',
            'تجديد تلقائي مع إشعار قبل ٧ أيام',
          ].map((feat, i) => (
            <View key={i} style={sub.featRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
              <Text style={sub.featText}>{feat}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Payment methods */}
      <View style={sub.payStrip}>
        <MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />
        <Text style={sub.payStripText}>
          دفع آمن عبر{' '}
          <Text style={{ color: colors.glow, fontWeight: '700' }}>Network International</Text>
          {' '}· مدى · فيزا · آبل باي · STC Pay
        </Text>
      </View>

      <Pressable style={({ pressed }) => [f.nextBtn, pressed && { opacity: 0.88 }]} onPress={onFinish} disabled={loading}>
        <LinearGradient colors={[colors.gold, '#F59E0B']} style={f.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          {loading ? (
            <ActivityIndicator color="#1A1300" />
          ) : (
            <Text style={[f.nextBtnText, { color: '#1A1300' }]}>
              الدفع وتفعيل الحساب · {price} {currency.symbol}
            </Text>
          )}
        </LinearGradient>
      </Pressable>

      <Text style={sub.termsNote}>
        بالمتابعة توافق على شروط خدمة صفاة للملاحم وسياسة الخصوصية
      </Text>
    </View>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────
function StepSuccess({ butcherType, router }: { butcherType: ButcherTypeChoice; router: any }) {
  return (
    <View style={suc.wrap}>
      <Text style={suc.icon}>{butcherType === 'verified' ? '🏅' : '✅'}</Text>
      <Text style={suc.title}>
        {butcherType === 'verified' ? 'مبروك! ملحمتك موثّقة' : 'تم التسجيل بنجاح!'}
      </Text>
      <Text style={suc.sub}>
        {butcherType === 'verified'
          ? 'ظهر حسابك بشارة التوثيق الذهبية وأولوية البحث في جميع دول الخليج'
          : 'تم إنشاء حسابك. ابدأ باضافة منتجاتك واستقبال الطلبات'}
      </Text>

      {butcherType === 'verified' && (
        <View style={suc.verifiedCard}>
          <LinearGradient colors={[colors.gold + '33', colors.amber + '11']} style={StyleSheet.absoluteFill} />
          <Ionicons name="shield-checkmark" size={32} color={colors.gold} />
          <View>
            <Text style={suc.verifiedLabel}>شارة التوثيق نشطة</Text>
            <Text style={suc.verifiedSub}>صالحة لمدة ٣٠ يوماً · تجديد تلقائي</Text>
          </View>
        </View>
      )}

      <Pressable
        style={suc.dashBtn}
        onPress={() => router.replace('/butchers')}
      >
        <LinearGradient colors={[colors.electric, colors.cyan]} style={suc.dashBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="storefront-outline" size={20} color="#fff" />
          <Text style={suc.dashBtnText}>عرض ملحمتي في السوق</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={suc.addProductBtn}
        onPress={() => router.push('/butchers/manage')}
      >
        <Text style={suc.addProductText}>+ إضافة أول منتج</Text>
      </Pressable>
    </View>
  );
}

// ─── Shared form components ───────────────────────────────────────────────────
function FormField({
  label, value, onChange, placeholder, keyboardType, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <View style={fi.fieldWrap}>
      <Text style={fi.label}>{label}</Text>
      <TextInput
        style={[fi.input, multiline && fi.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        textAlign="right"
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ButcherRegisterScreen() {
  const router = useRouter();
  const { accessToken, refreshSession, switchMode, sendOtp, verifyOtp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('type');
  const [butcherType, setButcherType] = useState<ButcherTypeChoice>('regular');
  const [form, setForm] = useState<Record<string, string>>({
    nameAr: '', nameEn: '', phone: '', email: '',
    country: 'SA', city: '', address: '',
    ownerName: '', crNumber: '',
    openTime: '06:00', closeTime: '22:00', lat: '', lng: '',
  });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState('');

  const selectedCountry = (form.country as Country) ?? 'SA';
  const phoneCode = countries[selectedCountry].phoneCode;
  const cleanPhoneDigits = form.phone
    .trim()
    .replace(/\s+/g, '')
    .replace(/^\+/, '')
    .replace(new RegExp(`^(?:${phoneCode.replace('+', '')}|00${phoneCode.replace('+', '')})`), '')
    .replace(/^0/, '');
  const fullPhone = `${phoneCode}${cleanPhoneDigits}`;
  const isPhoneValid = cleanPhoneDigits.replace(/\D/g, '').length >= 8;

  const STEP_INDEX: Record<Step, number> = {
    type: 0, info: 1, verification: 2, location: 3, subscription: 4, success: 4,
  };

  const goNext = () => {
    const order: Step[] = ['type', 'info', 'verification', 'location', 'subscription', 'success'];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };

  const handleTypeSelect = (t: ButcherTypeChoice) => {
    setButcherType(t);
    setStep('info');
  };

  const resetPhoneVerification = () => {
    setOtp('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpError('');
  };

  const handlePhoneChange = (phone: string) => {
    setForm((prev) => ({ ...prev, phone }));
    resetPhoneVerification();
  };

  const handleCountryChange = (country: Country) => {
    setForm((prev) => ({ ...prev, country }));
    resetPhoneVerification();
  };

  const handleSendOtp = async () => {
    if (!isPhoneValid) {
      setOtpError('أدخل رقم هاتف صحيحاً قبل إرسال رمز التحقق');
      return;
    }

    setOtpBusy(true);
    setOtpError('');
    const result = await sendOtp(fullPhone, 'sms');
    setOtpBusy(false);

    if (!result.success) {
      setOtpError(result.error ?? 'فشل إرسال رمز التحقق');
      return;
    }

    setOtpSent(true);
    Alert.alert('تم الإرسال', result.devMode ? 'وضع التطوير: استخدم الكود 123456' : 'تم إرسال رمز التحقق إلى رقم الهاتف');
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setOtpError('أدخل رمز التحقق المكوّن من 6 أرقام');
      return;
    }

    setOtpBusy(true);
    setOtpError('');
    const result = await verifyOtp(fullPhone, otp);
    setOtpBusy(false);

    if (!result.success) {
      setOtpVerified(false);
      setOtpError(result.error ?? 'رمز التحقق غير صحيح');
      return;
    }

    setOtpVerified(true);
  };

  const handleRegisterSubmit = async () => {
    if (loading) return;
    if (!otpVerified) {
      Alert.alert('تنبيه', 'يلزم التحقق من رقم الهاتف قبل تسجيل الملحمة');
      setStep('verification');
      return;
    }
    if (!hasValidCoords(form.lat ? parseFloat(form.lat) : null, form.lng ? parseFloat(form.lng) : null)) {
      Alert.alert('الموقع مطلوب', 'ارجع لخطوة الموقع وحدّد موقع الملحمة');
      setStep('location');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        nameAr: form.nameAr || 'ملحمة غير مسمى',
        nameEn: form.nameEn || 'Unnamed Butcher',
        country: form.country,
        city: form.city || 'الرياض',
        cityAr: form.city || 'الرياض',
        address: form.address || 'حي العليا',
        addressAr: form.address || 'حي العليا',
        phone: fullPhone,
        type: butcherType,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
      };

      const res = await fetch(`${API_BASE}/api/butchers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        await refreshSession().catch(() => {});
        switchMode('BUTCHER');
        setStep('success');
      } else {
        const errorMsg = data.messageAr || data.message || 'حدث خطأ أثناء حفظ البيانات';
        Alert.alert('خطأ', errorMsg);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('خطأ', 'تعذر الاتصال بالخادم. يرجى التحقق من الشبكة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        {step !== 'type' && step !== 'success' && (
          <Pressable
            hitSlop={12}
            onPress={() => {
              const order: Step[] = ['type', 'info', 'verification', 'location', 'subscription'];
              const idx = order.indexOf(step);
              if (idx > 0) setStep(order[idx - 1]);
            }}
            style={s.backBtn}
          >
            <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
        )}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>سجّل ملحمتك</Text>
          <Text style={s.headerSub}>Register Your Butcher Shop</Text>
        </View>
        {step !== 'type' && step !== 'success' ? (
          <View style={{ width: 40 }} />
        ) : (
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Step bar */}
      {step !== 'success' && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <StepBar current={STEP_INDEX[step]} />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {step === 'type'         && <StepType onSelect={handleTypeSelect} />}
        {step === 'info'         && (
          <StepInfo
            form={form}
            setForm={setForm}
            onNext={goNext}
            onPhoneChange={handlePhoneChange}
            onCountryChange={handleCountryChange}
          />
        )}
        {step === 'verification' && (
          <StepVerification
            form={form}
            setForm={setForm}
            butcherType={butcherType}
            onNext={goNext}
            phoneDisplay={fullPhone}
            otp={otp}
            setOtp={setOtp}
            otpSent={otpSent}
            otpVerified={otpVerified}
            otpBusy={otpBusy}
            otpError={otpError}
            onSendOtp={handleSendOtp}
            onVerifyOtp={handleVerifyOtp}
          />
        )}
        {step === 'location'     && <StepLocation form={form} setForm={setForm} onNext={goNext} />}
        {step === 'subscription' && <StepSubscription butcherType={butcherType} country={(form.country as Country) ?? 'SA'} onFinish={handleRegisterSubmit} loading={loading} />}
        {step === 'success'      && <StepSuccess butcherType={butcherType} router={router} />}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { paddingHorizontal: spacing.lg },
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
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.glow, marginTop: 1 },
});

const sb = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    position: 'relative',
    height: 36,
  },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
    marginHorizontal: 12,
  },
  dotActive: {
    backgroundColor: colors.electric,
    borderColor: colors.electric,
  },
  dotNum: { ...typography.micro, color: colors.textMuted },
  line: {
    position: 'absolute',
    top: 13,
    width: 24,
    height: 2,
    backgroundColor: colors.borderSoft,
    zIndex: 1,
  },
  lineActive: { backgroundColor: colors.electric },
});

const f = StyleSheet.create({
  wrap: { paddingBottom: spacing.xl },
  heading: { ...typography.h2, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  sub: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  nextBtn: { marginTop: spacing.xl, borderRadius: radius.xl, overflow: 'hidden' },
  nextBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  nextBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 16 },
});

// Type step
const tc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  cardVerified: { borderColor: colors.gold + '66' },
  iconWrap: {
    width: 52, height: 52, borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapGold: {
    width: 52, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 26 },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  desc: { ...typography.caption, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  commBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.electricBright + '22',
    borderWidth: 1, borderColor: colors.electricBright + '44',
  },
  commText: { ...typography.micro, color: colors.electricBright },
  popularBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  popularText: { ...typography.micro, color: '#1A1300', fontWeight: '700' },

  compareCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  compareTitle: { ...typography.bodyStrong, color: colors.textPrimary, marginBottom: spacing.md },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  compareFeature: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  compareIcons: { flexDirection: 'row', gap: 20, width: 64 },
  compareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  compareHeaderLabel: { ...typography.micro, color: colors.textSubtle, flex: 1 },
  compareHeaderCol: { ...typography.micro, color: colors.textMuted, width: 32, textAlign: 'center' },
});

// Form inputs
const fi = StyleSheet.create({
  fieldWrap: { marginBottom: spacing.lg },
  label: { ...typography.caption, color: colors.textSecondary, marginBottom: 6, textAlign: 'right', fontWeight: '600' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  phoneCodePill: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  phoneCodeText: { ...typography.bodyStrong, color: colors.electricBright },
  phoneInput: { flex: 1 },
  helpText: { ...typography.micro, color: colors.textSubtle, marginBottom: spacing.lg, textAlign: 'right' },
  input: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    ...typography.body,
    color: colors.textPrimary,
  },
  inputMulti: { minHeight: 80, paddingTop: spacing.md },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  countryBtnActive: { borderColor: colors.electric, backgroundColor: colors.electric + '22' },
  countryFlag: { fontSize: 16 },
  countryLabel: { ...typography.caption, color: colors.textMuted },
  countryLabelActive: { color: colors.electricBright, fontWeight: '600' },
});

// Verification
const vf = StyleSheet.create({
  phoneHint: { ...typography.caption, color: colors.glow, marginBottom: spacing.sm, textAlign: 'right' },
  uploadBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.electricBright + '55',
    borderStyle: 'dashed',
    backgroundColor: colors.electric + '08',
    marginBottom: spacing.lg,
  },
  uploadTitle: { ...typography.bodyStrong, color: colors.electricBright },
  uploadSub: { ...typography.caption, color: colors.textMuted },
  otpRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  otpBtn: {
    paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: radius.xl,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.borderSoft,
    justifyContent: 'center',
  },
  otpBtnSent: { borderColor: colors.electricBright + '66' },
  otpBtnText: { ...typography.caption, color: colors.electricBright, fontWeight: '600' },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm, textAlign: 'right' },
  verifyOtpBtn: {
    paddingVertical: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.electric + '22',
    borderWidth: 1, borderColor: colors.electric + '55',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  verifyOtpText: { ...typography.bodyStrong, color: colors.electricBright },
  verifiedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success + '22',
    borderWidth: 1, borderColor: colors.success + '44',
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  verifiedLabel: { ...typography.caption, color: colors.success, fontWeight: '600' },
});

// Location
const loc = StyleSheet.create({
  mapBox: {
    height: 220,
    borderRadius: radius.xxl,
    borderWidth: 1.5,
    borderColor: colors.electricBright + '55',
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    position: 'relative',
  },
  mapTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  mapSub: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.electric,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.pill,
  },
  mapBtnText: { ...typography.caption, color: '#fff', fontWeight: '600' },
  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '44',
  },
  confirmedText: {
    flex: 1,
    ...typography.caption,
    color: colors.success,
    textAlign: 'right',
    fontWeight: '600',
  },
  hoursRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  hourInput: { flex: 1 },
  hourLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 6, textAlign: 'right', fontWeight: '600' },
});

// Subscription
const sub = StyleSheet.create({
  commCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.electricBright + '44',
    overflow: 'hidden',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    position: 'relative',
  },
  commIcon: { fontSize: 48 },
  commTitle: { ...typography.h3, color: colors.textPrimary },
  commDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  commRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%',
    backgroundColor: colors.electric + '22',
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  commLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  commValue: { ...typography.bodyStrong, color: colors.gold },

  planCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    overflow: 'hidden',
    padding: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  planBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  planBadgeText: { ...typography.caption, color: '#1A1300', fontWeight: '700' },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  planPrice: { fontSize: 52, fontWeight: '900', color: colors.gold, lineHeight: 58 },
  planCurrency: { ...typography.h3, color: colors.gold },
  planPer: { ...typography.caption, color: colors.textMuted },
  planRenew: { ...typography.caption, color: colors.textMuted },
  featuresList: { gap: 10 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  payStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  payStripText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 18 },
  termsNote: { ...typography.micro, color: colors.textSubtle, textAlign: 'center', marginTop: spacing.md, lineHeight: 17 },
});

// Success
const suc = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.lg },
  icon: { fontSize: 80 },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.md },
  verifiedCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.gold + '44',
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  verifiedLabel: { ...typography.bodyStrong, color: colors.gold },
  verifiedSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  dashBtn: { width: '100%', borderRadius: radius.xl, overflow: 'hidden' },
  dashBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  dashBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 16 },
  addProductBtn: {
    paddingVertical: 14, width: '100%', alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  addProductText: { ...typography.bodyStrong, color: colors.electricBright },
});
