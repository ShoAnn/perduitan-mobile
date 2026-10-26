import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PanelHeader } from '@/components/form/panel-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Height of a standard, medium-sized phone keyboard. */
export const DEFAULT_KEYPAD_HEIGHT = 260;

export type NumericKeypadChange = {
  value: string;
  caret: number;
};

export type NumericKeypadProps = {
  /** Current amount string, for example `12,50`. */
  value: string;
  /** Caret position within `value`; clamped to the value length. */
  caret: number;
  /** Called after a key changes the value or moves the caret. */
  onChange: (change: NumericKeypadChange) => void;
  /** Called when the checkmark key is pressed. */
  onSubmit?: () => void;
  /** Header title, for example `Select amount`; renders a dismiss header when set. */
  title?: string;
  /** Called when the header is pressed to hide the panel. */
  onDismiss?: () => void;
  /** Total keypad height, including padding. */
  height?: number;
  maxIntegerDigits?: number;
  maxDecimals?: number;
  style?: StyleProp<ViewStyle>;
};

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function clampCaret(caret: number, value: string) {
  return Math.min(Math.max(caret, 0), value.length);
}

/** Matches a partially entered amount such as ``, `12`, `12,` or `12,50`. */
function isAmount(value: string, maxIntegerDigits: number, maxDecimals: number) {
  return new RegExp(
    `^(?:\\d{0,${maxIntegerDigits}}|\\d{1,${maxIntegerDigits}},\\d{0,${maxDecimals}})$`
  ).test(value);
}

function insertAt(value: string, caret: number, text: string): NumericKeypadChange {
  return {
    value: value.slice(0, caret) + text + value.slice(caret),
    caret: caret + text.length,
  };
}

/**
 * Collapses redundant leading zeros in the integer part (`007` -> `7`,
 * `00,5` -> `0,5`) while keeping a single `0` in front of the comma.
 */
function normalizeLeadingZeros(value: string, caret: number): NumericKeypadChange {
  const commaIndex = value.indexOf(',');
  const integerPart = commaIndex === -1 ? value : value.slice(0, commaIndex);

  if (!/^0\d/.test(integerPart)) {
    return { value, caret };
  }

  const trimmed = integerPart.replace(/^0+/, '') || '0';
  const removed = integerPart.length - trimmed.length;

  return {
    value: trimmed + value.slice(integerPart.length),
    caret: caret <= removed ? 0 : caret - removed,
  };
}

/**
 * Digit keypad with a caret-aware editing surface.
 *
 * Layout: the 1-9 grid sits top-left, the 0 and caret keys fill the bottom row,
 * and the right column holds backspace, the decimal comma, a spacer and the
 * checkmark key.
 */
export function NumericKeypad({
  value,
  caret,
  onChange,
  onSubmit,
  title,
  onDismiss,
  height = DEFAULT_KEYPAD_HEIGHT,
  maxIntegerDigits = 12,
  maxDecimals = 2,
  style,
}: NumericKeypadProps) {
  const theme = useTheme();
  const position = clampCaret(caret, value);
  const hasComma = value.includes(',');
  const atStart = position === 0;
  const atEnd = position === value.length;

  const commit = (change: NumericKeypadChange) => {
    if (change.value !== value || change.caret !== position) {
      onChange(change);
    }
  };

  const handleDigit = (digit: string) => {
    const inserted = insertAt(value, position, digit);
    const change = normalizeLeadingZeros(inserted.value, inserted.caret);
    if (isAmount(change.value, maxIntegerDigits, maxDecimals)) {
      commit(change);
    }
  };

  const handleComma = () => {
    if (hasComma) {
      return;
    }

    // Keep the value parseable: a leading comma becomes `0,`.
    const change =
      position === 0
        ? { value: `0,${value.slice(value.startsWith('0') ? 1 : 0)}`, caret: 2 }
        : insertAt(value, position, ',');
    if (isAmount(change.value, maxIntegerDigits, maxDecimals)) {
      commit(change);
    }
  };

  const handleBackspace = () => {
    if (atStart) {
      return;
    }

    const deleted = {
      value: value.slice(0, position - 1) + value.slice(position),
      caret: position - 1,
    };
    const change = normalizeLeadingZeros(deleted.value, deleted.caret);
    if (isAmount(change.value, maxIntegerDigits, maxDecimals)) {
      commit(change);
    }
  };

  const moveCaret = (delta: number) => {
    const next = clampCaret(position + delta, value);
    if (next !== position) {
      commit({ value, caret: next });
    }
  };

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
        <View style={styles.grid}>
        <View style={styles.row}>
          {DIGITS.slice(0, 3).map((digit) => (
            <DigitKey key={digit} digit={digit} onPress={handleDigit} />
          ))}
          <Key
            label="⌫"
            accessibilityLabel="Backspace"
            onPress={handleBackspace}
            disabled={atStart}
            variant="secondary"
            glyph
          />
        </View>

        <View style={styles.row}>
          {DIGITS.slice(3, 6).map((digit) => (
            <DigitKey key={digit} digit={digit} onPress={handleDigit} />
          ))}
          <Key
            label=","
            accessibilityLabel="Decimal comma"
            onPress={handleComma}
            disabled={hasComma}
            variant="secondary"
          />
        </View>

        <View style={styles.row}>
          {DIGITS.slice(6, 9).map((digit) => (
            <DigitKey key={digit} digit={digit} onPress={handleDigit} />
          ))}
          <View
            style={styles.key}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>

        <View style={styles.row}>
          <Key
            label="←"
            accessibilityLabel="Move cursor left"
            onPress={() => moveCaret(-1)}
            disabled={atStart}
            variant="secondary"
            glyph
          />
          <DigitKey digit="0" onPress={handleDigit} />
          <Key
            label="→"
            accessibilityLabel="Move cursor right"
            onPress={() => moveCaret(1)}
            disabled={atEnd}
            variant="secondary"
            glyph
          />
          <Key
            label="✓"
            accessibilityLabel="Done"
            onPress={() => onSubmit?.()}
            disabled={!onSubmit}
            variant="primary"
            glyph
          />
        </View>
        </View>
      </View>
    </View>
  );
}

type DigitKeyProps = {
  digit: string;
  onPress: (digit: string) => void;
};

function DigitKey({ digit, onPress }: DigitKeyProps) {
  return (
    <Key
      label={digit}
      accessibilityLabel={digit}
      onPress={() => onPress(digit)}
    />
  );
}

type KeyProps = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  glyph?: boolean;
  variant?: 'default' | 'secondary' | 'primary';
};

function Key({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  glyph = false,
  variant = 'default',
}: KeyProps) {
  const theme = useTheme();

  const color =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'secondary'
        ? theme.textSecondary
        : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="keyboardkey"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.key,
        {
          backgroundColor:
            variant === 'primary' ? theme.accent : theme.backgroundElement,
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <ThemedText
        style={[
          styles.keyLabel,
          glyph && styles.glyphLabel,
          variant === 'primary' && styles.primaryLabel,
          { color },
        ]}>
        {label}
      </ThemedText>
    </Pressable>
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
  grid: {
    flex: 1,
    width: '100%',
    gap: Spacing.two,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  keyLabel: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 600,
  },
  glyphLabel: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 600,
  },
  primaryLabel: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
