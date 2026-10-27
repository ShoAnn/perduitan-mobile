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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OptionPicker } from '@/components/form/option-picker';
import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getAccountById, updateAccount } from '@/db/accounts';
import { useTheme } from '@/hooks/use-theme';
import { refreshAccounts } from '@/stores/accounts';
import type { AccountType } from '@/types/api';

const TYPE_OPTIONS = [
  { value: 'checking' as const, label: 'Checking' },
  { value: 'savings' as const, label: 'Savings' },
  { value: 'credit_card' as const, label: 'Credit card' },
  { value: 'cash' as const, label: 'Cash' },
  { value: 'investment' as const, label: 'Investment' },
];

const CURRENCY_OPTIONS = [
  { value: 'IDR', label: 'IDR' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'JPY', label: 'JPY' },
  { value: 'SGD', label: 'SGD' },
  { value: 'AUD', label: 'AUD' },
  { value: 'CAD', label: 'CAD' },
  { value: 'CHF', label: 'CHF' },
  { value: 'CNY', label: 'CNY' },
  { value: 'INR', label: 'INR' },
  { value: 'KRW', label: 'KRW' },
  { value: 'THB', label: 'THB' },
  { value: 'MYR', label: 'MYR' },
  { value: 'PHP', label: 'PHP' },
  { value: 'VND', label: 'VND' },
];

type ActivePanel = 'type' | 'currency' | null;

export default function EditAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const db = useSQLiteContext();

  const accountId = useMemo(() => {
    const raw = params.id;
    if (typeof raw === 'string') return parseInt(raw, 10);
    if (Array.isArray(raw) && typeof raw[0] === 'string') return parseInt(raw[0], 10);
    return NaN;
  }, [params.id]);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState('IDR');
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isNaN(accountId));

  useEffect(() => {
    getAccountById(db, accountId).then((account) => {
      if (account) {
        setName(account.name);
        setType(account.type);
        setCurrency(account.currency);
      }
      setIsLoading(false);
    });
  }, [db, accountId]);

  const openTypePicker = () => {
    Keyboard.dismiss();
    setActivePanel('type');
  };

  const openCurrencyPicker = () => {
    Keyboard.dismiss();
    setActivePanel('currency');
  };

  const handleTypeChange = (value: AccountType | null) => {
    if (value !== null) {
      setType(value);
    }
    setActivePanel('currency');
  };

  const handleCurrencyChange = (value: string | null) => {
    if (value !== null) {
      setCurrency(value);
    }
    setActivePanel(null);
  };

  const dismissPanel = () => {
    setActivePanel(null);
    Keyboard.dismiss();
  };

  const handleSave = async () => {
    setActivePanel(null);
    Keyboard.dismiss();
    if (isSaving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Enter an account name.');
      return;
    }

    setNameError(null);
    setSaveError(null);
    setIsSaving(true);
    try {
      await updateAccount(db, accountId, {
        name: trimmedName,
        type,
        currency,
      });
      await refreshAccounts(db);
    } catch (error) {
      console.error('Failed to save account', error);
      setSaveError('Could not save the account. Please try again.');
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/accounts');
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
          <ThemedText>Loading…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

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
              <TextField
                label="Name"
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setNameError(null);
                }}
                onFocus={() => setActivePanel(null)}
                placeholder="Everyday Checking"
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={openTypePicker}
                error={nameError ?? undefined}
              />

              <SelectField
                label="Type"
                value={TYPE_OPTIONS.find((o) => o.value === type)?.label ?? null}
                placeholder="Select type"
                onPress={openTypePicker}
                open={activePanel === 'type'}
              />

              <SelectField
                label="Currency"
                value={currency || null}
                placeholder="Select currency"
                onPress={openCurrencyPicker}
                open={activePanel === 'currency'}
              />

              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save account"
                accessibilityState={{ disabled: isSaving, busy: isSaving }}
                style={({ pressed }) => [
                  styles.saveButton,
                  {
                    backgroundColor: theme.text,
                    opacity: isSaving ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {isSaving ? 'Saving…' : 'Save account'}
                </ThemedText>
              </Pressable>

              {saveError ? (
                <ThemedText type="small" style={{ color: theme.negative }}>
                  {saveError}
                </ThemedText>
              ) : null}
            </View>
          </ScrollView>

          {activePanel === 'type' ? (
            <OptionPicker
              options={TYPE_OPTIONS}
              value={type}
              onChange={handleTypeChange}
              title="Select type"
              onDismiss={dismissPanel}
            />
          ) : null}

          {activePanel === 'currency' ? (
            <OptionPicker
              options={CURRENCY_OPTIONS}
              value={currency}
              onChange={handleCurrencyChange}
              title="Select currency"
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
  saveButton: {
    minHeight: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
});
