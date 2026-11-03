import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

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
  /** Fades a highlight border in and out, e.g. after a receipt scan fills the field. */
  glow?: Animated.Value;
  hint?: string;
  /** Optional control rendered to the right of the input, sharing its row. */
  trailing?: ReactNode;
};

/** A read-only select input: one centered block with a chevron on the right. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  open = false,
  glow,
  hint,
  trailing,
}: SelectFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('common.selectOption');
  const hasValue = value != null && value.trim().length > 0;

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>

      <View style={styles.row}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${hasValue ? value : resolvedPlaceholder}`}
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
              {hasValue ? value : resolvedPlaceholder}
            </ThemedText>
          </View>
          <ThemedText style={[styles.chevron, { color: theme.textSecondary }]}>▾</ThemedText>
          {glow ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.glowBorder, { borderColor: theme.accent, opacity: glow }]}
            />
          ) : null}
        </Pressable>

        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>

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
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  trigger: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  glowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  trailing: {
    width: '20%',
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
