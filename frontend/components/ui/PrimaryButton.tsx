// SAFAT — Premium Button (v2) with rim-light, glow & scale press
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, gradients, radius, shadow, typography } from '@/constants/theme';

interface PrimaryButtonProps {
  title: string;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'primary' | 'ghost' | 'gold' | 'outline';
  small?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({
  title,
  onPress,
  style,
  variant = 'primary',
  small,
  disabled,
}: PrimaryButtonProps) {
  if (variant === 'ghost' || variant === 'outline') {
    const isOutline = variant === 'outline';
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [
          isOutline ? styles.outline : styles.ghost,
          small && styles.small,
          pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          disabled && { opacity: 0.45 },
          style,
        ]}
      >
        <Text style={[styles.label, { color: isOutline ? colors.glow : colors.textPrimary }]}>
          {title}
        </Text>
      </Pressable>
    );
  }

  const colorStops = variant === 'gold' ? gradients.goldRing : gradients.electric;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.shell,
        variant !== 'gold' && shadow.glow,
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <LinearGradient
        colors={colorStops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.btn, small && styles.small]}
      >
        <LinearGradient
          colors={gradients.rim}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rim}
        />
        <Text style={[styles.label, variant === 'gold' && { color: '#1A1300' }]}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.pill,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
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
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.glow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    minHeight: 38,
  },
  label: {
    ...typography.bodyStrong,
    color: '#FFFFFF',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});

export default PrimaryButton;
