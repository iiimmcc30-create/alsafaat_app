// Customer order details with realtime timeline
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { CUT_LABELS, CutType } from '@/services/butcherData';
import { useOrderSocket } from '@/hooks/useOrderSocket';

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  pending: colors.amber,
  confirmed: colors.electricBright,
  preparing: colors.cyan,
  ready: colors.success,
  delivered: colors.success,
  cancelled: colors.danger,
};

const FLOW: string[] = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    if (!id || !accessToken) return;
    try {
      const res = await fetch(`${API_BASE}/api/butchers/orders/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setOrder(json.data);
      }
    } catch (err) {
      console.warn('[OrderDetails] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useOrderSocket(accessToken, id, () => {
    loadOrder();
  });

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <ActivityIndicator size="large" color={colors.electricBright} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={s.screen}>
        <Text style={s.errorText}>تعذر تحميل تفاصيل الطلب</Text>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[order.status] ?? colors.textMuted;
  const timeline: any[] = Array.isArray(order.timeline) ? order.timeline : [];
  const reached = new Set(timeline.map((t) => t.status));

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>تفاصيل الطلب</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <Text style={s.orderNumber}>{order.orderNumber}</Text>
          <View style={[s.badge, { borderColor: statusColor + '88', backgroundColor: statusColor + '22' }]}>
            <Text style={[s.badgeText, { color: statusColor }]}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>متابعة الطلب</Text>
          {order.status === 'cancelled' ? (
            timeline.map((event) => (
              <View key={event.id} style={s.timelineRow}>
                <AppIcon name="checkmark-circle" size={18} color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text style={s.timelineLabel}>{STATUS_LABELS[event.status] ?? event.status}</Text>
                  {event.note ? <Text style={s.timelineNote}>{event.note}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            FLOW.map((step) => {
              const done = reached.has(step) || order.status === step;
              return (
                <View key={step} style={s.timelineRow}>
                  <AppIcon
                    name={done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={done ? colors.success : colors.textMuted}
                  />
                  <Text style={[s.timelineLabel, done && s.timelineDone]}>
                    {STATUS_LABELS[step]}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>تفاصيل الطلب</Text>
          <Row label="المنتج" value={order.product?.nameAr ?? '—'} />
          <Row label="التقطيع" value={CUT_LABELS[order.cutType as CutType]?.ar ?? order.cutType} />
          <Row label="الوزن" value={`${order.weightKg} كغ`} />
          <Row label="الكمية المحجوزة" value={`${order.reservedQuantity ?? order.weightKg} كغ`} />
          <Row label="السعر" value={`${order.totalPrice} ${order.currency || 'SAR'}`} />
          <Row
            label="الاستلام"
            value={order.deliveryType === 'delivery' ? 'توصيل' : 'استلام من الملحمة'}
          />
          {order.deliveryAddress ? <Row label="العنوان" value={order.deliveryAddress} /> : null}
          {order.notes ? <Row label="ملاحظات" value={order.notes} /> : null}
          {order.cancellationReason ? (
            <Row label="سبب الإلغاء" value={order.cancellationReason} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  orderNumber: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  badge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: { ...typography.caption, fontWeight: '700', writingDirection: 'rtl' },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  timelineLabel: { ...typography.body, color: colors.textMuted, textAlign: 'right', writingDirection: 'rtl' },
  timelineDone: { color: colors.textBrandSuccess, fontWeight: '600' },
  timelineNote: { ...typography.caption, color: colors.textMuted, textAlign: 'right', writingDirection: 'rtl' },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 4,
  },
  rowLabel: { ...typography.caption, color: colors.textMuted, writingDirection: 'rtl' },
  rowValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  errorText: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: 80 },
});
