// SAFAT — Common Styles (v2)
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, shadow } from './theme';

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgDeep,
  },
  glassPanel: {
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
  },
  glassPanelElevated: {
    backgroundColor: colors.bgGlassStrong,
    borderWidth: 1,
    borderColor: colors.borderMid,
    borderRadius: radius.xl,
    ...shadow.card,
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  pillActive: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(2,110,152,0.25)',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderHairline,
    marginVertical: spacing.lg,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default commonStyles;
