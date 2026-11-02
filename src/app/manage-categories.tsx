import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
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
import { countTransactionsByCategory } from '@/db/categories';
import { isUniqueConstraintError } from '@/db/errors';
import { useTheme } from '@/hooks/use-theme';
import {
  archiveCategory,
  hasCategoryName,
  updateCategory,
  useCategories,
} from '@/stores/categories';
import type { Category, CategoryKind } from '@/types/api';

const KIND_OPTIONS: { value: CategoryKind; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

function sentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function kindLabel(kind: CategoryKind): string {
  return KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export default function ManageCategoriesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const db = useSQLiteContext();
  const categories = useCategories(db);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === 'expense'),
    [categories]
  );
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.kind === 'income'),
    [categories]
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [isKindPickerOpen, setIsKindPickerOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteCount, setDeleteCount] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeEditor = () => {
    setEditingId(null);
    setNameError(null);
    setIsKindPickerOpen(false);
    Keyboard.dismiss();
  };

  const openEditor = (category: Category) => {
    setConfirmDeleteId(null);
    setDeleteError(null);
    setEditingId(category.id);
    setName(category.name);
    setKind(category.kind);
    setNameError(null);
    setIsKindPickerOpen(false);
  };

  const openKindPicker = () => {
    Keyboard.dismiss();
    setIsKindPickerOpen(true);
  };

  const handleKindChange = (value: CategoryKind | null) => {
    if (value !== null) {
      setKind(value);
    }
    setIsKindPickerOpen(false);
  };

  const handleSave = async () => {
    if (editingId === null || isSaving) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Enter a category name.');
      return;
    }
    if (hasCategoryName(trimmedName, editingId)) {
      setNameError('A category with this name already exists.');
      return;
    }

    setNameError(null);
    setIsSaving(true);
    try {
      await updateCategory(db, editingId, { name: trimmedName, kind });
    } catch (error) {
      setNameError(
        isUniqueConstraintError(error)
          ? 'A category with this name already exists.'
          : 'Could not save the category. Please try again.'
      );
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    closeEditor();
  };

  const handleDeletePress = async (category: Category) => {
    if (deletingId !== null) {
      return;
    }

    if (confirmDeleteId === category.id) {
      setDeletingId(category.id);
      setDeleteError(null);
      try {
        await archiveCategory(db, category.id);
        if (editingId === category.id) {
          closeEditor();
        }
        setConfirmDeleteId(null);
      } catch (error) {
        console.error('Failed to delete category', error);
        setDeleteError('Could not delete the category. Please try again.');
      } finally {
        setDeletingId(null);
      }
      return;
    }

    setDeleteError(null);
    setConfirmDeleteId(category.id);
    try {
      setDeleteCount(await countTransactionsByCategory(db, category.id));
    } catch (error) {
      console.error('Failed to count category transactions', error);
      setDeleteCount(0);
    }
  };

  const renderRow = (category: Category) => {
    const isConfirming = confirmDeleteId === category.id;

    return (
      <View
        key={category.id}
        style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.cardHead}>
          <ThemedText type="smallBold" style={styles.cardName}>
            {sentenceCase(category.name)}
          </ThemedText>

          {isConfirming ? (
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => handleDeletePress(category)}
                disabled={deletingId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Confirm delete ${category.name}`}
                accessibilityState={{ disabled: deletingId !== null, busy: deletingId === category.id }}
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" style={{ color: theme.negative }}>
                  {deletingId === category.id ? 'Deleting…' : 'Delete'}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setConfirmDeleteId(null)}
                disabled={deletingId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Cancel delete ${category.name}`}
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.rowActions}>
              <Pressable
                onPress={() => openEditor(category)}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${category.name}`}
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <ThemedText style={[styles.icon, { color: theme.textSecondary }]}>✎</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleDeletePress(category)}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${category.name}`}
                hitSlop={Spacing.two}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <ThemedText style={[styles.icon, { color: theme.textSecondary }]}>🗑</ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {isConfirming ? (
          <ThemedText type="small" themeColor="textSecondary">
            {deleteCount > 0
              ? `${deleteCount} transaction${deleteCount === 1 ? '' : 's'} will keep this category.`
              : 'No transactions use this category.'}
          </ThemedText>
        ) : null}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <View style={styles.content}>
              {editingId !== null ? (
                <View style={[styles.editor, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">Edit category</ThemedText>

                  <TextField
                    label="Name"
                    value={name}
                    onChangeText={(value) => {
                      setName(value);
                      setNameError(null);
                    }}
                    placeholder="Coffee"
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                    onFocus={() => setIsKindPickerOpen(false)}
                    error={nameError ?? undefined}
                  />

                  <SelectField
                    label="Kind"
                    value={kindLabel(kind)}
                    placeholder="Select kind"
                    onPress={openKindPicker}
                    open={isKindPickerOpen}
                  />

                  <Pressable
                    onPress={handleSave}
                    disabled={isSaving}
                    accessibilityRole="button"
                    accessibilityLabel="Save category"
                    accessibilityState={{ disabled: isSaving, busy: isSaving }}
                    style={({ pressed }) => [
                      styles.saveButton,
                      {
                        backgroundColor: theme.text,
                        opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                      },
                    ]}>
                    <ThemedText type="smallBold" style={{ color: theme.background }}>
                      {isSaving ? 'Saving…' : 'Save changes'}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={closeEditor}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing"
                    hitSlop={Spacing.two}
                    style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Cancel
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}

              {deleteError ? (
                <ThemedText type="small" style={{ color: theme.negative }}>
                  {deleteError}
                </ThemedText>
              ) : null}

              {categories.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No categories yet. Add one below.
                </ThemedText>
              ) : null}

              {expenseCategories.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Expense
                  </ThemedText>
                  {expenseCategories.map(renderRow)}
                </View>
              ) : null}

              {incomeCategories.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Income
                  </ThemedText>
                  {incomeCategories.map(renderRow)}
                </View>
              ) : null}

              <Pressable
                onPress={() => {
                  closeEditor();
                  router.push('/new-category');
                }}
                accessibilityRole="button"
                accessibilityLabel="Add category"
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  + Add category
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
              onDismiss={() => setIsKindPickerOpen(false)}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    gap: Spacing.four,
  },
  editor: {
    gap: Spacing.three,
    borderRadius: Spacing.four,
    padding: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    minHeight: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
    justifyContent: 'center',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardName: {
    flex: 1,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    lineHeight: 24,
  },
  textButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
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
  addButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
