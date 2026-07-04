// Powered by OnSpace.AI — X/Twitter-style post card
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, uriSource } from '@/components/ui/AppImage';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlRow } from '@/lib/rtl';
import { Post } from '@/services/types';
import { UserProfileLink } from '@/components/feature/UserProfileLink';

interface PostItemProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onRepost: () => void;
  onShare: () => void;
  onMenu: () => void;
  onBookmark?: () => void;
}

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
  count,
  active,
  activeColor,
  onPress,
  style,
  countStyle,
}: {
  icon: ReactNode;
  count?: number;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
  style: ViewStyle;
  countStyle: TextStyle;
}) {
  return (
    <Pressable style={style} onPress={onPress} hitSlop={6}>
      {icon}
      {count !== undefined && count > 0 ? (
        <Text style={[countStyle, active && activeColor ? { color: activeColor } : null]}>
          {formatCount(count)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function PostItem({
  post,
  onLike,
  onComment,
  onRepost,
  onShare,
  onMenu,
  onBookmark,
}: PostItemProps) {
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
  }));
  const viewsEstimate = post.likes + post.reposts + post.comments;

  return (
    <Pressable style={styles.container}>
      <View style={styles.row}>
        <UserProfileLink userId={post.author.id}>
          <Image source={uriSource(post.author.avatar)} style={styles.avatar} contentFit="cover" />
        </UserProfileLink>

        <View style={styles.main}>
          <View style={styles.topRow}>
            <UserProfileLink userId={post.author.id} style={styles.metaRow}>
              <Text style={styles.name} numberOfLines={1}>{post.author.arabicName}</Text>
              {post.author.verified ? (
                <Ionicons name="checkmark-circle" size={15} color={colors.electricBright} />
              ) : null}
              <Text style={styles.metaMuted} numberOfLines={1}>
                @{post.author.username}
              </Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaMuted}>{post.postedAt}</Text>
            </UserProfileLink>
            <Pressable hitSlop={10} onPress={onMenu} style={styles.menuBtn}>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.body}>{post.arabicContent}</Text>
          {post.content && post.content !== post.arabicContent ? (
            <Text style={styles.bodySecondary}>{post.content}</Text>
          ) : null}

          {post.image ? (
            <Image source={uriSource(post.image)} style={styles.image} contentFit="cover" />
          ) : null}

          <View style={styles.actions}>
            <ActionBtn
              icon={<Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />}
              count={post.comments}
              onPress={onComment}
              style={styles.actionBtn}
              countStyle={styles.actionCount}
            />
            <ActionBtn
              icon={
                <Ionicons
                  name="repeat-outline"
                  size={20}
                  color={post.reposted ? colors.success : colors.textMuted}
                />
              }
              count={post.reposts}
              active={post.reposted}
              activeColor={colors.success}
              onPress={onRepost}
              style={styles.actionBtn}
              countStyle={styles.actionCount}
            />
            <ActionBtn
              icon={
                <Ionicons
                  name={post.liked ? 'heart' : 'heart-outline'}
                  size={18}
                  color={post.liked ? colors.rose : colors.textMuted}
                />
              }
              count={post.likes}
              active={post.liked}
              activeColor={colors.rose}
              onPress={onLike}
              style={styles.actionBtn}
              countStyle={styles.actionCount}
            />
            <ActionBtn
              icon={<Ionicons name="stats-chart-outline" size={18} color={colors.textMuted} />}
              count={viewsEstimate > 0 ? viewsEstimate : undefined}
              onPress={() => {}}
              style={styles.actionBtn}
              countStyle={styles.actionCount}
            />
            <ActionBtn
              icon={<Ionicons name="bookmark-outline" size={18} color={colors.textMuted} />}
              onPress={onBookmark ?? (() => {})}
              style={styles.actionBtn}
              countStyle={styles.actionCount}
            />
            <ActionBtn
              icon={<MaterialCommunityIcons name="share-outline" size={18} color={colors.textMuted} />}
              onPress={onShare}
              style={styles.actionBtn}
              countStyle={styles.actionCount}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
    },
    row: {
      ...rtlRow,
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bgElevated,
    },
    main: {
      flex: 1,
      minWidth: 0,
    },
    topRow: {
      ...rtlRow,
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: 2,
    },
    metaRow: {
      ...rtlRow,
      alignItems: 'center',
      flex: 1,
      flexWrap: 'wrap',
      gap: 4,
    },
    name: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      fontSize: 15,
    },
    metaMuted: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 14,
    },
    metaDot: {
      color: colors.textMuted,
      fontSize: 14,
    },
    menuBtn: {
      paddingTop: 2,
    },
    body: {
      ...typography.body,
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 24,
      textAlign: 'right',
      marginTop: spacing.xs,
    },
    bodySecondary: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'left',
      marginTop: spacing.xs,
    },
    image: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: radius.lg,
      marginTop: spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      backgroundColor: colors.bgElevated,
    },
    actions: {
      ...rtlRow,
      justifyContent: 'space-between',
      marginTop: spacing.md,
      paddingRight: spacing.sm,
    },
    actionBtn: {
      ...rtlRow,
      alignItems: 'center',
      gap: 4,
      minWidth: 34,
    },
    actionCount: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
  });
}

export default PostItem;

