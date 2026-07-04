import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { formatApplicationDateTime } from '@/lib/butcherApplicationLabels';
import { rtlRow } from '@/lib/rtl';
import type { AppNotification } from '@/services/notifications';

type NotificationCardProps = {
  notification: AppNotification;
  onPress: () => void;
};

export function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
  }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        !notification.isRead && styles.unreadCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={rtlRow}>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !notification.isRead && styles.unreadTitle]} numberOfLines={2}>
              {notification.titleAr}
            </Text>
            {!notification.isRead ? <View style={styles.unreadDot} /> : null}
          </View>
          <Text style={styles.body} numberOfLines={3}>
            {notification.bodyAr}
          </Text>
          <Text style={styles.time}>{formatApplicationDateTime(notification.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} style={styles.chevron} />
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bgSurface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    unreadCard: {
      borderColor: colors.borderMid,
      backgroundColor: colors.bgElevated,
    },
    pressed: {
      opacity: 0.9,
    },
    content: {
      flex: 1,
      gap: spacing.sm,
    },
    titleRow: {
      ...rtlRow,
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    title: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      flex: 1,
    },
    unreadTitle: {
      color: colors.textPrimary,
    },
    unreadDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.glow,
      marginTop: 6,
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    time: {
      ...typography.caption,
      color: colors.textMuted,
    },
    chevron: {
      marginTop: spacing.xs,
      marginRight: spacing.xs,
    },
  });
}
