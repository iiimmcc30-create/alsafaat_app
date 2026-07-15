// SAFAT — Post media gallery: single image, swipeable multi-image carousel,
// or video. Each image lazily fades in once loaded, with a shimmer skeleton
// shown while it downloads.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { ScrollView } from 'react-native';
import { Image, uriSource } from '@/components/ui/AppImage';
import { StoryVideoPlayer } from '@/components/feature/StoryVideoPlayer';
import { radius, type ThemeColors } from '@/constants/theme';

const ASPECT_RATIO = 4 / 3;

// A plain ViewStyle equivalent of StyleSheet.absoluteFill — StoryVideoPlayer's
// `style` prop is typed as ViewStyle, which RegisteredStyle<...> doesn't satisfy.
const ABS_FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

interface PostMediaGalleryProps {
  images: string[];
  video?: string | null;
  colors: ThemeColors;
  scheme: 'light' | 'dark';
}

function MediaSkeleton({ colors }: { colors: ThemeColors }) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bgElevated, opacity: pulse }]}
    />
  );
}

function GalleryImage({ uri, colors }: { uri: string; colors: ThemeColors }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const handleLoad = useCallback(() => {
    setLoaded(true);
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacity]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {!loaded && !failed ? <MediaSkeleton colors={colors} /> : null}
      {!failed ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <Image
            source={uriSource(uri)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onLoad={handleLoad}
            onError={() => setFailed(true)}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function PostMediaGallery({ images, video, colors, scheme }: PostMediaGalleryProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => setWidth(e.nativeEvent.layout.width),
    [],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / width);
      setActiveIndex(idx);
    },
    [width],
  );

  const containerStyle = [
    styles.container,
    {
      borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
  ];

  if (video) {
    return (
      <View style={containerStyle} onLayout={onLayout}>
        <StoryVideoPlayer
          uri={video}
          posterUri={images[0]}
          style={ABS_FILL}
          autoPlay={false}
          muted={false}
          nativeControls
        />
      </View>
    );
  }

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <View style={containerStyle} onLayout={onLayout}>
        <GalleryImage uri={images[0]} colors={colors} />
      </View>
    );
  }

  const pageWidth = width || Dimensions.get('window').width;

  return (
    <View style={containerStyle} onLayout={onLayout}>
      <ScrollView
        style={StyleSheet.absoluteFill}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {images.map((uri, idx) => (
          <View key={`${uri}-${idx}`} style={{ width: pageWidth }}>
            <GalleryImage uri={uri} colors={colors} />
          </View>
        ))}
      </ScrollView>

      <View style={styles.countBadge} pointerEvents="none">
        <Text style={styles.countText}>
          {activeIndex + 1}/{images.length}
        </Text>
      </View>

      <View style={styles.dotsRow} pointerEvents="none">
        {images.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              idx === activeIndex && {
                backgroundColor: '#fff',
                width: 7,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: ASPECT_RATIO,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});

export default PostMediaGallery;
