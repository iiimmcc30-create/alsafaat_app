// SAFAT — Public User Profile
// Same layout as own profile: Cover → Avatar → Info (name, rating, bio, location)
// → Stats → Actions → Sticky "المنشورات" header → merged timeline (posts + listings)
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { rtlBackIcon } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { getCountryInfo } from '@/services/types';
import { fetchUserProfile, rateUser, setFollowUser, type PublicUserProfile } from '@/services/users';
import { promptReport } from '@/services/reports';
import { ListingCard } from '@/components/feature/ListingCard';
import { PostItem } from '@/components/feature/PostItem';
import { PostCommentsModal } from '@/components/feature/PostCommentsModal';
import { RatingModal } from '@/components/feature/RatingModal';
import { requireAuth, sharePost, showPostMenu } from '@/lib/postInteractions';
import { presentActionSheet } from '@/lib/actionSheet';
import { buildProfileTimeline } from '@/lib/profileTimeline';

const COVER_HEIGHT = 130;
const AVATAR_SIZE = 78;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const { gradients, colors: themeColors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);

  const isOwnProfile = !id || id === me.id;

  const fetchAuthoritativeProfile = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return null;
    const targetId = id || me.id;
    const data = await fetchUserProfile(targetId);
    setProfile(data);
    if (__DEV__) {
      console.debug('[Follow] profile state loaded from server', {
        viewerId: me.id,
        profileUserId: targetId,
        isFollowing: data?.isFollowing ?? null,
      });
    }
    return data;
  }, [accessToken, id, isAuthenticated, me.id]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      await fetchAuthoritativeProfile();
    } finally {
      setLoading(false);
    }
  }, [fetchAuthoritativeProfile]);

  // Always read the authoritative follow state when returning to this screen.
  useFocusEffect(
    useCallback(() => {
      // Session restoration is asynchronous after a cold app start. Do not
      // issue an anonymous profile request that would correctly return false
      // and then remain on screen after the token is restored.
      if (authLoading || !isAuthenticated || !accessToken) return;
      if (isOwnProfile) {
        router.replace('/(tabs)/profile');
        return;
      }
      void loadProfile();
    }, [accessToken, authLoading, isAuthenticated, isOwnProfile, loadProfile, router]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const handleFollow = async () => {
    if (!profile || !accessToken || followLoading) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول للمتابعة');
      return;
    }
    setFollowLoading(true);
    try {
      const result = await setFollowUser(profile.id, !profile.isFollowing);
      if (!result) throw new Error('follow_failed');

      // Never trust local/optimistic state. Read the relationship back from
      // PostgreSQL through the authenticated profile endpoint.
      const refreshed = await fetchAuthoritativeProfile();
      if (!refreshed) throw new Error('profile_refetch_failed');
      if (__DEV__ && refreshed.isFollowing !== result.following) {
        console.warn('[Follow] mutation/profile mismatch', {
          profileUserId: profile.id,
          mutationFollowing: result.following,
          profileFollowing: refreshed.isFollowing,
        });
      }
    } catch (error) {
      if (__DEV__) console.warn('[Follow] profile mutation failed', error);
      await fetchAuthoritativeProfile();
      Alert.alert('خطأ', 'تعذّرت المتابعة، حاول مجدداً');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleRateSubmit = async (rating: number): Promise<boolean> => {
    if (!profile) return false;
    if (!accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول للتقييم');
      return false;
    }
    const result = await rateUser(profile.id, rating);
    if (!result) {
      Alert.alert('خطأ', 'تعذّر إرسال التقييم، حاول مجدداً');
      return false;
    }
    setProfile((prev) =>
      prev
        ? { ...prev, rating: result.rating, reviewCount: result.reviewCount, myRating: result.myRating }
        : prev,
    );
    return true;
  };

  const handleChat = () => {
    if (!profile) return;
    if (!accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لبدء محادثة');
      return;
    }
    router.push({
      pathname: '/butchers/chat',
      params: {
        receiverId: profile.id,
        receiverName: profile.arabicName,
        receiverAvatar: profile.avatar ?? '',
        accountType: profile.accountType ?? 'USER',
        threadType:
          profile.accountType === 'BUTCHER' || profile.role === 'BUTCHER'
            ? 'BUTCHER'
            : 'DIRECT',
      },
    } as never);
  };

  const userPosts = useMemo(
    () => (profile ? posts.filter((p) => p.author.id === profile.id) : []),
    [posts, profile],
  );
  const userListings = useMemo(
    () => (profile ? listings.filter((l) => l.seller.id === profile.id) : []),
    [listings, profile],
  );
  const timeline = useMemo(
    () => buildProfileTimeline(userPosts, userListings),
    [userPosts, userListings],
  );

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={themeColors.electricBright} />
        </View>
      </SafeAreaView>
    );
  }

  const country = getCountryInfo(profile.country);
  const hasRating = profile.rating != null && profile.reviewCount > 0;
  const ratingLabel = hasRating ? profile.rating!.toFixed(1) : null;

  const openConnections = (t: 'followers' | 'following') => {
    router.push({
      pathname: '/profile/connections',
      params: { userId: profile.id, tab: t, username: profile.username },
    } as never);
  };

  const handleShareProfile = () => {
    Share.share({
      message: `تفقّد بروفايل ${profile.arabicName || profile.displayName} في تطبيق سرح 🐪\nhttps://alsfat.com/u/${profile.username}`,
      title: 'سرح — المنصة الوطنية للثروة الحيوانية',
    });
  };

  const handleCoverMenu = async () => {
    const key = await presentActionSheet({
      title: 'خيارات',
      message: profile.arabicName || profile.displayName,
      items: [
        {
          key: 'share',
          label: 'مشاركة الملف',
          icon: 'share-social-outline',
        },
        {
          key: 'report',
          label: 'إبلاغ',
          icon: 'flag-outline',
          destructive: true,
        },
        { key: 'cancel', label: 'إلغاء', cancel: true },
      ],
    });
    if (key === 'share') handleShareProfile();
    if (key === 'report') promptReport('user', profile.id, !!accessToken);
  };

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
            <Pressable onPress={handleCoverMenu} hitSlop={10} style={styles.coverMenuBtn}>
              <AppIcon name="menu" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <AppIcon name={rtlBackIcon} size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.coverRating}
              onPress={() => setRatingModalVisible(true)}
              hitSlop={6}
            >
              <AppIcon name="star" size={12} color={themeColors.gold} />
              <Text style={styles.coverRatingText}>
                {ratingLabel ?? '—'}
                {hasRating ? ` (${profile.reviewCount.toLocaleString('ar-SA')})` : ''}
              </Text>
              {profile.myRating ? (
                <AppIcon name="create-outline" size={11} color="rgba(255,255,255,0.75)" />
              ) : null}
            </Pressable>
          </View>

          <View style={styles.avatarOverlap}>
            <View style={styles.avatarOuter}>
              <LinearGradient
                colors={[themeColors.borderSoft, themeColors.borderSoft]}
                style={styles.avatarRing}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.avatarClip}>
                  <Image
                    source={uriSource(profile.avatar)}
                    style={styles.avatarImg}
                    contentFit="cover"
                  />
                </View>
              </LinearGradient>
              {profile.verified ? (
                <View style={styles.verifiedDot}>
                  <AppIcon name="checkmark-circle" size={16} color={themeColors.electricBright} />
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {profile.arabicName || profile.displayName || profile.username}
              </Text>
              {profile.verified ? (
                <AppIcon name="checkmark-circle" size={15} color={themeColors.electricBright} />
              ) : null}
            </View>
            <Text style={styles.username}>@{profile.username}</Text>

            {!!profile.bio ? (
              <Text style={styles.bio} numberOfLines={3}>
                {profile.bio}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <AppIcon name="map-marker-outline" size={12} color={themeColors.textMuted} />
                <Text style={styles.metaText}>
                  {country.flag} {country.ar}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <Pressable style={styles.statCard} onPress={() => openConnections('followers')}>
              <Text style={styles.statNum}>{profile.followersCount.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLbl}>متابعون</Text>
            </Pressable>
            <Pressable style={styles.statCard} onPress={() => openConnections('following')}>
              <Text style={styles.statNum}>{profile.followingCount.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLbl}>متابَعون</Text>
            </Pressable>
          </View>

          {/* Actions — متابعة / مراسلة / إبلاغ */}
          <View style={styles.actions}>
            <Pressable
              onPress={handleFollow}
              disabled={followLoading}
              style={[styles.btnFollow, profile.isFollowing && styles.btnFollowing]}
            >
              {followLoading ? (
                <ActivityIndicator
                  size="small"
                  color={profile.isFollowing ? themeColors.textPrimary : '#fff'}
                />
              ) : (
                <Text
                  style={[
                    styles.btnFollowText,
                    profile.isFollowing && styles.btnFollowingText,
                  ]}
                >
                  {profile.isFollowing ? 'متابَع' : 'متابعة'}
                </Text>
              )}
            </Pressable>

            <Pressable style={styles.btnSecondary} onPress={handleChat}>
              <Text style={styles.btnSecondaryText}>مراسلة</Text>
            </Pressable>

            <Pressable
              style={styles.btnIcon}
              onPress={() => promptReport('user', profile.id, !!accessToken)}
            >
              <AppIcon name="flag-outline" size={16} color={themeColors.rose} />
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

      <RatingModal
        visible={ratingModalVisible}
        onClose={() => setRatingModalVisible(false)}
        targetName={profile.arabicName || profile.displayName}
        currentRating={profile.rating}
        currentCount={profile.reviewCount}
        myRating={profile.myRating ?? null}
        onSubmit={handleRateSubmit}
      />

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
    root: { flex: 1, backgroundColor: colors.bgDeep },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerBlock: { backgroundColor: colors.bgDeep },

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
    backBtn: {
      position: 'absolute',
      top: 10,
      right: 12,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.2)',
      zIndex: 2,
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
    avatarImg: { width: '100%', height: '100%' },
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

    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing.lg,
      paddingTop: 12,
      paddingBottom: 10,
    },
    btnFollow: {
      flex: 1,
      height: 34,
      borderRadius: radius.pill,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnFollowing: {
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMid,
    },
    btnFollowText: {
      ...typography.caption,
      color: '#fff',
      fontWeight: '700',
    },
    btnFollowingText: {
      color: colors.textPrimary,
    },
    btnSecondary: {
      flex: 1,
      height: 34,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMid,
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnSecondaryText: {
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

    sectionBar: {
      flexDirection: 'row',
      alignItems: 'center',
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

    body: { backgroundColor: colors.bgDeep },

    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    emptyTitle: {
      ...typography.body,
      color: colors.textMuted,
    },
  });
}
