// Powered by OnSpace.AI
// SAFAT — Home Tab (الصفاة)

import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
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
import { PostItem } from '@/components/feature/PostItem';
import { PostCommentsModal } from '@/components/feature/PostCommentsModal';
import { ButcherMiniSection } from '@/components/feature/ButcherMiniSection';
import { CategoryChips, CategoryKey } from '@/components/feature/CategoryChips';
import { ListingCard } from '@/components/feature/ListingCard';
import { requireAuth, sharePost, showPostMenu } from '@/lib/postInteractions';
import { fetchLiveStreamEligibility } from '@/lib/liveStreamAccess';
import { CreatePostFab } from '@/components/feature/CreatePostFab';
import { NotificationBellButton } from '@/components/notifications/NotificationBellButton';
import { BRAND_DISPLAY_NAME } from '@/constants/brandCopy';

export default function HomeScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const styles = useThemedStyles(({ colors }) => createHomeStyles(colors));
  const headerFade = headerFadeGradient(scheme);
  const { me, posts, listings, likedPosts, repostedPosts, toggleLike, toggleRepost, deletePost, addComment } = useApp();
  const { accessToken, isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [storiesFeed, setStoriesFeed] = useState<StoryGroup[]>([]);
  const [myStories, setMyStories] = useState<StoryGroup | null>(null);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
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

  const displayedPosts = activeCategory !== 'all'
    ? posts.filter((p) => p.arabicContent.includes(activeCategory) || p.content.toLowerCase().includes(activeCategory))
    : posts;

  const displayedListings = (activeCategory !== 'all'
    ? listings.filter((l) => l.category === activeCategory)
    : listings
  )
    .slice()
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 12);

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

        {/* App name */}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
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
        <CategoryChips
          value={activeCategory}
          onChange={setActiveCategory}
        />

        {/* Butcher mini section */}
        <ButcherMiniSection showStories limit={5} />

        {/* Listings */}
        {displayedListings.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>الإعلانات</Text>
              <Pressable onPress={() => router.push('/(tabs)/market')} hitSlop={8}>
                <Text style={styles.sectionLink}>عرض الكل</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.listingsRow}
            >
              {displayedListings.map((listing) => (
                <View key={listing.id} style={styles.listingItem}>
                  <ListingCard
                    listing={listing}
                    variant="feature"
                    compact
                    onPress={() => router.push(`/listing/${listing.id}`)}
                  />
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>المنشورات</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Posts feed */}
        {displayedPosts.map((post) => (
          <PostItem
            key={post.id}
            post={{
              ...post,
              liked: likedPosts.has(post.id),
              reposted: repostedPosts.has(post.id),
            }}
            onLike={() => requireAuth(isAuthenticated, 'الإعجاب') && toggleLike(post.id)}
            onComment={() => requireAuth(isAuthenticated, 'التعليق') && setCommentsPostId(post.id)}
            onRepost={() => requireAuth(isAuthenticated, 'إعادة النشر') && toggleRepost(post.id)}
            onShare={() => sharePost(post)}
            onMenu={() => showPostMenu(post, me, router, deletePost)}
          />
        ))}

        <PostCommentsModal
          visible={!!commentsPostId}
          postId={commentsPostId}
          onClose={() => setCommentsPostId(null)}
          onSubmitComment={(content) =>
            commentsPostId ? addComment(commentsPostId, content) : Promise.resolve(false)
          }
        />

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>

      <CreatePostFab />
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
    paddingVertical: spacing.md,
    zIndex: 2,
  },
  avatarBtn: { position: 'relative' },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bgGlass,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  liveBtn: {
    borderColor: `${colors.liveRed}40`,
    backgroundColor: `${colors.liveRed}15`,
  },
  scroll: { paddingBottom: spacing.huge },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  sectionLink: { ...typography.caption, color: colors.textBrandStrong, fontWeight: '600' },
  listingsRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  listingItem: { width: 248 },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  dividerText: { ...typography.micro, color: colors.textMuted },
  });
}
