// Powered by OnSpace.AI
// SAFAT — ButchersSidebarEntry
// A self-contained sidebar card for the Butchers section.
// Import and render this inside SidebarScreen between sections.

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlForwardIcon, rtlRow } from '@/lib/rtl';
import { useState, useEffect } from 'react';
import { API_BASE } from '@/services/api';

export function ButchersSidebarEntry() {
  const router = useRouter();
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/butchers`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data?.butchers)) {
            const list = json.data.butchers;
            setVerifiedCount(list.filter((b: any) => b.subscriptionActive).length);
            setOpenCount(list.filter((b: any) => b.isOpen ?? true).length);
          }
        }
      } catch (err) {
        console.warn('[ButchersSidebarEntry] Failed to fetch counts:', err);
      }
    };
    fetchCounts();
  }, []);

  const SUB_ITEMS = [
    {
      icon: 'storefront-outline' as const,
      label: 'Butchers Marketplace',
      arabic: 'سوق الملاحم',
      route: '/butchers' as const,
    },
    {
      icon: 'map-outline' as const,
      label: 'Map View',
      arabic: 'خريطة الملاحم',
      route: '/butchers/map' as const,
    },
    {
      icon: 'add-circle-outline' as const,
      label: 'Register My Butcher',
      arabic: 'سجّل ملحمتك',
      route: '/butchers/register' as const,
    },
    {
      icon: 'bar-chart-outline' as const,
      label: 'Analytics Dashboard',
      arabic: 'لوحة التحليلات',
      route: '/butchers/dashboard' as const,
    },
    {
      icon: 'settings-outline' as const,
      label: 'Manage Shop',
      arabic: 'إدارة الملحمة',
      route: '/butchers/manage' as const,
    },
  ];

  const navigate = (route: string) => {
    router.back();
    setTimeout(() => router.push(route as any), 120);
  };

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>الملاحم</Text>

      {/* Hero banner */}
      <Pressable
        onPress={() => navigate('/butchers')}
        style={s.heroBanner}
      >
        <LinearGradient
          colors={['#7C2D12', '#B45309', '#92400E']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={s.heroIcon}>🥩</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>قسم الملاحم</Text>
          <Text style={s.heroSub}>لحوم طازجة · دول الخليج</Text>
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Ionicons name="shield-checkmark" size={11} color={colors.gold} />
              <Text style={s.heroStatText}>{verifiedCount} موثّق</Text>
            </View>
            <View style={s.heroDot} />
            <View style={s.heroStat}>
              <View style={s.openDot} />
              <Text style={s.heroStatText}>{openCount} مفتوح الآن</Text>
            </View>
          </View>
        </View>
        <Ionicons name={rtlForwardIcon} size={20} color="rgba(255,255,255,0.6)" />
      </Pressable>

      {/* Sub-items card */}
      <View style={s.card}>
        {SUB_ITEMS.map((item, idx) => (
          <Pressable
            key={item.route}
            onPress={() => navigate(item.route)}
            style={({ pressed }) => [
              s.row,
              idx < SUB_ITEMS.length - 1 && s.rowDivider,
              pressed && { backgroundColor: colors.bgElevated },
            ]}
          >
            <View style={s.rowIcon}>
              <Ionicons name={item.icon} size={19} color={colors.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{item.arabic}</Text>
            </View>
            <Ionicons name={rtlForwardIcon} size={17} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      {/* Subscription CTA */}
      <Pressable
        onPress={() => navigate('/butchers/register')}
        style={s.subscriptionCta}
      >
        <LinearGradient
          colors={[colors.gold + '33', colors.amber + '11']}
          style={StyleSheet.absoluteFill}
        />
        <MaterialCommunityIcons name="shield-star-outline" size={20} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={s.ctaTitle}>سجّل ملحمتك الموثّقة</Text>
          <Text style={s.ctaSub}>٢٩٩ ر.س/شهر · شارة التوثيق · أولوية البحث</Text>
        </View>
        <View style={s.ctaBadge}>
          <Text style={s.ctaBadgeText}>موثّق</Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.micro,
    color: colors.textSubtle,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    letterSpacing: 1,
  },

  // Hero banner
  heroBanner: {
    ...rtlRow,
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.amber + '44',
  },
  heroIcon: { fontSize: 32 },
  heroTitle: { ...typography.bodyStrong, color: '#fff' },
  heroSub: { ...typography.micro, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  heroStats: { ...rtlRow, alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  heroStat: { ...rtlRow, alignItems: 'center', gap: 4 },
  heroStatText: { ...typography.micro, color: 'rgba(255,255,255,0.75)' },
  heroDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  openDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.success,
  },

  // Card
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  row: {
    ...rtlRow,
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.amber + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { ...typography.bodyStrong, color: colors.textPrimary },
  rowArabic: { ...typography.caption, color: colors.textMuted },

  // Subscription CTA
  subscriptionCta: {
    ...rtlRow,
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gold + '44',
    overflow: 'hidden',
    position: 'relative',
  },
  ctaTitle: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  ctaSub: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
  ctaBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  ctaBadgeText: { ...typography.micro, color: '#1A1300', fontWeight: '700' },
});
