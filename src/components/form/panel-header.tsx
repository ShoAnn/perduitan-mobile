import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PanelHeaderProps = {
  title: string;
  /** Called when the header is pressed to hide the panel. */
  onDismiss?: () => void;
};

/**
 * Small header row shared by the bottom panels: the panel title centered
 * between two collapse chevrons. Tapping it hides the panel.
 */
export function PanelHeader({ title, onDismiss }: PanelHeaderProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Tap to hide"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <ThemedText style={[styles.glyph, { color: theme.textSecondary }]}>▾</ThemedText>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText style={[styles.glyph, { color: theme.textSecondary }]}>▾</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  glyph: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.7,
  },
});
