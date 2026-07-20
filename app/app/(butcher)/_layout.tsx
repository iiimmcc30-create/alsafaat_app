// Powered by OnSpace.AI
// SAFAT — Butcher Tabs Layout
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { rtlDirection } from '@/lib/rtl';
import type { FlaticonStyle } from '@/constants/flaticon-glyphs';
import { layout, radius } from '@/constants/theme';

function TabBarIcon({
  name,
  color,
  size,
  focused,
}: {
  name: string;
  color: string;
  size: number;
  focused?: boolean;
}) {
  const variant: FlaticonStyle = focused ? 'sr' : 'rr';
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: `${color}14` }]}>
      <AppIcon name={name} variant={variant} size={focused ? size + 1 : size} color={color} />
      {focused ? <View style={[styles.activeDot, { backgroundColor: color }]} /> : null}
    </View>
  );
}

export default function ButcherTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const tabBarBottom = Math.max(insets.bottom, 8) + 6;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.electricBright,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabel: ({ focused, children }) => (
          <Text
            style={{
              color: focused ? colors.textBrandStrong : colors.textMuted,
              fontSize: 10,
              fontWeight: '600',
              writingDirection: 'rtl',
            }}
          >
            {children}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: colors.bgGlassStrong,
          borderTopColor: colors.borderHairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: layout.tabBarHeight + tabBarBottom,
          paddingTop: 6,
          paddingBottom: tabBarBottom,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -5 },
          shadowOpacity: scheme === 'light' ? 0.06 : 0.22,
          shadowRadius: 16,
          elevation: 12,
          ...rtlDirection,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          writingDirection: 'rtl',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'التحليلات',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="bar-chart-outline" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'إدارة الملحمة',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="storefront-outline" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'الرسائل',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="chatbubbles-outline" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="person-outline" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 42,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
