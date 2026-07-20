// Powered by OnSpace.AI
// SAFAT — Profile Tab (حسابي)
// Layout: Fixed cover → centered Avatar → @username → followers/following → Actions → timeline
// Merging posts + listings into one timeline is scoped to this screen only.
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { getCountryInfo } from '@/services/types';
import { ListingCard } from '@/components/feature/ListingCard';
import { PostItem } from '@/components/feature/PostItem';
import { PostCommentsModal } from '@/components/feature/PostCommentsModal';
import { requireAuth, sharePost, showPostMenu } from '@/lib/postInteractions';
import { presentActionSheet } from '@/lib/actionSheet';
import { fetchStoriesFeed, type StoryGroup } from '@/services/stories';
import { buildProfileTimeline } from '@/lib/profileTimeline';

const COVER_HEIGHT = 130;
const AVATAR_SIZE = 78;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocalSearchParams<{ tab?: string }>(); // legacy deep-link param — timeline has no tabs now
  const { gradients, colors: themeColors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  const {
    me,
    listings,
    posts,
    likedPosts,
    repostedPosts,
    bookmarkedPosts,
    toggleLike,
    toggleRepost,
    toggleBookmark,
    deletePost,
    addComment,
  } = useApp();
  const { accessToken, isAuthenticated } = useAuth();

  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [hasStories, setHasStories] = useState(false);
  const [myStoryGroup, setMyStoryGroup] = useState<StoryGroup | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStories = useCallback(async () => {
    try {
      const data = await fetchStoriesFeed(accessToken);
      const mine = data.myStories ?? null;
      setMyStoryGroup(mine);
      const now = Date.now();
      setHasStories(
        mine != null &&
          (mine.stories?.length ?? 0) > 0 &&
          mine.stories.some((s) => new Date(s.expiresAt).getTime() > now),
      );
    } catch {
      /* silent */
    }
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadStories();
    }, [loadStories]),
  );

  const myListings = listings.filter((l) => l.seller.id === me.id);
  const myPosts = posts.filter((p) => p.author.id === me.id);
  const timeline = useMemo(
    () => buildProfileTimeline(myPosts, myListings),
    [myPosts, myListings],
  );

  const country = getCountryInfo(me.country);
  const hasRating = me.rating != null && (me.reviewCount ?? 0) > 0;
  const ratingLabel = hasRating ? me.rating!.toFixed(1) : null;

  const openConnections = (t: 'followers' | 'following') => {
    router.push({
      pathname: '/profile/connections',
      params: { userId: me.id, tab: t, username: me.username },
    } as never);
  };

  const handleShare = () => {
    Share.share({
      message: `تفقّد بروفايل ${me.arabicName || me.displayName} في تطبيق سرح 🐪\nhttps://alsfat.com/u/${me.username}`,
      title: 'سرح — المنصة الوطنية للثروة الحيوانية',
    });
  };

  const handleCoverMenu = async () => {
    const key = await presentActionSheet({
      title: 'خيارات الحساب',
      message: 'الإعدادات والمشاركة',
      items: [
        {
          key: 'settings',
          label: 'الإعدادات',
          subtitle: 'الحساب والخصوصية والإشعارات',
          icon: 'settings-outline',
        },
        {
          key: 'share',
          label: 'مشاركة الملف',
          subtitle: 'إرسال رابط حسابك',
          icon: 'share-social-outline',
        },
        {
          key: 'copy',
          label: 'نسخ الرابط',
          subtitle: 'نسخ رابط الملف',
          icon: 'link-outline',
        },
        { key: 'cancel', label: 'إلغاء', cancel: true },
      ],
    });

    if (key === 'settings') router.push('/profile/settings');
    if (key === 'share') handleShare();
    if (key === 'copy') handleShare();
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStories();
    setRefreshing(false);
  }, [loadStories]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.electricBright}
          />
        }
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 12) + 24,
        }}
      >
        {/* ═══════════════ HEADER ═══════════════ */}
        <View style={styles.headerBlock}>
          <View style={styles.cover}>
            <LinearGradient
              colors={gradients.royal}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Pressable
              onPress={handleCoverMenu}
              hitSlop={10}
              style={styles.coverMenuBtn}
            >
              <AppIcon name="menu" size={22} color="#fff" />
            </Pressable>
            <View style={styles.coverRating}>
              <AppIcon name="star" size={12} color={themeColors.gold} />
              <Text style={styles.coverRatingText}>
                {ratingLabel ?? '—'}
                {hasRating ? ` (${(me.reviewCount ?? 0).toLocaleString('ar-SA')})` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.avatarOverlap}>
            <Pressable
              onPress={() => {
                if (hasStories && myStoryGroup) {
                  router.push({
                    pathname: '/stories/view',
                    params: { groupIndex: '0' },
                  } as never);
                }
              }}
              style={styles.avatarOuter}
            >
              <LinearGradient
                colors={
                  hasStories
                    ? [colors.electricBright, colors.cyan, '#34D399']
                    : [colors.borderSoft, colors.borderSoft]
                }
                style={styles.avatarRing}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.avatarClip}>
                  <Image
                    source={uriSource(me.avatar)}
                    style={styles.avatarImg}
                    contentFit="cover"
                  />
                </View>
              </LinearGradient>
              {me.verified ? (
                <View style={styles.verifiedDot}>
                  <AppIcon name="checkmark-circle" size={16} color={colors.electricBright} />
                </View>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {me.arabicName || me.displayName || me.username}
              </Text>
              <Pressable
                onPress={() => router.push('/profile/edit')}
                hitSlop={10}
                style={styles.editNameBtn}
              >
                <AppIcon name="pencil-outline" size={15} color={themeColors.textMuted} />
              </Pressable>
              {me.verified ? (
                <AppIcon name="checkmark-circle" size={15} color={themeColors.electricBright} />
              ) : null}
            </View>
            <Text style={styles.username}>@{me.username}</Text>
            {!!me.bio ? (
              <Text style={styles.bio} numberOfLines={3}>
                {me.bio}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <AppIcon name="map-marker-outline" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>
                  {country.flag} {country.ar}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <Pressable style={styles.statCard} onPress={() => openConnections('followers')}>
              <Text style={styles.statNum}>{me.followers.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLbl}>متابعون</Text>
            </Pressable>
            <Pressable style={styles.statCard} onPress={() => openConnections('following')}>
              <Text style={styles.statNum}>{me.following.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLbl}>متابَعون</Text>
            </Pressable>
          </View>

        </View>

        {/* ═══════════════ STICKY SECTION HEADER ═══════════════ */}
        <View style={styles.sectionBar}>
          <Text style={styles.sectionTitle}>المنشورات</Text>
        </View>

        {/* ═══════════════ TIMELINE — posts + listings merged by date ═══════════════ */}
        <View style={styles.body}>
          {timeline.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>لا يوجد محتوى بعد</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/create/post')}>
                <Text style={styles.emptyBtnText}>+ أنشئ منشوراً</Text>
              </Pressable>
            </View>
          ) : (
            timeline.map((entry) =>
              entry.kind === 'post' ? (
                <PostItem
                  key={entry.id}
                  post={{
                    ...entry.data,
                    liked: likedPosts.has(entry.data.id),
                    reposted: repostedPosts.has(entry.data.id),
                    bookmarked: bookmarkedPosts.has(entry.data.id),
                  }}
                  onLike={() =>
                    requireAuth(isAuthenticated, 'الإعجاب') && toggleLike(entry.data.id)
                  }
                  onComment={() =>
                    requireAuth(isAuthenticated, 'التعليق') && setCommentsPostId(entry.data.id)
                  }
                  onRepost={() =>
                    requireAuth(isAuthenticated, 'إعادة النشر') && toggleRepost(entry.data.id)
                  }
                  onBookmark={() =>
                    requireAuth(isAuthenticated, 'الحفظ') && toggleBookmark(entry.data.id)
                  }
                  onShare={() => sharePost(entry.data)}
                  onMenu={() =>
                    showPostMenu(entry.data, me, router, deletePost, isAuthenticated)
                  }
                />
              ) : (
                <ListingCard
                  key={entry.id}
                  listing={entry.data}
                  variant="list"
                  onPress={() =>
                    router.push({ pathname: '/listing/[id]', params: { id: entry.data.id } })
                  }
                />
              ),
            )
          )}
        </View>
      </ScrollView>

      <PostCommentsModal
        visible={!!commentsPostId}
        postId={commentsPostId}
        onClose={() => setCommentsPostId(null)}
        onSubmitComment={(content) =>
          commentsPostId ? addComment(commentsPostId, content) : Promise.resolve(false)
        }
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bgDeep,
    },

    headerBlock: {
      backgroundColor: colors.bgDeep,
    },

    cover: {
      height: COVER_HEIGHT,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
      position: 'relative',
    },
    coverMenuBtn: {
      position: 'absolute',
      top: 10,
      left: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.38)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.22)',
      zIndex: 2,
    },
    coverRating: {
      position: 'absolute',
      bottom: 10,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(0,0,0,0.42)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.18)',
      zIndex: 2,
    },
    coverRatingText: {
      ...typography.caption,
      color: '#fff',
      fontWeight: '700',
    },

    avatarOverlap: {
      marginTop: -(AVATAR_SIZE / 2),
      alignItems: 'center',
      zIndex: 2,
    },
    avatarOuter: {
      position: 'relative',
    },
    avatarRing: {
      width: AVATAR_SIZE + 4,
      height: AVATAR_SIZE + 4,
      borderRadius: (AVATAR_SIZE + 4) / 2,
      padding: 2,
    },
    avatarClip: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: colors.bgDeep,
      backgroundColor: colors.bgElevated,
    },
    avatarImg: {
      width: '100%',
      height: '100%',
    },
    verifiedDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.bgDeep,
      borderRadius: 10,
    },

    info: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      alignItems: 'center',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    displayName: {
      ...typography.h2,
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      flexShrink: 1,
    },
    editNameBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    username: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    bio: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 20,
      marginTop: 6,
      textAlign: 'center',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 6,
      justifyContent: 'center',
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 12,
    },

    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    statCard: {
      minWidth: 96,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: 6,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    statNum: {
      ...typography.bodyStrong,
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    statLbl: {
      ...typography.micro,
      color: colors.textMuted,
      fontSize: 11,
    },

    // Sticky section header
    sectionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgDeep,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
      paddingHorizontal: spacing.lg,
      height: 44,
    },
    sectionTitle: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 15,
    },
    body: {
      backgroundColor: colors.bgDeep,
    },

    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 10,
    },
    emptyTitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    emptyBtn: {
      marginTop: 4,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.royal,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.electric,
    },
    emptyBtnText: {
      ...typography.bodyStrong,
      color: colors.textBrandStrong,
    },
  });
}
