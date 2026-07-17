// SAFAT — Followers / Following lists
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { UserAvatar } from '@/components/ui/UserAvatar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
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
import { rtlBackIcon } from '@/lib/rtl';
import { openUserProfile } from '@/lib/openUserProfile';
import {
  fetchUserConnections,
  toggleFollowUser,
  type ConnectionUser,
} from '@/services/users';

type ConnectionsTab = 'followers' | 'following';

export default function ProfileConnectionsScreen() {
  const router = useRouter();
  const { me, setFollowState } = useApp();
  const { accessToken } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const params = useLocalSearchParams<{
    userId?: string;
    tab?: string | string[];
    username?: string;
  }>();

  const targetUserId = (Array.isArray(params.userId) ? params.userId[0] : params.userId) || me.id;
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const isOwnProfile = targetUserId === me.id;

  const [activeTab, setActiveTab] = useState<ConnectionsTab>(
    tabParam === 'following' ? 'following' : 'followers',
  );
  const [users, setUsers] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(tabParam === 'following' ? 'following' : 'followers');
  }, [tabParam, targetUserId]);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setUsers([]);
    const data = await fetchUserConnections(targetUserId, activeTab);
    setUsers(data);
    setLoading(false);
  }, [targetUserId, activeTab]);

  // Refresh when returning from a user profile so buttons never show stale state.
  useFocusEffect(
    useCallback(() => {
      void loadConnections();
    }, [loadConnections]),
  );

  const handleFollowToggle = async (user: ConnectionUser) => {
    if (!accessToken || followLoadingId === user.id) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول للمتابعة');
      return;
    }
    if (user.id === me.id) return;

    const wasFollowing = user.isFollowing;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, isFollowing: !wasFollowing } : u,
      ),
    );
    setFollowLoadingId(user.id);
    try {
      const result = await toggleFollowUser(user.id);
      if (!result) throw new Error('follow_failed');
      setFollowState(user.id, result.following);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isFollowing: result.following } : u)),
      );
    } catch {
      setFollowState(user.id, wasFollowing);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isFollowing: wasFollowing } : u)),
      );
      Alert.alert('خطأ', 'تعذّرت المتابعة');
    } finally {
      setFollowLoadingId(null);
    }
  };

  const handleTabChange = (tab: ConnectionsTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setUsers([]);
  };

  const title = isOwnProfile
    ? activeTab === 'followers'
      ? 'متابعون'
      : 'يتابع'
    : params.username
      ? `@${params.username}`
      : 'المتابعات';

  const renderItem = ({ item }: { item: ConnectionUser }) => {
    const showFollowBtn = item.id !== me.id;

    return (
      <Pressable
        style={styles.userRow}
        onPress={() => openUserProfile(router, item.id)}
      >
        <UserAvatar
          uri={item.avatar}
          name={item.arabicName || item.displayName || item.username}
          size={48}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.arabicName || item.displayName || item.username}
            </Text>
            {item.verified && (
              <AppIcon name="checkmark-circle" size={14} color={colors.electricBright} />
            )}
          </View>
          <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>
        </View>

        {showFollowBtn ? (
          <Pressable
            style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
            onPress={(e) => {
              e.stopPropagation?.();
              handleFollowToggle(item);
            }}
            disabled={followLoadingId === item.id}
          >
            {followLoadingId === item.id ? (
              <ActivityIndicator size="small" color={item.isFollowing ? colors.electricBright : '#FFFFFF'} />
            ) : (
              <Text style={[styles.followBtnText, item.isFollowing && styles.followingText]}>
                {item.isFollowing ? 'متابَع' : 'متابعة'}
              </Text>
            )}
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.tabs}>
        {([
          { id: 'followers' as const, label: 'متابعون' },
          { id: 'following' as const, label: 'يتابع' },
        ]).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => handleTabChange(tab.id)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.electricBright} />
        </View>
      ) : (
        <FlatList
          key={activeTab}
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={users.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{activeTab === 'followers' ? '👥' : '🔍'}</Text>
              <Text style={styles.emptyText}>
                {activeTab === 'followers'
                  ? 'لا يوجد متابعون بعد'
                  : 'لا تتابع أحداً بعد'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDeep },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.bgGlass,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    headerTitle: { ...typography.h3, color: colors.textPrimary },
    verifiedColor: { color: colors.electricBright },
    tabs: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.bgSurface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 4,
      gap: 4,
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
    },
    tabBtnActive: {
      backgroundColor: colors.electricBright,
      borderWidth: 0,
    },
    tabText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
    tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
    list: { paddingBottom: spacing.xl },
    emptyList: { flexGrow: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    userInfo: { flex: 1, gap: 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    name: { ...typography.bodyStrong, color: colors.textPrimary, flexShrink: 1 },
    handle: { ...typography.caption, color: colors.textMuted },
    followBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.electricBright,
      borderWidth: 1,
      borderColor: colors.electric,
      minWidth: 78,
      alignItems: 'center',
    },
    followingBtn: {
      backgroundColor: colors.bgDeep,
      borderColor: colors.electricBright,
    },
    followBtnText: { ...typography.caption, color: '#FFFFFF', fontWeight: '700' },
    followingText: { color: colors.electricBright },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxxl,
      gap: spacing.md,
    },
    emptyIcon: { fontSize: 40 },
    emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  });
}
