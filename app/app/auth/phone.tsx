// Powered by OnSpace.AI
// SAFAT — Login Screen (شاشة تسجيل الدخول المطابقة للتصميم الجديد)
import { AppIcon } from '@/components/ui/FlaticonIcon';

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { AppLogo } from '@/components/ui/AppLogo';
import { marginStart, marginEnd, rtlDirection, rtlRow } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_LOGIN_SUBTITLE_AR, BRAND_LOGIN_WELCOME_AR, BRAND_TERMS_SHORT_AR } from '@/constants/brandCopy';

const COUNTRY_CODES = [
  { flag: '🇸🇦', code: '+966', label: 'السعودية' },
];

export default function PhoneScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { signInWithPassword, sendOtp } = useAuth();

  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [phone, setPhone]           = useState('');
  const [countryIdx, setCountryIdx] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    if (!isPhoneValid) { setError('أدخل رقم جوال صحيح'); shake(); return; }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      shake();
      return;
    }

    setLoading(true);
    const result = await signInWithPassword(fullPhone, password);
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
              <Text style={styles.title}>{BRAND_LOGIN_WELCOME_AR}</Text>
              <Text style={styles.sub}>{BRAND_LOGIN_SUBTITLE_AR}</Text>
            </View>

            {/* Main Card */}
            <View style={styles.card}>
              <View style={styles.formGroup}>
                  
                  {/* Phone Input with Country selector */}
                  <View style={styles.fieldHeader}>
                    <Text style={styles.fieldLabel}>رقم الجوال *</Text>
                  </View>
                  <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
                    <Pressable style={styles.countryBtn} onPress={() => setShowPicker(v => !v)}>
                      <AppIcon name={showPicker ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
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
                    <AppIcon name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
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
                          <Text style={[styles.channelLabel, otpChannel === 'sms' && styles.channelLabelActive]}>رسالة نصية</Text>
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
                          <AppIcon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
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
                        <AppIcon name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                      </View>
                    </View>
                  )}

                  <Pressable onPress={() => { setUseOtpFlow(!useOtpFlow); setError(''); }} style={styles.switchFlowBtn}>
                    <Text style={styles.switchFlowText}>
                      {useOtpFlow ? 'تسجيل الدخول بكلمة المرور' : 'الدخول السريع عبر رمز الجوال'}
                    </Text>
                  </Pressable>

                </View>

              {/* Error Box */}
              {error ? (
                <View style={styles.errorContainer}>
                  <AppIcon name="alert-circle-outline" size={15} color={colors.danger} />
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
                  {rememberMe && <AppIcon name="checkmark" size={12} color="#fff" />}
                </View>
              </Pressable>

              {/* Submit CTA Button */}
              <Pressable
                style={styles.submitBtn}
                onPress={useOtpFlow ? handleSendOtp : handlePasswordLogin}
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
                      {useOtpFlow ? 'إرسال رمز التحقق ←' : 'تسجيل الدخول ←'}
                    </Text>
                  )}
                </LinearGradient>
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
                بتسجيل الدخول فأنت توافق على <Text style={styles.disclaimerLink} onPress={() => router.push('/info/terms')}>{BRAND_TERMS_SHORT_AR}</Text>
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },

  header: { alignItems: 'center', marginBottom: spacing.xxl, gap: spacing.sm, width: '100%' },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  sub: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },

  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    backgroundColor: colors.bgGlassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSoft,
    gap: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },

  formGroup: { gap: spacing.md, width: '100%' },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  fieldLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  forgotLink: { fontSize: 11, color: colors.textBrandStrong, fontWeight: '500' },

  inputWrap: {
    ...rtlRow,
    alignItems: 'center',
    backgroundColor: colors.bgSurface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md, height: 54, width: '100%',
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
    backgroundColor: colors.bgGlassStrong, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft,
    marginTop: -8, overflow: 'hidden', width: '100%',
  },
  pickerItem: {
    ...rtlRow,
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  pickerItemActive: { backgroundColor: colors.bgGlass },
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
  channelBtnActive: { borderColor: colors.electric, backgroundColor: colors.bgGlass },
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

  submitBtn: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.xs },
  submitGrad: { height: 54, alignItems: 'center', justifyContent: 'center' },
  submitText: { ...typography.bodyStrong, fontSize: 16, color: '#FFFFFF' },

  footer: { alignItems: 'center', marginTop: 25, gap: 15, width: '100%' },
  footerLinkText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  footerLinkActive: { color: colors.textBrandStrong, fontWeight: 'bold' },
  disclaimerText: { fontSize: 11, color: colors.textSubtle, textAlign: 'center', paddingHorizontal: 20, lineHeight: 16 },
  disclaimerLink: { color: colors.textBrandStrong, textDecorationLine: 'underline' },
  });
}
