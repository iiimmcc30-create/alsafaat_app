// Powered by OnSpace.AI
// SAFAT — Butcher Messages Tab (الرسائل والنشاط للملحمة)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchNotifications } from '@/services/notifications';
import { useMessageThreads } from '@/hooks/useMessageThreads';
import { UserProfileLink } from '@/components/feature/UserProfileLink';

type Tab = 'messages' | 'activity';

export default function ButcherMessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listBottomPadding = 58 + Math.max(insets.bottom, 8) + 6 + spacing.xl;
  const { accessToken } = useAuth();
  const { threads, loading: threadsLoading, error: threadsError } = useMessageThreads(accessToken);
  const [activeTab, setActiveTab] = useState<Tab>('messages');
  const [search, setSearch] = useState('');
  const [notificationsList, setNotificationsList] = useState<any[]>([]);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!accessToken) return;
      try {
        const page = await fetchNotifications();
        setNotificationsList(page.notifications);
      } catch (err) {
        console.warn('[ButcherMessagesScreen] Failed to fetch notifications:', err);
      }
    };
    loadNotifications();
  }, [accessToken]);

  const activityItems = notificationsList.map((n) => {
    const mapType = (t: string): string => {
      if (['like', 'follow', 'comment', 'repost'].includes(t)) return t;
      if (t === 'live_start') return 'live';
      return 'market';
    };
    return {
      id: n.id,
      type: mapType(n.type),
      user: {
        id: n.data?.actorId || undefined,
        avatar: n.data?.actorAvatar || undefined,
        arabicName: n.titleAr || 'إشعار سرح',
      },
      arabicText: n.bodyAr,
      time: new Date(n.createdAt).toLocaleDateString('ar-SA'),
    };
  });

  const filteredChats = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p = t.participant;
    if (!p) return false;
    return (
      p.displayName.toLowerCase().includes(q) ||
      p.arabicName.includes(q)
    );
  });

  const ACTIVITY_ICONS: Record<string, string> = {
    like: 'heart',
    follow: 'person-add',
    comment: 'chatbubble',
    repost: 'repeat',
    live: 'radio',
    market: 'pricetag',
  };

  const ACTIVITY_COLORS: Record<string, string> = {
    like: colors.rose,
    follow: colors.electric,
    comment: colors.glow,
    repost: colors.emerald,
    live: colors.liveRed,
    market: colors.gold,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/sidebar')} hitSlop={12} style={styles.menuBtn}>
          <AppIcon name="menu" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>
          {activeTab === 'messages' ? 'رسائل العملاء' : 'نشاط المتجر'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setActiveTab('messages')}
          style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, activeTab === 'messages' && styles.tabLabelActive]}>
            الرسائل الواردة
          </Text>
          {threads.some((t) => t.unread > 0) && <View style={styles.tabDot} />}
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('activity')}
          style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, activeTab === 'activity' && styles.tabLabelActive]}>
            التفاعلات والطلبات
          </Text>
        </Pressable>
      </View>

      {activeTab === 'messages' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
        >
          {/* Search */}
          <View style={styles.searchRow}>
            <AppIcon name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث في رسائل العملاء..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
          </View>

          {/* Chat threads */}
          {threadsLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.electricBright} />
              <Text style={styles.emptyText}>جاري تحميل الرسائل...</Text>
            </View>
          ) : threadsError === 'unauthorized' ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔒</Text>
              <Text style={styles.emptyText}>سجّل الدخول لعرض الرسائل</Text>
            </View>
          ) : (
            filteredChats.map((chat) => {
              const p = chat.participant;
              if (!p) return null;
              return (
            <View key={chat.id} style={styles.chatRow}>
              <UserProfileLink userId={p.id}>
                <View style={styles.avatarWrap}>
                  <Image source={{ uri: p.avatar }} style={styles.avatar} contentFit="cover" />
                  <View style={styles.onlineDot} />
                </View>
              </UserProfileLink>
              <Pressable
                style={({ pressed }) => [styles.chatContent, pressed && { opacity: 0.85 }]}
                onPress={() => router.push({
                  pathname: '/butchers/chat',
                  params: {
                    threadId: chat.id,
                    receiverId: p.id,
                    receiverName: p.arabicName,
                    receiverAvatar: p.avatar ?? '',
                  },
                } as any)}
              >
                <View style={styles.chatTop}>
                  <UserProfileLink userId={p.id} style={styles.chatName}>
                    <Text style={styles.displayName}>{p.arabicName}</Text>
                    {p.verified && (
                      <AppIcon name="checkmark-circle" size={13} color={colors.electricBright} />
                    )}
                  </UserProfileLink>
                  <Text style={styles.chatTime}>
                    {new Date(chat.lastMessageAt).toLocaleDateString('ar-SA')}
                  </Text>
                </View>
                <View style={styles.chatBottom}>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {chat.lastMessage ?? '—'}
                  </Text>
                  {chat.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>{chat.unread}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
              );
            })
          )}

          {!threadsLoading && filteredChats.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>لا توجد رسائل من العملاء</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.activityList, { paddingBottom: listBottomPadding }]}
        >
          {activityItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.activityRow, pressed && { backgroundColor: colors.bgSurface }]}
            >
              <View style={[styles.activityIcon, { backgroundColor: `${ACTIVITY_COLORS[item.type]}20` }]}>
                <AppIcon
                  name={ACTIVITY_ICONS[item.type]}
                  size={16}
                  color={ACTIVITY_COLORS[item.type]}
                />
              </View>
              <UserProfileLink userId={item.user.id}>
                <Image source={{ uri: item.user.avatar }} style={styles.activityAvatar} contentFit="cover" />
              </UserProfileLink>
              <View style={styles.activityContent}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  <UserProfileLink userId={item.user.id}>
                    <Text style={styles.activityUser}>{item.user.arabicName}</Text>
                  </UserProfileLink>
                  <Text style={styles.activityText}>{item.arabicText}</Text>
                </View>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  menuBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  tab: { paddingVertical: spacing.md, marginRight: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.electricBright },
  tabLabel: { ...typography.body, color: colors.textMuted },
  tabLabelActive: { color: colors.textBrandStrong, fontWeight: '600' },
  tabDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.electricBright },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginVertical: spacing.md,
    backgroundColor: colors.bgSurface, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, textAlign: 'right' },
  chatRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.borderMid },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.emerald, borderWidth: 2, borderColor: colors.bgDeep,
  },
  chatContent: { flex: 1 },
  chatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  displayName: { ...typography.bodyStrong, color: colors.textPrimary },
  chatTime: { ...typography.micro, color: colors.textMuted },
  chatBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMessage: { ...typography.caption, color: colors.textMuted, flex: 1 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.electricBright, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadCount: { fontSize: 11, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.body, color: colors.textMuted },
  activityList: { paddingBottom: spacing.huge },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  activityIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  activityAvatar: { width: 40, height: 40, borderRadius: 20 },
  activityContent: { flex: 1 },
  activityText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, textAlign: 'right' },
  activityUser: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  activityTime: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
});
