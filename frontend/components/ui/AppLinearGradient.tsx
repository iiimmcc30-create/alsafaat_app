import { View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';

type ColorValue = string;

export interface LinearGradientProps extends ViewProps {
  colors: readonly ColorValue[];
  locations?: readonly number[] | null;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

/** Expo Go-safe gradient fallback using the leading color as a solid fill. */
export function LinearGradient({
  colors,
  style,
  children,
  ...props
}: LinearGradientProps) {
  const backgroundColor = colors[0] ?? 'transparent';

  return (
    <View style={[style as StyleProp<ViewStyle>, { backgroundColor }]} {...props}>
      {children}
    </View>
  );
}
