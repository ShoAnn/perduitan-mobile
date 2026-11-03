import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { SelectField } from '@/components/form/select-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CategorySelectFieldProps = {
  /** Display text for the selected category, or `null` when empty. */
  value: string | null;
  /** Opens the category option picker. */
  onPress: () => void;
  /** Whether the category option picker is currently open. */
  open?: boolean;
  /** Fades a highlight border in and out, e.g. after a receipt scan fills the field. */
  glow?: Animated.Value;
  /** Navigates to the manage categories screen. */
  onManagePress: () => void;
};

/**
 * Category select field with a trailing edit button that opens the manage
 * categories screen. The button takes one fifth of the row width.
 */
export function CategorySelectField({
  value,
  onPress,
  open,
  glow,
  onManagePress,
}: CategorySelectFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <SelectField
      label={t('forms.category')}
      value={value}
      placeholder={t('pickers.selectCategory')}
      onPress={onPress}
      open={open}
      glow={glow}
      trailing={
        <Pressable
          onPress={onManagePress}
          accessibilityRole="button"
          accessibilityLabel={t('navigation.categories')}
          hitSlop={Spacing.one}
          style={({ pressed }) => [
            styles.manageButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={[styles.glyph, { color: theme.textSecondary }]}>✎</ThemedText>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  manageButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 18,
    lineHeight: 24,
  },
  pressed: {
    opacity: 0.7,
  },
});
