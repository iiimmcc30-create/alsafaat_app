import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  formatApplicationDateTime,
  TIMELINE_ACTION_LABELS,
} from '@/lib/butcherApplicationLabels';
import { rtlRow } from '@/lib/rtl';
import type { ApplicationTimelineEvent } from '@/services/butcherApplicationTypes';

const ACTION_ICONS: Record<
  ApplicationTimelineEvent['action'],
  keyof typeof Ionicons.glyphMap
> = {
  CREATE: 'add-circle-outline',
  UPDATE: 'create-outline',
  SUBMIT: 'paper-plane-outline',
  APPROVE: 'checkmark-circle-outline',
  REJECT: 'close-circle-outline',
  WITHDRAW: 'arrow-undo-outline',
  COMMENT: 'chatbubble-ellipses-outline',
};

type TimelineItemProps = {
  event: ApplicationTimelineEvent;
  isLast?: boolean;
};

export function TimelineItem({ event, isLast }: TimelineItemProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const icon = ACTION_ICONS[event.action] ?? 'ellipse-outline';

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={16} color={colors.glow} />
        </View>
        {!isLast ? <View style={styles.line} /> : null}
      </View>
      <View style={styles.content}>
        <View style={rtlRow}>
          <Text style={styles.action}>{TIMELINE_ACTION_LABELS[event.action]}</Text>
          <Text style={styles.time}>{formatApplicationDateTime(event.createdAt)}</Text>
        </View>
        <Text style={styles.actor}>بواسطة {event.actorUsername}</Text>
        {event.comment ? <Text style={styles.comment}>{event.comment}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    rail: {
      alignItems: 'center',
      width: 28,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderMid,
      alignItems: 'center',
      justifyContent: 'center',
    },
    line: {
      flex: 1,
      width: 2,
      backgroundColor: colors.borderSoft,
      marginTop: spacing.xs,
      minHeight: 24,
    },
    content: {
      flex: 1,
      paddingTop: 2,
    },
    action: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      flex: 1,
    },
    time: {
      ...typography.micro,
      color: colors.textMuted,
      fontWeight: '500',
    },
    actor: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    comment: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      backgroundColor: colors.bgGlass,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
  });
}
