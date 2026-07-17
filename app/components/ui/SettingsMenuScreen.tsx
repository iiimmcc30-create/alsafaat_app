import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlDirection, rtlForwardIcon, rtlRow } from '@/lib/rtl';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type SettingsMenuItem = {
  icon: string;
  label: string;
  subtitle?: string;
  route: string;
};

type SettingsMenuScreenProps = {
  title: string;
  description: string;
  heroIcon: string;
  items: SettingsMenuItem[];
};

export function SettingsMenuScreen({
  title,
  description,
  heroIcon,
  items,
}: SettingsMenuScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={title} showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, rtlDirection]}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <AppIcon name={heroIcon} size={25} color={colors.electricBright} />
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroDescription}>{description}</Text>
        </View>

        <View style={styles.list}>
          {items.map((item, index) => (
            <Pressable
              key={`${item.route}-${index}`}
              accessibilityRole="button"
              onPress={() => router.push(item.route as any)}
              style={({ pressed }) => [
                styles.row,
                index < items.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.itemIcon}>
                <AppIcon name={item.icon} size={19} color={colors.textBrandStrong} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.label}>{item.label}</Text>
                {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
              </View>
              <AppIcon name={rtlForwardIcon} size={16} color={colors.textSubtle} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDeep },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.huge,
      gap: spacing.lg,
    },
    hero: {
      alignItems: 'center',
      padding: spacing.xl,
      borderRadius: radius.xl,
      backgroundColor: colors.royal,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMid,
    },
    heroIcon: {
      width: 54,
      height: 54,
      borderRadius: radius.lg,
      backgroundColor: colors.bgGlassStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    heroTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
    heroDescription: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: spacing.xs,
    },
    list: {
      backgroundColor: colors.bgGlassStrong,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      overflow: 'hidden',
    },
    row: {
      ...rtlRow,
      alignItems: 'center',
      minHeight: 76,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    rowPressed: {
      backgroundColor: colors.bgSurface,
      opacity: 0.86,
    },
    itemIcon: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      backgroundColor: colors.bgGlass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: { flex: 1, gap: 3 },
    label: { ...typography.bodyStrong, color: colors.textPrimary },
    subtitle: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  });
}

export default SettingsMenuScreen;
