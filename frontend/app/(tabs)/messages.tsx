// Powered by OnSpace.AI
// SAFAT — Messages (hidden tab — use profile or deep links)

import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { MessagesPanel } from '@/components/feature/MessagesPanel';

export default function MessagesScreen() {
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <MessagesPanel variant="standalone" />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDeep },
  });
}
