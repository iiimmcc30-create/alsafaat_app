// Powered by OnSpace.AI
// SAFAT — Tabs Layout

import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { rtlDirection } from '@/lib/rtl';
import type { ComponentProps } from 'react';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

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

function AddListingTabButton({
  style,
  accessibilityState,
}: BottomTabBarButtonProps) {
  const router = useRouter();
  const { colors, gradients, scheme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel="إضافة إعلان"
      onPress={() => router.push('/create/listing')}
      style={[style, styles.addTabWrap]}
    >
      <LinearGradient
        colors={scheme === 'light' ? gradients.electric : gradients.royal}
        style={[styles.addTabBtn, { borderColor: colors.bgPrimary }]}
      >
        <Ionicons name="add" size={34} color="#fff" />
      </LinearGradient>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const tabBarBottom = Math.max(insets.bottom, 8) + 6;

  return (
    <Tabs
      key={scheme}
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
          title: 'الرئيسية',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'السوق',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="pricetag" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarShowLabel: false,
          tabBarIcon: () => null,
          tabBarButton: (props) => <AddListingTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="posts"
        options={{
          title: 'المنشورات',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="newspaper" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          href: null,
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

const styles = StyleSheet.create({
  addTabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTabBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginTop: -10,
  },
});
