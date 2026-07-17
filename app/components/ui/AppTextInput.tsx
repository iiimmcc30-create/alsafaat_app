import { AppIcon } from '@/components/ui/FlaticonIcon';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useState } from 'react';
import { controls, radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { ltrInputText, marginStart, rtlInputText, rtlRow } from '@/lib/rtl';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: string;
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
  placeholderTextColor,
  onFocus,
  onBlur,
  editable = true,
  ...props
}: AppTextInputProps) {
  const { styles, colors } = useThemedStyles((theme) => ({
    styles: createStyles(theme.colors),
    colors: theme.colors,
  }));
  const inputStyle = ltr ? ltrInputText : rtlInputText;
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.wrap,
          focused && styles.wrapFocused,
          error ? styles.wrapError : null,
          !editable && styles.wrapDisabled,
        ]}
      >
        {icon ? (
          <View style={[styles.iconBubble, focused && styles.iconBubbleFocused]}>
            <AppIcon
              name={icon}
              size={17}
              color={focused ? colors.electricBright : colors.textMuted}
            />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor={placeholderTextColor ?? colors.textSubtle}
          style={[styles.input, inputStyle, style]}
          editable={editable}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      paddingHorizontal: spacing.sm,
      minHeight: controls.heightLg,
    },
    wrapFocused: {
      borderColor: colors.electricBright,
      backgroundColor: colors.bgSurface,
      shadowColor: colors.electric,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    },
    wrapError: {
      borderColor: colors.danger,
    },
    wrapDisabled: { opacity: 0.55 },
    iconBubble: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      backgroundColor: colors.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
      ...marginStart(spacing.sm),
    },
    iconBubbleFocused: {
      backgroundColor: colors.bgGlass,
    },
    input: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
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
}
