// SAFAT — Premium Glass Card (v2) with rim-light & elevated variant
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, gradients, radius, shadow } from '@/constants/theme';

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  glow?: boolean;
  elevated?: boolean;
  padding?: number;
}

export function GlassCard({ children, style, glow = false, elevated = false, padding = 18 }: GlassCardProps) {
  return (
    <View style={[styles.wrap, elevated && shadow.card, glow && shadow.glow, style]}>
      <LinearGradient
        colors={glow ? gradients.cardHover : gradients.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* rim-light highlight */}
        <LinearGradient
          colors={gradients.rim}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.rim}
        />
        <View style={[styles.inner, { padding }]}>{children}</View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
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
  inner: {
    padding: 18,
  },
});

export default GlassCard;
