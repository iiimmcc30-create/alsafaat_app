import { I18nManager, Platform, type TextStyle, type ViewStyle } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';

export function setupRtl(): void {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }
}

export const isRTL = I18nManager.isRTL;

// `direction` is native-only; React Native Web expects writingDirection on text nodes.
const nativeRtlDirection = Platform.OS === 'web' ? {} : ({ direction: 'rtl' } as ViewStyle);

export const rtlDirection: ViewStyle = nativeRtlDirection;

/** صف أفقي متوافق مع RTL — لا تستخدم row-reverse مع forceRTL */
export const rtlRow: ViewStyle = {
  flexDirection: 'row',
  ...nativeRtlDirection,
};

export function inlineStart(offset: number): ViewStyle {
  return isRTL ? { right: offset } : { left: offset };
}

export function inlineEnd(offset: number): ViewStyle {
  return isRTL ? { left: offset } : { right: offset };
}

export function marginStart(value: number): { marginLeft?: number; marginRight?: number } {
  return isRTL ? { marginRight: value } : { marginLeft: value };
}

export function marginEnd(value: number): { marginLeft?: number; marginRight?: number } {
  return isRTL ? { marginLeft: value } : { marginRight: value };
}

export function paddingStart(value: number): ViewStyle {
  return isRTL ? { paddingRight: value } : { paddingLeft: value };
}

export function paddingEnd(value: number): ViewStyle {
  return isRTL ? { paddingLeft: value } : { paddingRight: value };
}

/** أيقونة الرجوع — في RTL تُشير لليمين */
export type RtlIoniconName = keyof typeof Ionicons.glyphMap;

export const rtlBackIcon: RtlIoniconName = isRTL ? 'chevron-forward' : 'chevron-back';
export const rtlForwardIcon: RtlIoniconName = isRTL ? 'chevron-back' : 'chevron-forward';

/** أنماط افتراضية لحقول الإدخال العربية */
export const rtlInputText: TextStyle = {
  textAlign: 'right',
  writingDirection: 'rtl',
};

/** حقول إنجليزية/أرقام فقط */
export const ltrInputText: TextStyle = {
  textAlign: 'left',
  writingDirection: 'ltr',
};

export const rtlTextInputProps = {
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};
