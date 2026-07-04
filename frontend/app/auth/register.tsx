// Powered by OnSpace.AI
// SAFAT — Registration Screen (شاشة التسجيل المطابقة للتصميم الجديد بالكامل)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { AppLogo } from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';

const COUNTRY_CODES = [
  { flag: '🇸🇦', code: '+966', label: 'السعودية', dbCode: 'SA' },
  { flag: '🇪🇬', code: '+20', label: 'مصر', dbCode: 'EG' },
];

export default function RegisterScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const params = useLocalSearchParams<{
    phone?: string;
    token?: string;
    googleId?: string;
    email?: string;
    displayName?: string;
    avatar?: string;
    via_google?: string;
  }>();

  const { sendOtp, verifyOtp, register, signInWithGoogle } = useAuth();
  const { signIn: googleSignIn, isConfigured: googleConfigured } = useGoogleSignIn();

  // ── States ─────────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(params.displayName || '');
  const [username, setUsername]       = useState('');
  const [countryIdx, setCountryIdx]   = useState(0);
  const [showPicker, setShowPicker]   = useState(false);
  const [agreed, setAgreed]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // Password fields
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Phone states
  const [phone, setPhone]                 = useState(params.phone?.replace(/^\+\d{3}/, '') || '');
  const [emailInput, setEmailInput]       = useState(params.email || '');

  // OTP Verification states (within registration)
  const [otpSent, setOtpSent]         = useState(false);
  const [otpCode, setOtpCode]         = useState('');
  const [otpLoading, setOtpLoading]   = useState(false);
  const [otpError, setOtpError]       = useState('');
  const [phoneToken, setPhoneToken]   = useState(params.token || '');
  const [phoneVerified, setPhoneVerified] = useState(!!params.phone && !!params.token);

  const [googleId, setGoogleId]       = useState(params.googleId || '');
  const [avatar, setAvatar]           = useState(params.avatar || '');
  const [viaGoogle, setViaGoogle]     = useState(params.via_google === '1');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const currentCountry = COUNTRY_CODES[countryIdx];
  const cleanPhoneDigits = phone.trim()
    .replace(/^\+/, '')
    .replace(new RegExp(`^(?:${currentCountry.code.replace('+', '')}|00${currentCountry.code.replace('+', '')})`), '')
    .replace(/^0/, '');
  const fullPhone = `${currentCountry.code}${cleanPhoneDigits}`;
  const isPhoneValid = cleanPhoneDigits.replace(/\D/g, '').length >= 9;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const validateUsername = (v: string) => {
    setUsername(v);
    if (!v) { setUsernameError(''); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(v)) {
      setUsernameError('3-20 حرف: أرقام، حروف إنجليزية صغيرة، أو _');
    } else {
      setUsernameError('');
    }
  };

  // ── التحقق من شروط الإرسال ────────────────────────────────────────────────
  const canSendOtp = displayName.trim().length >= 2
    && username.trim().length >= 3
    && !usernameError
    && isPhoneValid
    && (viaGoogle || (password.length >= 6 && password === confirmPassword))
    && agreed
    && !loading;

  // ── إرسال كود OTP ────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!canSendOtp) {
      if (password !== confirmPassword) {
        Alert.alert('خطأ', 'كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      } else {
        Alert.alert('تنبيه', 'يرجى ملء جميع الحقول الإلزامية والموافقة على الشروط أولاً');
      }
      shake();
      return;
    }

    setOtpError('');
    setLoading(true);
    const result = await sendOtp(fullPhone, 'sms');
    setLoading(false);

    if (!result.success) {
      setOtpError(result.error ?? 'فشل إرسال رمز التحقق');
      shake();
      return;
    }
    setOtpSent(true);
  };

  // ── التحقق من الـ OTP وإنشاء الحساب ────────────────────────────────────────
  const handleVerifyAndRegister = async () => {
    setOtpError('');
    if (otpCode.length !== 6) { setOtpError('أدخل رمز الـ OTP المكون من 6 أرقام'); return; }

    setOtpLoading(true);
    const result = await verifyOtp(fullPhone, otpCode);

    if (!result.success) {
      setOtpLoading(false);
      setOtpError(result.error ?? 'رمز التحقق غير صحيح');
      shake();
      return;
    }

    if (!result.phoneToken) {
      setOtpLoading(false);
      setOtpError('فشل الحصول على رمز توثيق الجوال');
      return;
    }

    // تم التحقق من الجوال بنجاح! الآن ننشئ الحساب
    try {
      const regResult = await register({
        phone:        fullPhone,
        phone_token:  result.phoneToken,
        displayName:  displayName.trim(),
        username:     username.trim().toLowerCase(),
        country:      currentCountry.dbCode,
        // Google details if applicable
        googleId:    googleId || undefined,
        email:       emailInput.trim().toLowerCase() || undefined,
        avatar:      avatar || undefined,
        password:    viaGoogle ? undefined : password,
      });

      setOtpLoading(false);

      if (!regResult.success) {
        if (regResult.error?.includes('username_taken')) {
          setUsernameError('اسم المستخدم مأخوذ، جرّب آخر');
          setOtpSent(false); // تعديل البيانات
        } else {
          setOtpError(regResult.error ?? 'فشل إنشاء الحساب. حاول مجدداً.');
        }
        return;
      }

      router.replace('/(tabs)');
    } catch {
      setOtpLoading(false);
      setOtpError('خطأ في الشبكة أثناء إنشاء الحساب.');
    }
  };

  // ── Google Sign In (Registration Flow) ──────────────────────────────────
  const [googleLoading, setGoogleLoading] = useState(false);
  const handleGoogle = async () => {
    setOtpError('');
    if (!googleConfigured) {
      setOtpError('Google Sign In غير مفعّل في ملفات البيئة');
      return;
    }

    setGoogleLoading(true);
    try {
      const googleResult = await googleSignIn();
      if (!googleResult.ok) {
        setGoogleLoading(false);
        if (googleResult.cancelled) return;
        if (googleResult.error) {
          setOtpError(googleResult.error);
        }
        return;
      }

      const authResult = await signInWithGoogle(googleResult.idToken);
      setGoogleLoading(false);

      if (!authResult.success) {
        setOtpError(authResult.error ?? 'فشل الدخول بـ Google');
        return;
      }

      if (authResult.isNew) {
        setDisplayName(authResult.googleData?.displayName || '');
        setEmailInput(authResult.googleData?.email || '');
        // نقوم بتحديث الحالات لجوجل
        setGoogleId(authResult.googleData?.googleId || '');
        setAvatar(authResult.googleData?.avatar || '');
        setViaGoogle(true);
        return;
      }

      router.replace('/(tabs)');
    } catch {
      setGoogleLoading(false);
      setOtpError('فشل الاتصال بـ Google');
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          
          {/* Back button top right */}
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-forward" size={24} color="#ffffff" />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

            {/* Header section with Circular Logo */}
            <View style={styles.header}>
              <AppLogo size={90} />
              <Text style={styles.title}>انضم إلى الصفاة</Text>
              <Text style={styles.sub}>أنشئ حسابك كمستخدم جديد وابدأ تصفح السوق وشراء المواشي</Text>
            </View>

            {/* Main Form Card */}
            <View style={styles.card}>

              {/* الاسم الكامل */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الاسم الكامل *</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="اسمك الكامل"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.input}
                    textAlign="right"
                    maxLength={45}
                  />
                  <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                </View>
              </View>

              {/* اسم المستخدم */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>اسم المستخدم *</Text>
                <View style={[styles.inputWrap, usernameError ? styles.inputWrapError : null]}>
                  <TextInput
                    value={username}
                    onChangeText={validateUsername}
                    placeholder="khalid_otaibi"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.input}
                    textAlign="left"
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={25}
                  />
                  <Text style={styles.atSign}>@</Text>
                </View>
                {usernameError ? (
                  <Text style={styles.fieldError}>{usernameError}</Text>
                ) : (
                  <Text style={styles.fieldHint}>
                    يظهر في رابط ملفك <Text style={styles.fieldHintLink}>alsafat.sa/profile/{username || 'اسم_المستخدم'}</Text>
                  </Text>
                )}
              </View>

              {/* الدولة */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الدولة</Text>
                <Pressable style={styles.inputWrap} onPress={() => setShowPicker(v => !v)}>
                  <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  <Text style={styles.pickerValueText}>{currentCountry.label} {currentCountry.code}</Text>
                  <Text style={styles.pickerValueFlag}>{currentCountry.flag}</Text>
                </Pressable>

                {showPicker && (
                  <View style={styles.pickerDropdown}>
                    {COUNTRY_CODES.map((c, i) => (
                      <Pressable
                        key={c.code}
                        style={[
                          styles.pickerItem,
                          i === countryIdx && styles.pickerItemActive,
                        ]}
                        onPress={() => { setCountryIdx(i); setShowPicker(false); }}
                      >
                        <Text style={styles.pickerFlag}>{c.flag}</Text>
                        <Text style={styles.pickerLabel}>{c.label}</Text>
                        <Text style={styles.pickerCode}>{c.code}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* رقم الجوال */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>رقم الجوال *</Text>
                <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => { setPhone(t); setOtpError(''); }}
                    placeholder="05xxxxxxxx"
                    placeholderTextColor={colors.textSubtle}
                    keyboardType="phone-pad"
                    textAlign="right"
                    style={styles.input}
                    maxLength={12}
                    editable={!otpSent}
                  />
                  <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                </Animated.View>
                <Text style={styles.fieldHint}>
                  الصفر في البداية للصيغة المحلية (05...) - تحول تلقائياً إلى {currentCountry.code} عند الارسال
                </Text>
              </View>

              {/* البريد الإلكتروني (اختياري) */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>البريد الإلكتروني (اختياري)</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={emailInput}
                    onChangeText={setEmailInput}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.textSubtle}
                    style={styles.input}
                    textAlign="right"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                </View>
              </View>

              {/* كلمة المرور (فقط للتسجيل العادي) */}
              {!viaGoogle && (
                <>
                  {/* كلمة المرور */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>كلمة المرور *</Text>
                    <View style={styles.inputWrap}>
                      <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                      </Pressable>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="........"
                        placeholderTextColor={colors.textSubtle}
                        secureTextEntry={!showPassword}
                        style={styles.input}
                        textAlign="right"
                      />
                      <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    </View>
                  </View>

                  {/* تأكيد كلمة المرور */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>التأكيد *</Text>
                    <View style={styles.inputWrap}>
                      <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={10}>
                        <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                      </Pressable>
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="........"
                        placeholderTextColor={colors.textSubtle}
                        secureTextEntry={!showConfirmPassword}
                        style={styles.input}
                        textAlign="right"
                      />
                      <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    </View>
                  </View>
                </>
              )}

              {/* Checkbox: الموافقة على الشروط والأحكام */}
              <Pressable
                onPress={() => setAgreed((v) => !v)}
                style={styles.agreeRow}
              >
                <Text style={styles.agreeText}>
                  أوافق على <Text style={styles.agreeLink}>شروط وأحكام سوق الصفاة</Text>
                </Text>
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
              </Pressable>

              {/* OTP Verification Section (Inline) */}
              {otpSent && (
                <View style={styles.otpVerifyContainer}>
                  <Text style={styles.fieldLabel}>رمز التحقق المرسل بجوالك *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      value={otpCode}
                      onChangeText={setOtpCode}
                      placeholder="أدخل الكود (6 أرقام)"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="number-pad"
                      textAlign="center"
                      style={styles.otpInput}
                      maxLength={6}
                    />
                  </View>
                  <View style={styles.otpActionsRow}>
                    <Pressable style={styles.otpVerifyBtn} onPress={handleVerifyAndRegister} disabled={otpLoading}>
                      {otpLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.otpVerifyText}>تأكيد الرمز وإنشاء الحساب ←</Text>
                      )}
                    </Pressable>
                    <Pressable style={styles.otpEditBtn} onPress={() => setOtpSent(false)}>
                      <Text style={styles.otpEditText}>تعديل البيانات</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Error messages */}
              {otpError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                  <Text style={styles.errorText}>{otpError}</Text>
                </View>
              ) : null}

              {/* Send Verification Code / Create Account Button */}
              {!otpSent && (
                <Pressable
                  style={styles.submitBtn}
                  onPress={handleSendOtp}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={[colors.electric, colors.electricBright]}
                    style={styles.submitGrad}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>إرسال رمز التحقق ←</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              )}

              {/* Divider: أو تابع بـ */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>أو تابع بـ</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Button */}
              <Pressable
                style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.9 }]}
                onPress={handleGoogle}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/480px-Google_%22G%22_logo.svg.png' }} style={styles.googleLogo} />
                    <Text style={styles.googleText}>Sign in with Google</Text>
                  </>
                )}
              </Pressable>

            </View>

            {/* Footer Registration links */}
            <View style={styles.footer}>
              <Pressable onPress={() => router.push('/auth/phone')}>
                <Text style={styles.footerLinkText}>
                  لديك حساب بالفعل؟ <Text style={styles.footerLinkActive}>تسجيل الدخول</Text>
                </Text>
              </Pressable>

              <Text style={[styles.footerLinkText, { marginTop: spacing.sm, textAlign: 'center' }]}>
                لإدارة ملحمة، أنشئ حساباً أولاً ثم سجّل الدخول من داخل التطبيق.
              </Text>
              
              <Text style={styles.disclaimerText}>
                بتسجيل الدخول أو إنشاء حساب فإنك توافق على <Text style={styles.disclaimerLink} onPress={() => router.push('/info/terms')}>شروط وأحكام سوق الصفاة</Text>
              </Text>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 40, paddingBottom: 30, alignItems: 'center' },

  backBtn: {
    position: 'absolute', top: 16, right: spacing.xl,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderHairline,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },

  header: { alignItems: 'center', marginBottom: 25, gap: 10, width: '100%' },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },

  card: {
    width: '100%', borderRadius: 24, padding: spacing.xl,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderHairline,
    gap: spacing.md,
  },

  fieldGroup: { gap: 6, width: '100%' },
  fieldLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', textAlign: 'right' },
  
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgDeep, borderRadius: 12,
    borderWidth: 1.2, borderColor: colors.borderHairline,
    paddingHorizontal: spacing.md, height: 50, width: '100%',
  },
  inputWrapError: { borderColor: colors.danger },
  inputIcon: { marginLeft: 8 },
  input: { flex: 1, fontSize: 14, color: colors.textPrimary, height: '100%', textAlign: 'right' },
  atSign: { fontSize: 14, color: colors.textMuted, fontWeight: 'bold', marginLeft: 8 },
  
  fieldError: { fontSize: 11, color: colors.danger, textAlign: 'right', marginTop: 2 },
  fieldHint: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: 2, lineHeight: 16 },
  fieldHintLink: { color: colors.textBrandStrong, fontWeight: '500' },

  pickerValueText: { flex: 1, fontSize: 14, color: colors.textPrimary, textAlign: 'right', marginRight: 8 },
  pickerValueFlag: { fontSize: 16 },

  pickerDropdown: {
    backgroundColor: colors.bgDeep, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderHairline,
    marginTop: 4, overflow: 'hidden', width: '100%',
  },
  pickerItem: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  pickerItemActive: { backgroundColor: 'rgba(30,111,241,0.1)' },
  pickerFlag: { fontSize: 16 },
  pickerLabel: { flex: 1, fontSize: 13, color: colors.textPrimary, textAlign: 'right', marginRight: 10 },
  pickerCode: { fontSize: 13, color: colors.textMuted },

  agreeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 8, width: '100%', marginVertical: 4,
  },
  agreeText: { fontSize: 13, color: colors.textMuted, textAlign: 'right' },
  agreeLink: { color: colors.textBrandStrong, fontWeight: 'bold' },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: colors.borderHairline,
    backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.electric, borderColor: colors.electric },

  submitBtn: { width: '100%', borderRadius: 25, overflow: 'hidden', marginTop: 5 },
  submitGrad: { height: 50, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },

  otpVerifyContainer: {
    backgroundColor: 'rgba(30,111,241,0.05)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(30,111,241,0.15)',
    padding: spacing.md, gap: spacing.sm, width: '100%',
  },
  otpInput: { flex: 1, fontSize: 18, color: colors.textPrimary, height: '100%', letterSpacing: 8, textAlign: 'center', fontWeight: 'bold' },
  otpActionsRow: { flexDirection: 'row-reverse', gap: spacing.md, width: '100%' },
  otpVerifyBtn: {
    backgroundColor: colors.electric, borderRadius: 12,
    height: 44, alignItems: 'center', justifyContent: 'center', flex: 2,
  },
  otpVerifyText: { fontSize: 13, color: colors.textPrimary, fontWeight: 'bold' },
  otpEditBtn: {
    borderWidth: 1, borderColor: colors.borderHairline, borderRadius: 12,
    height: 44, alignItems: 'center', justifyContent: 'center', flex: 1,
  },
  otpEditText: { fontSize: 12, color: colors.textMuted },

  errorContainer: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
    width: '100%',
  },
  errorText: { fontSize: 12, color: colors.danger, textAlign: 'right', flex: 1 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 15, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderHairline },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#6b7280' },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.textPrimary, height: 48, borderRadius: 24, gap: 10, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  googleLogo: { width: 18, height: 18 },
  googleText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  footer: { alignItems: 'center', marginTop: 25, gap: 15, width: '100%' },
  footerLinkText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  footerLinkActive: { color: colors.textBrandStrong, fontWeight: 'bold' },
  disclaimerText: { fontSize: 11, color: '#6b7280', textAlign: 'center', paddingHorizontal: 20, lineHeight: 16 },
  disclaimerLink: { color: colors.textBrandStrong, textDecorationLine: 'underline' },
  });
}
