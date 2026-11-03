import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const KIND_OPTIONS: { value: CategoryKind }[] = [
  { value: 'expense' },
  { value: 'income' },
];

export default function NewCategoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const db = useSQLiteContext();

  const kindOptions = KIND_OPTIONS.map((option) => ({
    value: option.value,
    label: t(`kinds.${option.value}`),
  }));

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
      setNameError(t('errors.categoryNameRequired'));
      return;
    }
    if (hasCategoryName(trimmedName)) {
      setNameError(t('errors.categoryExists'));
      return;
    }

    setIsSaving(true);
    try {
      await addCategory(db, { name: trimmedName, kind });
    } catch (error) {
      setNameError(
        isUniqueConstraintError(error)
          ? t('errors.categoryExists')
          : t('errors.saveCategory')
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
                label={t('forms.name')}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setNameError(null);
                }}
                placeholder={t('placeholders.categoryName')}
                autoFocus
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                onFocus={() => setIsKindPickerOpen(false)}
                error={nameError ?? undefined}
              />

              <SelectField
                label={t('forms.kind')}
                value={kindOptions.find((o) => o.value === kind)?.label ?? null}
                placeholder={t('pickers.selectKind')}
                onPress={openKindPicker}
                open={isKindPickerOpen}
                hint={t('hints.kind')}
              />

              <Pressable
                onPress={handleSubmit}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel={t('buttons.addCategory')}
                accessibilityState={{ disabled: isSaving, busy: isSaving }}
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: theme.text,
                    opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {isSaving ? t('common.adding') : t('buttons.addCategory')}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={dismiss}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>

          {isKindPickerOpen ? (
            <OptionPicker
              options={kindOptions}
              value={kind}
              onChange={handleKindChange}
              title={t('pickers.selectKind')}
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
