// SAFAT — Post card (X / Twitter-identical layout)
// Flat list row — no card, no shadow, hairline bottom separator.
// Avatar right (RTL) → single meta line (name · @handle · time · ⋯) → body → actions.
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Image, uriSource } from '@/components/ui/AppImage';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlRow } from '@/lib/rtl';
import { formatPostTimestampAr } from '@/lib/formatRelativeTime';
import { Post } from '@/services/types';
import { UserProfileLink } from '@/components/feature/UserProfileLink';
import { PostMediaGallery } from '@/components/feature/PostMediaGallery';

interface PostItemProps {
  post: Post;
  variant?: 'feed' | 'detail';
  onPress?: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onMenu: () => void;
  onBookmark?: () => void;
}

const TEXT_COLLAPSE_LINES = 8;

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}م`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}ألف`;
  }
  return String(n);
}

/** Render text with hashtags (#كلمة) in brand colour. */
function PostBody({ text, style, lines }: { text: string; style: TextStyle; lines?: number }) {
  const parts = useMemo(() => {
    const tokens: { text: string; isTag: boolean }[] = [];
    const re = /(#[\u0600-\u06FF\w]+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) tokens.push({ text: text.slice(last, m.index), isTag: false });
      tokens.push({ text: m[0], isTag: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) tokens.push({ text: text.slice(last), isTag: false });
    return tokens;
  }, [text]);

  if (parts.length === 1 && !parts[0].isTag) {
    return (
      <Text style={style} numberOfLines={lines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={lines}>
      {parts.map((p, i) =>
        p.isTag ? (
          <Text key={i} style={[style, { color: '#1D9BF0' }]}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated action button (Scale + opacity on press)
// ─────────────────────────────────────────────────────────────────────────────
function ActionBtn({
  icon,
  iconColor,
  count,
  textColor,
  onPress,
  style,
  countStyle,
  size = 19,
}: {
  icon: string;
  iconColor: string;
  count?: number;
  textColor: string;
  onPress: () => void;
  style: ViewStyle;
  countStyle: TextStyle;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const pressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.78, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.timing(opacity, { toValue: 0.5, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const pressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Pressable style={style} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} hitSlop={10}>
      <Animated.View style={[{ transform: [{ scale }], opacity }, rtlRow, { alignItems: 'center', gap: 4 }]}>
        <AppIcon name={icon} size={size} color={iconColor} />
        {count !== undefined && count > 0 ? (
          <Text style={[countStyle, { color: textColor }]}>{formatCount(count)}</Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Post Item
// ─────────────────────────────────────────────────────────────────────────────
function PostItemComponent({
  post,
  variant = 'feed',
  onPress,
  onLike,
  onComment,
  onShare,
  onMenu,
  onBookmark,
}: PostItemProps) {
  const { styles, colors, scheme } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
    scheme: theme.scheme,
  }));

  const [expanded, setExpanded] = useState(variant === 'detail');

  const images = useMemo(() => {
    if (post.images && post.images.length > 0) return post.images;
    if (post.image) return [post.image];
    return [];
  }, [post.images, post.image]);

  const timestamp = useMemo(
    () => (post.createdAt ? formatPostTimestampAr(post.createdAt) : post.postedAt),
    [post.createdAt, post.postedAt],
  );

  const bodyText = post.arabicContent || post.content;

  return (
    <View style={[styles.row, variant === 'detail' && styles.rowDetail]}>
      {/* ── Avatar ─────────────────────────────── */}
      <UserProfileLink userId={post.author.id}>
        <Image source={uriSource(post.author.avatar)} style={styles.avatar} contentFit="cover" />
      </UserProfileLink>

      {/* ── Main column ────────────────────────── */}
      <View style={styles.main}>

        {/* Meta line: [name @handle · time] [⋯] */}
        <View style={styles.metaLine}>
          <UserProfileLink userId={post.author.id} style={styles.metaInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {post.author.arabicName}
            </Text>
            {post.author.verified ? (
              <AppIcon name="checkmark-circle" size={14} color={colors.electricBright} />
            ) : null}
            {post.author.isAI ? (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            ) : null}
            <Text style={styles.metaMuted} numberOfLines={1}>
              {'@' + post.author.username}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaMuted} numberOfLines={1}>
              {timestamp}
            </Text>
          </UserProfileLink>

          <Pressable
            hitSlop={12}
            onPress={onMenu}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
          >
            <AppIcon name="ellipsis-horizontal" size={18} color={colors.textSubtle} />
          </Pressable>
        </View>

        {/* Body + media — tap opens post detail */}
        <Pressable
          onPress={onPress}
          disabled={!onPress || variant === 'detail'}
          style={({ pressed }) => [pressed && onPress ? styles.bodyPressed : null]}
        >
          <PostBody
            text={bodyText}
            style={styles.body}
            lines={expanded ? undefined : TEXT_COLLAPSE_LINES}
          />
          {variant === 'feed' &&
          (bodyText.split('\n').length > TEXT_COLLAPSE_LINES || bodyText.length > 400) ? (
            !expanded ? (
              <Pressable onPress={() => (onPress ? onPress() : setExpanded(true))} hitSlop={6}>
                <Text style={styles.showMore}>عرض المزيد</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setExpanded(false)} hitSlop={6}>
                <Text style={styles.showMore}>عرض أقل</Text>
              </Pressable>
            )
          ) : null}

          {images.length > 0 || post.video ? (
            <View style={styles.mediaWrap}>
              <PostMediaGallery images={images} video={post.video} colors={colors} scheme={scheme} />
            </View>
          ) : null}
        </Pressable>

        {/* Action bar — comment · like · save · share */}
        <View style={styles.actions}>
          <ActionBtn
            icon="chatbubble-outline"
            iconColor={colors.textSubtle}
            textColor={colors.textSubtle}
            count={post.comments}
            onPress={onComment}
            style={styles.actionSlot}
            countStyle={styles.actionCount}
            size={20}
          />
          <ActionBtn
            icon={post.liked ? 'heart' : 'heart-outline'}
            iconColor={post.liked ? colors.rose : colors.textSubtle}
            textColor={post.liked ? colors.rose : colors.textSubtle}
            count={post.likes}
            onPress={onLike}
            style={styles.actionSlot}
            countStyle={styles.actionCount}
            size={20}
          />
          <ActionBtn
            icon={post.bookmarked ? 'bookmark' : 'bookmark-outline'}
            iconColor={post.bookmarked ? colors.electricBright : colors.textSubtle}
            textColor={colors.textSubtle}
            onPress={onBookmark ?? (() => {})}
            style={styles.actionSlot}
            countStyle={styles.actionCount}
            size={20}
          />
          <ActionBtn
            icon="share-outline"
            iconColor={colors.textSubtle}
            textColor={colors.textSubtle}
            onPress={onShare}
            style={styles.actionSlot}
            countStyle={styles.actionCount}
            size={20}
          />
        </View>
      </View>
    </View>
  );
}

function arePropsEqual(prev: PostItemProps, next: PostItemProps): boolean {
  const a = prev.post;
  const b = next.post;
  return (
    a.id === b.id &&
    a.likes === b.likes &&
    a.reposts === b.reposts &&
    a.comments === b.comments &&
    a.views === b.views &&
    a.liked === b.liked &&
    a.bookmarked === b.bookmarked &&
    a.arabicContent === b.arabicContent &&
    a.content === b.content &&
    a.image === b.image &&
    a.video === b.video &&
    a.images === b.images &&
    a.postedAt === b.postedAt &&
    a.createdAt === b.createdAt &&
    a.author.id === b.author.id &&
    a.author.avatar === b.author.avatar &&
    a.author.verified === b.author.verified &&
    a.author.arabicName === b.author.arabicName &&
    a.author.username === b.author.username
  );
}

export const PostItem = memo(PostItemComponent, arePropsEqual);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // Full-width flat row, hairline separator at bottom — exactly like X
    row: {
      ...rtlRow,
      alignItems: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingTop: 12,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
      gap: 10,
      backgroundColor: colors.bgDeep,
    },
    rowDetail: {
      borderBottomWidth: 0,
      paddingBottom: 4,
    },

    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bgElevated,
      flexShrink: 0,
      marginTop: 1,
    },

    main: {
      flex: 1,
      minWidth: 0,
    },

    // Single line: [name · @handle · time] [⋯]
    metaLine: {
      ...rtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metaInfo: {
      ...rtlRow,
      alignItems: 'center',
      flex: 1,
      flexWrap: 'nowrap',
      gap: 3,
      minWidth: 0,
      overflow: 'hidden',
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      flexShrink: 1,
    },
    metaMuted: {
      fontSize: 14,
      color: colors.textMuted,
      flexShrink: 1,
    },
    metaDot: {
      fontSize: 14,
      color: colors.textSubtle,
      flexShrink: 0,
    },
    aiBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: colors.electric + '25',
      borderWidth: 1,
      borderColor: colors.electric + '55',
    },
    aiBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.electricBright,
    },

    menuBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    menuBtnPressed: {
      backgroundColor: colors.bgElevated,
    },

    body: {
      ...typography.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textPrimary,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginTop: 4,
    },
    bodyPressed: {
      opacity: 0.92,
    },
    showMore: {
      fontSize: 14,
      color: colors.electricBright,
      fontWeight: '600',
      marginTop: 3,
    },

    mediaWrap: {
      marginTop: 10,
      borderRadius: 14,
      overflow: 'hidden',
    },

    // Action bar — 4 evenly spaced icons like X
    actions: {
      ...rtlRow,
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingHorizontal: 2,
    },
    actionSlot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 4,
    },
    actionCount: {
      fontSize: 12,
      fontWeight: '500',
    },
  });
}

export default PostItem;
