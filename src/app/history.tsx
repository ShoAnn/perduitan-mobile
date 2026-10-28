import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { FlatList, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listAllAccounts } from '@/db/accounts';
import { listTransactions } from '@/db/transactions';
import { useTheme } from '@/hooks/use-theme';
import { useLastUsedAccountId } from '@/stores/last-used-account';
import type { Account } from '@/types/api';
import { toDateString } from '@/utils/transactions';
import { useEffect, useMemo, useState } from 'react';

type Tab = 'expense' | 'income';
type Transaction = Awaited<ReturnType<typeof listTransactions>>[number];

const ALL_TIME = 'all';
const SHOW_ARCHIVED_KEY = 'history.showArchivedAccounts';

/** Account name with an `(archived)` marker for soft-deleted accounts. */
function accountLabel(account: Account): string {
  return account.archived_at ? `${account.name} (archived)` : account.name;
}

/** Reads the persisted "show archived" preference, defaulting to hidden. */
function readShowArchived(): boolean {
  try {
    return Storage.getItemSync(SHOW_ARCHIVED_KEY) === '1';
  } catch (error) {
    console.error('Failed to load the show archived preference', error);
    return false;
  }
}

type Row =
  | { type: 'header'; key: string; label: string }
  | { type: 'transaction'; key: string; transaction: Transaction };

/** Local `YYYY-MM` for a date. */
function monthKey(date: Date): string {
  return toDateString(date).slice(0, 7);
}

/** Formats `YYYY-MM` for display, for example `October 2026`. */
function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
}

