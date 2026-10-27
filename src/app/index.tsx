import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, MaxContentWidth } from '@/constants/theme';
import { getAccountBalance, getLastUsedAccountId } from '@/db/transactions';
import { useAccounts } from '@/stores/accounts';
import { useEffect, useState } from 'react';

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const accounts = useAccounts(db);
  const [lastAccountId, setLastAccountId] = useState<number | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const lastAccount = accounts.find((a) => a.id === lastAccountId) ?? accounts[0] ?? null;

  useEffect(() => {
    getLastUsedAccountId(db).then(setLastAccountId);
  }, [db]);

  useEffect(() => {
    if (lastAccount) {
      getAccountBalance(db, lastAccount.id).then(setBalance);
    }
  }, [db, lastAccount]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          onPress={() => router.push('/accounts')}
          accessibilityRole="button"
          accessibilityLabel="Last used account"
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, styles.lastUsedSection]}>
          <ThemedView type="backgroundElement" style={styles.lastUsedCard}>
            <ThemedText type="subtitle" style={styles.balanceText}>
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR' }).format(
                balance / 100
              )}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.accountName}>
              {lastAccount ? lastAccount.name : 'No account'}
            </ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedView style={styles.actionRow}>
          <ActionButton
            href="/add-income"
            glyph="+"
            label="Add income"
            accessibilityLabel="Add income"
            glyphColor="positive"
          />
          <ActionButton
            href="/add-expense"
            glyph="−"
            label="Add expense"
            accessibilityLabel="Add expense"
            glyphColor="negative"
          />
        </ThemedView>

        <Pressable
          onPress={() => router.push('/history')}
          accessibilityRole="button"
          accessibilityLabel="History"
          style={({ pressed }) => [styles.historyButton, pressed && { opacity: 0.8 }]}>
          <ThemedView type="backgroundElement" style={styles.historyInner}>
            <ThemedText type="subtitle">History</ThemedText>
          </ThemedView>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
  },
  lastUsedSection: {
    alignSelf: 'stretch',
    width: '100%',
  },
  lastUsedCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 120,
  },
  balanceText: {
    fontSize: 32,
    fontWeight: 700,
    textAlign: 'center',
  },
  accountName: {
    textAlign: 'center',
  },
  historyButton: {
    alignSelf: 'stretch',
    width: '100%',
  },
  historyInner: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
});
