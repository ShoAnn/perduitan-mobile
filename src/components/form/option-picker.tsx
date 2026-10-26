import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PanelHeader } from '@/components/form/panel-header';
import { ThemedText } from '@/components/themed-text';
import { DEFAULT_KEYPAD_HEIGHT } from '@/components/form/numeric-keypad';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PickerOption<T> = {
  value: T;
  label: string;
};

type OptionPickerProps<T extends string | number> = {
  options: PickerOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  /** Optional trailing action row, for example "Add category". */
  onAdd?: () => void;
  addLabel?: string;
  addAccessibilityLabel?: string;
  /** Header title, for example `Select category`; renders a dismiss header when set. */
  title?: string;
  /** Called when the header is pressed to hide the panel. */
  onDismiss?: () => void;
  /** Total panel height; defaults to the numeric keypad height. */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Number of option rows visible before the list scrolls. */
const VISIBLE_ITEMS = 4;

/** Header row height plus the gap between the header and the list. */
const HEADER_SPACE = 32 + Spacing.two;

/** Row height that fits exactly `VISIBLE_ITEMS` rows inside the panel. */
function rowHeightFor(height: number, hasHeader: boolean) {
  const chrome =
    Spacing.two * 2 +
    (hasHeader ? HEADER_SPACE : 0) +
    Spacing.two * (VISIBLE_ITEMS - 1);
  return Math.max((height - chrome) / VISIBLE_ITEMS, 40);
}

/**
 * Bottom panel that mirrors the numeric keypad: a scrollable, full-width list
 * of options shown while a select field is active. The scroll indicator only
 * appears once the list has more rows than fit on screen.
 */
export function OptionPicker<T extends string | number>({
  options,
  value,
  onChange,
  allowNone = false,
  noneLabel = 'None',
  onAdd,
  addLabel = 'Add',
  addAccessibilityLabel,
  title,
  onDismiss,
  height = DEFAULT_KEYPAD_HEIGHT,
  style,
}: OptionPickerProps<T>) {
  const theme = useTheme();
  const hasHeader = Boolean(title);
  const rowHeight = rowHeightFor(height, hasHeader);

  const rows: PickerOption<T | null>[] = allowNone
    ? [{ value: null, label: noneLabel }, ...options]
    : options;
  const showsScrollIndicator = rows.length + (onAdd ? 1 : 0) > VISIBLE_ITEMS;

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor: theme.backgroundSelected,
        },
        style,
      ]}>
      <View style={styles.content}>
        {title ? <PanelHeader title={title} onDismiss={onDismiss} /> : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={showsScrollIndicator}
          persistentScrollbar={showsScrollIndicator}
          keyboardShouldPersistTaps="handled">
          {rows.map((option) => {
            const selected = option.value === value;

            return (
              <Pressable
                key={String(option.value)}
                onPress={() => onChange(option.value)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected }}
                style={({ pressed }) => [
                  styles.option,
                  { height: rowHeight },
                  {
                    backgroundColor: selected ? theme.text : theme.backgroundElement,
                    borderColor: selected ? theme.text : theme.backgroundSelected,
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="smallBold"
                  style={[styles.optionLabel, { color: selected ? theme.background : theme.text }]}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}

          {onAdd ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={addAccessibilityLabel ?? addLabel}
              onPress={onAdd}
              style={({ pressed }) => [
                styles.option,
                { height: rowHeight },
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={[styles.optionLabel, { color: theme.accent }]}>
                + {addLabel}
              </ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.two,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: Spacing.two,
  },
  scroll: {
    flex: 1,
  },
  list: {
    gap: Spacing.two,
  },
  option: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  optionLabel: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
