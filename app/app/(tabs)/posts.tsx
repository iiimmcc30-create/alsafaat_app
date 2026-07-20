// Powered by OnSpace.AI
// SAFAT — Posts Tab (المنشورات) — X-style For you / Following

import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { PostItem } from '@/components/feature/PostItem';
import { PostCommentsModal } from '@/components/feature/PostCommentsModal';
import { CreatePostFab } from '@/components/feature/CreatePostFab';
import { requireAuth, sharePost, showPostMenu } from '@/lib/postInteractions';
import type { Post } from '@/services/types';

type FeedTab = 'for_you' | 'following';

export default function PostsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createPostsStyles(colors));
  const { postId, openComments } = useLocalSearchParams<{
    postId?: string;
    openComments?: string;
  }>();
  const { isAuthenticated } = useAuth();
  const {
    me,
    posts,
    likedPosts,
    repostedPosts,
    bookmarkedPosts,
    toggleLike,
    toggleRepost,
    toggleBookmark,
    deletePost,
    addComment,
    fetchPosts,
  } = useApp();
  const [feedTab, setFeedTab] = useState<FeedTab>('for_you');
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const loadedTabs = useRef<Set<FeedTab>>(new Set());

  const loadFeed = useCallback(
    async (tab: FeedTab, opts?: { refresh?: boolean }) => {
      if (opts?.refresh) setRefreshing(true);
      else if (!loadedTabs.current.has(tab) && posts.length === 0) setLoadingFeed(true);
      try {
        if (tab === 'following' && !isAuthenticated) {
          await fetchPosts('for_you');
          loadedTabs.current.add('for_you');
          return;
        }
        await fetchPosts(tab);
        loadedTabs.current.add(tab);
      } finally {
        setLoadingFeed(false);
        setRefreshing(false);
      }
    },
    [fetchPosts, isAuthenticated, posts.length],
  );

  useEffect(() => {
    // Use AppContext cache for "for you" on first paint; only fetch if empty or tab switch
    if (feedTab === 'for_you' && posts.length > 0 && loadedTabs.current.has('for_you')) {
      return;
    }
    if (feedTab === 'for_you' && posts.length > 0 && !loadedTabs.current.has('for_you')) {
      loadedTabs.current.add('for_you');
      return;
    }
    void loadFeed(feedTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when tab changes
  }, [feedTab]);

  useEffect(() => {
    if (!postId) return;
    if (openComments === '1') {
      setCommentsPostId(postId);
    }
  }, [postId, openComments]);

  const switchTab = (tab: FeedTab) => {
    if (tab === 'following' && !isAuthenticated) {
      requireAuth(false, 'عرض منشورات المتابَعين');
      return;
    }
    setFeedTab(tab);
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Post>) => (
      <PostItem
        post={{
          ...item,
          liked: likedPosts.has(item.id),
          reposted: repostedPosts.has(item.id),
          bookmarked: bookmarkedPosts.has(item.id),
        }}
        onLike={() => requireAuth(isAuthenticated, 'الإعجاب') && toggleLike(item.id)}
        onComment={() =>
          requireAuth(isAuthenticated, 'التعليق') && setCommentsPostId(item.id)
        }
        onRepost={() =>
          requireAuth(isAuthenticated, 'إعادة النشر') && toggleRepost(item.id)
        }
        onBookmark={() =>
          requireAuth(isAuthenticated, 'الحفظ') && toggleBookmark(item.id)
        }
        onShare={() => sharePost(item)}
        onMenu={() => showPostMenu(item, me, router, deletePost, isAuthenticated)}
      />
    ),
    [
      likedPosts,
      repostedPosts,
      bookmarkedPosts,
      isAuthenticated,
      toggleLike,
      toggleRepost,
      toggleBookmark,
      deletePost,
      me,
      router,
    ],
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  const ListEmpty = (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>
        {feedTab === 'following' ? '👥' : '📝'}
      </Text>
      <Text style={styles.emptyText}>
        {feedTab === 'following'
          ? 'لا منشورات من حسابات تتابعها بعد'
          : 'لا توجد منشورات بعد'}
      </Text>
      {feedTab === 'for_you' ? (
        <Pressable style={styles.emptyBtn} onPress={() => router.push('/create/post')}>
          <Text style={styles.emptyBtnText}>+ أنشئ أول منشور</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>المنشورات</Text>
          <View style={styles.tabs}>
            <Pressable
              onPress={() => switchTab('for_you')}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: feedTab === 'for_you' }}
            >
              <Text style={[styles.tabText, feedTab === 'for_you' && styles.tabTextActive]}>
                لك
              </Text>
              {feedTab === 'for_you' ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
            <Pressable
              onPress={() => switchTab('following')}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: feedTab === 'following' }}
            >
              <Text style={[styles.tabText, feedTab === 'following' && styles.tabTextActive]}>
                متابعة
              </Text>
              {feedTab === 'following' ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          </View>
        </View>

        {loadingFeed && posts.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.electricBright} />
          </View>
        ) : (
          <FlatList
            data={posts}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={ListEmpty}
            ListFooterComponent={<View style={{ height: 100 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadFeed(feedTab, { refresh: true })}
                tintColor={colors.electricBright}
              />
            }
            removeClippedSubviews
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={7}
          />
        )}
      </SafeAreaView>

      <CreatePostFab mode="fixed" />

      <PostCommentsModal
        visible={!!commentsPostId}
        postId={commentsPostId}
        onClose={() => setCommentsPostId(null)}
        onSubmitComment={(content) =>
          commentsPostId ? addComment(commentsPostId, content) : Promise.resolve(false)
        }
      />
    </View>
  );
}

function createPostsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDeep },
    container: { flex: 1, backgroundColor: colors.bgDeep },
    topBar: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
      backgroundColor: colors.bgGlassStrong,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    screenTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      textAlign: 'center',
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    tabs: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: radius.lg,
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
      borderRadius: radius.md,
      position: 'relative',
    },
    tabText: {
      ...typography.bodyStrong,
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.textPrimary,
      fontWeight: '800',
    },
    tabIndicator: {
      position: 'absolute',
      bottom: 3,
      width: 24,
      height: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.electric,
    },
    scroll: { paddingBottom: spacing.md, flexGrow: 1 },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.md,
    },
    emptyIcon: { fontSize: 40 },
    emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
    emptyBtn: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.royal,
      borderWidth: 1,
      borderColor: colors.electric,
    },
    emptyBtnText: { ...typography.bodyStrong, color: colors.textBrandStrong },
  });
}
