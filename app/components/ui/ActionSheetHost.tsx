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
      animationType="fade"
      onRequestClose={() => closeActionSheet(null)}
    >
      <Pressable style={styles.backdrop} onPress={() => closeActionSheet(null)}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
          onPress={(e) => e.stopPropagation?.()}
        >
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
                  pressed && { opacity: 0.85 },
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
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgSurface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderTopWidth: 1,
      borderColor: colors.borderSoft,
      gap: spacing.sm,
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
      paddingVertical: 14,
      borderRadius: radius.lg,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      alignItems: 'center',
    },
    itemDanger: {
      backgroundColor: 'rgba(239,68,68,0.12)',
      borderColor: 'rgba(239,68,68,0.35)',
    },
    itemCancel: {
      backgroundColor: colors.bgGlass,
      marginTop: spacing.xs,
    },
    itemText: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
    },
    itemTextDanger: { color: colors.rose },
    itemTextCancel: { color: colors.textMuted },
  });
}
