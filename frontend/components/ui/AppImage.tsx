import {
  Image as RNImage,
  type ImageProps as RNImageProps,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  View,
} from 'react-native';

type ContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

const fitMap: Record<ContentFit, NonNullable<RNImageProps['resizeMode']>> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'stretch',
  none: 'center',
  'scale-down': 'contain',
};

export interface AppImageProps extends Omit<RNImageProps, 'resizeMode'> {
  contentFit?: ContentFit;
  transition?: number;
}

export function uriSource(uri?: string | null): ImageSourcePropType | undefined {
  if (typeof uri !== 'string' || uri.trim().length === 0) return undefined;
  return { uri: uri.trim() };
}

function hasValidUri(source: ImageSourcePropType | undefined): boolean {
  if (!source) return false;
  if (typeof source === 'number') return true;
  if (Array.isArray(source)) return source.some((s) => hasValidUri(s));
  const uri = source.uri;
  return typeof uri === 'string' && uri.trim().length > 0;
}

export function Image({ contentFit = 'cover', transition: _transition, style, source, ...props }: AppImageProps) {
  if (!hasValidUri(source)) {
    return <View style={style as StyleProp<ImageStyle>} />;
  }

  return <RNImage {...props} source={source} style={style as StyleProp<ImageStyle>} resizeMode={fitMap[contentFit]} />;
}
