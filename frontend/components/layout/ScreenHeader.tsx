// Powered by OnSpace.AI
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { rtlDirection, rtlBackIcon, rtlRow } from '@/lib/rtl';

interface ScreenHeaderProps {
  title: string;
  arabic?: string;
  showBack?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  showSidebar?: boolean;
  onSidebar?: () => void;
}

export function ScreenHeader({
  title,
  arabic,
  showBack,
  rightIcon,
  onRightPress,
  showSidebar,
  onSidebar,
}: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.container, rtlDirection]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name={rtlBackIcon} size={24} color={colors.textPrimary} />
          </Pressable>
        ) : showSidebar ? (
          <Pressable onPress={onSidebar} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="menu" size={24} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {arabic ? <Text style={styles.arabic}>{arabic}</Text> : null}
      </View>

      <View style={[styles.side, { alignItems: 'flex-end' }]}>
        {rightIcon ? (
          <Pressable onPress={onRightPress} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name={rightIcon} size={22} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...rtlRow,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  side: {
    width: 40,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  arabic: {
    ...typography.micro,
    color: colors.glow,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
});

export default ScreenHeader;
