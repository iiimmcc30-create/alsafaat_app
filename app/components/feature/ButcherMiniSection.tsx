// Powered by OnSpace.AI
// SAFAT — ButcherMiniSection — Hungerstation-style horizontal cards
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  colors,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlForwardIcon } from '@/lib/rtl';
import { gccCurrencies } from '@/services/butcherData';
import { countries } from '@/services/types';
import { useButcher } from '@/hooks/useButcher';

const STORY_RING_COLORS = {
  daily_slaughter: ['#EF4444', '#DC2626'],
  offer:           ['#F59E0B', '#D97706'],
  new_stock:       ['#10B981', '#059669'],
  update:          ['#3B82F6', '#2563EB'],
} as const;

// Card dimensions
const CARD_W_COMPACT = 220;
const COVER_H_COMPACT = 148;
const STORY_SIZE  = 52;

interface ButcherMiniSectionProps {
  limit?:       number;
  showStories?: boolean;
  size?:        'compact' | 'hero';
}

export function ButcherMiniSection({
  limit = 6,
  showStories = true,
  size = 'compact',
}: ButcherMiniSectionProps) {
  const router      = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const s           = useThemedStyles(({ colors }) => createStyles(colors));
  const isHero = size === 'hero';
  const CARD_W = isHero ? Math.round(screenWidth * 0.84) : CARD_W_COMPACT;
  const COVER_H = isHero ? 210 : COVER_H_COMPACT;

  const { filteredButchers, stories, loading } = useButcher();
  const ranked = filteredButchers.slice(0, limit);

  return (
    <View style={[s.wrapper, isHero && s.wrapperHero]}>

      {/* ── Section header ─────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>الملاحم</Text>
          {!isHero ? <Text style={s.subtitle}>لحوم طازجة قريبة منك</Text> : null}
        </View>
        <Pressable style={s.seeAllBtn} onPress={() => router.push('/butchers')}>
          <Text style={s.seeAllText}>عرض الكل</Text>
          <AppIcon name={rtlForwardIcon} size={13} color={colors.electricBright} />
        </Pressable>
      </View>

      {/* ── Stories strip ──────────────────────────────────────────── */}
      {showStories && stories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.storiesRow}
        >
          {stories.slice(0, 6).map((story) => {
            const ringColors =
              STORY_RING_COLORS[story.type as keyof typeof STORY_RING_COLORS] ??
              STORY_RING_COLORS.update;
            const label = (story.butcherNameAr || story.butcherName || 'ملحمة').split(' ')[0];
            return (
              <Pressable
                key={story.id}
                style={s.storyItem}
                onPress={() =>
                  router.push({
                    pathname: '/butchers/story-viewer',
                    params: { butcherId: story.butcherId, storyId: story.id },
                  })
                }
              >
                <LinearGradient
                  colors={story.seen ? [colors.borderSoft, colors.borderSoft] : ringColors}
                  style={s.storyRing}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Image
                    source={uriSource(story.butcherLogo || story.thumbnail)}
                    style={s.storyAvatar}
                    contentFit="cover"
                  />
                </LinearGradient>
                {story.isVerified && (
                  <View style={s.verifiedDot}>
                    <AppIcon name="shield-checkmark" size={8} color={colors.gold} />
                  </View>
                )}
                <Text style={s.storyName} numberOfLines={1}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Butcher cards ──────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.cardsRow}
        decelerationRate="fast"
        snapToInterval={CARD_W + spacing.md}
        snapToAlignment="start"
      >
        {loading && ranked.length === 0 ? (
          <View style={[s.skeleton, { width: CARD_W, height: COVER_H + (isHero ? 0 : 80) }]}>
            <Text style={s.skeletonText}>جاري التحميل...</Text>
          </View>
        ) : ranked.length === 0 ? (
          <Pressable
            style={[s.skeleton, { width: CARD_W, height: COVER_H + (isHero ? 0 : 80) }]}
            onPress={() => router.push('/butchers')}
          >
            <AppIcon name="storefront-outline" size={26} color={colors.electricBright} />
            <Text style={s.skeletonText}>لا توجد ملاحم حالياً</Text>
          </Pressable>
        ) : (
          ranked.map((butcher) => {
            const currency   = gccCurrencies[butcher.country];
            const country    = countries[butcher.country];
            const isFeatured = butcher.subscriptionActive;
            const isTopRated = butcher.rating >= 4.5;
            const isNew      = (butcher.totalOrders ?? 0) < 20;

            return (
              <Pressable
                key={butcher.id}
                style={({ pressed }) => [
                  s.card,
                  { width: CARD_W },
                  isHero && s.cardHero,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() =>
                  router.push({ pathname: '/butchers/[id]', params: { id: butcher.id } })
                }
              >
                <View style={[s.coverWrap, { height: COVER_H }]}>
                  <Image
                    source={uriSource(butcher.cover || butcher.logo)}
                    style={s.cover}
                    contentFit="cover"
                  />

                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.88)']}
                    locations={[0.2, 0.55, 1]}
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={s.topRow}>
                    {isNew ? (
                      <View style={s.newBadge}>
                        <Text style={s.newBadgeText}>جديد</Text>
                      </View>
                    ) : (
                      <View />
                    )}
                    <View style={s.heartBtn}>
                      <AppIcon name="heart-outline" size={isHero ? 17 : 15} color="#fff" />
                    </View>
                  </View>

                  {!isHero ? (
                    <View style={s.topRight}>
                      <View style={s.ratingChip}>
                        <AppIcon name="star" size={11} color={colors.gold} />
                        <Text style={s.ratingText}>{butcher.rating.toFixed(1)}</Text>
                        <Text style={s.ratingCount}>
                          ({butcher.totalOrders > 999
                            ? (butcher.totalOrders / 1000).toFixed(1) + 'k'
                            : butcher.totalOrders})
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View
                    style={[
                      s.statusPill,
                      isHero && s.statusPillHero,
                      {
                        backgroundColor: butcher.workingHours.isOpen
                          ? 'rgba(16,185,129,0.9)'
                          : 'rgba(239,68,68,0.9)',
                      },
                    ]}
                  >
                    <View style={s.statusDot} />
                    <Text style={s.statusText}>
                      {butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}
                    </Text>
                  </View>

                  {isHero ? (
                    <View style={s.heroOverlay}>
                      <View style={s.heroRatingRow}>
                        <View style={s.ratingChip}>
                          <AppIcon name="star" size={12} color={colors.gold} />
                          <Text style={s.ratingText}>{butcher.rating.toFixed(1)}</Text>
                          <Text style={s.ratingCount}>
                            ({butcher.totalOrders > 999
                              ? (butcher.totalOrders / 1000).toFixed(1) + 'k'
                              : butcher.totalOrders})
                          </Text>
                        </View>
                      </View>
                      <Text style={s.heroName} numberOfLines={1}>{butcher.nameAr}</Text>
                      <View style={s.heroMetaRow}>
                        <View style={s.metaItem}>
                          <AppIcon name="map-marker-outline" size={12} color="rgba(255,255,255,0.9)" />
                          <Text style={s.heroMetaText}>{butcher.cityAr}</Text>
                        </View>
                        <View style={s.metaDotLight} />
                        <View style={s.metaItem}>
                          <AppIcon name="bicycle-outline" size={12} color="rgba(255,255,255,0.9)" />
                          <Text style={s.heroMetaText}>
                            {butcher.workingHours.isOpen ? '20-35 دقيقة' : 'مغلق حالياً'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {!isHero && (isTopRated || isFeatured) && (
                    <View style={s.badgesRow}>
                      {isTopRated && (
                        <View style={s.badgePreferred}>
                          <AppIcon name="checkmark-circle" size={10} color="#fff" />
                          <Text style={s.badgeText}>الأعلى تقييماً</Text>
                        </View>
                      )}
                      {isFeatured && (
                        <View style={s.badgeFeatured}>
                          <AppIcon name="star" size={10} color="#1A1300" />
                          <Text style={[s.badgeText, { color: '#1A1300' }]}>مميز</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {!isHero ? (
                  <View style={s.info}>
                    <Text style={s.name} numberOfLines={1}>{butcher.nameAr}</Text>
                    <Text style={s.tagLine} numberOfLines={1}>
                      {country?.flag} {butcher.cityAr}
                      {currency ? `  ·  ${currency.symbol}` : ''}
                    </Text>
                    <View style={s.metaRow}>
                      <View style={s.metaItem}>
                        <AppIcon name="clock-outline" size={11} color={colors.textMuted} />
                        <Text style={s.metaText}>
                          {butcher.workingHours.isOpen ? '20-35 دق' : 'مغلق حالياً'}
                        </Text>
                      </View>
                      <View style={s.metaDot} />
                      <View style={s.metaItem}>
                        <AppIcon name="people-outline" size={11} color={colors.textMuted} />
                        <Text style={s.metaText}>
                          {butcher.totalOrders.toLocaleString()} طلب
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: { marginVertical: spacing.lg },
    wrapperHero: { marginTop: spacing.sm, marginBottom: spacing.md },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    headerLeft: { gap: 2 },
    title:      { ...typography.h3, color: colors.textPrimary, fontWeight: '800' },
    subtitle:   { ...typography.micro, color: colors.textBrand },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.electric + '14',
      borderWidth: 1,
      borderColor: colors.electricBright + '40',
    },
    seeAllText: { ...typography.micro, color: colors.textBrandStrong, fontWeight: '700' },

    // Stories
    storiesRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    storyItem: {
      alignItems: 'center',
      gap: 4,
      position: 'relative',
      width: STORY_SIZE + 4,
    },
    storyRing: {
      width: STORY_SIZE + 4,
      height: STORY_SIZE + 4,
      borderRadius: (STORY_SIZE + 4) / 2,
      padding: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    storyAvatar: {
      width: STORY_SIZE,
      height: STORY_SIZE,
      borderRadius: STORY_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.bgDeep,
      backgroundColor: colors.bgSurface,
    },
    verifiedDot: {
      position: 'absolute',
      bottom: 16,
      right: 0,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.bgDeep,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.gold + '55',
    },
    storyName: {
      ...typography.micro,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: STORY_SIZE + 4,
      fontSize: 10,
    },

    // Cards scroll
    cardsRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      paddingBottom: 4,
    },

    // Card
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
    },
    cardHero: {
      borderRadius: radius.xxl,
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 6,
    },

    // Cover
    coverWrap: {
      position: 'relative',
    },
    cover: {
      width: '100%',
      height: '100%',
    },

    // Top row overlays
    topRow: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 2,
    },
    topRight: {
      position: 'absolute',
      top: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      zIndex: 2,
    },
    heartBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    newBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.success,
    },
    newBadgeText: {
      ...typography.micro,
      color: '#fff',
      fontWeight: '800',
      fontSize: 9,
    },
    ratingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    ratingText: {
      ...typography.micro,
      color: '#fff',
      fontWeight: '800',
      fontSize: 11,
    },
    ratingCount: {
      ...typography.micro,
      color: 'rgba(255,255,255,0.75)',
      fontSize: 9,
    },

    // Open/closed pill (bottom-left of cover)
    statusPill: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.pill,
      zIndex: 2,
    },
    statusPillHero: {
      top: 88,
      bottom: undefined,
      right: 12,
      left: undefined,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#fff',
    },
    statusText: {
      ...typography.micro,
      color: '#fff',
      fontWeight: '700',
      fontSize: 10,
    },

    // Bottom badges (top-rated, featured) on cover
    badgesRow: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      flexDirection: 'row',
      gap: 4,
    },
    badgePreferred: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(59,130,246,0.88)',
    },
    badgeFeatured: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.gold,
    },
    badgeText: {
      ...typography.micro,
      color: '#fff',
      fontWeight: '700',
      fontSize: 9,
    },

    heroOverlay: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      gap: 6,
      zIndex: 2,
    },
    heroRatingRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    heroName: {
      fontSize: 18,
      fontWeight: '800',
      color: '#fff',
      textAlign: 'right',
    },
    heroMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      justifyContent: 'flex-end',
    },
    heroMetaText: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.92)',
      fontSize: 12,
    },
    metaDotLight: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.45)',
    },

    // Info section
    info: {
      padding: spacing.sm,
      paddingHorizontal: 12,
      gap: 4,
    },
    name: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 14,
    },
    tagLine: {
      ...typography.micro,
      color: colors.textSecondary,
      fontSize: 11,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderHairline,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    metaText: {
      ...typography.micro,
      color: colors.textMuted,
      fontSize: 10,
    },
    metaDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.borderSoft,
    },

    // Skeleton / empty
    skeleton: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    skeletonText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  });
}
