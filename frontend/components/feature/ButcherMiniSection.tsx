// Powered by OnSpace.AI
// SAFAT — ButcherMiniSection
// Embed this on any home/tab screen to surface the top butchers.

import { Ionicons } from '@expo/vector-icons';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { rtlForwardIcon, rtlRow } from '@/lib/rtl';
import {
  ButcherStory,
  gccCurrencies,
} from '@/services/butcherData';
import { countries } from '@/services/types';
import { useButcher } from '@/hooks/useButcher';

const STORY_RING_COLORS = {
  daily_slaughter: ['#EF4444', '#DC2626'],
  offer:           ['#F59E0B', '#D97706'],
  new_stock:       ['#10B981', '#059669'],
  update:          ['#3B82F6', '#2563EB'],
} as const;

interface ButcherMiniSectionProps {
  /** Max butchers to display in horizontal scroll */
  limit?: number;
  /** Show stories row above cards */
  showStories?: boolean;
}

export function ButcherMiniSection({
  limit = 5,
  showStories = true,
}: ButcherMiniSectionProps) {
  const router = useRouter();
  const { filteredButchers, stories, loading } = useButcher();
  const ranked = filteredButchers.slice(0, limit);

  return (
    <View style={s.wrapper}>
      {/* Section header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View>
            <Text style={s.title}>الملاحم</Text>
            <Text style={s.subtitle}>لحوم طازجة قريبة منك</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/butchers')}
          style={s.seeAllBtn}
        >
          <Text style={s.seeAllText}>عرض الكل</Text>
          <Ionicons name={rtlForwardIcon} size={14} color={colors.electricBright} />
        </Pressable>
      </View>

      {/* Stories strip */}
      {showStories && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.storiesRow}
        >
          {stories.slice(0, 5).map((story) => {
            const ringColors = STORY_RING_COLORS[story.type] ?? STORY_RING_COLORS.update;
            const storyLabel = (story.butcherNameAr || story.butcherName || 'ملحمة').split(' ')[0];
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
                    <Ionicons name="shield-checkmark" size={8} color={colors.gold} />
                  </View>
                )}
                <Text style={s.storyName} numberOfLines={1}>
                  {storyLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Butcher mini cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.cardsRow}
      >
        {ranked.map((butcher) => {
          const currency = gccCurrencies[butcher.country];
          const country = countries[butcher.country];

          return (
            <Pressable
              key={butcher.id}
              style={({ pressed }) => [s.miniCard, pressed && { opacity: 0.88 }]}
              onPress={() =>
                router.push({ pathname: '/butchers/[id]', params: { id: butcher.id } })
              }
            >
              {/* Cover */}
              <View style={s.miniCoverWrap}>
                <Image source={uriSource(butcher.cover)} style={s.miniCover} contentFit="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(6,9,26,0.85)']}
                  style={StyleSheet.absoluteFill}
                />
                {butcher.subscriptionActive && (
                  <View style={s.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={10} color="#1A1300" />
                  </View>
                )}
                <View style={[
                  s.miniStatus,
                  { backgroundColor: butcher.workingHours.isOpen ? colors.success + 'CC' : colors.danger + 'CC' },
                ]}>
                  <Text style={s.miniStatusText}>
                    {butcher.workingHours.isOpen ? 'مفتوح' : 'مغلق'}
                  </Text>
                </View>
              </View>

              {/* Info */}
              <View style={s.miniInfo}>
                <View style={s.miniLogoRow}>
                  <Image source={uriSource(butcher.logo)} style={s.miniLogo} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.miniName} numberOfLines={1}>{butcher.nameAr}</Text>
                    <Text style={s.miniCity}>
                      {country.flag} {butcher.cityAr}
                    </Text>
                  </View>
                </View>
                <View style={s.miniMeta}>
                  <Ionicons name="star" size={11} color={colors.gold} />
                  <Text style={s.miniRating}>{butcher.rating.toFixed(1)}</Text>
                  <View style={s.miniDivider} />
                  <Text style={s.miniCurrency}>{currency.symbol}</Text>
                  <View style={s.miniDivider} />
                  <Text style={s.miniOrders}>{butcher.totalOrders.toLocaleString()} طلب</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const STORY_SIZE = 54;

const s = StyleSheet.create({
  wrapper: { marginVertical: spacing.lg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.micro, color: colors.glow, marginTop: 1 },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.electric + '11',
    borderWidth: 1,
    borderColor: colors.electricBright + '44',
  },
  seeAllText: { ...typography.micro, color: colors.electricBright },

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
  },

  // Cards
  cardsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  miniCard: {
    width: 190,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  miniCoverWrap: { height: 100, position: 'relative' },
  miniCover: { width: '100%', height: '100%' },
  verifiedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStatus: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  miniStatusText: { ...typography.micro, color: '#fff' },
  miniInfo: { padding: spacing.sm, gap: 6 },
  miniLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  miniName: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  miniCity: { ...typography.micro, color: colors.textMuted, marginTop: 1 },
  miniMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  miniRating: { ...typography.micro, color: colors.gold, fontWeight: '700' },
  miniDivider: { width: 1, height: 10, backgroundColor: colors.borderSoft },
  miniCurrency: { ...typography.micro, color: colors.textMuted },
  miniOrders: { ...typography.micro, color: colors.textMuted, flex: 1 },
});
