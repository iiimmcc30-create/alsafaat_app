// SAFAT — Messages panel (standalone tab or embedded in profile)
import { AppIcon } from '@/components/ui/FlaticonIcon';

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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchNotifications, type AppNotification } from '@/services/notifications';
import { useMessageThreads, type MessageThreadType } from '@/hooks/useMessageThreads';
import { handleNotificationNavigation } from '@/lib/notifications';
import { UserProfileLink } from '@/components/feature/UserProfileLink';

type Tab = 'messages' | 'activity';
type InboxKind = MessageThreadType;

interface MessagesPanelProps {
  /** embedded = inside profile scroll; standalone = full screen with own scroll */
  variant?: 'embedded' | 'standalone';
  showHeader?: boolean;
}

export function MessagesPanel({ variant = 'standalone', showHeader = true }: MessagesPanelProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = 58 + Math.max(insets.bottom, 8) + 6;
  const listBottomPadding =
    variant === 'embedded'
      ? spacing.lg
      : tabBarClearance + spacing.xl;
  const { accessToken, user } = useAuth();
  const [inboxKind, setInboxKind] = useState<InboxKind>('DIRECT');
  const { threads, loading: threadsLoading, error: threadsError } = useMessageThreads(
    accessToken,
    inboxKind,
  );
  const [activeTab, setActiveTab] = useState<Tab>('messages');
  const [search, setSearch] = useState('');
  const [notificationsList, setNotificationsList] = useState<AppNotification[]>([]);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!accessToken) return;
      try {
        const page = await fetchNotifications();
        setNotificationsList(page.notifications);
      } catch (err) {
        console.warn('[MessagesPanel] Failed to fetch notifications:', err);
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
      notification: n,
      user: {
        id: (n.data?.actorId as string | undefined) || undefined,
        avatar: (n.data?.actorAvatar as string | undefined) || undefined,
        arabicName: n.titleAr || 'إشعار صفاة',
      },
      arabicText: n.bodyAr,
      time: new Date(n.createdAt).toLocaleDateString('ar-SA'),
    };
  });

  const filteredChats = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const butcherName = t.butcher?.nameAr ?? '';
    const p = t.participant;
    const names = [
      p?.displayName?.toLowerCase() ?? '',
      p?.arabicName ?? '',
      butcherName,
    ];
    return names.some((n) => n.includes(q) || n.toLowerCase().includes(q));
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
    const isButcher = chat.type === 'BUTCHER';
    router.push({
      pathname: '/butchers/chat',
      params: {
        threadId: chat.id,
        receiverId: p.id,
        receiverName: isButcher
          ? chat.butcher?.nameAr || p.arabicName
          : p.arabicName,
        receiverAvatar: isButcher
          ? chat.butcher?.logo || p.avatar || ''
          : p.avatar ?? '',
        threadType: chat.type,
        ...(chat.butcherId ? { butcherId: chat.butcherId } : {}),
      },
    } as any);
  };

  const messagesContent = (
    <>
      {activeTab === 'messages' ? (
        <>
          <View style={styles.inboxTabs}>
            <Pressable
              onPress={() => setInboxKind('DIRECT')}
              style={[styles.inboxTab, inboxKind === 'DIRECT' && styles.inboxTabActive]}
            >
              <Text
                style={[
                  styles.inboxTabLabel,
                  inboxKind === 'DIRECT' && styles.inboxTabLabelActive,
                ]}
              >
                المستخدمون
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setInboxKind('BUTCHER')}
              style={[styles.inboxTab, inboxKind === 'BUTCHER' && styles.inboxTabActive]}
            >
              <Text
                style={[
                  styles.inboxTabLabel,
                  inboxKind === 'BUTCHER' && styles.inboxTabLabelActive,
                ]}
              >
                الملاحم
              </Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <AppIcon name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={
                inboxKind === 'BUTCHER'
                  ? 'ابحث في رسائل الملاحم...'
                  : 'ابحث في الرسائل...'
              }
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
              const isButcher = chat.type === 'BUTCHER';
              const title = isButcher
                ? chat.butcher?.nameAr || p.arabicName
                : p.arabicName;
              const avatarUri = isButcher
                ? chat.butcher?.logo || p.avatar
                : p.avatar;
              return (
                <View key={chat.id} style={styles.chatRow}>
                  {isButcher ? (
                    <View style={styles.avatarWrap}>
                      <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
                    </View>
                  ) : (
                    <UserProfileLink userId={p.id}>
                      <View style={styles.avatarWrap}>
                        <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
                        <View style={styles.onlineDot} />
                      </View>
                    </UserProfileLink>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.chatContent, pressed && { opacity: 0.85 }]}
                    onPress={() => openChat(chat)}
                  >
                    <View style={styles.chatTop}>
                      {isButcher ? (
                        <View style={styles.chatName}>
                          <Text style={styles.displayName}>{title}</Text>
                        </View>
                      ) : (
                        <UserProfileLink userId={p.id} style={styles.chatName}>
                          <Text style={styles.displayName}>{title}</Text>
                          {p.verified && (
                            <AppIcon name="checkmark-circle" size={13} color={colors.electricBright} />
                          )}
                        </UserProfileLink>
                      )}
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
              <Text style={styles.emptyText}>
                {inboxKind === 'BUTCHER'
                  ? 'لا توجد محادثات مع ملاحم'
                  : 'لا توجد محادثات'}
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          {activityItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.activityRow, pressed && { backgroundColor: colors.bgSurface }]}
              onPress={() => {
                handleNotificationNavigation(
                  { type: item.notification.type, data: item.notification.data },
                  { router, isAdmin: user?.role === 'ADMIN' },
                );
              }}
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
                <View style={styles.activityTextRow}>
                  <UserProfileLink userId={item.user.id}>
                    <Text style={styles.activityUser}>{item.user.arabicName}</Text>
                  </UserProfileLink>
                  <Text style={styles.activityText}>{item.arabicText}</Text>
                </View>
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
        <View style={{ height: listBottomPadding }} />
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
            <AppIcon name="create-outline" size={22} color={colors.electricBright} />
          </Pressable>
        </View>
      )}
      {tabSwitcher}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: listBottomPadding }}
      >
        {messagesContent}
      </ScrollView>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
  tabLabelActive: { color: colors.textBrandStrong, fontWeight: '600' },
  tabDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.electricBright },
  inboxTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  inboxTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  inboxTabActive: {
    borderColor: colors.electricBright,
    backgroundColor: colors.bgGlass,
  },
  inboxTabLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '500' },
  inboxTabLabelActive: { color: colors.textBrandStrong, fontWeight: '700' },
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
  activityTextRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  activityText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, textAlign: 'right', flex: 1 },
  activityUser: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  activityTime: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
  });
}
