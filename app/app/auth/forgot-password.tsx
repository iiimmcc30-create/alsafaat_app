// SAFAT — Forgot Password via OTP (نسيت كلمة المرور)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { AppLogo } from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

const COUNTRY_CODES = [
  { flag: '🇸🇦', code: '+966', label: 'السعودية' },
];

type Step = 'phone' | 'otp' | 'password' | 'done';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const { sendOtp, verifyOtp, resetPassword } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [countryIdx, setCountryIdx] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [phoneToken, setPhoneToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devMode, setDevMode] = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);
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
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleSendOtp = async () => {
    setError('');
    if (!isPhoneValid) {
      setError('أدخل رقم جوال صحيح');
      shake();
      return;
    }

    setLoading(true);
    const result = await sendOtp(fullPhone, 'sms');
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'فشل إرسال رمز التحقق');
      shake();
      return;
    }

    setDevMode(result.devMode ?? false);
    setStep('otp');
    setOtp(['', '', '', '', '', '']);
  };

  const handleVerifyOtp = async (code: string) => {
    if (loading) return;
    setError('');
    setLoading(true);

    const result = await verifyOtp(fullPhone, code, 'reset_password');
    setLoading(false);

    if (!result.success || !result.phoneToken) {
      setError(result.error ?? 'رمز التحقق غير صحيح');
      shake();
      return;
    }

    setPhoneToken(result.phoneToken);
    setStep('password');
  };

  const handleOtpChange = (text: string, idx: number) => {
    setError('');
    const digit = text.replace(/\D/g, '').slice(-1);
    const arr = [...otp];
    arr[idx] = digit;
    setOtp(arr);
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
    if (arr.every((d) => d) && arr.join('').length === 6) {
      handleVerifyOtp(arr.join(''));
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (newPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      shake();
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقين');
      shake();
      return;
    }

    setLoading(true);
    const result = await resetPassword(fullPhone, phoneToken, newPassword);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'فشل إعادة تعيين كلمة المرور');
      shake();
      return;
    }

    setStep('done');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <AppIcon name="arrow-forward" size={24} color="#ffffff" />
          </Pressable>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <AppLogo size={90} />
              <Text style={styles.title}>استعادة كلمة المرور</Text>
              <Text style={styles.sub}>
                {step === 'phone' && 'أدخل رقم جوالك المسجّل لإرسال رمز التحقق'}
                {step === 'otp' && 'أدخل رمز التحقق المرسل إلى جوالك'}
                {step === 'password' && 'اختر كلمة مرور جديدة لحسابك'}
                {step === 'done' && 'تم تحديث كلمة المرور بنجاح'}
              </Text>
            </View>

            <View style={styles.card}>
              {step === 'phone' && (
                <>
                  <Text style={styles.fieldLabel}>رقم الجوال *</Text>
                  <Animated.View style={[styles.inputWrap, { transform: [{ translateX: shakeAnim }] }]}>
                    <Pressable style={styles.countryBtn} onPress={() => setShowPicker((v) => !v)}>
                      <AppIcon name={showPicker ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                      <Text style={styles.countryCode}>{currentCountry.code}</Text>
                      <Text style={styles.countryFlag}>{currentCountry.flag}</Text>
                    </Pressable>
                    <View style={styles.inputDivider} />
                    <TextInput
                      style={styles.phoneInput}
                      value={phone}
                      onChangeText={(t) => { setPhone(t); setError(''); }}
                      placeholder="05xxxxxxxx"
                      placeholderTextColor={colors.textSubtle}
                      keyboardType="phone-pad"
                      textAlign="right"
                    />
                  </Animated.View>

                  {showPicker && (
                    <View style={styles.pickerDropdown}>
                      {COUNTRY_CODES.map((c, i) => (
                        <Pressable
                          key={c.code}
                          style={[styles.pickerItem, i === countryIdx && styles.pickerItemActive]}
                          onPress={() => { setCountryIdx(i); setShowPicker(false); }}
                        >
                          <Text style={styles.pickerFlag}>{c.flag}</Text>
                          <Text style={styles.pickerLabel}>{c.label}</Text>
                          <Text style={styles.pickerCode}>{c.code}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}

              {step === 'otp' && (
                <>
                  <Text style={styles.otpHint}>تم الإرسال إلى {fullPhone}</Text>
                  {devMode && <Text style={styles.devHint}>وضع التطوير: استخدم 123456</Text>}
                  <View style={styles.otpRow}>
                    {otp.map((digit, idx) => (
                      <View key={idx} style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}>
                        <TextInput
                          ref={(r) => { inputs.current[idx] = r; }}
                          style={styles.otpInput}
                          value={digit}
                          onChangeText={(t) => handleOtpChange(t, idx)}
                          keyboardType="number-pad"
                          maxLength={1}
                          textAlign="center"
                          autoFocus={idx === 0}
                        />
                      </View>
                    ))}
                  </View>
                  <Pressable onPress={handleSendOtp} disabled={loading}>
                    <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
                  </Pressable>
                </>
              )}

              {step === 'password' && (
                <>
                  <Text style={styles.fieldLabel}>كلمة المرور الجديدة *</Text>
                  <View style={styles.inputWrap}>
                    <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                      <AppIcon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                    </Pressable>
                    <TextInput
                      style={styles.textInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="........"
                      placeholderTextColor={colors.textSubtle}
                      secureTextEntry={!showPassword}
                      textAlign="right"
                    />
                  </View>

                  <Text style={styles.fieldLabel}>تأكيد كلمة المرور *</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.textInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="........"
                      placeholderTextColor={colors.textSubtle}
                      secureTextEntry={!showPassword}
                      textAlign="right"
                    />
                  </View>
                </>
              )}

              {step === 'done' && (
                <View style={styles.doneWrap}>
                  <AppIcon name="checkmark-circle" size={64} color={colors.success} />
                  <Text style={styles.doneText}>يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</Text>
                </View>
              )}

              {error ? (
                <View style={styles.errorContainer}>
                  <AppIcon name="alert-circle-outline" size={15} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {step !== 'done' && (
                <Pressable
                  style={styles.submitBtn}
                  onPress={
                    step === 'phone' ? handleSendOtp
                    : step === 'otp' ? () => handleVerifyOtp(otp.join(''))
                    : handleResetPassword
                  }
                  disabled={loading}
                >
                  <LinearGradient colors={[colors.electric, colors.electricBright]} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>
                        {step === 'phone' ? 'إرسال رمز التحقق' : step === 'otp' ? 'تحقق من الرمز' : 'حفظ كلمة المرور'}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
              )}

              {step === 'done' && (
                <Pressable style={styles.submitBtn} onPress={() => router.replace('/auth/phone')}>
                  <LinearGradient colors={[colors.electric, colors.electricBright]} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.submitText}>تسجيل الدخول</Text>
                  </LinearGradient>
                </Pressable>
              )}
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
  backBtn: {
    position: 'absolute', top: 16, right: spacing.xl, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderHairline,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 30 },
  header: { alignItems: 'center', marginBottom: 24, gap: 10 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  card: {
    width: '100%', borderRadius: 24, padding: spacing.xl,
    backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderHairline, gap: spacing.md,
  },
  fieldLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', textAlign: 'right' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgDeep, borderRadius: 12,
    borderWidth: 1.2, borderColor: colors.borderHairline,
    paddingHorizontal: spacing.md, height: 50,
  },
  countryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countryCode: { fontSize: 14, color: '#fff', fontWeight: '600' },
  countryFlag: { fontSize: 16 },
  inputDivider: { width: 1, height: 20, backgroundColor: colors.borderHairline, marginHorizontal: 8 },
  phoneInput: { flex: 1, fontSize: 14, color: '#fff', textAlign: 'right' },
  textInput: { flex: 1, fontSize: 14, color: '#fff', textAlign: 'right' },
  pickerDropdown: {
    backgroundColor: colors.bgDeep, borderRadius: 12,
    borderWidth: 1, borderColor: colors.borderHairline, overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  pickerItemActive: { backgroundColor: 'rgba(30,111,241,0.1)' },
  pickerFlag: { fontSize: 16 },
  pickerLabel: { flex: 1, fontSize: 13, color: '#fff', textAlign: 'right', marginHorizontal: 10 },
  pickerCode: { fontSize: 13, color: colors.textMuted },
  otpHint: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  devHint: { fontSize: 12, color: '#f59e0b', textAlign: 'center' },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  otpBox: {
    width: 42, height: 50, borderRadius: 10,
    backgroundColor: colors.bgDeep, borderWidth: 1.5, borderColor: colors.borderHairline,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: colors.electric, backgroundColor: 'rgba(30,111,241,0.1)' },
  otpInput: { fontSize: 20, fontWeight: 'bold', color: '#fff', width: '100%', height: '100%', textAlign: 'center' },
  resendText: { fontSize: 13, color: colors.textBrandStrong, textAlign: 'center', fontWeight: '600' },
  errorContainer: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: { fontSize: 12, color: colors.danger, flex: 1, textAlign: 'right' },
  submitBtn: { borderRadius: 25, overflow: 'hidden', marginTop: 4 },
  submitGrad: { height: 50, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  doneWrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  doneText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  });
}
