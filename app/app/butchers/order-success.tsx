// Powered by OnSpace.AI
// SAFAT — Butcher Order Success Screen
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const { orderId, orderNumber, butcherId, paymentStatus } = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
    butcherId?: string;
    paymentStatus?: string;
  }>();
  const displayOrderId = orderNumber || (orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : '—');
  const isPaid = paymentStatus === 'paid';

  return (
    <SafeAreaView style={s.screen}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <View style={s.wrap}>
        {/* Animated circle */}
        <View style={s.circle}>
          <LinearGradient colors={[colors.success + '44', colors.success + '11']} style={StyleSheet.absoluteFill} />
          <Text style={s.icon}>{isPaid ? '✅' : '💳'}</Text>
        </View>

        <Text style={s.title}>{isPaid ? 'تم الدفع وإرسال الطلب!' : 'الطلب بانتظار الدفع'}</Text>
        <Text style={s.sub}>
          {isPaid
            ? 'وصل طلبك المدفوع للملحمة وسيتواصل معك الجزار قريباً لتأكيد التفاصيل'
            : 'أكمل الدفع عبر بوابة المنصة حتى يصل الطلب للملحمة'}
        </Text>

        {/* Order summary */}
        <View style={s.summaryCard}>
          <LinearGradient colors={[colors.electric + '22', colors.bgElevated]} style={StyleSheet.absoluteFill} />
          <View style={s.summaryRow}>
            <AppIcon name="receipt-outline" size={16} color={colors.glow} />
            <Text style={s.summaryLabel}>رقم الطلب</Text>
            <Text style={s.summaryValue}>{displayOrderId}</Text>
          </View>
          <View style={s.summaryRow}>
            <AppIcon name="card-outline" size={16} color={colors.glow} />
            <Text style={s.summaryLabel}>الدفع</Text>
            <View style={[s.pendingBadge, isPaid && s.paidBadge]}>
              <Text style={[s.pendingText, isPaid && s.paidText]}>
                {isPaid ? 'مدفوع' : 'بانتظار الدفع'}
              </Text>
            </View>
          </View>
          <View style={s.summaryRow}>
            <AppIcon name="time-outline" size={16} color={colors.glow} />
            <Text style={s.summaryLabel}>الحالة</Text>
            <View style={s.pendingBadge}>
              <Text style={s.pendingText}>{isPaid ? 'قيد المراجعة' : 'غير مؤكد'}</Text>
            </View>
          </View>
        </View>

        {/* Steps */}
        <View style={s.stepsWrap}>
          {[
            { step: '١', label: 'إنشاء الطلب', done: true },
            { step: '٢', label: 'الدفع عبر بوابة المنصة', done: isPaid },
            { step: '٣', label: 'مراجعة وتأكيد الجزار', done: false },
            { step: '٤', label: 'الاستلام أو التوصيل', done: false },
          ].map((item, i) => (
            <View key={i} style={s.stepRow}>
              <View style={[s.stepCircle, item.done && s.stepCircleDone]}>
                {item.done
                  ? <AppIcon name="checkmark" size={14} color="#fff" />
                  : <Text style={s.stepNum}>{item.step}</Text>
                }
              </View>
              {i < 3 && <View style={[s.stepLine, item.done && s.stepLineDone]} />}
              <Text style={[s.stepLabel, item.done && s.stepLabelDone]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <Pressable
          style={({ pressed }) => [s.chatBtn, pressed && { opacity: 0.88 }]}
          onPress={() =>
            router.push({
              pathname: '/butchers/order/[id]',
              params: { id: orderId ?? '' },
            })
          }
        >
          <LinearGradient
            colors={[colors.electricBright, colors.cyan]}
            style={s.chatBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <AppIcon name="receipt-outline" size={20} color="#fff" />
            <Text style={s.chatBtnText}>تتبع الطلب</Text>
          </LinearGradient>
        </Pressable>

        <Pressable style={s.backBtn} onPress={() => router.replace('/butchers')}>
          <Text style={s.backBtnText}>العودة لقسم الملاحم</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  circle: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.success + '44',
    overflow: 'hidden',
  },
  icon: { fontSize: 52 },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryCard: {
    width: '100%',
    borderRadius: radius.xxl,
    borderWidth: 1, borderColor: colors.electric + '44',
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.md,
    position: 'relative',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLabel: { ...typography.caption, color: colors.textMuted, flex: 1 },
  summaryValue: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  pendingBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.amber + '33',
    borderWidth: 1, borderColor: colors.amber + '66',
  },
  pendingText: { ...typography.micro, color: colors.amber, fontWeight: '700' },
  paidBadge: {
    backgroundColor: colors.success + '33',
    borderColor: colors.success + '66',
  },
  paidText: { color: colors.success },
  stepsWrap: {
    width: '100%',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepLine: { display: 'none' },
  stepLineDone: {},
  stepNum: { ...typography.micro, color: colors.textMuted },
  stepLabel: { ...typography.caption, color: colors.textMuted, flex: 1 },
  stepLabelDone: { color: colors.textBrandSuccess, fontWeight: '600' },
  chatBtn: { width: '100%', borderRadius: radius.xl, overflow: 'hidden' },
  chatBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  chatBtnText: { ...typography.bodyStrong, color: '#fff', fontSize: 16 },
  backBtn: {
    width: '100%', paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  backBtnText: { ...typography.bodyStrong, color: colors.textMuted },
});
