import { Ionicons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { ltrInputText, marginStart, rtlInputText, rtlRow } from '@/lib/rtl';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
  /** للحقول الإنجليزية أو الأرقام فقط */
  ltr?: boolean;
}

export function AppTextInput({
  label,
  error,
  hint,
  icon,
  containerStyle,
  ltr = false,
  style,
  placeholderTextColor = colors.textSubtle,
  ...props
}: AppTextInputProps) {
  const inputStyle = ltr ? ltrInputText : rtlInputText;

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.wrap, error ? styles.wrapError : null]}>
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.icon} />
        ) : null}
        <TextInput
          placeholderTextColor={placeholderTextColor}
          style={[styles.input, inputStyle, style]}
          {...props}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'right',
  },
  wrap: {
    ...rtlRow,
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  wrapError: {
    borderColor: colors.danger,
  },
  icon: marginStart(spacing.sm),
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  error: {
    ...typography.micro,
    color: colors.danger,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  hint: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
});