/** `Today`/`Yesterday` plus the date, otherwise `Mon, Oct 27` (plus year when different). */
function formatDayLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(year, month - 1, day);
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  const formatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(year !== today.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);

  if (diffDays === 0) {
    return `${formatted} · Today`;
  }
  if (diffDays === 1) {
    return `${formatted} · Yesterday`;
  }

  return formatted;
}

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const db = useSQLiteContext();

  const lastUsedAccountId = useLastUsedAccountId(db);

  const [tab, setTab] = useState<Tab>('expense');
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof listTransactions>>>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKey(new Date()));
  // `undefined` means the filter still follows the last used account. Once the
  // user picks one (including "All accounts") their choice takes over.
  const [accountFilter, setAccountFilter] = useState<number | null | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(readShowArchived);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  useEffect(() => {
    listTransactions(db).then((all) => {
      setTransactions(all);
    });
  }, [db]);

  useEffect(() => {
    let isActive = true;

    listAllAccounts(db)
      .then((all) => {
        if (isActive) {
          setAccounts(all);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to load accounts for the history filter', error);
      });

    return () => {
      isActive = false;
    };
  }, [db]);

  // Mount with the account used by the most recent transaction. Deleted
  // accounts are not returned by the store, so this always points at a valid
  // account (or at everything when there is no such account).
  const selectedAccountId =
    accountFilter === undefined
      ? lastUsedAccountId !== null &&
        accounts.some((account) => account.id === lastUsedAccountId)
        ? lastUsedAccountId
        : null
      : accountFilter;

  const accountOptions = useMemo(
    () => (showArchived ? accounts : accounts.filter((account) => account.archived_at === null)),
    [accounts, showArchived]
  );

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const selectedAccountLabel = selectedAccount ? accountLabel(selectedAccount) : 'All accounts';

  const handleShowArchivedChange = (value: boolean) => {
    setShowArchived(value);
    Storage.setItem(SHOW_ARCHIVED_KEY, value ? '1' : '0').catch((error: unknown) => {
      console.error('Failed to save the show archived preference', error);
    });

    // Don't keep filtering by an account that is no longer listed.
    if (!value && selectedAccount?.archived_at) {
      setAccountFilter(null);
    }
  };

  const months = useMemo(() => {
    const keys = new Set(transactions.map((t) => t.occurred_on.slice(0, 7)));
    keys.add(monthKey(new Date()));
    return [...keys].sort().reverse();
  }, [transactions]);

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (tab === 'expense' ? t.amount_cents >= 0 : t.amount_cents <= 0) {
          return false;
        }
        if (selectedAccountId !== null && t.account_id !== selectedAccountId) {
          return false;
        }
        return selectedMonth === ALL_TIME || t.occurred_on.startsWith(`${selectedMonth}-`);
      }),
    [transactions, tab, selectedMonth, selectedAccountId]
  );

  const emptyLabel = useMemo(() => {
    const monthSuffix =
      selectedMonth === ALL_TIME ? '' : ` in ${formatMonthLabel(selectedMonth)}`;
    if (selectedAccount) {
      return `No ${tab} transactions for ${accountLabel(selectedAccount)}${monthSuffix}.`;
    }
    return selectedMonth === ALL_TIME
      ? 'No transactions yet.'
      : `No ${tab} transactions${monthSuffix}.`;
  }, [selectedAccount, selectedMonth, tab]);

  // Flat rows so each day can be introduced by a separator header. The query
  // already orders by `occurred_on`, so each group stays contiguous.
  const rows = useMemo(() => {
    const result: Row[] = [];
    let lastDate: string | null = null;

    for (const transaction of filtered) {
      if (transaction.occurred_on !== lastDate) {
        lastDate = transaction.occurred_on;
        result.push({
          type: 'header',
          key: `header-${transaction.occurred_on}`,
          label: formatDayLabel(transaction.occurred_on),
        });
      }
      result.push({
        type: 'transaction',
        key: `transaction-${transaction.id}`,
        transaction,
      });
    }

    return result;
  }, [filtered]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => setShowMonthPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by month, ${
                selectedMonth === ALL_TIME ? 'all time' : formatMonthLabel(selectedMonth)
              }`}
              hitSlop={8}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                {selectedMonth === ALL_TIME ? 'All time' : formatMonthLabel(selectedMonth)}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                ⌄
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          ListEmptyComponent={() => (
            <ThemedText style={styles.empty}>{emptyLabel}</ThemedText>
          )}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <ThemedText type="small" themeColor="textSecondary" style={styles.dayHeader}>
                  {item.label}
                </ThemedText>
              );
            }

            const transaction = item.transaction;

            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/transaction/[id]',
                    params: { id: String(transaction.id) },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${transaction.category_name ?? 'Uncategorized'}, ${
                  transaction.amount_cents > 0 ? 'income' : 'expense'
                }`}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <View style={styles.cardRow}>
                    <View>
                      <ThemedText type="smallBold">
                        {transaction.category_name ?? 'Uncategorized'}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: transaction.amount_cents > 0 ? theme.positive : theme.negative,
                      }}>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'IDR',
                      }).format(Math.abs(transaction.amount_cents) / 100)}
                    </ThemedText>
                  </View>
                  {transaction.description ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>
                      {transaction.description}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              </Pressable>
            );
          }}
          contentContainerStyle={styles.listContent}
        />

        <Pressable
          onPress={() => setShowAccountPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Filter by account, ${selectedAccountLabel}`}
          style={({ pressed }) => [styles.accountFilter, pressed && styles.pressed]}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.accountFilterName}>
            {selectedAccountLabel}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.accountFilterChevron}>
            ⌄
          </ThemedText>
        </Pressable>

        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setTab('expense')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'expense' }}
            style={[styles.tabButton, tab === 'expense' && styles.tabButtonActive]}>
            <ThemedText
              type="smallBold"
              style={{ color: tab === 'expense' ? '#000000' : theme.text }}>
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
              style={{ color: tab === 'income' ? '#000000' : theme.text }}>
              Income
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>

      <Modal
        visible={showMonthPicker}
        transparent
        animationType="none"
        onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowMonthPicker(false)}
          accessibilityRole="button"
          accessibilityLabel="Close month filter">
          <ThemedView
            type="backgroundElement"
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.modalTitle}>
              Filter by month
            </ThemedText>
            <FlatList
              data={[ALL_TIME, ...months]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = item === selectedMonth;
                return (
                  <Pressable
                    onPress={() => {
                      setSelectedMonth(item);
                      setShowMonthPicker(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={
                      item === ALL_TIME ? 'All time' : formatMonthLabel(item)
                    }>
                    {({ pressed }) => (
                      <ThemedView
                        type={selected ? 'backgroundSelected' : 'backgroundElement'}
                        style={[styles.monthOption, pressed && styles.pressed]}>
                        <ThemedText type={selected ? 'smallBold' : 'default'}>
                          {item === ALL_TIME ? 'All time' : formatMonthLabel(item)}
                        </ThemedText>
                        {selected ? (
                          <ThemedText type="smallBold" style={{ color: theme.accent }}>
                            ✓
                          </ThemedText>
                        ) : null}
                      </ThemedView>
                    )}
                  </Pressable>
                );
              }}
              contentContainerStyle={styles.modalListContent}
            />
          </ThemedView>
        </Pressable>
      </Modal>

      <Modal
        visible={showAccountPicker}
        transparent
        animationType="none"
        onRequestClose={() => setShowAccountPicker(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAccountPicker(false)}
          accessibilityRole="button"
          accessibilityLabel="Close account filter">
          <ThemedView
            type="backgroundElement"
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Filter by account
              </ThemedText>
              <View style={styles.archiveToggle}>
                <ThemedText type="small" themeColor="textSecondary">
                  Show archived
                </ThemedText>
                <Switch
                  value={showArchived}
                  onValueChange={handleShowArchivedChange}
                  accessibilityLabel="Show archived accounts"
                />
              </View>
            </View>
            <FlatList
              data={[null, ...accountOptions]}
              keyExtractor={(item) => (item ? String(item.id) : 'all')}
              renderItem={({ item }) => {
                const selected =
                  item === null ? selectedAccountId === null : item.id === selectedAccountId;
                const label = item ? accountLabel(item) : 'All accounts';

                return (
                  <Pressable
                    onPress={() => {
                      setAccountFilter(item ? item.id : null);
                      setShowAccountPicker(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}>
                    {({ pressed }) => (
                      <ThemedView
                        type={selected ? 'backgroundSelected' : 'backgroundElement'}
                        style={[styles.monthOption, pressed && styles.pressed]}>
                        <ThemedText type={selected ? 'smallBold' : 'default'}>{label}</ThemedText>
                        {selected ? (
                          <ThemedText type="smallBold" style={{ color: theme.accent }}>
                            ✓
                          </ThemedText>
                        ) : null}
                      </ThemedView>
                    )}
                  </Pressable>
                );
              }}
              contentContainerStyle={styles.modalListContent}
            />
          </ThemedView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.two,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  dayHeader: {
    marginTop: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    backgroundColor: '#ffffff',
  },
  accountFilter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.two,
    backgroundColor: '#ffffff',
  },
  accountFilterName: {
    flexShrink: 1,
    textAlign: 'center',
    color: '#000000',
  },
  accountFilterChevron: {
    position: 'absolute',
    right: Spacing.three,
    color: '#000000',
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '60%',
    borderRadius: Spacing.four,
    overflow: 'hidden',
    paddingTop: Spacing.four,
  },
  modalTitle: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.three,
  },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  modalListContent: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  monthOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
});
