// Powered by OnSpace.AI
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlForwardIcon, rtlRow } from '@/lib/rtl';

interface CreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: 'listing' | 'post') => void;
}

interface OptionData {
  key: 'listing' | 'post';
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  arabic: string;
  description: string;
  gradientColors: readonly [string, string, ...string[]];
}

const options: OptionData[] = [
  {
    key: 'listing',
    icon: 'tag-plus',
    title: 'Create Listing',
    arabic: 'إعلان جديد',
    description: 'بيع الحيوانات والأعلاف والمعدات',
    gradientColors: ['#3B82F6', '#22D3EE'] as const,
  },
  {
    key: 'post',
    icon: 'pencil-plus',
    title: 'Create Post',
    arabic: 'منشور جديد',
    description: 'شارك أخبارك مع المجتمع',
    gradientColors: ['#1E3A8A', '#7DD3FC'] as const,
  },
];

export function CreateSheet({ visible, onClose, onSelect }: CreateSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(300);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, backgroundColor: 'rgba(6,9,26,0.7)' }]} />
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.xxl, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>إنشاء جديد</Text>

            <View style={styles.options}>
              {options.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    onSelect(opt.key);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.option, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                >
                  <LinearGradient
                    colors={opt.gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconBox}
                  >
                    <MaterialCommunityIcons name={opt.icon} size={26} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optTitle}>{opt.arabic}</Text>
                    <Text style={styles.optDesc}>{opt.description}</Text>
                  </View>
                  <Ionicons name={rtlForwardIcon} size={20} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>

            <Pressable onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.borderMid,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMid,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textBrand,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.lg,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  optArabic: {
    ...typography.caption,
    color: colors.textBrand,
    marginVertical: 2,
  },
  optDesc: {
    ...typography.caption,
    color: colors.textMuted,
  },
  cancel: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cancelText: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  });
}

export default CreateSheet;
