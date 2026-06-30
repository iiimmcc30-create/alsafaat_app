// Powered by OnSpace.AI
import { Ionicons } from '@expo/vector-icons';
import { Image } from '@/components/ui/AppImage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { PostComment, User } from '@/services/types';

interface PostCommentsModalProps {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
  onSubmitComment: (content: string) => Promise<boolean>;
}

function mapComment(c: any): PostComment {
  const author: User = {
    id: c.author.id,
    username: c.author.username,
    displayName: c.author.displayName || '',
    arabicName: c.author.arabicName || '',
    avatar: c.author.avatar,
    verified: c.author.verified ?? false,
    followers: 0,
    rating: 5,
    country: 'SA',
    bio: '',
  };
  return {
    id: c.id,
    content: c.content,
    author,
    createdAt: new Date(c.createdAt).toLocaleString('ar-SA'),
  };
}

export function PostCommentsModal({
  visible,
  postId,
  onClose,
  onSubmitComment,
}: PostCommentsModalProps) {
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/comments`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data?.comments) {
        setComments(json.data.comments.map(mapComment));
      }
    } catch (err) {
      console.warn('[PostCommentsModal] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (visible && postId) {
      setText('');
      loadComments();
    }
  }, [visible, postId, loadComments]);

  const handleSend = async () => {
    if (!postId || !text.trim() || sending) return;
    setSending(true);
    try {
      const ok = await onSubmitComment(text.trim());
      if (ok) {
        setText('');
        await loadComments();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>التعليقات</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.electricBright} />
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {comments.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>لا توجد تعليقات بعد — كن أول من يعلّق</Text>
                  </View>
                ) : (
                  comments.map((c) => (
                    <View key={c.id} style={styles.commentRow}>
                      <Image source={{ uri: c.author.avatar }} style={styles.avatar} contentFit="cover" />
                      <View style={styles.commentBody}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentName}>{c.author.arabicName}</Text>
                          {c.author.verified ? (
                            <Ionicons name="checkmark-circle" size={12} color={colors.electricBright} />
                          ) : null}
                          <Text style={styles.commentTime}>{c.createdAt}</Text>
                        </View>
                        <Text style={styles.commentText}>{c.content}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={isAuthenticated ? 'اكتب تعليقاً...' : 'سجّل الدخول للتعليق'}
                placeholderTextColor={colors.textSubtle}
                value={text}
                onChangeText={setText}
                editable={isAuthenticated && !sending}
                textAlign="right"
                multiline
                maxLength={500}
              />
              <Pressable
                style={[styles.sendBtn, (!text.trim() || sending || !isAuthenticated) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || sending || !isAuthenticated}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const SHEET_HEIGHT = '68%';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: colors.bgDeep,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMid,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  commentRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  commentBody: { flex: 1, gap: 4 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  commentName: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  commentTime: { ...typography.micro, color: colors.textMuted },
  commentText: { ...typography.body, color: colors.textSecondary, textAlign: 'right', lineHeight: 22 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bgDeep,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...typography.body,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.electric,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
});

export default PostCommentsModal;
