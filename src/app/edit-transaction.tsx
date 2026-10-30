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
  getTransactionById,
  updateTransaction,
  type TransactionWithNames,
} from '@/db/transactions';
import { useTheme } from '@/hooks/use-theme';
import { useCategories } from '@/stores/categories';
import type { Account } from '@/types/api';
import {
  formatCentsForEditing,
  formatDate,
  formatEditableDate,
  parseAmountToCents,
  parseEditableDate,
  toDateString,
} from '@/utils/transactions';

type ActivePanel = 'amount' | 'account' | 'category' | null;

function sentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function accountLabel(account: Account): string {
  return account.archived_at ? `${account.name} (archived)` : account.name;
}

export default function EditTransactionScreen() {
  const theme = useTheme();
  const router = useRouter();
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
      setDateError('Use YYYY-MM-DD, for example 2026-10-23.');
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
    if (isSaving || !transaction) {
      return;
    }

    let effectiveDate = occurredAt;

    // Commit an in-progress date edit so tapping Save never uses the old date.
    if (isEditingDate) {
      const parsed = parseEditableDate(dateDraft);
      if (!parsed) {
        setDateError('Use YYYY-MM-DD, for example 2026-10-23.');
        return;
      }
      effectiveDate = parsed;
      setOccurredAt(parsed);
      setDateError(null);
      setIsEditingDate(false);
    }

    const amountCents = parseAmountToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setAmountError('Enter an amount greater than 0.');
      return;
    }
    if (accountId === null) {
      setSaveError('Select an account before saving.');
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
      setSaveError('Could not save the changes. Please try again.');
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

  if (transactionId === null || transaction === null) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Edit transaction' }} />
        <ThemedText type="small" themeColor="textSecondary">
          This transaction could not be found.
        </ThemedText>
      </ThemedView>
    );
  }

  if (transaction === undefined) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Edit transaction' }} />
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: isIncome ? 'Edit income' : 'Edit expense' }} />
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
                    Date
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
                      accessibilityLabel="Date"
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.textSecondary}
                      selectionColor={theme.accent}
                      style={[styles.dateInput, { color: theme.text }]}
                    />
                  ) : (
                    <Pressable
                      onPress={startEditingDate}
                      accessibilityRole="button"
                      accessibilityHint="Tap to edit the date"
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
                label="Amount"
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
                placeholder="0"
                error={amountError ?? undefined}
              />

              <SelectField
                label="Account"
                value={selectedAccount ? accountLabel(selectedAccount) : null}
                placeholder="Select account"
                onPress={openAccountPicker}
                open={activePanel === 'account'}
              />

              <SelectField
                label="Category"
                value={selectedCategory ? sentenceCase(selectedCategory.name) : null}
                placeholder="Select category"
                onPress={openCategoryPicker}
                open={activePanel === 'category'}
              />

              <TextField
                label="Description"
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                }}
                onFocus={() => setActivePanel(null)}
                placeholder={isIncome ? 'August salary with bonuses included...' : 'Weekly grocery run'}
                placeholderTextColor={`${theme.textSecondary}B3`}
                multiline
                maxLength={280}
              />

              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
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

              {saveError ? (
                <ThemedText type="small" style={{ color: theme.negative }}>
                  {saveError}
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
              title="Select amount"
              onDismiss={dismissPanel}
            />
          ) : null}

          {activePanel === 'account' ? (
            <OptionPicker
              options={accounts.map((account) => ({
                value: account.id,
                label: accountLabel(account),
              }))}
              value={accountId}
              onChange={handleAccountChange}
              title="Select account"
              onDismiss={dismissPanel}
              onAdd={handleAddAccount}
              addLabel="Add account"
              addAccessibilityLabel="Add account"
            />
          ) : null}

          {activePanel === 'category' ? (
            <OptionPicker
              options={kindCategories.map((category) => ({
                value: category.id,
                label: sentenceCase(category.name),
              }))}
              value={categoryId}
              onChange={handleCategoryChange}
              onAdd={handleAddCategory}
              addLabel="Add category"
              addAccessibilityLabel="Add category"
              title="Select category"
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
});
