import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  NumericKeypad,
  type NumericKeypadChange,
} from '@/components/form/numeric-keypad';
import { OptionGroup } from '@/components/form/option-group';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SAMPLE_ACCOUNTS } from '@/constants/sample-data';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCategories } from '@/stores/categories';
import type { TransactionCreate } from '@/types/api';
import {
  buildExpensePayload,
  formatDate,
  formatEditableDate,
  parseAmountToCents,
  parseEditableDate,
} from '@/utils/transactions';

export default function AddExpenseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollViewInstance>(null);

  const categories = useCategories();
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === 'expense'),
    [categories]
  );
  const [occurredAt, setOccurredAt] = useState(() => new Date());
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [amountCaret, setAmountCaret] = useState(0);
  const [isKeypadOpen, setIsKeypadOpen] = useState(true);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<number | null>(SAMPLE_ACCOUNTS[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<TransactionCreate | null>(null);

  const selectedAccount = SAMPLE_ACCOUNTS.find((account) => account.id === accountId);

  const clearPreview = () => setPreview(null);

  const startEditingDate = () => {
    setIsKeypadOpen(false);
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
    clearPreview();
  };

  const stopEditingDate = () => {
    if (parseEditableDate(dateDraft)) {
      commitDate();
      return;
    }

    // Discard an invalid draft instead of trapping the user in the field.
    setDateDraft('');
    setDateError(null);
    setIsEditingDate(false);
  };

  const handleAmountChange = ({ value, caret }: NumericKeypadChange) => {
    setAmount(value);
    setAmountCaret(caret);
    setAmountError(null);
    clearPreview();
  };

  const dismissAmountEditor = () => {
    setIsKeypadOpen(false);
    Keyboard.dismiss();
  };

  const handleSave = () => {
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
      return;
    }

    setPreview(
      buildExpensePayload({
        accountId,
        categoryId,
        amountCents,
        description,
        occurredOn: effectiveDate,
      })
    );
    dismissAmountEditor();

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
          <ScrollView
            ref={scrollRef}
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
                inputMode="none"
                contextMenuHidden
                caretHidden={!isKeypadOpen}
                selection={isKeypadOpen ? { start: amountCaret, end: amountCaret } : undefined}
                onSelectionChange={(event) => {
                  setAmountCaret(event.nativeEvent.selection.start);
                }}
                onFocus={() => setIsKeypadOpen(true)}
                placeholder="0"
                autoFocus
                error={amountError ?? undefined}
              />

              <OptionGroup
                label="Account"
                options={SAMPLE_ACCOUNTS.map((account) => ({
                  value: account.id,
                  label: account.name,
                }))}
                value={accountId}
                onChange={(value) => {
                  setAccountId(value);
                  clearPreview();
                }}
              />

              <OptionGroup
                label="Category"
                options={expenseCategories.map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
                value={categoryId}
                onChange={(value) => {
                  setCategoryId(value);
                  clearPreview();
                }}
                allowNone
                onAdd={() => router.push('/new-category')}
                addAccessibilityLabel="Add category"
              />

              <TextField
                label="Description"
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                  clearPreview();
                }}
                onFocus={() => setIsKeypadOpen(false)}
                placeholder="Weekly grocery run"
                multiline
                maxLength={280}
              />

              <Pressable
                onPress={handleSave}
                accessibilityRole="button"
                accessibilityLabel="Save expense"
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  Save expense
                </ThemedText>
              </Pressable>

              {preview ? (
                <ThemedView type="backgroundElement" style={styles.preview}>
                  <ThemedText type="smallBold">Preview — not sent yet</ThemedText>
                  <ThemedText type="code" themeColor="textSecondary">
                    {JSON.stringify(preview, null, 2)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    POST /transactions is not wired up yet.
                  </ThemedText>
                </ThemedView>
              ) : null}
            </View>
          </ScrollView>

          {isKeypadOpen ? (
            <NumericKeypad
              value={amount}
              caret={amountCaret}
              onChange={handleAmountChange}
              onSubmit={dismissAmountEditor}
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
  preview: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
