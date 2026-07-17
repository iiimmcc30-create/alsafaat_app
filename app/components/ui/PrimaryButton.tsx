// SAFAT — Premium Button (v2) with rim-light, glow & scale press
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { controls, motion, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface PrimaryButtonProps {
  title: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'ghost' | 'gold' | 'outline';
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  fullWidth?: boolean;
}

export function PrimaryButton({
  title,
  onPress,
  style,
  variant = 'primary',
  small,
  disabled,
  loading = false,
  icon,
  fullWidth = false,
}: PrimaryButtonProps) {
  const { styles, colors, gradients, shadow } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
    gradients: theme.gradients,
    shadow: theme.shadow,
  }));

  const blocked = disabled || loading;
  const contentColor =
    variant === 'gold'
      ? '#1A1300'
      : variant === 'outline'
        ? colors.textBrandStrong
        : variant === 'ghost'
          ? colors.textPrimary
          : '#FFFFFF';
  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator size="small" color={contentColor} />
      ) : icon ? (
        <AppIcon name={icon} size={small ? 16 : 18} color={contentColor} />
      ) : null}
      <Text style={[styles.label, { color: contentColor }]}>{title}</Text>
    </View>
  );

  if (variant === 'ghost' || variant === 'outline') {
    const isOutline = variant === 'outline';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: blocked, busy: loading }}
        onPress={blocked ? undefined : onPress}
        style={({ pressed }) => [
          isOutline ? styles.outline : styles.ghost,
          small && styles.small,
          fullWidth && styles.fullWidth,
          pressed && styles.pressed,
          blocked && styles.disabled,
          style,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  const colorStops = variant === 'gold' ? gradients.goldRing : gradients.electric;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={blocked ? undefined : onPress}
      style={({ pressed }) => [
        styles.shell,
        variant !== 'gold' && shadow.glow,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        blocked && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={colorStops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.btn, small && styles.small, fullWidth && styles.fullWidth]}
      >
        <LinearGradient
          colors={gradients.rim}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rim}
        />
        {content}
      </LinearGradient>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    shell: {
      borderRadius: radius.lg,
    },
    btn: {
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: controls.heightLg,
      overflow: 'hidden',
      position: 'relative',
    },
    rim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
    },
    ghost: {
      paddingHorizontal: spacing.xl,
      minHeight: controls.heightLg,
      borderRadius: radius.lg,
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outline: {
      paddingHorizontal: spacing.xl,
      minHeight: controls.heightLg,
      borderRadius: radius.lg,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    small: {
      paddingHorizontal: spacing.lg,
      minHeight: controls.heightSm,
      borderRadius: radius.md,
    },
    fullWidth: { width: '100%' },
    pressed: { transform: [{ scale: motion.pressScale }], opacity: 0.9 },
    disabled: { opacity: 0.45 },
    content: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    label: {
      ...typography.bodyStrong,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
  });
}

export default PrimaryButton;
