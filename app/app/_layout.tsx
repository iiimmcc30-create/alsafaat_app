// Powered by OnSpace.AI
// SAFAT — Root Layout

import React, { useCallback, useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { NotificationManager } from '@/components/NotificationManager';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ActionSheetHost } from '@/components/ui/ActionSheetHost';
import { useFlaticonFonts } from '@/hooks/useFlaticonFonts';
import { setupRtl, rtlDirection } from '@/lib/rtl';

setupRtl();

SplashScreen.preventAutoHideAsync().catch(() => {});

WebBrowser.maybeCompleteAuthSession();

export const unstable_settings = {
  initialRouteName: 'index',
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    if (segments[0] === 'expo-auth-session') return;

    const inAuthGroup = segments[0] === 'auth';
    const inPublicInfo = segments[0] === 'info';

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)' as any);
      return;
    }

    if (!isAuthenticated && !inAuthGroup && !inPublicInfo) {
      router.replace('/auth/phone' as any);
    }
  }, [isAuthenticated, isLoading, segments, router]);

  return <>{children}</>;
}

function RootNavigator() {
  const { scheme, isDark, colors: themeColors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        key={scheme}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: themeColors.bgDeep, ...rtlDirection },
          animation: 'slide_from_left',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="(butcher)" options={{ animation: 'none' }} />
        <Stack.Screen name="butchers" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="users/[id]" />
        <Stack.Screen name="sidebar" options={{ animation: 'slide_from_right', presentation: 'transparentModal' }} />
        <Stack.Screen name="notifications/index" />
        <Stack.Screen name="subscription" />
        <Stack.Screen name="payment" />
        <Stack.Screen name="fees" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="profile/connections" />
        <Stack.Screen name="create/listing" />
        <Stack.Screen name="create/post" />
        <Stack.Screen name="create/story" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="info/about" />
        <Stack.Screen name="info/privacy" />
        <Stack.Screen name="info/terms" />
        <Stack.Screen name="info/contact" />
        <Stack.Screen name="info/refund" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/info" />
        <Stack.Screen name="settings/support" />
        <Stack.Screen name="auth/phone" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/otp" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="auth/register" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="auth/forgot-password" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="expo-auth-session" options={{ animation: 'none', headerShown: false }} />
        <Stack.Screen name="live/create" />
        <Stack.Screen name="live/broadcast" />
        <Stack.Screen name="live/watch/[id]" />
      </Stack>
    </>
  );
}

function RootLayoutBody() {
  useFlaticonFonts();

  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(hideSplash, 2500);
    return () => clearTimeout(timer);
  }, [hideSplash]);

  return (
    <View style={styles.rtlRoot} onLayout={hideSplash}>
      <AuthProvider>
        <AppProvider>
          <AuthGuard>
            <NotificationManager />
            <SubscriptionProvider>
              <RootNavigator />
              <ActionSheetHost />
            </SubscriptionProvider>
          </AuthGuard>
        </AppProvider>
      </AuthProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <View style={styles.rtlRoot}>
      <ThemeProvider>
        <RootLayoutBody />
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  rtlRoot: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    ...rtlDirection,
  },
});
