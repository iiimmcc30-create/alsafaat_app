// SAFAT — Messages panel (standalone tab or embedded in profile)

import { Ionicons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';
import { useMessageThreads } from '@/hooks/useMessageThreads';

type Tab = 'messages' | 'activity';

interface MessagesPanelProps {
  /** embedded = inside profile scroll; standalone = full screen with own scroll */
  variant?: 'embedded' | 'standalone';
  showHeader?: boolean;
}

export function MessagesPanel({ variant = 'standalone', showHeader = true }: MessagesPanelProps) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { threads, loading: threadsLoading, error: threadsError } = useMessageThreads(accessToken);
  const [activeTab, setActiveTab] = useState<Tab>('messages');
  const [search, setSearch] = useState('');
  const [notificationsList, setNotificationsList] = useState<any[]>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!accessToken) return;
      try {
        const res = await authFetch(`${API_BASE}/api/notifications`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.notifications) {
            setNotificationsList(json.data.notifications);
          }
        }
      } catch (err) {
        console.warn('[MessagesPanel] Failed to fetch notifications:', err);
      }
    };
    fetchNotifications();
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
        avatar: n.data?.actorAvatar || undefined,
        arabicName: n.titleAr || 'إشعار صفاة',
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

  const openChat = (chat: typeof threads[0]) => {
    const p = chat.participant;
    if (!p) return;
    router.push({
      pathname: '/butchers/chat',
      params: {
        threadId: chat.id,
        receiverId: p.id,
        receiverName: p.arabicName,
        receiverAvatar: p.avatar ?? '',
      },
    } as any);
  };

  const messagesContent = (
    <>
      {activeTab === 'messages' ? (
        <>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث في الرسائل..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
          </View>

          {threadsLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.electricBright} />
              <Text style={styles.emptyText}>جاري تحميل المحادثات...</Text>
            </View>
          ) : threadsError === 'unauthorized' ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔒</Text>
              <Text style={styles.emptyText}>سجّل الدخول لعرض رسائلك</Text>
            </View>
          ) : (
            filteredChats.map((chat) => {
              const p = chat.participant;
              if (!p) return null;
              return (
                <Pressable
                  key={chat.id}
                  style={({ pressed }) => [styles.chatRow, pressed && { backgroundColor: colors.bgSurface }]}
                  onPress={() => openChat(chat)}
                >
                  <View style={styles.avatarWrap}>
                    <Image source={{ uri: p.avatar }} style={styles.avatar} contentFit="cover" />
                    <View style={styles.onlineDot} />
                  </View>
                  <View style={styles.chatContent}>
                    <View style={styles.chatTop}>
                      <View style={styles.chatName}>
                        <Text style={styles.displayName}>{p.arabicName}</Text>
                        {p.verified && (
                          <Ionicons name="checkmark-circle" size={13} color={colors.electricBright} />
                        )}
                      </View>
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
                  </View>
                </Pressable>
              );
            })
          )}

          {!threadsLoading && filteredChats.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>لا توجد محادثات</Text>
            </View>
          )}
        </>
      ) : (
        <>
          {activityItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.activityRow, pressed && { backgroundColor: colors.bgSurface }]}
            >
              <View style={[styles.activityIcon, { backgroundColor: `${ACTIVITY_COLORS[item.type]}20` }]}>
                <Ionicons
                  name={ACTIVITY_ICONS[item.type] as any}
                  size={16}
                  color={ACTIVITY_COLORS[item.type]}
                />
              </View>
              <Image source={{ uri: item.user.avatar }} style={styles.activityAvatar} contentFit="cover" />
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  <Text style={styles.activityUser}>{item.user.arabicName}</Text>
                  {'  '}{item.arabicText}
                </Text>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
            </Pressable>
          ))}
          {activityItems.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>لا يوجد نشاط بعد</Text>
            </View>
          )}
        </>
      )}
    </>
  );

  const tabSwitcher = (
    <View style={[styles.tabs, variant === 'embedded' && styles.tabsEmbedded]}>
      <Pressable
        onPress={() => setActiveTab('messages')}
        style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
      >
        <Text style={[styles.tabLabel, activeTab === 'messages' && styles.tabLabelActive]}>
          الرسائل
        </Text>
        {threads.some((t) => t.unread > 0) && <View style={styles.tabDot} />}
      </Pressable>
      <Pressable
        onPress={() => setActiveTab('activity')}
        style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
      >
        <Text style={[styles.tabLabel, activeTab === 'activity' && styles.tabLabelActive]}>
          النشاط
        </Text>
      </Pressable>
    </View>
  );

  if (variant === 'embedded') {
    return (
      <View style={styles.embeddedWrap}>
        {tabSwitcher}
        {messagesContent}
      </View>
    );
  }

  return (
    <>
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.title}>
            {activeTab === 'messages' ? 'الرسائل' : 'النشاط'}
          </Text>
          <Pressable style={styles.composeBtn} onPress={() => router.push('/create/post')}>
            <Ionicons name="create-outline" size={22} color={colors.electricBright} />
          </Pressable>
        </View>
      )}
      {tabSwitcher}
      <ScrollView showsVerticalScrollIndicator={false}>
        {messagesContent}
        <View style={{ height: 80 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  embeddedWrap: {
    marginHorizontal: -spacing.lg,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  composeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  tabsEmbedded: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  tab: { paddingVertical: spacing.md, marginRight: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.electricBright },
  tabLabel: { ...typography.body, color: colors.textMuted },
  tabLabelActive: { color: colors.electricBright, fontWeight: '600' },
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
