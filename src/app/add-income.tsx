import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function AddIncomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
        <ThemedView type="backgroundElement" style={styles.glyphCircle}>
          <ThemedText themeColor="positive" style={styles.glyph}>
            +
          </ThemedText>
        </ThemedView>
        <ThemedText type="subtitle">Add income</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.description}>
          Record money coming in. This screen is where the income form will live.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  glyphCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 72,
    lineHeight: 84,
    fontWeight: 600,
  },
  description: {
    textAlign: 'center',
  },
});
