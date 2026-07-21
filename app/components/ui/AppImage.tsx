import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import {
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  View,
} from 'react-native';
import { resolveMediaUrl } from '@/services/media';

type ContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

export interface AppImageProps extends Omit<ExpoImageProps, 'source' | 'contentFit'> {
  source?: ImageSourcePropType | null;
  contentFit?: ContentFit;
  transition?: number;
  priority?: 'low' | 'normal' | 'high';
}

export function uriSource(uri?: string | null): ImageSourcePropType | undefined {
  const resolved = resolveMediaUrl(uri);
  if (!resolved) return undefined;
  return { uri: resolved };
}

function hasValidUri(source: ImageSourcePropType | null | undefined): boolean {
  if (!source) return false;
  if (typeof source === 'number') return true;
  if (Array.isArray(source)) return source.some((s) => hasValidUri(s));
  const uri = (source as { uri?: string }).uri;
  return typeof uri === 'string' && uri.trim().length > 0;
}

export function Image({
  contentFit = 'cover',
  transition = 200,
  priority = 'normal',
  style,
  source,
  ...props
}: AppImageProps) {
  if (!hasValidUri(source)) {
    return <View style={style as StyleProp<ImageStyle>} />;
  }

  return (
    <ExpoImage
      {...props}
      source={source as ExpoImageProps['source']}
      style={style as StyleProp<ImageStyle>}
      contentFit={contentFit}
      transition={transition}
      priority={priority}
      cachePolicy="memory-disk"
      recyclingKey={
        typeof source === 'object' && source && !Array.isArray(source) && 'uri' in source
          ? source.uri
          : undefined
      }
    />
  );
}
