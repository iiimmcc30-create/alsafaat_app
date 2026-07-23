import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlForwardIcon, rtlRow } from '@/lib/rtl';

type HomeSectionHeaderProps = {
  title: string;
  onSeeAll?: () => void;
};

export function HomeSectionHeader({ title, onSeeAll }: HomeSectionHeaderProps) {
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
  }));

  return (
    <View style={[styles.row, rtlRow]}>
      <Text style={styles.title}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} style={[styles.seeAll, rtlRow]}>
          <Text style={styles.seeAllText}>عرض الكل</Text>
          <AppIcon name={rtlForwardIcon} size={14} color={colors.textBrandStrong} />
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    title: {
      ...typography.h3,
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 18,
    },
    seeAll: {
      alignItems: 'center',
      gap: 4,
    },
    seeAllText: {
      ...typography.caption,
      color: colors.textBrandStrong,
      fontWeight: '600',
    },
  });
}
