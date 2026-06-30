// Powered by OnSpace.AI
// SAFAT — ButcherCard reusable component

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { ButcherProfile, gccCurrencies } from '@/services/butcherData';
import { countries } from '@/services/types';

interface ButcherCardProps {
  butcher: ButcherProfile;
  /** compact = horizontal mini-card; full = full listing card (default) */
  variant?: 'full' | 'compact';
  onPress?: () => void;
}

export function ButcherCard({ butcher, variant = 'full', onPress }: ButcherCardProps) {
  const router = useRouter();
  const currency = gccCurrencies[butcher.country];
  const country = countries[butcher.country];

  const handlePress = () => {
    if (onPress) { onPress(); return; }
    router.push({ pathname: '/butchers/[id]', params: { id: butcher.id } });
  };

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [c.card, pressed && { opacity: 0.88 }]}
      >
        <LinearGradient colors={[colors.bgSurface, colors.bgElevated]} style={StyleSheet.absoluteFill} />
        <Image source={{ uri: butcher.logo }} style={c.logo} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <View style={c.nameRow}>
            <Text style={c.name} numberOfLines={1}>{butcher.nameAr}</Text>
            {butcher.subscriptionActive && (
              <Ionicons name="shield-checkmark" size={12} color={colors.gold} />
            )}
          </View>
          <View style={c.metaRow}>
            <Text style={c.flag}>{country.flag}</Text>
            <Text style={c.city}>{butcher.cityAr}</Text>
            <View style={c.dot} />
            <Ionicons name="star" size={10} color={colors.gold} />
            <Text style={c.rating}>{butcher.rating.toFixed(1)}</Text>
          </View>
        </View>
        <View style={[c.statusDot, { backgroundColor: butcher.workingHours.isOpen ? colors.success : colors.danger }]} />
      </Pressable>
    );
  }

  // Full card
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [f.card, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}
    >
      {/* Cover */}
      <View style={f.coverWrap}>
        <Image source={{ uri: butcher.cover }} style={f.cover} contentFit="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(6,9,26,0.88)']}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
        />
        {butcher.subscriptionActive && (
          <LinearGradient
            colors={[colors.gold, '#F59E0B']}
            style={f.verifiedBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="shield-checkmark" size={11} color="#1A1300" />
            <Text style={f.verifiedText}>موثّق</Text>
          </LinearGradient>
        )}
        <View style={f.flagPill}>
          <Text style={f.flag}>{country.flag}</Text>
        </View>
        <View style={[
          f.statusPill,
          { backgroundColor: butcher.workingHours.isOpen ? colors.success + 'CC' : colors.danger + 'CC' },
        ]}>
          <View style={f.statusDot} />
          <Text style={f.statusText}>{butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={f.body}>
        <View style={f.logoRow}>
          <View style={f.logoWrap}>
            <Image source={{ uri: butcher.logo }} style={f.logo} contentFit="cover" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={f.name} numberOfLines={1}>{butcher.nameAr}</Text>
            <View style={f.locationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.glow} />
              <Text style={f.location}>{butcher.cityAr} · {country.ar}</Text>
            </View>
          </View>
          <View style={f.ratingPill}>
            <Ionicons name="star" size={12} color={colors.gold} />
            <Text style={f.rating}>{butcher.rating.toFixed(1)}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={f.chipsRow}>
            {butcher.specialties.slice(0, 4).map((spec, i) => (
              <View key={i} style={f.chip}>
                <Text style={f.chipText}>{spec}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={f.statsRow}>
          <View style={f.stat}>
            <MaterialCommunityIcons name="check-circle-outline" size={13} color={colors.success} />
            <Text style={f.statText}>{butcher.orderCompletionRate}% إتمام</Text>
          </View>
          <View style={f.statDivider} />
          <View style={f.stat}>
            <Ionicons name="bag-outline" size={13} color={colors.electricBright} />
            <Text style={f.statText}>{butcher.totalOrders.toLocaleString()} طلب</Text>
          </View>
          <View style={f.statDivider} />
          <View style={f.stat}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={f.statText}>{butcher.workingHours.open}–{butcher.workingHours.close}</Text>
          </View>
          <View style={f.statDivider} />
          <View style={f.stat}>
            <Text style={f.currencyText}>{currency.symbol}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Compact styles ───────────────────────────────────────────────────────────
const c = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  logo: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5, borderColor: colors.borderMid,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { ...typography.caption, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  flag: { fontSize: 12 },
  city: { ...typography.micro, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textSubtle },
  rating: { ...typography.micro, color: colors.gold, fontWeight: '700' },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
});

// ─── Full card styles ─────────────────────────────────────────────────────────
const f = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  coverWrap: { height: 160, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  verifiedBadge: {
    position: 'absolute',
    top: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  verifiedText: { ...typography.micro, color: '#1A1300', fontWeight: '700' },
  flagPill: {
    position: 'absolute',
    top: spacing.md, left: spacing.md,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(6,9,26,0.7)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  flag: { fontSize: 14 },
  statusPill: {
    position: 'absolute',
    bottom: spacing.md, left: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  statusText: { ...typography.micro, color: '#fff' },
  body: { padding: spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoWrap: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: colors.borderMid,
    overflow: 'hidden', backgroundColor: colors.bgElevated,
  },
  logo: { width: '100%', height: '100%' },
  name: { ...typography.h3, color: colors.textPrimary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  location: { ...typography.caption, color: colors.textMuted },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.gold + '22',
    borderWidth: 1, borderColor: colors.gold + '44',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  rating: { ...typography.caption, color: colors.gold, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  chipText: { ...typography.micro, color: colors.glow },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
    gap: spacing.md,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  statText: { ...typography.micro, color: colors.textMuted, flex: 1 },
  statDivider: { width: 1, height: 14, backgroundColor: colors.borderSoft },
  currencyText: { ...typography.micro, color: colors.textMuted },
});
