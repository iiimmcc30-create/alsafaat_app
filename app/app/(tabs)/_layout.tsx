// Powered by OnSpace.AI
// SAFAT — Tabs Layout

import { Tabs, useRouter } from 'expo-router';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { FlaticonStyle } from '@/constants/flaticon-glyphs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

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
    <View
      style={[
        styles.iconWrap,
        focused && { backgroundColor: `${color}14` },
      ]}
    >
      <AppIcon name={name} variant={variant} color={color} size={focused ? size + 1 : size} />
      {focused ? <View style={[styles.activeDot, { backgroundColor: color }]} /> : null}
    </View>
  );
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
      style={({ pressed }) => [
        style,
        styles.addTabWrap,
        pressed && styles.addTabPressed,
      ]}
    >
      <LinearGradient
        colors={scheme === 'light' ? gradients.electric : gradients.royal}
        style={[styles.addTabBtn, { borderColor: colors.bgPrimary }]}
      >
        <AppIcon name="plus" variant="sr" size={34} color="#fff" />
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
        },
        tabBarItemStyle: {
          paddingTop: 2,
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'السوق',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="tags" color={color} size={size} focused={focused} />
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="newspaper" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="user" color={color} size={size} focused={focused} />
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
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginTop: -12,
    shadowColor: '#006B3C',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 9,
  },
  addTabPressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
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
