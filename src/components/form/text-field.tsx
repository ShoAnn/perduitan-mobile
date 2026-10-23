import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
};

export function TextField({
  label,
  error,
  hint,
  prefix,
  multiline,
  style,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>

      <View
        style={[
          styles.inputWrapper,
          { backgroundColor: theme.backgroundElement },
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
