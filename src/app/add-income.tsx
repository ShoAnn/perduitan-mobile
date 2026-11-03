import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategorySelectField } from '@/components/form/category-select-field';
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
import { categoryLabel } from '@/utils/category-names';
import { receiptScanUnavailableKey, scanReceiptFromGallery } from '@/utils/receipt-scan';

type ActivePanel = 'amount' | 'account' | 'category' | 'description' | null;

export default function AddIncomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
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
  /** Fades the fields a scan fills in and out of a highlight. */
  const [scanGlow] = useState(() => new Animated.Value(params.scanned === '1' ? 1 : 0));

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
  const descriptionInputRef = useRef<ComponentRef<typeof TextInput>>(null);
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

  // Drop a selection whose category was archived from the manage screen, so a
  // stale id can never be submitted.
  useEffect(() => {
    if (categoryId === null) {
      return;
    }
    if (!categories.some((category) => category.id === categoryId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryId(null);
    }
  }, [categories, categoryId]);

  // Advance focus into the description once a category is picked.
  useEffect(() => {
    if (activePanel === 'description') {
      descriptionInputRef.current?.focus();
    }
  }, [activePanel]);

  /** Fades a scan highlight in, holds briefly, then fades it out. */
  const playScanGlow = () => {
    scanGlow.stopAnimation();
    scanGlow.setValue(0);
    Animated.sequence([
      Animated.timing(scanGlow, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(250),
      Animated.timing(scanGlow, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Fade out the highlight that starts on mount for a scan-prefilled form.
  useEffect(() => {
    if (params.scanned !== '1') {
      return;
    }

    Animated.sequence([
      Animated.delay(300),
      Animated.timing(scanGlow, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [params.scanned, scanGlow]);

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
    // Release the amount input first, otherwise it keeps focus while its
    // keypad is hidden and tapping it no longer reopens the keypad.
    Keyboard.dismiss();
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
    // Advance focus to the description input.
    setActivePanel('description');
  };

  const handleAddCategory = () => {
    setActivePanel(null);
    Keyboard.dismiss();
    router.push('/new-category');
  };

  const handleManageCategories = () => {
    setActivePanel(null);
    Keyboard.dismiss();
    router.push('/manage-categories');
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
        setScanError(t(receiptScanUnavailableKey(result.reason)));
        return;
      }

      if (result.status === 'error') {
        setScanError(t(result.messageKey));
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
      playScanGlow();

      if (receipt.warnings.length > 0) {
        setScanNotice(t(receipt.warnings[0]));
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
      setSaveError(t('errors.saveIncome'));
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
              <View>
                <View style={styles.dateRow}>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.dateGlow, { borderColor: theme.accent, opacity: scanGlow }]}
                  />
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

              <Pressable
                onPress={handleScanReceipt}
                disabled={isScanning}
                accessibilityRole="button"
                accessibilityLabel={t('scan.chooseAccessibility')}
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
                  <ThemedText type="smallBold">{t('scan.scanReceipt')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {isScanning ? t('scan.readingReceipt') : t('scan.fillIncome')}
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
                label={t('forms.amount')}
                prefix={selectedAccount?.currency}
                value={amount}
                focused={activePanel === 'amount'}
                glow={scanGlow}
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
                autoFocus={!scanned}
                error={amountError ?? undefined}
              />

              <SelectField
                label={t('forms.account')}
                value={selectedAccount?.name ?? null}
                placeholder={t('pickers.selectAccount')}
                onPress={openAccountPicker}
                open={activePanel === 'account'}
              />

              <CategorySelectField
                value={selectedCategory ? categoryLabel(selectedCategory.name, t) : null}
                onPress={openCategoryPicker}
                open={activePanel === 'category'}
                glow={scanGlow}
                onManagePress={handleManageCategories}
              />

              <TextField
                label={t('forms.description')}
                inputRef={descriptionInputRef}
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                }}
                onFocus={() => setActivePanel(null)}
                glow={scanGlow}
                placeholder={t('placeholders.incomeDescription')}
                placeholderTextColor={`${theme.textSecondary}B3`}
                multiline
                maxLength={280}
              />

              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel={t('buttons.saveIncome')}
                accessibilityState={{ disabled: isSaving, busy: isSaving }}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: theme.text,
                    opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {isSaving ? t('common.saving') : t('buttons.saveIncome')}
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
              title={t('pickers.selectAmount')}
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
              addLabel={t('buttons.addAccount')}
              addAccessibilityLabel={t('buttons.addAccount')}
              title={t('pickers.selectAccount')}
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
                    label: categoryLabel(category.name, t),
                  })),
                ...incomeCategories
                  .filter((c) => c.name.toLowerCase() !== 'salary')
                  .map((category) => ({
                    value: category.id,
                    label: categoryLabel(category.name, t),
                  })),
              ]}
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
  dateGlow: {
    position: 'absolute',
    top: -Spacing.one,
    left: -Spacing.one,
    right: -Spacing.one,
    bottom: -Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.three,
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
