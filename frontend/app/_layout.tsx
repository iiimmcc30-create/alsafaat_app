// Powered by OnSpace.AI
// SAFAT — Root Layout

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { colors } from '@/constants/theme';
import { setupRtl, rtlDirection } from '@/lib/rtl';

setupRtl();

WebBrowser.maybeCompleteAuthSession();

// ── Auth Guard ────────────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, activeMode } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    // Let expo-auth-session finish the OAuth redirect without auth-guard interference.
    if (segments[0] === 'expo-auth-session') return;

    const inAuthGroup = segments[0] === 'auth';
    const inInfoGroup = segments[0] === 'info';

    if (!isAuthenticated && !inAuthGroup && !inInfoGroup) {
      // Not logged in → send to login
      router.replace('/auth/phone' as any);
    } else if (isAuthenticated) {
      if (inAuthGroup) {
        // Already logged in → send to correct app tab layout
        if (activeMode === 'BUTCHER') {
          router.replace('/(butcher)' as any);
        } else {
          router.replace('/(tabs)' as any);
        }
      } else {
        // If they are in the wrong group layout, redirect them instantly
        const inButcherGroup = segments[0] === '(butcher)';
        const inTabsGroup = segments[0] === '(tabs)';

        if (activeMode === 'BUTCHER' && inTabsGroup) {
          router.replace('/(butcher)' as any);
        } else if (activeMode === 'USER' && inButcherGroup) {
          router.replace('/(tabs)' as any);
        }
      }
    }
  }, [isAuthenticated, isLoading, segments, activeMode]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <View style={styles.rtlRoot}>
    <AuthProvider>
    <AppProvider>
      <AuthGuard>
      <SubscriptionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bgDeep, ...rtlDirection },
            animation: 'slide_from_left',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="(butcher)" options={{ animation: 'none' }} />
          <Stack.Screen name="butchers" />
          <Stack.Screen name="listing/[id]" />
          <Stack.Screen name="search" />
          <Stack.Screen name="sidebar" options={{ animation: 'slide_from_right', presentation: 'transparentModal' }} />
          <Stack.Screen name="subscription" />
          <Stack.Screen name="payment" />
          <Stack.Screen name="fees" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="create/listing" />
          <Stack.Screen name="create/post" />
          <Stack.Screen name="create/story" options={{ animation: 'slide_from_left' }} />
          <Stack.Screen name="info/about" />
          <Stack.Screen name="info/privacy" />
          <Stack.Screen name="info/terms" />
          <Stack.Screen name="info/contact" />
          <Stack.Screen name="auth/phone" options={{ animation: 'fade' }} />
          <Stack.Screen name="auth/otp" options={{ animation: 'slide_from_left' }} />
          <Stack.Screen name="auth/register" options={{ animation: 'slide_from_left' }} />
          <Stack.Screen name="auth/forgot-password" options={{ animation: 'slide_from_left' }} />
          <Stack.Screen name="expo-auth-session" options={{ animation: 'none', headerShown: false }} />
          <Stack.Screen name="live/create" />
          <Stack.Screen name="live/broadcast" />
          <Stack.Screen name="live/watch/[id]" />
        </Stack>
      </SubscriptionProvider>
      </AuthGuard>
    </AppProvider>
    </AuthProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  rtlRoot: {
    flex: 1,
    ...rtlDirection,
  },
});
