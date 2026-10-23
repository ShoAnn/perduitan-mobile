import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, ThemeColor } from '@/constants/theme';

type ActionButtonProps = {
  href: Href;
  glyph: string;
  label: string;
  accessibilityLabel: string;
  glyphColor: ThemeColor;
};

export function ActionButton({
  href,
  glyph,
  label,
  accessibilityLabel,
  glyphColor,
}: ActionButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.button}>
        <ThemedText themeColor={glyphColor} style={styles.glyph}>
          {glyph}
        </ThemedText>
        <ThemedText type="smallBold">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    maxWidth: 200,
  },
  pressed: {
    opacity: 0.7,
  },
  button: {
    minHeight: 150,
    flex: 1,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    paddingVertical: Spacing.five,
  },
  glyph: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: 600,
  },
});
