import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
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
import { insertTransaction } from '@/db/transactions';
import { useTheme } from '@/hooks/use-theme';
import { useAccounts } from '@/stores/accounts';
import { useCategories } from '@/stores/categories';
import {
  refreshLastUsedAccountId,
  useLastUsedAccountId,
} from '@/stores/last-used-account';
import {
  formatCentsForEditing,
  formatDate,
  formatEditableDate,
  parseAmountToCents,
  parseEditableDate,
} from '@/utils/transactions';
import { receiptScanUnavailableMessage, scanReceiptFromGallery } from '@/utils/receipt-scan';

type ActivePanel = 'amount' | 'account' | 'category' | null;

function sentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default function AddIncomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    accountId?: string;
    amount?: string;
    occurredOn?: string;
    description?: string;
    categoryName?: string;
    scanned?: string;
  }>();
  const db = useSQLiteContext();

  /** True when the form was prefilled from a receipt scan. */
  const [scanned, setScanned] = useState(params.scanned === '1');

  const accounts = useAccounts(db);
  const categories = useCategories(db);
  const lastUsedAccountId = useLastUsedAccountId(db);
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.kind === 'income'),
    [categories]
  );

  const [occurredAt, setOccurredAt] = useState(
    () => parseEditableDate(params.occurredOn ?? '') ?? new Date()
  );
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  const [amount, setAmount] = useState(() => params.amount ?? '');
  const [amountCaret, setAmountCaret] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(scanned ? null : 'amount');
  const [amountError, setAmountError] = useState<string | null>(null);
  const initialAccountId = (() => {
    const raw = params.accountId;
    if (typeof raw === 'string') {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  })();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(initialAccountId);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState(() => params.description ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const lastUsedAccount =
    lastUsedAccountId !== null && accounts.some((account) => account.id === lastUsedAccountId)
      ? lastUsedAccountId
      : null;
  const accountId = selectedAccountId ?? lastUsedAccount ?? accounts[0]?.id ?? null;
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const selectedCategory = categories.find((category) => category.id === categoryId);

  useEffect(() => {
    if (incomeCategories.length === 0 || categoryId !== null) {
      return;
    }

    // Prefer the category suggested by a receipt scan when it exists.
    if (params.categoryName) {
      const scannedCategory = incomeCategories.find(
        (category) => category.name.toLowerCase() === params.categoryName?.toLowerCase()
      );
      if (scannedCategory) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCategoryId(scannedCategory.id);
        return;
      }
    }

    const salaryCategory = incomeCategories.find(
      (c) => c.name.toLowerCase() === 'salary'
    );
    if (salaryCategory) {
      setCategoryId(salaryCategory.id);
    }
  }, [incomeCategories, categoryId, params.categoryName]);

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

  const handleScanReceipt = async () => {
    if (isScanning) {
      return;
    }

    dismissPanel();
    setScanError(null);
    setScanNotice(null);
    setIsScanning(true);

    try {
      const result = await scanReceiptFromGallery('income');

      if (result.status === 'canceled') {
        return;
      }

      if (result.status === 'unavailable') {
        setScanError(receiptScanUnavailableMessage(result.reason));
        return;
      }

      if (result.status === 'error') {
        setScanError(result.message);
        return;
      }

      const { receipt } = result;

      if (receipt.amountCents !== null) {
        const nextAmount = formatCentsForEditing(receipt.amountCents);
        setAmount(nextAmount);
        setAmountCaret(nextAmount.length);
        setAmountError(null);
      }

      if (receipt.occurredOn) {
        const parsedDate = parseEditableDate(receipt.occurredOn);
        if (parsedDate) {
          setOccurredAt(parsedDate);
          setDateError(null);
          setIsEditingDate(false);
        }
      }

      if (receipt.description) {
        setDescription(receipt.description);
      }

      if (receipt.suggestedCategoryName) {
        const matchedCategory = incomeCategories.find(
          (category) =>
            category.name.toLowerCase() === receipt.suggestedCategoryName?.toLowerCase()
        );
        if (matchedCategory) {
          setCategoryId(matchedCategory.id);
        }
      }

      setScanned(true);

      if (receipt.warnings.length > 0) {
        setScanNotice(receipt.warnings[0]);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    let effectiveDate = occurredAt;
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
      await insertTransaction(db, {
        account_id: accountId,
        category_id: categoryId,
        amount_cents: Math.abs(amountCents),
        description: description.trim() || undefined,
        occurred_on: `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, '0')}-${String(effectiveDate.getDate()).padStart(2, '0')}`,
      });
      await refreshLastUsedAccountId(db).catch((error: unknown) => {
        console.error('Failed to refresh the last used account', error);
      });
    } catch (error) {
      console.error('Failed to save income', error);
      setSaveError('Could not save the income. Please try again.');
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

    dismissPanel();
    // Return to the home screen instead of the screen that opened this form
    // (e.g. add-account), which may still be sitting in a submitting state.
    router.dismissTo('/');
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
            <View style={styles.form}>
              {scanned ? (
                <View
                  style={[styles.scanBanner, { backgroundColor: theme.backgroundElement }]}
                  accessibilityRole="alert">
                  <ThemedText type="smallBold">Filled from a receipt scan</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Check the amount, date, and category before saving.
                  </ThemedText>
                </View>
              ) : null}

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

              <Pressable
                onPress={handleScanReceipt}
                disabled={isScanning}
                accessibilityRole="button"
                accessibilityLabel="Choose a receipt photo"
                accessibilityState={{ disabled: isScanning, busy: isScanning }}
                style={({ pressed }) => [
                  styles.scanButton,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderRadius: Spacing.three,
                    padding: Spacing.three,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.three,
                    minHeight: 52,
                    opacity: isScanning ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText style={{ fontSize: 20 }} themeColor="accent">▣</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">Scan receipt</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {isScanning ? 'Reading receipt…' : 'Fill income from a photo'}
                  </ThemedText>
                </View>
              </Pressable>

              {scanError ? (
                <ThemedText type="small" style={{ color: theme.negative }}>
                  {scanError}
                </ThemedText>
              ) : null}

              {scanNotice ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {scanNotice}
                </ThemedText>
              ) : null}

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
                autoFocus={!scanned}
                error={amountError ?? undefined}
              />

              <SelectField
                label="Account"
                value={selectedAccount?.name ?? null}
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
                placeholder="August salary with bonuses included..."
                placeholderTextColor={`${theme.textSecondary}B3`}
                multiline
                maxLength={280}
              />

              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save income"
                accessibilityState={{ disabled: isSaving, busy: isSaving }}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: theme.text,
                    opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {isSaving ? 'Saving…' : 'Save income'}
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
                label: account.name,
              }))}
              value={accountId}
              onChange={handleAccountChange}
              onAdd={handleAddAccount}
              addLabel="Add account"
              addAccessibilityLabel="Add account"
              title="Select account"
              onDismiss={dismissPanel}
            />
          ) : null}

          {activePanel === 'category' ? (
            <OptionPicker
              options={[
                ...incomeCategories
                  .filter((c) => c.name.toLowerCase() === 'salary')
                  .map((category) => ({
                    value: category.id,
                    label: sentenceCase(category.name),
                  })),
                ...incomeCategories
                  .filter((c) => c.name.toLowerCase() !== 'salary')
                  .map((category) => ({
                    value: category.id,
                    label: sentenceCase(category.name),
                  })),
              ]}
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
  scanBanner: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
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
  scanButton: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
  },
});
