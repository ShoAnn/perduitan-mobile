import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listTransactions } from '@/db/transactions';
import { useTheme } from '@/hooks/use-theme';
import { useEffect, useState } from 'react';

type Tab = 'expense' | 'income';

export default function HistoryScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();

  const [tab, setTab] = useState<Tab>('expense');
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof listTransactions>>>([]);

  useEffect(() => {
    listTransactions(db).then((all) => {
      setTransactions(all);
    });
  }, [db]);

  const filtered = transactions.filter((t) =>
    tab === 'expense' ? t.amount_cents < 0 : t.amount_cents > 0
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={() => (
            <ThemedText style={styles.empty}>No transactions yet.</ThemedText>
          )}
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.cardRow}>
                <View>
                  <ThemedText type="smallBold">{item.account_name}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {item.category_name ?? 'Uncategorized'} · {item.occurred_on}
                  </ThemedText>
                </View>
                <ThemedText
                  type="smallBold"
                  style={{ color: item.amount_cents > 0 ? theme.positive : theme.negative }}>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'IDR',
                  }).format(Math.abs(item.amount_cents) / 100)}
                </ThemedText>
              </View>
              {item.description ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>
                  {item.description}
                </ThemedText>
              ) : null}
            </ThemedView>
          )}
          contentContainerStyle={styles.listContent}
        />

        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setTab('expense')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'expense' }}
            style={[styles.tabButton, tab === 'expense' && styles.tabButtonActive]}>
            <ThemedText
              type="smallBold"
              style={{ color: tab === 'expense' ? theme.background : theme.text }}>
              Expense
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setTab('income')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'income' }}
            style={[styles.tabButton, tab === 'income' && styles.tabButtonActive]}>
            <ThemedText
              type="smallBold"
              style={{ color: tab === 'income' ? theme.background : theme.text }}>
              Income
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.three,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  desc: {
    marginTop: Spacing.half,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E1E6',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: '#212225',
  },
});
