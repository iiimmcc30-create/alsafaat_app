import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image as RNImage,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { storyPlaybackVideoUrl } from '@/constants/stories';
import { resolveMediaUrl } from '@/services/media';
import { StoryVideoPlayer } from '@/components/feature/StoryVideoPlayer';
import { promptReport } from '@/services/reports';
import {
  REACTION_META,
  StoryGroup,
  StoryItem,
  StoryReactionType,
  deleteStory,
  fetchStoryViewers,
  recordStoryView,
  removeStoryReaction,
  replyToStory,
  setStoryReaction,
} from '@/services/stories';

const CIRCLE = 68;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type StoriesBarProps = {
  feed: StoryGroup[];
  myStories: StoryGroup | null;
  myAvatar?: string;
  currentUserId?: string;
  accessToken?: string | null;
  loading?: boolean;
  onAddStory: () => void;
  onRefresh: () => void;
};

type ViewerProps = {
  groups: StoryGroup[];
  startGroupIndex: number;
  currentUserId?: string;
  accessToken?: string | null;
  onClose: () => void;
  onRefresh: () => void;
};

function preloadUri(uri?: string | null) {
  const resolved = resolveMediaUrl(uri);
  if (resolved) RNImage.prefetch(resolved).catch(() => {});
}

function StoryViewer({
  groups,
  startGroupIndex,
  currentUserId,
  accessToken,
  onClose,
  onRefresh,
}: ViewerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors: c }) => createViewerStyles(c));
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<
    Array<{ id: string; arabicName: string; avatar?: string | null; viewedAt: string }>
  >([]);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const pausedRef = useRef(false);
  const [mediaReady, setMediaReady] = useState(false);

  const group = groups[groupIndex];
  const stories = group?.stories ?? [];
  const story = stories[storyIndex];
  const isOwn = !!currentUserId && group?.user.id === currentUserId;
  const videoUri = storyPlaybackVideoUrl(story)
    ? resolveMediaUrl(story!.mediaUrl!)
    : null;
  const imageUri = resolveMediaUrl(story?.thumbnail);
  const durationSec = Math.max(1, story?.duration || 5);

  useEffect(() => {
    setMediaReady(!videoUri);
    if (!videoUri) return;
    const timer = setTimeout(() => setMediaReady(true), 3500);
    return () => clearTimeout(timer);
  }, [story?.id, videoUri]);

  const handleVideoReady = useCallback(() => {
    setMediaReady(true);
  }, []);

  const goNextStory = useCallback(() => {
    if (storyIndex < stories.length - 1) {
      setStoryIndex((i) => i + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
      return;
    }
    onClose();
  }, [storyIndex, stories.length, groupIndex, groups.length, onClose]);

  const goPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      return;
    }
    if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex((g) => g - 1);
      setStoryIndex(Math.max(0, (prevGroup?.stories.length ?? 1) - 1));
      return;
    }
    onClose();
  }, [storyIndex, groupIndex, groups, onClose]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!story || !accessToken || isOwn) return;
    void recordStoryView(accessToken, story.id);
  }, [story?.id, accessToken, isOwn]);

  useEffect(() => {
    const nextStory = stories[storyIndex + 1];
    const nextGroup = groups[groupIndex + 1]?.stories?.[0];
    preloadUri(nextStory?.mediaUrl || nextStory?.thumbnail);
    preloadUri(nextGroup?.mediaUrl || nextGroup?.thumbnail);
  }, [storyIndex, groupIndex, stories, groups]);

  useEffect(() => {
    if (!story || !mediaReady) return;
    progress.setValue(0);
    animRef.current?.stop();
    if (paused) return;

    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: durationSec * 1000,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished && !pausedRef.current) goNextStory();
    });
    return () => animRef.current?.stop();
  }, [story?.id, durationSec, paused, goNextStory, progress, mediaReady]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 80) onClose();
        },
      }),
    [onClose],
  );

  const handleReact = async (type: StoryReactionType) => {
    if (!accessToken || !story || busy) return;
    setBusy(true);
    try {
      if (story.myReaction === type) {
        const res = await removeStoryReaction(accessToken, story.id);
        story.myReaction = null;
        story.reactionsCount = res.reactionsCount;
      } else {
        const res = await setStoryReaction(accessToken, story.id, type);
        story.myReaction = res.type;
        story.reactionsCount = res.reactionsCount;
      }
      setStoryIndex((i) => i);
      onRefresh();
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل التفاعل');
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async () => {
    if (!accessToken || !story || !replyText.trim() || busy) return;
    setBusy(true);
    try {
      const res = await replyToStory(accessToken, story.id, replyText.trim());
      setReplyText('');
      onClose();
      router.push({
        pathname: '/butchers/chat',
        params: {
          threadId: res.threadId,
          receiverId: res.receiverId,
          receiverName: group.user.arabicName || group.user.displayName,
          receiverAvatar: group.user.avatar || '',
        },
      });
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل إرسال الرد');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!accessToken || !story || busy) return;
    Alert.alert('حذف القصة', 'هل تريد حذف هذه القصة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const result = await deleteStory(accessToken, story.id);
            if (result.ok) {
              onRefresh();
              onClose();
            } else {
              Alert.alert('خطأ', result.error || 'فشل حذف القصة');
            }
          } catch (err) {
            Alert.alert(
              'خطأ',
              err instanceof Error ? err.message : 'فشل حذف القصة',
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openViewers = async () => {
    if (!accessToken || !story || !isOwn) return;
    setShowViewers(true);
    try {
      const data = await fetchStoryViewers(accessToken, story.id);
      setViewers(data.viewers);
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل التحميل');
    }
  };

  if (!story || !group) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container} {...panResponder.panHandlers}>
        {videoUri ? (
          <StoryVideoPlayer
            key={story.id}
            uri={videoUri}
            posterUri={imageUri}
            style={styles.bg}
            muted={muted}
            loop={false}
            autoPlay={!paused}
            nativeControls={false}
            onReady={handleVideoReady}
          />
        ) : (
          <Image source={{ uri: imageUri }} style={styles.bg} contentFit="cover" />
        )}

        <View style={[styles.progressRow, { top: insets.top + 8 }]}>
          {stories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < storyIndex
                        ? '100%'
                        : i === storyIndex
                          ? progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            })
                          : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={[styles.header, { top: insets.top + 22 }]}>
          <Image
            source={{ uri: resolveMediaUrl(group.user.avatar) }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>
              {group.user.arabicName || group.user.displayName}
            </Text>
            {story.location ? (
              <Text style={styles.meta}>{story.location}</Text>
            ) : (
              <Text style={styles.meta}>
                {new Date(story.createdAt).toLocaleTimeString('ar-SA', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
          {videoUri ? (
            <Pressable onPress={() => setMuted((m) => !m)} hitSlop={10} style={styles.iconBtn}>
              <AppIcon name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
            </Pressable>
          ) : null}
          {isOwn ? (
            <>
              <Pressable onPress={openViewers} hitSlop={10} style={styles.iconBtn}>
                <AppIcon name="eye-outline" size={20} color="#fff" />
                <Text style={styles.viewsCount}>{story.viewsCount}</Text>
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={10} style={styles.iconBtn}>
                <AppIcon name="trash-outline" size={20} color="#fff" />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => promptReport('story', story.id, !!accessToken)}
              hitSlop={10}
              style={styles.iconBtn}
            >
              <AppIcon name="flag-outline" size={20} color="#fff" />
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <AppIcon name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.tapRow}>
          <Pressable
            style={{ flex: 1 }}
            onPress={goPrevStory}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={160}
          />
          <Pressable
            style={{ flex: 1 }}
            onPress={goNextStory}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            delayLongPress={160}
          />
        </View>

        {(story.captionAr || story.caption) && (
          <Text style={[styles.caption, { bottom: insets.bottom + 120 }]}>
            {story.captionAr || story.caption}
          </Text>
        )}

        {story.listing ? (
          <Pressable
            style={[styles.listingBtn, { bottom: insets.bottom + 78 }]}
            onPress={() => {
              onClose();
              router.push({
                pathname: '/listing/[id]',
                params: { id: story.listing!.id },
              });
            }}
          >
            <AppIcon name="pricetag" size={16} color="#fff" />
            <Text style={styles.listingBtnText}>عرض الإعلان</Text>
          </Pressable>
        ) : null}

        {!isOwn && accessToken ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reactionsRow}>
              {REACTION_META.map((r) => (
                <Pressable
                  key={r.type}
                  onPress={() => handleReact(r.type)}
                  style={[
                    styles.reactionChip,
                    story.myReaction === r.type && styles.reactionChipActive,
                  ]}
                >
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.replyRow}>
              <TextInput
                style={styles.replyInput}
                placeholder="رد خاص..."
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                maxLength={500}
              />
              <Pressable
                onPress={handleReply}
                disabled={!replyText.trim() || busy}
                style={[styles.sendBtn, !replyText.trim() && { opacity: 0.4 }]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <AppIcon name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.ownerStats, { bottom: insets.bottom + 16 }]}>
            <Text style={styles.ownerStatsText}>
              👁 {story.viewsCount} · {story.reactionsCount} تفاعل
            </Text>
          </View>
        )}

        <Modal visible={showViewers} animationType="slide" transparent onRequestClose={() => setShowViewers(false)}>
          <View style={styles.viewersSheet}>
            <View style={styles.viewersCard}>
              <Text style={styles.viewersTitle}>المشاهدات</Text>
              <FlatList
                data={viewers}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <Text style={styles.emptyViewers}>لا مشاهدات بعد</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.viewerRow}>
                    <Image
                      source={{ uri: resolveMediaUrl(item.avatar) }}
                      style={styles.viewerAvatar}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.viewerName}>{item.arabicName}</Text>
                      <Text style={styles.viewerTime}>
                        {new Date(item.viewedAt).toLocaleString('ar-SA')}
                      </Text>
                    </View>
                  </View>
                )}
              />
              <Pressable onPress={() => setShowViewers(false)} style={styles.closeViewers}>
                <Text style={styles.closeViewersText}>إغلاق</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

export function StoriesBar({
  feed,
  myStories,
  myAvatar,
  currentUserId,
  accessToken,
  loading,
  onAddStory,
  onRefresh,
}: StoriesBarProps) {
  const styles = useThemedStyles(({ colors }) => createBarStyles(colors));
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(
    null,
  );

  const openMyStories = () => {
    if (myStories && myStories.stories.length > 0) {
      const groups = myStories
        ? [myStories, ...feed]
        : feed;
      setViewer({ groups, index: 0 });
      return;
    }
    onAddStory();
  };

  const openGroup = (group: StoryGroup) => {
    const groups = myStories ? [myStories, ...feed] : feed;
    const index = groups.findIndex((g) => g.user.id === group.user.id);
    setViewer({ groups, index: Math.max(0, index) });
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.container}
      >
        <Pressable onPress={openMyStories} style={styles.itemWrap}>
          <View
            style={[
              styles.ring,
              myStories?.hasUnseen ? styles.ringUnseen : styles.ringSeen,
            ]}
          >
            <Image
              source={{
                uri: resolveMediaUrl(
                  myStories?.latestThumbnail || myAvatar,
                ),
              }}
              style={styles.avatar}
              contentFit="cover"
            />
            <Pressable onPress={onAddStory} style={styles.addIcon} hitSlop={6}>
              <AppIcon name="add" size={14} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.label} numberOfLines={1}>
            قصتي
          </Text>
        </Pressable>

        {loading && feed.length === 0
          ? [0, 1, 2, 3].map((i) => (
              <View key={`sk-${i}`} style={styles.itemWrap}>
                <View style={[styles.ring, styles.skeleton]} />
                <View style={styles.skeletonLabel} />
              </View>
            ))
          : feed.map((group) => (
              <Pressable
                key={group.user.id}
                onPress={() => openGroup(group)}
                style={styles.itemWrap}
              >
                <View
                  style={[
                    styles.ring,
                    group.hasUnseen ? styles.ringUnseen : styles.ringSeen,
                  ]}
                >
                  <Image
                    source={{
                      uri: resolveMediaUrl(
                        group.latestThumbnail || group.user.avatar,
                      ),
                    }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                </View>
                <Text style={styles.label} numberOfLines={1}>
                  {(group.user.arabicName || group.user.displayName || group.user.username)
                    .split(' ')[0]}
                </Text>
              </Pressable>
            ))}
      </ScrollView>

      {viewer ? (
        <StoryViewer
          groups={viewer.groups}
          startGroupIndex={viewer.index}
          currentUserId={currentUserId}
          accessToken={accessToken}
          onClose={() => setViewer(null)}
          onRefresh={onRefresh}
        />
      ) : null}
    </>
  );
}

function createBarStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flexShrink: 0 },
    row: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    itemWrap: { alignItems: 'center', gap: 4, width: CIRCLE },
    ring: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      padding: 3,
      borderWidth: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringUnseen: { borderColor: colors.electricBright },
    ringSeen: { borderColor: colors.borderMid },
    avatar: {
      width: CIRCLE - 12,
      height: CIRCLE - 12,
      borderRadius: (CIRCLE - 12) / 2,
      backgroundColor: colors.bgElevated,
    },
    addIcon: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bgDeep,
    },
    label: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign: 'center',
      width: CIRCLE,
    },
    skeleton: {
      backgroundColor: colors.bgElevated,
      borderColor: colors.borderSoft,
    },
    skeletonLabel: {
      width: 40,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.bgElevated,
      marginTop: 4,
    },
  });
}

function createViewerStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    bg: { ...StyleSheet.absoluteFillObject, width: SCREEN_W, height: SCREEN_H },
    progressRow: {
      position: 'absolute',
      left: 10,
      right: 10,
      flexDirection: 'row',
      gap: 4,
      zIndex: 5,
    },
    progressTrack: {
      flex: 1,
      height: 2.5,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.28)',
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: '#fff' },
    header: {
      position: 'absolute',
      left: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      zIndex: 5,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    username: { color: '#fff', ...typography.bodyStrong },
    meta: { color: 'rgba(255,255,255,0.7)', ...typography.micro, marginTop: 1 },
    iconBtn: {
      padding: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewsCount: { color: '#fff', fontSize: 10, marginTop: 1 },
    tapRow: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      zIndex: 2,
    },
    caption: {
      position: 'absolute',
      left: 16,
      right: 16,
      color: '#fff',
      ...typography.body,
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowRadius: 6,
      zIndex: 4,
    },
    listingBtn: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.electric,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: radius.pill,
      zIndex: 5,
    },
    listingBtnText: { color: '#fff', ...typography.bodyStrong },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 12,
      gap: 8,
      zIndex: 5,
    },
    reactionsRow: { maxHeight: 44 },
    reactionChip: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    reactionChipActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
      borderWidth: 1,
      borderColor: '#fff',
    },
    reactionEmoji: { fontSize: 20 },
    replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    replyInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: '#fff',
      ...typography.body,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ownerStats: { position: 'absolute', alignSelf: 'center', zIndex: 4 },
    ownerStatsText: { color: '#fff', ...typography.caption },
    viewersSheet: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    viewersCard: {
      maxHeight: '55%',
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
    },
    viewersTitle: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    viewerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    viewerAvatar: { width: 36, height: 36, borderRadius: 18 },
    viewerName: { ...typography.body, color: colors.textPrimary },
    viewerTime: { ...typography.micro, color: colors.textMuted },
    emptyViewers: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingVertical: 24,
    },
    closeViewers: {
      marginTop: spacing.md,
      alignItems: 'center',
      paddingVertical: 12,
    },
    closeViewersText: { color: colors.electric, ...typography.bodyStrong },
  });
}
