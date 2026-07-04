// Legacy route — redirects to governed butcher application flow.

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { colors, gradients } from '@/constants/theme';

export default function ButcherRegisterRedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/butchers/apply');
  }, [router]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <LoadingState message="جاري التحويل إلى بوابة التسجيل..." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
});
