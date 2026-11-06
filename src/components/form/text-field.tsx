import { useState, type ComponentRef, type Ref } from 'react';
import { Animated, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
  /** `large` enlarges the input text and field height, e.g. for amount fields. */
  size?: 'default' | 'large';
  /** Override the focus highlight; defaults to tracking real input focus. */
  focused?: boolean;
  /** Fades a highlight border in and out, e.g. after a receipt scan fills the field. */
  glow?: Animated.Value;
  /** Ref to the underlying input, for advancing focus programmatically. */
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({
  label,
  error,
  hint,
  prefix,
  size = 'default',
  multiline,
  focused,
  glow,
  inputRef,
  onFocus,
  onBlur,
  style,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const highlighted = focused ?? isFocused;
  const large = size === 'large';

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>

      <View
        style={[
          styles.inputWrapper,
          large && styles.inputWrapperLarge,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: highlighted ? theme.accent : 'transparent',
          },
          multiline && styles.inputWrapperMultiline,
        ]}>
        {prefix ? (
          <ThemedText
            type={large ? undefined : 'smallBold'}
            themeColor="textSecondary"
            style={large ? styles.prefixLarge : undefined}>
            {prefix}
          </ThemedText>
        ) : null}
        <TextInput
          ref={inputRef}
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.accent}
          multiline={multiline}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            large && styles.inputLarge,
            { color: theme.text },
            multiline && styles.inputMultiline,
            style,
          ]}
          {...rest}
        />
        {glow ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.glowBorder, { borderColor: theme.accent, opacity: glow }]}
          />
        ) : null}
      </View>

      {error ? (
        <ThemedText type="small" style={[styles.helper, { color: theme.negative }]}>
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.helper}>
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
  inputWrapper: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
  },
  inputWrapperLarge: {
    minHeight: 76,
    paddingVertical: Spacing.three,
  },
  prefixLarge: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
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
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: Spacing.two,
  },
  inputLarge: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    paddingVertical: Spacing.one,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  helper: {
    paddingHorizontal: Spacing.one,
  },
});
