// Powered by OnSpace.AI
// SAFAT — Butcher Chat Screen (محادثة مع الجزار)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, uriSource } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';
import { ChatMessage, ButcherProfile } from '@/services/butcherData';
import { API_BASE } from '@/services/api';
import { useEffect } from 'react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';

const QUICK_REPLIES = [
  'هل متوفر الخروف الكامل؟',
  'ما هو السعر لكيلو الضأن؟',
  'متى تفتحون غداً؟',
  'هل تتوفر لحوم طازجة اليوم؟',
  'أريد طلب ذبيحة كاملة',
];

export default function ButcherChatScreen() {
  const {
    butcherId,
    threadId: threadIdParam,
    receiverId,
    receiverName,
    receiverAvatar,
  } = useLocalSearchParams<{
    butcherId?: string;
    threadId?: string;
    receiverId?: string;
    receiverName?: string;
    receiverAvatar?: string;
  }>();
  const router = useRouter();
  const { me } = useApp();
  const { accessToken } = useAuth();
  const MY_ID = me?.id || 'anonymous';
  const listRef = useRef<FlatList>(null);

  const isThreadMode = Boolean(threadIdParam && receiverId);

  const [butcher, setButcher] = useState<ButcherProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [threadId, setThreadId] = useState<string | null>(threadIdParam ?? null);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const receiverUserId = isThreadMode ? receiverId : butcher?.user?.id;
  const headerName = isThreadMode
    ? (receiverName || 'محادثة')
    : (butcher?.nameAr ?? 'الملحمة');
  const headerAvatar = isThreadMode
    ? (receiverAvatar || undefined)
    : (butcher?.logo ?? undefined);

  useEffect(() => {
    if (!isThreadMode && !butcherId) {
      Alert.alert('خطأ', 'لم يتم تحديد المحادثة المطلوبة.');
      router.back();
    }
  }, [isThreadMode, butcherId, router]);

  useEffect(() => {
    if (isThreadMode) return;
    if (!butcherId) return;
    const fetchButcher = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/butchers/${butcherId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setButcher(json.data);
          }
        }
      } catch (err) {
        console.warn('[ButcherChatScreen] Failed to fetch butcher details:', err);
      }
    };
    fetchButcher();
  }, [butcherId, isThreadMode, router]);

  useEffect(() => {
    if (!accessToken) return;
    if (isThreadMode && threadIdParam) {
      const loadThreadMessages = async () => {
        setLoadingMessages(true);
        try {
          setThreadId(threadIdParam);
          const msgRes = await fetch(`${API_BASE}/api/messages/${threadIdParam}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (msgRes.ok) {
            const msgJson = await msgRes.json();
            if (msgJson.success && msgJson.data?.messages) {
              setMessages(msgJson.data.messages.map((m: any) => ({
                id: m.id,
                senderId: m.senderId,
                receiverId: m.receiverId,
                text: m.text,
                image: m.imageUrl,
                createdAt: m.createdAt,
                read: m.isRead,
              })));
            }
          }
        } catch (err) {
          console.warn('[ButcherChatScreen] Failed to load thread messages:', err);
        } finally {
          setLoadingMessages(false);
        }
      };
      loadThreadMessages();
      return;
    }

    if (!butcherId || !butcher?.user?.id) return;
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        // Find or get existing thread
        const threadsRes = await fetch(`${API_BASE}/api/messages`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (threadsRes.ok) {
          const tJson = await threadsRes.json();
          if (tJson.success && Array.isArray(tJson.data)) {
            const existingThread = tJson.data.find(
              (t: any) => t.participant?.id === butcher.user?.id
            );
            if (existingThread) {
              setThreadId(existingThread.id);
              const msgRes = await fetch(`${API_BASE}/api/messages/${existingThread.id}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (msgRes.ok) {
                const msgJson = await msgRes.json();
                if (msgJson.success && msgJson.data?.messages) {
                  setMessages(msgJson.data.messages.map((m: any) => ({
                    id: m.id,
                    senderId: m.senderId,
                    receiverId: m.receiverId,
                    text: m.text,
                    image: m.imageUrl,
                    createdAt: m.createdAt,
                    read: m.isRead,
                  })));
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[ButcherChatScreen] Failed to load messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [butcherId, butcher?.user?.id, accessToken, isThreadMode, threadIdParam]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !receiverUserId || sending) return;
    setSending(true);
    const optimisticMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      senderId: MY_ID,
      receiverId: receiverUserId,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ receiverId: receiverUserId, text: text.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.message) {
          const real = json.data.message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticMsg.id
                ? { ...m, id: real.id }
                : m
            )
          );
          if (!threadId && json.data.threadId) setThreadId(json.data.threadId);
        }
      }
    } catch (err) {
      console.warn('[ButcherChatScreen] Failed to send message:', err);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      Alert.alert('خطأ', 'فشل إرسال الرسالة، يرجى المحاولة مجدداً.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === MY_ID;
    return (
      <View style={[mc.bubbleWrap, isMe ? mc.bubbleWrapMe : mc.bubbleWrapThem]}>
        {!isMe && (
          <Image
            source={uriSource(headerAvatar)}
            style={mc.avatar}
            contentFit="cover"
          />
        )}
        <View style={[mc.bubble, isMe ? mc.bubbleMe : mc.bubbleThem]}>
          {item.text ? (
            <Text style={[mc.bubbleText, isMe ? mc.textMe : mc.textThem]}>
              {item.text}
            </Text>
          ) : null}
          {item.image ? (
            <Image source={{ uri: item.image }} style={mc.bubbleImg} contentFit="cover" />
          ) : null}
          <Text style={[mc.timeText, isMe ? mc.timeTextMe : mc.timeTextThem]}>
            {new Date(item.createdAt).toLocaleTimeString('ar-SA', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {isMe && (
              <Text style={{ color: item.read ? colors.electricBright : colors.textSubtle }}>
                {' '}✓✓
              </Text>
            )}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={s.headerCenter}>
            <Image source={uriSource(headerAvatar)} style={s.headerAvatar} contentFit="cover" />
            <View>
              <View style={s.headerNameRow}>
                <Text style={s.headerName}>{headerName}</Text>
                {butcher?.subscriptionActive && (
                  <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
                )}
              </View>
              <View style={s.onlineRow}>
                <View style={[
                  s.onlineDot,
                  {
                    backgroundColor: butcher?.workingHours?.isOpen
                      ? colors.success
                      : colors.textSubtle,
                  },
                ]} />
                <Text style={s.onlineText}>
                  {isThreadMode
                    ? 'محادثة مباشرة'
                    : butcher?.workingHours?.isOpen
                      ? 'متاح الآن'
                      : 'غير متاح'}
                </Text>
              </View>
            </View>
          </View>
          <Pressable style={s.callBtn}>
            <Ionicons name="call-outline" size={20} color={colors.electricBright} />
          </Pressable>
        </View>

        {/* Order summary strip (if applicable) */}
        <View style={s.orderStrip}>
          <MaterialCommunityIcons name="clipboard-list-outline" size={16} color={colors.glow} />
          <Text style={s.orderStripText}>
            يمكنك مناقشة تفاصيل طلبك وتأكيده هنا مباشرةً مع الجزار
          </Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={s.messagesList}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />

        {/* Quick replies */}
        <View style={s.quickRepliesWrap}>
          <FlatList
            horizontal
            data={QUICK_REPLIES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => sendMessage(item)}
                style={s.quickReply}
              >
                <Text style={s.quickReplyText}>{item}</Text>
              </Pressable>
            )}
            contentContainerStyle={s.quickRepliesRow}
            showsHorizontalScrollIndicator={false}
          />
        </View>

        {/* Input bar */}
        <View style={s.inputBar}>
          {/* Attachment */}
          <Pressable style={s.attachBtn}>
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          </Pressable>

          <TextInput
            style={s.input}
            placeholder="اكتب رسالتك..."
            placeholderTextColor={colors.textSubtle}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            textAlign="right"
          />

          <Pressable
            style={[s.sendBtn, !inputText.trim() && { opacity: 0.4 }]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={[colors.electric, colors.cyan]}
              style={s.sendBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="paper-plane" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5,
    borderColor: colors.borderMid,
  },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerName: { ...typography.bodyStrong, color: colors.textPrimary },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { ...typography.micro, color: colors.textMuted },
  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.bgGlass,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  orderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  orderStripText: { ...typography.caption, color: colors.textMuted, flex: 1, textAlign: 'right' },

  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },

  quickRepliesWrap: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  quickRepliesRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  quickReply: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  quickReplyText: { ...typography.caption, color: colors.glow },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bgPrimary,
  },
  attachBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgSurface,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...typography.body,
    color: colors.textPrimary,
    maxHeight: 100,
    textAlignVertical: 'center',
  },
  sendBtn: { borderRadius: 21, overflow: 'hidden' },
  sendBtnGrad: {
    width: 42, height: 42,
    alignItems: 'center', justifyContent: 'center',
  },
});

const mc = StyleSheet.create({
  bubbleWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
    gap: 8,
  },
  bubbleWrapMe: { justifyContent: 'flex-end' },
  bubbleWrapThem: { justifyContent: 'flex-start' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.bgElevated,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleMe: {
    backgroundColor: colors.electric,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { ...typography.body, lineHeight: 20 },
  textMe: { color: '#fff' },
  textThem: { color: colors.textPrimary },
  bubbleImg: {
    width: 200, height: 150,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  timeText: { ...typography.micro, marginTop: 4 },
  timeTextMe: { color: 'rgba(255,255,255,0.55)', textAlign: 'right' },
  timeTextThem: { color: colors.textSubtle },
});
