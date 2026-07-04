// Powered by OnSpace.AI
// SAFAT — ButchersSidebarEntry
// Public butcher discovery + owner tools when application is approved.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useApprovedButcherApplication } from '@/hooks/useApprovedButcherApplication';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlDirection, rtlForwardIcon, rtlRow } from '@/lib/rtl';

type SidebarRouteItem = {
  icon: keyof typeof Ionicons.glyphMap;
  arabic: string;
  route: string;
  ownerOnly?: boolean;
};

const PUBLIC_ITEMS: SidebarRouteItem[] = [
  { icon: 'storefront-outline', arabic: 'سوق الملاحم', route: '/butchers' },
  { icon: 'map-outline', arabic: 'خريطة الملاحم', route: '/butchers/map' },
];

const APPLICATION_ITEMS: SidebarRouteItem[] = [
  { icon: 'document-text-outline', arabic: 'طلب تسجيل ملحمة', route: '/butchers/apply' },
  { icon: 'folder-open-outline', arabic: 'طلبي', route: '/butchers/my-application' },
];

const OWNER_ITEMS: SidebarRouteItem[] = [
  { icon: 'bar-chart-outline', arabic: 'لوحة التحليلات', route: '/butchers/dashboard', ownerOnly: true },
  { icon: 'settings-outline', arabic: 'إدارة الملحمة', route: '/butchers/manage', ownerOnly: true },
  { icon: 'create-outline', arabic: 'تعديل بيانات الملحمة', route: '/butchers/edit', ownerOnly: true },
  { icon: 'chatbubbles-outline', arabic: 'رسائل العملاء', route: '/(tabs)/messages', ownerOnly: true },
];

export function ButchersSidebarEntry() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const {
    hasApprovedApplication,
    hasAnyApplication,
    hasPendingApplication,
    provisionedButcherId,
  } = useApprovedButcherApplication();

  const visibleItems = useMemo(() => {
    const items: SidebarRouteItem[] = [...PUBLIC_ITEMS];

    if (hasApprovedApplication) {
      items.push(...OWNER_ITEMS);
      if (provisionedButcherId) {
        items.push({
          icon: 'storefront',
          arabic: 'صفحة ملحمتي',
          route: `/butchers/${provisionedButcherId}`,
          ownerOnly: true,
        });
      }
      if (hasAnyApplication) {
        items.push(APPLICATION_ITEMS[1]);
      }
      return items;
    }

    if (!hasPendingApplication) {
      items.push(APPLICATION_ITEMS[0]);
    }
    if (hasAnyApplication) {
      items.push(APPLICATION_ITEMS[1]);
    }

    return items;
  }, [
    hasApprovedApplication,
    hasAnyApplication,
    hasPendingApplication,
    provisionedButcherId,
  ]);

  const navigate = (route: string) => {
    router.back();
    setTimeout(() => router.push(route as any), 120);
  };

  return (
    <View style={rtlDirection}>
      {visibleItems.map((item, idx) => (
        <Pressable
          key={`${item.route}-${item.arabic}`}
          onPress={() => navigate(item.route)}
          style={({ pressed }) => [
            styles.row,
            idx < visibleItems.length - 1 && styles.rowDivider,
            pressed && { opacity: 0.72 },
          ]}
        >
          <View style={styles.leading}>
            <Ionicons
              name={item.icon}
              size={22}
              color={item.ownerOnly ? colors.glow : colors.amber}
            />
            <Text style={styles.label}>{item.arabic}</Text>
          </View>
          <Ionicons name={rtlForwardIcon} size={18} color={colors.textMuted} />
        </Pressable>
      ))}
      <View style={styles.sectionDivider} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      ...rtlRow,
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    leading: {
      ...rtlRow,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: spacing.sm,
      minWidth: 0,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderHairline,
    },
    label: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      flexShrink: 1,
    },
    sectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderHairline,
      marginHorizontal: spacing.xl,
    },
  });
}
