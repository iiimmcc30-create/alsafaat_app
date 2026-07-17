// Powered by OnSpace.AI
// SAFAT — Home Tab (الصفاة)

import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState, useRef } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  ScrollView,
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

  const refreshLiveAccess = useCallback(async () => {
    if (!accessToken || !isAuthenticated) {
      setCanShowLive(false);
      return;
    }
    const { canStream } = await fetchLiveStreamEligibility(accessToken);
    setCanShowLive(canStream);
  }, [accessToken, isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      refreshLiveAccess();
    }, [refreshLiveAccess]),
  );

  const fetchStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const data = await fetchStoriesFeed(accessToken);
      setStoriesFeed(data.items ?? []);
      setMyStories(data.myStories ?? null);
    } catch (err) {
      console.warn('[HomeScreen] Failed to fetch stories:', err);
    } finally {
      setStoriesLoading(false);
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void fetchStories();
    }, [fetchStories]),
  );

  // ─── الإعلانات مرتّبة: مميزة أولاً، مفلترة بالفئة ───
  const displayedListings = (
    activeCategory !== 'all'
      ? listings.filter((l) => l.category === activeCategory)
      : listings
  )
    .slice()
    .sort((a, b) => Number(b.featured) - Number(a.featured));

  // ─── FlatList ───
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

  const ItemSeparator = useCallback(() => null, []);

  const ListHeader = (
    <View>
      {/* Stories */}
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
        onRefresh={fetchStories}
      />

      {/* Category chips */}
      <CategoryChips value={activeCategory} onChange={setActiveCategory} />

      {/* Butcher mini section */}
      <ButcherMiniSection showStories limit={5} />

      {/* رأس قائمة الإعلانات */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>الإعلانات</Text>
        <Pressable onPress={() => router.push('/(tabs)/market')} hitSlop={8}>
          <Text style={styles.sectionLink}>السوق</Text>
        </Pressable>
      </View>
    </View>
  );

  const ListEmpty = (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>🛒</Text>
      <Text style={styles.emptyText}>لا توجد إعلانات بعد</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
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
          ItemSeparatorComponent={ItemSeparator}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={<View style={{ height: 100 }} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={8}
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
    separator: {
      height: 1,
      backgroundColor: colors.borderHairline,
      marginHorizontal: spacing.md,
    },
    empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
    emptyIcon: { fontSize: 40 },
    emptyText: { ...typography.body, color: colors.textMuted },
  });
}
