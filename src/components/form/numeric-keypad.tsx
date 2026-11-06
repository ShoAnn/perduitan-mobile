import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PanelHeader } from '@/components/form/panel-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAmountWithSeparators } from '@/utils/transactions';

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

/** Matches a partially entered amount such as ``, `12`, `12,` or `12,50` (raw, ungrouped). */
function isRawAmount(value: string, maxIntegerDigits: number, maxDecimals: number) {
  return new RegExp(
    `^(?:\\d{0,${maxIntegerDigits}}|\\d{1,${maxIntegerDigits}},\\d{0,${maxDecimals}})$`
  ).test(value);
}

function toRawValue(value: string): string {
  return value.replace(/\./g, '');
}

/** Counts digits in the grouped value before `caret`; separators are skipped. */
function toRawCaret(value: string, caret: number): number {
  return value.slice(0, caret).replace(/\./g, '').length;
}

/** Maps a raw caret (index in the ungrouped string) back to a grouped index. */
function toGroupedCaret(grouped: string, rawCaret: number): number {
  if (rawCaret <= 0) {
    return 0;
  }

  let rawCount = 0;
  for (let i = 0; i < grouped.length; i++) {
    if (grouped[i] !== '.') {
      rawCount++;
    }
    if (rawCount === rawCaret) {
      // Land right after the character; step past a following separator so
      // the caret never sits on a thousands dot.
      return grouped[i + 1] === '.' ? i + 2 : i + 1;
    }
  }

  return grouped.length;
}

/** Groups a raw amount and maps the raw caret into the grouped string. */
function toGroupedChange(rawValue: string, rawCaret: number): NumericKeypadChange {
  const grouped = formatAmountWithSeparators(rawValue);
  return { value: grouped, caret: toGroupedCaret(grouped, rawCaret) };
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
  const { t } = useTranslation();
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
    const rawValue = toRawValue(value);
    const rawCaret = toRawCaret(value, position);
    const inserted = {
      value: rawValue.slice(0, rawCaret) + digit + rawValue.slice(rawCaret),
      caret: rawCaret + digit.length,
    };
    const change = normalizeLeadingZeros(inserted.value, inserted.caret);
    if (isRawAmount(change.value, maxIntegerDigits, maxDecimals)) {
      commit(toGroupedChange(change.value, change.caret));
    }
  };

  const handleComma = () => {
    if (hasComma) {
      return;
    }

    // Keep the value parseable: a leading comma becomes `0,`.
    const rawValue = toRawValue(value);
    const rawCaret = toRawCaret(value, position);
    const change =
      rawCaret === 0
        ? {
            value: `0,${rawValue.startsWith('0') ? rawValue.slice(1) : rawValue}`,
            caret: 2,
          }
        : {
            value: rawValue.slice(0, rawCaret) + ',' + rawValue.slice(rawCaret),
            caret: rawCaret + 1,
          };
    if (isRawAmount(change.value, maxIntegerDigits, maxDecimals)) {
      commit(toGroupedChange(change.value, change.caret));
    }
  };

  const handleBackspace = () => {
    if (atStart) {
      return;
    }

    const rawValue = toRawValue(value);
    const rawCaret = toRawCaret(value, position);
    if (rawCaret === 0) {
      return;
    }

    const deleted = {
      value: rawValue.slice(0, rawCaret - 1) + rawValue.slice(rawCaret),
      caret: rawCaret - 1,
    };
    const change = normalizeLeadingZeros(deleted.value, deleted.caret);
    if (isRawAmount(change.value, maxIntegerDigits, maxDecimals)) {
      commit(toGroupedChange(change.value, change.caret));
    }
  };

  const moveCaret = (delta: number) => {
    const rawCaret = toRawCaret(value, position);
    const nextRawCaret = Math.min(Math.max(rawCaret + delta, 0), toRawValue(value).length);
    const grouped = formatAmountWithSeparators(toRawValue(value));
    const next = toGroupedCaret(grouped, nextRawCaret);
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
            accessibilityLabel={t('keypad.backspace')}
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
            accessibilityLabel={t('keypad.decimalComma')}
            onPress={handleComma}
            disabled={hasComma}
            variant="secondary"
          />
        </View>

        <View style={styles.row}>
          {DIGITS.slice(6, 9).map((digit) => (
            <DigitKey key={digit} digit={digit} onPress={handleDigit} />
          ))}
          <DigitKey digit="000" onPress={handleDigit} />
        </View>

        <View style={styles.row}>
          <Key
            label="←"
            accessibilityLabel={t('keypad.moveCursorLeft')}
            onPress={() => moveCaret(-1)}
            disabled={atStart}
            variant="secondary"
            glyph
          />
          <DigitKey digit="0" onPress={handleDigit} />
          <Key
            label="→"
            accessibilityLabel={t('keypad.moveCursorRight')}
            onPress={() => moveCaret(1)}
            disabled={atEnd}
            variant="secondary"
            glyph
          />
          <Key
            label="✓"
            accessibilityLabel={t('keypad.done')}
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
