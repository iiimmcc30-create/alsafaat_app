// SAFAT — Public User Profile
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlBackIcon, rtlRow } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { getCountryInfo } from '@/services/types';
import { fetchUserProfile, toggleFollowUser, type PublicUserProfile } from '@/services/users';
import { promptReport } from '@/services/reports';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { me } = useApp();
  const { accessToken } = useAuth();
  const { gradients, colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = !id || id === me.id;

  const loadProfile = useCallback(async () => {
    const targetId = id || me.id;
    setLoading(true);
    const data = await fetchUserProfile(targetId);
    setProfile(data);
    setLoading(false);
  }, [id, me.id]);

  useEffect(() => {
    if (isOwnProfile) {
      router.replace('/(tabs)/profile');
      return;
    }
    loadProfile();
  }, [isOwnProfile, loadProfile, router]);

  const handleFollow = async () => {
    if (!profile || !accessToken) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول للمتابعة');
      return;
    }
    setFollowLoading(true);
    const result = await toggleFollowUser(profile.id);
    if (result) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: result.following,
              followersCount: prev.followersCount + (result.following ? 1 : -1),
            }
          : prev
      );
    } else {
      Alert.alert('خطأ', 'تعذّرت المتابعة، حاول مجدداً');
    }
    setFollowLoading(false);
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
      },
    } as any);
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.electricBright} />
        </View>
      </SafeAreaView>
    );
  }

  const country = getCountryInfo(profile.country);
  const hasRating = profile.rating != null && profile.reviewCount > 0;
  const ratingLabel = hasRating ? `★ ${profile.rating!.toFixed(1)}` : '—';

  const openConnections = (tab: 'followers' | 'following') => {
    router.push({
      pathname: '/profile/connections',
      params: { userId: profile.id, tab, username: profile.username },
    } as never);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.heroSection}>
          <View style={styles.coverWrap}>
            {profile.coverImage ? (
              <Image
                source={{ uri: profile.coverImage }}
                style={styles.coverImage}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={gradients.royal}
                style={styles.cover}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}
            <LinearGradient
              colors={['rgba(6,9,26,0.15)', 'rgba(6,9,26,0.55)']}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.avatarRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}>
                <Image source={{ uri: profile.avatar }} style={styles.avatar} contentFit="cover" />
              </View>
              {profile.verified && (
                <View style={styles.verifiedBadge}>
                  <AppIcon name="checkmark-circle" size={18} color={colors.electricBright} />
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{profile.arabicName || profile.displayName}</Text>
              {profile.verified && (
                <AppIcon name="checkmark-circle" size={20} color={colors.electricBright} />
              )}
            </View>
            <Text style={styles.handle}>@{profile.username}</Text>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            <View style={styles.locationRow}>
              <Text style={styles.flag}>{country.flag}</Text>
              <Text style={styles.locationText}>{country.ar}</Text>
            </View>
          </View>

          <View style={styles.statsCard}>
            <Pressable style={styles.statCol} onPress={() => openConnections('followers')}>
              <Text style={styles.statNum}>{profile.followersCount.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLabel}>متابعون</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <Pressable style={styles.statCol} onPress={() => openConnections('following')}>
              <Text style={styles.statNum}>{profile.followingCount.toLocaleString('ar-SA')}</Text>
              <Text style={styles.statLabel}>يتابع</Text>
            </Pressable>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{profile.listingsCount}</Text>
              <Text style={styles.statLabel}>إعلانات</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{ratingLabel}</Text>
              <Text style={styles.statLabel}>تقييم</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleFollow}
              disabled={followLoading}
              style={({ pressed }) => [
                styles.followBtn,
                profile.isFollowing && styles.followingBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={profile.isFollowing ? colors.textPrimary : '#fff'} />
              ) : (
                <>
                  <AppIcon
                    name={profile.isFollowing ? 'checkmark' : 'person-add-outline'}
                    size={18}
                    color={profile.isFollowing ? colors.textPrimary : '#fff'}
                  />
                  <Text style={[styles.followBtnText, profile.isFollowing && styles.followingBtnText]}>
                    {profile.isFollowing ? 'متابَع' : 'متابعة'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handleChat}
              style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.85 }]}
            >
              <AppIcon name="chatbubble-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.chatBtnText}>محادثة</Text>
            </Pressable>

            {!isOwnProfile ? (
              <Pressable
                onPress={() => promptReport('user', profile.id, !!accessToken)}
                style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.85 }]}
              >
                <AppIcon name="flag-outline" size={18} color={colors.rose} />
                <Text style={[styles.chatBtnText, { color: colors.rose }]}>إبلاغ</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  const card = {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  } as const;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDeep },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: spacing.xxxl },
    heroSection: { position: 'relative', marginBottom: spacing.md },
    coverWrap: { height: 140, width: '100%', overflow: 'hidden' },
    cover: { height: 140, width: '100%' },
    coverImage: { width: '100%', height: '100%' },
    backBtn: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.lg,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.bgGlassStrong,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSoft,
      zIndex: 2,
    },
    avatarRow: {
      ...rtlRow,
      paddingHorizontal: spacing.lg,
      marginTop: -40,
      zIndex: 3,
    },
    avatarWrap: { position: 'relative' },
    avatarRing: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 3,
      borderColor: colors.electricBright,
      backgroundColor: colors.bgDeep,
      overflow: 'hidden',
    },
    avatar: { width: '100%', height: '100%' },
    verifiedBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.bgDeep,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bgDeep,
    },
    content: { paddingHorizontal: spacing.lg },
    info: { gap: 4, marginBottom: spacing.lg },
    nameRow: { ...rtlRow, alignItems: 'center', gap: 6 },
    displayName: { ...typography.h1, color: colors.textPrimary, fontSize: 24 },
    englishName: { ...typography.body, color: colors.textBrand },
    handle: { ...typography.caption, color: colors.textMuted },
    bio: { ...typography.body, color: colors.textSecondary, marginTop: 4, lineHeight: 22 },
    locationRow: { ...rtlRow, alignItems: 'center', gap: 6, marginTop: 4 },
    flag: { fontSize: 14 },
    locationText: { ...typography.caption, color: colors.textMuted },
    statsCard: {
      ...card,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    statCol: { flex: 1, alignItems: 'center', gap: 4 },
    statNum: { ...typography.h3, color: colors.textPrimary, fontWeight: '800' },
    statLabel: { ...typography.micro, color: colors.textMuted },
    statDivider: { width: 1, height: 36, backgroundColor: colors.borderSoft },
    actionRow: { ...rtlRow, gap: spacing.sm },
    followBtn: {
      flex: 1,
      ...rtlRow,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.electric,
    },
    followingBtn: {
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderMid,
    },
    followBtnText: { ...typography.bodyStrong, color: '#fff' },
    followingBtnText: { color: colors.textPrimary },
    chatBtn: {
      flex: 1,
      ...rtlRow,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderMid,
    },
    chatBtnText: { ...typography.bodyStrong, color: colors.textPrimary },
  });
}
