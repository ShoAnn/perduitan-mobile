import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  NumericKeypad,
  type NumericKeypadChange,
} from '@/components/form/numeric-keypad';
import { OptionPicker } from '@/components/form/option-picker';
import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listAllAccounts } from '@/db/accounts';
import {
  deleteTransaction,
  getTransactionById,
  updateTransaction,
  type TransactionWithNames,
} from '@/db/transactions';
import { useTheme } from '@/hooks/use-theme';
import { useCategories } from '@/stores/categories';
import type { Account } from '@/types/api';
import { categoryLabel } from '@/utils/category-names';
import {
  formatCentsForEditing,
  formatDate,
  formatEditableDate,
  parseAmountToCents,
  parseEditableDate,
  toDateString,
} from '@/utils/transactions';

type ActivePanel = 'amount' | 'account' | 'category' | null;

function accountLabel(account: Account, t: TFunction): string {
  return account.archived_at
    ? `${account.name} ${t('common.archivedSuffix')}`
    : account.name;
}

export default function EditTransactionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const db = useSQLiteContext();

  const parsedId = Number(params.id);
  const transactionId = Number.isFinite(parsedId) ? parsedId : null;

  const categories = useCategories(db);
  const [accounts, setAccounts] = useState<Account[]>([]);
  // `undefined` while loading, `null` when the transaction does not exist.
  const [transaction, setTransaction] = useState<TransactionWithNames | null | undefined>(
    undefined
  );

  const [occurredAt, setOccurredAt] = useState(() => new Date());
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [amountCaret, setAmountCaret] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reload accounts on focus so a newly created account is available when the
  // user comes back from the "Add account" form.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      listAllAccounts(db)
        .then((all) => {
          if (isActive) {
            setAccounts(all);
          }
        })
        .catch((error: unknown) => {
          console.error('Failed to load accounts for the edit form', error);
        });

      return () => {
        isActive = false;
      };
    }, [db])
  );

  useEffect(() => {
    if (transactionId === null) {
      return;
    }

    let isActive = true;

    getTransactionById(db, transactionId)
      .then((result) => {
        if (!isActive) {
          return;
        }

        setTransaction(result);

        if (result) {
          const date = parseEditableDate(result.occurred_on) ?? new Date();
          const editableAmount = formatCentsForEditing(result.amount_cents);
          setOccurredAt(date);
          setAmount(editableAmount);
          setAmountCaret(editableAmount.length);
          setSelectedAccountId(result.account_id);
          setCategoryId(result.category_id);
          setDescription(result.description ?? '');
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load the transaction for editing', error);
        if (isActive) {
          setTransaction(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [db, transactionId]);

  const isIncome = (transaction?.amount_cents ?? 0) > 0;
  const kind = isIncome ? 'income' : 'expense';
  const kindCategories = useMemo(
    () => categories.filter((category) => category.kind === kind),
    [categories, kind]
  );

  const accountId = selectedAccountId ?? accounts[0]?.id ?? null;
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const selectedCategory = categories.find((category) => category.id === categoryId);

  const startEditingDate = () => {
    setActivePanel(null);
    setDateDraft(formatEditableDate(occurredAt));
    setDateError(null);
    setIsEditingDate(true);
  };

  const commitDate = () => {
    const parsed = parseEditableDate(dateDraft);
    if (!parsed) {
      setDateError(t('errors.dateFormat'));
      return;
    }

    setOccurredAt(parsed);
    setDateError(null);
    setIsEditingDate(false);
  };

  const stopEditingDate = () => {
    if (parseEditableDate(dateDraft)) {
      commitDate();
      return;
    }

    setDateDraft('');
    setDateError(null);
    setIsEditingDate(false);
  };

  const handleAmountChange = ({ value, caret }: NumericKeypadChange) => {
    setAmount(value);
    setAmountCaret(caret);
    setAmountError(null);
  };

  const dismissPanel = () => {
    setActivePanel(null);
    Keyboard.dismiss();
  };

  const submitAmount = () => {
    setActivePanel('account');
  };

  const openAccountPicker = () => {
    Keyboard.dismiss();
    setActivePanel('account');
  };

  const openCategoryPicker = () => {
    Keyboard.dismiss();
    setActivePanel('category');
  };

  const handleAccountChange = (value: number | null) => {
    setSelectedAccountId(value);
    setActivePanel('category');
  };

  const handleCategoryChange = (value: number | null) => {
    setCategoryId(value);
    setActivePanel(null);
  };

  const handleAddCategory = () => {
    setActivePanel(null);
    Keyboard.dismiss();
    router.push('/new-category');
  };

  const handleAddAccount = () => {
    setActivePanel(null);
    Keyboard.dismiss();
    router.push('/add-account');
  };

  const handleSave = async () => {
    if (isSaving || isDeleting || !transaction) {
      return;
    }

    let effectiveDate = occurredAt;

    // Commit an in-progress date edit so tapping Save never uses the old date.
    if (isEditingDate) {
      const parsed = parseEditableDate(dateDraft);
      if (!parsed) {
        setDateError(t('errors.dateFormat'));
        return;
      }
      effectiveDate = parsed;
      setOccurredAt(parsed);
      setDateError(null);
      setIsEditingDate(false);
    }

    const amountCents = parseAmountToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setAmountError(t('errors.amountRequired'));
      return;
    }
    if (accountId === null) {
      setSaveError(t('errors.accountRequired'));
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      await updateTransaction(db, transaction.id, {
        account_id: accountId,
        category_id: categoryId,
        amount_cents: isIncome ? Math.abs(amountCents) : -Math.abs(amountCents),
        description: description.trim() || null,
        occurred_on: toDateString(effectiveDate),
      });
    } catch (error) {
      console.error('Failed to update transaction', error);
      setSaveError(t('errors.saveChanges'));
      return;
    } finally {
      setIsSaving(false);
    }

    dismissPanel();

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const confirmDelete = async () => {
    if (!transaction || isDeleting || isSaving) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteTransaction(db, transaction.id);
    } catch (error) {
      console.error('Failed to delete transaction', error);
      setDeleteError(t('errors.deleteTransaction'));
      setIsDeleting(false);
      return;
    }
    setIsDeleting(false);
    setIsConfirmingDelete(false);

    dismissPanel();

    // Replace instead of going back: the details screen underneath
    // (which opened this form) would otherwise show a not-found state.
    router.replace('/');
  };

  const handleDeletePress = () => {
    if (isDeleting || isSaving || !transaction) {
      return;
    }

    dismissPanel();
    setDeleteError(null);

    // Two-tap confirm, matching the account/category delete pattern.
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }

    void confirmDelete();
  };

  if (transactionId === null || transaction === null) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: t('navigation.editTransaction') }} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('transaction.notFound')}
        </ThemedText>
      </ThemedView>
    );
  }

  if (transaction === undefined) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: t('navigation.editTransaction') }} />
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: isIncome ? t('navigation.editIncome') : t('navigation.editExpense'),
          headerRight: () =>
            isConfirmingDelete ? (
              <View style={styles.confirmActions}>
                <Pressable
                  onPress={handleDeletePress}
                  disabled={isDeleting || isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={t('transaction.deleteAccessibility')}
                  accessibilityState={{ disabled: isDeleting || isSaving, busy: isDeleting }}
                  hitSlop={Spacing.two}
                  style={({ pressed }) => [
                    styles.headerButton,
                    (isDeleting || isSaving) && styles.disabled,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.negative }}>
                    {isDeleting ? t('common.deleting') : t('common.confirmDelete')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setIsConfirmingDelete(false)}
                  disabled={isDeleting || isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                  hitSlop={Spacing.two}
                  style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {t('common.cancel')}
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={handleDeletePress}
                disabled={isDeleting || isSaving}
                accessibilityRole="button"
                accessibilityLabel={t('transaction.deleteAccessibility')}
                accessibilityState={{ disabled: isDeleting || isSaving, busy: isDeleting }}
                hitSlop={Spacing.two}
                style={({ pressed }) => [
                  styles.headerButton,
                  (isDeleting || isSaving) && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.negative }}>
                  {t('common.delete')}
                </ThemedText>
              </Pressable>
            ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <View style={styles.form}>
              <View>
                <View style={styles.dateRow}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {t('forms.date')}
                  </ThemedText>

                  {isEditingDate ? (
                    <TextInput
                      value={dateDraft}
                      onChangeText={(value) => {
                        setDateDraft(value);
                        setDateError(null);
                      }}
                      onBlur={stopEditingDate}
                      onSubmitEditing={commitDate}
                      autoFocus
                      selectTextOnFocus
                      returnKeyType="done"
                      accessibilityLabel={t('forms.date')}
                      placeholder={t('placeholders.date')}
                      placeholderTextColor={theme.textSecondary}
                      selectionColor={theme.accent}
                      style={[styles.dateInput, { color: theme.text }]}
                    />
                  ) : (
                    <Pressable
                      onPress={startEditingDate}
                      accessibilityRole="button"
                      accessibilityHint={t('hints.tapToEditDate')}
                      hitSlop={Spacing.two}>
                      <ThemedText>{formatDate(occurredAt)}</ThemedText>
                    </Pressable>
                  )}
                </View>

                {dateError ? (
                  <ThemedText type="small" style={{ color: theme.negative }}>
                    {dateError}
                  </ThemedText>
                ) : null}
              </View>

              <TextField
                label={t('forms.amount')}
                prefix={selectedAccount?.currency}
                value={amount}
                focused={activePanel === 'amount'}
                inputMode="none"
                contextMenuHidden
                caretHidden={activePanel !== 'amount'}
                selection={
                  activePanel === 'amount'
                    ? { start: amountCaret, end: amountCaret }
                    : undefined
                }
                onSelectionChange={(event) => {
                  setAmountCaret(event.nativeEvent.selection.start);
                }}
                onFocus={() => setActivePanel('amount')}
                placeholder={t('placeholders.amount')}
                error={amountError ?? undefined}
              />

              <SelectField
                label={t('forms.account')}
                value={selectedAccount ? accountLabel(selectedAccount, t) : null}
                placeholder={t('pickers.selectAccount')}
                onPress={openAccountPicker}
                open={activePanel === 'account'}
              />

              <SelectField
                label={t('forms.category')}
                value={selectedCategory ? categoryLabel(selectedCategory.name, t) : null}
                placeholder={t('pickers.selectCategory')}
                onPress={openCategoryPicker}
                open={activePanel === 'category'}
              />

              <TextField
                label={t('forms.description')}
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                }}
                onFocus={() => setActivePanel(null)}
                placeholder={
                  isIncome
                    ? t('placeholders.incomeDescription')
                    : t('placeholders.expenseDescription')
                }
                placeholderTextColor={`${theme.textSecondary}B3`}
                multiline
                maxLength={280}
              />

              <Pressable
                onPress={handleSave}
                disabled={isSaving || isDeleting}
                accessibilityRole="button"
                accessibilityLabel={t('buttons.saveChanges')}
                accessibilityState={{ disabled: isSaving || isDeleting, busy: isSaving }}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: theme.text,
                    opacity: isSaving || isDeleting ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {isSaving ? t('common.saving') : t('buttons.saveChanges')}
                </ThemedText>
              </Pressable>

              {isConfirmingDelete ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('transaction.deleteConfirmMessage')}
                </ThemedText>
              ) : null}

              {saveError ? (
                <ThemedText type="small" style={{ color: theme.negative }}>
                  {saveError}
                </ThemedText>
              ) : null}

              {deleteError ? (
                <ThemedText type="small" style={{ color: theme.negative }}>
                  {deleteError}
                </ThemedText>
              ) : null}
            </View>
          </ScrollView>

          {activePanel === 'amount' ? (
            <NumericKeypad
              value={amount}
              caret={amountCaret}
              onChange={handleAmountChange}
              onSubmit={submitAmount}
              title={t('pickers.selectAmount')}
              onDismiss={dismissPanel}
            />
          ) : null}

          {activePanel === 'account' ? (
            <OptionPicker
              options={accounts.map((account) => ({
                value: account.id,
                label: accountLabel(account, t),
              }))}
              value={accountId}
              onChange={handleAccountChange}
              title={t('pickers.selectAccount')}
              onDismiss={dismissPanel}
              onAdd={handleAddAccount}
              addLabel={t('buttons.addAccount')}
              addAccessibilityLabel={t('buttons.addAccount')}
            />
          ) : null}

          {activePanel === 'category' ? (
            <OptionPicker
              options={kindCategories.map((category) => ({
                value: category.id,
                label: categoryLabel(category.name, t),
              }))}
              value={categoryId}
              onChange={handleCategoryChange}
              onAdd={handleAddCategory}
              addLabel={t('buttons.addCategory')}
              addAccessibilityLabel={t('buttons.addCategory')}
              title={t('pickers.selectCategory')}
              onDismiss={dismissPanel}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  scroll: {
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 44,
    paddingVertical: Spacing.two,
  },
  dateInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'right',
    paddingVertical: Spacing.two,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  headerButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  confirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.6,
  },
});
