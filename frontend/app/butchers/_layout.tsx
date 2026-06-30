// Powered by OnSpace.AI
// SAFAT — Butchers Section Layout

import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import { rtlDirection } from '@/lib/rtl';

export default function ButchersLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgDeep, ...rtlDirection },
        animation: 'slide_from_left',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="order" />
      <Stack.Screen name="order-success" options={{ animation: 'fade' }} />
      <Stack.Screen name="chat" />
      <Stack.Screen name="register" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="manage" />
      <Stack.Screen name="map" />
      <Stack.Screen
        name="story-viewer"
        options={{ animation: 'fade', presentation: 'transparentModal' }}
      />
    </Stack>
  );
}
