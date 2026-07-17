// Powered by OnSpace.AI
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { controls, layout, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlBackIcon, rtlDirection, rtlRow } from '@/lib/rtl';

interface ScreenHeaderProps {
  title: string;
  arabic?: string;
  showBack?: boolean;
  rightIcon?: string;
  onRightPress?: () => void;
  showSidebar?: boolean;
  onSidebar?: () => void;
}

export function ScreenHeader({
  title,
  arabic,
  showBack,
  rightIcon,
  onRightPress,
  showSidebar,
  onSidebar,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
  }));

  return (
    <View style={[styles.container, rtlDirection]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          >
            <AppIcon name={rtlBackIcon} size={24} color={colors.textPrimary} />
          </Pressable>
        ) : showSidebar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="فتح القائمة"
            onPress={onSidebar}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          >
            <AppIcon name="menu-burger" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {arabic ? <Text style={styles.arabic}>{arabic}</Text> : null}
      </View>

      <View style={[styles.side, { alignItems: 'flex-end' }]}>
        {rightIcon ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRightPress}
            hitSlop={12}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          >
            <AppIcon name={rightIcon} size={22} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      ...rtlRow,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      minHeight: layout.headerHeight,
      backgroundColor: colors.bgGlassStrong,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    side: {
      width: controls.iconButton,
    },
    titleWrap: {
      flex: 1,
      alignItems: 'center',
    },
    title: {
      ...typography.h3,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    arabic: {
      ...typography.micro,
      color: colors.textMuted,
      marginTop: 1,
    },
    iconBtn: {
      width: controls.iconButton,
      height: controls.iconButton,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    iconBtnPressed: {
      transform: [{ scale: 0.94 }],
      backgroundColor: colors.bgElevated,
      opacity: 0.82,
    },
  });
}

export default ScreenHeader;
