// Header bell icon with unread badge — navigates to notification center

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';

type NotificationBellButtonProps = {
  size?: number;
  iconSize?: number;
  style?: object;
};

export function NotificationBellButton({
  size = 36,
  iconSize = 22,
  style,
}: NotificationBellButtonProps) {
  const router = useRouter();
  const { unreadCount } = useUnreadNotificationCount();
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
  }));

  return (
    <Pressable
      style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }, style]}
      hitSlop={8}
      onPress={() => router.push('/notifications')}
      accessibilityLabel="الإشعارات"
      accessibilityRole="button"
    >
      <Ionicons name="notifications-outline" size={iconSize} color={colors.textPrimary} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '٩٩+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    iconBtn: {
      backgroundColor: colors.bgGlass,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderSoft,
    },
    badge: {
      position: 'absolute',
      top: -2,
      left: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: spacing.xs,
      borderRadius: 9,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.bgDeep,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#fff',
      lineHeight: 12,
    },
  });
}
