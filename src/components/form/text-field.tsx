import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

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
};

export function TextField({
  label,
  error,
  hint,
  prefix,
  multiline,
  focused,
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
