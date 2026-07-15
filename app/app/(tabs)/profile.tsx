// Powered by OnSpace.AI
// SAFAT — Profile Tab (حسابي)
// Layout: Cover → Avatar → Info (name, rating stars, bio, location) → Stats
//         → Actions → Sticky "المنشورات" header → merged timeline
// Merging posts + listings into one timeline is scoped to this screen only.
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { fetchStoriesFeed, type StoryGroup } from '@/services/stories';
import { buildProfileTimeline } from '@/lib/profileTimeline';

const COVER_HEIGHT = 130;
const AVATAR_SIZE = 78;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocalSearchParams<{ tab?: string }>(); // legacy deep-link param — timeline has no tabs now
  const { gradients } = useTheme();
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
    updateMe,
  } = useApp();
  const { accessToken, isAuthenticated } = useAuth();

  const [uploadingCover, setUploadingCover] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [hasStories, setHasStories] = useState(false);
  const [myStoryGroup, setMyStoryGroup] = useState<StoryGroup | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const coverOpacity = scrollY.interpolate({
    inputRange: [0, COVER_HEIGHT * 0.65],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

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

  const handlePickCover = async () => {
    if (!accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لتغيير صورة الغلاف');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى السماح للتطبيق بالوصول إلى مكتبة الصور');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingCover(true);
    try {
      const res = await updateMe({ coverImage: result.assets[0].uri });
      if (!res.ok) Alert.alert('خطأ', res.error || 'فشل حفظ الغلاف');
    } catch {
      Alert.alert('خطأ', 'فشل رفع الغلاف');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleShare = () => {
    Share.share({
      message: `تفقّد بروفايل ${me.arabicName || me.displayName} في تطبيق سرح 🐪\nhttps://alsfat.com/u/${me.username}`,
      title: 'سرح — المنصة الوطنية للثروة الحيوانية',
    });
  };


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStories();
    setRefreshing(false);
  }, [loadStories]);

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      scrollY.setValue(e.nativeEvent.contentOffset.y);
    },
    [scrollY],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        scrollEventThrottle={16}
        onScroll={onScroll}
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
          <Pressable onPress={handlePickCover} disabled={uploadingCover} style={styles.cover}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: coverOpacity }]}>
              {me.coverImage ? (
                <Image
                  source={{ uri: me.coverImage }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={gradients.royal}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)']}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <View style={styles.cameraBadge} pointerEvents="none">
              {uploadingCover ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <AppIcon name="camera-outline" size={14} color="#fff" />
              )}
            </View>
          </Pressable>

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
                {me.arabicName || me.displayName}
              </Text>
              {me.verified ? (
                <AppIcon name="checkmark-circle" size={15} color={colors.electricBright} />
              ) : null}
            </View>

            <View style={styles.handleRatingRow}>
              <Text style={styles.handle}>@{me.username}</Text>
              <View style={styles.ratingChip}>
                <AppIcon name="star" size={12} color={colors.gold} />
                <Text style={styles.ratingText}>
                  {ratingLabel ?? '—'}
                  {hasRating ? ` (${(me.reviewCount ?? 0).toLocaleString('ar-SA')})` : ''}
                </Text>
              </View>
            </View>

            {!!me.bio && (
              <Text style={styles.bio} numberOfLines={3}>
                {me.bio}
              </Text>
            )}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <AppIcon name="map-marker-outline" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>
                  {country.flag} {country.ar}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{timeline.length}</Text>
              <Text style={styles.statLbl}>منشورات</Text>
            </View>
            <Pressable style={styles.stat} onPress={() => openConnections('followers')}>
              <Text style={styles.statNum}>{me.followers.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLbl}>متابعون</Text>
            </Pressable>
            <Pressable style={styles.stat} onPress={() => openConnections('following')}>
              <Text style={styles.statNum}>{me.following.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLbl}>متابَعون</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.btnPrimary} onPress={() => router.push('/profile/edit')}>
              <Text style={styles.btnPrimaryText}>تعديل الملف</Text>
            </Pressable>
            <Pressable style={styles.btnIcon} onPress={handleShare}>
              <AppIcon name="share-social-outline" size={16} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              style={styles.btnIcon}
              onPress={() =>
                Alert.alert('المزيد', '', [
                  { text: 'نسخ الرابط', onPress: handleShare },
                  { text: 'الإعدادات', onPress: () => router.push('/settings/account') },
                  { text: 'إلغاء', style: 'cancel' },
                ])
              }
            >
              <AppIcon name="ellipsis-horizontal" size={16} color={colors.textPrimary} />
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
    },
    cameraBadge: {
      position: 'absolute',
      bottom: 8,
      right: 10,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.25)',
    },

    avatarOverlap: {
      marginTop: -(AVATAR_SIZE / 2),
      paddingHorizontal: spacing.lg,
      zIndex: 2,
    },
    avatarOuter: {
      alignSelf: 'flex-start',
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
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    displayName: {
      ...typography.h2,
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    handleRatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    handle: {
      ...typography.caption,
      color: colors.textMuted,
    },
    ratingChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    ratingText: {
      ...typography.caption,
      color: colors.gold,
      fontWeight: '700',
      fontSize: 12,
    },
    bio: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 20,
      marginTop: 6,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 6,
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

    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingHorizontal: spacing.lg,
      paddingTop: 12,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    statNum: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 14,
    },
    statLbl: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 13,
    },

    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing.lg,
      paddingTop: 12,
      paddingBottom: 10,
    },
    btnPrimary: {
      flex: 1,
      height: 34,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMid,
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimaryText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    btnIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMid,
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Sticky section header — single "المنشورات" label, no tab switching
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
