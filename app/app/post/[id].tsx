// Powered by OnSpace.AI
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { PostItem } from '@/components/feature/PostItem';
import {
  PostCommentsSection,
  type PostCommentsSectionRef,
} from '@/components/feature/PostCommentsSection';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { rtlBackIcon, rtlRow } from '@/lib/rtl';
import { requireAuth, sharePost, showPostMenu } from '@/lib/postInteractions';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';
import type { Post } from '@/services/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function mapBackendPost(p: any): Post | null {
  if (!p?.id || !p?.author) return null;
  return {
    id: p.id,
    author: {
      id: p.author.id,
      username: p.author.username,
      displayName: p.author.displayName || '',
      arabicName: p.author.arabicName || '',
      avatar: p.author.avatar ?? undefined,
      verified: p.author.verified ?? false,
      isAI: p.author.isAI ?? false,
      followers: p.author.followersCount ?? 0,
      following: p.author.followingCount ?? 0,
      rating: typeof p.author.rating === 'number' ? p.author.rating : null,
      country: p.author.country || 'SA',
      bio: p.author.bio || '',
    },
    content: p.content,
    arabicContent: p.arabicContent,
    image: p.image ?? undefined,
    images: Array.isArray(p.images) && p.images.length > 0 ? p.images : p.image ? [p.image] : undefined,
    video: p.video ?? undefined,
    likes: p.likesCount ?? 0,
    reposts: p.repostsCount ?? 0,
    comments: p.commentsCount ?? 0,
    views: typeof p.viewsCount === 'number' ? p.viewsCount : undefined,
    postedAt: new Date(p.createdAt).toLocaleDateString('ar-SA'),
    createdAt: p.createdAt,
    liked: p.liked ?? false,
    reposted: p.reposted ?? false,
  };
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id: string; focusComment?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const focusComment = Array.isArray(params.focusComment)
    ? params.focusComment[0]
    : params.focusComment;
  const postId = id ? decodeURIComponent(id) : '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { isAuthenticated } = useAuth();
  const {
    me,
    posts,
    likedPosts,
    bookmarkedPosts,
    toggleLike,
    toggleBookmark,
    deletePost,
    addComment,
  } = useApp();

  const cached = posts.find((p) => p.id === postId);
  const [post, setPost] = useState<Post | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const commentsRef = useRef<PostCommentsSectionRef>(null);

  useEffect(() => {
    if (!postId) router.back();
  }, [postId, router]);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/posts/${postId}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        const mapped = mapBackendPost(json.data);
        if (mapped) {
          setPost(mapped);
          return;
        }
      }
      if (!cached) {
        Alert.alert('غير موجود', 'تعذّر العثور على هذا المنشور');
        router.back();
      }
    } catch {
      if (!cached) {
        Alert.alert('خطأ', 'تعذّر تحميل المنشور');
        router.back();
      }
    } finally {
      setLoading(false);
    }
  }, [postId, cached, router]);

  useEffect(() => {
    if (cached) setPost(cached);
    void loadPost();
  }, [postId, cached, loadPost]);

  useEffect(() => {
    if (focusComment === '1' && post) {
      const timer = setTimeout(() => commentsRef.current?.focusInput(), 400);
      return () => clearTimeout(timer);
    }
  }, [focusComment, post]);

  const enrichedPost = post
    ? {
        ...post,
        liked: likedPosts.has(post.id) || post.liked,
        bookmarked: bookmarkedPosts.has(post.id) || post.bookmarked,
      }
    : null;

  if (loading && !enrichedPost) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.electricBright} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!enrichedPost) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.topBar, rtlRow]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.screenTitle}>منشور</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 48 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <PostItem
            post={enrichedPost}
            variant="detail"
            onLike={() => requireAuth(isAuthenticated, 'الإعجاب') && toggleLike(enrichedPost.id)}
            onComment={() => commentsRef.current?.focusInput()}
            onBookmark={() =>
              requireAuth(isAuthenticated, 'الحفظ') && toggleBookmark(enrichedPost.id)
            }
            onShare={() => sharePost(enrichedPost)}
            onMenu={() =>
              showPostMenu(enrichedPost, me, router, deletePost, isAuthenticated)
            }
          />

          <PostCommentsSection
            ref={commentsRef}
            postId={enrichedPost.id}
            onSubmitComment={(content) => addComment(enrichedPost.id, content)}
            onCommentAdded={() => {
              setPost((prev) => (prev ? { ...prev, comments: prev.comments + 1 } : prev));
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bgDeep,
    },
    flex: {
      flex: 1,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBar: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
      backgroundColor: colors.bgGlassStrong,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    screenTitle: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 17,
    },
    scroll: {
      paddingBottom: spacing.xxxl,
    },
  });
}
