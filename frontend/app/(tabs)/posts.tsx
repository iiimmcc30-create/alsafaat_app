// Powered by OnSpace.AI
// SAFAT — Posts Tab (المنشورات)

import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { PostItem } from '@/components/feature/PostItem';
import { PostCommentsModal } from '@/components/feature/PostCommentsModal';
import { CategoryChips, CategoryKey } from '@/components/feature/CategoryChips';
import { CreatePostFab } from '@/components/feature/CreatePostFab';
import { requireAuth, sharePost, showPostMenu } from '@/lib/postInteractions';

export default function PostsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(({ colors }) => createPostsStyles(colors));
  const { postId, openComments } = useLocalSearchParams<{
    postId?: string;
    openComments?: string;
  }>();
  const { isAuthenticated } = useAuth();
  const {
    me,
    posts,
    likedPosts,
    repostedPosts,
    toggleLike,
    toggleRepost,
    deletePost,
    addComment,
  } = useApp();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    if (openComments === '1') {
      setCommentsPostId(postId);
    }
  }, [postId, openComments]);

  const displayedPosts = activeCategory !== 'all'
    ? posts.filter((p) => p.arabicContent.includes(activeCategory) || p.content.toLowerCase().includes(activeCategory))
    : posts;

  return (
    <View style={styles.root}>
    <SafeAreaView style={styles.container} edges={['top']}>
      <CategoryChips value={activeCategory} onChange={setActiveCategory} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {displayedPosts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>لا توجد منشورات بعد</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/create/post')}>
              <Text style={styles.emptyBtnText}>+ أنشئ أول منشور</Text>
            </Pressable>
          </View>
        ) : (
          displayedPosts.map((post) => (
            <PostItem
              key={post.id}
              post={{
                ...post,
                liked: likedPosts.has(post.id),
                reposted: repostedPosts.has(post.id),
              }}
              onLike={() => requireAuth(isAuthenticated, 'الإعجاب') && toggleLike(post.id)}
              onComment={() => requireAuth(isAuthenticated, 'التعليق') && setCommentsPostId(post.id)}
              onRepost={() => requireAuth(isAuthenticated, 'إعادة النشر') && toggleRepost(post.id)}
              onShare={() => sharePost(post)}
              onMenu={() => showPostMenu(post, me, router, deletePost)}
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>

      <CreatePostFab />

      <PostCommentsModal
        visible={!!commentsPostId}
        postId={commentsPostId}
        onClose={() => setCommentsPostId(null)}
        onSubmitComment={(content) =>
          commentsPostId ? addComment(commentsPostId, content) : Promise.resolve(false)
        }
      />
    </View>
  );
}

function createPostsStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  container: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { paddingBottom: spacing.md },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.body, color: colors.textMuted },
  emptyBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.royal,
    borderWidth: 1,
    borderColor: colors.electric,
  },
  emptyBtnText: { ...typography.bodyStrong, color: colors.textBrandStrong },
  });
}
