import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OptionPicker } from '@/components/form/option-picker';
import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isUniqueConstraintError } from '@/db/errors';
import { useTheme } from '@/hooks/use-theme';
import { addCategory, hasCategoryName, useCategories } from '@/stores/categories';
import type { CategoryKind } from '@/types/api';

const KIND_OPTIONS: { value: CategoryKind; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

export default function NewCategoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const db = useSQLiteContext();

  // Warm the cache so `hasCategoryName` can check duplicates while typing.
  useCategories(db);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [isKindPickerOpen, setIsKindPickerOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const dismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const openKindPicker = () => {
    Keyboard.dismiss();
    setIsKindPickerOpen(true);
  };

  const closeKindPicker = () => {
    setIsKindPickerOpen(false);
  };

  const handleKindChange = (value: CategoryKind | null) => {
    if (value !== null) {
      setKind(value);
    }
    closeKindPicker();
  };

  const handleSubmit = async () => {
    setIsKindPickerOpen(false);
    if (isSaving) {
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError('Enter a category name.');
      return;
    }
    if (hasCategoryName(trimmedName)) {
      setNameError('A category with this name already exists.');
      return;
    }

    setIsSaving(true);
    try {
      await addCategory(db, { name: trimmedName, kind });
    } catch (error) {
      setNameError(
        isUniqueConstraintError(error)
          ? 'A category with this name already exists.'
          : 'Could not save the category. Please try again.'
      );
      return;
    } finally {
      setIsSaving(false);
    }

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
                onFocus={() => setIsKindPickerOpen(false)}
                error={nameError ?? undefined}
              />

              <SelectField
                label="Kind"
                value={kind}
                placeholder="Select kind"
                onPress={openKindPicker}
                open={isKindPickerOpen}
                hint="Used to group the category on transaction forms."
              />

              <Pressable
                onPress={handleSubmit}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Add category"
                accessibilityState={{ disabled: isSaving, busy: isSaving }}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: theme.text,
                    opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {isSaving ? 'Adding…' : 'Add category'}
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

          {isKindPickerOpen ? (
            <OptionPicker
              options={KIND_OPTIONS}
              value={kind}
              onChange={handleKindChange}
              title="Select kind"
              onDismiss={closeKindPicker}
            />
          ) : null}
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
