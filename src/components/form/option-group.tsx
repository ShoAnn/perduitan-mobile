import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Option<T> = {
  value: T;
  label: string;
};

type OptionGroupProps<T> = {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  hint?: string;
  onAdd?: () => void;
  addAccessibilityLabel?: string;
};

export function OptionGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  allowNone = false,
  noneLabel = 'None',
  hint,
  onAdd,
  addAccessibilityLabel,
}: OptionGroupProps<T>) {
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>

      <View style={styles.options} accessibilityRole="radiogroup">
        {allowNone ? (
          <Chip
            label={noneLabel}
            selected={value === null}
            onPress={() => onChange(null)}
          />
        ) : null}
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
        {onAdd ? (
          <AddChip
            accessibilityLabel={addAccessibilityLabel ?? `Add ${label.toLowerCase()}`}
            onPress={onAdd}
          />
        ) : null}
      </View>

      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.text : theme.backgroundElement,
          borderColor: selected ? theme.text : theme.backgroundSelected,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.background : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type AddChipProps = {
  accessibilityLabel: string;
  onPress: () => void;
};

function AddChip({ accessibilityLabel, onPress }: AddChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.chip,
        styles.addChip,
        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="small" style={{ color: theme.accent }}>
        +
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: 1,
  },
  addChip: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
