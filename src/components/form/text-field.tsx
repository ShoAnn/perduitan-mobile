import { useState } from 'react';
import { Animated, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
  /** Override the focus highlight; defaults to tracking real input focus. */
  focused?: boolean;
  /** Fades a highlight border in and out, e.g. after a receipt scan fills the field. */
  glow?: Animated.Value;
};

export function TextField({
  label,
  error,
  hint,
  prefix,
  multiline,
  focused,
  glow,
  onFocus,
  onBlur,
  style,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const highlighted = focused ?? isFocused;

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: highlighted ? theme.accent : 'transparent',
          },
          multiline && styles.inputWrapperMultiline,
        ]}>
        {prefix ? (
          <ThemedText type="smallBold" themeColor="textSecondary">
            {prefix}
          </ThemedText>
        ) : null}
        <TextInput
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
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  helper: {
    paddingHorizontal: Spacing.one,
  },
});
