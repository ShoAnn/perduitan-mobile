import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SelectFieldProps = {
  label: string;
  /** Display text for the currently selected option, or `null` when empty. */
  value: string | null;
  placeholder?: string;
  /** Called when the field is tapped; the parent shows the option picker. */
  onPress: () => void;
  /** Whether the option picker for this field is currently open. */
  open?: boolean;
  hint?: string;
};

/** A read-only select input: one centered block with a chevron on the right. */
export function SelectField({
  label,
  value,
  placeholder = 'Select an option',
  onPress,
  open = false,
  hint,
}: SelectFieldProps) {
  const theme = useTheme();
  const hasValue = value != null && value.trim().length > 0;

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${hasValue ? value : placeholder}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: open ? theme.accent : 'transparent',
          },
          pressed && styles.pressed,
        ]}>
        <View style={styles.valueRow}>
          <ThemedText
            style={[styles.value, { color: hasValue ? theme.text : theme.textSecondary }]}>
            {hasValue ? value : placeholder}
          </ThemedText>
        </View>
        <ThemedText style={[styles.chevron, { color: theme.textSecondary }]}>▾</ThemedText>
      </Pressable>

      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  trigger: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  valueRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    textAlign: 'center',
  },
  chevron: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 600,
    marginLeft: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
