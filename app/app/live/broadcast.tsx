// app/live/broadcast.tsx — شاشة البث المباشر (المضيف) — معطّلة حتى الإطلاق
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/constants/theme';
import { showLiveBroadcastComingSoonAlert } from '@/lib/liveStreamAccess';

export default function BroadcastScreen() {
  const router = useRouter();

  useEffect(() => {
    showLiveBroadcastComingSoonAlert();
    const timer = setTimeout(() => {
      router.replace('/(tabs)/live' as never);
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.title}>البث المباشر — قريباً</Text>
        <ActivityIndicator size="large" color={colors.liveRed} style={{ marginTop: spacing.lg }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  icon: { fontSize: 48, marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
});
