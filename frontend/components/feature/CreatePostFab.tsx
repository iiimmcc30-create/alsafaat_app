import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { inlineEnd } from '@/lib/rtl';

interface CreatePostFabProps {
  onPress?: () => void;
  bottomOffset?: number;
}

export function CreatePostFab({ onPress, bottomOffset = 88 }: CreatePostFabProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="إنشاء منشور"
      onPress={onPress ?? (() => router.push('/create/post'))}
      style={({ pressed }) => [
        styles.fab,
        inlineEnd(spacing.lg),
        { bottom: insets.bottom + bottomOffset },
        pressed && styles.fabPressed,
      ]}
    >
      <Ionicons name="create" size={26} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.electric,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 8,
    shadowColor: colors.electric,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
