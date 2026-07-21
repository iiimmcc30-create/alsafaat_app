// SAFAT — ButcherCard reusable component
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { resolveMediaUrl } from '@/services/media';
import { ButcherProfile, gccCurrencies } from '@/services/butcherData';
import { countries } from '@/services/types';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&q=80';

interface ButcherCardProps {
  butcher: ButcherProfile;
  variant?: 'full' | 'compact';
  onPress?: () => void;
  onOrder?: () => void;
}

export function ButcherCard({ butcher, variant = 'full', onPress, onOrder }: ButcherCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { c, f } = useThemedStyles(({ colors }) => ({
    c: createCompactStyles(colors),
    f: createFullStyles(colors),
  }));
  const currency = gccCurrencies[butcher.country];
  const country = countries[butcher.country];

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    router.push({ pathname: '/butchers/[id]', params: { id: butcher.id } });
  };

  const handleOrder = () => {
    if (onOrder) {
      onOrder();
      return;
    }
    router.push({ pathname: '/butchers/order', params: { butcherId: butcher.id } });
  };

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [c.card, pressed && { opacity: 0.9 }]}
      >
        <Image
          source={{ uri: resolveMediaUrl(butcher.logo) }}
          style={c.logo}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <View style={c.nameRow}>
            <Text style={c.name} numberOfLines={1}>
              {butcher.nameAr}
            </Text>
            {butcher.subscriptionActive ? (
              <AppIcon name="shield-checkmark" size={12} color={colors.gold} />
            ) : null}
          </View>
          <View style={c.metaRow}>
            <Text style={c.flag}>{country.flag}</Text>
            <Text style={c.city}>{butcher.cityAr}</Text>
            <View style={c.dot} />
            <AppIcon name="star" size={10} color={colors.gold} />
            <Text style={c.rating}>{butcher.rating.toFixed(1)}</Text>
          </View>
        </View>
        <View
          style={[
            c.statusDot,
            { backgroundColor: butcher.workingHours.isOpen ? colors.success : colors.danger },
          ]}
        />
      </Pressable>
    );
  }

  return (
    <View style={f.cardWrap}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [f.card, pressed && { opacity: 0.96 }]}
      >
        <View style={f.coverWrap}>
          <Image
            source={{ uri: resolveMediaUrl(butcher.cover) ?? COVER_FALLBACK }}
            style={f.cover}
            contentFit="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.08)', 'transparent', 'rgba(0,0,0,0.82)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          {butcher.subscriptionActive ? (
            <View style={f.verifiedBadge}>
              <AppIcon name="shield-checkmark" size={11} color={colors.gold} />
              <Text style={f.verifiedText}>موثّق</Text>
            </View>
          ) : null}
          <View style={f.flagPill}>
            <Text style={f.flag}>{country.flag}</Text>
          </View>
          <View
            style={[
              f.statusPill,
              {
                backgroundColor: butcher.workingHours.isOpen
                  ? colors.success + 'D9'
                  : colors.danger + 'D9',
              },
            ]}
          >
            <View style={f.statusDot} />
            <Text style={f.statusText}>
              {butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}
            </Text>
          </View>
        </View>

        <View style={f.body}>
          <View style={f.logoRow}>
            <View style={f.logoWrap}>
              <Image
                source={{ uri: resolveMediaUrl(butcher.logo) }}
                style={f.logo}
                contentFit="cover"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={f.name} numberOfLines={1}>
                {butcher.nameAr}
              </Text>
              <View style={f.locationRow}>
                <AppIcon name="map-marker-outline" size={12} color={colors.textMuted} />
                <Text style={f.location} numberOfLines={1}>
                  {butcher.cityAr} · {country.ar}
                </Text>
              </View>
            </View>
            <View style={f.ratingPill}>
              <AppIcon name="star" size={12} color={colors.gold} />
              <Text style={f.rating}>{butcher.rating.toFixed(1)}</Text>
            </View>
          </View>

          {butcher.specialties.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={f.chipsScroll}>
              <View style={f.chipsRow}>
                {butcher.specialties.slice(0, 4).map((spec, i) => (
                  <View key={i} style={f.chip}>
                    <Text style={f.chipText}>{spec}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}

          <View style={f.statsRow}>
            <View style={f.stat}>
              <Text style={f.statNum}>{butcher.orderCompletionRate}%</Text>
              <Text style={f.statLbl}>إتمام</Text>
            </View>
            <View style={f.statDivider} />
            <View style={f.stat}>
              <Text style={f.statNum}>
                {butcher.totalOrders.toLocaleString('en-US')}
              </Text>
              <Text style={f.statLbl}>طلب</Text>
            </View>
            <View style={f.statDivider} />
            <View style={f.stat}>
              <Text style={f.statNum}>{currency.symbol}</Text>
              <Text style={f.statLbl}>العملة</Text>
            </View>
          </View>
        </View>
      </Pressable>

      <Pressable
        onPress={handleOrder}
        style={({ pressed }) => [f.orderBtn, pressed && { opacity: 0.88 }]}
      >
        <LinearGradient
          colors={[colors.electric, colors.cyan]}
          style={f.orderBtnGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <AppIcon name="bag-add-outline" size={16} color="#fff" />
          <Text style={f.orderBtnText}>اطلب الآن</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function createCompactStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      padding: spacing.md,
      backgroundColor: colors.bgSurface,
    },
    logo: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.bgElevated,
      borderWidth: 1.5,
      borderColor: colors.borderMid,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    name: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '700',
      flex: 1,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    flag: { fontSize: 12 },
    city: { ...typography.micro, color: colors.textMuted },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.textSubtle,
    },
    rating: { ...typography.micro, color: colors.gold, fontWeight: '700' },
    statusDot: { width: 9, height: 9, borderRadius: 5 },
  });
}

function createFullStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cardWrap: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      overflow: 'hidden',
    },
    coverWrap: { height: 148, position: 'relative', backgroundColor: colors.bgElevated },
    cover: { width: '100%', height: '100%' },
    verifiedBadge: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.gold + '66',
    },
    verifiedText: { ...typography.micro, color: colors.gold, fontWeight: '700' },
    flagPill: {
      position: 'absolute',
      top: spacing.md,
      left: spacing.md,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    flag: { fontSize: 15 },
    statusPill: {
      position: 'absolute',
      bottom: spacing.md,
      left: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
    statusText: { ...typography.micro, color: '#fff', fontWeight: '600' },
    body: { padding: spacing.md, paddingBottom: spacing.sm },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    logoWrap: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 2,
      borderColor: colors.borderMid,
      overflow: 'hidden',
      backgroundColor: colors.bgElevated,
      marginTop: -28,
    },
    logo: { width: '100%', height: '100%' },
    name: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 17 },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    location: { ...typography.caption, color: colors.textMuted, flex: 1 },
    ratingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.gold + '16',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.gold + '44',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    rating: { ...typography.caption, color: colors.gold, fontWeight: '800' },
    chipsScroll: { marginTop: spacing.sm },
    chipsRow: { flexDirection: 'row', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    chipText: { ...typography.micro, color: colors.textBrand, fontWeight: '600' },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSoft,
    },
    stat: { flex: 1, alignItems: 'center', gap: 1 },
    statNum: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    statLbl: { ...typography.micro, color: colors.textMuted, fontSize: 10 },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 22,
      backgroundColor: colors.borderSoft,
    },
    orderBtn: {
      marginTop: spacing.sm,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    orderBtnGrad: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: radius.xl,
    },
    orderBtnText: { ...typography.bodyStrong, color: '#fff' },
  });
}
