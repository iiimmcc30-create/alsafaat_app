// Powered by OnSpace.AI
// SAFAT — Home Tab (الصفاة)

import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, useRef } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { colors, headerFadeGradient, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/hooks/useApp';
import { StoriesBar } from '@/components/feature/StoriesBar';
import { fetchStoriesFeed, type StoryGroup } from '@/services/stories';
import { ButcherMiniSection } from '@/components/feature/ButcherMiniSection';
import { CategoryChips, CategoryKey } from '@/components/feature/CategoryChips';
import { ListingCard } from '@/components/feature/ListingCard';
import { requireAuth } from '@/lib/postInteractions';
import { fetchLiveStreamEligibility } from '@/lib/liveStreamAccess';

import { NotificationBellButton } from '@/components/notifications/NotificationBellButton';
import { BRAND_DISPLAY_NAME } from '@/constants/brandCopy';
import type { Listing } from '@/services/types';

const HOME_REFRESH_TTL_MS = 60_000;

export default function HomeScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const styles = useThemedStyles(({ colors }) => createHomeStyles(colors));
  const headerFade = headerFadeGradient(scheme);
  const { me, listings } = useApp();
  const { accessToken, isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [storiesFeed, setStoriesFeed] = useState<StoryGroup[]>([]);
  const [myStories, setMyStories] = useState<StoryGroup | null>(null);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [canShowLive, setCanShowLive] = useState(false);
  const lastStoriesAt = useRef(0);
  const lastLiveAt = useRef(0);

  const refreshLiveAccess = useCallback(async (force = false) => {
    if (!accessToken || !isAuthenticated) {
      setCanShowLive(false);
      return;
    }
    const now = Date.now();
    if (!force && now - lastLiveAt.current < HOME_REFRESH_TTL_MS) return;
    lastLiveAt.current = now;
    const { canStream } = await fetchLiveStreamEligibility(accessToken);
    setCanShowLive(canStream);
  }, [accessToken, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      void refreshLiveAccess();
    }, [refreshLiveAccess]),
  );

  const fetchStories = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastStoriesAt.current < HOME_REFRESH_TTL_MS && storiesFeed.length > 0) {
      return;
    }
    setStoriesLoading(true);
    try {
      const data = await fetchStoriesFeed(accessToken);
      setStoriesFeed(data.items ?? []);
      setMyStories(data.myStories ?? null);
      lastStoriesAt.current = Date.now();
    } catch (err) {
      console.warn('[HomeScreen] Failed to fetch stories:', err);
    } finally {
      setStoriesLoading(false);
    }
  }, [accessToken, storiesFeed.length]);

  useFocusEffect(
    useCallback(() => {
      void fetchStories();
    }, [fetchStories]),
  );

  const displayedListings = useMemo(() => {
    const filtered =
      activeCategory !== 'all'
        ? listings.filter((l) => l.category === activeCategory)
        : listings;
    return filtered.slice().sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [listings, activeCategory]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Listing>) => (
      <ListingCard
        listing={item}
        variant="list"
        onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
      />
    ),
    [router],
  );

  const keyExtractor = useCallback((item: Listing) => item.id, []);

  const renderListHeader = useCallback(
    () => (
      <View>
        <StoriesBar
          feed={storiesFeed}
          myStories={myStories}
          myAvatar={me.avatar}
          currentUserId={me.id}
          accessToken={accessToken}
          loading={storiesLoading}
          onAddStory={() => {
            if (!requireAuth(isAuthenticated, 'نشر قصة')) return;
            router.push('/create/story');
          }}
          onRefresh={() => void fetchStories(true)}
        />

        <CategoryChips value={activeCategory} onChange={setActiveCategory} />

        <ButcherMiniSection showStories limit={5} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الإعلانات</Text>
          <Pressable onPress={() => router.push('/(tabs)/market')} hitSlop={8}>
            <Text style={styles.sectionLink}>السوق</Text>
          </Pressable>
        </View>
      </View>
    ),
    [
      storiesFeed,
      myStories,
      me.avatar,
      me.id,
      accessToken,
      storiesLoading,
      isAuthenticated,
      router,
      fetchStories,
      activeCategory,
      styles.sectionHeader,
      styles.sectionTitle,
      styles.sectionLink,
    ],
  );

  const ListEmpty = useMemo(
    () => (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyText}>لا توجد إعلانات بعد</Text>
      </View>
    ),
    [styles.empty, styles.emptyIcon, styles.emptyText],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={headerFade} style={styles.headerGradient} pointerEvents="none" />
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/sidebar')}
            style={styles.avatarBtn}
            hitSlop={8}
          >
            <Image source={uriSource(me.avatar)} style={styles.avatar} contentFit="cover" />
            <View style={styles.avatarDot} />
          </Pressable>

          <Text style={styles.appName}>{BRAND_DISPLAY_NAME}</Text>

          <View style={styles.headerRight}>
            {canShowLive ? (
              <Pressable
                style={[styles.iconBtn, styles.liveBtn]}
                hitSlop={8}
                onPress={() => router.push('/(tabs)/live')}
              >
                <AppIcon name="signal-stream" size={20} color={colors.liveRed} />
              </Pressable>
            ) : null}
            <Pressable
              style={styles.iconBtn}
              hitSlop={8}
              onPress={() => router.push('/search')}
            >
              <AppIcon name="search" size={22} color={colors.textPrimary} />
            </Pressable>
            <NotificationBellButton />
          </View>
        </View>

        <FlatList
          data={displayedListings}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={<View style={{ height: 100 }} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      </SafeAreaView>
    </View>
  );
}

function createHomeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDeep },
    container: { flex: 1, backgroundColor: colors.bgDeep },
    headerGradient: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 100, zIndex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      minHeight: 64,
      zIndex: 2,
    },
    avatarBtn: {
      position: 'relative',
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: colors.bgGlassStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: 40, height: 40, borderRadius: 14,
      borderWidth: 2, borderColor: colors.electric,
    },
    avatarDot: {
      position: 'absolute', bottom: 0, right: 0,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: colors.emerald,
      borderWidth: 2, borderColor: colors.bgDeep,
    },
    appName: {
      ...typography.h2,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    headerRight: { flexDirection: 'row', gap: spacing.sm },
    iconBtn: {
      width: 42, height: 42, borderRadius: 14,
      backgroundColor: colors.bgGlassStrong,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSoft,
    },
    liveBtn: {
      borderColor: `${colors.liveRed}40`,
      backgroundColor: `${colors.liveRed}15`,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    },
    sectionTitle: { ...typography.h3, color: colors.textPrimary },
    sectionLink: { ...typography.caption, color: colors.textBrandStrong, fontWeight: '600' },
    empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
    emptyIcon: { fontSize: 40 },
    emptyText: { ...typography.body, color: colors.textMuted },
  });
}
