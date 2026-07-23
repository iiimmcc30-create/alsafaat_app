// Powered by OnSpace.AI
// SAFAT — Butcher sidebar (same design as main sidebar + butcher sections)
import { AppIcon } from '@/components/ui/FlaticonIcon';
import { Image, uriSource } from '@/components/ui/AppImage';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  scrimColor,
  spacing,
  typography,
  panelSurfaceBg,
  type ThemeColors,
} from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { rtlDirection, rtlRow } from '@/lib/rtl';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovedButcherApplication } from '@/hooks/useApprovedButcherApplication';
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { useMessageThreads } from '@/hooks/useMessageThreads';
import { SidebarFooterArt } from '@/components/feature/SidebarFooterArt';
import {
  SidebarLogoutButton,
  SidebarMenuRow,
  SidebarSection,
  type SidebarMenuItem,
} from '@/components/feature/SidebarMenu';

type MenuItem = SidebarMenuItem;

export default function ButcherSidebarScreen() {
  const router = useRouter();
  const { me } = useApp();
  const { signOut, accessToken } = useAuth();
  const { preference, setPreference, colors } = useTheme();
  const styles = useThemedStyles((theme) => createSidebarStyles(theme.colors, theme.scheme));
  const { unreadCount: notificationsUnread } = useUnreadNotificationCount();
  const { threads } = useMessageThreads(accessToken, 'BUTCHER');
  const {
    hasApprovedApplication,
    hasAnyApplication,
    hasPendingApplication,
    provisionedButcherId,
  } = useApprovedButcherApplication();

  const messagesUnread = useMemo(
    () => threads.reduce((sum, thread) => sum + (thread.unread ?? 0), 0),
    [threads],
  );

  const handleNav = (route: string) => {
    router.back();
    setTimeout(() => router.push(route as any), 120);
  };

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد أنك تريد الخروج من حسابك؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          router.back();
          await signOut();
          setTimeout(() => router.replace('/auth/phone' as any), 300);
        },
      },
    ]);
  };

  const toggleTheme = () => {
    setPreference(preference === 'dark' ? 'light' : 'dark');
  };

  const accountItems: MenuItem[] = [
    {
      key: 'messages',
      icon: 'chatbubble-outline',
      label: 'رسائل العملاء',
      route: '/(butcher)/messages',
      badge: messagesUnread,
    },
    {
      key: 'notifications',
      icon: 'notifications-outline',
      label: 'الإشعارات',
      route: '/notifications',
      badge: notificationsUnread,
    },
    {
      key: 'subscription',
      icon: 'crown',
      label: 'الباقات والاشتراك',
      route: '/subscription',
    },
  ];

  const marketItems: MenuItem[] = [
    {
      key: 'butchers',
      icon: 'storefront-outline',
      label: 'سوق الملاحم',
      route: '/butchers',
    },
    {
      key: 'map',
      icon: 'map-outline',
      label: 'خريطة الملاحم',
      route: '/butchers/map',
    },
  ];

  const ownerItems: MenuItem[] = useMemo(() => {
    if (!hasApprovedApplication) return [];

    const items: MenuItem[] = [
      {
        key: 'dashboard',
        icon: 'bar-chart-outline',
        label: 'لوحة التحليلات',
        route: '/(butcher)',
      },
      {
        key: 'manage',
        icon: 'settings-outline',
        label: 'إدارة الملحمة',
        route: '/(butcher)/manage',
      },
      {
        key: 'edit',
        icon: 'create-outline',
        label: 'تعديل بيانات الملحمة',
        route: '/butchers/edit',
      },
    ];

    if (provisionedButcherId) {
      items.push({
        key: 'my-page',
        icon: 'storefront-outline',
        label: 'صفحة ملحمتي',
        route: `/butchers/${provisionedButcherId}`,
      });
    }

    return items;
  }, [hasApprovedApplication, provisionedButcherId]);

  const applicationItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [];

    if (hasApprovedApplication) {
      if (hasAnyApplication) {
        items.push({
          key: 'my-application',
          icon: 'folder-open-outline',
          label: 'طلبي',
          route: '/butchers/my-application',
        });
      }
      return items;
    }

    if (!hasPendingApplication) {
      items.push({
        key: 'apply',
        icon: 'document-text-outline',
        label: 'طلب تسجيل ملحمة',
        route: '/butchers/apply',
      });
    }

    if (hasAnyApplication) {
      items.push({
        key: 'my-application',
        icon: 'folder-open-outline',
        label: 'طلبي',
        route: '/butchers/my-application',
      });
    }

    return items;
  }, [hasApprovedApplication, hasAnyApplication, hasPendingApplication]);

  return (
    <View style={[styles.backdrop, rtlRow]}>
      <SafeAreaView style={styles.panel} edges={['top', 'bottom']}>
        <View style={[styles.header, rtlRow]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <AppIcon name="close" size={22} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={() => {
              router.back();
              setTimeout(() => router.push('/(butcher)/profile'), 100);
            }}
            style={styles.profileCenter}
          >
            <Image source={uriSource(me.avatar)} style={styles.avatar} contentFit="cover" />
            <Text style={styles.usernameText} numberOfLines={1}>
              @{me.username || 'user'}
            </Text>
          </Pressable>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, rtlDirection]}
        >
          <SidebarSection title="الحساب" colors={colors}>
            {accountItems.map((item) => (
              <SidebarMenuRow
                key={item.key}
                item={item}
                colors={colors}
                onPress={() => (item.route ? handleNav(item.route) : item.onPress?.())}
              />
            ))}
          </SidebarSection>

          <SidebarSection title="سوق الملاحم" colors={colors}>
            {marketItems.map((item) => (
              <SidebarMenuRow
                key={item.key}
                item={item}
                colors={colors}
                onPress={() => (item.route ? handleNav(item.route) : item.onPress?.())}
              />
            ))}
          </SidebarSection>

          {ownerItems.length > 0 ? (
            <SidebarSection title="إدارة ملحمتي" colors={colors}>
              {ownerItems.map((item) => (
                <SidebarMenuRow
                  key={item.key}
                  item={item}
                  colors={colors}
                  onPress={() => (item.route ? handleNav(item.route) : item.onPress?.())}
                />
              ))}
            </SidebarSection>
          ) : null}

          {applicationItems.length > 0 ? (
            <SidebarSection title="التسجيل والطلبات" colors={colors}>
              {applicationItems.map((item) => (
                <SidebarMenuRow
                  key={item.key}
                  item={item}
                  colors={colors}
                  onPress={() => (item.route ? handleNav(item.route) : item.onPress?.())}
                />
              ))}
            </SidebarSection>
          ) : null}

          <SidebarSection title="التفضيلات" colors={colors}>
            <SidebarMenuRow
              item={{
                key: 'theme',
                icon: preference === 'dark' ? 'weather-night' : 'sunny-outline',
                label: 'الوضع النهاري / الداكن',
              }}
              colors={colors}
              onPress={toggleTheme}
            />
            <SidebarMenuRow
              item={{
                key: 'main-app',
                icon: 'home-outline',
                label: 'العودة للتطبيق الرئيسي',
                route: '/(tabs)',
              }}
              colors={colors}
              onPress={() => handleNav('/(tabs)')}
            />
          </SidebarSection>

          <SidebarLogoutButton colors={colors} onPress={handleSignOut} />

          <SidebarFooterArt />
        </ScrollView>
      </SafeAreaView>

      <Pressable style={styles.backdropTap} onPress={() => router.back()} />
    </View>
  );
}

function createSidebarStyles(colors: ThemeColors, scheme: 'light' | 'dark') {
  const panelBg = panelSurfaceBg(scheme, colors);

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: scrimColor(scheme, 0.45),
    },
    backdropTap: {
      flex: 1,
    },
    panel: {
      width: '88%',
      maxWidth: 400,
      alignSelf: 'stretch',
      backgroundColor: panelBg,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.borderMid,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: scheme === 'dark' ? -4 : -2, height: 0 },
      shadowOpacity: scheme === 'dark' ? 0.35 : 0.1,
      shadowRadius: 16,
      elevation: 10,
    },
    header: {
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    closeBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: spacing.sm,
      minWidth: 0,
    },
    headerSpacer: {
      width: 36,
      height: 36,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      borderColor: colors.electric,
      backgroundColor: colors.bgElevated,
    },
    usernameText: {
      ...typography.bodyStrong,
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
      maxWidth: '100%',
    },
    scroll: {
      flex: 1,
      ...rtlDirection,
    },
    scrollContent: {
      paddingBottom: spacing.lg,
    },
  });
}
