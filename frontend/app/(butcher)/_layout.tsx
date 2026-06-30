// Powered by OnSpace.AI
// SAFAT — Butcher Tabs Layout

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { rtlDirection } from '@/lib/rtl';
import type { ComponentProps } from 'react';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabBarIcon({
  name,
  color,
  size,
}: {
  name: IoniconName;
  color: string;
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function ButcherTabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, 8) + 6;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.electricBright,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgPrimary,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
          height: 58 + tabBarBottom,
          paddingTop: 8,
          paddingBottom: tabBarBottom,
          ...rtlDirection,
        },
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
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="bar-chart" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'إدارة الملحمة',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="storefront" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'الرسائل',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="chatbubbles" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
