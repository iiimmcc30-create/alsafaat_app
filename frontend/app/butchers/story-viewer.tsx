// Powered by OnSpace.AI
// SAFAT — Butcher Story Viewer (مشاهد قصص الملاحم)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { API_BASE } from '@/services/api';
import { STORY_SLIDE_DURATION_SEC } from '@/constants/stories';
import { ButcherStory } from '@/services/butcherData';

const { width: W, height: H } = Dimensions.get('window');

const STORY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  daily_slaughter: { label: '🔪 ذبح يومي طازج', color: colors.danger   },
  offer:           { label: '🏷️ عرض خاص',        color: colors.amber    },
  new_stock:       { label: '📦 مخزون جديد',      color: colors.textBrandSuccess  },
  update:          { label: '📢 تحديث',            color: colors.textBrandAlt },
};

export default function ButcherStoryViewerScreen() {
  const { butcherId, storyId } = useLocalSearchParams<{ butcherId?: string; storyId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stories, setStories] = useState<ButcherStory[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/butchers/stories`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const list = butcherId
              ? json.data.filter((s: any) => s.butcherId === butcherId)
              : json.data;
            setStories(list);
            const startIdx = storyId ? Math.max(0, list.findIndex((s: any) => s.id === storyId)) : 0;
            setCurrentIdx(startIdx);
          }
        }
      } catch (err) {
        console.warn('[ButcherStoryViewerScreen] Failed to fetch stories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, [butcherId, storyId]);

  const story = stories[currentIdx];

  useEffect(() => {
    if (!story) return;
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
  }, [currentIdx, story]);

  const goNext = () => {
    if (currentIdx < stories.length - 1) {
      setCurrentIdx((c) => c + 1);
    } else {
      router.back();
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((c) => c - 1);
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff', ...typography.body }}>جاري تحميل القصة...</Text>
      </View>
    );
  }

  if (!story) {
    router.back();
    return null;
  }

  const typeInfo = STORY_TYPE_LABELS[story.type] ?? { label: story.type, color: colors.textBrandAlt };

  return (
    <View style={s.screen}>
      {/* Background image */}
      <Image source={{ uri: story.thumbnail }} style={s.bg} contentFit="cover" />

      {/* Gradient overlays */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={[StyleSheet.absoluteFill, { height: '40%' }]}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
        style={[StyleSheet.absoluteFill, { top: '55%' }]}
      />

      {/* Progress bars */}
      <View style={[s.progressRow, { top: insets.top + 10 }]}>
        {stories.map((_, i) => (
          <View key={i} style={[s.progressTrack, { flex: 1 }]}>
            <Animated.View
              style={[
                s.progressFill,
                {
                  width:
                    i < currentIdx ? '100%'
                    : i === currentIdx
                      ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                      : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Story type badge */}
      <View style={[s.typeBadge, { top: insets.top + 24, backgroundColor: typeInfo.color + 'CC' }]}>
        <Text style={s.typeBadgeText}>{typeInfo.label}</Text>
      </View>

      {/* Header */}
      <View style={[s.header, { top: insets.top + 52 }]}>
        <Image source={{ uri: story.butcherLogo }} style={s.avatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.name}>{story.butcherNameAr}</Text>
            {story.isVerified && (
              <Ionicons name="shield-checkmark" size={14} color={colors.gold} />
            )}
          </View>
          <Text style={s.time}>
            {new Date(story.postedAt).toLocaleDateString('ar-SA', {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/butchers/[id]', params: { id: story.butcherId } })}
          style={s.visitBtn}
        >
          <Text style={s.visitBtnText}>زيارة الملحمة</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.closeBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Tap areas */}
      <View style={s.tapRow}>
        <Pressable style={{ flex: 1 }} onPress={goPrev} />
        <Pressable style={{ flex: 1 }} onPress={goNext} />
      </View>

      {/* Caption + actions */}
      <View style={[s.bottomWrap, { paddingBottom: insets.bottom + 20 }]}>
        {story.captionAr && (
          <Text style={s.caption}>{story.captionAr}</Text>
        )}

        {/* Quick actions */}
        <View style={s.actionsRow}>
          {/* Order CTA */}
          <Pressable
            style={s.orderCta}
            onPress={() => router.push({ pathname: '/butchers/order', params: { butcherId: story.butcherId } })}
          >
            <LinearGradient
              colors={[colors.electric, colors.cyan]}
              style={s.orderCtaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="bag-add-outline" size={16} color="#fff" />
              <Text style={s.orderCtaText}>اطلب الآن</Text>
            </LinearGradient>
          </Pressable>

          {/* Like */}
          <Pressable
            onPress={() => setLiked((v) => !v)}
            style={s.actionBtn}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? colors.rose : '#fff'}
            />
          </Pressable>

          {/* Chat */}
          <Pressable
            onPress={() => router.push({ pathname: '/butchers/chat', params: { butcherId: story.butcherId } })}
            style={s.actionBtn}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
          </Pressable>

          {/* Share */}
          <Pressable style={s.actionBtn}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Reply bar */}
        <View style={s.replyBar}>
          <TextInput
            style={s.replyInput}
            placeholder="رد على هذه القصة..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={replyText}
            onChangeText={setReplyText}
            textAlign="right"
          />
          {replyText.length > 0 && (
            <Pressable
              onPress={() => {
                router.push({ pathname: '/butchers/chat', params: { butcherId: story.butcherId } });
                setReplyText('');
              }}
            >
              <Ionicons name="paper-plane" size={20} color={colors.electricBright} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  bg: { ...StyleSheet.absoluteFillObject, width: W, height: H },

  progressRow: {
    position: 'absolute',
    left: 12, right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 20,
  },
  progressTrack: {
    height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: '#fff',
  },

  typeBadge: {
    position: 'absolute',
    right: 12, zIndex: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  typeBadgeText: { ...typography.micro, color: '#fff', fontWeight: '700' },

  header: {
    position: 'absolute',
    left: 12, right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: '#fff',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { ...typography.bodyStrong, color: '#fff' },
  time: { ...typography.micro, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  visitBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  visitBtnText: { ...typography.micro, color: '#fff', fontWeight: '600' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  tapRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 10,
    marginTop: 120,
    marginBottom: 200,
  },

  bottomWrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg,
    zIndex: 20,
    gap: spacing.md,
  },
  caption: {
    ...typography.h3,
    color: '#fff',
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderCta: { flex: 1, borderRadius: radius.pill, overflow: 'hidden' },
  orderCtaGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
  },
  orderCtaText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  actionBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  replyInput: {
    flex: 1,
    ...typography.body,
    color: '#fff',
  },
});
