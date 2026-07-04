import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  applicationDisplayName,
  countryLabel,
  formatApplicationDate,
} from '@/lib/butcherApplicationLabels';
import { rtlRow } from '@/lib/rtl';
import type { ApplicationSummary } from '@/services/butcherApplicationTypes';
import { StatusBadge } from './StatusBadge';

type ApplicationCardProps = {
  application: ApplicationSummary;
  onPress?: () => void;
};

export function ApplicationCard({ application, onPress }: ApplicationCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const title = applicationDisplayName(application.nameAr, application.nameEn);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      disabled={!onPress}
    >
      <View style={rtlRow}>
        <View style={styles.main}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle}>
            رقم الطلب #{application.applicationNumber}
            {application.city ? ` · ${application.city}` : ''}
            {application.country ? ` · ${countryLabel(application.country)}` : ''}
          </Text>
        </View>
        <StatusBadge status={application.status} compact />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>أُنشئ {formatApplicationDate(application.createdAt)}</Text>
        </View>
        {application.submittedAt ? (
          <View style={styles.metaItem}>
            <Ionicons name="send-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>
              قُدّم {formatApplicationDate(application.submittedAt)}
            </Text>
          </View>
        ) : null}
      </View>

      {onPress ? (
        <View style={styles.footer}>
          <Text style={styles.link}>عرض التفاصيل</Text>
          <Ionicons name="chevron-back" size={16} color={colors.glow} />
        </View>
      ) : null}
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
      gap: spacing.md,
    },
    pressed: {
      opacity: 0.9,
      borderColor: colors.borderMid,
    },
    main: {
      flex: 1,
      gap: spacing.xs,
      paddingLeft: spacing.md,
    },
    title: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    subtitle: {
      ...typography.caption,
      color: colors.textMuted,
    },
    metaRow: {
      gap: spacing.sm,
    },
    metaItem: {
      ...rtlRow,
      alignItems: 'center',
      gap: spacing.xs,
    },
    metaText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    footer: {
      ...rtlRow,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.borderHairline,
      paddingTop: spacing.md,
    },
    link: {
      ...typography.caption,
      color: colors.textBrand,
      fontWeight: '700',
    },
  });
}
