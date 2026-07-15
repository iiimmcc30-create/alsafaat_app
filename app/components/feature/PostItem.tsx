// SAFAT — Modern Post Card (X / Threads / Instagram-grade polish)
// White elevated card, soft shadow, generous spacing, expandable text,
// media carousel/video, and a redesigned interaction bar where green is
// reserved strictly for the active state.
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
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlRow } from '@/lib/rtl';
import { formatPostTimestampAr } from '@/lib/formatRelativeTime';
import { Post } from '@/services/types';
import { UserProfileLink } from '@/components/feature/UserProfileLink';
import { PostMediaGallery } from '@/components/feature/PostMediaGallery';

interface PostItemProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onRepost: () => void;
  onShare: () => void;
  onMenu: () => void;
  onBookmark?: () => void;
}

const TEXT_COLLAPSE_LENGTH = 220;

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(n);
}

function ActionBtn({
  icon,
  iconColor,
  count,
  textColor,
  onPress,
  style,
  countStyle,
  size = 22,
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

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.8, useNativeDriver: true, speed: 40, bounciness: 6 }),
      Animated.timing(opacity, { toValue: 0.55, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Pressable
      style={style}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={8}
    >
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <AppIcon name={icon} size={size} color={iconColor} />
      </Animated.View>
      {count !== undefined && count > 0 ? (
        <Text style={[countStyle, { color: textColor }]}>{formatCount(count)}</Text>
      ) : null}
    </Pressable>
  );
}

function PostItemComponent({
  post,
  onLike,
  onComment,
  onRepost,
  onShare,
  onMenu,
  onBookmark,
}: PostItemProps) {
  const { styles, colors, scheme } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors, theme.scheme),
    colors: theme.colors,
    scheme: theme.scheme,
  }));

  const [expanded, setExpanded] = useState(false);

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
  const isLong = bodyText.length > TEXT_COLLAPSE_LENGTH;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <UserProfileLink userId={post.author.id}>
          <Image source={uriSource(post.author.avatar)} style={styles.avatar} contentFit="cover" />
        </UserProfileLink>

        <UserProfileLink userId={post.author.id} style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {post.author.arabicName}
            </Text>
            {post.author.verified ? (
              <AppIcon name="checkmark-circle" size={15} color={colors.electricBright} />
            ) : null}
            {post.author.isAI ? (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>مدعوم بالذكاء الاصطناعي</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.subRow}>
            <Text style={styles.username} numberOfLines={1}>
              @{post.author.username}
            </Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.time} numberOfLines={1}>
              {timestamp}
            </Text>
          </View>
        </UserProfileLink>

        <Pressable
          hitSlop={10}
          onPress={onMenu}
          style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
        >
          <AppIcon name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.body} numberOfLines={expanded || !isLong ? undefined : 5}>
          {bodyText}
        </Text>
        {isLong ? (
          <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={6}>
            <Text style={styles.showMore}>{expanded ? 'عرض أقل' : 'عرض المزيد'}</Text>
          </Pressable>
        ) : null}
      </View>

      {images.length > 0 || post.video ? (
        <View style={styles.mediaWrap}>
          <PostMediaGallery images={images} video={post.video} colors={colors} scheme={scheme} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <ActionBtn
          icon={post.liked ? 'heart' : 'heart-outline'}
          iconColor={post.liked ? colors.electricBright : colors.textMuted}
          textColor={post.liked ? colors.electricBright : colors.textMuted}
          count={post.likes}
          onPress={onLike}
          style={styles.actionBtn}
          countStyle={styles.actionCount}
        />
        <ActionBtn
          icon="chatbubble-outline"
          iconColor={colors.textMuted}
          textColor={colors.textMuted}
          count={post.comments}
          onPress={onComment}
          style={styles.actionBtn}
          countStyle={styles.actionCount}
        />
        <ActionBtn
          icon="repeat-outline"
          iconColor={post.reposted ? colors.electricBright : colors.textMuted}
          textColor={post.reposted ? colors.electricBright : colors.textMuted}
          count={post.reposts}
          onPress={onRepost}
          style={styles.actionBtn}
          countStyle={styles.actionCount}
        />
        <ActionBtn
          icon={post.bookmarked ? 'bookmark' : 'bookmark-outline'}
          iconColor={post.bookmarked ? colors.electricBright : colors.textMuted}
          textColor={post.bookmarked ? colors.electricBright : colors.textMuted}
          onPress={onBookmark ?? (() => {})}
          style={styles.actionBtn}
          countStyle={styles.actionCount}
        />
        <View style={styles.viewsBtn}>
          <AppIcon name="eye-outline" size={20} color={colors.textSubtle} />
          {post.views ? (
            <Text style={[styles.actionCount, { color: colors.textSubtle }]}>
              {formatCount(post.views)}
            </Text>
          ) : null}
        </View>
        <ActionBtn
          icon="share-outline"
          iconColor={colors.textMuted}
          textColor={colors.textMuted}
          onPress={onShare}
          style={styles.actionBtn}
          countStyle={styles.actionCount}
        />
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
    a.reposted === b.reposted &&
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

function createStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  const cardBg = scheme === 'dark' ? colors.bgElevated : colors.bgDeep;

  return StyleSheet.create({
    card: {
      backgroundColor: cardBg,
      borderRadius: radius.lg,
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderWidth: scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.borderHairline,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: scheme === 'dark' ? 0.4 : 0.07,
      shadowRadius: 16,
      elevation: scheme === 'dark' ? 2 : 3,
    },
    headerRow: {
      ...rtlRow,
      alignItems: 'center',
      gap: spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.bgElevated,
    },
    headerInfo: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      ...rtlRow,
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
    },
    name: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      fontSize: 15.5,
      fontWeight: '600',
    },
    aiBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.electric + '22',
      borderWidth: 1,
      borderColor: colors.electric + '55',
    },
    aiBadgeText: {
      ...typography.micro,
      color: colors.electricBright,
      fontWeight: '700',
    },
    subRow: {
      ...rtlRow,
      alignItems: 'center',
      gap: 4,
      marginTop: 1,
    },
    username: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 13,
    },
    dot: {
      color: colors.textSubtle,
      fontSize: 12,
    },
    time: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 13,
    },
    menuBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuBtnPressed: {
      backgroundColor: colors.bgElevated,
    },
    content: {
      marginTop: spacing.md,
    },
    body: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'right',
    },
    showMore: {
      ...typography.caption,
      color: colors.electricBright,
      fontWeight: '700',
      marginTop: 4,
    },
    mediaWrap: {
      marginTop: spacing.md,
    },
    actions: {
      ...rtlRow,
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    actionBtn: {
      ...rtlRow,
      alignItems: 'center',
      gap: 5,
      minWidth: 34,
    },
    viewsBtn: {
      ...rtlRow,
      alignItems: 'center',
      gap: 5,
      minWidth: 34,
    },
    actionCount: {
      fontSize: 12.5,
      fontWeight: '600',
    },
  });
}

export default PostItem;
