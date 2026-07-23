import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Pressable, StyleSheet, Text, View, type ReactNode } from 'react-native';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { rtlRow } from '@/lib/rtl';

export type SidebarMenuItem = {
  key: string;
  icon: string;
  label: string;
  route?: string;
  onPress?: () => void;
  badge?: number;
};

export function SidebarSection({
  title,
  children,
  colors,
}: {
  title: string;
  children: ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View style={sectionStyles.block}>
      <Text style={[sectionStyles.title, { color: colors.textMuted }]}>{title}</Text>
      <View style={[sectionStyles.divider, { backgroundColor: colors.borderHairline }]} />
      {children}
    </View>
  );
}

export function SidebarMenuRow({
  item,
  colors,
  onPress,
  iconColor,
}: {
  item: SidebarMenuItem;
  colors: ThemeColors;
  onPress: () => void;
  iconColor?: string;
}) {
  const tint = iconColor ?? colors.electric;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [rowStyles.row, rtlRow, pressed && rowStyles.rowPressed]}
    >
      <View style={[rowStyles.leading, rtlRow]}>
        <AppIcon name={item.icon} size={22} color={tint} />
        <Text style={[rowStyles.label, { color: colors.textPrimary }]}>{item.label}</Text>
      </View>
      {item.badge && item.badge > 0 ? (
        <View style={[rowStyles.badge, { backgroundColor: colors.electric }]}>
          <Text style={rowStyles.badgeText}>
            {item.badge > 99 ? '99+' : item.badge}
          </Text>
        </View>
      ) : (
        <View style={rowStyles.badgeSpacer} />
      )}
    </Pressable>
  );
}

export function SidebarLogoutButton({
  colors,
  onPress,
}: {
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        logoutStyles.btn,
        rtlRow,
        {
          backgroundColor: `${colors.rose}14`,
          borderColor: `${colors.rose}28`,
        },
        pressed && { opacity: 0.88 },
      ]}
    >
      <Text style={[logoutStyles.text, { color: colors.rose }]}>تسجيل الخروج</Text>
      <AppIcon name="log-out-outline" size={20} color={colors.rose} />
    </Pressable>
  );
}

const sectionStyles = StyleSheet.create({
  block: {
    paddingTop: spacing.md,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowPressed: {
    opacity: 0.72,
  },
  leading: {
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...typography.bodyStrong,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
    flexShrink: 1,
  },
  badge: {
    minWidth: 26,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  badgeSpacer: {
    width: 26,
  },
});

const logoutStyles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  text: {
    ...typography.bodyStrong,
    fontWeight: '700',
    fontSize: 16,
  },
});
