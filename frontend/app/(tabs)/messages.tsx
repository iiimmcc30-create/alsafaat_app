// Powered by OnSpace.AI
// SAFAT — Messages (hidden tab — use profile or deep links)

import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { colors } from '@/constants/theme';
import { MessagesPanel } from '@/components/feature/MessagesPanel';

export default function MessagesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <MessagesPanel variant="standalone" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDeep },
});
