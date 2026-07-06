// app/live/broadcast.tsx — شاشة البث المباشر (المضيف)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { Image } from '@/components/ui/AppImage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwakeAsync } from 'expo-keep-awake';
import { AgoraVideoView } from '@/components/live/AgoraVideoView';
import { VideoSourceType } from '@/lib/agora';
import { useLiveStream } from '@/hooks/useLiveStream';
import { useLiveSocket } from '@/hooks/useLiveSocket';
import { colors, radius, spacing } from '@/constants/theme';
import { liveCategoryLabel } from '@/constants/liveCategories';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';

interface LiveComment {
  id: string;
  userId?: string;
  username: string;
  arabicName?: string;
  message: string;
  isOffer: boolean;
  offerAmount?: number;
  createdAt: string;
}

export default function BroadcastScreen() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const params = useLocalSearchParams<{
    streamId: string;
    agoraAppId: string;
    agoraChannel: string;
    agoraToken: string;
    agoraUid?: string;
    arabicTitle?: string;
    category?: string;
    autoStart?: string;
    camOff?: string;
    micOff?: string;
  }>();

  const [phase, setPhase] = useState<'preview' | 'live' | 'ended'>('preview');
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [isMuted, setIsMuted] = useState(params.micOff === '1');
  const [camOff, setCamOff] = useState(params.camOff === '1');
  const [commentText, setCommentText] = useState('');
  const [ending, setEnding] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const autoStarted = useRef(false);

  const hostName = user?.arabicName ?? user?.displayName ?? user?.username ?? 'بائع';
  const hostAvatar = user?.avatar;
  const streamTitle = params.arabicTitle ?? 'بث مباشر';
  const categoryLabel = liveCategoryLabel(params.category);

  const { sendComment: emitComment, sendLike } = useLiveSocket({
    streamId: params.streamId,
    accessToken,
    enabled: phase === 'live' && Boolean(params.streamId),
    onComment: (comment) => {
      setComments((prev) => [...prev, {
        id: comment.id,
        userId: comment.userId,
        username: comment.username,
        arabicName: comment.arabicName,
        message: comment.message,
        isOffer: comment.isOffer ?? false,
        offerAmount: comment.offerAmount,
        createdAt: comment.createdAt,
      }]);
    },
    onViewers: setViewers,
    onLikes: setLikes,
    onStats: (stats) => {
      setViewers(stats.viewers);
      setLikes(stats.likes);
    },
  });

  const {
    isJoined, localUid,
    join, leave, startPublishing, stopPublishing,
    switchCamera, muteAudio, muteVideo,
  } = useLiveStream({
    role: 'host',
    onError: (e) => Alert.alert('خطأ في البث', e),
  });

  useEffect(() => {
    if (phase !== 'live') return;
    activateKeepAwakeAsync('safat-live-broadcast').catch(() => {});
    return () => {
      deactivateKeepAwakeAsync('safat-live-broadcast').catch(() => {});
    };
  }, [phase]);

  useEffect(() => {
    if (!params.agoraAppId || !params.agoraToken || !params.agoraChannel) {
      setJoinFailed('بيانات البث غير مكتملة — ارجع وحاول مجدداً');
      return;
    }
    join({
      agoraAppId: params.agoraAppId,
      agoraChannel: params.agoraChannel,
      agoraToken: params.agoraToken,
      agoraUid: params.agoraUid ? parseInt(params.agoraUid, 10) : 0,
    })
      .then(() => {
        if (params.camOff === '1') muteVideo(true);
        if (params.micOff === '1') muteAudio(true);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setJoinFailed(msg);
      });
  }, []);

  const goLive = useCallback(async () => {
    if (!accessToken) {
      Alert.alert('غير مصرح', 'يجب تسجيل الدخول لبدء البث');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/livestreams/${params.streamId}?action=start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.messageAr || 'فشل بدء البث');
      }
      await startPublishing();
      setPhase('live');
    } catch (e) {
      Alert.alert('فشل بدء البث', String(e));
    }
  }, [params.streamId, startPublishing, accessToken]);

  useEffect(() => {
    if (params.autoStart !== '1' || phase !== 'preview' || !isJoined || autoStarted.current) return;
    autoStarted.current = true;
    goLive();
  }, [params.autoStart, phase, isJoined, goLive]);

  const performEndStream = useCallback(async () => {
    setEnding(true);
    let summary = '';
    try {
      if (accessToken && params.streamId) {
        const resp = await fetch(`${API_BASE}/api/livestreams/${params.streamId}?action=end`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json.success) {
          summary = `المدة: ${json.data?.durationMinutes ?? 0} دقيقة\nأعلى عدد مشاهدين: ${json.data?.peakViewers ?? 0}`;
        } else {
          summary = json.messageAr || json.message || 'تم إغلاق البث محلياً';
        }
      }
    } catch {
      summary = 'تم إغلاق البث محلياً';
    } finally {
      try {
        await stopPublishing();
        await leave();
      } catch {
        // ignore cleanup errors
      }
      setPhase('ended');
      setEnding(false);
      Alert.alert('انتهى البث', summary || 'تم إنهاء البث', [
        { text: 'حسناً', onPress: () => router.back() },
      ]);
    }
  }, [params.streamId, leave, stopPublishing, router, accessToken]);

  const endStream = useCallback(() => {
    Alert.alert('إنهاء البث', 'هل أنت متأكد من إنهاء البث المباشر؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إنهاء', style: 'destructive', onPress: performEndStream },
    ]);
  }, [performEndStream]);

  const flipCamera = useCallback(() => switchCamera(), [switchCamera]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    muteAudio(next);
    setIsMuted(next);
  }, [isMuted, muteAudio]);

  const toggleCam = useCallback(() => {
    const next = !camOff;
    muteVideo(next);
    setCamOff(next);
  }, [camOff, muteVideo]);

  const handleSendComment = useCallback(() => {
    const text = commentText.trim();
    if (!text) return;
    emitComment(text);
    setCommentText('');
  }, [commentText, emitComment]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `شاهد بث "${streamTitle}" مباشرة على سروح`,
        title: streamTitle,
      });
    } catch {
      // user cancelled
    }
  }, [streamTitle]);

  const showMenu = useCallback(() => {
    Alert.alert('خيارات البث', streamTitle, [
      { text: 'قلب الكاميرا', onPress: flipCamera },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  }, [streamTitle, flipCamera]);

  const isLive = phase === 'live';

  return (
    <View style={styles.container}>
      {/* Video layer */}
      {joinFailed ? (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <AppIcon name="warning-outline" size={48} color={colors.danger} />
          <Text style={styles.hint}>{joinFailed}</Text>
          <Pressable style={styles.endBtn} onPress={() => { leave(); router.back(); }}>
            <Text style={styles.endBtnText}>رجوع</Text>
          </Pressable>
        </View>
      ) : isJoined && !camOff ? (
        <AgoraVideoView
          local
          canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
          style={StyleSheet.absoluteFill}
        />
      ) : isJoined && camOff ? (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <AppIcon name="videocam-off" size={52} color="rgba(255,255,255,0.5)" />
          <Text style={styles.hint}>الكاميرا مغلقة</Text>
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.hint}>جارٍ تهيئة الكاميرا...</Text>
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView style={styles.topSafe} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow}>
          <Pressable style={styles.iconCircle} onPress={showMenu} hitSlop={8}>
            <AppIcon name="ellipsis-horizontal" size={20} color="#fff" />
          </Pressable>

          <View style={styles.topCenter}>
            {isLive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            ) : (
              <View style={[styles.liveBadge, styles.previewBadge]}>
                <Text style={styles.liveBadgeText}>معاينة</Text>
              </View>
            )}
            <View style={styles.viewerPill}>
              <AppIcon name="person" size={12} color="#fff" />
              <Text style={styles.viewerText}>{viewers}</Text>
            </View>
          </View>

          <Pressable
            style={styles.iconCircle}
            onPress={isLive ? endStream : () => { leave(); router.back(); }}
            disabled={ending}
            hitSlop={8}
          >
            {ending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <AppIcon name="close" size={22} color="#fff" />
            )}
          </Pressable>
        </View>

        {/* Host card */}
        <View style={styles.hostCard}>
          {hostAvatar ? (
            <Image source={{ uri: hostAvatar }} style={styles.hostAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.hostAvatar, styles.hostAvatarFallback]}>
              <Text style={styles.hostAvatarLetter}>{hostName.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.hostInfo}>
            <View style={styles.hostNameRow}>
              <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
              {user?.verified && (
                <AppIcon name="checkmark-circle" size={16} color={colors.electricBright} />
              )}
            </View>
            <View style={styles.hostMetaRow}>
              <View style={styles.categoryPill}>
                <AppIcon name="auto-fix" size={12} color="#fff" />
                <Text style={styles.categoryText}>{categoryLabel}</Text>
              </View>
              <Text style={styles.liveSub}>مباشر</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Comments feed */}
      {isLive && comments.length > 0 && (
        <View style={styles.commentsWrap} pointerEvents="box-none">
          <FlatList
            ref={flatRef}
            data={comments.slice(-20)}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.isOffer && styles.offerBubble]}>
                <Text style={styles.bubbleUser}>{item.arabicName ?? item.username}</Text>
                <Text style={styles.bubbleText}>{item.message}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          />
        </View>
      )}

      {/* Bottom UI */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomWrap}
      >
        <SafeAreaView edges={['bottom']}>
          {phase === 'preview' ? (
            <Pressable
              style={[styles.startBtn, !isJoined && styles.startBtnDisabled]}
              onPress={goLive}
              disabled={!isJoined}
            >
              {isJoined ? (
                <Text style={styles.startBtnText}>🔴 بدء البث المباشر</Text>
              ) : (
                <ActivityIndicator color="#fff" />
              )}
            </Pressable>
          ) : (
            <>
              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <AppIcon name="chatbubble-ellipses-outline" size={18} color="#fff" />
                  <Text style={styles.statNum}>{comments.length}</Text>
                </View>
                <View style={styles.statItem}>
                  <AppIcon name="heart" size={18} color={colors.liveRed} />
                  <Text style={styles.statNum}>{likes}</Text>
                </View>
              </View>

              {/* Streamer controls */}
              <View style={styles.controlsRow}>
                <Pressable style={styles.endBtn} onPress={endStream} disabled={ending}>
                  <AppIcon name="scissors-cutting" size={18} color="#fff" />
                  <Text style={styles.endBtnText}>إنهاء</Text>
                </Pressable>

                <Pressable style={styles.flipBtn} onPress={flipCamera}>
                  <AppIcon name="camera-reverse-outline" size={26} color="#fff" />
                </Pressable>

                <Pressable
                  style={[styles.mediaBtn, isMuted && styles.mediaBtnOff]}
                  onPress={toggleMute}
                >
                  <AppIcon name={isMuted ? 'mic-off' : 'mic'} size={22} color="#fff" />
                </Pressable>

                <Pressable
                  style={[styles.mediaBtn, camOff && styles.mediaBtnOff]}
                  onPress={toggleCam}
                >
                  <AppIcon name={camOff ? 'videocam-off' : 'videocam'} size={22} color="#fff" />
                </Pressable>
              </View>

              {/* Comment input row */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="...أضف تعليقاً"
                  placeholderTextColor="rgba(0,0,0,0.35)"
                  value={commentText}
                  onChangeText={setCommentText}
                  returnKeyType="send"
                  onSubmitEditing={handleSendComment}
                  textAlign="right"
                />
                <Pressable
                  style={[styles.actionBtn, styles.sendBtn, !commentText.trim() && styles.actionBtnDisabled]}
                  onPress={handleSendComment}
                  disabled={!commentText.trim()}
                >
                  <AppIcon name="send" size={18} color="#fff" />
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare}>
                  <AppIcon name="share-social-outline" size={18} color="#fff" />
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.likeBtn]} onPress={sendLike}>
                  <AppIcon name="heart" size={18} color="#fff" />
                </Pressable>
              </View>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  hint: { color: 'rgba(255,255,255,0.7)', marginTop: 12, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },

  topSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  topCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.liveRed,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  previewBadge: { backgroundColor: 'rgba(255,255,255,0.25)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  viewerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  viewerText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    marginRight: spacing.md,
    marginLeft: spacing.md,
    gap: 10,
  },
  hostAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  hostAvatarFallback: { backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  hostAvatarLetter: { color: '#fff', fontSize: 18, fontWeight: '700' },
  hostInfo: { alignItems: 'flex-end', maxWidth: '70%' },
  hostNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hostName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hostMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.electric,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
  },
  categoryText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  liveSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },

  commentsWrap: {
    position: 'absolute',
    bottom: 210,
    left: spacing.md,
    right: '30%',
    maxHeight: 200,
  },
  bubble: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  offerBubble: { backgroundColor: 'rgba(200,40,40,0.65)' },
  bubbleUser: { color: colors.textBrandStrong, fontSize: 11, fontWeight: '700' },
  bubbleText: { color: '#fff', fontSize: 13 },

  bottomWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  startBtn: {
    margin: spacing.lg,
    backgroundColor: colors.liveRed,
    borderRadius: radius.xl,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statNum: { color: '#fff', fontSize: 14, fontWeight: '700' },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.liveRed,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  endBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  flipBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  mediaBtnOff: { backgroundColor: colors.liveRed },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: '#111',
    fontSize: 14,
  },
  actionBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnDisabled: { opacity: 0.4 },
  sendBtn: { backgroundColor: colors.electricBright },
  shareBtn: { backgroundColor: 'rgba(30,30,30,0.85)' },
  likeBtn: { backgroundColor: colors.liveRed },
});
