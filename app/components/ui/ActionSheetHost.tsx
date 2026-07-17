import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
  closeActionSheet,
  getActionSheetState,
  subscribeActionSheet,
} from '@/lib/actionSheet';

/** Global host — mount once in root layout so action sheets work on web + native. */
export function ActionSheetHost() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeActionSheet(() => setTick((n) => n + 1)), []);

  const state = getActionSheetState();
  const visible = !!state;
  // keep tick referenced so re-renders stay intentional
  void tick;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => closeActionSheet(null)}
    >
      <Pressable style={styles.backdrop} onPress={() => closeActionSheet(null)}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{state?.title}</Text>
          {state?.message ? (
            <Text style={styles.message}>{state.message}</Text>
          ) : null}

          <View style={styles.list}>
            {(state?.items ?? []).map((item) => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.item,
                  item.destructive && styles.itemDanger,
                  item.cancel && styles.itemCancel,
                  pressed && styles.itemPressed,
                ]}
                onPress={() => closeActionSheet(item.cancel ? null : item.key)}
              >
                <Text
                  style={[
                    styles.itemText,
                    item.destructive && styles.itemTextDanger,
                    item.cancel && styles.itemTextCancel,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.bgOverlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgGlassStrong,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      gap: spacing.sm,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.borderStrong,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.h3,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    message: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    list: { gap: spacing.sm, marginTop: spacing.sm },
    item: {
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemDanger: {
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.35)',
    },
    itemCancel: {
      backgroundColor: colors.bgSurface,
      marginTop: spacing.xs,
    },
    itemPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.985 }],
    },
    itemText: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
    },
    itemTextDanger: { color: colors.rose },
    itemTextCancel: { color: colors.textMuted },
  });
}
