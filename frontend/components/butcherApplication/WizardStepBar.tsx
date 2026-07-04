import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { rtlRow } from '@/lib/rtl';

const STEPS = [
  'معلومات المحل',
  'الموقع',
  'تفاصيل العمل',
  'المستندات',
  'المراجعة',
] as const;

type WizardStepBarProps = {
  current: number;
};

export function WizardStepBar({ current }: WizardStepBarProps) {
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  return (
    <View style={styles.wrap}>
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={label} style={styles.step}>
            <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
              {done ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={[styles.dotNum, active && styles.dotNumActive]}>{index + 1}</Text>
              )}
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      ...rtlRow,
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    step: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
      minWidth: 0,
    },
    dot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: colors.borderMid,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotDone: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    dotActive: {
      borderColor: colors.glow,
      backgroundColor: colors.electric,
    },
    dotNum: {
      ...typography.micro,
      color: colors.textMuted,
      fontWeight: '800',
    },
    dotNumActive: {
      color: '#fff',
    },
    label: {
      ...typography.micro,
      color: colors.textMuted,
      textAlign: 'center',
      fontWeight: '600',
    },
    labelActive: {
      color: colors.textBrand,
    },
  });
}
