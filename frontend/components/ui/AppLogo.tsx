import { Image } from 'expo-image';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { APP_LOGO } from '@/constants/branding';
import { type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

type AppLogoProps = {
  size?: number;
  style?: ViewStyle;
  showRing?: boolean;
};

export function AppLogo({ size = 88, style, showRing = true }: AppLogoProps) {
  const { styles, shadow } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    shadow: theme.shadow,
  }));
  const inner = Math.round(size * (showRing ? 0.82 : 1));

  if (!showRing) {
    return (
      <Image
        source={APP_LOGO}
        style={[
          styles.logo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style,
        ]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.ring,
        shadow.glow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <Image
        source={APP_LOGO}
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
        }}
        contentFit="cover"
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    ring: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
      borderWidth: 1.5,
      borderColor: colors.borderMid,
      overflow: 'hidden',
    },
    logo: {
      overflow: 'hidden',
    },
  });
}
