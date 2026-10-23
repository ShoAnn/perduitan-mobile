import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OptionGroup } from '@/components/form/option-group';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addCategory, hasCategoryName } from '@/stores/categories';
import type { CategoryKind } from '@/types/api';

const KIND_OPTIONS: { value: CategoryKind; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

export default function NewCategoryScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [nameError, setNameError] = useState<string | null>(null);

  const dismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError('Enter a category name.');
      return;
    }
    if (hasCategoryName(trimmedName)) {
      setNameError('A category with this name already exists.');
      return;
    }

    addCategory({ name: trimmedName, kind });

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/add-expense');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <View style={styles.form}>
              <TextField
                label="Name"
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setNameError(null);
                }}
                placeholder="Coffee"
                autoFocus
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                error={nameError ?? undefined}
              />

              <OptionGroup
                label="Kind"
                options={KIND_OPTIONS}
                value={kind}
                onChange={(value) => {
                  if (value !== null) {
                    setKind(value);
                  }
                }}
                hint="Used to group the category on transaction forms."
              />

              <Pressable
                onPress={handleSubmit}
                accessibilityRole="button"
                accessibilityLabel="Add category"
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  Add category
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={dismiss}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  form: {
    width: '100%',
    maxWidth: 520,
    gap: Spacing.four,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
