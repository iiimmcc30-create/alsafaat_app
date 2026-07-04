import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { APPLICATION_STATUS_META } from '@/lib/butcherApplicationLabels';
import type { ButcherApplicationStatus } from '@/services/butcherApplicationTypes';

type StatusBadgeProps = {
  status: ButcherApplicationStatus;
  compact?: boolean;
};

function statusTextColor(
  status: ButcherApplicationStatus,
  colors: ReturnType<typeof useTheme>['colors'],
  accent: string,
): string {
  if (status === 'APPROVED') return colors.textBrandSuccess;
  return accent;
}

export function StatusBadge({ status, compact }: StatusBadgeProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(() => createStyles());
  const meta = APPLICATION_STATUS_META[status];
  const labelColor = statusTextColor(status, colors, meta.color);

  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }, compact && styles.compact]}>
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.label, { color: labelColor }, compact && styles.compactLabel]}>
        {meta.label}
      </Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      gap: spacing.xs,
    },
    compact: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    label: {
      ...typography.caption,
      fontWeight: '700',
    },
    compactLabel: {
      fontSize: 11,
    },
  });
}
