// Powered by OnSpace.AI
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { STORY_SLIDE_DURATION_SEC } from '@/constants/stories';
import { Story } from '@/services/types';
import { UserProfileLink } from '@/components/feature/UserProfileLink';

interface StoriesBarProps {
  stories: Story[];
  myAvatar?: string;
  currentUserId?: string;
  onAddStory: () => void;
  onMarkSeen: (id: string) => void;
  onDeleteStory?: (storyId: string) => Promise<boolean>;
}

interface StoryViewerProps {
  stories: Story[];
  startIndex: number;
  currentUserId?: string;
  onClose: () => void;
  onSeen: (id: string) => void;
  onDeleteStory?: (storyId: string) => Promise<boolean>;
}

function StoryViewer({ stories, startIndex, currentUserId, onClose, onSeen, onDeleteStory }: StoryViewerProps) {
  const { colors } = useTheme();
  const sv = useThemedStyles(({ colors }) => createViewerStyles(colors));
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(startIndex);
  const [deleting, setDeleting] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const story = stories[current];
  const isOwnStory = !!currentUserId && story?.user?.id === currentUserId;

  useEffect(() => {
    onSeen(story.id);
    progress.setValue(0);
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_SLIDE_DURATION_SEC * 1000,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => animRef.current?.stop();
  }, [current]);

  const goNext = () => {
    if (current < stories.length - 1) setCurrent((c) => c + 1);
    else onClose();
  };

  const goPrev = () => {
    if (current > 0) setCurrent((c) => c - 1);
    else onClose();
  };

  const handleDelete = () => {
    if (!onDeleteStory || deleting) return;
    Alert.alert('حذف القصة', 'هل تريد حذف هذه القصة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          animRef.current?.stop();
          const ok = await onDeleteStory(story.id);
          setDeleting(false);
          if (ok) onClose();
        },
      },
    ]);
  };

  const { width } = Dimensions.get('window');

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={sv.container}>
        <Image source={{ uri: story.thumbnail }} style={sv.bg} contentFit="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Progress bars */}
        <View style={[sv.progressRow, { top: insets.top + 8 }]}>
          {stories.map((s, i) => (
            <View key={s.id} style={[sv.progressTrack, { flex: 1 }]}>
              <Animated.View
                style={[
                  sv.progressFill,
                  {
                    width: i < current
                      ? '100%'
                      : i === current
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={[sv.header, { top: insets.top + 24 }]}>
          <UserProfileLink userId={story.user.id} style={sv.headerProfile}>
            <Image source={{ uri: story.user.avatar }} style={sv.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={sv.username}>{story.user.displayName}</Text>
              <Text style={sv.arabicName}>{story.user.arabicName}</Text>
            </View>
          </UserProfileLink>
          {story.isLive ? (
            <View style={sv.liveBadge}>
              <View style={sv.liveDot} />
              <Text style={sv.liveText}>مباشر</Text>
            </View>
          ) : null}
          {isOwnStory && onDeleteStory && (
            <Pressable onPress={handleDelete} hitSlop={12} style={sv.deleteBtn} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="trash-outline" size={22} color="#fff" />
              )}
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={12} style={sv.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Tap areas */}
        <View style={sv.tapRow}>
          <Pressable style={{ flex: 1 }} onPress={goPrev} />
          <Pressable style={{ flex: 1 }} onPress={goNext} />
        </View>

        {/* Bottom CTA for live */}
        {story.isLive ? (
          <View style={[sv.liveCta, { bottom: insets.bottom + 24 }]}>
            <MaterialCommunityIcons name="broadcast" size={20} color={colors.liveRed} />
            <Text style={sv.liveCtaText}>Tap to join live stream · اضغط للانضمام</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export function StoriesBar({ stories, myAvatar, currentUserId, onAddStory, onMarkSeen, onDeleteStory }: StoriesBarProps) {
  const styles = useThemedStyles(({ colors }) => createBarStyles(colors));
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const openStory = (idx: number) => setViewerIndex(idx);
  const closeViewer = () => setViewerIndex(null);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.container}
      >
        {/* Add My Story */}
        <Pressable onPress={onAddStory} style={styles.addWrap}>
          <View style={styles.addCircle}>
            <Image source={{ uri: myAvatar }} style={styles.addAvatar} contentFit="cover" />
            <View style={styles.addIcon}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          </View>
          <Text style={styles.label} numberOfLines={1}>
            قصتي
          </Text>
        </Pressable>

        {/* Story bubbles */}
        {stories.map((story, idx) => (
          <Pressable key={story.id} onPress={() => openStory(idx)} style={styles.storyWrap}>
            <View style={[styles.ring, story.seen ? styles.ringSeen : story.isLive ? styles.ringLive : styles.ringUnseen]}>
              {story.isLive ? (
                <LinearGradient
                  colors={['#EF4444', '#F97316']}
                  style={styles.ringGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Image source={{ uri: story.thumbnail }} style={styles.storyAvatar} contentFit="cover" />
                </LinearGradient>
              ) : (
                <Image source={{ uri: story.thumbnail }} style={styles.storyAvatar} contentFit="cover" />
              )}
              {story.isLive ? (
                <View style={styles.livePill}>
                  <Text style={styles.livePillText}>مباشر</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {story.user.arabicName.split(' ')[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {viewerIndex !== null ? (
        <StoryViewer
          stories={stories}
          startIndex={viewerIndex}
          currentUserId={currentUserId}
          onClose={closeViewer}
          onSeen={onMarkSeen}
          onDeleteStory={onDeleteStory}
        />
      ) : null}
    </>
  );
}

const CIRCLE = 64;

function createBarStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  addWrap: {
    alignItems: 'center',
    gap: 4,
    width: CIRCLE,
  },
  addCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    borderColor: colors.borderMid,
    overflow: 'visible',
    position: 'relative',
  },
  addAvatar: {
    width: CIRCLE - 4,
    height: CIRCLE - 4,
    borderRadius: (CIRCLE - 4) / 2,
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
  storyWrap: {
    alignItems: 'center',
    gap: 4,
    width: CIRCLE,
  },
  ring: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    padding: 3,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringUnseen: {
    borderColor: colors.electricBright,
  },
  ringSeen: {
    borderColor: colors.borderMid,
  },
  ringLive: {
    borderColor: 'transparent',
  },
  ringGradient: {
    width: CIRCLE - 8,
    height: CIRCLE - 8,
    borderRadius: (CIRCLE - 8) / 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: CIRCLE - 12,
    height: CIRCLE - 12,
    borderRadius: (CIRCLE - 12) / 2,
    borderWidth: 2,
    borderColor: colors.bgDeep,
  },
  livePill: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: colors.liveRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.bgDeep,
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  label: {
    ...typography.micro,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: CIRCLE,
  },
  });
}

function createViewerStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },
  progressRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  username: {
    ...typography.bodyStrong,
    color: '#fff',
  },
  arabicName: {
    ...typography.micro,
    color: 'rgba(255,255,255,0.7)',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.liveRed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 5,
    marginTop: 100,
    marginBottom: 80,
  },
  liveCta: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: colors.liveRed,
    borderRadius: radius.pill,
    paddingVertical: 12,
    zIndex: 10,
  },
  liveCtaText: {
    ...typography.bodyStrong,
    color: '#fff',
  },
  });
}
