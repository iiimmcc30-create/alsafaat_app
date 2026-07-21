import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image } from '@/components/ui/AppImage';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { resolveMediaUrl } from '@/services/media';
import { StoryGroup } from '@/services/stories';
import { StoryViewer } from '@/components/feature/StoryViewer';

const CIRCLE = 72;
const INNER = CIRCLE - 6;

const STORY_GRADIENT = ['#F58529', '#DD2A7B', '#8134AF', '#515BD4'] as const;

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

function StoryRing({
  unseen,
  children,
  empty,
}: {
  unseen: boolean;
  children: ReactNode;
  empty?: boolean;
}) {
  const styles = useThemedStyles(({ colors }) => createBarStyles(colors));

  if (empty) {
    return (
      <View style={[styles.ring, styles.ringEmpty]}>
        {children}
      </View>
    );
  }

  if (unseen) {
    return (
      <LinearGradient
        colors={[...STORY_GRADIENT]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.ringGradient}
      >
        <View style={styles.ringInner}>{children}</View>
      </LinearGradient>
    );
  }

  return <View style={[styles.ring, styles.ringSeen]}>{children}</View>;
}

export function buildStoryGroups(
  myStories: StoryGroup | null,
  feed: StoryGroup[],
): StoryGroup[] {
  return myStories ? [myStories, ...feed] : feed;
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
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors: c }) => createBarStyles(c));
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; index: number } | null>(
    null,
  );

  const hasMyStories = (myStories?.stories.length ?? 0) > 0;

  const openMyStories = () => {
    if (hasMyStories && myStories) {
      setViewer({ groups: buildStoryGroups(myStories, feed), index: 0 });
      return;
    }
    onAddStory();
  };

  const openGroup = (group: StoryGroup) => {
    const groups = buildStoryGroups(myStories, feed);
    const index = groups.findIndex((g) => g.user.id === group.user.id);
    setViewer({ groups, index: Math.max(0, index) });
  };

  return (
    <>
      <View style={styles.wrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <Pressable onPress={openMyStories} style={styles.itemWrap}>
            <StoryRing
              unseen={!!myStories?.hasUnseen}
              empty={!hasMyStories}
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
                <AppIcon name="add" size={13} color="#fff" />
              </Pressable>
            </StoryRing>
            <Text style={styles.label} numberOfLines={1}>
              {hasMyStories ? 'قصتي' : 'إضافة'}
            </Text>
          </Pressable>

          {loading && feed.length === 0
            ? [0, 1, 2, 3, 4].map((i) => (
                <View key={`sk-${i}`} style={styles.itemWrap}>
                  <View style={[styles.ring, styles.skeleton]} />
                  <View style={styles.skeletonLabel} />
                </View>
              ))
            : feed.map((group) => {
                const firstName = (
                  group.user.arabicName ||
                  group.user.displayName ||
                  group.user.username
                ).split(' ')[0];

                return (
                  <Pressable
                    key={group.user.id}
                    onPress={() => openGroup(group)}
                    style={styles.itemWrap}
                  >
                    <StoryRing unseen={group.hasUnseen}>
                      <Image
                        source={{
                          uri: resolveMediaUrl(
                            group.latestThumbnail || group.user.avatar,
                          ),
                        }}
                        style={styles.avatar}
                        contentFit="cover"
                      />
                      {group.storiesCount > 1 ? (
                        <View style={styles.countBadge}>
                          <Text style={styles.countText}>{group.storiesCount}</Text>
                        </View>
                      ) : null}
                    </StoryRing>
                    <Text
                      style={[
                        styles.label,
                        group.hasUnseen && styles.labelUnseen,
                      ]}
                      numberOfLines={1}
                    >
                      {firstName}
                    </Text>
                  </Pressable>
                );
              })}
        </ScrollView>
      </View>

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
    wrap: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSoft,
    },
    row: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      gap: spacing.sm + 2,
    },
    itemWrap: { alignItems: 'center', gap: 5, width: CIRCLE + 4 },
    ringGradient: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      padding: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringInner: {
      width: INNER,
      height: INNER,
      borderRadius: INNER / 2,
      backgroundColor: colors.bgDeep,
      padding: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ring: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      padding: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringSeen: {
      borderWidth: 2,
      borderColor: colors.borderMid,
      backgroundColor: colors.bgDeep,
      padding: 2,
    },
    ringEmpty: {
      borderWidth: 2,
      borderColor: colors.borderSoft,
      borderStyle: 'dashed',
      backgroundColor: colors.bgElevated,
    },
    avatar: {
      width: INNER - 4,
      height: INNER - 4,
      borderRadius: (INNER - 4) / 2,
      backgroundColor: colors.bgElevated,
    },
    addIcon: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: colors.bgDeep,
    },
    countBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.electric,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: colors.bgDeep,
    },
    countText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
    },
    label: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign: 'center',
      width: CIRCLE + 4,
      fontSize: 11,
    },
    labelUnseen: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    skeleton: {
      backgroundColor: colors.bgElevated,
      borderColor: colors.borderSoft,
      borderWidth: 2,
    },
    skeletonLabel: {
      width: 44,
      height: 8,
      borderRadius: radius.sm,
      backgroundColor: colors.bgElevated,
    },
  });
}
