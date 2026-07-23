import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import { authFetch } from '@/services/authFetch';
import { formatRelativeTimeAr } from '@/lib/formatRelativeTime';
import { rtlRow } from '@/lib/rtl';
import { UserProfileLink } from '@/components/feature/UserProfileLink';
import type { PostComment } from '@/services/types';

type ListingCommentsSectionProps = {
  listingId: string;
};

function mapComment(c: {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    arabicName: string;
    avatar?: string | null;
    verified?: boolean;
  };
}): PostComment {
  return {
    id: c.id,
    content: c.content,
    createdAt: formatRelativeTimeAr(c.createdAt) || new Date(c.createdAt).toLocaleString('ar-SA'),
    author: {
      id: c.author.id,
      username: c.author.username,
      displayName: c.author.displayName || '',
      arabicName: c.author.arabicName || '',
      avatar: c.author.avatar ?? undefined,
      verified: c.author.verified ?? false,
      followers: 0,
      following: 0,
      rating: null,
      country: 'SA',
      bio: '',
    },
  };
}

export function ListingCommentsSection({ listingId }: ListingCommentsSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const { isAuthenticated } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const loadComments = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/api/listings/${listingId}/comments`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        const rows = Array.isArray(json.data?.comments) ? json.data.comments : [];
        setComments(rows.map(mapComment));
        return;
      }
      setComments([]);
      setLoadError(json.messageAr ?? json.message ?? 'تعذّر تحميل الردود');
    } catch (err) {
      console.warn('[ListingComments] load failed:', err);
      setComments([]);
      setLoadError('تعذّر تحميل الردود — تحقق من الاتصال');
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSend = async () => {
    if (!isAuthenticated) {
      Alert.alert('تسجيل الدخول', 'يجب تسجيل الدخول لإضافة رد على الإعلان');
      return;
    }
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      const res = await authFetch(`${API_BASE}/api/listings/${listingId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setText('');
        await loadComments();
      } else {
        Alert.alert('تعذّر الإرسال', json.messageAr ?? json.message ?? 'حاول مرة أخرى');
      }
    } catch {
      Alert.alert('خطأ', 'تعذّر إرسال الرد');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={[styles.header, rtlRow]}>
        <View style={styles.sectionBar} />
        <Text style={styles.title}>الردود على الإعلان</Text>
        <Text style={styles.count}>{comments.length}</Text>
      </View>

      <Text style={styles.hint}>
        ردود عامة يراها الجميع — للمحادثة الخاصة استخدم زر المراسلة أسفل الصفحة
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.electricBright} style={styles.loader} />
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => void loadComments()} style={styles.retryBtn}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>لا توجد ردود بعد — كن أول من يسأل أو يعلّق علناً</Text>
      ) : (
        <View style={styles.list}>
          {comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <UserProfileLink userId={c.author.id}>
                <Image source={uriSource(c.author.avatar)} style={styles.avatar} contentFit="cover" />
              </UserProfileLink>
              <View style={styles.commentBody}>
                <UserProfileLink userId={c.author.id} style={[styles.commentHeader, rtlRow]}>
                  <Text style={styles.commentName}>{c.author.arabicName || c.author.displayName}</Text>
                  {c.author.verified ? (
                    <AppIcon name="checkmark-circle" size={12} color={colors.electricBright} />
                  ) : null}
                  <Text style={styles.commentTime}>{c.createdAt}</Text>
                </UserProfileLink>
                <Text style={styles.commentText}>{c.content}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.inputRow, rtlRow]}>
        <TextInput
          style={styles.input}
          placeholder={isAuthenticated ? 'اكتب رداً عاماً على الإعلان...' : 'سجّل الدخول لإضافة رد'}
          placeholderTextColor={colors.textSubtle}
          value={text}
          onChangeText={setText}
          editable={isAuthenticated && !sending && !loadError}
          textAlign="right"
          multiline
          maxLength={500}
        />
        <Pressable
          style={[styles.sendBtn, (!text.trim() || sending || !isAuthenticated || !!loadError) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending || !isAuthenticated || !!loadError}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <AppIcon name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.xl,
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    header: {
      alignItems: 'center',
      gap: 8,
    },
    sectionBar: {
      width: 4,
      height: 16,
      borderRadius: 2,
      backgroundColor: colors.electricBright,
    },
    title: {
      ...typography.bodyStrong,
      color: colors.textBrandStrong,
      fontWeight: '700',
      flex: 1,
      textAlign: 'right',
    },
    count: {
      ...typography.caption,
      color: colors.textMuted,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    hint: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 20,
    },
    errorBox: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    errorText: {
      ...typography.body,
      color: colors.rose,
      textAlign: 'center',
      lineHeight: 22,
    },
    retryBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    retryText: {
      ...typography.caption,
      color: colors.electricBright,
      fontWeight: '600',
    },
    loader: {
      paddingVertical: spacing.lg,
    },
    empty: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingVertical: spacing.sm,
    },
    list: {
      gap: spacing.md,
    },
    commentRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      backgroundColor: colors.bgElevated,
    },
    commentBody: {
      flex: 1,
      gap: 4,
    },
    commentHeader: {
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    commentName: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    commentTime: {
      ...typography.micro,
      color: colors.textMuted,
    },
    commentText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 22,
    },
    inputRow: {
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingTop: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderHairline,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 100,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      ...typography.body,
      color: colors.textPrimary,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.45,
    },
  });
}
