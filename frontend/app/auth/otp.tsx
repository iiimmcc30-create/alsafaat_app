// Powered by OnSpace.AI
// SAFAT — OTP Verification Screen (شاشة التحقق من رمز OTP)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

function formatDisplayPhone(phone: string): string {
  return phone.replace(/^(\+966)(\d)(\d{3})(\d{3})(\d{3})$/, '+966 $2$3 $4 $5');
}

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    phone: string;
    requestId: string;
    expiresIn: string;
    channel: 'sms' | 'whatsapp';
  }>();

  const { verifyOtp, sendOtp } = useAuth();

  const totalSeconds   = parseInt(params.expiresIn ?? '120', 10);
  const [otp, setOtp]              = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown]  = useState(totalSeconds);
  const [loading, setLoading]      = useState(false);
  const [error, setError]          = useState('');
  const [success, setSuccess]      = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const minutes = String(Math.floor(countdown / 60)).padStart(2, '0');
  const seconds = String(countdown % 60).padStart(2, '0');

  // ── Auto-submit when all digits filled ────────────────────────────────────
  useEffect(() => {
    const code = otp.join('');
    if (code.length === OTP_LENGTH) handleVerify(code);
  }, [otp]);

  // ── Shake animation ────────────────────────────────────────────────────────
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  // ── Success animation ──────────────────────────────────────────────────────
  const playSuccess = () => {
    setSuccess(true);
    Animated.spring(successScale, {
      toValue: 1, tension: 60, friction: 7, useNativeDriver: true,
    }).start();
  };

  // ── Handle digit input ─────────────────────────────────────────────────────
  const handleChange = (text: string, idx: number) => {
    setError('');
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
      const arr = [...otp];
      for (let i = 0; i < OTP_LENGTH; i++) arr[i] = digits[i] ?? '';
      setOtp(arr);
      inputs.current[OTP_LENGTH - 1]?.focus();
      return;
    }

    const digit = text.replace(/\D/g, '').slice(-1);
    const arr = [...otp];
    arr[idx] = digit;
    setOtp(arr);

    if (digit && idx < OTP_LENGTH - 1) inputs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      const arr = [...otp];
      arr[idx - 1] = '';
      setOtp(arr);
      inputs.current[idx - 1]?.focus();
    }
  };

  // ── Verify OTP (عبر الباك اند) ────────────────────────────────────────────
  const handleVerify = async (code: string) => {
    if (loading) return;
    setError('');
    setLoading(true);

    const result = await verifyOtp(params.phone, code);

    if (!result.success) {
      setLoading(false);
      setError(result.error ?? 'رمز التحقق غير صحيح');
      shake();
      return;
    }

    playSuccess();

    setTimeout(() => {
      if (result.isNew) {
        router.push({
          pathname: '/auth/register',
          params: { phone: params.phone, token: result.phoneToken },
        });
      } else {
        router.replace('/(tabs)');
      }
    }, 1200);
  };

  // ── Resend Code ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setError('');
    setResendLoading(true);
    const result = await sendOtp(params.phone, params.channel);
    setResendLoading(false);

    if (!result.success) {
      setError(result.error ?? 'فشل إعادة إرسال الرمز');
      shake();
      return;
    }

    setCountdown(120);
    setOtp(['', '', '', '', '', '']);
    inputs.current[0]?.focus();
  };

  if (success) {
    return (
      <View style={styles.root}>
        <View style={styles.successCenter}>
          <Animated.View style={[styles.successRing, { transform: [{ scale: successScale }] }]}>
            <LinearGradient colors={['#1e6ff1', '#1099ec']} style={styles.successInner}>
              <Ionicons name="checkmark" size={52} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.successTitle}>تم التحقق بنجاح</Text>
          <Text style={styles.successSub}>جارٍ الدخول...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Back button top right */}
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-forward" size={24} color="#ffffff" />
          </Pressable>

          {/* Logo */}
          <View style={styles.header}>
            <View style={styles.logoOuter}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} />
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>
            
            {/* Channel icon */}
            <View style={styles.channelIconWrap}>
              {params.channel === 'whatsapp' ? (
                <MaterialCommunityIcons name="whatsapp" size={32} color="#25D366" />
              ) : (
                <Ionicons name="chatbubble-ellipses" size={32} color="#1099ec" />
              )}
            </View>

            <Text style={styles.cardTitle}>أدخل رمز التحقق</Text>
            <Text style={styles.cardSub}>
              أرسلنا رمزاً مكوناً من {OTP_LENGTH} أرقام إلى{'\n'}
              <Text style={styles.phoneHighlight}>
                {formatDisplayPhone(params.phone || '')}
              </Text>
            </Text>

            {/* OTP boxes */}
            <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
              {otp.map((digit, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.otpBox,
                    digit ? styles.otpBoxFilled : null,
                    error ? styles.otpBoxError : null,
                  ]}
                >
                  <TextInput
                    ref={(r) => { inputs.current[idx] = r; }}
                    style={styles.otpInput}
                    value={digit}
                    onChangeText={(t) => handleChange(t, idx)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                    autoFocus={idx === 0}
                    caretHidden
                  />
                </View>
              ))}
            </Animated.View>

            {/* Error message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Loading indicator */}
            {loading && (
              <ActivityIndicator size="small" color="#1099ec" style={{ marginTop: 10 }} />
            )}

            {/* Countdown + Resend */}
            <View style={styles.resendRow}>
              {countdown > 0 ? (
                <>
                  <Text style={styles.countdownText}>ينتهي الرمز خلال</Text>
                  <View style={styles.countdownBadge}>
                    <Text style={styles.countdownValue}>{minutes}:{seconds}</Text>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={handleResend}
                  disabled={resendLoading}
                  style={styles.resendActionBtn}
                >
                  <Ionicons name="refresh" size={15} color="#1099ec" />
                  <Text style={styles.resendActionText}>
                    {resendLoading ? 'جارٍ الإرسال...' : 'إعادة إرسال الرمز'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Verify Button (Manual fallback) */}
            <Pressable
              style={[styles.verifyBtn, (loading || otp.join('').length < OTP_LENGTH) && styles.verifyBtnDisabled]}
              onPress={() => handleVerify(otp.join(''))}
              disabled={loading || otp.join('').length < OTP_LENGTH}
            >
              <LinearGradient
                colors={otp.join('').length === OTP_LENGTH ? ['#1e6ff1', '#1099ec'] : ['#1d273a', '#1d273a']}
                style={styles.verifyGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.verifyText}>تأكيد الرمز</Text>
              </LinearGradient>
            </Pressable>

            {/* Disclaimer badge */}
            <View style={styles.poweredRow}>
              <Text style={styles.poweredText}>التحقق مدعوم بـ</Text>
              <View style={styles.twilioBadge}>
                <View style={styles.twilioDot} />
                <Text style={styles.twilioText}>Twilio Verify</Text>
              </View>
            </View>

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c1322' },
  safe: { flex: 1 },
  kav: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },

  backBtn: {
    position: 'absolute', top: 16, right: spacing.xl,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#131e35', borderWidth: 1, borderColor: '#1d273a',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },

  header: { alignItems: 'center', marginBottom: 25 },
  logoOuter: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#131e35', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#1d273a',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  logoImage: { width: 66, height: 66, borderRadius: 33 },

  card: {
    width: '100%', borderRadius: 24, padding: spacing.xl,
    backgroundColor: '#121a2d', borderWidth: 1, borderColor: '#1d273a',
    gap: spacing.md,
  },
  channelIconWrap: { alignItems: 'center', marginBottom: -spacing.sm },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  cardSub: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 22 },
  phoneHighlight: { color: '#1099ec', fontWeight: 'bold' },

  otpRow: {
    flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  otpBox: {
    width: 42, height: 50, borderRadius: 10,
    backgroundColor: '#0c1322', borderWidth: 1.5, borderColor: '#1d273a',
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: '#1e6ff1',
    backgroundColor: 'rgba(30,111,241,0.1)',
  },
  otpBoxError: { borderColor: colors.danger, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  otpInput: {
    fontSize: 20, fontWeight: 'bold', color: '#ffffff',
    width: '100%', height: '100%', textAlign: 'center',
  },

  errorContainer: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
    width: '100%',
  },
  errorText: { fontSize: 12, color: colors.danger, textAlign: 'right', flex: 1 },

  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: 5 },
  countdownText: { fontSize: 13, color: '#9ca3af' },
  countdownBadge: {
    backgroundColor: '#0c1322', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#1d273a',
  },
  countdownValue: { fontSize: 12, color: '#f59e0b', fontWeight: 'bold' },
  resendActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resendActionText: { fontSize: 13, color: '#1099ec', fontWeight: '600' },

  verifyBtn: { width: '100%', borderRadius: 25, overflow: 'hidden', marginTop: 10 },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyGrad: { height: 50, alignItems: 'center', justifyContent: 'center' },
  verifyText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },

  poweredRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
  poweredText: { fontSize: 11, color: '#6b7280' },
  twilioBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(239, 47, 70, 0.1)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, borderColor: '#1d273a',
  },
  twilioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f22f46' },
  twilioText: { fontSize: 11, color: '#f22f46', fontWeight: '600' },

  // Success screen
  successCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  successRing: {
    width: 120, height: 120, borderRadius: 60,
    shadowColor: '#1099ec', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 30, elevation: 16,
  },
  successInner: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  successSub: { fontSize: 14, color: '#9ca3af' },
});
