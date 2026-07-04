// Powered by OnSpace.AI
// SAFAT — Login Screen (شاشة تسجيل الدخول المطابقة للتصميم الجديد)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { AppLogo } from '@/components/ui/AppLogo';
import { marginStart, marginEnd, rtlDirection, rtlRow } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';

const COUNTRY_CODES = [
  { flag: '🇸🇦', code: '+966', label: 'السعودية' },
  { flag: '🇪🇬', code: '+20', label: 'مصر' },
];

export default function PhoneScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { signInWithPassword, sendOtp, signInWithGoogle } = useAuth();
  const { signIn: googleSignIn, isConfigured: googleConfigured } = useGoogleSignIn();

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone');

  // Common login state
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // Password / Phone Tab States
  const [phone, setPhone]           = useState('');
  const [countryIdx, setCountryIdx] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Email Tab States
  const [email, setEmail] = useState('');

  // OTP Login States (Quick Bypass option)
  const [useOtpFlow, setUseOtpFlow] = useState(false);
  const [otpChannel, setOtpChannel] = useState<'sms' | 'whatsapp'>('sms');

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

  // ── تسجيل الدخول بكلمة المرور ──────────────────────────────────────────────
  const handlePasswordLogin = async () => {
    setError('');
    let loginIdentifier = '';

    if (activeTab === 'phone') {
      if (!isPhoneValid) { setError('أدخل رقم جوال صحيح'); shake(); return; }
      loginIdentifier = fullPhone;
    } else {
      if (!email.includes('@')) { setError('أدخل بريد إلكتروني صحيح'); shake(); return; }
      loginIdentifier = email.trim().toLowerCase();
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      shake();
      return;
    }

    setLoading(true);
    const result = await signInWithPassword(loginIdentifier, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'بيانات الدخول غير صحيحة');
      shake();
      return;
    }

    router.replace('/(tabs)');
  };

  // ── تسجيل الدخول السريع عبر OTP ───────────────────────────────────────────
  const handleSendOtp = async () => {
    setError('');
    if (!isPhoneValid) { setError('أدخل رقم جوال صحيح للتحقق'); shake(); return; }

    setLoading(true);
    const result = await sendOtp(fullPhone, otpChannel);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'فشل إرسال الرمز');
      shake();
      return;
    }

    router.push({
      pathname: '/auth/otp',
      params: { phone: fullPhone, channel: otpChannel, devMode: result.devMode ? '1' : '0' },
    });
  };

  // ── Google Sign In ─────────────────────────────────────────────────────────
  const [googleLoading, setGoogleLoading] = useState(false);
  const handleGoogle = async () => {
    setError('');
    if (!googleConfigured) {
      setError('تسجيل Google غير متاح حالياً');
      return;
    }

    setGoogleLoading(true);
    try {
      const googleResult = await googleSignIn();
      if (!googleResult.ok) {
        setGoogleLoading(false);
        // Deep link opens /expo-auth-session — that screen finishes sign-in.
        if (googleResult.cancelled) return;
        if (googleResult.error) {
          setError(googleResult.error);
        }
        return;
      }

      const authResult = await signInWithGoogle(googleResult.idToken);
      setGoogleLoading(false);

      if (!authResult.success) {
        setError(authResult.error ?? 'تعذّر الدخول عبر Google');
        return;
      }

      if (authResult.isNew) {
        router.push({
          pathname: '/auth/register',
          params: {
            googleId:    authResult.googleData?.googleId,
            email:       authResult.googleData?.email,
            displayName: authResult.googleData?.displayName,
            avatar:      authResult.googleData?.avatar,
            via_google:  '1',
          },
        });
        return;
      }

      router.replace('/(tabs)');
    } catch {
      setGoogleLoading(false);
      setError('تعذّر الاتصال بـ Google');
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            
            {/* Logo and Header */}
            <View style={styles.header}>
              <AppLogo size={90} />
              <Text style={styles.title}>مرحباً في صفاة</Text>
              <Text style={styles.sub}>سجّل دخولك لشراء وبيع المواشي واللحوم في الخليج</Text>
            </View>

            {/* Main Card */}
            <View style={styles.card}>
              
              {/* Segmented Tabs */}
              <View style={styles.tabsContainer}>
                <Pressable
                  style={[styles.tabBtn, activeTab === 'email' && styles.tabBtnActive]}
                  onPress={() => { setActiveTab('email'); setError(''); setUseOtpFlow(false); }}
                >
                  <Text style={[styles.tabText, activeTab === 'email' && styles.tabTextActive]}>
                    البريد الإلكتروني
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.tabBtn, activeTab === 'phone' && styles.tabBtnActive]}
                  onPress={() => { setActiveTab('phone'); setError(''); }}
                >
                  <Text style={[styles.tabText, activeTab === 'phone' && styles.tabTextActive]}>
                    رقم الجوال
                  </Text>
                </Pressable>
              </View>

              {/* Form Input fields */}
              {activeTab === 'phone' ? (
                // 📱 Phone Tab Content
                <View style={styles.formGroup}>
                  
                  {/* Phone Input with Country selector */}
                  <View style={styles.fieldHeader}>
                    <Text style={styles.fieldLabel}>رقم الجوال *</Text>
                  </View>
                  <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
                    <Pressable style={styles.countryBtn} onPress={() => setShowPicker(v => !v)}>
                      <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                      <Text style={styles.countryCode}>{currentCountry.code}</Text>
                      <Text style={styles.countryFlag}>{currentCountry.flag}</Text>
                    </Pressable>
                    <View style={styles.inputDivider} />
                    <TextInput
                      style={styles.phoneInput}
                      value={phone}
                      onChangeText={t => { setPhone(t); setError(''); }}
                      placeholder="05xxxxxxxx"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="phone-pad"
                      textAlign="right"
                      maxLength={12}
                    />
                    <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  </Animated.View>

                  {/* Country dropdown selection list */}
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

                  {/* Toggle Option between Password login and OTP login for phone */}
                  {useOtpFlow ? (
                    // OTP Quick login inputs
                    <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
                      <View style={styles.channelRow}>
                        <Pressable
                          style={[styles.channelBtn, otpChannel === 'sms' && styles.channelBtnActive]}
                          onPress={() => setOtpChannel('sms')}
                        >
                          <Text style={[styles.channelLabel, otpChannel === 'sms' && styles.channelLabelActive]}>SMS</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.channelBtn, otpChannel === 'whatsapp' && styles.channelBtnActive]}
                          onPress={() => setOtpChannel('whatsapp')}
                        >
                          <Text style={[styles.channelLabel, otpChannel === 'whatsapp' && { color: '#25D366' }]}>واتساب</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    // Regular Phone + Password inputs
                    <View style={{ gap: spacing.md }}>
                      <View style={styles.fieldHeader}>
                        <Pressable onPress={() => router.push('/auth/forgot-password')}>
                          <Text style={styles.forgotLink}>نسيت كلمة المرور؟</Text>
                        </Pressable>
                        <Text style={styles.fieldLabel}>كلمة المرور *</Text>
                      </View>
                      <View style={styles.inputWrap}>
                        <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                        </Pressable>
                        <TextInput
                          style={styles.textInput}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="........"
                          placeholderTextColor={colors.textSubtle}
                          secureTextEntry={!showPassword}
                          textAlign="right"
                        />
                        <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      </View>
                    </View>
                  )}

                  <Pressable onPress={() => { setUseOtpFlow(!useOtpFlow); setError(''); }} style={styles.switchFlowBtn}>
                    <Text style={styles.switchFlowText}>
                      {useOtpFlow ? 'تسجيل الدخول بكلمة المرور 🔑' : 'الدخول السريع عبر رمز الجوال (OTP) 📱'}
                    </Text>
                  </Pressable>

                </View>
              ) : (
                // 📧 Email Tab Content
                <View style={styles.formGroup}>
                  
                  {/* Email Input */}
                  <View style={styles.fieldHeader}>
                    <Text style={styles.fieldLabel}>البريد الإلكتروني *</Text>
                  </View>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={email}
                      onChangeText={t => { setEmail(t); setError(''); }}
                      placeholder="example@gmail.com"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="email-address"
                      textAlign="right"
                      autoCapitalize="none"
                    />
                    <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  </View>

                  {/* Password Input */}
                  <View style={styles.fieldHeader}>
                    <Pressable onPress={() => router.push('/auth/forgot-password')}>
                      <Text style={styles.forgotLink}>نسيت كلمة المرور؟</Text>
                    </Pressable>
                    <Text style={styles.fieldLabel}>كلمة المرور *</Text>
                  </View>
                  <View style={styles.inputWrap}>
                    <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                    </Pressable>
                    <TextInput
                      style={styles.textInput}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="........"
                      placeholderTextColor={colors.textSubtle}
                      secureTextEntry={!showPassword}
                      textAlign="right"
                    />
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  </View>
                </View>
              )}

              {/* Error Box */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Remember Me Checkbox */}
              <Pressable
                onPress={() => setRememberMe(!rememberMe)}
                style={styles.rememberRow}
              >
                <Text style={styles.rememberText}>تذكرني</Text>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
              </Pressable>

              {/* Submit CTA Button */}
              <Pressable
                style={styles.submitBtn}
                onPress={useOtpFlow && activeTab === 'phone' ? handleSendOtp : handlePasswordLogin}
                disabled={loading}
              >
                <LinearGradient
                  colors={gradients.electric}
                  style={styles.submitGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>
                      {useOtpFlow && activeTab === 'phone' ? 'إرسال رمز التحقق ←' : 'تسجيل الدخول ←'}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>

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
              <Pressable onPress={() => router.push('/auth/register')}>
                <Text style={styles.footerLinkText}>
                  ليس لديك حساب؟ <Text style={styles.footerLinkActive}>أنشئ حساباً</Text>
                </Text>
              </Pressable>
              
              <Text style={styles.disclaimerText}>
                بتسجيل الدخول فأنت توافق على <Text style={styles.disclaimerLink} onPress={() => router.push('/info/terms')}>شروط استخدام صفاة</Text>
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

  header: { alignItems: 'center', marginBottom: 25, gap: 10, width: '100%' },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },

  card: {
    width: '100%', borderRadius: 24, padding: spacing.xl,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderHairline,
    gap: spacing.md,
  },

  tabsContainer: {
    ...rtlRow,
    backgroundColor: colors.bgPrimary,
    borderRadius: 25, padding: 4, height: 48, width: '100%',
    marginBottom: spacing.xs,
  },
  tabBtn: { flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tabBtnActive: { backgroundColor: colors.electric },
  tabText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.textPrimary },

  formGroup: { gap: spacing.md, width: '100%' },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  fieldLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  forgotLink: { fontSize: 11, color: colors.textBrandStrong, fontWeight: '500' },

  inputWrap: {
    ...rtlRow,
    alignItems: 'center',
    backgroundColor: colors.bgDeep, borderRadius: 12,
    borderWidth: 1.2, borderColor: colors.borderHairline,
    paddingHorizontal: spacing.md, height: 50, width: '100%',
  },
  inputIcon: marginStart(8),
  textInput: { flex: 1, fontSize: 14, color: colors.textPrimary, height: '100%', textAlign: 'right' },

  countryBtn: {
    ...rtlRow,
    alignItems: 'center', gap: 6,
    paddingHorizontal: 4, height: '100%',
  },
  countryCode: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  countryFlag: { fontSize: 16 },
  inputDivider: { width: 1, height: 20, backgroundColor: colors.borderHairline, marginHorizontal: 8 },
  phoneInput: { flex: 1, fontSize: 14, color: colors.textPrimary, height: '100%', textAlign: 'right' },

  pickerDropdown: {
    backgroundColor: colors.bgDeep, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderHairline,
    marginTop: -8, overflow: 'hidden', width: '100%',
  },
  pickerItem: {
    ...rtlRow,
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  pickerItemActive: { backgroundColor: 'rgba(30,111,241,0.1)' },
  pickerFlag: { fontSize: 16 },
  pickerLabel: { flex: 1, fontSize: 13, color: colors.textPrimary, textAlign: 'right', ...marginEnd(10) },
  pickerCode: { fontSize: 13, color: colors.textMuted },

  switchFlowBtn: { alignSelf: 'center', paddingVertical: 4 },
  switchFlowText: { fontSize: 12, color: colors.textBrandStrong, fontWeight: '500', textAlign: 'center' },

  channelRow: { ...rtlRow, justifyContent: 'center', gap: spacing.md, marginVertical: spacing.xs },
  channelBtn: {
    ...rtlRow,
    alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.borderHairline,
  },
  channelBtnActive: { borderColor: colors.electric, backgroundColor: 'rgba(30,111,241,0.15)' },
  channelLabel: { fontSize: 12, color: colors.textMuted },
  channelLabelActive: { color: colors.textBrandStrong, fontWeight: '600' },

  errorContainer: {
    ...rtlRow,
    alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
    width: '100%',
  },
  errorText: { fontSize: 12, color: colors.danger, textAlign: 'right', flex: 1 },

  rememberRow: {
    ...rtlRow,
    alignItems: 'center', justifyContent: 'flex-end',
    gap: 8, width: '100%', marginVertical: 2,
  },
  rememberText: { fontSize: 13, color: colors.textMuted },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: colors.borderHairline,
    backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.electric, borderColor: colors.electric },

  submitBtn: { width: '100%', borderRadius: 25, overflow: 'hidden', marginTop: 5 },
  submitGrad: { height: 50, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },

  divider: { ...rtlRow, alignItems: 'center', marginVertical: 15, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderHairline },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#6b7280' },

  googleBtn: {
    ...rtlRow,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff', height: 48, borderRadius: 24, gap: 10, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  googleLogo: { width: 18, height: 18 },
  googleText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  footer: { alignItems: 'center', marginTop: 25, gap: 15, width: '100%' },
  footerLinkText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  footerLinkActive: { color: colors.textBrandStrong, fontWeight: 'bold' },
  disclaimerText: { fontSize: 11, color: colors.textSubtle, textAlign: 'center', paddingHorizontal: 20, lineHeight: 16 },
  disclaimerLink: { color: colors.textBrandStrong, textDecorationLine: 'underline' },
  });
}
